/**
 * BrowserRenderer - Core webview management for the browser
 * Focuses ONLY on webview creation, basic content loading, and core webview functionality
 * Layout and UI components are handled by specialized renderers
 * 
 * @deprecated Many functions in this file have been moved to specialized renderers:
 * - Address bar functionality -> AddressBarRenderer.js
 * - Navigation controls -> NavigationControlsRenderer.js  
 * - Action buttons -> ActionButtonsRenderer.js
 * - Content rendering -> ContentRenderer.js
 * - Layout coordination -> BrowserLayoutManager.js
 * - Progress bars should be handled by NavigationControlsRenderer or a dedicated component
 */
import { createBrowserPlaceholder } from './ContentRenderer.js';
import { updateAddressBar as updateAddressBarRenderer } from './AddressBarRenderer.js';
import { updateLoadingControls } from './NavigationControlsRenderer.js';

/**
 * Create webview element with proper configuration
 * @param {Object} browser - Browser instance
 * @param {string} implementation - Implementation type ('webview' or 'iframe')
 * @param {string} sandboxLevel - Sandbox level for the webview
 * @returns {HTMLElement} Created webview or iframe
 */
export function createWebviewElement(browser, implementation = 'webview', sandboxLevel = 'full') {
  console.log('Creating webview element for browser with enhanced CSP and security settings');
  
  // Generate a truly unique partition name with timestamp and random string
  const uniqueId = Math.random().toString(36).substring(2, 15);
  const partition = `persist:voyager-${Date.now()}-${uniqueId}`;
  
  if (implementation === 'webview') {
    try {
      const webview = document.createElement('webview');
      
      // Set class name for styling
      webview.className = 'browser-webview';
      
      // Set a unique ID for easier DOM lookup
      webview.id = `webview-${browser.browserId || Math.floor(Math.random() * 100000)}`;
      
      // Instead of setting all attributes at once, set them in specific order
      // to prevent conflicts and race conditions
      
      // STEP 1: Set most critical attributes first
      webview.setAttribute('partition', partition);
      
      // STEP 2: Set security-related attributes next
      webview.setAttribute('disablewebsecurity', 'true');
      
      // STEP 3: Set the webpreferences before other configurations
      webview.setAttribute('webpreferences', [
        'allowRunningInsecureContent=true',
        'contextIsolation=yes',
        'sandbox=yes',
        'safeDialogs=yes',
        'webSecurity=no',
        'navigateOnDragDrop=no',
        'experimentalFeatures=yes',
        'allowFileAccessFromFiles=yes'
      ].join(', '));
      
      // STEP 4: Set comprehensive sandbox permissions
      webview.setAttribute('sandbox', [
        'allow-forms',
        'allow-modals',
        'allow-popups',
        'allow-presentation',
        'allow-same-origin',
        'allow-scripts',
        'allow-top-navigation',
        'allow-downloads'
      ].join(' '));
      
      // STEP 5: Set remaining attributes
      webview.setAttribute('allowpopups', 'true');
      webview.setAttribute('allowfullscreen', 'true');
      webview.setAttribute('autosize', 'true');
      webview.setAttribute('nodeintegration', 'no');
      webview.setAttribute('plugins', 'true');
      
      // STEP 6: Set initial src to avoid navigation issues
      // Don't set src to about:blank to prevent navigation conflicts
      
      // Set up webview ready flag to track initialization state
      webview.isReady = false;
      
      // Add MINIMAL event listeners to prevent IPC serialization issues
      webview.addEventListener('did-finish-load', () => {
        console.log('Webview did-finish-load event fired', webview.id);
        webview.isReady = true;
      });
      
      webview.addEventListener('dom-ready', () => {
        console.log('Webview dom-ready event fired', webview.id);
        webview.isReady = true;
        
        // Apply CSP bypass once DOM is ready - simplified version
        if (typeof webview.executeJavaScript === 'function') {
          try {
            webview.executeJavaScript(`
              try {
                if (document.head) {
                  document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach(tag => tag.remove());
                  const meta = document.createElement('meta');
                  meta.httpEquiv = 'Content-Security-Policy';
                  meta.content = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;";
                  document.head.appendChild(meta);
                  console.log('Added permissive CSP via meta tag');
                }
              } catch(e) {
                console.warn('CSP setup error:', e.message);
              }
            `).catch(() => {
              // Silently ignore CSP bypass errors to prevent IPC issues
            });
          } catch (err) {
            // Silently ignore to prevent IPC serialization errors
          }
        }
      });
      
      // CRITICAL FIX: Remove complex event handlers that cause IPC serialization errors
      // Only keep essential error logging without complex object handling
      webview.addEventListener('crashed', () => {
        console.error('Webview crashed');
      });
      
      console.log('Webview element created successfully with enhanced security settings');
      
      return webview;
    } catch (error) {
      console.error('Error creating webview:', error);
      // Fallback to iframe if webview creation fails
      implementation = 'iframe';
    }
  }
  
  // Fallback to iframe implementation
  if (implementation === 'iframe') {
    console.log('Creating iframe element as fallback');
    const iframe = document.createElement('iframe');
    iframe.className = 'browser-webview';
    iframe.sandbox = 'allow-forms allow-modals allow-popups allow-scripts allow-same-origin allow-top-navigation';
    
    return iframe;
  }
  
  console.error('Failed to create webview element with any implementation');
  return null;
}

