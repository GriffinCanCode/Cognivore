/**
 * VoyagerLifecycle.js - Manages Voyager component lifecycle
 * 
 * This module provides methods for initializing the Voyager component
 * and cleaning up resources when the component is unmounted.
 */

import logger from '../../../utils/logger';
import ExtractorManager from '../extraction/ExtractorManager';

// Create a dedicated logger for this module
const lifecycleLogger = logger.scope('VoyagerLifecycle');

// Global state tracking to prevent race conditions
const browserStateTracker = new Map();

/**
 * Check if browser DOM is properly ready for initialization
 * @param {Object} browser - Voyager browser instance
 * @returns {boolean} True if DOM is ready
 */
function isDomReadyForBrowser(browser) {
  if (!browser || !browser.containerRef || !browser.containerRef.current) {
    return false;
  }
  
  const container = browser.containerRef.current;
  
  // Enhanced DOM readiness check - more resilient than before
  const isContainerReady = container && (
    // Standard connected check
    container.isConnected || 
    // Document contains check (more reliable)
    document.contains(container) ||
    // Has parent node (fallback)
    container.parentNode ||
    // Additional check: is the container actually in the DOM tree
    (container.parentElement && document.contains(container.parentElement))
  );
  
  // Additional safety check: ensure container has some basic properties
  const hasBasicDomProperties = container && 
    typeof container.tagName === 'string' &&
    typeof container.appendChild === 'function';
  
  const isReady = isContainerReady && hasBasicDomProperties;
  
  if (!isReady) {
    console.log('🔍 DOM readiness check failed:', {
      hasContainer: !!container,
      isConnected: container?.isConnected,
      inDocument: container ? document.contains(container) : false,
      hasParent: !!container?.parentNode,
      hasParentElement: !!container?.parentElement,
      parentInDocument: container?.parentElement ? document.contains(container.parentElement) : false,
      hasTagName: container ? typeof container.tagName === 'string' : false,
      hasAppendChild: container ? typeof container.appendChild === 'function' : false
    });
  }
  
  return isReady;
}

/**
 * Reset browser initialization state - called when component unmounts
 * @param {Object} browser - Voyager browser instance
 */
function resetBrowserState(browser) {
  if (browser && browser.browserId) {
    browserStateTracker.delete(browser.browserId);
    lifecycleLogger.debug(`Reset browser state for ID: ${browser.browserId}`);
  }
}

/**
 * Initialize the Voyager browser component
 * 
 * @param {Object} browser - Voyager browser instance
 * @param {Object} options - Initialization options
 */
