/**
 * Voyager - Modern Embedded Browser Component for Electron
 * 
 * Features:
 * - Secure content rendering in isolated context
 * - Memory management for browsing history
 * - Extraction and processing of page content
 * - Mobile-friendly browsing UI with navigation controls
 */

import React, { Component } from 'react';
import { nanoid } from 'nanoid';
import DOMPurify from 'dompurify';

// Import tab management system
import VoyagerTabManager from './tabs/VoyagerTabManager';
import TabManagerButton from './tabs/TabManagerButton';

// Import browser component utilities
import { 
  detectEnvironment,
  formatUrl,
  applySiteSpecificSettings
} from './utils/BrowserUtilities';

// Use centralized handlers from the index file
import { 
  ErrorHandler, 
  EventHandlers, 
  HistoryService,
  initBrowserHandlers 
} from './handlers/index.js';

// Import StyleManager for consistent style handling
import StyleManager from './handlers/StyleManager';

import {
  handleBookmarkCreation,
} from './utils/BookmarkManager';

import {
  renderHtml,
} from './renderers/ContentRenderer';

// Import from specialized renderers for proper separation of concerns
import { setupCompleteBrowserLayout } from './renderers/BrowserLayoutManager';
import { updateAddressBar } from './renderers/AddressBarRenderer';
import { updateLoadingControls } from './renderers/NavigationControlsRenderer';
import { createWebview, enforceWebviewStyles } from './renderers/BrowserRenderer';

import { toggleReaderMode, setReaderMode, getReaderMode, isReaderModeActive as checkReaderModeActive } from './handlers/ReaderModeManager';
import ExtractorManager from './extraction/ExtractorManager';
import WorkerManager from './utils/WorkerManager';
import cssLoader from '../../utils/cssLoader';

// Import specific event handlers
const { 
  handleLoadStart, 
  handleLoadStop, 
  handlePageNavigation, 
  handleWebviewLoad, 
  handleWebviewError,
  updateNavigationButtons
} = EventHandlers;