/**
 * Safely execute JavaScript in a webview when it's ready
 * @param {HTMLElement} webview - The webview element
 * @param {Function} executeFunction - Function to execute when webview is ready
 * @param {number} maxAttempts - Maximum number of retry attempts
 * @param {number} delay - Delay between attempts in ms
 * @returns {Promise} Promise that resolves when executed or after max attempts
 */
function executeSafelyInWebview(webview, executeFunction, maxAttempts = 5, delay = 500) {
  if (!webview) return Promise.reject(new Error('No webview provided'));
  
  let attempts = 0;
  
  // Create a function to check if webview is ready and execute
  const tryExecute = () => {
    // Check if webview is ready using multiple indicators
    const isWebviewReady = 
      // Check explicit ready flag
      (webview.isReady === true || 
      // Check DOM attachment
      webview.isAttached === true ||
      // Check if it has DOM nodes (another way to detect attachment)
      (webview.parentNode !== null && webview.parentNode !== undefined) ||
      // Check if the webview element is connected to the DOM
      webview.isConnected === true || webview._isAttached === true) &&
      // Make sure it has the executeJavaScript method
      typeof webview.executeJavaScript === 'function';
    
    // If webview appears ready by any of our checks, try to execute
    if (isWebviewReady) {
      try {
        // Log webview state for debugging
        console.log('Executing in webview with state:', {
          isReady: webview.isReady,
          isAttached: webview.isAttached, 
          hasParent: !!webview.parentNode,
          isConnected: webview.isConnected
        });
        
        return executeFunction();
      } catch (err) {
        console.warn('Error executing in webview:', err);
        return Promise.reject(err);
      }
    } 
    
    // If we've exhausted attempts, try one last time with a direct approach
    if (attempts >= maxAttempts) {
      console.warn(`Webview not ready after ${maxAttempts} attempts, trying direct execution as last resort`);
      
      try {
        // Force execution regardless of ready state as a last resort
        if (typeof webview.executeJavaScript === 'function') {
          return executeFunction();
        }
        
        // If that still didn't work, reject with meaningful error
        return Promise.reject(new Error('Webview not ready after maximum attempts and final direct attempt failed'));
      } catch(finalErr) {
        console.error('Final direct execution attempt failed:', finalErr);
        return Promise.reject(new Error('Webview not ready after maximum attempts'));
      }
    }
    
    // Otherwise, increment attempts and try again after delay
    attempts++;
    console.log(`Webview not ready, attempt ${attempts}/${maxAttempts}. Trying again in ${delay}ms...`);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        tryExecute().then(resolve).catch(reject);
      }, delay);
    });
  };
  
  // Start the execution attempt
  return tryExecute().catch(err => {
    console.warn('ExecuteSafelyInWebview error:', err);
    return Promise.reject(err);
  });
}

