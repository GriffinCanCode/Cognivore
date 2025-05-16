/**
 * BrowserRenderer - Handles rendering of the browser UI
 */
import { applySandboxSettings } from '../utils/BrowserEnv.js';
import { createBrowserPlaceholder } from './ContentRenderer.js';
import EventHandlers from '../handlers/EventHandlers.js';

/**
 * Create the browser header with navigation controls
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Header element
 */
export function createBrowserHeader(browser) {
  // Create container for all header elements
  const headerContainer = document.createElement('div');
  headerContainer.className = 'browser-header-container';
  
  // Create address bar container (now at the top)
  const addressContainer = document.createElement('div');
  addressContainer.className = 'voyager-address-container';
  addressContainer.style.cssText = `
    display: flex !important;
    align-items: center !important;
    padding: 8px 16px !important;
    background-color: var(--card-bg, #252525) !important;
    border-bottom: 1px solid var(--border-color, #333) !important;
    height: 52px !important;
    min-height: 52px !important;
    max-height: 52px !important;
    z-index: 3 !important;
    box-sizing: border-box !important;
    width: 100% !important;
  `;
  
  // Create address form
  const addressForm = document.createElement('form');
  addressForm.className = 'browser-search-form';
  addressForm.style.flex = '1';
  addressForm.style.display = 'flex';
  
  // Handle form submission with proper browser context
  addressForm.addEventListener('submit', (event) => {
    if (typeof browser.handleAddressSubmit === 'function') {
      browser.handleAddressSubmit(event);
    } else {
      event.preventDefault();
      console.warn('handleAddressSubmit not available on browser object');
    }
  });
  
  // Create address input
  const addressInput = document.createElement('input');
  addressInput.type = 'text';
  addressInput.className = 'voyager-address-bar';
  addressInput.placeholder = 'Search or enter website name';
  addressInput.spellcheck = false;
  addressInput.autocomplete = 'off';
  addressInput.style.cssText = `
    flex: 1 !important;
    height: 36px !important;
    padding: 0 12px !important;
    border-radius: 20px !important;
    border: 1px solid var(--border-color, #333) !important;
    background-color: var(--input-bg, #2a2a2a) !important;
    color: var(--text-color, #e0e0e0) !important;
    font-size: 14px !important;
    outline: none !important;
    width: 100% !important;
  `;
  
  // Handle input changes
  addressInput.addEventListener('change', (event) => {
    if (typeof browser.handleAddressChange === 'function') {
      browser.handleAddressChange(event);
    } else {
      console.warn('handleAddressChange not available on browser object');
    }
  });
  
  // Store reference to address input on browser object
  browser.addressInput = addressInput;
  browser.searchInput = addressInput; // For backward compatibility
  
  // Add input to form
  addressForm.appendChild(addressInput);
  
  // Add form to container
  addressContainer.appendChild(addressForm);
  
  // Add address container to header container
  headerContainer.appendChild(addressContainer);
  
  // Create traditional header with navigation controls
  const header = document.createElement('div');
  header.className = 'browser-header';
  
  // Navigation controls
  const navControls = document.createElement('div');
  navControls.className = 'browser-nav-controls';
  
  const backButton = document.createElement('button');
  backButton.className = 'browser-back-btn';
  backButton.title = 'Back';
  backButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  `;
  backButton.disabled = true;
  backButton.addEventListener('click', browser.handleBack);
  navControls.appendChild(backButton);
  
  const forwardButton = document.createElement('button');
  forwardButton.className = 'browser-forward-btn';
  forwardButton.title = 'Forward';
  forwardButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `;
  forwardButton.disabled = true;
  forwardButton.addEventListener('click', browser.handleForward);
  navControls.appendChild(forwardButton);
  
  const refreshButton = document.createElement('button');
  refreshButton.className = 'browser-refresh-btn';
  refreshButton.title = 'Refresh';
  refreshButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
  `;
  refreshButton.addEventListener('click', browser.handleRefresh);
  navControls.appendChild(refreshButton);
  
  const stopButton = document.createElement('button');
  stopButton.className = 'browser-stop-btn';
  stopButton.title = 'Stop';
  stopButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="6" width="12" height="12"></rect>
    </svg>
  `;
  stopButton.style.display = 'none';
  stopButton.addEventListener('click', browser.handleStop);
  navControls.appendChild(stopButton);
  
  header.appendChild(navControls);
  
  // Action buttons
  const actionButtons = document.createElement('div');
  actionButtons.className = 'browser-action-buttons';
  
  const bookmarkButton = document.createElement('button');
  bookmarkButton.className = 'browser-bookmark-btn';
  bookmarkButton.title = 'Bookmark this page';
  bookmarkButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  bookmarkButton.addEventListener('click', () => browser.addBookmark());
  actionButtons.appendChild(bookmarkButton);
  
  const saveButton = document.createElement('button');
  saveButton.className = 'browser-save-btn';
  saveButton.title = 'Save page to knowledge base';
  saveButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
  `;
  saveButton.addEventListener('click', () => browser.savePage());
  actionButtons.appendChild(saveButton);
  
  const researchButton = document.createElement('button');
  researchButton.className = 'browser-research-btn';
  researchButton.title = 'Toggle research mode';
  researchButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
  `;
  researchButton.addEventListener('click', browser.toggleResearchMode);
  actionButtons.appendChild(researchButton);
  
  header.appendChild(actionButtons);
  
  // Add header to container
  headerContainer.appendChild(header);
  
  return headerContainer;
}

/**
 * Create the research panel
 * @returns {HTMLElement} Research panel element
 */
export function createResearchPanel() {
  const researchPanel = document.createElement('div');
  researchPanel.className = 'browser-research-panel';
  researchPanel.style.display = 'none';
  
  const researchHeader = document.createElement('div');
  researchHeader.className = 'research-panel-header';
  researchHeader.innerHTML = `
    <h3>Research</h3>
    <div class="research-panel-controls">
      <button class="research-panel-clear">Clear</button>
      <button class="research-panel-close">×</button>
    </div>
  `;
  
  researchHeader.querySelector('.research-panel-close').addEventListener('click', () => {
    researchPanel.style.display = 'none';
  });
  
  researchHeader.querySelector('.research-panel-clear').addEventListener('click', () => {
    const content = researchPanel.querySelector('.research-panel-content');
    if (content) {
      content.innerHTML = `
        <div class="research-empty-state">
          <p>No research data available yet.</p>
          <p>Enable research mode to automatically save pages as you browse.</p>
        </div>
      `;
    }
  });
  
  researchPanel.appendChild(researchHeader);
  
  const researchContent = document.createElement('div');
  researchContent.className = 'research-panel-content';
  researchContent.innerHTML = `
    <div class="research-empty-state">
      <p>No research data available yet.</p>
      <p>Enable research mode to automatically save pages as you browse.</p>
    </div>
  `;
  
  researchPanel.appendChild(researchContent);
  
  return researchPanel;
}

/**
 * Create a webview element for browser content
 * @param {Object} browser - Browser instance
 * @param {string} implementation - Implementation type ('webview' or 'iframe')
 * @param {string} sandboxLevel - Sandbox level for the webview
 * @returns {HTMLElement} Created webview or iframe
 */
