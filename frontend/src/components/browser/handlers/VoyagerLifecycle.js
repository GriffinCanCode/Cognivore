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
export function resetBrowserState(browser) {
  if (browser && browser.browserId) {
    browserStateTracker.delete(browser.browserId);
    lifecycleLogger.debug(`Reset browser state for ID: ${browser.browserId}`);
    
    // CRITICAL FIX: Also reset lifecycle flags to ensure clean remount
    if (browser._lifecycleInitialized) {
      browser._lifecycleInitialized = false;
      lifecycleLogger.debug(`Reset lifecycle initialization flag for browser ${browser.browserId}`);
    }
  }
}

/**
 * Initialize the Voyager browser component
 * 
 * @param {Object} browser - Voyager browser instance
 * @param {Object} options - Initialization options
 */
export function initialize(browser, options = {}) {
  console.log('🚨 EXTREME DEBUG: VoyagerLifecycle.initialize FUNCTION ENTRY POINT');
  
  console.log('🔍 VOYAGER LIFECYCLE: initializing browser ID:', browser.browserId);
  lifecycleLogger.info('Initializing Voyager browser ID:', browser.browserId);
  
  // Extract options with defaults
  const { 
    forceStateReset = false, 
    skipWebviewCreation = false,
    delayWebviewCreation = false 
  } = options;
  
  console.log('🚨 EXTREME DEBUG: Browser state and DOM readiness check');
  
  // Comprehensive state and DOM readiness check
  const isContainerReady = browser.containerRef && 
                          browser.containerRef.current && 
                          browser.containerRef.current.isConnected &&
                          document.contains(browser.containerRef.current);
                          
  const isBrowserReady = browser.state && 
                        browser.state.isMounted === true &&
                        !browser._isUnloading;
  
  console.log('🔍 VOYAGER LIFECYCLE: DOM and state status:', {
    hasContainer: !!browser.containerRef,
    hasContainerCurrent: !!(browser.containerRef && browser.containerRef.current),
    isContainerConnected: browser.containerRef?.current?.isConnected || false,
    isContainerInDOM: browser.containerRef?.current ? document.contains(browser.containerRef.current) : false,
    hasBrowserState: !!browser.state,
    isMounted: browser.state?.isMounted || false,
    isUnloading: browser._isUnloading || false,
    forceStateReset,
    skipWebviewCreation,
    containerReady: isContainerReady,
    browserReady: isBrowserReady
  });
  
  // Enhanced readiness validation
  if (!isContainerReady) {
    lifecycleLogger.warn('Container not ready for browser initialization');
    console.log('⚠️ VOYAGER LIFECYCLE: Container not ready, aborting initialization');
    return;
  }
  
  if (!isBrowserReady) {
    lifecycleLogger.warn('Browser state not ready for initialization');
    console.log('⚠️ VOYAGER LIFECYCLE: Browser state not ready, aborting initialization');
    return;
  }
  
  // CRITICAL FIX: EXTENDED React reconciliation delay to prevent ALL DOM insertion conflicts
  // This prevents conflicts between multiple React roots and webview creation
  const waitForCompleteReactStabilization = () => {
    return new Promise((resolve) => {
      // Use MUCH longer delay sequence to ensure ALL React operations are complete
      const stabilizationSteps = [
        () => requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Wait for React to completely finish all operations
              setTimeout(() => {
                // Additional delay to ensure no pending React work
                setTimeout(() => {
                  // Final delay to ensure DOM is completely stable
                  setTimeout(resolve, 50);
                }, 50);
              }, 100);
            });
          });
        })
      ];
      
      stabilizationSteps[0]();
    });
  };
  
  console.log('🚨 EXTREME DEBUG: Initializing browser state');
  console.log('🔍 VOYAGER LIFECYCLE: Initializing browser state (fresh or forced)');
  
  // Initialize browser state
  if (forceStateReset || !browser._lifecycleInitialized || browser._wasUnmounted) {
    lifecycleLogger.debug('Initializing fresh browser state');
    
    // CRITICAL FIX: If this is a remount after unmount, force complete reset
    if (browser._wasUnmounted) {
      console.log('🔍 VOYAGER LIFECYCLE: Detected remount after unmount, forcing complete state reset');
      lifecycleLogger.debug('Forcing complete state reset for remounted browser');
      
      // Clear any stale state from previous mount
      browser._isWebviewInitialized = false;
      browser._webviewCreationAttempts = 0;
      browser._lifecycleRetryCount = 0;
      browser._lifecycleInitialized = false;
      
      // Clear any stale references
      browser.webview = null;
      browser.iframe = null;
      browser.webviewContainer = null;
    }
    
    // Reset all initialization tracking
    browser._isWebviewInitialized = false;
    browser._webviewCreationAttempts = 0;
    browser._maxWebviewCreationAttempts = 5;
    browser._lifecycleRetryCount = 0;
    browser._lifecycleInitialized = true;
    
    // CRITICAL FIX: Only set defer flag if not already handling a remount
    if (!browser._wasUnmounted) {
      browser._deferReactRendering = true;
    } else {
      // For remounts, start with React rendering enabled to avoid conflicts
      browser._deferReactRendering = false;
      console.log('🔍 VOYAGER LIFECYCLE: Remount detected - React rendering enabled immediately');
    }
    
    // Clear any existing timeouts
    if (browser._navigationTimeout) {
      clearTimeout(browser._navigationTimeout);
      browser._navigationTimeout = null;
    }
    
    if (browser._loadDetectionInterval) {
      clearInterval(browser._loadDetectionInterval);
      browser._loadDetectionInterval = null;
    }
    
    if (browser._styleCheckTimeouts) {
      browser._styleCheckTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
      browser._styleCheckTimeouts = [];
    } else {
      browser._styleCheckTimeouts = [];
    }
    
    // Initialize periodic tasks
    console.log('🔍 VOYAGER LIFECYCLE: Setting up periodic tasks');
    browser._periodicTasks = setupPeriodicTasks(browser);
    
    lifecycleLogger.debug('Browser state initialized successfully');
  }
  
  console.log('🔍 VOYAGER LIFECYCLE: Initializing sub-managers');
  initializeManagers(browser);
  
  console.log('🔍 VOYAGER LIFECYCLE: Setting up event handlers');
  setupEventHandlers(browser);
  
  console.log('🔍 VOYAGER LIFECYCLE: Added ExtractorManager to browser instance');
  // Add ExtractorManager instance to browser for content extraction
  browser.extractorManager = ExtractorManager;
  
  console.log('🔍 VOYAGER LIFECYCLE: Adding window event listeners');
  addWindowListeners(browser);
  
  // CRITICAL FIX: Wait for COMPLETE React stabilization before ANY DOM operations
  waitForCompleteReactStabilization().then(() => {
    console.log('🔍 VOYAGER LIFECYCLE: Complete React stabilization achieved, proceeding with ALL operations');
    
    // PHASE 1: Create webview first (if not skipping)
    if (!skipWebviewCreation) {
      console.log('🔍 VOYAGER LIFECYCLE: Phase 1 - Creating webview');
      createWebviewWithTiming(browser, delayWebviewCreation).then(() => {
        console.log('🔍 VOYAGER LIFECYCLE: Webview creation completed, proceeding to React rendering');
        
        // PHASE 2: Now it's safe to create React components
        initializeReactComponents(browser);
        
      }).catch(error => {
        console.error('🔍 VOYAGER LIFECYCLE: Error in webview creation:', error);
        // Still try React components even if webview fails
        initializeReactComponents(browser);
      });
    } else {
      console.log('🔍 VOYAGER LIFECYCLE: Skipping webview creation, proceeding to React rendering');
      // Skip webview but still initialize React components
      initializeReactComponents(browser);
    }
  }).catch(error => {
    console.error('🔍 VOYAGER LIFECYCLE: Error during React stabilization:', error);
    
    // Fallback: proceed anyway but with additional delay
    setTimeout(() => {
      if (!browser._isUnloading && browser.state?.isMounted) {
        createWebviewWithTiming(browser, true).then(() => {
          initializeReactComponents(browser);
        }).catch(() => {
          initializeReactComponents(browser);
        });
      }
    }, 200);
  });
  
  console.log('🏁 VOYAGER LIFECYCLE: Voyager browser initialization sequence started');
  lifecycleLogger.info('Voyager browser initialization complete');
}