/**
 * Create webview container for browser content
 * @param {Object} browser - Browser instance
 * @param {string} implementation - Webview implementation ('webview', 'iframe-proxy', 'iframe-fallback')
 * @param {string} sandboxLevel - Level of sandboxing to apply
 * @returns {Object} Webview container and element
 */
export function createWebview(browser, implementation, sandboxLevel) {
  console.log('📣 Creating webview container with simplified positioning for compatibility');
  
  // Use existing container if available, otherwise let CSS handle positioning
  let container = browser.webviewContainer || 
                 browser.containerRef?.current?.querySelector('.browser-webview-container') ||
                 document.querySelector('.browser-webview-container');
  
  if (!container) {
    // Create a simple container that works with CSS positioning
    container = document.createElement('div');
    container.className = 'browser-webview-container';
    
    // Use simple styling that works with CSS
    container.style.cssText = `
      position: relative !important;
      width: 100% !important;
      height: 100% !important;
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      background-color: white !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    `;
    
    // Find the browser container to append to
    const browserContainer = browser.containerRef?.current || 
                            document.querySelector('.browser-container') ||
                            document.querySelector('.voyager-browser');
    
    if (browserContainer) {
      browserContainer.appendChild(container);
    } else {
      console.warn('No browser container found - this may cause positioning issues');
      // Fallback to document body
      document.body.appendChild(container);
    }
  } else {
    // Update existing container with simple styling
    container.style.cssText = `
      position: relative !important;
      width: 100% !important;
      height: 100% !important;
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      background-color: white !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    `;
    
    // Clear any existing content
    container.innerHTML = '';
  }
  
  // Use our enhanced webview creation function
  let webview = createWebviewElement(browser);
  
  // Verify webview was created correctly
  if (!webview) {
    console.error('Failed to create webview element');
    return { container, webview: null };
  }
  
  // Apply comprehensive styles for immediate visibility
  webview.style.cssText = `
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 500px !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 1 !important;
    background-color: white !important;
    flex: 1 !important;
    pointer-events: auto !important;
  `;
  
  // Ensure autosize is set correctly
  webview.autosize = false;
  
  // Set immediate visibility flag
  webview.readyToShow = true;
  
  // Force layout recalculation
  void webview.offsetHeight;
  
  // Force attachment to DOM
  try {
    container.appendChild(webview);
    
    // CRITICAL FIX: Do NOT set up problematic IPC messaging that causes serialization errors
    // Remove the setupSafeIpcMessaging call that was causing 'An object could not be cloned' errors
    
    // Verify DOM attachment
    if (webview.parentNode) {
      webview.isAttached = true;
      webview._isAttached = true;
      
      console.log('✅ Webview successfully attached to DOM and ready for navigation');
      
      // Set readyToShow to enable immediate visibility
      webview.readyToShow = true;
    } else {
      console.warn('⚠️ Webview attachment verification failed');
    }
  } catch (error) {
    console.error('Error attaching webview to container:', error);
    return { container, webview: null };
  }
  
  return { container, webview };
}

/**
 * @deprecated Use a dedicated progress component or NavigationControlsRenderer instead
 * This function will be removed in a future version
 */
export function createProgressBar() {
  console.warn('createProgressBar is deprecated. Use NavigationControlsRenderer or a dedicated progress component instead.');
  
  const progressContainer = document.createElement('div');
  progressContainer.className = 'browser-progress-container';
  progressContainer.style.cssText = `
    width: 100%;
    height: 3px;
    background-color: var(--progress-bg-color, #e2e8f0);
    position: relative;
    overflow: hidden;
    display: none;
  `;
  
  const progressBar = document.createElement('div');
  progressBar.className = 'browser-progress-bar';
  progressBar.style.cssText = `
    height: 100%;
    background-color: var(--progress-color, #3b82f6);
    width: 0%;
    transition: width 0.3s ease;
  `;
  
  progressContainer.appendChild(progressBar);
  
  return progressContainer;
}