export function initialize(browser, options = {}) {
  // EXTREME DEBUG - Guaranteed to show in console
  console.error('🚨 EXTREME DEBUG: VoyagerLifecycle.initialize FUNCTION ENTRY POINT');
  
  // Use direct console.log for guaranteed visibility
  console.log('🔍 VOYAGER LIFECYCLE: initializing browser ID:', browser ? browser.browserId : 'undefined browser');
  lifecycleLogger.info(`Initializing Voyager browser ID: ${browser ? browser.browserId : 'undefined'}`);
  
  // Check if browser is null or undefined
  if (!browser) {
    console.error('🚨 EXTREME DEBUG: NULL/UNDEFINED BROWSER PASSED TO INITIALIZE!');
    lifecycleLogger.error('NULL/UNDEFINED BROWSER PASSED TO INITIALIZE!');
    return;
  }
  
  console.error('🚨 EXTREME DEBUG: Browser state and DOM readiness check');
  
  // CRITICAL FIX: Check DOM readiness regardless of state existence
  const isDomReady = isDomReadyForBrowser(browser);
  const hasTrackedState = browserStateTracker.has(browser.browserId);
  
  console.log('🔍 VOYAGER LIFECYCLE: DOM and state status:', {
    browserId: browser.browserId,
    isDomReady,
    hasTrackedState,
    hasReactState: !!browser.state,
    isComponentMounted: browser.state?.isMounted
  });
  
  // If DOM is not ready, we must wait regardless of state
  if (!isDomReady) {
    console.error('🚨 EXTREME DEBUG: DOM NOT READY - scheduling retry');
    console.log('🔍 VOYAGER LIFECYCLE: DOM not ready, scheduling retry');
    lifecycleLogger.warn('DOM not ready for initialization, will retry');
    
    // Schedule a retry with exponential backoff
    const retryCount = (browser._lifecycleRetryCount || 0) + 1;
    browser._lifecycleRetryCount = retryCount;
    
    if (retryCount <= 10) {
      const delay = Math.min(100 * Math.pow(1.2, retryCount), 2000);
      console.log(`🔄 VOYAGER LIFECYCLE: Scheduling retry #${retryCount} in ${delay}ms`);
      
      setTimeout(() => {
        // Double-check component is still mounted before retry
        if (!browser._isUnloading && browser.state?.isMounted) {
          initialize(browser, options);
        } else {
          console.log('🔍 VOYAGER LIFECYCLE: Component unmounted during retry, aborting');
        }
      }, delay);
    } else {
      console.error('🔍 VOYAGER LIFECYCLE: Max retries exceeded for DOM readiness');
      lifecycleLogger.error('Max retries exceeded waiting for DOM readiness');
    }
    return;
  }
  
  // Reset retry count on successful DOM check
  browser._lifecycleRetryCount = 0;
  
  // Initialize state if not already initialized OR if this is a fresh mount
  const needsStateInit = !browser.state || !hasTrackedState || options.forceStateReset;
  
  if (needsStateInit) {
    console.error('🚨 EXTREME DEBUG: Initializing browser state');
    console.log('🔍 VOYAGER LIFECYCLE: Initializing browser state (fresh or forced)');
    lifecycleLogger.debug('Initializing browser state');
    
    // Mark this browser as tracked
    browserStateTracker.set(browser.browserId, {
      initialized: true,
      timestamp: Date.now()
    });
    
    // Only set state if browser doesn't have state or if forcing reset
    if (!browser.state || options.forceStateReset) {
      browser.setState({
        isLoading: false,
        url: browser.state?.url || '',
        displayUrl: browser.state?.displayUrl || '',
        title: browser.state?.title || '',
        favicon: browser.state?.favicon || null,
        error: browser.state?.error || null,
        history: browser.state?.history || [],
        currentHistoryIndex: browser.state?.currentHistoryIndex || -1,
        isSearchMode: browser.state?.isSearchMode || false,
        showSettings: browser.state?.showSettings || false,
        scrollPosition: browser.state?.scrollPosition || 0,
        isMounted: true // Ensure mounted state is set
      });
    }
  } else {
    console.error('🚨 EXTREME DEBUG: Browser state exists and DOM is ready - proceeding with initialization');
    console.log('🔍 VOYAGER LIFECYCLE: Browser state exists and DOM ready, proceeding');
    lifecycleLogger.debug('Browser state exists and DOM ready, proceeding with initialization');
    
    // Update tracking timestamp
    browserStateTracker.set(browser.browserId, {
      initialized: true,
      timestamp: Date.now()
    });
  }
  
  // Initialize sub-components and managers
  console.log('🔍 VOYAGER LIFECYCLE: Initializing sub-managers');
  lifecycleLogger.debug('Initializing sub-managers');
  initializeManagers(browser);
  
  // Initialize event handlers
  console.log('🔍 VOYAGER LIFECYCLE: Setting up event handlers');
  lifecycleLogger.debug('Setting up event handlers');
  setupEventHandlers(browser);
  
  // Add ExtractorManager to browser instance for direct access
  browser.extractorManager = ExtractorManager;
  console.log('🔍 VOYAGER LIFECYCLE: Added ExtractorManager to browser instance');
  lifecycleLogger.debug('Added ExtractorManager to browser instance');
  
  // Set up interval timers for periodic tasks
  console.log('🔍 VOYAGER LIFECYCLE: Setting up periodic tasks');
  lifecycleLogger.debug('Setting up periodic tasks');
  browser._periodicTasks = setupPeriodicTasks(browser);
  
  // Add window event listeners
  console.log('🔍 VOYAGER LIFECYCLE: Adding window event listeners');
  lifecycleLogger.debug('Adding window event listeners');
  addWindowListeners(browser);
  
  // Implement a more robust multi-attempt initialization sequence
  browser._webviewCreationAttempts = 0;
  browser._maxWebviewCreationAttempts = 5;
  
  // Track initialization status
  browser._isWebviewInitialized = false;
  
  // Function to initialize or retry webview creation
  const attemptWebviewCreation = () => {
    const attemptNumber = ++browser._webviewCreationAttempts;
    console.log(`🔥 VOYAGER LIFECYCLE: Attempting webview creation - attempt ${attemptNumber}/${browser._maxWebviewCreationAttempts}`);
    lifecycleLogger.info(`Attempting webview creation - attempt ${attemptNumber}/${browser._maxWebviewCreationAttempts}`);
    
    // CRITICAL: Double-check DOM is still ready before each attempt
    if (!isDomReadyForBrowser(browser)) {
      console.log('🔥 VOYAGER LIFECYCLE: DOM no longer ready during webview creation attempt');
      lifecycleLogger.warn('DOM no longer ready during webview creation attempt');
      return false;
    }
    
    // Check if we have direct vs. initBrowserContent method of creation
    if (typeof browser.createWebviewElement === 'function') {
      console.log('🔥 VOYAGER LIFECYCLE: Using direct createWebviewElement method');
      lifecycleLogger.debug('Using direct createWebviewElement method');
      const webview = browser.createWebviewElement();
      
      if (webview && document.body.contains(webview)) {
        console.log('🎉 VOYAGER LIFECYCLE: Webview creation successful!', webview.id || 'no-id');
        lifecycleLogger.info('Webview creation successful!', {
          id: webview.id || 'no-id',
          inDOM: true,
          attempt: attemptNumber
        });
        browser._isWebviewInitialized = true;
        return true;
      } else {
        console.log('⚠️ VOYAGER LIFECYCLE: Direct webview creation failed or webview not in DOM');
        lifecycleLogger.warn('Direct webview creation failed or webview not in DOM');
      }
    } else {
      console.log('⚠️ VOYAGER LIFECYCLE: createWebviewElement method not available');
      lifecycleLogger.warn('createWebviewElement method not available');
    }
    
    // Try initBrowserContent as an alternative
    if (typeof browser.initBrowserContent === 'function') {
      console.log('🔥 VOYAGER LIFECYCLE: Trying initBrowserContent as alternative');
      lifecycleLogger.debug('Trying initBrowserContent as alternative');
      try {
        browser.initBrowserContent();
        
        // Check if this was successful
        if (browser.webview && document.body.contains(browser.webview)) {
          console.log('🎉 VOYAGER LIFECYCLE: Webview initialization via initBrowserContent successful!', browser.webview.id || 'no-id');
          lifecycleLogger.info('Webview initialization via initBrowserContent successful!', {
            id: browser.webview.id || 'no-id',
            inDOM: true,
            attempt: attemptNumber
          });
          browser._isWebviewInitialized = true;
          return true;
        } else {
          console.log('⚠️ VOYAGER LIFECYCLE: initBrowserContent did not create a valid webview in DOM');
          lifecycleLogger.warn('initBrowserContent did not create a valid webview in DOM');
        }
      } catch (error) {
        console.log('❌ VOYAGER LIFECYCLE: Error in initBrowserContent:', error.message);
        lifecycleLogger.error('Error in initBrowserContent:', error);
      }
    } else {
      console.log('⚠️ VOYAGER LIFECYCLE: initBrowserContent method not available');
      lifecycleLogger.warn('initBrowserContent method not available');
    }
    
    // Try forceInitBrowser as a last resort
    if (typeof browser.forceInitBrowser === 'function') {
      console.log('🔥 VOYAGER LIFECYCLE: Trying forceInitBrowser as last resort');
      lifecycleLogger.debug('Trying forceInitBrowser as last resort');
      try {
        browser.forceInitBrowser();
        
        // Check if this was successful
        if (browser.webview && document.body.contains(browser.webview)) {
          console.log('🎉 VOYAGER LIFECYCLE: Webview initialization via forceInitBrowser successful!', browser.webview.id || 'no-id');
          lifecycleLogger.info('Webview initialization via forceInitBrowser successful!', {
            id: browser.webview.id || 'no-id',
            inDOM: true,
            attempt: attemptNumber
          });
          browser._isWebviewInitialized = true;
          return true;
        } else {
          console.log('⚠️ VOYAGER LIFECYCLE: forceInitBrowser did not create a valid webview in DOM');
          lifecycleLogger.warn('forceInitBrowser did not create a valid webview in DOM');
        }
      } catch (error) {
        console.log('❌ VOYAGER LIFECYCLE: Error in forceInitBrowser:', error.message);
        lifecycleLogger.error('Error in forceInitBrowser:', error);
      }
    } else {
      console.log('⚠️ VOYAGER LIFECYCLE: forceInitBrowser method not available');
      lifecycleLogger.warn('forceInitBrowser method not available');
    }
    
    // If we get here, all methods failed
    return false;
  };
  
  // Start the initialization process with multiple attempts
  const scheduleNextAttempt = () => {
    if (browser._webviewCreationAttempts >= browser._maxWebviewCreationAttempts) {
      console.log(`❌ VOYAGER LIFECYCLE: Failed to create webview after ${browser._maxWebviewCreationAttempts} attempts`);
      lifecycleLogger.error(`Failed to create webview after ${browser._maxWebviewCreationAttempts} attempts`);
      return;
    }
    
    // Calculate delay with backoff
    const delay = Math.min(100 * Math.pow(1.5, browser._webviewCreationAttempts), 2000);
    
    console.log(`🔄 VOYAGER LIFECYCLE: Scheduling next webview creation attempt in ${delay}ms`);
    lifecycleLogger.info(`Scheduling next webview creation attempt in ${delay}ms`);
    
    // Schedule next attempt with a delay
    setTimeout(() => {
      // Check if component is still mounted before next attempt
      if (!browser._isUnloading && browser.state?.isMounted) {
        const result = attemptWebviewCreation();
        
        // If failed, schedule next attempt
        if (!result) {
          scheduleNextAttempt();
        }
      } else {
        console.log('🔄 VOYAGER LIFECYCLE: Component unmounted during webview creation retry, aborting');
        lifecycleLogger.info('Component unmounted during webview creation retry, aborting');
      }
    }, delay);
  };
  
  // Start first attempt with a short initial delay
  console.log('🚀 VOYAGER LIFECYCLE: Starting webview creation sequence...');
  lifecycleLogger.info('Starting webview creation sequence...');
  setTimeout(() => {
    console.log('🚀 VOYAGER LIFECYCLE: Executing first webview creation attempt now');
    const result = attemptWebviewCreation();
    
    // If first attempt fails, start retry sequence
    if (!result) {
      console.log('🔄 VOYAGER LIFECYCLE: First attempt failed, scheduling retry sequence');
      scheduleNextAttempt();
    }
  }, 50); // Reduced initial delay for faster startup
  
  console.log('🏁 VOYAGER LIFECYCLE: Voyager browser initialization sequence started');
  lifecycleLogger.info('Voyager browser initialization complete');
}

