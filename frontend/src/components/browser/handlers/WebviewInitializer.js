/**
 * WebviewInitializer - Creates and initializes the webview element
 * 
 * Handles webview element creation, event binding, and initial configuration.
 * Uses StyleManager for all styling aspects to avoid duplication.
 */

import logger from '../../../utils/logger';
import { handleWebviewLoad } from './EventHandlers';
import { handlePageLoadError, handleCertificateError } from './ErrorHandler';
import styleManager from './StyleManager';

// Create a logger instance
const webviewLogger = logger.scope('WebviewInitializer');

/**
 * Initialize a webview element and add it to the browser container
 * @param {Object} browser - Browser component instance
 * @param {HTMLElement} container - Container element for the webview
 * @returns {HTMLElement} Created webview element
 */
function initializeWebview(browser, container) {
  if (!browser || !container) {
    webviewLogger.error('Cannot initialize webview - missing browser or container');
    return null;
  }

  try {
    webviewLogger.debug('Creating webview element');
    
    // Create the webview element
    const webview = document.createElement('webview');
    
    // Set essential attributes
    webview.setAttribute('webpreferences', 'contextIsolation=yes, javascript=yes');
    webview.setAttribute('preload', './webview-preload.js');
    webview.setAttribute('partition', 'persist:cognivore');
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('disablewebsecurity', 'false');
    webview.setAttribute('data-ready', 'false');
    webview.setAttribute('data-load-finished', 'false');
    
    // Create and store a unique identifier for the webview
    webview.id = `webview-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Set initial source to about:blank to prevent flashing
    webview.setAttribute('src', 'about:blank');
    
    // Apply basic styles immediately to prevent flashing
    styleManager.applyBasicStyles(webview);
    
    // Set autosize to true for proper resizing
    webview.setAttribute('autosize', 'true');
    
    // Setup visibility-ensuring method on the webview instance
    webview.forceVisibility = function() {
      this.style.visibility = 'visible';
      this.style.opacity = '1';
      this.style.display = 'block';
      this.style.position = 'absolute';
      this.style.top = '0';
      this.style.left = '0';
      this.style.width = '100%';
      this.style.height = '100%';
      this.style.zIndex = '10';
      
      // Force a reflow to ensure styles are applied
      void this.offsetHeight;
      
      // Dispatch custom event for monitoring
      this.dispatchEvent(new CustomEvent('visibility-enforced'));
      
      webviewLogger.debug('Forced visibility on webview:', this.id);
    };
    
    // Setup method to apply all critical styles
    webview.applyAllCriticalStyles = function() {
      // Apply both general critical styles and site-specific styles
      const isGoogle = browser.state && browser.state.url && browser.state.url.includes('google.com');
      
      // Apply general critical styles first
      styleManager.applyCriticalStyles(this);
      
      // Apply Google-specific styles if needed
      if (isGoogle) {
        try {
          this.executeJavaScript(`
            (function() {
              // Create style element if it doesn't exist
              let styleEl = document.getElementById('cognivore-critical-styles');
              if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'cognivore-critical-styles';
                document.head.appendChild(styleEl);
              }
              
              // Apply critical styles for Google
              styleEl.textContent = \`
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  overflow-x: hidden !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                  display: block !important;
                }
                #main, #cnt, #rcnt, #center_col, #rso, [role="main"],
                .g, .yuRUbf, .MjjYud, #search, #searchform {
                  display: block !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                }
              \`;
              
              // Force visibility on key elements
              const criticalElements = [
                document.documentElement,
                document.body,
                document.getElementById('main'),
                document.getElementById('cnt'),
                document.getElementById('rcnt'),
                document.getElementById('center_col'),
                document.getElementById('rso'),
                document.querySelector('[role="main"]')
              ];
              
              criticalElements.forEach(el => {
                if (el) {
                  el.style.visibility = 'visible';
                  el.style.opacity = '1';
                  el.style.display = el.tagName === 'BODY' || el.tagName === 'HTML' ? 'block' : '';
                }
              });
              
              // Attempt to force reflow
              document.body.getBoundingClientRect();
              
              return true;
            })();
          `).catch(err => {
            webviewLogger.warn('Error applying Google-specific styles:', err.message);
          });
        } catch (err) {
          webviewLogger.warn('Error executing Google style script:', err.message);
        }
      }
      
      // Also apply visibility styles directly to the webview
      this.forceVisibility();
      
      webviewLogger.debug('Applied all critical styles to webview:', this.id);
    };
    
    // Bind event handlers
    bindWebviewEvents(browser, webview);
    
    // Append the webview to the container
    container.appendChild(webview);
    
    // Log that initialization is complete
    webviewLogger.debug('Webview element created and initialized:', webview.id);
    
    // Set an aggressive visibility timeout that ensures webview is visible
    // even if load events don't fire correctly
    setTimeout(() => {
      if (webview && webview.isConnected) {
        if (webview.style.visibility !== 'visible' || webview.style.opacity !== '1') {
          webviewLogger.debug('Applying visibility timeout enforcement');
          webview.forceVisibility();
          if (typeof webview.applyAllCriticalStyles === 'function') {
            webview.applyAllCriticalStyles();
          }
        }
      }
    }, 2000);
    
    return webview;
  } catch (error) {
    webviewLogger.error('Error initializing webview:', error);
    return null;
  }
}

/**
 * Bind required event handlers to webview element
 * @param {Object} browser - Browser component instance
 * @param {HTMLElement} webview - Webview element
 */