/**
 * @deprecated Use ContentRenderer.showLoadingContent() instead
 * This function will be removed in a future version
 */
export function showLoadingContent(browser, url) {
  console.warn('showLoadingContent is deprecated. Use ContentRenderer.showLoadingContent() instead.');
  return createBrowserPlaceholder(browser);
}

/**
 * @deprecated Use ContentRenderer.hideLoadingContent() instead  
 * This function will be removed in a future version
 */
export function hideLoadingContent(browser) {
  console.warn('hideLoadingContent is deprecated. Use ContentRenderer.hideLoadingContent() instead.');
  // Basic hide functionality
  if (browser.loadingContent) {
    browser.loadingContent.style.display = 'none';
  }
}

/**
 * Core webview styling enforcement - simplified version focused only on essential webview styling
 * @param {Object} browser - Browser instance
 * @param {boolean} forcedApply - Whether to force style application
 */
export function enforceWebviewStyles(browser, forcedApply = false) {
  if (!browser || !browser.webview) {
    console.warn('Cannot enforce webview styles - missing browser or webview');
    return;
  }
  
  try {
    // Apply essential webview styles only
    browser.webview.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      background-color: white !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 1 !important;
      display: block !important;
      pointer-events: auto !important;
    `;
    
    // Force layout recalculation
    void browser.webview.offsetHeight;
    
    // Mark webview as ready to show
    browser.webview.readyToShow = true;
    
    // Apply enhanced site-specific fix for Google with better reliability
    if (browser.state && browser.state.url && 
        browser.state.url.includes('google.com') && 
        typeof browser.webview.executeJavaScript === 'function') {
      try {
        // First ensure webview is fully visible regardless of load state
        browser.webview.style.visibility = 'visible';
        browser.webview.style.opacity = '1';
        browser.webview.style.display = 'block';
        browser.webview.style.zIndex = '10';
        
        // Force a layout recalculation to ensure styles are applied immediately
        void browser.webview.offsetHeight;
        
        // Execute script with comprehensive Google-specific fixes
        browser.webview.executeJavaScript(`
          (function() {
            try {
              // Ensure style element exists with a unique ID
              let styleEl = document.getElementById('cognivore-google-render-fix');
              if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'cognivore-google-render-fix';
                document.head.appendChild(styleEl);
              }
              
              // Apply enhanced Google-specific CSS with stronger !important rules
              styleEl.textContent = \`
                /* Root element fixes */
                html, body {
                  width: 100% !important;
                  height: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow-x: hidden !important;
                  position: absolute !important;
                  top: 0 !important;
                  left: 0 !important;
                  right: 0 !important;
                  bottom: 0 !important;
                  display: block !important;
                  visibility: visible !important;
                }
                
                /* Enhanced target for all major Google search containers */
                #main, #cnt, #rcnt, #center_col, #rso, [role="main"],
                #search, #appbar, .SDkEP, .MjjYud, .g, .minidiv, .sfbg, 
                .s6JM6d, .T4LgNb, .aajZCb, .WE0UJf, .appbar, .OUZ5W, 
                .GyAeWb, .RNNXgb, .o3j99, .ikrT4e {
                  width: 100% !important;
                  max-width: 100% !important;
                  margin-left: auto !important;
                  margin-right: auto !important;
                  padding-left: 0 !important;
                  padding-right: 0 !important;
                  box-sizing: border-box !important;
                  min-width: auto !important;
                  display: block !important;
                }
                
                /* Fix Google search result containers with stronger selectors */
                .g, .yuRUbf, .MjjYud, .v7W49e, .ULSxyf, .MUxGbd, .aLF0Z, 
                .yXK7lf, .R0xfCb, .MjjYud, .g, .hlcw0c, .g-blk {
                  width: 100% !important;
                  margin: 0 auto !important;
                  max-width: 100% !important;
                  display: block !important;
                  box-sizing: border-box !important;
                  min-width: auto !important;
                }
                
                /* Fix top search bar with more specificity */
                .RNNXgb, .SDkEP, .a4bIc, .gLFyf, .search-box, .sbib_b, .tsf {
                  width: 100% !important;
                  max-width: 100% !important;
                  min-width: auto !important;
                  box-sizing: border-box !important;
                }
                
                /* Universal fix for width issues */
                * {
                  max-width: 100vw !important;
                  overflow-x: hidden !important;
                  visibility: visible !important;
                }
              \`;
              
              // Add a second style element specifically for visibility fixes
              let visibilityFixStyle = document.getElementById('cognivore-visibility-fixes');
              if (!visibilityFixStyle) {
                visibilityFixStyle = document.createElement('style');
                visibilityFixStyle.id = 'cognivore-visibility-fixes';
                document.head.appendChild(visibilityFixStyle);
                
                // Set the content with focus on visibility
                visibilityFixStyle.textContent = \`
                  * {
                    visibility: visible !important;
                    opacity: 1 !important;
                  }
                  
                  .g, .MjjYud, .yuRUbf, #search, #cnt {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                  }
                \`;
              }
              
              // Apply direct styles to ensure visibility using !important flags
              document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; overflow-x: hidden !important; margin: 0 !important; padding: 0 !important; visibility: visible !important;";
              document.body.style.cssText += "width: 100% !important; height: 100% !important; overflow-x: hidden !important; margin: 0 !important; padding: 0 !important; visibility: visible !important; position: absolute !important; top: 0 !important; left: 0 !important;";
              
              // Apply to critical elements with stronger style enforcement
              const containers = [
                document.getElementById('main'),
                document.getElementById('cnt'), 
                document.getElementById('rcnt'),
                document.getElementById('center_col'),
                document.getElementById('rso'),
                document.querySelector('[role="main"]'),
                document.querySelector('#search'),
                document.querySelector('.minidiv'),
                document.querySelector('.sfbg')
              ];
              
              containers.forEach(el => {
                if (el) {
                  // Use stronger style enforcement with !important
                  el.style.cssText += "width: 100% !important; max-width: 100% !important; margin: 0 auto !important; box-sizing: border-box !important; visibility: visible !important; display: block !important;";
                  
                  // Try a direct approach to modify computed style
                  try {
                    el.setAttribute('style', el.getAttribute('style') + "; width: 100% !important; max-width: 100% !important;");
                  } catch(e) {}
                }
              });
              
              // Fix search results with stronger style application
              const resultContainers = document.querySelectorAll('.g, .MjjYud, .yuRUbf, .v7W49e, .ULSxyf');
              resultContainers.forEach(el => {
                if (el) {
                  el.style.cssText += "width: 100% !important; max-width: 100% !important; margin: 0 auto !important; padding: 8px !important; box-sizing: border-box !important; visibility: visible !important; display: block !important;";
                }
              });
              
              console.log("Applied enhanced Google-specific style fixes from enforceWebviewStyles");
              return true;
            } catch (e) {
              console.error("Error applying Google styles:", e);
              
              // Attempt a minimal critical fix even if the full fix fails
              try {
                document.documentElement.style.visibility = 'visible';
                document.documentElement.style.width = '100%';
                document.body.style.visibility = 'visible';
                document.body.style.width = '100%';
              } catch(e2) {}
              
              return false;
            }
          })()
        `).catch(err => console.warn('Error applying Google styles:', err));
        
        // Set up a delayed style application as a safety measure
        setTimeout(() => {
          if (browser.webview && browser.webview.isConnected) {
            // Ensure webview remains visible
            browser.webview.style.visibility = 'visible';
            browser.webview.style.opacity = '1';
            
            // Try to apply minimal critical styling after delay
            if (typeof browser.webview.executeJavaScript === 'function') {
              try {
                browser.webview.executeJavaScript(`
                  document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; visibility: visible !important;";
                  document.body.style.cssText += "width: 100% !important; height: 100% !important; visibility: visible !important;";
                  
                  // Ensure main containers are visible
                  const mainContainer = document.getElementById('main') || document.getElementById('cnt') || document.querySelector('[role="main"]');
                  if (mainContainer) {
                    mainContainer.style.cssText += "width: 100% !important; visibility: visible !important;";
                  }
                `).catch(() => {});
              } catch (e) {}
            }
          }
        }, 1000);
        
      } catch (err) {
        console.warn('Error executing Google style script:', err);
        
        // Fallback to direct style application if script execution fails
        if (browser.webview) {
          browser.webview.style.visibility = 'visible';
          browser.webview.style.opacity = '1';
          browser.webview.style.display = 'block';
        }
      }
    }
    
    // After a short delay, apply styles again as a safety measure
    setTimeout(() => {
      if (browser.webview && browser.webview.isConnected) {
        browser.webview.style.visibility = 'visible';
        browser.webview.style.opacity = '1';
        
        // Force reflow
        void browser.webview.offsetHeight;
      }
    }, 100);
  } catch (err) {
    console.error('Error enforcing webview styles:', err);
    
    // Final fallback - apply minimum styles directly
    try {
      browser.webview.style.visibility = 'visible';
      browser.webview.style.opacity = '1';
      browser.webview.style.display = 'block';
    } catch (finalErr) {
      console.error('Final fallback style application failed:', finalErr);
    }
  }
}