export function createWebviewElement(browser, implementation = 'webview', sandboxLevel = 'full') {
  console.log('Creating webview element for browser with enhanced scrolling settings');
  
  const partition = `persist:voyager-${Date.now()}`; // Create unique partition name
  
  if (implementation === 'webview') {
    try {
      const webview = document.createElement('webview');
      
      // Set class name for styling
      webview.className = 'browser-webview';
      
      // Set a unique ID for easier DOM lookup
      webview.id = `webview-${browser.browserId || Math.floor(Math.random() * 100000)}`;
      
      // Set critical attributes
      webview.setAttribute('partition', partition); // Set partition BEFORE navigation
      webview.setAttribute('allowpopups', 'true');
      webview.setAttribute('disablewebsecurity', 'true');
      webview.setAttribute('allowfullscreen', 'true');
      webview.setAttribute('autosize', 'true');
      webview.setAttribute('nodeintegration', 'no');
      webview.setAttribute('plugins', 'true');
      webview.setAttribute('disabledevtools', 'true');
      webview.setAttribute('webpreferences', 'contextIsolation=yes, sandbox=yes, devTools=no');
      
      // Set comprehensive sandbox permissions to allow most operations while maintaining security
      webview.setAttribute('sandbox', 'allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-top-navigation');
      
      console.log('Initial webview element created: WEBVIEW');
      
      // Add utility methods to the webview for functionality that needs to be accessed from multiple places
      webview.applyAllCriticalStyles = (forcedApply = false) => {
        // Apply styles directly to avoid recursive call to enforceWebviewStyles
        try {
          if (!webview.isConnected) return;
          
          // Apply comprehensive styling directly
          webview.style.cssText = `
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 1 !important;
            position: fixed !important;
            top: 52px !important;
            left: var(--sidebar-width, 260px) !important;
            right: 0 !important;
            bottom: 0 !important;
            width: calc(100vw - var(--sidebar-width, 260px)) !important;
            height: calc(100vh - 52px) !important;
            min-height: calc(100vh - 52px) !important;
            max-height: calc(100vh - 52px) !important;
            min-width: calc(100vw - var(--sidebar-width, 260px)) !important;
            max-width: calc(100vw - var(--sidebar-width, 260px)) !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            background-color: white !important;
            transform: none !important;
            overflow: hidden !important;
            flex: 1 1 auto !important;
          `;
          
          // Mark as ready to show
          webview.readyToShow = true;
        } catch (err) {
          console.error('Error applying critical styles:', err);
        }
      };
      
      // Add a flag to track whether the webview is ready to show content
      webview.readyToShow = false;
      
      // Setup a preload script for header manipulation if needed
      setupHeaderBypass(webview);
      
      return webview;
    } catch (err) {
      console.error('Error creating webview element:', err);
      return createFallbackIframeElement(browser);
    }
  } else {
    return createFallbackIframeElement(browser);
  }
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
      webview.isConnected === true) &&
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
  console.log('📣 Creating webview container with proper sizing');
  
  // Force webview for reliability
  implementation = 'webview';
  
  // Verify browser container exists in DOM
  if (!browser.containerRef || !browser.containerRef.current || !browser.containerRef.current.isConnected) {
    console.error('Browser container not connected to DOM, cannot create webview');
    return { container: null, webview: null };
  }
  
  const container = document.createElement('div');
  container.className = 'browser-webview-container';
  
  // Apply styling to fit container while preserving layout
  container.style.cssText = `
    position: fixed !important;
    top: 52px !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: calc(100vh - 52px) !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    z-index: 1 !important;
    box-sizing: border-box !important;
    border: none !important;
    display: flex !important;
    flex-direction: column !important;
    background: #fff !important;
  `;
  
  // Use our enhanced webview creation function
  let webview = createWebviewElement(browser);
  
  // Verify webview was created correctly
  if (!webview) {
    console.error('Failed to create webview element');
    return { container, webview: null };
  }
  
  // Apply styling to webview for proper containment
  webview.style.cssText = `
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 1 !important;
    position: fixed !important;
    top: 52px !important;
    left: var(--sidebar-width, 260px) !important;
    right: 0 !important;
    bottom: 0 !important;
    width: calc(100vw - var(--sidebar-width, 260px)) !important;
    height: calc(100vh - 52px) !important;
    min-height: calc(100vh - 52px) !important;
    max-height: calc(100vh - 52px) !important;
    min-width: calc(100vw - var(--sidebar-width, 260px)) !important;
    max-width: calc(100vw - var(--sidebar-width, 260px)) !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    background-color: white !important;
    transform: none !important;
    flex: 1 1 auto !important;
  `;
  
  // Force attachment to DOM
  try {
    // Add to browser container
    container.appendChild(webview);
    
    // Ensure element gets attached by forcing a reflow
    void container.offsetHeight;
    void webview.offsetHeight;
    
    console.log('Webview attached to DOM container');
  } catch (err) {
    console.error('Error attaching webview to container:', err);
  }
  
  // Create placeholder for browser limitations message
  const placeholder = createBrowserPlaceholder(browser);
  container.appendChild(placeholder);
  
  // Hide placeholder upfront
  placeholder.style.display = 'none';
  
  // Set reference on browser objects
  browser.webview = webview;
  
  // For iframe implementation, we'll keep a separate reference to the "contentFrame"
  if (webview.tagName.toLowerCase() !== 'webview') {
    browser.contentFrame = webview;
    
    // For iframe, use same flex display pattern
    browser.contentFrame.style.display = 'flex';
  }
  
  return { container, webview };
}

/**
 * Create progress bar
 * @returns {HTMLElement} Progress bar element
 */
export function createProgressBar() {
  // Create container for progress bar
  const progressContainer = document.createElement('div');
  progressContainer.className = 'browser-progress-container';
  progressContainer.style.position = 'relative';
  progressContainer.style.top = '0';
  progressContainer.style.left = '0';
  progressContainer.style.right = '0';
  progressContainer.style.height = '3px';
  progressContainer.style.zIndex = '1000';
  progressContainer.style.overflow = 'hidden';
  progressContainer.style.backgroundColor = 'transparent';
  
  // Create actual progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'browser-progress-bar';
  progressBar.style.backgroundColor = '#4285f4'; // Google blue
  progressBar.style.height = '100%';
  progressBar.style.width = '0%';
  progressBar.style.transition = 'width 0.3s ease-in-out, opacity 0.3s ease-in-out';
  progressBar.style.position = 'absolute';
  progressBar.style.left = '0';
  progressBar.style.top = '0';
  progressBar.style.boxShadow = '0 0 10px rgba(66, 133, 244, 0.7)';
  progressBar.style.display = 'none';
  progressBar.style.borderRadius = '0 2px 2px 0'; // Rounded right edge for smoother appearance
  
  // Add subtle animation for indeterminate state
  const keyframes = document.createElement('style');
  keyframes.textContent = `
    @keyframes progress-pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }
  `;
  document.head.appendChild(keyframes);
  
  // Apply animation to progress bar
  progressBar.style.animation = 'progress-pulse 1.5s infinite ease-in-out';
  
  progressContainer.appendChild(progressBar);
  
  return progressContainer;
}

/**
 * Show loading content in the browser
 * @param {Object} browser - Browser instance
 * @param {string} url - The URL being loaded
 */
export function showLoadingContent(browser, url) {
  // Check if loading content already exists
  let loadingContent = document.querySelector('.browser-loading-content');
  
  // Create if it doesn't exist
  if (!loadingContent) {
    loadingContent = document.createElement('div');
    loadingContent.className = 'browser-loading-content';
    loadingContent.style.cssText = `
      position: fixed !important;
      top: 52px !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      background-color: var(--bg-color, #1a1a1a) !important;
      z-index: 1000 !important;
      width: 100vw !important;
      height: calc(100vh - 52px) !important;
      transition: opacity 0.3s ease !important;
      margin: 0 !important;
      padding: 0 !important;
      min-height: calc(100vh - 52px) !important;
      transform: none !important;
    `;
    
    // Add spinner
    const spinner = document.createElement('div');
    spinner.className = 'browser-loading-spinner';
    spinner.style.cssText = `
      width: 48px !important;
      height: 48px !important;
      border: 4px solid rgba(76, 110, 245, 0.1) !important;
      border-top-color: #4c6ef5 !important;
      border-radius: 50% !important;
      animation: spin 1s linear infinite !important;
      margin-bottom: 24px !important;
    `;
    loadingContent.appendChild(spinner);
    
    // Add loading message
    const message = document.createElement('h3');
    message.textContent = 'Loading...';
    message.style.cssText = `
      font-size: 24px !important;
      margin-bottom: 16px !important;
      color: #e0e0e0 !important;
      font-weight: 600 !important;
    `;
    loadingContent.appendChild(message);
    
    // Add URL info
    const urlInfo = document.createElement('p');
    urlInfo.className = 'browser-loading-url';
    urlInfo.style.cssText = `
      padding: 8px 16px !important;
      background-color: rgba(76, 110, 245, 0.1) !important;
      border-radius: 4px !important;
      font-family: monospace !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      max-width: 80% !important;
      color: #aaaaaa !important;
      margin-bottom: 24px !important;
    `;
    loadingContent.appendChild(urlInfo);
    
    // Append directly to body for maximum visibility
    document.body.appendChild(loadingContent);
  }
  
  // Keep webview hidden until fully ready
  if (browser.webview) {
    // Apply critical styling but keep it hidden
    browser.webview.style.cssText = `
      display: flex !important;
      visibility: hidden !important;
      opacity: 0 !important;
      z-index: 0 !important;
      position: fixed !important;
      top: 52px !important;
      left: var(--sidebar-width, 260px) !important;
      right: 0 !important;
      bottom: 0 !important;
      width: calc(100vw - var(--sidebar-width, 260px)) !important;
      height: calc(100vh - 52px) !important;
      min-height: calc(100vh - 52px) !important;
      max-height: calc(100vh - 52px) !important;
      min-width: calc(100vw - var(--sidebar-width, 260px)) !important;
      max-width: calc(100vw - var(--sidebar-width, 260px)) !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      background-color: white !important;
      flex: 1 1 auto !important;
      transform: none !important;
    `;
    
    // Reset readyToShow flag if it exists
    if (typeof browser.webview.readyToShow !== 'undefined') {
      browser.webview.readyToShow = false;
    }
  }
  
  // Update URL info
  const urlInfo = loadingContent.querySelector('.browser-loading-url');
  if (urlInfo) {
    urlInfo.textContent = url;
  }
  
  // Ensure loading content is visible
  loadingContent.style.display = 'flex';
  loadingContent.style.opacity = '1';
}