/**
 * Initialize sub-managers for the Voyager browser
 * 
 * @param {Object} browser - Voyager browser instance
 */
function initializeManagers(browser) {
  lifecycleLogger.debug('Initializing managers for browser', browser.browserId);
  
  // Initialize tab manager if available
  if (browser.tabManager && typeof browser.tabManager.initialize === 'function') {
    lifecycleLogger.debug('Initializing tab manager');
    browser.tabManager.initialize();
  } else {
    lifecycleLogger.debug('Tab manager not available or missing initialize method');
  }
  
  // Initialize history manager if available
  if (browser.historyManager && typeof browser.historyManager.initialize === 'function') {
    lifecycleLogger.debug('Initializing history manager');
    browser.historyManager.initialize();
  } else {
    lifecycleLogger.debug('History manager not available or missing initialize method');
  }
  
  // Initialize bookmark manager if available
  if (browser.bookmarkManager && typeof browser.bookmarkManager.initialize === 'function') {
    lifecycleLogger.debug('Initializing bookmark manager');
    browser.bookmarkManager.initialize();
  } else {
    lifecycleLogger.debug('Bookmark manager not available or missing initialize method');
  }
  
  // Initialize settings manager if available
  if (browser.settingsManager && typeof browser.settingsManager.initialize === 'function') {
    lifecycleLogger.debug('Initializing settings manager');
    browser.settingsManager.initialize();
  } else {
    lifecycleLogger.debug('Settings manager not available or missing initialize method');
  }
  
  lifecycleLogger.debug('All managers initialized');
}

