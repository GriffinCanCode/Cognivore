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
import { applySandboxSettings } from '../utils/BrowserEnv.js';
import { createBrowserPlaceholder } from './ContentRenderer.js';
import { updateAddressBar as updateAddressBarRenderer } from './AddressBarRenderer.js';
import { updateLoadingControls } from './NavigationControlsRenderer.js';

/**
 * Create a webview element for browser content
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
      
      // STEP 6: Set initial src to a safe blank page to avoid navigation issues
      webview.setAttribute('src', 'about:blank'); 

      // Set up webview ready flag to track initialization state
      webview.isReady = false;
      
      // Add event listeners for critical events
      webview.addEventListener('did-finish-load', () => {
        console.log('Webview did-finish-load event fired', webview.id);
        webview.isReady = true;
      });
      
      webview.addEventListener('dom-ready', () => {
        console.log('Webview dom-ready event fired', webview.id);
        webview.isReady = true;
        
        // Apply CSP bypass once DOM is ready
        if (typeof webview.executeJavaScript === 'function') {
          try {
            // Use a broad CSP bypass script for maximum compatibility
            webview.executeJavaScript(`
              (function() {
                if (document.head) {
                  // Remove existing CSP meta tags
                  document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach(tag => tag.remove());
                  
                  // Add permissive CSP meta tag
                  const meta = document.createElement('meta');
                  meta.httpEquiv = 'Content-Security-Policy';
                  meta.content = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline'; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';";
                  document.head.appendChild(meta);
                  console.log('Added permissive CSP via meta tag');
                }
              })();
            `).catch(e => console.warn('CSP bypass script error:', e));
          } catch (err) {
            console.warn('Error executing CSP bypass:', err);
          }
        }
      });
      
      // Monitor crash and error events
      webview.addEventListener('crashed', (e) => {
        console.error('Webview crashed:', e);
        browser.handleCrash && browser.handleCrash(e);
      });
      
      webview.addEventListener('gpu-crashed', (e) => {
        console.error('Webview GPU process crashed:', e);
      });
      
      webview.addEventListener('plugin-crashed', (e) => {
        console.error('Webview plugin crashed:', e);
      });
      
      webview.addEventListener('destroyed', () => {
        console.log('Webview was destroyed');
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
 * Set up safe IPC messaging for the webview to prevent object clone errors
 * @param {HTMLElement} webview - The webview element 
 */
function setupSafeIpcMessaging(webview) {
  if (!webview || webview.safeMessagingEnabled) return;
  
  try {
    // Patch the standard send method to prevent non-serializable objects
    if (typeof webview._send === 'undefined' && typeof webview.send === 'function') {
      // Store the original send method
      webview._send = webview.send;
      
      // Replace with our safe version
      webview.send = function(channel, ...args) {
        try {
          // Make safe copies of the args
          const safeChannel = String(channel);
          const safeArgs = args.map(arg => makeSafeForIpc(arg));
          
          // Call the original send with safe arguments
          return webview._send.call(this, safeChannel, ...safeArgs);
        } catch (error) {
          console.warn('Error in safe webview.send:', error);
          // Return a benign result to prevent crashes
          return null;
        }
      };
      
      console.log('Patched webview.send for safe IPC messaging');
    }
    
    // Set up custom event handlers that sanitize all incoming data
    webview.addEventListener('ipc-message', handleSafeIpcMessage);
    webview.addEventListener('console-message', handleSafeConsoleMessage);
    
    // Handle all guest-related events by intercepting and sanitizing
    // This is where GUEST_VIEW_MANAGER_CALL errors commonly occur
    const originalAddEventListener = webview.addEventListener;
    webview.addEventListener = function(event, handler, options) {
      if (event.startsWith('guest-') || 
          event === 'did-attach' || 
          event === 'did-attach-guest-view' || 
          event === 'guest-ready' ||
          event === 'guest-view-ready') {
        
        // Replace with safe handler
        const safeHandler = function(e) {
          try {
            // Create a clean event object with only what we need
            const safeEvent = {
              type: e.type,
              bubbles: e.bubbles,
              cancelable: e.cancelable,
              // Only add simple properties, omit complex objects
              timestamp: Date.now()
            };
            
            // Call original handler with safe event
            return handler(safeEvent);
          } catch (error) {
            console.warn(`Error in safe handler for ${event}:`, error);
          }
        };
        
        // Call original addEventListener with safe handler
        return originalAddEventListener.call(this, event, safeHandler, options);
      }
      
      // For other events, use original behavior
      return originalAddEventListener.call(this, event, handler, options);
    };
    
    webview.safeMessagingEnabled = true;
    console.log('Safe IPC messaging set up for webview');
  } catch (error) {
    console.error('Error setting up safe IPC messaging:', error);
  }
}