/**
 * Hide loading content
 * @param {Object} browser - Browser instance
 */
export function hideLoadingContent(browser) {
  const loadingContent = document.querySelector('.browser-loading-content');
  if (!loadingContent) return;
  
  // Check if webview is ready to show before hiding loading screen
  if (browser.webview) {
    // Apply immediate crucial styling first
    if (typeof browser.webview.applyAllCriticalStyles === 'function') {
      browser.webview.applyAllCriticalStyles(true);
    } else {
      enforceWebviewStyles(browser, true);
    }
    
    // Only hide loading content when webview is ready to show
    if (typeof browser.webview.readyToShow === 'undefined' || browser.webview.readyToShow === true) {
      // Webview is ready, proceed with hiding loading content immediately
      _hideLoadingContent(loadingContent, browser);
    } else {
      // Webview not ready yet, wait for readyToShow flag to become true
      console.log('Webview not yet ready to show, waiting before hiding loading screen');
      
      // Set a maximum timeout of 1 second (reduced from 1.5)
      const maxWaitTime = 1000;
      const startTime = Date.now();
      
      // Check more frequently (10ms instead of 25ms)
      const readyCheckInterval = setInterval(() => {
        // Force visibility if taking too long
        if (Date.now() - startTime > maxWaitTime) {
          clearInterval(readyCheckInterval);
          console.log('Forcing loading content hide after timeout');
          _hideLoadingContent(loadingContent, browser);
          
          // Force webview visibility
          if (browser.webview) {
            browser.webview.style.visibility = 'visible';
            browser.webview.style.opacity = '1';
            browser.webview.readyToShow = true;
            
            // Apply all styling immediately
            if (typeof browser.webview.applyAllCriticalStyles === 'function') {
              browser.webview.applyAllCriticalStyles(true);
            } else {
              enforceWebviewStyles(browser, true);
            }
          }
          return;
        }
        
        if (browser.webview.readyToShow === true) {
          // Webview is now ready
          clearInterval(readyCheckInterval);
          _hideLoadingContent(loadingContent, browser);
        }
      }, 10); // Check every 10ms for faster response
    }
  } else {
    // No webview, just hide loading content
    _hideLoadingContent(loadingContent, browser);
  }
}

/**
 * Internal method to actually hide the loading content
 * @private
 * @param {HTMLElement} loadingContent - The loading content element to hide
 * @param {Object} browser - Browser instance
 */
function _hideLoadingContent(loadingContent, browser) {
  // Hide loading content immediately
  loadingContent.style.opacity = '0';
  loadingContent.style.display = 'none';
  
  // Ensure webview is immediately visible with proper styling
  if (browser.webview) {
    // Now show the webview with all styles applied
    browser.webview.style.cssText = `
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 1 !important;
      position: fixed !important;
      top: 52px !important;
      left: var(--sidebar-width, 260px) !important;
      right: 0 !important;
      bottom: 0 !important;
      width: calc(100vw - var(--sidebar-width, 260px)) !important;
      height: calc(100vh - 52px) !important;
      min-height: calc(100vh - 52px) !important;
      max-height: calc(100vh - 52px) !important;
      min-width: calc(100vw - var(--sidebar-width, 260px)) !important;
      max-width: calc(100vw - var(--sidebar-width, 260px)) !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      background-color: white !important;
      flex: 1 1 auto !important;
      transform: none !important;
      overflow: hidden !important;
    `;
    
    // Immediately apply content styles if possible
    if (browser.webview.tagName.toLowerCase() === 'webview' && typeof browser.webview.executeJavaScript === 'function') {
      try {
        browser.webview.executeJavaScript(`
          // Apply comprehensive styles
          document.documentElement.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
          document.body.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
          
          // Force fix in case default styles haven't been applied yet
          const style = document.createElement('style');
          style.textContent = "html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; }";
          document.head.appendChild(style);
          
          true;
        `).catch(() => {});
      } catch (e) {
        console.warn('Error applying final content styles:', e);
      }
    }
  }
  
  // Remove loading content immediately
  try {
    // Try to remove from DOM completely 
    if (loadingContent && loadingContent.parentNode) {
      loadingContent.parentNode.removeChild(loadingContent);
    }
  } catch (err) {
    console.warn('Error removing loading content:', err);
  }
}

/**
 * Enforce proper webview styling
 * This should be called periodically to ensure proper display
 * @param {Object} browser - Browser instance
 * @param {boolean} [forcedApply=false] - If true, ignores the throttle check for immediate application
 */