// Initialize the worker system as early as possible
const initWorkerSystem = () => {
  // Set initial state while we attempt initialization
  if (!WorkerManager.isInitializing) {
    WorkerManager.isInitializing = true;
    WorkerManager.initAttempts = 0;
    WorkerManager.isAvailable = false;
    WorkerManager.isInitialized = false;
    
    // Initialize storage for webview references
    if (!WorkerManager.webviewRef) {
      WorkerManager.webviewRef = null;
      WorkerManager.hasWebview = false;
    }
    
    // Add utility method to update webview references
    if (typeof WorkerManager.updateWebviewReference !== 'function') {
      WorkerManager.updateWebviewReference = function(webview) {
        if (webview) {
          this.webviewRef = webview;
          this.hasWebview = true;
          console.log('Worker system webview reference updated');
          return true;
        }
        return false;
      };
    }
  }
  
  // Find all webviews in the document and use the first valid one for worker system
  try {
    if (!WorkerManager.webviewRef) {
      const allWebviews = document.querySelectorAll('webview');
      if (allWebviews.length > 0) {
        for (let i = 0; i < allWebviews.length; i++) {
          if (allWebviews[i].isConnected || document.contains(allWebviews[i])) {
            console.log('Found connected webview in document, storing reference');
            WorkerManager.webviewRef = allWebviews[i];
            WorkerManager.hasWebview = true;
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error finding webview references:', err);
  }
  
  // Prevent excessive init attempts
  WorkerManager.initAttempts = (WorkerManager.initAttempts || 0) + 1;
  if (WorkerManager.initAttempts > 3) {
    console.warn(`Worker system initialization failed after ${WorkerManager.initAttempts} attempts, using fallback extraction`);
    WorkerManager.isInitializing = false;
    WorkerManager.isAvailable = false;
    WorkerManager.isInitialized = false;
    return;
  }

  console.log(`Attempting worker system initialization (attempt #${WorkerManager.initAttempts})`);
  
  // First check if WorkerManager already has initialize method
  if (!WorkerManager || typeof WorkerManager.initialize !== 'function') {
    console.error('WorkerManager not available or missing initialize method - checking for global version');
    
    // Try to find WorkerManager in global scope
    if (window.WorkerManager && typeof window.WorkerManager.initialize === 'function') {
      console.log('Found WorkerManager in global scope, using window.WorkerManager');
      // Use the global WorkerManager and make it available in the current scope
      window.WorkerManager = window.WorkerManager;
    } else {
      console.error('No WorkerManager available in any scope, worker system unavailable');
      WorkerManager.isInitializing = false;
      WorkerManager.isAvailable = false;
      WorkerManager.isInitialized = false;
      return;
    }
  }
  
  // Track initialization time for debugging
  const startTime = Date.now();
  
  // Initialize with enhanced error handling
  try {
    const initPromise = WorkerManager.initialize();
    
    // Ensure we have a valid promise
    if (!initPromise || typeof initPromise.then !== 'function') {
      console.error('WorkerManager.initialize did not return a valid promise');
      WorkerManager.isInitializing = false;
      WorkerManager.isAvailable = false;
      WorkerManager.isInitialized = false;
      return;
    }
    
    initPromise.then(success => {
      const initTime = Date.now() - startTime;
      console.log(`Worker system initialization ${success ? 'succeeded' : 'failed'} in ${initTime}ms`);
      
      // Set global flags for worker availability
      WorkerManager.isAvailable = success;
      WorkerManager.isInitialized = success;
      WorkerManager.initialized = success;
      WorkerManager.available = success;
      WorkerManager.isInitializing = false;
      
      // Log initialization details
      console.log('Worker system status:', {
        isAvailable: WorkerManager.isAvailable,
        isInitialized: WorkerManager.isInitialized,
        hasExecuteTask: typeof WorkerManager.executeTask === 'function',
        hasWebviewRef: Boolean(WorkerManager.webviewRef)
      });
      
      // If initialization succeeded, try to register content extraction handler
      if (success && typeof WorkerManager.registerHandler === 'function') {
        try {
          WorkerManager.registerHandler('extract-content', (url, options) => {
            console.log('Worker handling content extraction for', url);
            
            // Use the stored webview reference if possible
            if (WorkerManager.webviewRef && typeof WorkerManager.webviewRef.executeJavaScript === 'function') {
              return WorkerManager.webviewRef.executeJavaScript(`
                (function() {
                  try {
                    return {
                      title: document.title || 'Unknown Page',
                      url: window.location.href,
                      html: document.documentElement.outerHTML || '',
                      text: document.body ? document.body.innerText : '',
                      success: true
                    };
                  } catch (e) {
                    return { error: e.message, success: false };
                  }
                })()
              `);
            }
            
            // Implementation would go here
            return { success: true, url, content: 'Content extracted by worker' };
          });
          console.log('Successfully registered extract-content handler');
        } catch (regError) {
          console.warn('Failed to register extract-content handler:', regError);
        }
      }
      
      // If initialization failed, try again with a delay
      if (!success && WorkerManager.initAttempts < 3) {
        console.log(`Scheduling worker system retry in ${WorkerManager.initAttempts * 1000}ms`);
        setTimeout(initWorkerSystem, WorkerManager.initAttempts * 1000);
      }
    }).catch(err => {
      console.error('Worker system initialization error:', err);
      
      // Ensure the availability flag is set to false on error
      WorkerManager.isAvailable = false;
      WorkerManager.isInitialized = false;
      WorkerManager.initialized = false;
      WorkerManager.available = false;
      WorkerManager.isInitializing = false;
      
      // Try again with a delay if we haven't exceeded retry attempts
      if (WorkerManager.initAttempts < 3) {
        console.log(`Scheduling worker system retry after error in ${WorkerManager.initAttempts * 1000}ms`);
        setTimeout(initWorkerSystem, WorkerManager.initAttempts * 1000);
      } else {
        console.error('Worker system initialization failed after all retry attempts');
      }
    });
  } catch (initError) {
    console.error('Critical error during worker system initialization:', initError);
    WorkerManager.isInitializing = false;
    WorkerManager.isAvailable = false;
    WorkerManager.isInitialized = false;
  }
};

// Call initialization with a timeout to ensure it completes
setTimeout(initWorkerSystem, 500);

// Setting up a cache for content extraction
const extractionCache = new Map();

// Add a helper function to check if workers are available
const isWorkerSystemAvailable = (instance) => {
  // First check if WorkerManager is available and initialized
  const workerAvailable = WorkerManager && 
         typeof WorkerManager === 'object' &&
         (WorkerManager.isInitialized === true || WorkerManager.initialized === true) && 
         (WorkerManager.isAvailable === true || WorkerManager.available === true) && 
         typeof WorkerManager.executeTask === 'function';
  
  // If instance is provided, check if webview and URL are available
  if (instance && workerAvailable) {
    // Check for the webview in multiple places to improve reliability
    const instanceWebview = instance.webview || 
                          (instance.webviewContainer && instance.webviewContainer.querySelector('webview')) ||
                          WorkerManager.webviewRef;
    
    // Mark the existence of webview directly in the WorkerManager object for future checks
    if (instanceWebview && !WorkerManager.webviewRef) {
      WorkerManager.webviewRef = instanceWebview;
      WorkerManager.hasWebview = true;
    }
    
    const webviewAvailable = instanceWebview && 
           (instanceWebview.isConnected || instanceWebview._isAttached || document.contains(instanceWebview)) && 
           instance.state && 
           instance.state.url;
           
    if (!webviewAvailable) {
      console.log('Webview not available for worker-based extraction:', {
        hasWebview: Boolean(instanceWebview),
        isConnected: instanceWebview?.isConnected,
        isAttached: instanceWebview?._isAttached,
        isInDOM: instanceWebview ? document.contains(instanceWebview) : false,
        hasState: Boolean(instance.state),
        hasURL: Boolean(instance.state?.url),
        managerHasWebview: Boolean(WorkerManager.webviewRef)
      });
    }
    
    return webviewAvailable;
  }
  
  // Debug log to help troubleshoot worker availability issues
  if (!workerAvailable && instance) {
    console.log('Worker system not available:', {
      hasWorkerManager: Boolean(WorkerManager),
      isObject: typeof WorkerManager === 'object',
      isInitialized: WorkerManager?.isInitialized || WorkerManager?.initialized,
      isAvailable: WorkerManager?.isAvailable || WorkerManager?.available,
      hasExecuteTask: typeof WorkerManager?.executeTask === 'function'
    });
  }
  
  return workerAvailable;
};

/**
 * Safe wrapper for calling applyAllCriticalStyles on webview
 * @param {HTMLElement} webview - The webview element
 * @param {boolean} show - Whether to show or hide the webview
 * @returns {boolean} Success state
 */
function safeApplyCriticalStyles(webview, show = true) {
  if (!webview) return false;
  
  try {
    // First try to use StyleManager's safeApplyStyles method
    try {
      const StyleManager = require('./handlers/StyleManager').default;
      if (StyleManager && typeof StyleManager.safeApplyStyles === 'function') {
        return StyleManager.safeApplyStyles(webview, show);
      }
    } catch (styleManagerError) {
      console.warn('StyleManager not available:', styleManagerError);
    }
    
    // If StyleManager fails, ensure the method exists via direct approach
    if (typeof webview.applyAllCriticalStyles !== 'function') {
      // Try to add the method for better resilience
      webview.applyAllCriticalStyles = function(showParam) {
        if (showParam) {
          // Apply comprehensive styling directly 
          this.style.cssText = `
            visibility: visible !important;
            opacity: 1 !important;
            display: flex !important;
            position: absolute !important;
            z-index: 10 !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
            overflow: hidden !important; 
            pointer-events: auto !important;
          `;
          
          // Force a DOM reflow to ensure styles are applied
          void this.offsetHeight;
        } else {
          this.style.visibility = 'hidden';
          this.style.opacity = '0';
        }
        return true;
      };
    }
    
    // Now call the method if it exists
    if (typeof webview.applyAllCriticalStyles === 'function') {
      return webview.applyAllCriticalStyles(show);
    } else {
      // Manual fallback if method couldn't be added
      if (show) {
        webview.style.cssText = `
          visibility: visible !important;
          opacity: 1 !important;
          display: flex !important;
          position: absolute !important;
          z-index: 10 !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
          background-color: white !important;
          overflow: hidden !important;
          pointer-events: auto !important;
        `;
        
        // Force a DOM reflow to ensure styles are applied
        void webview.offsetHeight;
      } else {
        webview.style.visibility = 'hidden';
        webview.style.opacity = '0';
      }
      return true;
    }
  } catch (err) {
    console.error('Error applying critical styles:', err);
    
    // Final fallback - direct style setting
    try {
      if (show) {
        // Apply minimum needed styles to ensure visibility
        webview.style.visibility = 'visible';
        webview.style.opacity = '1';
        webview.style.display = 'flex';
        webview.style.zIndex = '10';
      } else {
        webview.style.visibility = 'hidden';
        webview.style.opacity = '0';
      }
      return true;
    } catch (finalErr) {
      console.error('Final fallback for critical styles failed:', finalErr);
      return false;
    }
  }
}

class Voyager extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      url: props?.initialUrl || 'https://www.google.com',
      title: 'Loading...',
      isLoading: false,
      history: [],
      historyPosition: -1,
      errorState: null, // Tracks error state for rendering error pages via ErrorHandler
      viewMode: 'browser', // 'browser', 'reader', 'split'
      readerContent: null,
      bookmarks: [],
      // Track if the component is mounted
      isMounted: false,
      // Environment detection results
      environment: detectEnvironment(),
      // Research mode state - explicitly set to false to prevent toggle issues
      researchMode: false
    };
    
    // Create unique ID for component
    this.browserId = nanoid();
    
    // References
    this.containerRef = React.createRef();
    this.webview = null;
    this.iframe = null;
    this.addressInput = null;
    this.researcher = null;
    
    // Initialize tab manager
    this.tabManager = null;
    
    // Create research panel reference if it doesn't exist
    this.researchPanel = document.createElement('div');
    this.researchPanel.className = 'browser-research-panel hidden'; // Start hidden
    
    // Ensure research panel is added to the DOM immediately
    document.body.appendChild(this.researchPanel);
    
    // Track if we've already done the initial navigation
    this.hasNavigatedInitially = false;
    
    // Track if the component has been initialized
    this._isInitialized = false;
    
    // Bind methods
    this.navigate = this.navigate.bind(this);
    this.refreshPage = this.refreshPage.bind(this);
    this.stopLoading = this.stopLoading.bind(this);
    this.handleAddressSubmit = this.handleAddressSubmit.bind(this);
    this.handleAddressChange = this.handleAddressChange.bind(this);
    this.handleWebviewLoad = this.handleWebviewLoad.bind(this);
    this.capturePageContent = this.capturePageContent.bind(this);
    this.toggleReaderMode = this.toggleReaderMode.bind(this);
    this.toggleResearchMode = this.toggleResearchMode.bind(this);
    this.isResearchModeActive = this.isResearchModeActive.bind(this);
    this.savePage = this.savePage.bind(this);
    this.addBookmark = this.addBookmark.bind(this);
    this.extractPageContent = this.extractPageContent.bind(this);
    this.initialize = this.initialize.bind(this);
    this.initializeResearcher = this.initializeResearcher.bind(this);
    this.cleanup = this.cleanup.bind(this);
    this.extractPageContentWithWorker = this.extractPageContentWithWorker.bind(this);
    this.preloadPageResources = this.preloadPageResources.bind(this);
    this.processPageInParallel = this.processPageInParallel.bind(this);
    this.enhanceExtractedContent = this.enhanceExtractedContent.bind(this);
  }
  
  componentDidMount() {
    console.log(`Voyager browser component mounted (ID: ${this.browserId})`);
    
    // Set isMounted state to enable rendering of child components
    this.setState({
      isMounted: true
    }, () => {
      // Initialize immediately with simplified logic
      this.initialize();
    });
  }
  
  componentWillUnmount() {
    this._isUnloading = true;
    this.cleanup();
    
    // Set isMounted to false to prevent any further state updates
    this.setState({
      isMounted: false
    });
  }
  
  componentDidUpdate(prevProps) {
    // Handle URL updates from parent component
    if (this.props && prevProps && 
        prevProps.initialUrl !== this.props.initialUrl && 
        this.props.initialUrl && 
        this.props.initialUrl !== 'about:blank') {
      this.navigate(this.props.initialUrl);
    }
  }
  
  /**
   * Update the page title
   * @param {string} title - The page title to set
   */
  updatePageTitle(title) {
    // Update state
    this.setState({ title });
    
    // Update document title if needed
    if (this.props && this.props.updateDocumentTitle && title) {
      document.title = title;
    }
    
    // Note: Page title management is now handled directly in this component
    // No need to delegate to BrowserRenderer since title updates are simple
  }
  
  /**
   * Navigate to a URL
   * @param {string} url - URL to navigate to
   */
  navigate(url) {
    if (!url) return;
    
    // Clear any existing navigation timeouts
    if (this._navigationTimeout) {
      clearTimeout(this._navigationTimeout);
      this._navigationTimeout = null;
    }
    
    // Format the URL (add protocol if needed)
    const formattedUrl = formatUrl(url);
    
    // Store the original URL for logging
    const originalUrl = url;
    
    console.log(`Navigating from "${originalUrl}" to formatted URL: "${formattedUrl}"`);
    
    // Apply site-specific settings
    applySiteSpecificSettings(formattedUrl, this.webview);
    
    // Update state
    this.setState({ 
      url: formattedUrl,
      isLoading: true,
      errorState: null
    });
    
    // Update address bar display
    updateAddressBar(this, formattedUrl);
    
    // Update loading indicator
    updateLoadingControls(this, true);
    
    // Set current URL for tracking
    this.currentUrl = formattedUrl;
    
    // Create a more reliable navigation timeout with progressive fallbacks
    // Start with a longer timeout period (8 seconds instead of 5)
    const navigationTimeoutPeriod = 8000;
    
    this._navigationTimeout = setTimeout(() => {
      console.log('Navigation timeout reached, hiding loading content');
      
      // Set a flag that we're handling a timeout
      this._handlingNavigationTimeout = true;
      
      // Check if we need to handle the timeout (if page is not already loaded)
      if (this.state.isLoading) {
        // First, try to see if the page actually loaded despite not triggering load events
        this.checkIfPageIsLoaded(() => {
          // If checking loaded state didn't resolve the issue, show a message
          if (this.state.isLoading && this._handlingNavigationTimeout) {
            // Update loading state to help UI recover
            this.setState({ isLoading: false });
            updateLoadingControls(this, false);
            
            // Try a fallback approach - sometimes the load event doesn't fire
            if (this.webview) {
              try {
                // For webview implementations, try to force completion
                if (this.webview.tagName.toLowerCase() === 'webview') {
                  // Apply full styles to ensure visibility
                  if (typeof this.webview.applyAllCriticalStyles === 'function') {
                    this.webview.applyAllCriticalStyles(true);
                  }
                  
                  // Make sure webview is visible
                  this.webview.style.visibility = 'visible';
                  this.webview.style.opacity = '1';
                  this.webview.readyToShow = true;
                  
                  // Update UI to reflect completion
                  updateLoadingControls(this, false);
                  
                  // Try to gracefully extract information from the page
                  if (typeof this.webview.executeJavaScript === 'function') {
                    this.webview.executeJavaScript(`
                      {
                        title: document.title || 'Unknown Page',
                        url: window.location.href,
                        loaded: true
                      }
                    `).then(result => {
                      if (result) {
                        console.log('Retrieved page info despite timeout:', result);
                        
                        // Update title if available
                        if (result.title) {
                          this.setState({ title: result.title });
                          this.updatePageTitle(result.title);
                        }
                        
                        // Capture content if possible
                        this.capturePageContent();
                      }
                    }).catch(err => {
                      console.warn('Failed to get page info after timeout:', err);
                    });
                  }
                }
              } catch (err) {
                console.warn('Error recovering from navigation timeout:', err);
              }
            }
          }
        });
      }
    }, navigationTimeoutPeriod);
    
    // Navigate based on implementation type
    if (this.webview && this.state.environment.webviewImplementation === 'webview') {
      try {
        console.log(`🌐 Navigating webview to: ${formattedUrl}`);
        this.webview.src = formattedUrl;
        
        // Set up redundant load detection for better reliability
        this.setupRedundantLoadDetection(formattedUrl);
      } catch (err) {
        console.error('WebView navigation error:', err);
        renderErrorPage(this, {
          code: 'NAV_ERROR',
          url: formattedUrl,
          message: 'Failed to navigate: ' + err.message
        });
      }
    } else if (this.iframe) {
      try {
        console.log(`🌐 Navigating iframe to: ${formattedUrl}`);
        // Handle navigation errors for iframes
        this.iframe.onload = this.handleWebviewLoad;
        this.iframe.onerror = (event) => {
          renderErrorPage(this, {
            code: 'IFRAME_LOAD_ERROR',
            url: formattedUrl,
            message: 'Failed to load content in iframe'
          });
        };
        this.iframe.src = formattedUrl;
      } catch (err) {
        console.error('iframe navigation error:', err);
        renderErrorPage(this, {
          code: 'NAV_ERROR',
          url: formattedUrl,
          message: 'Failed to navigate: ' + err.message
        });
      }
    } else {
      // Fallback renderer for when neither webview nor iframe is available
      renderHtml(this, `
        <div style="font-family: system-ui; padding: 20px; text-align: center;">
          <h2>Navigation Not Supported</h2>
          <p>This browser view cannot navigate directly to: ${formattedUrl}</p>
          <p>Please use an external browser or enable the internal browser view.</p>
          <a href="${formattedUrl}" target="_blank" rel="noopener noreferrer">Open in new window</a>
        </div>
      `);
    }
    
    // Update history using centralized HistoryService
    HistoryService.recordVisit(this, formattedUrl, this.state.title);
  }
  
  /**
   * Setup redundant load detection for more reliable navigation
   * @param {string} targetUrl - The URL being loaded
   */
  setupRedundantLoadDetection(targetUrl) {
    // We'll poll periodically to check if the page has navigated successfully
    // This works around cases where the load events don't fire properly
    
    // Clear any existing detection intervals
    if (this._loadDetectionInterval) {
      clearInterval(this._loadDetectionInterval);
    }
    
    // Start time for tracking duration
    const startTime = Date.now();
    const maxDetectionTime = 8000; // Max 8 seconds of detection
    
    // Use a relatively fast polling interval (250ms)
    this._loadDetectionInterval = setInterval(() => {
      // Check if we've been polling too long
      if (Date.now() - startTime > maxDetectionTime) {
        clearInterval(this._loadDetectionInterval);
        return;
      }
      
      // Skip checks if we're not loading anymore
      if (!this.state?.isLoading) {
        clearInterval(this._loadDetectionInterval);
        return;
      }
      
      // Call our check method
      this.checkIfPageIsLoaded();
    }, 250);
  }
  
  /**
   * Check if the page is actually loaded based on URL changes or other signals
   * @param {Function} callback - Optional callback after check completes
   */
  checkIfPageIsLoaded(callback) {
    if (!this.webview || !this.state?.isLoading) {
      if (callback) callback();
      return;
    }
    
    console.log('Checking if page is actually loaded despite missing events');
    
    try {
      // For webview, we'll use executeJavaScript to check current URL
      if (this.webview && this.webview.tagName?.toLowerCase() === 'webview' && 
          typeof this.webview.executeJavaScript === 'function') {
        
        this.webview.executeJavaScript(`
          {
            currentUrl: window.location.href,
            readyState: document.readyState,
            title: document.title
          }
        `).then(result => {
          if (!result) {
            if (callback) callback();
            return;
          }
          
          // Check if URL has changed, indicating successful navigation
          if (result.currentUrl && result.currentUrl !== 'about:blank' && 
              result.currentUrl !== this.currentUrl &&
              result.readyState === 'complete') {
            
            console.log(`Page appears to be loaded based on URL change: ${result.currentUrl}`);
            
            // Update title if available
            if (result.title) {
              this.setState({ title: result.title });
              this.updatePageTitle(result.title);
            }
            
            // Update loading state
            this.setState({ isLoading: false });
            updateLoadingControls(this, false);
            
            // Make webview fully visible
            if (this.webview) {
              safeApplyCriticalStyles(this.webview, true);
            }
            
            // Capture content
            this.capturePageContent();
            
            // Clear navigation timeout
            if (this._navigationTimeout) {
              clearTimeout(this._navigationTimeout);
              this._navigationTimeout = null;
              console.log('Navigation timeout cleared in checkIfPageIsLoaded');
            }
            
            // Clear detection interval
            if (this._loadDetectionInterval) {
              clearInterval(this._loadDetectionInterval);
              this._loadDetectionInterval = null;
            }
            
            // Clear handling timeout flag
            this._handlingNavigationTimeout = false;
          }
          
          if (callback) callback();
        }).catch(err => {
          console.warn('Error checking if page is loaded:', err);
          if (callback) callback();
        });
      } else if (callback) {
        callback();
      }
    } catch (err) {
      console.warn('Error in checkIfPageIsLoaded:', err);
      if (callback) callback();
    }
  }
  
  /**
   * Refresh the current page
   */
  refreshPage() {
    if (this.webview) {
      this.webview.reload();
    } else if (this.iframe) {
      this.iframe.src = this.iframe.src;
    }
    
    this.setState({ isLoading: true });
    updateLoadingControls(this, true);
  }
  
  /**
   * Handle refresh action (alias for refreshPage)
   * Used by BrowserRenderer.js
   */
  handleRefresh = () => {
    this.refreshPage();
  }
  
  /**
   * Stop loading the current page
   */
  stopLoading() {
    if (this.webview) {
      this.webview.stop();
    } else if (this.iframe) {
      // For iframe, we just update the UI state since we can't actually stop it
      this.setState({ isLoading: false });
      updateLoadingControls(this, false);
    }
  }
  
  /**
   * Handle submission of address bar input
   * @param {Event} event - Form submission event
   */
  handleAddressSubmit(event) {
    event.preventDefault();
    
    // Get URL from address input
    const url = this.addressInput ? this.addressInput.value.trim() : '';
    
    // Only navigate if URL is not empty
    if (url) {
      console.log('Navigating to URL from address bar:', url);
      
      // Update the address bar immediately to give user feedback
      if (this.addressInput) {
        this.addressInput.value = url;
      }
      
      // Call navigate with the user-entered URL
      this.navigate(url);
    }
  }
  
  /**
   * Handle changes to address bar input
   * @param {Event} event - Input change event
   */
  handleAddressChange(event) {
    // Store the current input value but don't navigate yet
    // Navigation happens on form submission
    const inputValue = event.target.value;
    
    // Track value change for immediate feedback
    this.setState({ typedUrlValue: inputValue });
    
    // This helps with proper state management
    if (this._lastTypedUrl !== inputValue) {
      this._lastTypedUrl = inputValue;
      console.log('Address bar input changed:', inputValue);
    }
  }
  
  /**
   * Apply webview styles safely without using return statements
   * @param {HTMLElement} webview - The webview element to style
   * @param {boolean} skipJavaScript - Skip JavaScript execution (for initial styling)
   */
  applyWebviewStyles(webview, skipJavaScript = false) {
    if (!webview) return false;
    
    try {
      // Apply direct CSS styles first - this is always safe
      webview.style.cssText = 'width:100%;height:100%;display:flex;flex:1;position:relative;overflow:hidden;visibility:visible;';
      webview.autosize = false;
      
      // Apply additional styles with a delay
      setTimeout(() => {
        try {
          if (webview && webview.isConnected) {
            webview.style.minHeight = '100%';
            webview.style.minWidth = '100%';
            
            // Force a layout recalculation
            void webview.offsetHeight;
            console.log('Successfully applied additional webview styles');
          }
        } catch (err) {
          console.error('Error applying additional styles:', err);
        }
      }, 200);
      
      // Skip JavaScript execution if requested or if webview isn't ready
      if (skipJavaScript) {
        return true;
      }
      
      // Check if webview is actually ready for JavaScript execution
      const isReady = webview.hasAttribute('data-dom-ready') || 
                      webview.dataset.domReady === 'true' ||
                      webview._domReady === true;
      
      // Apply content styling via executeJavaScript, but only if webview is fully ready
      if (isReady && typeof webview.executeJavaScript === 'function') {
        try {
          webview.executeJavaScript(`
            (function() {
              try {
                if (document && document.body) {
                  document.body.style.visibility = 'visible';
                  document.body.style.opacity = '1';
                  document.body.style.display = 'block';
                  console.log('Content styles applied successfully');
                }
              } catch (e) {
                console.error('Error applying content styles:', e);
              }
            })();
          `).catch(err => console.warn('Content style script error:', err));
        } catch (err) {
          // Handle errors without breaking the style application
          console.warn('Skipping JavaScript execution - webview not ready:', err.message);
        }
      } else if (typeof webview.executeJavaScript === 'function') {
        console.log('Skipping JavaScript execution - waiting for dom-ready event');
      }
      
      return true;
    } catch (err) {
      console.error('Error applying webview styles:', err);
      return false;
    }
  }

  /**
   * Handle webview/iframe load completion
   * @param {Event} event - Load event
   */
  handleWebviewLoad(event) {
    console.log('Webview loaded:', this.state.url);
    
    // CRITICAL FIX: Clear navigation timeout to prevent timeout message
    if (this._navigationTimeout) {
      clearTimeout(this._navigationTimeout);
      this._navigationTimeout = null;
      console.log('Navigation timeout cleared - page loaded successfully');
    }
    
    // Also clear any detection intervals
    if (this._loadDetectionInterval) {
      clearInterval(this._loadDetectionInterval);
      this._loadDetectionInterval = null;
    }
    
    // Clear handling timeout flag
    this._handlingNavigationTimeout = false;
    
    // Force loading state to false to ensure UI updates
    this.isLoading = false;
    
    // Update UI state
    this.setState({ isLoading: false });
    updateLoadingControls(this, false);
    
    // Update address bar with the actual URL from the webview
    try {
      if (this.webview && typeof this.webview.getURL === 'function') {
        const currentURL = this.webview.getURL();
        if (currentURL && currentURL !== 'about:blank') {
          // Update URL in state
          this.setState({ url: currentURL });
          
          // Update address bar input
          if (this.addressInput) {
            this.addressInput.value = currentURL;
          }
          
          // Update current URL tracking
          this.currentUrl = currentURL;
          
          console.log(`Address bar updated to actual URL: ${currentURL}`);
        }
      }
    } catch (error) {
      console.warn('Error updating address bar with actual URL:', error);
    }
    
    // Ensure webview is fully visible
    if (this.webview) {
      try {
        // Apply all webview styles using our new method
        this.applyWebviewStyles(this.webview);
        
        // Alternative style application for reliability
        if (typeof this.webview.applyAllCriticalStyles === 'function') {
          this.webview.applyAllCriticalStyles(true);
        } else {
          safeApplyCriticalStyles(this.webview, true);
        }
        
        // Double-check visibility with direct styling
        this.webview.style.visibility = 'visible';
        this.webview.style.opacity = '1';
        this.webview.style.display = 'flex';
        this.webview.style.zIndex = '10';
        
        // Force browser to recalculate webview layout
        void this.webview.offsetHeight;
        
        // Mark as ready to show for other components
        this.webview.readyToShow = true;
        
        console.log("Webview styles applied, content should be visible now");
      } catch (err) {
        console.warn('Error ensuring webview visibility:', err);
      }
    }
    
    // Preload page resources for better performance
    this.preloadPageResources().catch(err => {
      console.warn('Error preloading page resources:', err);
    });
    
    // Capture page content and title for memory
    this.capturePageContent().catch(err => {
      console.warn('Error in capturePageContent during load:', err);
    });
    
    // Add to browsing history using centralized HistoryService
    const historyRecord = HistoryService.createHistoryRecord(
      this.state.url, 
      this.state.title, 
      new Date().toISOString()
    );
    
    // Notify parent component if callback provided
    if (this.props && typeof this.props.onPageLoad === 'function') {
      this.props.onPageLoad(historyRecord);
    }
  }
  
  /**
   * Toggle reader mode
   */
  toggleReaderMode() {
    // Use the centralized ReaderModeManager
    const newMode = toggleReaderMode(this);
    console.log(`Reader mode toggled to: ${newMode}`);
    return newMode;
  }
  
  /**
   * Toggle research mode on/off
   * @returns {boolean} The new research mode state
   */
  toggleResearchMode() {
    console.log('Toggle research mode called');
    
    // Calculate the new state (prior to setting it)
    const newResearchMode = !this.state.researchMode;
    
    // Initialize researcher if needed
    if (newResearchMode && !this.researcher) {
      if (!this.initializeResearcher()) {
        console.error('Failed to initialize researcher component');
        return false;
      }
    }
    
    // Use the researcher component instance if available
    if (this.researcher && typeof this.researcher.toggleActive === 'function') {
      console.log('Delegating research mode toggle to Researcher component');
      
      // Prepare current page info for the researcher
      if (newResearchMode && this.webview) {
        try {
          // Capture the current page content for research context
          this.capturePageContent().then(content => {
            if (this.researcher && typeof this.researcher.processPage === 'function') {
              // Process the current page in the research panel
              this.researcher.processPage(this.state.url, this.state.title, content);
            }
          }).catch(err => {
            console.warn('Error capturing page content for research:', err);
          });
        } catch (err) {
          console.warn('Error preparing research content:', err);
        }
      }
      
      // Add body class for proper layout BEFORE toggling
      if (newResearchMode) {
        document.body.classList.add('research-panel-active');
        
        // Adjust the webview container width to make room for the panel
        const webviewContainer = this.containerRef.current?.querySelector('.voyager-browser-container');
        if (webviewContainer) {
          webviewContainer.style.width = 'calc(100% - 340px)';
          webviewContainer.style.transition = 'width 0.3s ease';
        }
      } else {
        document.body.classList.remove('research-panel-active');
        
        // Restore webview container width
        const webviewContainer = this.containerRef.current?.querySelector('.voyager-browser-container');
        if (webviewContainer) {
          webviewContainer.style.width = '100%';
        }
      }
      
      // Call the researcher's toggleActive method which will handle the UI
      const result = this.researcher.toggleActive();
      
      // Update our own state based on the result
      this.setState({ researchMode: result }, () => {
        console.log(`Research mode ${this.state.researchMode ? 'activated' : 'deactivated'}`);
        
        // Update the research button active state
        const researchBtn = this.containerRef.current?.querySelector('.browser-research-btn');
        if (researchBtn) {
          if (this.state.researchMode) {
            researchBtn.classList.add('active');
            researchBtn.title = 'Research mode active';
          } else {
            researchBtn.classList.remove('active');
            researchBtn.title = 'Toggle research mode';
          }
        }
      });
      
      return result;
    } else {
      console.error('Researcher component not available or missing toggleActive method');
      return false;
    }
  }
  
  /**
   * Check if research mode is active
   * @returns {boolean} True if research mode is active
   */
  isResearchModeActive() {
    return this.state && this.state.researchMode === true;
  }
  
  /**
   * Save the current page to the knowledge base
   * @returns {Promise<Object>} Promise resolving to the saved page data
   */
  savePage() {
    return new Promise((resolve, reject) => {
      try {
        // Show visual feedback on the save button first
        const saveBtn = this.containerRef.current?.querySelector('.browser-save-btn');
        if (saveBtn) {
          saveBtn.classList.add('loading');
        }
        
        // Capture the page content first
        this.capturePageContent()
          .then(content => {
            // Notify parent component if callback provided
            if (this.props && this.props.onSavePage) {
              this.props.onSavePage(content)
                .then(result => {
                  if (saveBtn) saveBtn.classList.remove('loading');
                  resolve(result);
                })
                .catch(err => {
                  if (saveBtn) saveBtn.classList.remove('loading');
                  reject(err);
                });
            } else {
              // Format page data for storage
              const pageData = {
                url: this.state?.url || '',
                title: this.state?.title || 'Untitled Page',
                content: content || this.state?.readerContent || '',
                savedAt: new Date().toISOString()
              };
              
              // Use LLM service if available
              if (window.server && window.server.savePageToKnowledgeBase) {
                window.server.savePageToKnowledgeBase(pageData)
                  .then(result => {
                    if (saveBtn) saveBtn.classList.remove('loading');
                    
                    // Show success notification
                    try {
                      const { showToastNotification } = require('./renderers/BrowserRenderer');
                      if (typeof showToastNotification === 'function') {
                        showToastNotification('Page saved to knowledge base!');
                      }
                    } catch (err) {
                      console.warn('Could not show save notification:', err);
                    }
                    
                    resolve(result);
                  })
                  .catch(err => {
                    if (saveBtn) saveBtn.classList.remove('loading');
                    
                    // Show error notification
                    try {
                      const { showToastNotification } = require('./renderers/BrowserRenderer');
                      if (typeof showToastNotification === 'function') {
                        showToastNotification('Failed to save page: ' + (err.message || 'Unknown error'), 'error');
                      }
                    } catch (notifyErr) {
                      console.warn('Could not show error notification:', notifyErr);
                    }
                    
                    reject(err);
                  });
              } else {
                // If no IPC handler is available
                if (saveBtn) saveBtn.classList.remove('loading');
                
                // Show notification that the page was saved locally
                try {
                  const { showToastNotification } = require('./renderers/BrowserRenderer');
                  if (typeof showToastNotification === 'function') {
                    showToastNotification('Page saved locally (no knowledge base available)');
                  }
                } catch (err) {
                  console.warn('Could not show notification:', err);
                }
                
                // Resolve with the page data if no server method is available
                resolve(pageData);
              }
            }
          })
          .catch(err => {
            console.error('Error capturing page content:', err);
            
            // Remove loading state from button
            if (saveBtn) saveBtn.classList.remove('loading');
            
            // Show error notification
            try {
              const { showToastNotification } = require('./renderers/BrowserRenderer');
              if (typeof showToastNotification === 'function') {
                showToastNotification('Error capturing page content: ' + (err.message || 'Unknown error'), 'error');
              }
            } catch (notifyErr) {
              console.warn('Could not show error notification:', notifyErr);
            }
            
            reject(err);
          });
      } catch (err) {
        console.error('Error saving page:', err);
        
        // Reset button state
        const saveBtn = this.containerRef.current?.querySelector('.browser-save-btn');
        if (saveBtn) saveBtn.classList.remove('loading');
        
        reject(err);
      }
    });
  }
  
  /**
   * Add the current page as a bookmark
   * @returns {Object} The bookmark data
   */
  addBookmark() {
    try {
      // Ensure nanoid is available
      let uniqueId;
      try {
        const { nanoid } = require('nanoid');
        uniqueId = nanoid();
      } catch (e) {
        // Fallback to a simple unique ID if nanoid isn't available
        uniqueId = `bookmark_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      
      // Create bookmark data
      const bookmarkData = {
        id: uniqueId,
        url: this.state?.url || window.location.href,
        title: this.state?.title || document.title || 'Bookmarked Page',
        createdAt: new Date().toISOString()
      };
      
      // Add to state
      this.setState(prevState => ({
        bookmarks: [...(prevState.bookmarks || []), bookmarkData]
      }));
      
      // Try to call handleBookmarkCreation from BookmarkManager if available
      try {
        const { handleBookmarkCreation } = require('./utils/BookmarkManager');
        if (typeof handleBookmarkCreation === 'function') {
          handleBookmarkCreation(this, bookmarkData);
        }
      } catch (err) {
        console.warn('Could not import BookmarkManager:', err);
      }
      
      // Notify parent component if callback provided
      if (this.props && this.props.onBookmarkAdded) {
        this.props.onBookmarkAdded(bookmarkData);
      }
      
      // Show visual feedback
      const bookmarkBtn = this.containerRef.current?.querySelector('.browser-bookmark-btn');
      if (bookmarkBtn) {
        bookmarkBtn.classList.add('active');
        // Animate the button
        bookmarkBtn.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(1.3)' },
          { transform: 'scale(1)' }
        ], {
          duration: 400,
          easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        });
      }
      
      // Show a toast notification
      try {
        const { showToastNotification } = require('./renderers/BrowserRenderer');
        if (typeof showToastNotification === 'function') {
          showToastNotification('Page bookmarked');
        }
      } catch (err) {
        console.warn('Could not show bookmark notification:', err);
      }
      
      return bookmarkData;
    } catch (err) {
      console.error('Error adding bookmark:', err);
      return null;
    }
  }
  
  /**
   * Extract content from the current page for research
   * @returns {Promise<Object>} Promise resolving to the extracted content
   */
  extractPageContent() {
    // If researcher component is available, use it
    if (this.researcher) {
      return this.researcher.processPage(this.state.url, this.state.title);
    } else {
      console.error('Researcher component not available. Cannot extract content.');
      return Promise.reject(new Error('Researcher component not available'));
    }
  }
  
  /**
   * Capture page content using optimized worker-based extraction
   * @returns {Promise<Object>} Promise resolving to the captured content
   */
  capturePageContent() {
    // Check if we have this URL cached and it's recent (last 5 minutes)
    const cacheKey = this.state?.url || '';
    const cachedResult = extractionCache.get(cacheKey);
    
    if (cachedResult && 
        (Date.now() - cachedResult.timestamp) < 5 * 60 * 1000) {
      console.log('Using cached extraction result for:', cacheKey);
      return Promise.resolve(cachedResult.data);
    }
    
    // Get webview reference from multiple sources
    const webview = this.webview || 
                  (this.webviewContainer && this.webviewContainer.querySelector('webview')) ||
                  WorkerManager.webviewRef;
    
    // Store webview reference in WorkerManager if available
    if (webview && !WorkerManager.webviewRef) {
      console.log('Storing webview reference in WorkerManager during capturePageContent');
      WorkerManager.webviewRef = webview;
      WorkerManager.hasWebview = true;
    }
    
    // Log webview status for debugging
    const isWebviewAvailable = webview && 
      (webview.isConnected || webview._isAttached || document.contains(webview));
      
    // Check worker system availability
    const workerSystemAvailable = WorkerManager && 
      (WorkerManager.isInitialized === true || WorkerManager.initialized === true) && 
      (WorkerManager.isAvailable === true || WorkerManager.available === true) && 
      typeof WorkerManager.executeTask === 'function';
      
    // Log combined status
    console.log('Extraction status:', {
      webviewAvailable: isWebviewAvailable,
      workerSystemAvailable: workerSystemAvailable,
      url: this.state?.url || 'unknown'
    });
    
    // First try to use enhanced worker extraction if worker system is available
    if (isWorkerSystemAvailable(this)) {
      return this.extractPageContentWithWorker()
        .then(result => {
          // Cache successful results
          if (result && !result.error && cacheKey) {
            extractionCache.set(cacheKey, {
              data: result,
              timestamp: Date.now()
            });
            
            // Cleanup old cache entries if cache gets too large
            if (extractionCache.size > 50) {
              const oldestUrl = [...extractionCache.entries()]
                .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
              extractionCache.delete(oldestUrl);
            }
          }
          return result;
        })
        .catch(error => {
          console.error('Worker extraction error:', error);
          
          // Fall back to ExtractorManager
          return this.fallbackExtraction();
        });
    } else {
      // Try direct DOM extraction before falling back to ExtractorManager
      if (isWebviewAvailable && webview && typeof webview.executeJavaScript === 'function') {
        console.log('Attempting direct DOM extraction before falling back');
        
        return new Promise((resolve, reject) => {
          webview.executeJavaScript(`
            (function() {
              try {
                return {
                  title: document.title || 'Unknown Page',
                  url: window.location.href,
                  html: document.documentElement.outerHTML || '',
                  text: document.body ? document.body.innerText : '',
                  extracted: true,
                  method: 'direct-dom'
                };
              } catch (e) {
                return { error: e.message || 'Error extracting content' };
              }
            })()
          `)
            .then(result => {
              if (result && !result.error) {
                console.log('Direct DOM extraction successful');
                resolve({
                  title: result.title,
                  url: result.url || this.state?.url,
                  text: result.text || '',
                  processedContent: result.html || '',
                  timestamp: new Date().toISOString(),
                  extractionMethod: 'direct-dom'
                });
              } else {
                console.warn('Direct DOM extraction failed:', result.error);
                reject(new Error(result.error || 'Direct extraction failed'));
              }
            })
            .catch(err => {
              console.warn('Error in direct DOM extraction:', err);
              reject(err);
            });
        })
          .catch(error => {
            console.warn('Direct extraction failed, falling back to ExtractorManager:', error);
            return this.fallbackExtraction();
          });
      }
      
      // Skip worker extraction attempt if worker system is not available
      console.log('Worker system not available, using fallback extraction directly');
      return this.fallbackExtraction();
    }
  }
  
  /**
   * Enhanced worker-based content extraction 
   * @returns {Promise<Object>} Promise resolving to extracted content
   */
  extractPageContentWithWorker() {
    return new Promise((resolve, reject) => {
      // First check if worker system is actually available with this instance
      if (!isWorkerSystemAvailable(this)) {
        // Immediately reject so we can fall back to alternative methods
        return reject(new Error('Worker system not available or initialization failed'));
      }

      // Get the webview reference from multiple places to improve reliability
      const webview = this.webview || 
                    (this.webviewContainer && this.webviewContainer.querySelector('webview')) ||
                    WorkerManager.webviewRef;
                    
      // Store the webview reference in WorkerManager for future use
      if (webview && !WorkerManager.webviewRef) {
        WorkerManager.webviewRef = webview;
        WorkerManager.hasWebview = true;
        console.log('Stored webview reference in WorkerManager');
      }
                    
      // Check webview availability with more thorough validation
      if (!webview || !(webview.isConnected || webview._isAttached || document.contains(webview)) || !this.state?.url) {
        console.log('Webview validation failed:', {
          hasWebview: Boolean(webview),
          isConnected: webview?.isConnected,
          isAttached: webview?._isAttached,
          isInDOM: webview ? document.contains(webview) : false,
          hasState: Boolean(this.state),
          hasURL: Boolean(this.state?.url)
        });
        return reject(new Error('No webview or URL available for extraction'));
      }
      
      // Log successful webview detection
      console.log('Using webview for content extraction from:', this.state.url);
      
      // Get HTML content from the webview
      try {
        // Double check the webview is still connected and ready
        if (webview && (webview.isConnected || webview._isAttached || document.contains(webview)) && 
            typeof webview.executeJavaScript === 'function') {
          // First try to get document content using a more robust approach that catches potential DOM errors
          webview.executeJavaScript(`
            (function() {
              try {
                // Check if document is actually accessible
                if (!document || !document.documentElement) {
                  return { error: "Document not accessible" };
                }
                
                // Try to get the HTML content
                return document.documentElement.outerHTML || document.documentElement.innerHTML;
              } catch (e) {
                return { error: "Error accessing document: " + (e.message || "Unknown error") };
              }
            })()
          `)
            .then(html => {
              // Check if we got an error object instead of HTML
              if (typeof html === 'object' && html && html.error) {
                throw new Error(html.error);
              }
              
              // Check if we have valid HTML content
              if (!html || typeof html !== 'string' || html.length < 100) {
                throw new Error('Failed to get valid HTML content from webview');
              }
              
              console.log('Executing worker-based DOM processing');
              
              // Use the worker to process the HTML content
              return WorkerManager.executeTask('process-dom', {
                html,
                url: this.state.url,
                options: {
                  clean: true,
                  extractMain: true,
                  extractHeadings: true,
                  extractLinks: true,
                  extractMetadata: true
                }
              });
            })
            .then(result => {
              if (!result || result.error) {
                throw new Error(result?.error || 'Failed to process content in worker');
              }
              
              // Enhance the content with additional processing
              return this.enhanceExtractedContent(result);
            })
            .then(enhancedResult => {
              // Process the content in parallel for further enhancements
              this.processPageInParallel(enhancedResult)
                .catch(err => console.warn('Parallel processing error (non-blocking):', err));
              
              // Return the enhanced result
              resolve(enhancedResult);
            })
            .catch(error => {
              console.warn('Worker-based extraction failed:', error);
              reject(error);
            });
        } else {
          reject(new Error('Webview not ready for content extraction'));
        }
      } catch (err) {
        console.warn('Error in extractPageContentWithWorker:', err);
        reject(err);
      }
    });
  }
  
  /**
   * Enhance extracted content with additional metadata and formatting
   * @param {Object} content - Raw extracted content
   * @returns {Promise<Object>} Enhanced content
   */
  enhanceExtractedContent(content) {
    return new Promise((resolve, reject) => {
      // Use the worker to enhance the content if possible
      if (isWorkerSystemAvailable(this)) {
        WorkerManager.executeTask('enhance-content', { content })
          .then(enhancedContent => {
            resolve({
              title: enhancedContent.title || content.title || this.state?.title || 'Untitled Page',
              url: enhancedContent.url || content.url || this.state?.url || '',
              text: enhancedContent.text || content.text || '',
              processedContent: enhancedContent.html || content.html || content.text || '',
              timestamp: enhancedContent.timestamp || new Date().toISOString(),
              extractionMethod: 'worker-enhanced',
              extractionTime: enhancedContent.extractionTime || content.extractionTime || 0,
              estimatedReadingTime: enhancedContent.estimatedReadingTime || 0,
              headings: enhancedContent.headings || content.headings || [],
              links: enhancedContent.links || content.links || [],
              metadata: enhancedContent.metadata || content.metadata || {}
            });
          })
          .catch(error => {
            console.warn('Worker-based enhancement failed:', error);
            // Fall back to basic formatting
            resolve({
              title: content.title || this.state?.title || 'Untitled Page',
              url: content.url || this.state?.url || '',
              text: content.text || '',
              processedContent: content.html || content.text || '',
              timestamp: content.timestamp || new Date().toISOString(),
              extractionMethod: content.extractionMethod || 'worker',
              extractionTime: content.extractionTime || 0
            });
          });
      } else {
        // Without worker, just format the content
        resolve({
          title: content.title || this.state?.title || 'Untitled Page',
          url: content.url || this.state?.url || '',
          text: content.text || '',
          processedContent: content.html || content.text || '',
          timestamp: content.timestamp || new Date().toISOString(),
          extractionMethod: content.extractionMethod || 'direct',
          extractionTime: content.extractionTime || 0
        });
      }
    });
  }
  
  /**
   * Process page content in parallel for additional analysis
   * This happens in the background and doesn't block the main extraction
   * @param {Object} content - Initially extracted content
   * @returns {Promise<Object>} Promise resolving to processed content
   */
  processPageInParallel(content) {
    // Skip if no worker system or no content
    if (!isWorkerSystemAvailable(this) || !content) {
      return Promise.resolve(content);
    }
    
    return new Promise((resolve, reject) => {
      // Create an array of worker tasks to execute in parallel
      const tasks = [
        // Process text for readability metrics
        WorkerManager.executeTask('process-text', { 
          text: content.text,
          options: { calculateReadability: true } 
        }),
        
        // Extract links with additional metadata
        WorkerManager.executeTask('extract-links', { 
          html: content.processedContent,
          url: content.url 
        }),
        
        // Process metadata for better article understanding
        WorkerManager.executeTask('process-metadata', { 
          metadata: content.metadata || {} 
        })
      ];
      
      // Execute all tasks in parallel
      Promise.allSettled(tasks)
        .then(results => {
          // Extract successful results
          const processedText = results[0].status === 'fulfilled' ? results[0].value : null;
          const processedLinks = results[1].status === 'fulfilled' ? results[1].value : null;
          const processedMetadata = results[2].status === 'fulfilled' ? results[2].value : null;
          
          // Log results for debugging
          console.log('Parallel processing completed:', {
            textSuccess: Boolean(processedText),
            linksSuccess: Boolean(processedLinks),
            metadataSuccess: Boolean(processedMetadata)
          });
          
          // Enhance the content with the processed data
          if (processedText) {
            content.readabilityScore = processedText.readabilityScore;
            content.wordCount = processedText.wordCount;
            content.sentenceCount = processedText.sentenceCount;
          }
          
          if (processedLinks) {
            content.enhancedLinks = processedLinks;
          }
          
          if (processedMetadata) {
            content.enhancedMetadata = processedMetadata.standardized;
          }
          
          // Update research panel if available and active
          if (this.researcher && this.isResearchModeActive()) {
            this.researcher.updateContentInsights(content);
          }
          
          resolve(content);
        })
        .catch(error => {
          console.warn('Parallel processing error:', error);
          reject(error);
        });
    });
  }
  
  /**
   * Preload page resources for smoother browsing experience
   * Called when a page starts loading to prepare extraction system
   * @returns {Promise<void>}
   */
  preloadPageResources() {
    // Skip if no worker system
    if (!isWorkerSystemAvailable(this)) {
      return Promise.resolve();
    }
    
    return new Promise((resolve) => {
      // Ensure the worker is ready by executing a lightweight task
      WorkerManager.executeTask('process-url', { url: this.state?.url || '' })
        .then(result => {
          console.log('Worker system preloaded for page:', this.state?.url);
          
          // Check if the URL is likely an article
          if (result && result.isArticle) {
            console.log('Preloading article extraction capabilities');
            
            // Warm up the readability extractor by sending a dummy task
            WorkerManager.executeTask('sanitize-html', { 
              html: '<div><p>Test content</p></div>',
              allowedTags: ['div', 'p'] 
            }).catch(() => {/* Ignore errors in preloading */});
          }
          
          resolve();
        })
        .catch(() => {
          // Silently resolve on error, this is just a preload
          resolve();
        });
    });
  }
  
  /**
   * Initialize the Researcher component separately
   * @returns {boolean} True if initialization was successful
   */
  initializeResearcher() {
    if (this.researcher) {
      console.log('Researcher component already initialized');
      return true;
    }
    
    console.log('Initializing Researcher component');
    
    try {
      // Import Researcher dynamically
      const Researcher = require('./researcher/Researcher').default;
      
      // Create a new instance with proper configuration
      this.researcher = new Researcher({
        browser: this,
        containerRef: this.researchPanel,
        currentUrl: this.state?.url,
        currentTitle: this.state?.title,
        autoAnalyze: this.props?.autoAnalyzeContent || false,
        onToggle: (isActive) => {
          console.log(`Researcher component ${isActive ? 'activated' : 'deactivated'}`);
          this.setState({ researchMode: isActive });
        },
        onResearchItemClick: (item) => {
          if (item && item.url) {
            this.navigate(item.url);
          }
        }
      });
      
      // If research mode is already active in state, activate the researcher
      if (this.state.researchMode) {
        this.researcher.toggleActive();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Researcher component:', error);
      return false;
    }
  }
  
  /**
   * Initialize the browser component
   * Called by the parent App component when navigating to browser view
   */
  async initialize() {
    console.log('Initializing Voyager browser component');
    
    // Check if component is already initialized
    if (this._isInitialized) {
      console.log('Voyager browser already initialized, skipping');
      return;
    }
    
    // Check if we're already in the process of initializing
    if (this._isInitializing) {
      console.log('Voyager browser initialization already in progress, skipping');
      return;
    }
    
    // Mark as initializing to prevent concurrent initialization attempts
    this._isInitializing = true;
    
    // Ensure CSS is loaded before proceeding with layout
    try {
      console.log('Loading browser CSS files...');
      await cssLoader.initializeBrowserStyles();
      console.log('Browser CSS loaded successfully');
    } catch (error) {
      console.error('Failed to load browser CSS, proceeding with emergency styles:', error);
      cssLoader.applyEmergencyStyles();
    }
    
    // Make sure component is mounted with more thorough checking
    const hasContainer = this.containerRef?.current;
    const isContainerConnected = hasContainer && (
      this.containerRef.current.isConnected || 
      document.contains(this.containerRef.current) ||
      this.containerRef.current.parentNode
    );
    
    if (!hasContainer || !isContainerConnected) {
      console.warn('Cannot initialize Voyager - container not mounted', {
        hasContainer: !!hasContainer,
        isConnected: hasContainer ? this.containerRef.current.isConnected : false,
        inDocument: hasContainer ? document.contains(this.containerRef.current) : false,
        hasParent: hasContainer ? !!this.containerRef.current.parentNode : false
      });
      
      // Reset initializing flag
      this._isInitializing = false;
      
      // Try to initialize again after a short delay with increasing backoff
      if (!this._initAttempts) {
        this._initAttempts = 0;
      }
      
      this._initAttempts++;
      const delay = Math.min(this._initAttempts * 200, 2000); // Shorter delays and cap
      
      if (this._initAttempts < 10) { // Reduced retry limit to prevent excessive attempts
        console.log(`Retry #${this._initAttempts} scheduled in ${delay}ms`);
        setTimeout(() => {
          // Double-check if component wasn't cleaned up in the meantime
          if (!this._isUnloading && this.state.isMounted) {
            this.initialize();
          }
        }, delay);
      } else {
        console.error('Failed to initialize Voyager after multiple attempts');
      }
      return;
    }
    
    // Reset initialization attempts counter
    this._initAttempts = 0;
    
    // Mark as initialized to prevent duplicate setup
    this._isInitialized = true;
    this._isInitializing = false;
    
    // Log container details for debugging
    console.log('Container ready for setup:', {
      id: this.containerRef.current.id,
      isConnected: this.containerRef.current.isConnected,
      dimensions: `${this.containerRef.current.offsetWidth}x${this.containerRef.current.offsetHeight}`
    });
    
    // Set up complete browser layout using the modern layout manager
    const layoutContainer = setupCompleteBrowserLayout(this);
    
    if (!layoutContainer) {
      console.error('Failed to set up browser layout');
      return;
    }
    
    // Ensure the webview has all required methods
    if (this.webview) {
      // Try to use StyleManager for method setup
      try {
        const StyleManager = require('./handlers/StyleManager').default;
        if (StyleManager && typeof StyleManager.ensureApplyAllCriticalStylesMethod === 'function') {
          StyleManager.ensureApplyAllCriticalStylesMethod(this.webview);
        } else {
          // Fallback to local helper function if StyleManager is not available
          console.warn('StyleManager not available for method setup, using local fallback');
          safeApplyCriticalStyles(this.webview, true);
        }
      } catch (error) {
        console.warn('Error ensuring applyAllCriticalStyles method:', error);
        // Use local helper as fallback
        safeApplyCriticalStyles(this.webview, true);
      }
    }
    
    // Initialize centralized browser handlers
    initBrowserHandlers(this);
    
    // Initialize tab manager if needed
    if (!this.tabManager) {
      this.tabManager = new VoyagerTabManager(this);
    }
    
    // Add tab manager button to browser action buttons container
    const header = this.containerRef.current?.querySelector('.browser-header');
    if (header) {
      // Find the action buttons container instead of creating a new container
      const actionButtonsContainer = header.querySelector('.browser-action-buttons');
      
      if (actionButtonsContainer) {
        // Create a new container for the tab manager button within action buttons
        const tabManagerContainer = document.createElement('div');
        tabManagerContainer.className = 'tab-manager-container';
        actionButtonsContainer.appendChild(tabManagerContainer);
        
        // Render tab manager button into the new container
        try {
          const ReactDOM = require('react-dom/client');
          // Check if we already have a root for this container
          if (!this._tabManagerRoot) {
            this._tabManagerRoot = ReactDOM.createRoot(tabManagerContainer);
          }
          this._tabManagerRoot.render(
            <TabManagerButton 
              voyager={this} 
              tabManager={this.tabManager.getTabManager()} 
            />
          );
          console.log('Tab manager button rendered successfully in action buttons container');
        } catch (err) {
          console.error('Failed to render tab manager button:', err);
        }
      } else {
        console.warn('Could not find action buttons container to add tab manager button');
      }
    } else {
      console.warn('Could not find browser header to add tab manager button');
    }
    
    // Properly bind event handlers to the browser instance
    this.handleBackAction = (e) => {
      if (this.webview && typeof this.webview.goBack === 'function') {
        this.webview.goBack();
        updateNavigationButtons(this);
      }
    };
    
    this.handleForwardAction = (e) => {
      if (this.webview && typeof this.webview.goForward === 'function') {
        this.webview.goForward();
        updateNavigationButtons(this);
      }
    };
    
    // Bind event handlers directly to webview if it exists
    if (this.webview) {
      if (this.webview.tagName?.toLowerCase() === 'webview') {
        // Remove any existing event listeners to prevent duplicates
        this.webview.removeEventListener('did-start-loading', this.handleLoadStart);
        this.webview.removeEventListener('did-stop-loading', this.handleLoadStop);
        this.webview.removeEventListener('did-navigate', this.handlePageNavigation);
        this.webview.removeEventListener('did-finish-load', this.handleWebviewLoad);
        
        // Ensure partition is set before any navigation happens
        if (!this.webview.hasAttribute('partition')) {
          // Set a unique partition to prevent "already navigated" errors
          const uniquePartition = `persist:voyager-${Date.now()}`;
          this.webview.setAttribute('partition', uniquePartition);
        }
        
        // Bind event handlers properly
        this.handleLoadStart = (e) => {
          this.setState({ isLoading: true });
          updateLoadingControls(this, true);
        };
        
        this.handleLoadStop = (e) => {
          this.setState({ isLoading: false });
          updateLoadingControls(this, false);
        };
        
        this.handlePageNavigation = (e) => {
          if (e && e.url) {
            updateAddressBar(this, e.url);
            this.setState({ currentUrl: e.url });
            updateNavigationButtons(this);
          }
        };
        
        // Add event listeners with properly bound handlers
        this.webview.addEventListener('did-start-loading', this.handleLoadStart);
        this.webview.addEventListener('did-stop-loading', this.handleLoadStop);
        this.webview.addEventListener('did-navigate', this.handlePageNavigation);
        this.webview.addEventListener('did-finish-load', event => handleWebviewLoad(this, event));
        this.webview.addEventListener('did-fail-load', this.handleDidFailLoad);
        this.webview.addEventListener('certificate-error', this.handleCertificateError);
        
        console.log('Event handlers properly bound to webview');
      }
    }
    
    // Bind button event handlers in the header with additional checks
    const headerElement = this.containerRef.current?.querySelector('.browser-header');
    const backButton = headerElement?.querySelector('.browser-back-btn');
    const forwardButton = headerElement?.querySelector('.browser-forward-btn');
    const refreshButton = headerElement?.querySelector('.browser-refresh-btn');
    const stopButton = headerElement?.querySelector('.browser-stop-btn');
    
    if (backButton) backButton.addEventListener('click', this.handleBackAction);
    if (forwardButton) forwardButton.addEventListener('click', this.handleForwardAction);
    if (refreshButton) refreshButton.addEventListener('click', this.refreshPage);
    if (stopButton) stopButton.addEventListener('click', this.stopLoading);
    
    // Navigate to Google as the default page
    if (!this.hasNavigatedInitially) {
      console.log('Navigating to Google as default page');
      this.navigate('https://www.google.com');
      this.hasNavigatedInitially = true;
    }
    
    // Initialize researcher component if needed
    if (!this.researcher && this.props && this.props.enableResearch !== false) {
      this.initializeResearcher();
    }
  }
  
  /**
   * Schedule the initial navigation - simplified approach
   */
  _scheduleInitialNavigation() {
    // Check if we've already navigated successfully
    if (this.hasNavigatedInitially) {
      console.log('Already navigated initially, skipping navigation scheduling');
      return;
    }
    
    // Simple approach: navigate to Google immediately
    console.log('Navigating to Google on initialization');
    try {
      this.navigate('https://www.google.com');
      this.hasNavigatedInitially = true;
    } catch (error) {
      console.error('Error during initial navigation:', error);
    }
  }
  

  
  /**
   * Clean up browser resources
   * Called by the parent App component when navigating away from browser view
   */
  cleanup() {
    console.log('Cleaning up Voyager browser component');
    
    // Reset initialization flags
    this._isInitialized = false;
    this._isInitializing = false;
    this.hasNavigatedInitially = false;
    
    // Clear any active intervals first to prevent them from running during cleanup
    
    if (this._navigationTimeout) {
      clearTimeout(this._navigationTimeout);
      this._navigationTimeout = null;
    }
    
    if (this._loadDetectionInterval) {
      clearInterval(this._loadDetectionInterval);
      this._loadDetectionInterval = null;
    }
    

    
    // Remove destruction prevention listener if it exists
    if (this._destructionListener && this.webview) {
      try {
        this.webview.removeEventListener('destroyed', this._destructionListener);
        this._destructionListener = null;
      } catch (err) {
        console.warn('Error removing destruction listener:', err);
      }
    }
    
    // Remove any event listeners from webview
    if (this.webview) {
      try {
        // Standard events
        this.webview.removeEventListener('did-start-loading', this.handleLoadStart);
        this.webview.removeEventListener('did-stop-loading', this.handleLoadStop);
        this.webview.removeEventListener('did-navigate', this.handlePageNavigation);
        this.webview.removeEventListener('did-finish-load', this.handleWebviewLoad);
        this.webview.removeEventListener('did-fail-load', this.handleDidFailLoad);
        this.webview.removeEventListener('certificate-error', this.handleCertificateError);
        
        // Additional events that might have been added
        this.webview.removeEventListener('dom-ready', this.handleDomReady);
        this.webview.removeEventListener('destroyed', this.handleDestroyed);
      } catch (err) {
        console.warn('Error removing event listeners from webview:', err);
      }
    }
  
    
    // Clean up sidebar observer if it exists
    if (this._sidebarObserver) {
      this._sidebarObserver.disconnect();
      this._sidebarObserver = null;
    }
    
    // Clean up tab manager button if it exists
    const actionButtonsContainer = document.querySelector('.browser-action-buttons');
    if (actionButtonsContainer) {
      try {
        const tabManagerContainer = actionButtonsContainer.querySelector('.tab-manager-container');
        if (tabManagerContainer && tabManagerContainer.parentNode) {
          tabManagerContainer.parentNode.removeChild(tabManagerContainer);
          console.log('Tab manager container removed successfully');
        }
      } catch (err) {
        console.warn('Error cleaning up tab manager button:', err);
      }
    }
    
    // Hide and clean up webview if it exists
    if (this.webview) {
      try {
        // Hide webview first
        this.webview.style.visibility = 'hidden';
        this.webview.style.opacity = '0';
        this.webview.style.display = 'none';
        
        // Use applyWebviewStyles for hiding
        if (this.applyWebviewStyles) {
          try {
            // Custom method to apply "hidden" styles
            this.webview.style.visibility = 'hidden';
            this.webview.style.opacity = '0';
            this.webview.style.display = 'none';
          } catch (styleErr) {
            console.warn('Error applying hidden styles to webview:', styleErr);
          }
        }
        
        // Remove webview from DOM if possible
        if (this.webview.parentNode) {
          try {
            this.webview.parentNode.removeChild(this.webview);
          } catch (removeErr) {
            console.warn('Error removing webview from DOM:', removeErr);
          }
        }
      } catch (err) {
        console.warn('Error cleaning up webview element:', err);
      }
    }
    
    // Handle iframe cleanup if used
    if (this.iframe) {
      try {
        this.iframe.style.visibility = 'hidden';
        this.iframe.style.opacity = '0';
        this.iframe.style.display = 'none';
        
        if (this.iframe.parentNode) {
          this.iframe.parentNode.removeChild(this.iframe);
        }
      } catch (err) {
        console.warn('Error cleaning up iframe element:', err);
      }
    }
    
    // Clean up container contents if available
    if (this.containerRef && this.containerRef.current) {
      try {
        // Clear container contents
        while (this.containerRef.current.firstChild) {
          this.containerRef.current.removeChild(this.containerRef.current.firstChild);
        }
      } catch (err) {
        console.warn('Error cleaning up container contents:', err);
      }
    }
    
    // Clean up research panel if it exists
    if (this.researchPanel && this.researchPanel.isConnected) {
      try {
        this.researchPanel.remove();
        this.researchPanel = null;
      } catch (err) {
        console.warn('Error removing research panel:', err);
      }
    }
    
    // Remove any stand-alone research panels that might be in the body
    const researchPanels = document.querySelectorAll('body > .browser-research-panel');
    researchPanels.forEach(panel => {
      try {
        if (panel.parentNode) {
          panel.parentNode.removeChild(panel);
        }
      } catch (err) {
        console.warn('Error removing research panel:', err);
      }
    });
    
    // Reset loading state if needed
    if (this.state?.isLoading) {
      this.setState({ isLoading: false });
      if (typeof updateLoadingControls === 'function') {
        updateLoadingControls(this, false);
      }
    }
    
    // Clean up worker system if we're the last browser component
    const otherInstances = document.querySelectorAll('.voyager-browser');
    if (otherInstances.length <= 1) {
      console.log('Last browser instance closing, cleaning up worker system');
      if (WorkerManager && typeof WorkerManager.cleanup === 'function') {
        WorkerManager.cleanup();
      }
    }
    
    // Final nullification of critical references
    this.webview = null;
    this.iframe = null;
    this.webviewContainer = null;
    
    console.log('Voyager browser component cleanup completed');
  }
  
  handleDidFailLoad = (e) => {
    console.error('Webview failed to load:', e);
    
    // Check if this is an actual error
    if (e && e.errorCode !== -3) { // Ignore -3 error (aborted navigation)
      console.error(`Load failed with error code: ${e.errorCode}, description: ${e.errorDescription}`);
      
      // Set error state and render error page using the centralized ErrorHandler
      this.setState({ 
        loading: false,
        loadError: true,
        errorCode: e.errorCode,
        errorDescription: e.errorDescription || 'Failed to load page'
      });
      
      // Use the centralized error handler
      ErrorHandler.handlePageLoadError(this, e, this.state.currentUrl || 'Unknown URL');
      
      // If error handler exists, call it
      if (typeof this.props.onError === 'function') {
        this.props.onError(e);
      }
      
      // Try to initialize again after a short delay with increasing backoff
      if (this.webview && this.loadRetryCount < 3) {
        this.loadRetryCount++;
        const retryDelay = 1000 * Math.pow(2, this.loadRetryCount);
        
        console.log(`Scheduling retry attempt ${this.loadRetryCount} in ${retryDelay}ms`);
        
        setTimeout(() => {
          console.log(`Retry attempt ${this.loadRetryCount}`);
          this.initWebview();
        }, retryDelay);
      }
    } else {
      console.log('Ignoring aborted navigation error (code -3)');
    }
  }
  
  /**
   * Handle certificate errors
   * @param {Event} e - Certificate error event
   */
  handleCertificateError = (e) => {
    console.warn('Certificate error:', e);
    
    // Use the centralized error handler
    ErrorHandler.handleCertificateError(this, e);
    
    // If error handler exists, call it
    if (typeof this.props.onError === 'function') {
      this.props.onError({
        type: 'certificate',
        details: e
      });
    }
  }
  
  /**
   * Go back in navigation history
   */
  goBack = () => {
    if (this.webview && typeof this.webview.goBack === 'function' && this.webview.canGoBack()) {
      this.webview.goBack();
    }
  }
  
  /**
   * Go forward in navigation history
   */
  goForward = () => {
    if (this.webview && typeof this.webview.goForward === 'function' && this.webview.canGoForward()) {
      this.webview.goForward();
    }
  }
  
  /**
   * Fallback extraction method when worker-based extraction fails
   * @returns {Promise<Object>} Promise resolving to extracted content
   */
  fallbackExtraction() {
    console.log('Using ExtractorManager for content extraction');
    
    // Ensure we log the fallback attempt
    try {
      // Check if we're using the fallback extraction because of worker availability
      if (!isWorkerSystemAvailable(this)) {
        console.log('Fallback extraction reason: Worker system not available');
      }
    } catch (err) {
      // Don't block extraction due to logging error
      console.warn('Error checking worker availability:', err);
    }
    
    return ExtractorManager.extract(this, this.state?.url || '', { preferWorker: false })
      .then(result => {
        // Log successful extraction
        console.log(`ExtractorManager extraction succeeded via ${result.extractionMethod || 'unknown'} method`);
        
        // Format the result to match the expected API
        return {
          title: result.title || this.state?.title || 'Untitled Page',
          url: result.url || this.state?.url || '',
          text: result.text || '',
          processedContent: result.html || result.text || '',
          timestamp: result.timestamp || new Date().toISOString(),
          extractionMethod: result.extractionMethod || 'fallback',
          extractionTime: result.extractionTime || 0
        };
      })
      .catch(error => {
        console.error('Fallback extraction failed:', error);
        
        // Return minimal data if all extraction methods fail
        console.log('Returning minimal data for page');
        return {
          title: this.state?.title || 'Untitled Page',
          url: this.state?.url || '',
          text: '',
          processedContent: '',
          timestamp: new Date().toISOString(),
          extractionMethod: 'minimal-fallback',
          extractionTime: 0
        };
      });
  }
  
  render() {
    // Destructure props for easier access and defaults
    const { 
      className = '',
      style = {},
      showToolbar = true,
      showAddressBar = true,
      showStatusBar = true,
      height = '100%',
      enableResearch = true,
      autoAnalyzeContent = false
    } = this.props || {};
    
    // Use ReaderModeManager to check if reader mode is active
    const isReaderModeActive = checkReaderModeActive(this);
    const readerMode = getReaderMode(this);
    
    // Compute container styles
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      height,
      border: '1px solid #ddd',
      borderRadius: '4px',
      overflow: 'hidden',
      ...style
    };
    
    return (
      <div 
        className={`voyager-browser ${className}`} 
        style={containerStyle}
        ref={this.containerRef}
        id={`voyager-${this.browserId}`}
      >
        {/* Note: Address bar is now created by BrowserRenderer.createBrowserHeader */}
        {/* and is positioned at the top of the component */}

        {/* Browser chrome (toolbar) */}
        {showToolbar && (
          <div className="voyager-toolbar" style={{
            display: 'flex',
            padding: '8px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #ddd'
          }}>
            {/* Navigation buttons */}
            <button onClick={this.handleBackAction} style={{ marginRight: '4px' }}>◀</button>
            <button onClick={this.handleForwardAction} style={{ marginRight: '8px' }}>▶</button>
            <button onClick={this.refreshPage} style={{ marginRight: '8px' }}>↻</button>
            <button onClick={this.stopLoading} style={{ marginRight: '8px' }}>✕</button>
            
            {/* Reader mode toggle */}
            <button onClick={this.toggleReaderMode} style={{ marginLeft: '8px' }}>
              <span className="material-icons" title="Toggle reader mode">
                {isReaderModeActive ? 'chrome_reader_mode' : 'view_headline'}
              </span>
            </button>
            
            {/* Bookmark button */}
            <button onClick={this.addBookmark} style={{ marginLeft: '8px' }}>
              🔖
            </button>
          </div>
        )}
        
        {/* Browser content area */}
        <div className="voyager-content" style={{
          flex: 1,
          display: 'flex',
          position: 'relative'
        }}>
          {/* Main browser view */}
          <div 
            className="voyager-browser-container"
            style={{
              flex: readerMode === 'reader' ? 0 : (readerMode === 'split' ? 1 : 1),
              display: readerMode === 'reader' ? 'none' : 'block',
              height: '100%',
              position: 'relative'
            }}
          >
            {/* This div will be populated with webview or iframe */}
          </div>
          
          {/* Reader view */}
          {isReaderModeActive && (
            <div 
              className="voyager-reader-view"
              style={{
                flex: readerMode === 'browser' ? 0 : (readerMode === 'split' ? 1 : 1),
                display: readerMode === 'browser' ? 'none' : 'block',
                padding: '20px',
                height: '100%',
                overflow: 'auto',
                backgroundColor: '#fff'
              }}
            >
              <h1>{this.state.title}</h1>
              <div 
                className="reader-content"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(this.state.readerContent || '<p>No content available for reader view</p>') 
                }}
              />
            </div>
          )}
          
          {/* Loading indicator */}
          {this.state.isLoading && (
            <div className="voyager-loading-indicator" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255,255,255,0.8)',
              padding: '10px 20px',
              borderRadius: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              Loading...
            </div>
          )}
          
          {/* Error state - Using centralized ErrorHandler for error display */}
          {this.state.errorState && (
            <div className="voyager-error-container" style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f8f8f8',
              padding: '20px',
              overflow: 'auto'
            }}>
              {/* Render error page using the centralized ErrorHandler */}
              {(() => {
                ErrorHandler.renderErrorPage(this, {
                  code: this.state.errorState.code,
                  description: this.state.errorState.message || this.state.errorState.description,
                  url: this.state.errorState.url,
                  type: ErrorHandler.getErrorType(this.state.errorState.code),
                  onRetry: () => this.navigate(this.state.url),
                  onBack: () => {
                    ErrorHandler.clearError(this);
                    this.goBack();
                  }
                });
                return null; // Error page is rendered through the ErrorHandler
              })()}
            </div>
          )}
        </div>
        
        {/* Status bar */}
        {showStatusBar && (
          <div className="voyager-status-bar" style={{
            padding: '4px 8px',
            backgroundColor: '#f5f5f5',
            borderTop: '1px solid #ddd',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <div>{this.state.url}</div>
            <div>{this.state.isLoading ? 'Loading...' : 'Ready'}</div>
          </div>
        )}

        {/* Research component initialization */}
        {/* Note: Researcher is initialized programmatically in initializeResearcher() method */}
        {/* It manages its own DOM and doesn't need to be rendered through React */}
      </div>
    );
  }
}

// Set default props
Voyager.defaultProps = {
  initialUrl: 'https://www.google.com',
  notificationService: null
};

export default Voyager; 