/**
 * Initialize React components after main browser setup is complete
 * This prevents React root conflicts during initial setup
 * @param {Object} browser - Voyager browser instance
 */
function initializeReactComponents(browser) {
  console.log('🔍 VOYAGER LIFECYCLE: Initializing React components after main setup');
  
  try {
    // CRITICAL FIX: Clean up any placeholders before enabling React rendering
    if (browser._tabManagerPlaceholder && browser._tabManagerPlaceholder.parentNode) {
      console.log('🔍 VOYAGER LIFECYCLE: Removing TabManagerButton placeholder');
      browser._tabManagerPlaceholder.parentNode.removeChild(browser._tabManagerPlaceholder);
      browser._tabManagerPlaceholder = null;
    }
    
    // Remove the defer flag AFTER cleaning up placeholders
    browser._deferReactRendering = false;
    console.log('🔍 VOYAGER LIFECYCLE: React rendering enabled, defer flag removed');
    
    // Initialize TabBar React rendering if setup function exists
    if (browser._setupTabBarReactRendering && typeof browser._setupTabBarReactRendering === 'function') {
      console.log('🔍 VOYAGER LIFECYCLE: Setting up TabBar React rendering');
      try {
        browser._setupTabBarReactRendering();
      } catch (err) {
        console.error('🔍 VOYAGER LIFECYCLE: Error setting up TabBar React rendering:', err);
      }
    }
    
    // Now it's safe to render TabBar if render function exists
    if (browser._renderTabBar && typeof browser._renderTabBar === 'function') {
      console.log('🔍 VOYAGER LIFECYCLE: Rendering TabBar React component');
      try {
        browser._renderTabBar();
      } catch (err) {
        console.error('🔍 VOYAGER LIFECYCLE: Error rendering TabBar:', err);
      }
    }
    
    // Initialize TabManagerButton if needed
    if (browser._initializeTabManagerButton && typeof browser._initializeTabManagerButton === 'function') {
      console.log('🔍 VOYAGER LIFECYCLE: Initializing TabManagerButton React component');
      try {
        browser._initializeTabManagerButton();
      } catch (err) {
        console.error('🔍 VOYAGER LIFECYCLE: Error initializing TabManagerButton:', err);
        // Create fallback button if React rendering fails
        createFallbackTabManagerButton(browser);
      }
    }
    
    // Initialize any other deferred React components
    if (browser._setupDeferredReactComponents && typeof browser._setupDeferredReactComponents === 'function') {
      console.log('🔍 VOYAGER LIFECYCLE: Setting up other deferred React components');
      try {
        browser._setupDeferredReactComponents();
      } catch (err) {
        console.error('🔍 VOYAGER LIFECYCLE: Error setting up other deferred React components:', err);
      }
    }
    
    console.log('🔍 VOYAGER LIFECYCLE: React component initialization complete');
    
  } catch (error) {
    console.error('🔍 VOYAGER LIFECYCLE: Error initializing React components:', error);
    
    // Create fallback UI if React components fail
    createFallbackUI(browser);
  }
}