export function enforceWebviewStyles(browser, forcedApply = false) {
  // Prevent redundant style applications by adding a rate limiter
  const now = Date.now();
  
  // Skip if we've just applied styles recently and not forcing
  if (!forcedApply) {
    // Cache last application time if not already set
    if (!browser._styleApplicationTimes) {
      browser._styleApplicationTimes = {
        lastApplicationTime: 0,
        styleApplicationCount: 0,
        lastLogTime: 0
      };
    }
    
    const timeElapsed = now - browser._styleApplicationTimes.lastApplicationTime;
    
    // Rate limit to max once per 300ms (up from 100ms) unless forced
    if (timeElapsed < 300) {
      // Count skipped applications but don't log every skip to reduce console noise
      browser._styleApplicationTimes.styleApplicationCount++;
      
      // Only log the skip at most once per second to reduce console noise
      const timeSinceLastLog = now - browser._styleApplicationTimes.lastLogTime;
      if (timeSinceLastLog > 1000) {
        console.log(`Skipped ${browser._styleApplicationTimes.styleApplicationCount} redundant style applications in the last ${timeSinceLastLog}ms`);
        browser._styleApplicationTimes.lastLogTime = now;
        browser._styleApplicationTimes.styleApplicationCount = 0;
      }
      
      return;
    }
  }
  
  // Update last application time
  if (browser._styleApplicationTimes) {
    browser._styleApplicationTimes.lastApplicationTime = now;
  } else {
    browser._styleApplicationTimes = {
      lastApplicationTime: now,
      styleApplicationCount: 0,
      lastLogTime: now
    };
  }
  
  // Only log style application if forced or not applied recently
  if (forcedApply || !browser._lastStyleEnforcement || (now - browser._lastStyleEnforcement >= 2000)) {
    console.log('Applying all critical webview styles at once');
  }
  
  // Don't apply if initial styles are applied properly and we're not forcing
  if (!forcedApply && browser._initialStylesAppliedTime && 
      (now - browser._initialStylesAppliedTime < 2000) && 
      browser.webview && browser.webview.readyToShow) {
    return;
  }
  
  browser._lastStyleEnforcement = now;
  
  try {
    if (!browser.webview || !browser.webview.isConnected || browser._isUnloading) {
      return;
    }
    
    // Apply direct styling fixes to the webview element
    if (browser.webview.tagName.toLowerCase() === 'webview') {
      const container = browser.webview.parentElement;
      
      // Only clear existing styles if forcing or if dimensions are wrong
      if (forcedApply) {
        // Clear any existing style attributes first
        browser.webview.removeAttribute('style');
      }
      
      // Apply comprehensive styling
      browser.webview.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 1 !important;
        position: fixed !important;
        top: 52px !important;
        left: var(--sidebar-width, 260px) !important;
        right: 0 !important;
        bottom: 0 !important;
        width: calc(100vw - var(--sidebar-width, 260px)) !important;
        height: calc(100vh - 52px) !important;
        min-height: calc(100vh - 52px) !important;
        max-height: calc(100vh - 52px) !important;
        min-width: calc(100vw - var(--sidebar-width, 260px)) !important;
        max-width: calc(100vw - var(--sidebar-width, 260px)) !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        background-color: white !important;
        transform: none !important;
        overflow: hidden !important;
        flex: 1 1 auto !important;
      `;
      
      // Use CSS class as well for extra reliability
      browser.webview.classList.add('browser-webview');
      
      // Force layout recalculation to ensure styles are applied
      void browser.webview.offsetHeight;
      
      if (container) {
        // Ensure container has proper styling
        container.style.cssText = `
          position: fixed !important;
          top: 52px !important;
          left: var(--sidebar-width, 260px) !important;
          right: 0 !important;
          bottom: 0 !important;
          width: calc(100vw - var(--sidebar-width, 260px)) !important;
          height: calc(100vh - 52px) !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          z-index: 1 !important;
          background-color: white !important;
        `;
        
        // Force layout recalculation for container
        void container.offsetHeight;
      }
    } else if (browser.webview.tagName.toLowerCase() === 'iframe') {
      // Handle iframe styling
      browser.webview.style.cssText = `
        width: 100% !important;
        height: 100% !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      `;
    }
    
    // Ensure webview is marked as ready to show
    browser.webview.readyToShow = true;
    
    // Do not call applyAllCriticalStyles to avoid infinite recursion
    // This would cause a call cycle since applyAllCriticalStyles calls enforceWebviewStyles
    // and we're already in enforceWebviewStyles
  } catch (err) {
    console.error('Error enforcing webview styles:', err);
  }
}

/**
 * Set up header bypass for a webview to remove X-Frame-Options and other restricting headers
 * @param {HTMLElement} webview - The webview element
 */
function setupHeaderBypass(webview) {
  if (!webview) return;
  
  try {
    // Use preload script approach as primary method
    console.log('📋 Setting up X-Frame-Options bypass with preload script');
    
    // Create a preload script path (we'll inject it directly instead)
    // This script will run in the context of the webview and remove restrictive headers
    const bypassScript = `
      // Bypass X-Frame-Options and CSP using DOM methods
      (function() {
        // Prevent duplicate execution with a global flag
        if (window._headerBypassApplied) {
          return;
        }
        
        // Mark as applied immediately to prevent duplicate execution
        window._headerBypassApplied = true;
        
        const applyBypassRestrictions = function() {
          try {
            // Remove CSP meta tags
            const cspTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"], meta[http-equiv="content-security-policy"]');
            cspTags.forEach(tag => tag.remove());
            
            // Add permissive CSP
            const meta = document.createElement('meta');
            meta.httpEquiv = 'Content-Security-Policy';
            meta.content = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;";
            document.head.appendChild(meta);
            
            // Prevent frame busting scripts
            if (window.top !== window.self) {
              try {
                // Override frame busting properties
                Object.defineProperty(window, 'top', { value: window.self, configurable: true });
                Object.defineProperty(window, 'parent', { value: window.self, configurable: true });
                Object.defineProperty(window, 'frameElement', { value: null, configurable: true });
              } catch(e) {}
            }
            
            console.log('Applied header bypass via preload script');
          } catch(e) {
            console.warn('Error in header bypass:', e);
          }
        };
        
        // Execute when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', applyBypassRestrictions);
        } else {
          applyBypassRestrictions();
        }
        
        // Also hook into any future document writes
        const originalWrite = document.write;
        document.write = function(...args) {
          const result = originalWrite.apply(this, args);
          applyBypassRestrictions();
          return result;
        };
      })();
    `;
    
    // Try multiple bypass methods for redundancy
    
    // No longer attempting to use preload attribute with blob URL as Electron only supports file: protocol
    // We'll rely on the executeJavaScript methods instead which are more reliable
    try {
      // Store the script directly on the webview for later execution
      webview.bypassScript = bypassScript;
      
      // Note: We intentionally don't set the preload attribute here to avoid the warning:
      // "Only 'file:' protocol is supported in 'preload' attribute"
    } catch (err) {
      console.warn('Could not store bypass script on webview:', err);
    }
    
    // Method 2: Apply directly via executeJavaScript when navigation starts
    webview.addEventListener('did-start-loading', () => {
      if (typeof webview.executeJavaScript === 'function') {
        try {
          // Use a simple check first to see if webview is ready for script execution
          webview.executeJavaScript('true')
            .then(() => {
              // If successful, execute the actual bypass script
              webview.executeJavaScript(webview.bypassScript || bypassScript)
                .catch(err => {
                  // Log but don't throw to prevent stopping the chain
                  console.warn('ExecuteJavaScript bypass error:', err);
                });
            })
            .catch(() => {
              // If not ready yet, we'll retry during dom-ready event
              console.log('Webview not ready for script execution, will retry on dom-ready');
            });
        } catch (err) {
          console.warn('Error executing bypass script on load start:', err);
        }
      }
    });
    
    // Method 3: Apply when DOM is ready (most reliable point)
    webview.addEventListener('dom-ready', () => {
      if (typeof webview.executeJavaScript === 'function') {
        try {
          // Short delay to ensure webview is fully ready
          setTimeout(() => {
            webview.executeJavaScript(webview.bypassScript || bypassScript)
              .catch(err => {
                console.warn('DOM ready bypass error:', err);
                
                // If we still get an error, try one more time with a longer delay
                setTimeout(() => {
                  try {
                    webview.executeJavaScript(webview.bypassScript || bypassScript)
                      .catch(finalErr => console.warn('Final bypass attempt failed:', finalErr));
                  } catch (finalAttemptErr) {
                    console.warn('Error in final bypass script execution:', finalAttemptErr);
                  }
                }, 500);
              });
          }, 50);
        } catch (err) {
          console.warn('Error setting up bypass script execution:', err);
        }
      }
    });
    
    // Method 4: Fallback - try using direct electron session when available
    // This will be executed only if the environment supports it
    setTimeout(() => {
      try {
        if (webview.getWebContents && typeof webview.getWebContents === 'function') {
          const webContents = webview.getWebContents();
          if (webContents && webContents.session && webContents.session.webRequest) {
            console.log('Using native webRequest API for header bypass');
            
            const { session } = webContents;
            session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
              if (!details.responseHeaders) return callback({ cancel: false });
              
              // Create a clean copy of headers to avoid reference issues
              const responseHeaders = { ...details.responseHeaders };
              
              // Remove restrictive headers
              ['x-frame-options', 'content-security-policy', 'frame-options'].forEach(header => {
                delete responseHeaders[header];
                delete responseHeaders[header.toUpperCase()];
              });
              
              callback({ responseHeaders, cancel: false });
            });
          }
        }
      } catch (err) {
        console.warn('Failed to set up native webRequest header bypass:', err);
      }
    }, 200);
    
    console.log('✅ Header bypass setup with multiple fallback methods');
  } catch (err) {
    console.warn('Error setting up header bypass:', err);
    useAlternativeHeaderBypass(webview);
  }
}

/**
 * Attempt to bypass headers with direct DOM manipulation
 * @param {HTMLElement} webview - The webview element to bypass headers on
 */
function attemptAlternativeHeadersBypass(webview) {
  if (!webview || typeof webview.executeJavaScript !== 'function') {
    console.warn('Cannot execute alternative headers bypass - no executeJavaScript method');
    return;
  }
  
  // Throttle execution to prevent excessive calls
  // Use a timestamp stored on the webview to track last execution
  const now = Date.now();
  if (webview._lastBypassAttempt && (now - webview._lastBypassAttempt < 1000)) {
    // Skip if called within the last second
    return;
  }
  
  // Update timestamp
  webview._lastBypassAttempt = now;
  
  try {
    // Execute JavaScript to bypass Content-Security-Policy
    const bypassScript = `
      (function() {
        // Prevent duplicate execution with a global flag
        if (window._headerBypassApplied) {
          return true;
        }
        
        window._headerBypassApplied = true;
        
        // Function to remove CSP restrictions
        const removeCSP = function() {
          try {
            // Remove existing CSP meta tags
            const cspMetaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"], meta[http-equiv="content-security-policy"]');
            if (cspMetaTags && cspMetaTags.length > 0) {
              for (let i = 0; i < cspMetaTags.length; i++) {
                if (cspMetaTags[i] && cspMetaTags[i].parentNode) {
                  cspMetaTags[i].parentNode.removeChild(cspMetaTags[i]);
                }
              }
            }
            
            // Create meta tag to override CSP with permissive policy
            if (document.head) {
              const meta = document.createElement('meta');
              meta.setAttribute('http-equiv', 'Content-Security-Policy');
              meta.setAttribute('content', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
              document.head.appendChild(meta);
            }
            
            // Override frame busting scripts by redefining properties
            if (window.self !== window.top) {
              try {
                // Use proper Object.defineProperty for better protection
                Object.defineProperty(window, 'top', { value: window.self, configurable: true });
                Object.defineProperty(window, 'parent', { value: window.self, configurable: true });
                Object.defineProperty(window, 'frameElement', { value: null, configurable: true });
              } catch(e) {
                console.warn('Frame busting prevention failed:', e);
              }
            }
            
            // Log only once
            if (!window._headerBypassLogged) {
              console.log('Applied CSP and header bypass via content script');
              window._headerBypassLogged = true;
            }
          } catch(e) {
            console.error('Error in CSP removal:', e);
          }
          
          return true;
        };
        
        // Execute immediately
        removeCSP();
        
        // Set up a throttled mutation observer if it doesn't exist
        if (!window._bypassObserver) {
          let pendingMutations = false;
          let throttleTimer = null;
          
          const handleMutations = function() {
            if (pendingMutations) {
              removeCSP();
              pendingMutations = false;
            }
          };
          
          try {
            const observer = new MutationObserver(function(mutations) {
              // Check if any CSP elements were added (throttled)
              const hasCSPElements = mutations.some(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                  return Array.from(mutation.addedNodes).some(function(node) {
                    return node.nodeName === 'META' && 
                          (node.getAttribute('http-equiv') === 'Content-Security-Policy' ||
                           node.getAttribute('http-equiv') === 'content-security-policy');
                  });
                }
                return false;
              });
              
              if (hasCSPElements) {
                pendingMutations = true;
                
                // Throttle to prevent excessive executions
                if (!throttleTimer) {
                  throttleTimer = setTimeout(function() {
                    handleMutations();
                    throttleTimer = null;
                  }, 500);
                }
              }
            });
            
            // Start observing the document with throttling
            if (document && document.documentElement) {
              observer.observe(document.documentElement, { 
                childList: true, 
                subtree: true 
              });
              
              window._bypassObserver = observer;
            }
          } catch(e) {
            console.warn('CSP observer setup failed:', e);
          }
        }
        
        return true;
      })();
    `;
    
    webview.executeJavaScript(bypassScript)
      .catch(err => console.warn('Failed to execute bypass script:', err));
      
  } catch (err) {
    console.warn('Error in alternative header bypass execution:', err);
  }
}

/**
 * Alternative method to bypass headers using DOM ready event
 * @param {HTMLElement} webview - The webview element
 */
function useAlternativeHeaderBypass(webview) {
  console.log('Using alternative header bypass method via dom-ready event');
  
  // Set a flag so we only add this listener once
  if (!webview.hasAlternativeBypassListener) {
    webview.hasAlternativeBypassListener = true;
    
    // Add an immediate CSP bypass during navigation - only needed once per navigation
    if (typeof webview.addEventListener === 'function') {
      // Use just one primary event instead of multiple
      webview.addEventListener('did-start-loading', (event) => {
        // Only apply once per page load
        if (!webview._bypassAppliedForCurrentLoad) {
          console.log('Did start loading event, applying CSP bypass');
          attemptAlternativeHeadersBypass(webview);
          webview._bypassAppliedForCurrentLoad = true;
          
          // Reset flag when navigation completes
          setTimeout(() => {
            webview._bypassAppliedForCurrentLoad = false;
          }, 1000);
        }
      });
      
      // Only add dom-ready as a fallback
      webview.addEventListener('dom-ready', () => {
        // Run only if not already applied during this page load
        if (!webview._bypassAppliedForCurrentLoad) {
          console.log('DOM ready event, applying CSP bypass');
          attemptAlternativeHeadersBypass(webview);
          webview._bypassAppliedForCurrentLoad = true;
        }
      });
    }
    
    console.log('Alternative header bypass listener set up');
  }
}

/**
 * Apply critical styles immediately before navigation starts
 * This helps prevent the flickering effect
 * @param {Object} browser - Browser instance
 */
export function applyPreNavigationStyles(browser) {
  // Add better null/undefined checking
  if (!browser.webview || !browser.webview.tagName || browser.webview.tagName.toLowerCase() !== 'webview') {
    return;
  }
  
  try {
    // Check if webview is actually connected to DOM before trying to use it
    if (!browser.webview.isConnected) {
      console.log('Webview not yet connected to DOM, skipping pre-navigation styles');
      return;
    }
    
    // Apply direct styling to the webview element with transition support
    browser.webview.style.cssText = `
      display: flex !important;
      visibility: visible !important;
      opacity: 0 !important;
      z-index: 1 !important;
      position: fixed !important;
      top: 52px !important;
      left: var(--sidebar-width, 260px) !important;
      right: 0 !important;
      bottom: 0 !important;
      width: calc(100vw - var(--sidebar-width, 260px)) !important;
      height: calc(100vh - 52px) !important;
      min-height: calc(100vh - 52px) !important;
      max-height: calc(100vh - 52px) !important;
      min-width: calc(100vw - var(--sidebar-width, 260px)) !important;
      max-width: calc(100vw - var(--sidebar-width, 260px)) !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      background-color: white !important;
      transform: none !important;
      overflow: hidden !important;
      flex: 1 1 auto !important;
      pointer-events: auto !important;
      user-select: auto !important;
      touch-action: auto !important;
      transition: opacity 0.3s ease-in-out !important;
    `;
    
    // Force a layout recalculation to ensure styles are applied
    void browser.webview.offsetHeight;
    
    // Directly manipulate key properties to ensure they're set correctly
    browser.webview.style.top = '52px';
    browser.webview.style.position = 'fixed';
    
    if (typeof browser.webview.applyAllCriticalStyles === 'function') {
      browser.webview.applyAllCriticalStyles(true);
    }
    
    // Only try executeJavaScript with a safe verification method first
    if (typeof browser.webview.executeJavaScript === 'function') {
      try {
        // Try a simple test script first to verify the webview is ready
        browser.webview.executeJavaScript('true')
          .then(() => {
            // If successful, then try the actual style script
            browser.webview.executeJavaScript(`
              (function() {
                // Function to apply essential styles
                function applyEssentialStyles() {
                  // Apply immediate styles to html/body with !important to override site styles
                  if (document && document.documentElement) {
                    document.documentElement.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important;";
                  }
                  if (document && document.body) {
                    document.body.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important;";
                  }
                  
                  // Add a persistent style element with high specificity
                  if (document && document.head && !document.getElementById('cognivore-essential-fix')) {
                    const style = document.createElement('style');
                    style.id = 'cognivore-essential-fix';
                    style.textContent = "html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow-x: hidden !important; }";
                    document.head.appendChild(style);
                  }
                }
                
                // Try to apply immediately
                applyEssentialStyles();
                
                // Also set up to apply on DOMContentLoaded
                if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
                  document.addEventListener('DOMContentLoaded', applyEssentialStyles);
                }
                
                window.__styleFixApplied = true;
                return true;
              })();
            `).catch(() => {
              // Silently catch errors - we'll retry on DOM ready event
            });
          })
          .catch(() => {
            // Not ready for script execution yet, will try during did-start-loading or dom-ready events
            console.log('Webview not ready for executeJavaScript, will retry during webview events');
          });
      } catch (innerError) {
        // Catching DOM attachment errors without failing the entire function
        console.log('Webview not ready for script execution:', innerError.message);
      }
    }
  } catch (e) {
    console.warn('Error applying pre-navigation styles:', e);
  }
}

/**
 * Schedule multiple style checks at different intervals
 * This creates a cascading approach to catch and fix any styling issues
 * @param {Object} browser - Browser instance
 */
export function scheduleStyleChecks(browser) {
  // Clear any existing style check timers
  if (browser._styleCheckTimers) {
    browser._styleCheckTimers.forEach(timer => {
      if (typeof timer === 'number') {
        clearTimeout(timer);
      } else if (timer) {
        clearInterval(timer);
      }
    });
  }
  
  browser._styleCheckTimers = [];
  
  // Set a debounce flag to prevent multiple style applications in quick succession
  // This helps prevent flickering caused by rapid style changes
  if (!browser._styleApplicationLock) {
    browser._styleApplicationLock = {
      locked: false,
      lastApplied: Date.now(),
      pendingApplication: false
    };
  }
  
  // Save initial correct styles timestamp to avoid unnecessary re-styling
  browser._initialStylesAppliedTime = Date.now();
  
  // Instead of multiple checks, apply all critical styles at once
  if (typeof browser.webview.applyAllCriticalStyles !== 'function') {
    // Add the comprehensive style application method to the webview
    browser.webview.applyAllCriticalStyles = (forceApply = false) => {
      // Check if we should skip applying additional styles after initial render
      // If not forced and styles were already applied recently, skip to avoid flickering
      if (!forceApply) {
        const now = Date.now();
        const timeSinceLastApplication = now - browser._styleApplicationLock.lastApplied;
        
        // Skip application if we applied styles recently (within 1 second) and webview is ready
        if (timeSinceLastApplication < 1000 && 
            browser._initialStylesAppliedTime && 
            (now - browser._initialStylesAppliedTime < 2000) && 
            browser.webview.readyToShow) {
          return;
        }
        
        // Skip if already locked to prevent concurrent applications
        if (browser._styleApplicationLock.locked) {
          browser._styleApplicationLock.pendingApplication = true;
          return;
        }
      }
      
      // Lock style application to prevent multiple concurrent applications
      browser._styleApplicationLock.locked = true;
      browser._styleApplicationLock.lastApplied = Date.now();
      browser._styleApplicationLock.pendingApplication = false;
    
      console.log('Applying all critical webview styles at once');
      
      // Apply direct styling to the webview element
      browser.webview.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 1 !important;
        position: fixed !important;
        top: 52px !important;
        left: var(--sidebar-width, 260px) !important;
        right: 0 !important;
        bottom: 0 !important;
        width: calc(100vw - var(--sidebar-width, 260px)) !important;
        height: calc(100vh - 52px) !important;
        min-height: calc(100vh - 52px) !important;
        max-height: calc(100vh - 52px) !important;
        min-width: calc(100vw - var(--sidebar-width, 260px)) !important;
        max-width: calc(100vw - var(--sidebar-width, 260px)) !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        background-color: white !important;
        transform: none !important;
        overflow: hidden !important;
        flex: 1 1 auto !important;
        pointer-events: auto !important;
        user-select: auto !important;
        touch-action: auto !important;
      `;
      
      // Force layout recalculation
      void browser.webview.offsetHeight;
      
      // Apply content styles only if needed 
      if (typeof browser.webview.executeJavaScript === 'function' && (!browser.webview._stylesInitialized || forceApply)) {
        try {
          // Set initialization flag to avoid unnecessary repeated application
          browser.webview.readyToShow = true;
          browser.webview._stylesInitialized = true;
          
          // Execute a comprehensive one-time style fix
          const allInOneStyleScript = `
            (function() {
              // Don't re-apply styles if fully applied and not forced
              if (window._styleFixComplete && !${forceApply}) {
                return true;
              }
              
              // --- Create comprehensive style element ---
              if (!document.getElementById('cognivore-complete-fix')) {
                const style = document.createElement('style');
                style.id = 'cognivore-complete-fix';
                document.head.appendChild(style);
              }
              
              // Apply Google-specific CSS if on Google with enhanced selectors
              const styleEl = document.getElementById('cognivore-complete-fix');
              if (window.location.hostname.includes('google.com')) {
                styleEl.textContent = \`
                  html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    min-height: 100% !important;
                    max-width: 100vw !important;
                    overflow-x: hidden !important;
                    overflow-y: auto !important;
                  }
                  
                  /* Google Search specific fixes */
                  #main, #cnt, #rcnt, #center_col, .yuRUbf, .MjjYud, #rso, main, [role="main"],
                  div[role="main"], #search, #searchform, .sfbg, .minidiv, .g, .appbar, #searchform {
                    width: 100% !important;
                    min-height: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                  }
                  .g, .yuRUbf, .MjjYud, .v7W49e, .ULSxyf, .MUxGbd, .aLF0Z {
                    width: 100% !important;
                    margin-right: 0 !important;
                    padding-right: 0 !important;
                    box-sizing: border-box !important;
                  }
                  /* Center content container */
                  #center_col, #rso, #search {
                    width: 100% !important;
                    max-width: 900px !important;
                    margin: 0 auto !important;
                    overflow-x: hidden !important;
                  }
                \`;
              } else {
                // Generic styles for other sites with enhanced targeting
                styleEl.textContent = \`
                  html, body {
                    width: 100% !important;
                    height: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: auto !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    box-sizing: border-box !important;
                  }
                  main, [role="main"], #main, .main-content, .content, #content, article, 
                  header, footer, section, nav, aside, div[role="main"], .container {
                    width: 100% !important;
                    min-height: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                  }
                  /* Apply comprehensive fixes */
                  * {
                    max-width: 100vw !important;
                    overflow-x: hidden !important;
                  }
                \`;
              }
              
              // Apply direct styles to HTML and BODY with more aggressive fix
              document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important;";
              document.body.style.cssText += "width: 100% !important; height: 100% !important; overflow: auto !important; position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;";
              
              // Set a completion flag
              window._styleFixComplete = true;
              return true;
            })();
          `;
          
          // Execute all styles at once
          browser.webview.executeJavaScript(allInOneStyleScript)
            .then(() => {
              console.log('Comprehensive webview content styles successfully applied');
              
              // Unlock style application after completion
              setTimeout(() => {
                browser._styleApplicationLock.locked = false;
                
                // If there's a pending application, apply it now
                if (browser._styleApplicationLock.pendingApplication) {
                  browser.webview.applyAllCriticalStyles(true);
                }
              }, 100);
            })
            .catch(err => {
              console.warn('Error applying comprehensive styles:', err);
              browser._styleApplicationLock.locked = false;
            });
        } catch (err) {
          console.warn('Error executing style script:', err);
          browser._styleApplicationLock.locked = false;
        }
      } else {
        // Unlock style application after skipping content styling
        setTimeout(() => {
          browser._styleApplicationLock.locked = false;
          
          // If there's a pending application, apply it now
          if (browser._styleApplicationLock.pendingApplication) {
            browser.webview.applyAllCriticalStyles(true);
          }
        }, 100);
      }
      
      // Mark as ready to show
      browser.webview.readyToShow = true;
    };
  }
  
  // Apply a single comprehensive style pass instead of multiple checks
  if (browser.webview && !browser._isUnloading) {
    browser.webview.applyAllCriticalStyles(true);
    
    // Immediately mark as ready to show
    browser.webview.readyToShow = true;
    browser.webview.style.opacity = '1';
    
    // Check page load once after a short delay
    setTimeout(() => {
      if (browser.webview && !browser._isUnloading) {
        // Call the browser's method if it exists
        if (typeof browser.checkIfPageIsLoaded === 'function') {
          browser.checkIfPageIsLoaded();
        }
      }
    }, 300);
  }
  
  // Add a one-time check for safety after a substantial delay
  const safetyCheck = setTimeout(() => {
    if (browser.webview && !browser._isUnloading) {
      const rect = browser.webview.getBoundingClientRect();
      const expectedHeight = window.innerHeight - 52;
      const expectedWidth = window.innerWidth;
      
      // Only reapply if dimensions are significantly wrong (>10px difference)
      // Increased from previous 5px to reduce unnecessary style applications
      if (Math.abs(rect.width - expectedWidth) > 10 || 
          Math.abs(rect.height - expectedHeight) > 10 || 
          rect.top !== 52 || rect.left !== 0) {
        console.log('Safety check: Webview dimensions need adjustment');
        browser.webview.applyAllCriticalStyles(true);
      }
    }
  }, 1000);
  
  browser._styleCheckTimers.push(safetyCheck);
  
  // Only add resize handler if it doesn't already exist
  if (!browser._resizeHandler) {
    browser._resizeHandler = () => {
      if (browser.webview && !browser._isUnloading && typeof browser.webview.applyAllCriticalStyles === 'function') {
        // Debounce resize handler
        if (browser._resizeTimer) {
          clearTimeout(browser._resizeTimer);
        }
        browser._resizeTimer = setTimeout(() => {
          browser.webview.applyAllCriticalStyles(true);
        }, 250);
      }
    };
    
    window.addEventListener('resize', browser._resizeHandler);
  }
  
  return browser._styleCheckTimers;
}

