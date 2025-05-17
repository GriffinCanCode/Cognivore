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
 * @returns {HTMLElement} The created webview element
 */
export function initializeWebview(browser, container) {
  webviewLogger.info('Initializing webview for browser', browser.browserId);
  
  // Make sure we have a valid container
  if (!container) {
    webviewLogger.error('Container is missing or null - cannot initialize webview', {
      browserHasContainerRef: !!browser.browserContainer,
      browserHasContainerRefCurrent: !!browser.browserContainer?.current
    });
    return null;
  }
  
  webviewLogger.debug('Got container:', {
    id: container.id || 'no-id',
    className: container.className || 'no-class',
    tagName: container.tagName,
    size: container.clientWidth + 'x' + container.clientHeight,
    isInDOM: document.body.contains(container)
  });

  // Check existing webview element
  let existingWebview = container.querySelector('webview');
  if (existingWebview) {
    webviewLogger.info('Found existing webview in container - will reuse it');
    browser.webview = existingWebview;
    
    // Setup event handlers for existing webview
    setupWebviewEventListeners(browser, existingWebview);
    
    // Apply styling
    styleManager.applyInitialStyles(existingWebview);
    
    return existingWebview;
  }
  
  webviewLogger.debug('No existing webview found - creating new one');
  
  // Create a webview element
  try {
    webviewLogger.debug('Creating webview DOM element');
    const webview = document.createElement('webview');
    
    // Set webview attributes
    webviewLogger.debug('Setting webview attributes');
    webview.setAttribute('src', 'about:blank');
    webview.setAttribute('partition', `persist:browser-${browser.browserId}`);
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('disablewebsecurity', 'true');
    webview.setAttribute('webpreferences', 'contextIsolation=yes, javascript=yes, allowRunningInsecureContent=yes');
    webview.setAttribute('data-browser-id', browser.browserId);
    
    // Set id for debugging purposes
    webview.id = `webview-${browser.browserId}`;
    
    // Apply initial styles before adding to DOM
    webviewLogger.debug('Applying initial styles before DOM insertion');
    webview.style.cssText = `
      display: flex !important;
      width: 100% !important;
      height: 100% !important;
      border: none !important;
      background-color: white !important;
      min-height: 100% !important;
      max-height: 100% !important;
      flex: 1 1 auto !important;
      margin: 0 !important;
      padding: 0 !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      z-index: 1 !important;
      visibility: visible !important;
      opacity: 1 !important;
    `;
    
    // Create wrapper if needed
    let webviewContainer = container.querySelector('.browser-webview-container');
    if (!webviewContainer) {
      webviewLogger.debug('Creating webview container wrapper');
      webviewContainer = document.createElement('div');
      webviewContainer.className = 'browser-webview-container';
      webviewContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
      `;
      container.appendChild(webviewContainer);
    }
    
    // Add the webview to the container
    webviewLogger.debug('Appending webview to container');
    webviewContainer.appendChild(webview);
    
    // Store reference in the browser component
    browser.webview = webview;
    
    // Setup event listeners
    webviewLogger.debug('Setting up webview event listeners');
    setupWebviewEventListeners(browser, webview);
    
    // Apply initial styling from StyleManager
    webviewLogger.debug('Applying StyleManager styles');
    styleManager.applyInitialStyles(webview);
    
    webviewLogger.info('Webview created and initialized successfully', {
      id: webview.id,
      inDOM: document.body.contains(webview)
    });
    
    return webview;
  } catch (error) {
    webviewLogger.error('Error creating webview:', error);
    return null;
  }
}

/**
 * Setup event listeners for a webview element
 * @param {Object} browser - Browser component instance
 * @param {HTMLElement} webview - Webview element
 */
function setupWebviewEventListeners(browser, webview) {
  webviewLogger.debug('Setting up event listeners for webview', webview.id);
  
  // Track event registration for debugging
  const registeredEvents = [];
  
  // Helper function to safely add event listeners
  const safeAddEventListener = (eventName, handler) => {
    try {
      if (typeof handler === 'function') {
        webview.addEventListener(eventName, handler);
        registeredEvents.push(eventName);
        webviewLogger.debug(`Added '${eventName}' event listener`);
      } else {
        webviewLogger.warn(`Cannot add '${eventName}' event listener - handler is not a function`);
      }
    } catch (error) {
      webviewLogger.error(`Error adding '${eventName}' event listener:`, error);
    }
  };
  
  // Navigation events
  if (browser.handleLoadStart) safeAddEventListener('did-start-loading', browser.handleLoadStart);
  if (browser.handleLoadStop) safeAddEventListener('did-stop-loading', browser.handleLoadStop);
  if (browser.handleLoadFinish) safeAddEventListener('did-finish-load', browser.handleLoadFinish);
  if (browser.handleWebviewLoad) safeAddEventListener('did-finish-load', browser.handleWebviewLoad);
  
  // DOM events
  if (browser.handleDomReady) safeAddEventListener('dom-ready', browser.handleDomReady);
  
  // Error events
  if (browser.handleLoadError) {
    safeAddEventListener('did-fail-load', browser.handleLoadError);
  } else {
    safeAddEventListener('did-fail-load', (event) => {
      handlePageLoadError(browser, event);
    });
  }
  
  // Certificate errors
  safeAddEventListener('certificate-error', (event) => {
    handleCertificateError(browser, event);
  });
  
  // Navigation state events
  if (browser.handleDidNavigate) safeAddEventListener('did-navigate', browser.handleDidNavigate);
  if (browser.handleDidNavigateInPage) safeAddEventListener('did-navigate-in-page', browser.handleDidNavigateInPage);
  if (browser.handleWillNavigate) safeAddEventListener('will-navigate', browser.handleWillNavigate);
  
  // Content events
  if (browser.handleTitleUpdate) safeAddEventListener('page-title-updated', browser.handleTitleUpdate);
  if (browser.handleFaviconUpdate) safeAddEventListener('page-favicon-updated', browser.handleFaviconUpdate);
  
  // Communication events
  if (browser.handleConsoleMessage) safeAddEventListener('console-message', browser.handleConsoleMessage);
  if (browser.handleIpcMessage) safeAddEventListener('ipc-message', browser.handleIpcMessage);
  
  // Window events
  if (browser.handleNewWindow) safeAddEventListener('new-window', browser.handleNewWindow);
  
  // Additional special events for debugging
  safeAddEventListener('dom-ready', () => {
    webviewLogger.info('Webview DOM ready event fired, applying enhanced styling');
    
    // Apply essential styles for stability
    webview.style.visibility = 'visible';
    webview.style.opacity = '1';
    
    // Apply comprehensive styling when DOM is ready
    styleManager.applyEssentialStyles(webview);
    
    // Verify DOM attachment
    webviewLogger.debug('DOM Ready - Webview is in DOM:', document.body.contains(webview));
  });
  
  // Add custom event for load completion
  safeAddEventListener('did-stop-loading', () => {
    webviewLogger.info('Webview load completed (did-stop-loading)');
    
    // Apply final style enhancements
    styleManager.applyLoadCompleteStyling(webview);
    
    // Show visibility status
    const computedStyle = window.getComputedStyle(webview);
    webviewLogger.debug('Webview visibility after load:', {
      visibility: computedStyle.visibility,
      opacity: computedStyle.opacity,
      display: computedStyle.display
    });
  });
  
  webviewLogger.info(`Registered ${registeredEvents.length} event listeners:`, registeredEvents);
}

/**
 * Creates or recreates the webview element for a browser tab
 * @param {Object} browser - Browser component instance  
 * @param {string} tabId - The ID of the tab
 * @param {string} url - Optional URL to navigate to
 * @returns {HTMLElement} The created webview element
 */
export function createWebviewForTab(browser, tabId, url = null) {
  webviewLogger.info(`Creating webview for tab ${tabId}`, { url });
  
  if (!browser || !browser.browserContainer || !browser.browserContainer.current) {
    webviewLogger.error('Cannot create webview for tab - container not available', {
      hasBrowser: !!browser,
      hasContainer: !!browser?.browserContainer,
      hasContainerCurrent: !!browser?.browserContainer?.current
    });
    return null;
  }
  
  // Get container and create webview
  const container = browser.browserContainer.current;
  
  // Create a unique partition for this tab to isolate browsing context
  const tabPartition = `persist:tab-${tabId}`;
  webviewLogger.debug(`Using partition "${tabPartition}" for tab ${tabId}`);
  
  // Create webview element
  const webview = document.createElement('webview');
  webview.id = `tab-webview-${tabId}`;
  webview.className = 'browser-webview';
  webview.setAttribute('partition', tabPartition);
  webview.setAttribute('allowpopups', 'true');
  webview.setAttribute('webpreferences', 'contextIsolation=yes, javascript=yes');
  webview.setAttribute('data-tab-id', tabId);
  
  // Apply styling
  webview.style.cssText = `
    display: flex !important;
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    background-color: white !important;
    flex: 1 1 auto !important;
    margin: 0 !important;
    padding: 0 !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    z-index: 1 !important;
  `;
  
  // Create or find webview container
  let webviewContainer = container.querySelector('.browser-webview-container');
  if (!webviewContainer) {
    webviewLogger.debug('Creating new webview container for tabs');
    webviewContainer = document.createElement('div');
    webviewContainer.className = 'browser-webview-container';
    container.appendChild(webviewContainer);
  }
  
  // Add webview to container
  webviewLogger.debug('Adding tab webview to container');
  webviewContainer.appendChild(webview);
  
  // Store reference in browser
  browser.webview = webview;
  
  // Set initial URL if provided
  if (url) {
    webviewLogger.debug(`Setting initial URL for tab ${tabId}:`, url);
    webview.setAttribute('src', url);
  }
  
  // Setup event listeners
  setupWebviewEventListeners(browser, webview);
  
  // Apply styling
  styleManager.applyInitialStyles(webview);
  
  webviewLogger.info(`Webview for tab ${tabId} created successfully`);
  return webview;
}

export default {
  initializeWebview,
  createWebviewForTab
}; 