/**
 * Create fallback UI when React components fail
 * @param {Object} browser - Voyager browser instance
 */
function createFallbackUI(browser) {
  console.log('🔍 VOYAGER LIFECYCLE: Creating fallback UI for React component failures');
  
  try {
    // Find tab bar container and create basic tab if React failed
    const tabBarContainer = browser.containerRef.current?.querySelector('.voyager-tab-bar-react-container');
    if (tabBarContainer && !tabBarContainer.hasChildNodes()) {
      const fallbackTab = document.createElement('div');
      fallbackTab.className = 'tab-item active fallback';
      fallbackTab.innerHTML = `<span>🌐 Browser</span>`;
      fallbackTab.style.cssText = `
        display: flex; align-items: center; height: 32px; padding: 0 10px;
        background: rgba(37, 99, 235, 0.25); border-radius: 8px 8px 0 0;
        margin: 4px; color: white; font-size: 12px;
      `;
      tabBarContainer.appendChild(fallbackTab);
    }
  } catch (error) {
    console.warn('🔍 VOYAGER LIFECYCLE: Error creating fallback UI:', error);
  }
}

/**
 * Create webview with proper timing to avoid React conflicts
 * @param {Object} browser - Voyager browser instance
 * @param {boolean} forceDelay - Whether to force additional delay
 * @returns {Promise} Promise that resolves when webview creation is complete
 */