/**
 * Schedule a series of opacity transitions to create a smoother loading experience
 * @param {Object} browser - Browser instance
 */
export function scheduleOpacityTransitions(browser) {
  if (!browser.webview) return;
  
  // Clear any existing opacity timers
  if (browser._opacityTimers) {
    browser._opacityTimers.forEach(timer => clearTimeout(timer));
    browser._opacityTimers = [];
  }
  
  // Start with invisibility for smoother transition
  browser.webview.style.cssText += `
    visibility: visible !important;
    opacity: 0 !important;
    transition: opacity 0.3s ease-in-out !important;
  `;
  
  // Apply a single transition to full opacity after a brief delay
  const timer = setTimeout(() => {
    if (browser.webview && browser.webview.isConnected && !browser._isUnloading) {
      // Apply full styles first to ensure dimensions are correct
      if (typeof browser.webview.applyAllCriticalStyles === 'function') {
        browser.webview.applyAllCriticalStyles(true);
      }
      
      // Fade in with transition
      browser.webview.style.opacity = '1';
    }
  }, 50);
  
  browser._opacityTimers = [timer];
  
  // Clean up timers after max time
  setTimeout(() => {
    if (browser._opacityTimers) {
      browser._opacityTimers.forEach(timer => clearTimeout(timer));
      browser._opacityTimers = [];
    }
  }, 1000);
  
  return browser._opacityTimers;
}