/**
 * Set up event handlers for browser operations
 * 
 * @param {Object} browser - Voyager browser instance
 */
function setupEventHandlers(browser) {
  lifecycleLogger.debug('Setting up event handlers for browser', browser.browserId);
  
  // List of event handlers to bind
  const handlersToCheck = [
    'handleLoadStart', 'handleLoadStop', 'handleLoadFinish', 'handleDomReady',
    'handleLoadError', 'handleWebviewLoad', 'handleDidNavigate', 'handleDidNavigateInPage',
    'handleWillNavigate', 'handleTitleUpdate', 'handleFaviconUpdate', 'handleConsoleMessage',
    'handleIpcMessage', 'handleNewWindow'
  ];
  
  // Bind event handlers to the browser instance
  // This ensures 'this' refers to the browser component
  let boundCount = 0;
  let missingCount = 0;
  
  handlersToCheck.forEach(handlerName => {
    if (browser[handlerName] && typeof browser[handlerName] === 'function') {
      lifecycleLogger.debug(`Binding event handler: ${handlerName}`);
      browser[handlerName] = browser[handlerName].bind(browser);
      boundCount++;
    } else {
      lifecycleLogger.debug(`Event handler not found or not a function: ${handlerName}`);
      missingCount++;
    }
  });
  
  lifecycleLogger.info(`Event handler setup complete. Bound: ${boundCount}, Missing: ${missingCount}`);
}