/**
 * @deprecated Use BrowserLayoutManager for layout concerns and specialized renderers for UI updates
 * Address bar updates should use AddressBarRenderer.updateAddressBar() directly
 */
export function updateAddressBar(browser, url) {
  console.warn('BrowserRenderer.updateAddressBar is deprecated. Use AddressBarRenderer.updateAddressBar() directly.');
  // Delegate to the specialized AddressBarRenderer
  return updateAddressBarRenderer(browser, url);
}

/**
 * @deprecated Use NavigationControlsRenderer.updateLoadingControls() directly
 * Progress bar functionality should be handled by a dedicated progress component
 */
export function updateLoadingIndicator(browser, isLoading) {
  console.warn('BrowserRenderer.updateLoadingIndicator is deprecated. Use NavigationControlsRenderer.updateLoadingControls() and a dedicated progress component.');
  
  // Delegate to the specialized NavigationControlsRenderer for button updates
  updateLoadingControls(browser, isLoading);

  // Minimal progress bar updates for backward compatibility
  const progressBar = browser.progressBar || 
                     browser.container?.querySelector('.browser-progress-bar');
  
  if (progressBar) {
    if (isLoading) {
      progressBar.style.display = 'block';
      progressBar.style.width = '80%';
    } else {
      progressBar.style.width = '100%';
      setTimeout(() => {
        if (progressBar.isConnected) {
          progressBar.style.display = 'none';
          progressBar.style.width = '0%';
        }
      }, 300);
    }
  }
}

/**
 * @deprecated Use a dedicated title management component or handle in Voyager.js directly
 * This function will be removed in a future version
 */
export function updatePageTitle(browser, title) {
  console.warn('BrowserRenderer.updatePageTitle is deprecated. Handle title updates in Voyager.js or a dedicated title component.');
  
  if (!browser) {
    console.error('Cannot update page title - browser instance is missing');
    return;
  }
  
  // Basic title update functionality for backward compatibility
  if (browser.setState && typeof browser.setState === 'function') {
    browser.setState({ title });
  }
  
  // Update document title if needed
  if (browser.props && browser.props.updateDocumentTitle && title) {
    document.title = title;
  }
}

// Export only the core webview management functions that should remain in this file
export default {
  createWebviewElement,
  createWebview,
  enforceWebviewStyles,
}; 