/**
 * Setup the browser layout 
 * @param {Object} browser - The browser instance
 */
export function setupBrowserLayout(browser) {
  if (!browser || !browser.containerRef || !browser.containerRef.current) {
    console.error('Cannot set up browser layout - container reference is missing');
    return;
  }

  const container = browser.containerRef.current;
  
  // Clear any existing content
  console.log('Setting up browser layout in container:', container);
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  
  // Set container style to ensure proper display
  container.style.cssText = `
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    position: relative !important;
    box-sizing: border-box !important;
  `;
  
  // Create header container with address bar at the top
  const headerContainer = createBrowserHeader(browser);
  container.appendChild(headerContainer);
  
  // Store references to the components
  const addressContainer = headerContainer.querySelector('.voyager-address-container');
  const header = headerContainer.querySelector('.browser-header');
  
  // Create progress bar
  const progressBar = createProgressBar();
  container.appendChild(progressBar);
  
  // Create main content area
  const webviewContainer = document.createElement('div');
  webviewContainer.className = 'browser-webview-container';
  webviewContainer.style.flex = '1';
  webviewContainer.style.position = 'relative';
  webviewContainer.style.overflow = 'hidden';
  container.appendChild(webviewContainer);
  
  // Create research panel
  const researchPanel = createResearchPanel();
  container.appendChild(researchPanel);
  
  // Store references
  browser.header = header;
  browser.addressContainer = addressContainer;
  browser.headerContainer = headerContainer;
  browser.progressBar = progressBar.querySelector('.browser-progress-bar');
  browser.progressContainer = progressBar;
  browser.webviewContainer = webviewContainer;
  browser.researchPanel = researchPanel;
  
  // Log layout creation for debugging
  console.log('Browser layout created with address bar at the top');
}