/**
 * Add global window event listeners
 * 
 * @param {Object} browser - Voyager browser instance
 */
function addWindowListeners(browser) {
  lifecycleLogger.debug('Adding window event listeners for browser', browser.browserId);
  
  // Store references to bound handlers for later cleanup
  browser._boundWindowHandlers = {};
  
  // Handle beforeunload to save state
  browser._boundWindowHandlers.beforeunload = () => {
    lifecycleLogger.debug('Window beforeunload event - saving browser state');
    saveState(browser);
  };
  window.addEventListener('beforeunload', browser._boundWindowHandlers.beforeunload);
  
  // Handle resize to adjust layout
  browser._boundWindowHandlers.resize = () => {
    lifecycleLogger.debug('Window resize event detected');
    if (browser.handleResize && typeof browser.handleResize === 'function') {
      browser.handleResize();
    }
  };
  window.addEventListener('resize', browser._boundWindowHandlers.resize);
  
  lifecycleLogger.debug('Window event listeners added successfully');
}

/**
 * Set up periodic tasks for the browser
 * 
 * @param {Object} browser - Voyager browser instance
 * @returns {Object} Object containing interval IDs for cleanup
 */
function setupPeriodicTasks(browser) {
  lifecycleLogger.debug('Setting up periodic tasks for browser', browser.browserId);
  
  const tasks = {};
  
  // Save state periodically (every 30 seconds)
  tasks.saveState = setInterval(() => {
    lifecycleLogger.debug('Periodic state save (30s interval)');
    saveState(browser);
  }, 30000);
  
  // Update active status (every 5 seconds)
  tasks.updateActiveStatus = setInterval(() => {
    lifecycleLogger.debug('Periodic active status update (5s interval)');
    if (browser.updateActiveStatus && typeof browser.updateActiveStatus === 'function') {
      browser.updateActiveStatus();
    }
  }, 5000);
  
  lifecycleLogger.debug('Periodic tasks set up successfully');
  return tasks;
}

/**
 * Save browser state for persistence
 * 
 * @param {Object} browser - Voyager browser instance
 */
function saveState(browser) {
  if (!browser || !browser.state) {
    lifecycleLogger.warn('Cannot save state - browser or browser.state is null');
    return;
  }
  
  // Create snapshot of important state
  const stateSnapshot = {
    url: browser.state.url,
    title: browser.state.title,
    favicon: browser.state.favicon,
    lastActive: Date.now()
  };
  
  lifecycleLogger.debug('Saving browser state snapshot', {
    url: stateSnapshot.url,
    title: stateSnapshot.title,
    timestamp: new Date(stateSnapshot.lastActive).toISOString()
  });
  
  // Save state to local storage or other persistence mechanism
  if (browser.saveStateToStorage && typeof browser.saveStateToStorage === 'function') {
    lifecycleLogger.debug('Using custom saveStateToStorage function');
    browser.saveStateToStorage(stateSnapshot);
  } else {
    try {
      // Fallback to localStorage if no custom handler
      lifecycleLogger.debug('Using localStorage fallback for state storage');
      localStorage.setItem('voyager-browser-state', JSON.stringify(stateSnapshot));
      lifecycleLogger.debug('State saved successfully to localStorage');
    } catch (err) {
      lifecycleLogger.warn('Failed to save browser state:', err);
    }
  }
}

