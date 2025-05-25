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
import ReactDOM from 'react-dom/client';
import { nanoid } from 'nanoid';
import DOMPurify from 'dompurify';

// Import tab management system
import VoyagerTabManager from './tabs/VoyagerTabManager';
import TabManagerButton from './tabs/TabManagerButton';
import TabBar from './tabs/TabBar';

// Import browser component utilities from centralized BrowserEnv
import { 
  detectEnvironment,
  formatUrl,
  applySiteSpecificSettings
} from './utils/BrowserEnv';

// Use centralized handlers from the index file
import { 
  ErrorHandler, 
  EventHandlers, 
  HistoryService,
  initBrowserHandlers,
  updateNavigationButtons
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

import { toggleReaderMode, setReaderMode, getReaderMode, isReaderModeActive as checkReaderModeActive } from './handlers/ReaderModeManager';
import ExtractorManager from './extraction/ExtractorManager';
import WorkerManager from './utils/WorkerManager';
import cssLoader from '../../utils/cssLoader';

// Import specific event handlers
import { handleWebviewLoad as handleWebviewLoadCentral } from './handlers/EventHandlers.js';
import { handleSuccessfulPageLoad } from './handlers/EventHandlers.js';
import { clearNavigationTimeout } from './handlers/NavigationService.js';

import logger from '../../utils/logger';

// Create a logger instance for this module
const workerLogger = logger.scope('WorkerManager');

/**
 * Check if the worker system is available for the given browser instance
 * @param {Object} browser - Browser instance to check
 * @returns {boolean} True if worker system is available
 */
function isWorkerSystemAvailable(browser) {
  try {
    // Check if WorkerManager is available and initialized
    if (!WorkerManager || typeof WorkerManager.initialize !== 'function') {
      return false;
    }

    // Check if the worker system is initialized and available
    if (!WorkerManager.isInitialized || !WorkerManager.isAvailable) {
      return false;
    }

    // Check if the browser instance has the necessary properties
    if (!browser || !browser.webview || !browser.state?.url) {
      return false;
    }

    // Check if webview is connected and ready
    if (browser.webview && (
      !browser.webview.isConnected && 
      !browser.webview._isAttached && 
      !document.contains(browser.webview)
    )) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Error checking worker system availability:', error);
    return false;
  }
}

// Create extraction cache for optimized content extraction
const extractionCache = new Map();

/**
 * Error Boundary Component for Voyager Browser
 * Catches and handles React errors to prevent crashes
 */
class VoyagerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('VoyagerErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({ 
      error, 
      errorInfo,
      hasError: true 
    });
    
    // Report error to monitoring service if available
    if (window.errorTracker && typeof window.errorTracker.captureException === 'function') {
      window.errorTracker.captureException(error, {
        tags: { component: 'Voyager', browserId: this.props.browserId },
        extra: errorInfo
      });
    }
  }

  handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    // Limit retries to prevent infinite loops
    if (newRetryCount > 3) {
      console.warn('Max retries exceeded for Voyager error boundary');
      return;
    }
    
    console.log(`Retrying Voyager component (attempt ${newRetryCount})`);
    
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: newRetryCount
    });
  };

  render() {
    if (this.state.hasError) {
      // Render fallback UI with retry option
      return (
        <div className="voyager-error-boundary" style={{
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#dc3545', marginBottom: '16px' }}>
            Browser Component Error
          </h2>
          <p style={{ marginBottom: '16px', color: '#6c757d' }}>
            The browser component encountered an error and needs to be restarted.
          </p>
          {this.state.retryCount < 3 && (
            <button 
              onClick={this.handleRetry}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              Retry ({3 - this.state.retryCount} attempts left)
            </button>
          )}
          <details style={{ marginTop: '16px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>
              Error Details
            </summary>
            <pre style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '8px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '200px'
            }}>
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

class Voyager extends Component {
  constructor(props) {
    super(props);
    
    // CRITICAL FIX: Don't set defer flag in constructor - let it be set during initialization phases
    // this._deferReactRendering = true; // REMOVED - causes issues on remount
    
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
      researchMode: false,
      // Tab management state
      tabs: [],
      activeTabId: null
    };
    
    // Create unique ID for component
    this.browserId = nanoid();
    
    // CRITICAL FIX: Initialize flags properly for clean state
    this._isInitialized = false;
    this._isInitializing = false;
    this._isUnloading = false;
    this._deferReactRendering = false; // Start with false, set to true only during specific phases
    
    // References
    this.containerRef = React.createRef();
    this.webview = null;
    this.iframe = null;
    this.addressInput = null;
    this.researcher = null;
    
    // Initialize tab manager with cleaner integration
    this.tabManager = null;
    
    // Create research panel reference if it doesn't exist
    this.researchPanel = document.createElement('div');
    this.researchPanel.className = 'browser-research-panel hidden'; // Start hidden
    
    // Ensure research panel is added to the DOM immediately
    document.body.appendChild(this.researchPanel);
    
    // Track if we've already done the initial navigation
    this.hasNavigatedInitially = false;
    
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
    
    // Tab management methods
    this.handleTabClick = this.handleTabClick.bind(this);
    this.handleTabClose = this.handleTabClose.bind(this);
    this.handleNewTab = this.handleNewTab.bind(this);
  }
  
  componentDidMount() {
    console.log(`Voyager browser component mounted (ID: ${this.browserId})`);
    
    // CRITICAL FIX: Reset all initialization flags on mount to ensure clean state
    this._isInitialized = false;
    this._isInitializing = false;
    this._wasUnmounted = false;
    this._deferReactRendering = false; // Reset defer flag on mount
    this.hasNavigatedInitially = false;
    
    // Clear any stale timeouts from previous instances
    this.clearAllTimeouts();
    
    // Set isMounted state to enable rendering of child components
    this.setState({
      isMounted: true
    }, () => {
      // Initialize with a minimal delay to ensure React rendering is complete
      setTimeout(() => {
        this.initialize();
        
        // Integrate with data preservation system
        this.integrateWithDataPreservation();
      }, 50); // Reduced delay - just enough for React to finish rendering
    });
  }
  
  componentWillUnmount() {
    // CRITICAL FIX: Mark as unloading immediately to prevent any new operations
    this._isUnloading = true;
    
    console.log('Voyager componentWillUnmount - preventing race conditions');
    
    // CRITICAL FIX: Schedule cleanup asynchronously to avoid conflicts with React's unmounting
    // This prevents the "Cannot unmount while React is rendering" warning
    setTimeout(() => {
      try {
        // Double-check that we should still clean up (component might have been remounted)
        if (this._isUnloading) {
          this.performAsyncCleanup();
        }
      } catch (error) {
        console.warn('Error during async cleanup:', error);
      }
    }, 0);
    
    // Immediately clear timeouts to prevent operations during unmounting
    this.clearAllTimeouts();
    
    // Set isMounted to false immediately to prevent any state updates
    if (this.state && this.state.isMounted) {
      // Use a try-catch to prevent errors if setState is not available
      try {
        this.setState({ isMounted: false }, null); // No callback to avoid complexity
      } catch (err) {
        console.warn('Could not update isMounted state during unmount:', err);
      }
    }
  }
  
  /**
   * Perform cleanup asynchronously to avoid React rendering conflicts
   */
  performAsyncCleanup() {
    console.log('Performing async Voyager cleanup');
    
    // CRITICAL FIX: VoyagerLifecycle state reset is now handled in main cleanup method
    // No need to call it again here to avoid duplicate calls
    
    // Call the main cleanup method
    this.cleanup();
  }
  
  /**
   * Clear all timeouts and intervals to prevent operations during cleanup
   */
  clearAllTimeouts() {
    try {
      if (this._navigationTimeout) {
        clearTimeout(this._navigationTimeout);
        this._navigationTimeout = null;
      }
      
      if (this._loadDetectionInterval) {
        clearInterval(this._loadDetectionInterval);
        this._loadDetectionInterval = null;
      }
      
      if (this._handlingNavigationTimeout) {
        this._handlingNavigationTimeout = false;
      }
      
      // Clear any other timeouts that might be running
      if (this._initRetryTimeout) {
        clearTimeout(this._initRetryTimeout);
        this._initRetryTimeout = null;
      }
      
      if (this._styleCheckTimeout) {
        clearTimeout(this._styleCheckTimeout);
        this._styleCheckTimeout = null;
      }
    } catch (error) {
      console.warn('Error clearing timeouts:', error);
    }
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
    
    // CRITICAL FIX: Only emit navigation event if NOT during tab switching
    // This prevents duplicate navigation events that corrupt tab URLs
    if (this.tabManager && (!this.tabManager.isSwitchingTabs || !this.tabManager.isCleaningUp)) {
      console.log('Emitting navigation event to tab manager (user navigation)');
      this.tabManager.emitEvent('navigation', {
        url: formattedUrl,
        title: this.state.title,
        source: 'user_navigation'
      });
    } else {
      console.log('Skipping navigation event emission (tab switching in progress)');
    }
    
    // Create a more reliable navigation timeout with progressive fallbacks
    // Use a longer timeout period (10 seconds instead of 8) to give more time for initial page load
    const navigationTimeoutPeriod = 10000;
    
    this._navigationTimeout = setTimeout(() => {
      console.log('Navigation timeout reached, handling gracefully');
      
      // Set a flag that we're handling a timeout
      this._handlingNavigationTimeout = true;
      
      // Check if we need to handle the timeout (if page is not already loaded)
      if (this.state.isLoading) {
        // First, try to see if the page actually loaded despite not triggering load events
        this.checkIfPageIsLoaded(() => {
          // If checking loaded state didn't resolve the issue, show a message
          if (this.state.isLoading && this._handlingNavigationTimeout) {
            console.log('Page still appears to be loading after timeout, forcing visibility');
            
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
                  } else {
                    // Direct style application as a fallback
                    this.webview.style.cssText = `
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
                      (function() {
                        try {
                          return {
                            title: document.title || 'Unknown Page',
                            url: window.location.href,
                            loaded: true
                          };
                        } catch (e) {
                          return { error: e.message };
                        }
                      })()
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
                  
                  // Apply site-specific fixes, especially for Google
                  if (formattedUrl.includes('google.com') && typeof this.webview.executeJavaScript === 'function') {
                    this.webview.executeJavaScript(`
                      (function() {
                        // Add Google-specific fixes
                        const style = document.createElement('style');
                        style.textContent = "html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; } " +
                          "#main, #cnt, #rcnt, #center_col, #rso, [role='main'] { width: 100% !important; max-width: none !important; }";
                        document.head.appendChild(style);
                        return true;
                      })()
                    `).catch(() => console.log('Could not apply Google-specific fixes'));
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
    const maxDetectionTime = 12000; // Increase max detection time to 12 seconds
    
    // Use a relatively fast polling interval (200ms)
    this._loadDetectionInterval = setInterval(() => {
      // Check if we've been polling too long
      if (Date.now() - startTime > maxDetectionTime) {
        clearInterval(this._loadDetectionInterval);
        
        // If we're still loading after max detection time, force the webview to be visible
        if (this.state?.isLoading && this.webview) {
          console.log('Max detection time reached, forcing webview visibility');
          if (typeof this.webview.applyAllCriticalStyles === 'function') {
            this.webview.applyAllCriticalStyles(true);
          } else {
            this.webview.style.visibility = 'visible';
            this.webview.style.opacity = '1';
          }
          
          // Update UI state
          this.setState({ isLoading: false });
          updateLoadingControls(this, false);
        }
        return;
      }
      
      // Skip checks if we're not loading anymore
      if (!this.state?.isLoading) {
        clearInterval(this._loadDetectionInterval);
        return;
      }
      
      // After 2 seconds of loading, ensure webview is at least partially visible
      // This ensures users see something even if load events don't fire correctly
      if (Date.now() - startTime > 2000 && this.webview) {
        this.webview.style.visibility = 'visible';
        this.webview.style.opacity = '1';
      }
      
      // Call our check method
      this.checkIfPageIsLoaded();
    }, 200);
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
          (function() {
            try {
              return {
                currentUrl: window.location.href,
                readyState: document.readyState,
                title: document.title,
                hasBody: !!document.body
              };
            } catch (e) {
              return { error: e.message };
            }
          })()
        `).then(result => {
          if (!result) {
            if (callback) callback();
            return;
          }
          
          // Check if URL has changed, indicating successful navigation or if readyState is complete
          if ((result.currentUrl && result.currentUrl !== 'about:blank' && 
              result.currentUrl !== this.currentUrl) ||
              result.readyState === 'complete' ||
              (result.hasBody && result.readyState === 'interactive')) {
            
            console.log(`Page appears to be loaded based on state check:`, {
              urlChanged: result.currentUrl !== this.currentUrl,
              readyState: result.readyState,
              hasBody: result.hasBody,
              title: result.title
            });
            
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
              StyleManager.safeApplyStyles(this.webview, true);
            }
            
            // Capture content
            this.capturePageContent();
            
            // Use centralized navigation timeout clearing
            clearNavigationTimeout(this, 'checkIfPageIsLoaded - successful navigation');
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
    // CRITICAL FIX: Get the actual URL and title from webview first
    let currentURL = null;
    let currentTitle = null;
    
    // Extract URL and title from webview
    try {
      if (this.webview && typeof this.webview.getURL === 'function') {
        currentURL = this.webview.getURL();
        
        // Try to get the actual page title
        if (this.webview.getWebContents && typeof this.webview.getWebContents === 'function') {
          try {
            const webContents = this.webview.getWebContents();
            if (webContents && typeof webContents.getTitle === 'function') {
              const webviewTitle = webContents.getTitle();
              if (webviewTitle && webviewTitle.trim() && webviewTitle !== 'about:blank') {
                currentTitle = webviewTitle;
              }
            }
          } catch (titleError) {
            console.warn('Error getting webview title:', titleError);
          }
        }
        
        // Fallback to getTitle method if available
        if (!currentTitle && typeof this.webview.getTitle === 'function') {
          try {
            const webviewTitle = this.webview.getTitle();
            if (webviewTitle && webviewTitle.trim() && webviewTitle !== 'about:blank') {
              currentTitle = webviewTitle;
            }
          } catch (titleError) {
            console.warn('Error getting webview title via getTitle:', titleError);
          }
        }
        
        console.log('Webview loaded:', currentURL, 'Title:', currentTitle);
      } else {
        console.log('Webview loaded:', this.state.url);
        currentURL = this.state.url;
        currentTitle = this.state.title;
      }
    } catch (error) {
      console.warn('Error updating address bar with actual URL:', error);
      currentURL = this.state.url;
      currentTitle = this.state.title;
    }
    
    // Use centralized successful page load handler for consistent timeout clearing
    handleSuccessfulPageLoad(this, 'Voyager.handleWebviewLoad', {
      hideDelay: 200,
      applyStyles: true,
      updateState: true
    });
    
    // CRITICAL FIX: Update state with actual URL and title from webview
    if (currentURL && currentURL !== 'about:blank') {
      // Update URL and title in state
      this.setState({ 
        url: currentURL, 
        title: currentTitle || currentURL,
        isLoading: false 
      });
      
      // Update address bar input
      if (this.addressInput) {
        this.addressInput.value = currentURL;
      }
      
      // Update current URL tracking
      this.currentUrl = currentURL;
      
      // CRITICAL FIX: Emit navigation event for tab manager with proper title
      if (this.tabManager) {
        // Don't emit navigation events during tab switching
        if (this.tabManager.isSwitchingTabs) {
          console.log(`Webview load complete during tab switch: ${currentURL} - not emitting navigation event`);
        } else {
          console.log(`Webview load complete, notifying tab manager: ${currentURL} - ${currentTitle || 'No title'}`);
          this.tabManager.emitEvent('navigation', {
            url: currentURL,
            title: currentTitle || currentURL,
            source: 'webview_load'
          });
        }
      }
      
      console.log(`Address bar updated to actual URL: ${currentURL} with title: ${currentTitle || 'No title'}`);
    }
    
    // Ensure webview is fully visible
    if (this.webview) {
      try {
        // Use StyleManager for consistent styling (this is the primary styling method)
        StyleManager.safeApplyStyles(this.webview, true);
        
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
    
    // Capture page content and emit event
    this.capturePageContent().then(content => {
      console.log('🎯 Content captured successfully:', {
        hasContent: !!content,
        hasTabManager: !!this.tabManager,
        contentKeys: content ? Object.keys(content) : [],
        url: content?.url || 'unknown'
      });
      
      if (this.tabManager && content) {
        console.log('📡 Emitting contentCaptured event to tab manager');
        this.tabManager.emitEvent('contentCaptured', content);
        console.log('✅ contentCaptured event emitted successfully');
      } else {
        console.warn('❌ Cannot emit contentCaptured event:', {
          hasTabManager: !!this.tabManager,
          hasContent: !!content
        });
      }
    }).catch(err => {
      console.warn('❌ Error in capturePageContent during load:', err);
    });
    
    // Add to browsing history using centralized HistoryService
    const historyRecord = HistoryService.createHistoryRecord(
      currentURL || this.state.url, 
      currentTitle || this.state.title, 
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
            // CRITICAL FIX: Prevent automatic navigation that was causing unwanted navigation to wikipedia.com
            // Instead of immediately navigating, ask user for confirmation
            const userConfirmed = confirm(`Navigate to ${item.url}?\n\nThis will leave the current page.`);
            if (userConfirmed) {
              this.navigate(item.url);
            } else {
              console.log('User cancelled navigation to:', item.url);
            }
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
      this.containerRef.current.parentNode ||
      // Additional check: is the container actually in the DOM tree
      (this.containerRef.current.parentElement && document.contains(this.containerRef.current.parentElement))
    );
    
    // Additional safety check: ensure container has basic DOM properties
    const hasBasicDomProperties = hasContainer && 
      typeof this.containerRef.current.tagName === 'string' &&
      typeof this.containerRef.current.appendChild === 'function';
    
    if (!hasContainer || !isContainerConnected || !hasBasicDomProperties) {
      console.warn('Cannot initialize Voyager - container not mounted', {
        hasContainer: !!hasContainer,
        isConnected: hasContainer ? this.containerRef.current.isConnected : false,
        inDocument: hasContainer ? document.contains(this.containerRef.current) : false,
        hasParent: hasContainer ? !!this.containerRef.current.parentNode : false,
        hasParentElement: hasContainer ? !!this.containerRef.current.parentElement : false,
        parentInDocument: hasContainer && this.containerRef.current.parentElement ? document.contains(this.containerRef.current.parentElement) : false,
        hasTagName: hasContainer ? typeof this.containerRef.current.tagName === 'string' : false,
        hasAppendChild: hasContainer ? typeof this.containerRef.current.appendChild === 'function' : false
      });
      
      // Reset initializing flag
      this._isInitializing = false;
      
      // Try to initialize again after a short delay with increasing backoff
      if (!this._initAttempts) {
        this._initAttempts = 0;
      }
      
      this._initAttempts++;
      const delay = Math.min(this._initAttempts * 100, 1000); // Reduced from 150ms base and 1500ms cap
      
      if (this._initAttempts < 5) { // Reduced from 8 attempts since DOM checking is more robust
        console.log(`Retry #${this._initAttempts} scheduled in ${delay}ms`);
        setTimeout(() => {
          // Double-check if component wasn't cleaned up in the meantime
          if (!this._isUnloading && this.state.isMounted) {
            this.initialize();
          }
        }, delay);
      } else {
        console.error('Failed to initialize Voyager after multiple attempts - DOM may have timing issues');
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
    
    // Initialize centralized browser handlers
    initBrowserHandlers(this);
    
    // CRITICAL FIX: Force fresh initialization if this is a remount after navigation
    const shouldForceReset = this._wasUnmounted || !this.state.isMounted;
    if (shouldForceReset) {
      console.log('Forcing fresh VoyagerLifecycle initialization after component remount');
    }
    
    // Use VoyagerLifecycle to properly initialize webview and all systems
    const VoyagerLifecycle = require('./handlers/VoyagerLifecycle');
    if (VoyagerLifecycle && typeof VoyagerLifecycle.initialize === 'function') {
      console.log('Initializing browser via VoyagerLifecycle system');
      VoyagerLifecycle.initialize(this, { 
        forceStateReset: shouldForceReset 
      });
    } else {
      console.warn('VoyagerLifecycle not available, using fallback initialization');
    }
    
    // Clear the unmount flag after successful initialization
    this._wasUnmounted = false;
    
    // Ensure tab manager is properly initialized
    // The tabManager should have been created by setupCompleteBrowserLayout
    if (!this.tabManager) {
      console.warn('Tab manager not created by layout manager, creating fallback');
      // CRITICAL FIX: Use the same initialization logic to prevent duplicates
      this.initializeTabManager();
    } else {
      console.log('Using existing tab manager instance from layout manager');
      // Ensure event listeners are set up for existing instance
      this.setupTabManagerEventListeners();
    }
    
    // Try to find browser header for tab manager button - with enhanced fallback
    const browserHeaderElement = this.containerRef.current?.querySelector('.browser-header') ||
                                 this.containerRef.current?.querySelector('.browser-header-container') ||
                                 this.containerRef.current?.querySelector('.voyager-header');
    
    if (browserHeaderElement) {
      // Look for action buttons container with multiple fallback options
      const actionButtonsContainer = browserHeaderElement.querySelector('.browser-action-buttons') ||
                                    browserHeaderElement.querySelector('.action-buttons-container') ||
                                    browserHeaderElement.querySelector('.toolbar-actions-right') ||
                                    browserHeaderElement.querySelector('.browser-action-toolbar');
      
      if (actionButtonsContainer) {
        // CRITICAL FIX: Defer TabManagerButton React root creation to prevent DOM conflicts
        const setupTabManagerButton = () => {
          try {
            // Create tab manager container in the action buttons area
            const tabManagerContainer = document.createElement('div');
            tabManagerContainer.className = 'tab-manager-container';
            actionButtonsContainer.appendChild(tabManagerContainer);
            
            // Create React root for tab manager button
            this._tabManagerRoot = ReactDOM.createRoot(tabManagerContainer);
            
            // Render tab manager button
            this._tabManagerRoot.render(
              <TabManagerButton 
                voyager={this} 
                tabManager={this.tabManager} 
              />
            );
            console.log('Tab manager button rendered successfully in action buttons container');
          } catch (err) {
            console.error('Failed to render tab manager button:', err);
          }
        };
        
        // CRITICAL FIX: Check if React rendering should be deferred
        if (this._deferReactRendering) {
          // Store the setup function for later execution
          this._initializeTabManagerButton = setupTabManagerButton;
          console.log('TabManagerButton React rendering deferred until main browser setup completes');
          
          // Create placeholder button
          const placeholderButton = document.createElement('div');
          placeholderButton.className = 'tab-manager-button-placeholder';
          placeholderButton.innerHTML = '⏳';
          // Remove inline styles - let CSS handle placeholder styling
          actionButtonsContainer.appendChild(placeholderButton);
          
          // Store reference to placeholder for later removal
          this._tabManagerPlaceholder = placeholderButton;
        } else {
          // Execute immediately if not deferred
          setupTabManagerButton();
        }
      } else {
        console.warn('Could not find action buttons container to add tab manager button');
      }
    } else {
      console.warn('Could not find browser header to add tab manager button - this is expected during initial layout creation');
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
            this.setState({ currentUrl: e.url, url: e.url });
            updateNavigationButtons(this);
            
            // CRITICAL FIX: Improved navigation event handling for tab manager
            if (this.tabManager) {
              // Check if this is during tab switching to prevent duplicate events
              if (this.tabManager.isSwitchingTabs) {
                console.log(`Webview navigation detected during tab switch: ${e.url} - not emitting event`);
              } else {
                console.log(`Webview navigation detected (user navigation): ${e.url}`);
                this.tabManager.emitEvent('navigation', {
                  url: e.url,
                  title: this.state.title || 'Loading...',
                  source: 'webview_navigation'
                });
              }
            }
          }
        };
        
        // Add event listeners with properly bound handlers
        this.webview.addEventListener('did-start-loading', this.handleLoadStart);
        this.webview.addEventListener('did-stop-loading', this.handleLoadStop);
        this.webview.addEventListener('did-navigate', this.handlePageNavigation);
        this.webview.addEventListener('did-finish-load', event => handleWebviewLoadCentral(this, event));
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
    
    // CRITICAL FIX: Wait for webview dom-ready event before navigation
    // Remove immediate navigation that was causing "WebView must be attached to the DOM" errors
    this._setupInitialNavigation();
    
    // Initialize researcher component if needed
    if (!this.researcher && this.props && this.props.enableResearch !== false) {
      this.initializeResearcher();
    }
    
    // Initialize tab manager with cleaner integration
    if (!this.tabManager) {
      this.initializeTabManager();
    }
  }
  
  /**
   * Set up initial navigation after webview is ready
   * This fixes the race condition where navigation was attempted before dom-ready event
   */
  _setupInitialNavigation() {
    // Check if we've already navigated successfully
    if (this.hasNavigatedInitially) {
      console.log('Already navigated initially, skipping navigation setup');
      return;
    }

    // Wait for webview to be ready before attempting navigation
    if (this.webview) {
      // Check if webview is already ready
      if (this.webview.isReady || this.webview.getAttribute('data-ready') === 'true') {
        console.log('Webview already ready, navigating immediately');
        this._performInitialNavigation();
      } else {
        console.log('Setting up dom-ready listener for initial navigation');
        
        // Add one-time dom-ready event listener
        const handleDomReady = () => {
          console.log('Webview dom-ready fired, performing initial navigation');
          this.webview.removeEventListener('dom-ready', handleDomReady);
          this._performInitialNavigation();
        };
        
        this.webview.addEventListener('dom-ready', handleDomReady);
        
        // Fallback timeout in case dom-ready doesn't fire within reasonable time
        setTimeout(() => {
          if (!this.hasNavigatedInitially) {
            console.log('Dom-ready timeout reached, attempting navigation anyway');
            this.webview.removeEventListener('dom-ready', handleDomReady);
            this._performInitialNavigation();
          }
        }, 3000); // 3 second fallback timeout
      }
    } else {
      // No webview yet, try again in a moment
      console.log('No webview found, retrying navigation setup in 100ms');
      setTimeout(() => {
        this._setupInitialNavigation();
      }, 100);
    }
  }

  /**
   * Perform the actual initial navigation to Google
   */
  _performInitialNavigation() {
    if (this.hasNavigatedInitially) {
      console.log('Navigation already performed, skipping');
      return;
    }

    console.log('Performing initial navigation to Google');
    try {
      this.navigate('https://www.google.com');
      this.hasNavigatedInitially = true;
    } catch (error) {
      console.error('Error during initial navigation:', error);
      // Mark as navigated to prevent infinite retries
      this.hasNavigatedInitially = true;
    }
  }
  
  /**
   * Clean up browser resources
   * Called by the parent App component when navigating away from browser view
   */
  cleanup() {
    console.log('Cleaning up Voyager browser component');
    
    // CRITICAL FIX: Mark component as unmounted for future initialization
    this._wasUnmounted = true;
    
    // Clear all timeouts first to prevent operations during cleanup
    this.clearAllTimeouts();
    
    // CRITICAL FIX: Reset VoyagerLifecycle state BEFORE other cleanup to prevent race conditions
    try {
      const VoyagerLifecycle = require('./handlers/VoyagerLifecycle');
      if (VoyagerLifecycle && typeof VoyagerLifecycle.resetBrowserState === 'function') {
        console.log('Resetting VoyagerLifecycle state during cleanup');
        VoyagerLifecycle.resetBrowserState(this);
      }
    } catch (err) {
      console.warn('Error resetting VoyagerLifecycle state during cleanup:', err);
    }
    
    // Use VoyagerLifecycle cleanup for proper system cleanup
    try {
      const VoyagerLifecycle = require('./handlers/VoyagerLifecycle');
      if (VoyagerLifecycle && typeof VoyagerLifecycle.cleanup === 'function') {
        console.log('Cleaning up browser via VoyagerLifecycle system');
        VoyagerLifecycle.cleanup(this);
      }
    } catch (err) {
      console.warn('Error during VoyagerLifecycle cleanup:', err);
    }
    
    // Reset initialization flags for potential remount
    this._isInitialized = false;
    this._isInitializing = false;
    this._deferReactRendering = false; // Reset defer flag for clean remount
    this.hasNavigatedInitially = false;
    
    // Clean up tab manager and its event listeners BEFORE webview cleanup
    this.cleanupTabManager();
    
    // Clean up tab manager button if it exists
    this.cleanupTabManagerButton();
    
    // Remove destruction prevention listener if it exists
    if (this._destructionListener && this.webview) {
      try {
        this.webview.removeEventListener('destroyed', this._destructionListener);
        this._destructionListener = null;
      } catch (err) {
        console.warn('Error removing destruction listener:', err);
      }
    }
    
    // Remove any event listeners from webview BEFORE attempting to clean it up
    this.cleanupWebviewEventListeners();
    
    // Clean up sidebar observer if it exists
    if (this._sidebarObserver) {
      try {
        this._sidebarObserver.disconnect();
        this._sidebarObserver = null;
      } catch (err) {
        console.warn('Error disconnecting sidebar observer:', err);
      }
    }
    
    // Hide and clean up webview if it exists (improved error handling)
    this.cleanupWebview();
    
    // Handle iframe cleanup if used
    this.cleanupIframe();
    
    // Clean up container contents if available (with improved error handling)
    this.cleanupContainer();
    
    // Clean up research panel if it exists
    this.cleanupResearchPanel();
    
    // Reset loading state if needed
    if (this.state?.isLoading) {
      try {
        this.setState({ isLoading: false });
        if (typeof updateLoadingControls === 'function') {
          updateLoadingControls(this, false);
        }
      } catch (err) {
        console.warn('Error resetting loading state:', err);
      }
    }
    
    // Clean up worker system if we're the last browser component
    this.cleanupWorkerSystem();
    
    // Final nullification of critical references
    this.webview = null;
    this.iframe = null;
    this.webviewContainer = null;
    
    console.log('Voyager browser component cleanup completed');
  }

  /**
   * Clean up webview event listeners safely
   */
  cleanupWebviewEventListeners() {
    if (!this.webview) return;
    
    try {
      // Standard events
      if (this.handleLoadStart) {
        this.webview.removeEventListener('did-start-loading', this.handleLoadStart);
      }
      if (this.handleLoadStop) {
        this.webview.removeEventListener('did-stop-loading', this.handleLoadStop);
      }
      if (this.handlePageNavigation) {
        this.webview.removeEventListener('did-navigate', this.handlePageNavigation);
      }
      if (this.handleWebviewLoad) {
        this.webview.removeEventListener('did-finish-load', this.handleWebviewLoad);
      }
      if (this.handleDidFailLoad) {
        this.webview.removeEventListener('did-fail-load', this.handleDidFailLoad);
      }
      if (this.handleCertificateError) {
        this.webview.removeEventListener('certificate-error', this.handleCertificateError);
      }
      
      // Additional events that might have been added
      if (this.handleDomReady) {
        this.webview.removeEventListener('dom-ready', this.handleDomReady);
      }
      if (this.handleDestroyed) {
        this.webview.removeEventListener('destroyed', this.handleDestroyed);
      }
      
      console.log('Webview event listeners cleaned up successfully');
    } catch (err) {
      console.warn('Error removing event listeners from webview:', err);
    }
  }

  /**
   * Clean up webview element safely
   */
  cleanupWebview() {
    if (!this.webview) return;
    
    try {
      console.log('Cleaning up webview element...');
      
      // Hide webview first to prevent visual glitches
      this.webview.style.visibility = 'hidden';
      this.webview.style.opacity = '0';
      this.webview.style.display = 'none';
      
      // Only attempt to stop if webview is properly attached and ready
      const isWebviewReady = this.webview.isConnected && 
                            (this.webview.readyState === 'complete' || 
                             this.webview.dataset.domReady === 'true' ||
                             this.webview._domReady === true);
      
      if (isWebviewReady) {
        try {
          // Try to stop the webview gracefully
          if (typeof this.webview.stop === 'function') {
            this.webview.stop();
          }
        } catch (stopError) {
          // Log the error but don't throw - this is expected if webview isn't ready
          console.log('Webview stop not available (expected if not ready):', stopError.message);
        }
      } else {
        console.log('Skipping webview stop - webview not ready or not attached');
      }
      
      // Remove webview from DOM if possible and if it has a parent
      if (this.webview.parentNode && document.contains(this.webview)) {
        try {
          this.webview.parentNode.removeChild(this.webview);
          console.log('Webview removed from DOM successfully');
        } catch (removeErr) {
          console.warn('Error removing webview from DOM:', removeErr);
        }
      }
      
    } catch (err) {
      console.warn('Error cleaning up webview element:', err);
    }
  }

  /**
   * Clean up iframe element safely
   */
  cleanupIframe() {
    if (!this.iframe) return;
    
    try {
      this.iframe.style.visibility = 'hidden';
      this.iframe.style.opacity = '0';
      this.iframe.style.display = 'none';
      
      if (this.iframe.parentNode) {
        this.iframe.parentNode.removeChild(this.iframe);
      }
      console.log('Iframe cleaned up successfully');
    } catch (err) {
      console.warn('Error cleaning up iframe element:', err);
    }
  }

  /**
   * Clean up container contents safely
   */
  cleanupContainer() {
    if (!this.containerRef || !this.containerRef.current) return;
    
    try {
      // Only clear container if it's still connected to the DOM
      if (this.containerRef.current.isConnected) {
        while (this.containerRef.current.firstChild) {
          this.containerRef.current.removeChild(this.containerRef.current.firstChild);
        }
        console.log('Container contents cleaned up successfully');
      }
    } catch (err) {
      console.warn('Error cleaning up container contents:', err);
    }
  }

  /**
   * Clean up research panel safely
   */
  cleanupResearchPanel() {
    try {
      // Clean up research panel if it exists
      if (this.researchPanel && this.researchPanel.isConnected) {
        this.researchPanel.remove();
        this.researchPanel = null;
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
      
      console.log('Research panel cleaned up successfully');
    } catch (err) {
      console.warn('Error cleaning up research panel:', err);
    }
  }

  /**
   * Clean up tab manager button safely
   */
  cleanupTabManagerButton() {
    try {
      const actionButtonsContainer = document.querySelector('.browser-action-buttons');
      if (actionButtonsContainer) {
        const tabManagerContainer = actionButtonsContainer.querySelector('.tab-manager-container');
        if (tabManagerContainer && tabManagerContainer.parentNode) {
          tabManagerContainer.parentNode.removeChild(tabManagerContainer);
          console.log('Tab manager container removed successfully');
        }
      }
      
      // Clean up React root if it exists
      if (this._tabManagerRoot) {
        try {
          this._tabManagerRoot.unmount();
          this._tabManagerRoot = null;
        } catch (err) {
          console.warn('Error unmounting tab manager React root:', err);
        }
      }
    } catch (err) {
      console.warn('Error cleaning up tab manager button:', err);
    }
  }

  /**
   * Clean up worker system if this is the last browser instance
   */
  cleanupWorkerSystem() {
    try {
      const otherInstances = document.querySelectorAll('.voyager-browser');
      if (otherInstances.length <= 1) {
        console.log('Last browser instance closing, cleaning up worker system');
        if (WorkerManager && typeof WorkerManager.cleanup === 'function') {
          WorkerManager.cleanup();
        }
      }
    } catch (err) {
      console.warn('Error cleaning up worker system:', err);
    }
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
    // Early return if component is unloading to prevent rendering during cleanup
    if (this._isUnloading) {
      console.log('Voyager render called during unloading, returning null');
      return null;
    }
    
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
    
    // Get tab data for rendering with error handling
    let tabData;
    try {
      tabData = this.tabManager ? this.tabManager.getSerializedTabData() : {
        tabs: [],
        activeTabId: null,
        onTabClick: this.handleTabClick,
        onTabClose: this.handleTabClose,
        onNewTab: this.handleNewTab
      };
    } catch (error) {
      console.warn('Error getting tab data:', error);
      tabData = {
        tabs: [],
        activeTabId: null,
        onTabClick: this.handleTabClick,
        onTabClose: this.handleTabClose,
        onNewTab: this.handleNewTab
      };
    }
    
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
      <VoyagerErrorBoundary browserId={this.browserId}>
        <div 
          className={`voyager-browser ${className}`} 
          style={containerStyle}
          ref={this.containerRef}
          id={`voyager-${this.browserId}`}
        >
          {/* CRITICAL FIX: Remove TabBar from here - it's already rendered by TabBarRenderer */}
          {/* TabBar is now handled exclusively by TabBarRenderer.js to prevent dual rendering conflicts */}

          {/* Note: Address bar is now created by BrowserRenderer.createBrowserHeader */}
          {/* and is positioned at the top of the component */}

          {/* Browser chrome (toolbar) */}
          {showToolbar && (
            <VoyagerErrorBoundary browserId={`${this.browserId}-toolbar`}>
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
            </VoyagerErrorBoundary>
          )}
          
          {/* Browser content area */}
          <VoyagerErrorBoundary browserId={`${this.browserId}-content`}>
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
                  <h1>{this.state?.title || 'Loading...'}</h1>
                  <div 
                    className="reader-content"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(this.state?.readerContent || '<p>No content available for reader view</p>') 
                    }}
                  />
                </div>
              )}
              
              {/* Loading indicator */}
              {this.state?.isLoading && (
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
              {this.state?.errorState && (
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
                    try {
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
                    } catch (err) {
                      console.warn('Error rendering error page:', err);
                    }
                    return null; // Error page is rendered through the ErrorHandler
                  })()}
                </div>
              )}
            </div>
          </VoyagerErrorBoundary>
          
          {/* Status bar */}
          {showStatusBar && (
            <VoyagerErrorBoundary browserId={`${this.browserId}-statusbar`}>
              <div className="voyager-status-bar" style={{
                padding: '4px 8px',
                backgroundColor: '#f5f5f5',
                borderTop: '1px solid #ddd',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <div>{this.state?.url || ''}</div>
                <div>
                  {this.state?.isLoading ? 'Loading...' : 'Ready'}
                  {tabData.tabs.length > 1 && (
                    <span style={{ marginLeft: '10px' }}>
                      {tabData.tabs.length} tabs
                    </span>
                  )}
                </div>
              </div>
            </VoyagerErrorBoundary>
          )}

          {/* Research component initialization */}
          {/* Note: Researcher is initialized programmatically in initializeResearcher() method */}
          {/* It manages its own DOM and doesn't need to be rendered through React */}
        </div>
      </VoyagerErrorBoundary>
    );
  }

  /**
   * Create webview element using ONLY WebviewInitializer (centralized approach)
   * This method is called by VoyagerLifecycle during initialization
   */
  createWebviewElement() {
    try {
      // CRITICAL FIX: Use ONLY WebviewInitializer to prevent conflicts
      const WebviewInitializer = require('./handlers/WebviewInitializer');
      
      if (WebviewInitializer && typeof WebviewInitializer.default?.createWebview === 'function') {
        console.log('Creating webview via centralized WebviewInitializer');
        const webview = WebviewInitializer.default.createWebview(this);
        
        if (webview && (webview.isConnected || document.contains(webview))) {
          this.webview = webview;
          
          // Update WorkerManager reference ONCE
          if (WorkerManager && !WorkerManager.webviewRef) {
            WorkerManager.webviewRef = this.webview;
            WorkerManager.hasWebview = true;
            console.log('Updated WorkerManager webview reference');
          }
          
          console.log('Webview created successfully via WebviewInitializer');
          return webview;
        } else {
          console.warn('WebviewInitializer returned disconnected webview');
          return null;
        }
      } else {
        console.error('WebviewInitializer not available');
        return null;
      }
    } catch (err) {
      console.error('Error in createWebviewElement:', err);
      return null;
    }
  }

  /**
   * Initialize browser content (fallback method for VoyagerLifecycle)
   */
  initBrowserContent() {
    try {
      console.log('Initializing browser content via initBrowserContent fallback');
      
      // Use WebviewInitializer if available
      const WebviewInitializer = require('./handlers/WebviewInitializer');
      if (WebviewInitializer && typeof WebviewInitializer.createWebview === 'function') {
        const webview = WebviewInitializer.createWebview(this);
        
        if (webview && (webview.isConnected || document.contains(webview))) {
          this.webview = webview;
          console.log('Browser content initialized successfully via WebviewInitializer');
          return true;
        }
      }
      
      // Fallback to createWebviewElement with proper DOM insertion
      const webview = this.createWebviewElement();
      
      if (webview && (webview.isConnected || document.contains(webview))) {
        console.log('Browser content initialized successfully via createWebviewElement fallback');
        return true;
      }
      
      console.warn('Could not initialize browser content - no webview created or connected');
      return false;
    } catch (err) {
      console.error('Error in initBrowserContent:', err);
      return false;
    }
  }

  /**
   * Force browser initialization (last resort method for VoyagerLifecycle)
   */
  forceInitBrowser() {
    try {
      console.log('Force initializing browser via forceInitBrowser');
      
      // Get webview container with better detection
      const webviewContainer = this.containerRef.current?.querySelector('.browser-webview-container') ||
                               this.containerRef.current?.querySelector('.browser-content') ||
                               this.containerRef.current?.querySelector('.voyager-content') ||
                               this.containerRef.current;
      
      if (!webviewContainer) {
        console.error('No webview container found for force initialization');
        return false;
      }
      
      // Use WebviewInitializer directly if available
      const WebviewInitializer = require('./handlers/WebviewInitializer');
      if (WebviewInitializer && typeof WebviewInitializer.initializeWebview === 'function') {
        const webview = WebviewInitializer.initializeWebview(this, webviewContainer);
        
        if (webview && (webview.isConnected || document.contains(webview))) {
          this.webview = webview;
          console.log('Browser force initialized successfully via WebviewInitializer');
          return true;
        }
      }
      
      // Fallback to createWebviewElement approach
      const webview = this.createWebviewElement();
      
      if (webview && (webview.isConnected || document.contains(webview))) {
        console.log('Browser force initialized successfully via createWebviewElement');
        return true;
      }
      
      console.error('Force initialization failed - could not create or connect webview');
      return false;
    } catch (err) {
      console.error('Error in forceInitBrowser:', err);
      return false;
    }
  }

  /**
   * Handle tab click from tab bar
   * @param {string} tabId - ID of tab to switch to
   */
  handleTabClick(tabId) {
    if (this.tabManager) {
      this.tabManager.switchToTab(tabId);
    }
  }
  
  /**
   * Handle tab close from tab bar
   * @param {string} tabId - ID of tab to close
   */
  handleTabClose(tabId) {
    if (this.tabManager) {
      this.tabManager.closeTab(tabId);
    }
  }
  
  /**
   * Handle new tab creation from tab bar
   */
  handleNewTab() {
    if (this.tabManager) {
      this.tabManager.createTab();
    }
  }

  /**
   * Initialize tab manager with cleaner integration
   */
  initializeTabManager() {
    if (this.tabManager) {
      console.log('Tab manager already initialized, skipping');
      return;
    }

    try {
      // CRITICAL FIX: Check if tab manager was already created by BrowserLayoutManager
      // This prevents multiple VoyagerTabManager instances that cause content capture issues
      if (this.tabManager) {
        console.log('Using existing tab manager instance from BrowserLayoutManager');
        // Set up event listeners for the existing instance
        this.setupTabManagerEventListeners();
        return;
      }

      // Create tab manager instance only if none exists
      console.log('Creating new VoyagerTabManager instance');
      this.tabManager = new VoyagerTabManager(this);
      
      // Set up event listeners
      this.setupTabManagerEventListeners();
      
      // Integrate with data preservation system
      if (window.enhanceTabManagement && typeof window.enhanceTabManagement === 'function') {
        console.log('🔍 Integrating tab manager with data preservation system');
        window.enhanceTabManagement(this.tabManager);
      }
      
      console.log('Tab manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize tab manager:', error);
      // Create a minimal fallback
      this.tabManager = null;
    }
  }

  /**
   * Set up tab manager event listeners (extracted for reuse)
   */
  setupTabManagerEventListeners() {
    if (!this.tabManager) {
      console.warn('Cannot set up tab manager event listeners - no tab manager instance');
      return;
    }

    // Set up event listeners with proper cleanup tracking
    this._tabEventListeners = this._tabEventListeners || [];
    
    // Subscribe to tab manager events with cleanup tracking
    const tabsUpdatedHandler = (event) => {
      const { tabs, activeTabId } = event.detail;
      this.setState({ tabs, activeTabId });
    };
    
    const tabSwitchedHandler = (event) => {
      const { tab } = event.detail;
      console.log('Switching to tab:', tab.title);
      // Navigation is handled by the tab manager itself
    };
    
    // Add listeners and track them for cleanup
    this.tabManager.addEventListener('tabsUpdated', tabsUpdatedHandler);
    this.tabManager.addEventListener('tabSwitched', tabSwitchedHandler);
    
    // Store references for cleanup
    this._tabEventListeners.push(
      { type: 'tabsUpdated', handler: tabsUpdatedHandler },
      { type: 'tabSwitched', handler: tabSwitchedHandler }
    );
    
    console.log('Tab manager event listeners set up successfully');
  }

  /**
   * Clean up tab manager and its event listeners
   */
  cleanupTabManager() {
    if (this._tabEventListeners && this.tabManager) {
      // Remove all tracked event listeners
      this._tabEventListeners.forEach(({ type, handler }) => {
        try {
          this.tabManager.removeEventListener?.(type, handler);
        } catch (error) {
          console.warn(`Failed to remove ${type} listener:`, error);
        }
      });
      this._tabEventListeners = [];
    }
    
    // Clean up tab manager instance
    if (this.tabManager && typeof this.tabManager.cleanup === 'function') {
      try {
        this.tabManager.cleanup();
      } catch (error) {
        console.warn('Error cleaning up tab manager:', error);
      }
    }
    
    this.tabManager = null;
  }

  /**
   * Integrate this browser instance with the data preservation system
   */
  integrateWithDataPreservation() {
    try {
      // Enhance VoyagerLifecycle with data preservation
      if (window.enhanceVoyagerLifecycle && typeof window.enhanceVoyagerLifecycle === 'function') {
        console.log('🔍 Integrating Voyager browser with data preservation system');
        window.enhanceVoyagerLifecycle(this);
        
        // Add this browser to global tracking
        if (!window.voyagerBrowsers) {
          window.voyagerBrowsers = [];
        }
        
        // Ensure this browser is tracked
        const existingBrowser = window.voyagerBrowsers.find(b => b.browserId === this.browserId);
        if (!existingBrowser) {
          window.voyagerBrowsers.push(this);
          console.log(`✅ Browser ${this.browserId} added to data preservation tracking`);
        }
      } else {
        console.warn('Data preservation enhancement not available - system may not be initialized');
      }
    } catch (error) {
      console.warn('Failed to integrate with data preservation system:', error);
    }
  }
}

// Set default props
Voyager.defaultProps = {
  initialUrl: 'https://www.google.com',
  notificationService: null
};

export default Voyager; 