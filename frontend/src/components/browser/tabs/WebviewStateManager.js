/**
 * WebviewStateManager.js - Manages webview state preservation across tab switches
 * 
 * This utility handles saving and restoring webview state including:
 * - URL and navigation history
 * - Scroll position
 * - Form data and input values
 * - Page zoom level
 * - DOM state snapshots
 */

import logger from '../../../utils/logger';

// Create a logger instance
const stateLogger = logger.scope('WebviewStateManager');

class WebviewStateManager {
  constructor() {
    this.stateMap = new Map(); // tabId -> state
    this.captureTimeout = null;
    this.restoreTimeout = null;
  }

  /**
   * Capture current state of webview for a tab
   * @param {string} tabId - Tab ID to save state for
   * @param {HTMLElement} webview - Webview element
   * @returns {Promise<Object>} - Captured state object
   */
  async captureState(tabId, webview) {
    if (!tabId || !webview) {
      stateLogger.warn('Cannot capture state: missing tabId or webview');
      return null;
    }

    try {
      stateLogger.info(`Capturing state for tab ${tabId}`);
      
      // Clear any pending capture
      if (this.captureTimeout) {
        clearTimeout(this.captureTimeout);
      }

      const state = {
        timestamp: Date.now(),
        url: null,
        title: null,
        scrollPosition: { x: 0, y: 0 },
        formData: {},
        navigationState: {
          canGoBack: false,
          canGoForward: false
        }
      };

      // Execute capture script in webview with enhanced URL validation
      if (typeof webview.executeJavaScript === 'function') {
        try {
          const result = await webview.executeJavaScript(`
            (function() {
              try {
                const url = window.location.href;
                
                // CRITICAL FIX: Enhanced URL validation
                if (!url || url === '' || url === 'about:blank' || url === null || url === undefined) {
                  return { 
                    error: 'Invalid URL detected',
                    url: url,
                    invalidUrl: true
                  };
                }
                
                // Get all form data safely
                const forms = document.querySelectorAll('form');
                const formData = {};
                let formCount = 0;
                
                forms.forEach((form, index) => {
                  try {
                    const formElements = form.querySelectorAll('input, select, textarea');
                    const formDataObj = {};
                    
                    formElements.forEach(element => {
                      if (element.type !== 'password' && element.type !== 'hidden' && element.name) {
                        formDataObj[element.name] = element.value || '';
                      }
                    });
                    
                    if (Object.keys(formDataObj).length > 0) {
                      formData['form_' + index] = formDataObj;
                      formCount++;
                    }
                  } catch (e) {
                    // Skip problematic forms
                  }
                });

                return {
                  url: url,
                  title: document.title || 'Untitled',
                  scrollY: window.scrollY || 0,
                  scrollX: window.scrollX || 0,
                  formsCount: formCount,
                  formData: formData,
                  readyState: document.readyState,
                  hasBody: !!document.body
                };
              } catch (e) {
                return { 
                  error: e.message,
                  url: window.location ? window.location.href : null,
                  fallback: true
                };
              }
            })()
          `);

          if (result) {
            // CRITICAL FIX: Check for invalid URL before storing state
            if (result.invalidUrl || result.error === 'Invalid URL detected') {
              stateLogger.warn(`Tab ${tabId} has invalid URL: ${result.url}, skipping state capture`);
              return null;
            }
            
            if (result.error && !result.fallback) {
              stateLogger.warn(`State capture script failed for tab ${tabId}: ${result.error}`);
              return null;
            }

            // CRITICAL FIX: Final URL validation before storing
            if (!result.url || result.url === '' || result.url === 'about:blank' || 
                result.url === null || result.url === undefined) {
              stateLogger.warn(`Tab ${tabId} returned invalid URL: ${result.url}, skipping state capture`);
              return null;
            }

            // Update state with captured data
            state.url = result.url;
            state.title = result.title || 'Untitled';
            state.scrollPosition = {
              x: result.scrollX || 0,
              y: result.scrollY || 0
            };
            state.formData = result.formData || {};
            
            // Store the state
            this.stateMap.set(tabId, state);
            
            stateLogger.info(`State captured successfully for tab ${tabId}: ${JSON.stringify({
              url: state.url,
              scrollY: state.scrollPosition.y,
              formsCount: result.formsCount || 0,
              title: state.title
            })}`);
            
            return state;
          }
        } catch (error) {
          stateLogger.warn(`Failed to execute state capture script for tab ${tabId}: ${error.message}`);
        }
      }

      // CRITICAL FIX: Enhanced fallback method with URL validation
      try {
        let fallbackUrl = null;
        
        // Try to get URL from webview src attribute
        if (webview.src && webview.src !== '' && webview.src !== 'about:blank') {
          fallbackUrl = webview.src;
        }
        
        // Try to get URL via getURL method if available
        if (!fallbackUrl && typeof webview.getURL === 'function') {
          try {
            const webviewUrl = webview.getURL();
            if (webviewUrl && webviewUrl !== '' && webviewUrl !== 'about:blank') {
              fallbackUrl = webviewUrl;
            }
          } catch (err) {
            // getURL might not be available
          }
        }
        
        // CRITICAL FIX: Only store state if we have a valid fallback URL
        if (fallbackUrl) {
          state.url = fallbackUrl;
          state.title = 'Page Content';
          
          this.stateMap.set(tabId, state);
          stateLogger.info(`Fallback state captured for tab ${tabId} with URL: ${fallbackUrl}`);
          return state;
        } else {
          stateLogger.warn(`No valid URL available for tab ${tabId}, cannot capture state`);
          return null;
        }
      } catch (fallbackError) {
        stateLogger.warn(`Fallback state capture failed for tab ${tabId}: ${fallbackError.message}`);
        return null;
      }
    } catch (error) {
      stateLogger.error(`Error capturing state for tab ${tabId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Wait for webview to be ready for script execution
   * @param {HTMLElement} webview - Webview element
   * @returns {Promise<boolean>} - Whether webview is ready
   */
  async waitForWebviewReady(webview) {
    return new Promise((resolve) => {
      // Check if webview is already ready
      if (webview.getWebContents && typeof webview.getWebContents === 'function') {
        try {
          const webContents = webview.getWebContents();
          if (webContents && !webContents.isLoading()) {
            resolve(true);
            return;
          }
        } catch (err) {
          // Ignore error, will wait for ready state
        }
      }

      // Wait for dom-ready event
      const handleReady = () => {
        webview.removeEventListener('dom-ready', handleReady);
        resolve(true);
      };

      webview.addEventListener('dom-ready', handleReady);

      // Fallback timeout
      setTimeout(() => {
        webview.removeEventListener('dom-ready', handleReady);
        resolve(false);
      }, 3000);
    });
  }

  /**
   * Restore state to webview for a tab
   * @param {string} tabId - Tab ID to restore state for
   * @param {HTMLElement} webview - Webview element
   * @param {string} targetUrl - URL to navigate to (optional, fallback if no saved state)
   * @returns {Promise<boolean>} - Whether state was successfully restored
   */
  async restoreState(tabId, webview, targetUrl = null) {
    if (!tabId || !webview) {
      stateLogger.warn('Cannot restore state: missing tabId or webview');
      return false;
    }

    try {
      const state = this.stateMap.get(tabId);
      if (!state) {
        stateLogger.info(`No saved state found for tab ${tabId}, will navigate to target URL only`);
        // If no state but we have a target URL, just navigate
        if (targetUrl && targetUrl !== webview.src) {
          // CRITICAL FIX: Validate target URL before navigation
          if (this.isValidUrl(targetUrl)) {
            try {
              webview.src = targetUrl;
              stateLogger.info(`Navigated to ${targetUrl} for tab ${tabId} (no saved state)`);
              return true;
            } catch (navError) {
              stateLogger.warn(`Failed to navigate to ${targetUrl}: ${navError.message}`);
              return false;
            }
          } else {
            stateLogger.warn(`Invalid target URL for tab ${tabId}: ${targetUrl}`);
            return false;
          }
        }
        return false;
      }

      // CRITICAL FIX: Validate saved state URL before attempting restoration
      if (!state.url || !this.isValidUrl(state.url)) {
        stateLogger.warn(`Tab ${tabId} has invalid saved URL: ${state.url}, cannot restore`);
        return false;
      }

      stateLogger.info(`Restoring state for tab ${tabId}: ${JSON.stringify({
        url: state.url,
        scrollY: state.scrollPosition?.y || 0,
        formsCount: Object.keys(state.formData || {}).length
      })}`);

      // CRITICAL FIX: Always use saved state URL when available, ignore targetUrl
      // The saved state URL is the actual URL the user was on when the tab was last active
      const urlToNavigate = state.url;
      
      stateLogger.info(`Using saved state URL for restoration: ${urlToNavigate} (ignoring targetUrl: ${targetUrl})`);

      // Step 1: Navigate to the saved URL
      if (webview.src !== urlToNavigate) {
        try {
          webview.src = urlToNavigate;
          stateLogger.info(`Navigated to ${urlToNavigate} for state restoration`);
        } catch (navError) {
          stateLogger.warn(`Failed to navigate during state restoration: ${navError.message}`);
          return false;
        }
      }

      // Step 2: Wait for page to load and then restore state
      if (typeof webview.executeJavaScript === 'function') {
        try {
          // Give the page time to load before restoring state
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const restorationResult = await webview.executeJavaScript(`
            (function() {
              try {
                // CRITICAL FIX: More lenient URL validation for restoration
                const currentUrl = window.location.href;
                const expectedUrl = '${state.url}';
                
                // Normalize URLs for comparison (remove protocols and trailing slashes)
                const normalizeUrl = (url) => {
                  return url.toLowerCase()
                    .replace(/^https?:\/\//i, '')
                    .replace(/\/+$/, '');
                };
                
                const currentNormalized = normalizeUrl(currentUrl);
                const expectedNormalized = normalizeUrl(expectedUrl);
                
                // Check if URLs match or if current URL is a reasonable match
                const urlsMatch = currentNormalized === expectedNormalized || 
                                currentNormalized.includes(expectedNormalized.split('/')[0]) ||
                                expectedNormalized.includes(currentNormalized.split('/')[0]);
                
                if (!urlsMatch) {
                  return { 
                    error: 'URL mismatch during restoration',
                    expected: expectedUrl,
                    actual: currentUrl,
                    expectedNormalized: expectedNormalized,
                    currentNormalized: currentNormalized,
                    success: false
                  };
                }
                
                // Restore scroll position
                const targetScrollY = ${state.scrollPosition?.y || 0};
                const targetScrollX = ${state.scrollPosition?.x || 0};
                
                if (targetScrollY > 0 || targetScrollX > 0) {
                  window.scrollTo(targetScrollX, targetScrollY);
                }

                // Restore form data if available
                const formData = ${JSON.stringify(state.formData || {})};
                let formsRestored = 0;
                
                Object.keys(formData).forEach(formKey => {
                  try {
                    const formIndex = parseInt(formKey.replace('form_', ''));
                    const form = document.querySelectorAll('form')[formIndex];
                    
                    if (form && formData[formKey]) {
                      Object.keys(formData[formKey]).forEach(fieldName => {
                        try {
                          const field = form.querySelector(\`[name="\${fieldName}"]\`);
                          if (field && field.type !== 'password' && field.type !== 'hidden') {
                            field.value = formData[formKey][fieldName];
                          }
                        } catch (fieldError) {
                          // Skip problematic fields
                        }
                      });
                      formsRestored++;
                    }
                  } catch (formError) {
                    // Skip problematic forms
                  }
                });

                return {
                  success: true,
                  scrollRestored: targetScrollY > 0 || targetScrollX > 0,
                  formsRestored: formsRestored,
                  url: currentUrl,
                  urlMatch: urlsMatch
                };
              } catch (e) {
                return { 
                  error: e.message,
                  success: false
                };
              }
            })()
          `);

          if (restorationResult) {
            if (restorationResult.success) {
              stateLogger.info(`State restoration script executed successfully: ${JSON.stringify(restorationResult)}`);
              return true;
            } else {
              stateLogger.warn(`State restoration failed: ${restorationResult.error}`, restorationResult);
              // Even if script restoration failed, navigation succeeded
              return true;
            }
          }
        } catch (scriptError) {
          stateLogger.warn(`Failed to execute state restoration script: ${scriptError.message}`);
          // Still return true since navigation succeeded
          return true;
        }
      }

      // If we can't execute JavaScript, at least we navigated successfully
      return true;
    } catch (error) {
      stateLogger.error(`Error restoring state for tab ${tabId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate if a URL is valid for navigation
   * @param {string} url - URL to validate
   * @returns {boolean} - True if URL is valid
   */
  isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Check for obviously invalid URLs
    if (url === '' || url === 'about:blank' || url === null || url === undefined) {
      return false;
    }
    
    // Check for data URLs or other problematic schemes
    if (url.startsWith('data:') || url.startsWith('javascript:')) {
      return false;
    }
    
    // Must be http or https
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }
    
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get saved state for a tab
   * @param {string} tabId - Tab ID
   * @returns {Object|null} - Saved state or null
   */
  getState(tabId) {
    return this.stateMap.get(tabId) || null;
  }

  /**
   * Clear saved state for a tab
   * @param {string} tabId - Tab ID
   * @returns {boolean} - Whether state was cleared
   */
  clearState(tabId) {
    return this.stateMap.delete(tabId);
  }

  /**
   * Clear all saved states
   */
  clearAllStates() {
    this.stateMap.clear();
    if (this.captureTimeout) {
      clearTimeout(this.captureTimeout);
      this.captureTimeout = null;
    }
    if (this.restoreTimeout) {
      clearTimeout(this.restoreTimeout);
      this.restoreTimeout = null;
    }
  }

  /**
   * Get all saved states (for debugging)
   * @returns {Object} - Map of tabId -> state
   */
  getAllStates() {
    const states = {};
    this.stateMap.forEach((state, tabId) => {
      states[tabId] = state;
    });
    return states;
  }

  /**
   * Quick state capture without full DOM analysis (for frequent saves)
   * @param {string} tabId - Tab ID
   * @param {HTMLElement} webview - Webview element
   * @returns {Object} - Basic state object
   */
  captureBasicState(tabId, webview) {
    if (!tabId || !webview) return null;

    try {
      const basicState = {
        timestamp: Date.now(),
        url: webview.src || webview.getAttribute('src'),
        title: null,
        isLoading: false
      };

      // Get basic webContents info if available
      if (webview.getWebContents && typeof webview.getWebContents === 'function') {
        try {
          const webContents = webview.getWebContents();
          if (webContents) {
            basicState.title = webContents.getTitle();
            basicState.isLoading = webContents.isLoading();
          }
        } catch (err) {
          // Ignore errors in basic capture
        }
      }

      // Update existing state or create new one
      const existingState = this.stateMap.get(tabId);
      if (existingState) {
        Object.assign(existingState, basicState);
      } else {
        this.stateMap.set(tabId, basicState);
      }

      return basicState;
    } catch (error) {
      stateLogger.warn(`Error in basic state capture for tab ${tabId}:`, error);
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.clearAllStates();
    stateLogger.info('WebviewStateManager cleaned up');
  }
}

// Create singleton instance
const webviewStateManager = new WebviewStateManager();

export default webviewStateManager; 