function createWebviewWithTiming(browser, forceDelay = false) {
  // Return a Promise for proper sequencing
  return new Promise((resolve, reject) => {
    // Calculate delay based on whether we need extra time
    const baseDelay = forceDelay ? 200 : 50;
    
    console.log('🚀 VOYAGER LIFECYCLE: Starting webview creation sequence...');
    lifecycleLogger.info('Starting webview creation sequence...');
    
    // CRITICAL FIX: Add error boundary around webview creation
    const createWebviewSafely = () => {
      try {
        // Double-check component is still mounted before proceeding
        if (browser._isUnloading || !browser.state?.isMounted) {
          console.log('🔍 VOYAGER LIFECYCLE: Component unmounted before webview creation, aborting');
          reject(new Error('Component unmounted during webview creation'));
          return false;
        }
        
        // Verify container is still available and connected
        if (!browser.containerRef?.current?.isConnected) {
          console.log('🔍 VOYAGER LIFECYCLE: Container no longer connected, aborting webview creation');
          reject(new Error('Container no longer connected'));
          return false;
        }
        
        return attemptWebviewCreation();
      } catch (error) {
        console.error('🔍 VOYAGER LIFECYCLE: Error in createWebviewSafely:', error);
        lifecycleLogger.error('Error in createWebviewSafely:', error);
        reject(error);
        return false;
      }
    };
    
    // The actual webview creation function with retry logic
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
          resolve(); // Resolve the Promise on success
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
            resolve(); // Resolve the Promise on success
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
            resolve(); // Resolve the Promise on success
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
        reject(new Error(`Failed to create webview after ${browser._maxWebviewCreationAttempts} attempts`));
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
          reject(new Error('Component unmounted during retry'));
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
    }, baseDelay);
  });
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
    lastActive: Date.now(),
    browserId: browser.browserId
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
      localStorage.setItem(`voyager-browser-state-${browser.browserId}`, JSON.stringify(stateSnapshot));
      lifecycleLogger.debug('State saved successfully to localStorage');
    } catch (err) {
      lifecycleLogger.warn('Failed to save browser state:', err);
    }
  }
  
  // Trigger data preservation system if available
  if (window.dataPreservationManager && window.dataPreservationManager.isInitialized) {
    try {
      // Trigger preservation of browser state and related data
      window.dataPreservationManager.preserveAllData({
        source: 'voyager-lifecycle',
        priority: 'normal'
      }).catch(error => {
        lifecycleLogger.warn('Data preservation failed during state save:', error);
      });
    } catch (error) {
      lifecycleLogger.warn('Error triggering data preservation:', error);
    }
  }
}

/**
 * Clean up browser resources when unmounting
 * 
 * @param {Object} browser - Voyager browser instance
 */