/**
 * Clean up browser resources when unmounting
 * 
 * @param {Object} browser - Voyager browser instance
 */
export function cleanup(browser) {
  lifecycleLogger.info('Cleaning up Voyager browser component', browser.browserId);
  
  // CRITICAL FIX: Reset browser state tracking first
  resetBrowserState(browser);
  
  // Clean up window event listeners
  if (browser._boundWindowHandlers) {
    lifecycleLogger.debug('Removing window event listeners');
    Object.keys(browser._boundWindowHandlers).forEach(eventName => {
      lifecycleLogger.debug(`Removing ${eventName} event listener`);
      window.removeEventListener(eventName, browser._boundWindowHandlers[eventName]);
    });
    browser._boundWindowHandlers = null;
  }
  
  // Clear all intervals
  if (browser._periodicTasks) {
    lifecycleLogger.debug('Clearing interval tasks');
    Object.entries(browser._periodicTasks).forEach(([taskName, intervalId]) => {
      lifecycleLogger.debug(`Clearing interval: ${taskName}`);
      clearInterval(intervalId);
    });
    browser._periodicTasks = null;
  }
  
  // Clear any navigation timeouts
  if (browser._navigationTimeout) {
    lifecycleLogger.debug('Clearing navigation timeout');
    clearTimeout(browser._navigationTimeout);
    browser._navigationTimeout = null;
  }
  
  // Clear any style check timeouts
  if (browser._styleCheckTimeouts) {
    lifecycleLogger.debug(`Clearing ${browser._styleCheckTimeouts.length} style check timeouts`);
    browser._styleCheckTimeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    browser._styleCheckTimeouts = null;
  }
  
  // Clear any load detection intervals
  if (browser._loadDetectionInterval) {
    lifecycleLogger.debug('Clearing load detection interval');
    clearInterval(browser._loadDetectionInterval);
    browser._loadDetectionInterval = null;
  }
  
  // Reset initialization flags
  browser._isWebviewInitialized = false;
  browser._webviewCreationAttempts = 0;
  browser._lifecycleRetryCount = 0;
  
  // Clean up webview
  lifecycleLogger.debug('Cleaning up webview');
  cleanupWebview(browser);
  
  // Remove ExtractorManager reference
  if (browser.extractorManager) {
    lifecycleLogger.debug('Removing ExtractorManager reference');
    browser.extractorManager = null;
  }
  
  // Clean up researcher mode if active
  if (browser.isResearchModeActive && browser.isResearchModeActive()) {
    lifecycleLogger.debug('Cleaning up researcher mode');
    if (browser.cleanupResearcher && typeof browser.cleanupResearcher === 'function') {
      browser.cleanupResearcher();
    }
  }
  
  // Save final state
  lifecycleLogger.debug('Saving final state before complete cleanup');
  saveState(browser);
  
  lifecycleLogger.info('Voyager browser cleanup complete');
}

/**
 * Clean up webview/iframe resources
 * 
 * @param {Object} browser - Voyager browser instance
 */