function bindWebviewEvents(browser, webview) {
  if (!browser || !webview) return;
  
  try {
    // Bind essential webview events
    
    // Load events
    webview.addEventListener('did-start-loading', () => {
      webviewLogger.debug('Webview started loading');
      webview.setAttribute('data-loading', 'true');
      
      // Apply initial visibility to prevent white screen during load
      webview.style.visibility = 'visible';
      webview.style.opacity = '1';
      
      // On any load start, make sure critical Google styles will be applied
      // when page is from Google
      if (browser.state && browser.state.url && browser.state.url.includes('google.com')) {
        setTimeout(() => {
          if (webview && webview.isConnected && typeof webview.applyAllCriticalStyles === 'function') {
            webviewLogger.debug('Pre-emptively applying Google critical styles');
            webview.applyAllCriticalStyles();
          }
        }, 500); // Apply early, even before page finishes loading
      }
    });
    
    webview.addEventListener('did-stop-loading', () => {
      webviewLogger.debug('Webview stopped loading');
      webview.setAttribute('data-loading', 'false');
      webview.setAttribute('data-load-finished', 'true');
      
      // When loading stops, ensure visibility
      webview.style.visibility = 'visible';
      webview.style.opacity = '1';
      
      // Use the complete load handler from EventHandlers
      handleWebviewLoad(browser);
    });
    
    // Navigation events
    webview.addEventListener('did-navigate', (event) => {
      webviewLogger.debug('Webview navigated to:', event.url);
      
      // Reset load finished flag on new navigation
      webview.setAttribute('data-load-finished', 'false');
      
      // Check if it's a Google page and pre-emptively apply critical styles
      if (event.url && event.url.includes('google.com')) {
        // Schedule several attempts to ensure styles are applied
        const applyGoogleStyles = () => {
          if (webview && webview.isConnected && typeof webview.applyAllCriticalStyles === 'function') {
            webview.applyAllCriticalStyles();
          }
        };
        
        // Apply immediately and then at intervals
        applyGoogleStyles();
        
        // Schedule additional attempts
        setTimeout(applyGoogleStyles, 500);
        setTimeout(applyGoogleStyles, 1500);
        setTimeout(applyGoogleStyles, 3000);
      }
    });
    
    webview.addEventListener('did-navigate-in-page', (event) => {
      webviewLogger.debug('Webview navigated in page to:', event.url);
    });
    
    // Error events
    webview.addEventListener('did-fail-load', (event) => {
      webviewLogger.warn('Webview failed to load:', event);
      handlePageLoadError(browser, event);
    });
    
    webview.addEventListener('did-fail-provisional-load', (event) => {
      webviewLogger.warn('Webview failed provisional load:', event);
      handlePageLoadError(browser, event);
    });
    
    webview.addEventListener('certificate-error', (event) => {
      webviewLogger.warn('Webview certificate error:', event);
      handleCertificateError(browser, event);
    });
    
    // Content visibility check event
    webview.addEventListener('dom-ready', () => {
      webviewLogger.debug('Webview DOM ready');
      webview.setAttribute('data-ready', 'true');
      
      // After DOM is ready, force visibility and apply critical styles
      webview.style.visibility = 'visible';
      webview.style.opacity = '1';
      
      if (typeof webview.applyAllCriticalStyles === 'function') {
        webview.applyAllCriticalStyles();
      }
      
      // Check if content is actually visible after a short delay
      setTimeout(() => {
        if (webview && webview.isConnected) {
          try {
            webview.executeJavaScript(`
              (function() {
                // Check if body and key elements are visible
                const bodyStyles = window.getComputedStyle(document.body);
                const htmlStyles = window.getComputedStyle(document.documentElement);
                
                const isBodyVisible = bodyStyles.display !== 'none' && bodyStyles.visibility !== 'hidden';
                const isHtmlVisible = htmlStyles.display !== 'none' && htmlStyles.visibility !== 'hidden';
                
                if (!isBodyVisible || !isHtmlVisible) {
                  // Force visibility on critical elements
                  document.documentElement.style.visibility = 'visible';
                  document.documentElement.style.display = 'block';
                  document.body.style.visibility = 'visible';
                  document.body.style.display = 'block';
                }
                
                return { isBodyVisible, isHtmlVisible };
              })();
            `).then(result => {
              if (!result.isBodyVisible || !result.isHtmlVisible) {
                webviewLogger.debug('Detected hidden body/html, applied visibility fix');
              }
            }).catch(err => {
              webviewLogger.warn('Error checking content visibility:', err.message);
            });
          } catch (err) {
            webviewLogger.warn('Error executing content visibility check:', err.message);
          }
        }
      }, 500);
    });
    
    // Create custom load success event
    webview.addEventListener('load-success', () => {
      webviewLogger.debug('Webview load success event fired');
      webview.setAttribute('data-load-success', 'true');
    });
    
    // Console message logging (useful for debugging)
    webview.addEventListener('console-message', (event) => {
      webviewLogger.debug(`Webview console [${event.level}]: ${event.message}`);
    });
    
    webviewLogger.debug('All webview event handlers bound successfully');
  } catch (error) {
    webviewLogger.error('Error binding webview events:', error);
  }
}

/**
 * Create and initialize a webview for a browser
 * @param {Object} browser - Browser component instance
 * @returns {HTMLElement} Initialized webview
 */
function createWebview(browser) {
  if (!browser) {
    webviewLogger.error('Cannot create webview: browser object is missing');
    return null;
  }
  
  try {
    // Get the container element
    const container = browser.container || browser.contentFrame;
    
    if (!container || !container.isConnected) {
      webviewLogger.error('Cannot create webview: container not available or not connected to DOM');
      return null;
    }
    
    // Initialize and return the webview
    return initializeWebview(browser, container);
  } catch (error) {
    webviewLogger.error('Error creating webview:', error);
    return null;
  }
}

// Export public methods
export default {
  createWebview,
  initializeWebview,
  bindWebviewEvents
}; 