export async function cleanup(browser) {
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
  
  // Save final state and trigger comprehensive data preservation
  lifecycleLogger.debug('Saving final state before complete cleanup');
  saveState(browser);
  
  // Trigger final data preservation if available
  if (window.dataPreservationManager && window.dataPreservationManager.isInitialized) {
    try {
      lifecycleLogger.debug('Triggering final data preservation during browser cleanup');
      await window.dataPreservationManager.preserveAllData({
        source: 'voyager-cleanup',
        priority: 'critical',
        synchronous: true
      });
      lifecycleLogger.debug('Final data preservation completed successfully');
    } catch (error) {
      lifecycleLogger.warn('Final data preservation failed during cleanup:', error);
    }
  }
  
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
      inDOM: !!browser.webview.parentNode,
      isConnected: browser.webview.isConnected || false,
      hasGetWebContentsId: typeof browser.webview.getWebContentsId === 'function'
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
    
    // CRITICAL FIX: Only attempt webview operations if it's properly attached and ready
    const isWebviewOperational = browser.webview.isConnected && 
                                 browser.webview.parentNode &&
                                 document.contains(browser.webview) &&
                                 typeof browser.webview.getWebContentsId === 'function';
    
    if (isWebviewOperational) {
      try {
        // Test if webview is actually ready for operations
        const webContentsId = browser.webview.getWebContentsId();
        lifecycleLogger.debug(`Webview is operational (WebContents ID: ${webContentsId}), attempting graceful stop`);
        
        if (typeof browser.webview.stop === 'function') {
          browser.webview.stop();
          lifecycleLogger.debug('Webview stopped successfully');
        }
      } catch (stopError) {
        // This is the error we're trying to fix - webview operations on detached elements
        lifecycleLogger.warn('Error during webview cleanup:', stopError);
        console.log('Webview stop failed (expected if detached):', stopError.message);
      }
    } else {
      lifecycleLogger.debug('Webview not operational, skipping stop operation', {
        isConnected: browser.webview.isConnected,
        hasParent: !!browser.webview.parentNode,
        inDocument: browser.webview.parentNode ? document.contains(browser.webview) : false,
        hasGetWebContentsId: typeof browser.webview.getWebContentsId === 'function'
      });
    }
    
    // Remove the webview from DOM if possible
    try {
      if (browser.webview.parentNode && document.contains(browser.webview)) {
        lifecycleLogger.debug('Removing webview from DOM');
        browser.webview.parentNode.removeChild(browser.webview);
        lifecycleLogger.debug('Webview removed from DOM successfully');
      } else {
        lifecycleLogger.debug('Webview not in DOM or no parent, skipping DOM removal');
      }
    } catch (removeErr) {
      lifecycleLogger.warn('Error removing webview from DOM:', removeErr);
    }
    
    // Clear reference
    lifecycleLogger.debug('Clearing webview reference');
    browser.webview = null;
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

/**
 * Create fallback TabManagerButton when React rendering fails
 * @param {Object} browser - Voyager browser instance
 */
function createFallbackTabManagerButton(browser) {
  console.log('🔍 VOYAGER LIFECYCLE: Creating fallback TabManagerButton');
  
  try {
    // Find action buttons container
    const actionButtonsContainer = browser.containerRef.current?.querySelector('.browser-action-buttons');
    if (!actionButtonsContainer) {
      console.warn('🔍 VOYAGER LIFECYCLE: No action buttons container found for fallback TabManagerButton');
      return;
    }
    
    // Create fallback button
    const fallbackButton = document.createElement('button');
    fallbackButton.className = 'tab-manager-button fallback';
    fallbackButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>
    `;
    fallbackButton.style.cssText = `
      display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;
      background: transparent; border: none; border-radius: 4px; cursor: pointer;
      color: #cccccc; margin: 0 4px; transition: all 0.2s ease;
    `;
    
    // Add click handler
    fallbackButton.addEventListener('click', () => {
      console.log('Fallback TabManagerButton clicked');
      // Open simple tab list or create new tab
      if (browser && typeof browser.handleNewTab === 'function') {
        browser.handleNewTab();
      }
    });
    
    // Add hover effects
    fallbackButton.addEventListener('mouseenter', () => {
      fallbackButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      fallbackButton.style.color = '#ffffff';
    });
    
    fallbackButton.addEventListener('mouseleave', () => {
      fallbackButton.style.backgroundColor = 'transparent';
      fallbackButton.style.color = '#cccccc';
    });
    
    actionButtonsContainer.appendChild(fallbackButton);
    browser._fallbackTabManagerButton = fallbackButton;
    
    console.log('🔍 VOYAGER LIFECYCLE: Fallback TabManagerButton created successfully');
    
  } catch (error) {
    console.error('🔍 VOYAGER LIFECYCLE: Error creating fallback TabManagerButton:', error);
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