function cleanupWebview(browser) {
  lifecycleLogger.debug('Cleaning up webview resources for browser', browser.browserId);
  
  // Clean up webview if it exists
  if (browser.webview) {
    lifecycleLogger.debug('Webview found, cleaning up event listeners and DOM element');
    
    // Get information about webview before cleanup for debugging
    let webviewInfo = {
      id: browser.webview.id || 'no-id',
      src: browser.webview.getAttribute('src') || 'no-src',
      inDOM: !!browser.webview.parentNode
    };
    lifecycleLogger.debug('Webview details before cleanup:', webviewInfo);
    
    // List of event names to remove
    const eventNames = [
      'did-start-loading', 'did-stop-loading', 'did-finish-load', 
      'dom-ready', 'did-fail-load', 'did-navigate', 'did-navigate-in-page',
      'will-navigate', 'page-title-updated', 'page-favicon-updated',
      'console-message', 'ipc-message', 'new-window'
    ];
    
    // Map of event names to handler methods
    const eventHandlers = {
      'did-start-loading': browser.handleLoadStart,
      'did-stop-loading': browser.handleLoadStop,
      'did-finish-load': browser.handleLoadFinish,
      'dom-ready': browser.handleDomReady,
      'did-fail-load': browser.handleLoadError,
      'did-navigate': browser.handleDidNavigate,
      'did-navigate-in-page': browser.handleDidNavigateInPage,
      'will-navigate': browser.handleWillNavigate,
      'page-title-updated': browser.handleTitleUpdate,
      'page-favicon-updated': browser.handleFaviconUpdate,
      'console-message': browser.handleConsoleMessage,
      'ipc-message': browser.handleIpcMessage,
      'new-window': browser.handleNewWindow
    };
    
    // Remove all event listeners
    eventNames.forEach(eventName => {
      const handler = eventHandlers[eventName];
      if (handler) {
        try {
          lifecycleLogger.debug(`Removing '${eventName}' event listener`);
          browser.webview.removeEventListener(eventName, handler);
        } catch (err) {
          lifecycleLogger.warn(`Error removing '${eventName}' event listener:`, err.message);
        }
      }
    });
    
    // Stop loading and destroy webview if possible
    try {
      lifecycleLogger.debug('Stopping webview loading');
      if (typeof browser.webview.stop === 'function') {
        browser.webview.stop();
      }
      
      // Remove the webview from DOM if possible
      if (browser.webview.parentNode) {
        lifecycleLogger.debug('Removing webview from DOM');
        browser.webview.parentNode.removeChild(browser.webview);
      } else {
        lifecycleLogger.debug('Webview not in DOM, nothing to remove');
      }
      
      // Clear reference
      lifecycleLogger.debug('Clearing webview reference');
      browser.webview = null;
    } catch (err) {
      lifecycleLogger.warn('Error during webview cleanup:', err);
    }
  } else {
    lifecycleLogger.debug('No webview found, skipping webview cleanup');
  }
  
  // Clean up iframe if it exists
  if (browser.iframe) {
    lifecycleLogger.debug('Iframe found, cleaning up event listeners and DOM element');
    
    // Remove event listeners
    if (browser.handleWebviewLoad) {
      lifecycleLogger.debug('Removing load event listener from iframe');
      browser.iframe.removeEventListener('load', browser.handleWebviewLoad);
    }
    
    // Remove error listeners
    lifecycleLogger.debug('Removing error event listener from iframe');
    browser.iframe.removeEventListener('error', () => {});
    
    // Remove the iframe from DOM if possible
    if (browser.iframe.parentNode) {
      lifecycleLogger.debug('Removing iframe from DOM');
      browser.iframe.parentNode.removeChild(browser.iframe);
    } else {
      lifecycleLogger.debug('Iframe not in DOM, nothing to remove');
    }
    
    // Clear source
    try {
      lifecycleLogger.debug('Clearing iframe source');
      browser.iframe.src = 'about:blank';
    } catch (err) {
      lifecycleLogger.warn('Error clearing iframe source:', err);
    }
    
    // Clear reference
    lifecycleLogger.debug('Clearing iframe reference');
    browser.iframe = null;
  } else {
    lifecycleLogger.debug('No iframe found, skipping iframe cleanup');
  }
}

export default {
  initialize,
  cleanup,
  resetBrowserState
};

// Also add CommonJS style exports for compatibility
if (typeof module !== 'undefined' && module.exports) {
  console.error('🚨 EXTREME DEBUG: Setting up CommonJS exports for VoyagerLifecycle');
  try {
    module.exports = {
      initialize,
      cleanup,
      resetBrowserState,
      default: {
        initialize,
        cleanup,
        resetBrowserState
      }
    };
    console.error('🚨 EXTREME DEBUG: CommonJS exports complete for VoyagerLifecycle');
  } catch (err) {
    console.error('🚨 EXTREME DEBUG: Error in CommonJS exports setup:', err);
  }
} 