/**
 * Handle IPC messages safely
 * @param {Event} event - The IPC message event
 */
function handleSafeIpcMessage(event) {
  try {
    // Ensure we're only passing serializable data
    const safeChannel = event.channel ? String(event.channel) : 'unknown-channel';
    let safeArgs = [];
    
    if (Array.isArray(event.args)) {
      // Sanitize arguments to ensure they're safe to serialize
      safeArgs = event.args.map(arg => makeSafeForIpc(arg));
    }
    
    // Log clean version
    console.log(`Received IPC message: ${safeChannel}`, safeArgs);
  } catch (err) {
    console.warn('Error handling ipc-message event:', err);
  }
}

/**
 * Handle console messages safely
 * @param {Event} event - The console message event
 */
function handleSafeConsoleMessage(event) {
  try {
    // Create a safe copy of the event data
    const safeEvent = {
      message: event.message ? String(event.message) : '',
      line: typeof event.line === 'number' ? event.line : 0,
      sourceId: event.sourceId ? String(event.sourceId) : ''
    };
    
    if (safeEvent.message.includes('error') || safeEvent.message.includes('Exception')) {
      console.warn('[Webview Console Error]:', safeEvent.message);
    }
  } catch (err) {
    console.warn('Error handling console-message event:', err);
  }
}

/**
 * Make an object safe for IPC by removing non-serializable content
 * @param {*} obj - Object to make safe
 * @returns {*} - Serialization-safe version of the object
 */
function makeSafeForIpc(obj) {
  if (obj === null || obj === undefined) return obj;
  
  // Handle simple types directly
  if (typeof obj === 'string' || 
      typeof obj === 'number' || 
      typeof obj === 'boolean') {
    return obj;
  }
  
  // Dates become ISO strings
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // For arrays, recursively process each element
  if (Array.isArray(obj)) {
    return obj.map(item => makeSafeForIpc(item));
  }
  
  // For objects, use JSON to strip non-serializable content
  if (typeof obj === 'object') {
    try {
      // Try JSON serialization/deserialization to strip non-serializable content
      return JSON.parse(JSON.stringify(obj));
    } catch(e) {
      // If it fails, return a simplified representation
      return String(obj);
    }
  }
  
  // Default fallback - convert to string
  return String(obj);
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
  
  // Apply simple, effective styling to webview
  webview.style.cssText = `
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
  
  // Force attachment to DOM
  try {
    container.appendChild(webview);
    
    // Set up safe IPC messaging
    setupSafeIpcMessaging(webview);
    
    // Store webview reference on browser
    browser.webview = webview;
    browser.webviewContainer = container;
    
    console.log('Webview attached to container successfully');
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
  } catch (err) {
    console.error('Error enforcing webview styles:', err);
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
  // Deprecated functions - kept for backward compatibility but will be removed
  createProgressBar,
  showLoadingContent, 
  hideLoadingContent,
  updateAddressBar,
  updateLoadingIndicator,
  updatePageTitle
}; 