/**
 * Setup the navigation bar for the browser
 * @param {Object} browser - The browser instance
 */
export function setupNavigationBar(browser) {
  if (!browser || !browser.containerRef || !browser.containerRef.current) {
    console.error('Cannot set up navigation bar - container reference is missing');
    return;
  }
  
  const container = browser.containerRef.current;
  
  // Find address container and input first (now separate from header)
  const addressContainer = container.querySelector('.voyager-address-container');
  const addressInput = addressContainer?.querySelector('.voyager-address-bar');
  const addressForm = addressContainer?.querySelector('form');
  
  // Then find navigation buttons in the header
  const header = container.querySelector('.browser-header');
  const backButton = header?.querySelector('.browser-back-btn');
  const forwardButton = header?.querySelector('.browser-forward-btn');
  const refreshButton = header?.querySelector('.browser-refresh-btn');
  const stopButton = header?.querySelector('.browser-stop-btn');
  
  // Verify we have all elements
  if (!addressInput || !addressForm) {
    console.warn('Could not find address input or form in the container');
  }
  
  if (!backButton || !forwardButton || !refreshButton || !stopButton) {
    console.warn('Could not find navigation buttons in the header');
  }
  
  // Set references
  if (backButton) browser.backButton = backButton;
  if (forwardButton) browser.forwardButton = forwardButton;
  if (refreshButton) browser.refreshButton = refreshButton;
  if (stopButton) browser.stopButton = stopButton;
  if (addressForm) browser.searchForm = addressForm;
  if (addressInput) {
    browser.addressInput = addressInput;
    browser.searchInput = addressInput; // For backward compatibility
  }
  
  // Initialize button states
  if (backButton) backButton.disabled = true;
  if (forwardButton) forwardButton.disabled = true;
  
  // Set up event handlers if not already set up
  if (addressForm && typeof browser.handleAddressSubmit === 'function') {
    // Clean up any existing handlers to prevent duplicates
    const newAddressForm = addressForm.cloneNode(true);
    addressForm.parentNode.replaceChild(newAddressForm, addressForm);
    browser.searchForm = newAddressForm;
    
    // Add the input reference again since we replaced the form
    const newAddressInput = newAddressForm.querySelector('.voyager-address-bar');
    if (newAddressInput) {
      browser.addressInput = newAddressInput;
      browser.searchInput = newAddressInput;
    }
    
    // Add event listeners
    newAddressForm.addEventListener('submit', browser.handleAddressSubmit);
    
    if (newAddressInput && typeof browser.handleAddressChange === 'function') {
      newAddressInput.addEventListener('change', browser.handleAddressChange);
    }
  }
  
  // Set up navigation button handlers
  if (backButton && typeof browser.handleBackAction === 'function') {
    backButton.addEventListener('click', () => browser.handleBackAction(browser));
  }
  
  if (forwardButton && typeof browser.handleForwardAction === 'function') {
    forwardButton.addEventListener('click', () => browser.handleForwardAction(browser));
  }
  
  if (refreshButton && typeof browser.refreshPage === 'function') {
    refreshButton.addEventListener('click', () => browser.refreshPage());
  }
  
  if (stopButton && typeof browser.stopLoading === 'function') {
    stopButton.addEventListener('click', () => browser.stopLoading());
  }
  
  console.log('Navigation bar setup complete with address bar at the top');
}

/**
 * Setup the webview container with the appropriate webview implementation
 * @param {Object} browser - The browser instance
 */
export function setupWebViewContainer(browser) {
  if (!browser || !browser.webviewContainer) {
    console.error('Cannot set up webview container - container is missing');
    return;
  }
  
  // Determine browser implementation based on environment
  const { webviewImplementation } = browser.state?.environment || { webviewImplementation: 'webview' };
  
  // Create webview
  const { container, webview } = createWebview(browser, webviewImplementation, 'standard');
  
  // Replace container contents with new webview container
  browser.webviewContainer.innerHTML = '';
  browser.webviewContainer.appendChild(container);
  
  // Add flags to track proper event firing
  if (webview) {
    // Initialize tracking flags to prevent excessive polling
    webview._loadEventsFired = {
      didStartLoading: false,
      didStopLoading: false,
      didFinishLoad: false,
      domReady: false
    };
  }
  
  // Set up event handlers
  if (webview) {
    // For Electron webview
    if (webview.tagName?.toLowerCase() === 'webview') {
      webview.addEventListener('did-start-loading', () => {
        // Mark this event as fired
        webview._loadEventsFired.didStartLoading = true;
        
        // Inline implementation of handleLoadStart
        if (browser && typeof browser.setState === 'function') {
          browser.setState({ isLoading: true });
        }
        if (typeof browser.showLoadingProgress === 'function') {
          browser.showLoadingProgress();
        }
        // Apply immediate styles for better user experience
        if (webview && typeof webview.style !== 'undefined') {
          webview.style.visibility = 'visible';
          webview.style.opacity = '0.4';
        }
      });
      
      webview.addEventListener('did-stop-loading', () => {
        // Mark this event as fired
        webview._loadEventsFired.didStopLoading = true;
        
        // Inline implementation of handleLoadStop
        if (browser && typeof browser.setState === 'function') {
          browser.setState({ isLoading: false });
        }
        if (typeof browser.hideLoadingProgress === 'function') {
          browser.hideLoadingProgress();
        }
        // Make fully visible
        if (webview && typeof webview.style !== 'undefined') {
          webview.style.visibility = 'visible';
          webview.style.opacity = '1';
          if (typeof webview.readyToShow !== 'undefined') {
            webview.readyToShow = true;
          }
        }
      });
      
      webview.addEventListener('dom-ready', () => {
        // Mark this event as fired
        webview._loadEventsFired.domReady = true;
      });
      
      webview.addEventListener('did-navigate', (e) => {
        // Inline implementation of handlePageNavigation
        if (browser && typeof browser.updateAddressBar === 'function') {
          browser.updateAddressBar(e.url);
        }
        if (browser && typeof browser.setState === 'function') {
          browser.setState({ currentUrl: e.url });
        }
        // Update navigation buttons if history is available
        if (browser && browser.updateNavigationButtons) {
          browser.updateNavigationButtons();
        }
      });
      
      webview.addEventListener('did-finish-load', () => {
        // Mark this event as fired
        webview._loadEventsFired.didFinishLoad = true;
        
        // Call the original handler
        if (typeof browser.handleWebviewLoad === 'function') {
          browser.handleWebviewLoad();
        }
      });
    } 
    // For iframe
    else {
      webview.onload = () => {
        webview._loadEventsFired = {
          didStartLoading: true,
          didStopLoading: true,
          didFinishLoad: true,
          domReady: true
        };
        browser.handleWebviewLoad();
      };
    }
    
    // Store reference to check if page loaded
    browser._loadEventPollingCount = 0;
    
    // Replace default checkIfPageIsLoaded with a smarter version
    if (typeof browser.checkIfPageIsLoaded === 'function') {
      const originalCheck = browser.checkIfPageIsLoaded;
      browser.checkIfPageIsLoaded = function() {
        // Skip polling if events have properly fired
        if (webview && webview._loadEventsFired) {
          const allEventsReceived = 
            webview._loadEventsFired.didStartLoading && 
            (webview._loadEventsFired.didStopLoading || webview._loadEventsFired.didFinishLoad);
            
          if (allEventsReceived) {
            // All events properly received, no need for polling
            return;
          }
          
          // Limit polling to reasonable number of attempts (max 3)
          if (browser._loadEventPollingCount >= 3) {
            console.log('Maximum polling attempts reached, stopping page load checks');
            return;
          }
          
          browser._loadEventPollingCount++;
        }
        
        // Fall back to original implementation if needed
        originalCheck.call(browser);
      };
    }
  }
  
  // Apply pre-navigation styles
  applyPreNavigationStyles(browser);
  
  // Schedule style checks for consistent display
  scheduleStyleChecks(browser);
}

/**
 * Update the address bar with the current URL
 * @param {Object} browser - The browser instance
 * @param {string} url - The URL to display
 */
export function updateAddressBar(browser, url) {
  if (!browser) {
    console.error('Cannot update address bar - browser instance is missing');
    return;
  }

  // Find input using a more robust approach with multiple fallbacks
  const addressInput = 
    // First try the direct addressInput reference
    browser.addressInput || 
    // Then try searchInput for backward compatibility
    browser.searchInput || 
    // Then look for the address bar in the DOM
    browser.containerRef?.current?.querySelector('.voyager-address-bar') ||
    // For older implementations, try the search input
    browser.containerRef?.current?.querySelector('.browser-search-input') ||
    // Last resort, look for any element with voyager-address-container parent
    browser.containerRef?.current?.querySelector('.voyager-address-container input');
  
  if (!addressInput) {
    console.warn('Cannot update address bar - input not found through any method');
    return;
  }
  
  // Update the input value
  addressInput.value = url;
  
  // Also update the state if applicable
  if (typeof browser.setState === 'function') {
    browser.setState({ 
      url: url,
      typedUrlValue: url 
    });
  }
  
  console.log('Updated address bar with URL:', url);
}

/**
 * Update the loading indicator to show or hide progress
 * @param {Object} browser - The browser instance
 * @param {boolean} isLoading - Whether the browser is currently loading
 */
export function updateLoadingIndicator(browser, isLoading) {
  if (!browser) {
    console.error('Cannot update loading indicator - browser instance is missing');
    return;
  }

  // Find elements if not directly referenced
  const progressBar = browser.progressBar || 
                     browser.container?.querySelector('.browser-progress-bar');
  
  const refreshButton = browser.refreshButton || 
                       browser.container?.querySelector('.browser-refresh-btn');
  
  const stopButton = browser.stopButton || 
                    browser.container?.querySelector('.browser-stop-btn');
  
  // Check if elements exist before proceeding
  if (!progressBar) {
    console.warn('Cannot update loading indicator - progress bar element missing');
  }
  
  if (!refreshButton || !stopButton) {
    console.warn('Cannot update loading indicator - button elements missing');
  }
  
  // Update progress bar if available
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
  
  // Update buttons if available
  if (refreshButton && stopButton) {
    if (isLoading) {
      refreshButton.style.display = 'none';
      stopButton.style.display = 'block';
    } else {
      refreshButton.style.display = 'block';
      stopButton.style.display = 'none';
    }
  }
}

/**
 * Update the page title in the browser
 * @param {Object} browser - The browser instance
 * @param {string} title - The page title
 */
export function updatePageTitle(browser, title) {
  if (!browser) {
    console.error('Cannot update page title - browser instance is missing');
    return;
  }
  
  // Update browser state
  browser.setState({ title });
  
  // Update document title if needed
  if (browser.props.updateDocumentTitle && title) {
    document.title = title;
  }
}

export default {
  createBrowserHeader,
  createResearchPanel,
  createWebviewElement,
  createWebview,
  createProgressBar,
  showLoadingContent,
  hideLoadingContent,
  enforceWebviewStyles,
  applyPreNavigationStyles,
  scheduleStyleChecks,
  scheduleOpacityTransitions,
  setupBrowserLayout,
  setupNavigationBar,
  setupWebViewContainer,
  updateAddressBar,
  updateLoadingIndicator,
  updatePageTitle
}; 