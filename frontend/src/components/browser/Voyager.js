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

// Import browser component utilities
import { 
  detectEnvironment, 
  applySandboxSettings, 
  formatUrl, 
  applySiteSpecificSettings
} from './utils/BrowserEnv';

import {
  cleanupHtmlForMemory,
  sanitizeUrlForAnalysis
} from './utils/ContentUtils';

import {
  handleTraverseHistory,
  handleBackAction,
  handleForwardAction,
  updateVisitedUrls,
  createHistoryRecord
} from './utils/HistoryManager';

import {
  extractPageContent,
  extractMainContent,
  extractHeadingStructure,
  extractFullPageContent
} from './handlers/ContentExtractor';

import {
  handleBookmarkCreation,
  updateBookmarksPanel
} from './utils/BookmarkManager';

import {
  renderHtml,
  createSafeIframe,
  renderContentView
} from './renderers/ContentRenderer';

import {
  setupBrowserLayout,
  setupNavigationBar,
  setupWebViewContainer,
  updateAddressBar,
  updateLoadingIndicator,
  updatePageTitle
} from './renderers/BrowserRenderer';

import {
  renderErrorPage
} from './renderers/ErrorPageRenderer';

import {
  handleLoadStart,
  handleLoadStop,
  handlePageNavigation,
  handleWebviewLoad,
  handleWebviewError,
  updateNavigationButtons
} from './handlers/EventHandlers';

class Voyager extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      url: props?.initialUrl || 'https://www.google.com',
      title: 'Loading...',
      isLoading: false,
      history: [],
      historyPosition: -1,
      errorState: null,
      viewMode: 'browser', // 'browser', 'reader', 'split'
      readerContent: null,
      bookmarks: [],
      // Track if the component is mounted
      isMounted: false,
      // Environment detection results
      environment: detectEnvironment()
    };
    
    // Create unique ID for component
    this.browserId = nanoid();
    
    // References
    this.containerRef = React.createRef();
    this.webview = null;
    this.iframe = null;
    this.addressInput = null;
    
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
    this.initialize = this.initialize.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }
  
  componentDidMount() {
    this.setState({ isMounted: true }, () => {
      // Now that state is updated, we can initialize
      this.initialize();
    });
  }
  
  componentWillUnmount() {
    this.setState({ isMounted: false });
    
    // Clean up any event listeners
    if (this.webview) {
      this.webview.removeEventListener('did-start-loading', this.handleLoadStart);
      this.webview.removeEventListener('did-stop-loading', this.handleLoadStop);
      this.webview.removeEventListener('did-navigate', this.handlePageNavigation);
      this.webview.removeEventListener('did-finish-load', this.handleWebviewLoad);
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
    
    // Apply site-specific settings
    applySiteSpecificSettings.call(this, formattedUrl);
    
    // Update state
    this.setState({ 
      url: formattedUrl,
      isLoading: true,
      errorState: null
    });
    
    // Update address bar display
    updateAddressBar(this, formattedUrl);
    
    // Update loading indicator
    updateLoadingIndicator(this, true);
    
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
            updateLoadingIndicator(this, false);
            
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
                  updateLoadingIndicator(this, false);
                  
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
                          updatePageTitle(this, result.title);
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
    
    // Update history
    updateVisitedUrls(this, formattedUrl);
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
      if (!this.state.isLoading) {
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
      if (this.webview.tagName?.toLowerCase() === 'webview' && 
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
              updatePageTitle(this, result.title);
            }
            
            // Update loading state
            this.setState({ isLoading: false });
            updateLoadingIndicator(this, false);
            
            // Make webview fully visible
            if (typeof this.webview.applyAllCriticalStyles === 'function') {
              this.webview.applyAllCriticalStyles(true);
            }
            
            // Capture content
            this.capturePageContent();
            
            // Clear navigation timeout
            if (this._navigationTimeout) {
              clearTimeout(this._navigationTimeout);
              this._navigationTimeout = null;
            }
            
            // Clear detection interval
            if (this._loadDetectionInterval) {
              clearInterval(this._loadDetectionInterval);
            }
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
    updateLoadingIndicator(this, true);
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
      updateLoadingIndicator(this, false);
    }
  }
  
  /**
   * Handle submission of address bar input
   * @param {Event} event - Form submission event
   */
  handleAddressSubmit(event) {
    event.preventDefault();
    const url = this.addressInput ? this.addressInput.value : '';
    if (url) {
      this.navigate(url);
    }
  }
  
  /**
   * Handle changes to address bar input
   * @param {Event} event - Input change event
   */
  handleAddressChange(event) {
    // Just update the input field, don't navigate yet
    // Navigation happens on form submission
  }
  
  /**
   * Handle webview/iframe load completion
   * @param {Event} event - Load event
   */
  handleWebviewLoad(event) {
    console.log('Webview loaded:', this.state.url);
    
    // Update UI state
    this.setState({ isLoading: false });
    updateLoadingIndicator(this, false);
    
    // Capture page content and title for memory
    this.capturePageContent();
    
    // Add to browsing history
    const historyRecord = createHistoryRecord(
      this.state.url, 
      this.state.title, 
      new Date().toISOString()
    );
    
    // Notify parent component if callback provided
    if (this.props.onPageLoad) {
      this.props.onPageLoad(historyRecord);
    }
  }
  
  /**
   * Captures and processes the content of the current page
   */
  capturePageContent() {
    if (this.webview) {
      // Extract content using the webview's executeJavaScript method
      this.webview.executeJavaScript(`
        {
          const title = document.title;
          const html = document.documentElement.outerHTML;
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .map(h => ({ level: h.tagName.toLowerCase(), text: h.textContent.trim() }));
          
          { title, html, headings }
        }
      `).then(result => {
        if (!result) return;
        
        // Update page title
        this.setState({ title: result.title || 'Untitled Page' });
        updatePageTitle(this, result.title || 'Untitled Page');
        
        // Clean up HTML for memory storage
        const cleanHtml = cleanupHtmlForMemory(result.html);
        
        // Extract main content
        const mainContent = extractMainContent(cleanHtml);
        
        // Update state with reader content
        this.setState({ readerContent: mainContent });
        
        // Capture page metadata for memory
        if (this.props.onContentCapture) {
          const content = {
            url: this.state.url,
            title: result.title,
            html: cleanHtml,
            mainContent: mainContent,
            headings: result.headings || [],
            capturedAt: new Date().toISOString()
          };
          this.props.onContentCapture(content);
        }
      }).catch(err => {
        console.error('Error capturing page content:', err);
      });
    } else if (this.iframe) {
      // For iframe, we have more limited access due to same-origin policy
      try {
        const title = this.iframe.contentDocument.title;
        this.setState({ title: title || 'Untitled Page' });
        updatePageTitle(this, title || 'Untitled Page');
        
        // We might not be able to extract content from cross-origin iframes
        if (this.props.onContentCapture) {
          const content = {
            url: this.state.url,
            title: title,
            html: '<p>Content extraction not available for this page</p>',
            mainContent: '<p>Content extraction not available for this page</p>',
            headings: [],
            capturedAt: new Date().toISOString()
          };
          this.props.onContentCapture(content);
        }
      } catch (err) {
        console.log('Cannot access iframe content due to same-origin policy');
      }
    }
  }
  
  /**
   * Toggle reader mode
   */
  toggleReaderMode() {
    const currentMode = this.state.viewMode;
    let newMode;
    
    if (currentMode === 'browser') {
      newMode = 'reader';
    } else if (currentMode === 'reader') {
      newMode = 'split';
    } else {
      newMode = 'browser';
    }
    
    this.setState({ viewMode: newMode });
    
    // If entering reader mode and we don't have content yet, try to fetch it
    if ((newMode === 'reader' || newMode === 'split') && !this.state.readerContent) {
      this.capturePageContent();
    }
  }
  
  /**
   * Initialize the browser component
   * Called by the parent App component when navigating to browser view
   */
  initialize() {
    console.log('Initializing Voyager browser component');
    
    // Check if component is already initialized
    if (this._isInitialized) {
      console.log('Voyager browser already initialized, skipping');
      return;
    }
    
    // Make sure component is mounted
    if (!this.containerRef?.current) {
      console.warn('Cannot initialize Voyager - container not mounted');
      
      // Try to initialize again after a short delay with increasing backoff
      if (!this._initAttempts) {
        this._initAttempts = 0;
      }
      
      this._initAttempts++;
      const delay = Math.min(this._initAttempts * 100, 1000); // Increasing delay with cap at 1000ms
      
      if (this._initAttempts < 20) { // Limit retries to prevent infinite loop
        setTimeout(() => {
          if (this.containerRef?.current) {
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
    
    // Set up browser layout
    setupBrowserLayout(this);
    
    // Set up navigation bar
    setupNavigationBar(this);
    
    // Set up webview container
    setupWebViewContainer(this);
    
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
          updateLoadingIndicator(this, true);
        };
        
        this.handleLoadStop = (e) => {
          this.setState({ isLoading: false });
          updateLoadingIndicator(this, false);
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
        
        console.log('Event handlers properly bound to webview');
      }
    }
    
    // Bind button event handlers in the header
    const backButton = this.header?.querySelector('.browser-back-btn');
    const forwardButton = this.header?.querySelector('.browser-forward-btn');
    const refreshButton = this.header?.querySelector('.browser-refresh-btn');
    const stopButton = this.header?.querySelector('.browser-stop-btn');
    
    if (backButton) backButton.addEventListener('click', this.handleBackAction);
    if (forwardButton) forwardButton.addEventListener('click', this.handleForwardAction);
    if (refreshButton) refreshButton.addEventListener('click', this.refreshPage);
    if (stopButton) stopButton.addEventListener('click', this.stopLoading);
    
    // Set initial URL if provided - with a delay to ensure webview is fully mounted
    if (this.props?.initialUrl && this.props.initialUrl !== 'about:blank') {
      // Enhanced timing to ensure webview is properly set up before navigation
      setTimeout(() => {
        // Double-check that webview still exists and is connected to DOM
        if (this.webview && this.webview.isConnected) {
          this.navigate(this.props.initialUrl);
        }
      }, 500);
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
    this.hasNavigatedInitially = false;
    
    // Remove any event listeners
    if (this.webview) {
      this.webview.removeEventListener('did-start-loading', this.handleLoadStart);
      this.webview.removeEventListener('did-stop-loading', this.handleLoadStop);
      this.webview.removeEventListener('did-navigate', this.handlePageNavigation);
      this.webview.removeEventListener('did-finish-load', this.handleWebviewLoad);
    }
    
    // Clear any active timers and intervals
    if (this._navigationTimeout) {
      clearTimeout(this._navigationTimeout);
      this._navigationTimeout = null;
    }
    
    if (this._loadDetectionInterval) {
      clearInterval(this._loadDetectionInterval);
      this._loadDetectionInterval = null;
    }
    
    // Hide browser elements
    if (this.webview) {
      this.webview.style.visibility = 'hidden';
      this.webview.style.opacity = '0';
    }
    
    if (this.iframe) {
      this.iframe.style.visibility = 'hidden';
      this.iframe.style.opacity = '0';
    }
    
    // Unmount React component if ReactDOM is available
    const browserMount = document.getElementById('browser-mount');
    if (browserMount && window.ReactDOM && window.ReactDOM.unmountComponentAtNode) {
      try {
        window.ReactDOM.unmountComponentAtNode(browserMount);
      } catch (err) {
        console.warn('Error unmounting browser component:', err);
      }
    }
    
    // Remove any stand-alone browser containers that might be in the body
    const browserContainers = document.querySelectorAll('body > .browser-container');
    browserContainers.forEach(container => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });
    
    // Reset loading state if needed
    if (this.state?.isLoading) {
      this.setState({ isLoading: false });
      updateLoadingIndicator(this, false);
    }
  }
  
  handleDidFailLoad = (e) => {
    console.error('Webview failed to load:', e);
    
    // Check if this is an actual error
    if (e && e.errorCode !== -3) { // Ignore -3 error (aborted navigation)
      console.error(`Load failed with error code: ${e.errorCode}, description: ${e.errorDescription}`);
      
      // Set error state
      this.setState({ 
        loading: false,
        loadError: true,
        errorCode: e.errorCode,
        errorDescription: e.errorDescription || 'Failed to load page'
      });
      
      // Render error page in the webview if possible
      if (this.webview && typeof this.webview.executeJavaScript === 'function') {
        try {
          // Get the error details
          const errorCode = e.errorCode || 'unknown';
          const errorDesc = e.errorDescription || 'An error occurred while loading this page';
          const validatedUrl = this.state.currentUrl || 'Unknown URL';
          
          // Create error page HTML using template literal
          const errorPageHtml = `
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  margin: 0;
                  padding: 20px;
                  background-color: #f7f7f7;
                  color: #333;
                }
                .error-container {
                  max-width: 800px;
                  margin: 40px auto;
                  background-color: white;
                  border-radius: 8px;
                  padding: 20px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 {
                  margin-top: 0;
                  color: #d32f2f;
                  font-size: 24px;
                }
                p {
                  line-height: 1.6;
                }
                .error-code {
                  font-family: monospace;
                  background-color: #f1f1f1;
                  padding: 4px 8px;
                  border-radius: 4px;
                }
                .retry-btn {
                  background-color: #2196f3;
                  color: white;
                  border: none;
                  padding: 10px 16px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 14px;
                  margin-top: 20px;
                }
                .retry-btn:hover {
                  background-color: #1976d2;
                }
              </style>
            </head>
            <body>
              <div class="error-container">
                <h1>Page Load Failed</h1>
                <p>The browser encountered an error while trying to load <strong>${validatedUrl}</strong></p>
                <p>Error: <span class="error-code">${errorCode}</span> - ${errorDesc}</p>
                <p>Possible solutions:</p>
                <ul>
                  <li>Check your internet connection</li>
                  <li>Refresh the page</li>
                  <li>Try a different URL</li>
                </ul>
                <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
              </div>
            </body>
            </html>
          `;
          
          // Execute JavaScript to replace the page content with our error page
          this.webview.executeJavaScript(`
            (function() {
              // Replace entire document content with error page
              document.open();
              document.write(${JSON.stringify(errorPageHtml)});
              document.close();
              
              // Prevent further navigation
              window.stop();
              
              // Override navigation functions to prevent changes
              history.pushState = function() { console.log('Navigation prevented'); };
              history.replaceState = function() { console.log('Navigation prevented'); };
              
              console.log('Error page rendered');
            })();
          `)
          .catch(err => {
            console.error('Failed to inject error page:', err);
          });
        } catch (err) {
          console.error('Error injecting error page:', err);
        }
      } else {
        console.warn('Cannot render error page - webview not available or missing executeJavaScript');
      }
      
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
  
  render() {
    // Destructure props for easier access and defaults
    const { 
      className = '',
      style = {},
      showToolbar = true,
      showAddressBar = true,
      showStatusBar = true,
      height = '100%'
    } = this.props || {};
    
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
        {/* Browser chrome (toolbar, address bar) */}
        {showToolbar && (
          <div className="voyager-toolbar" style={{
            display: 'flex',
            padding: '8px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #ddd'
          }}>
            {/* Navigation buttons */}
            <button onClick={() => handleBackAction(this)} style={{ marginRight: '4px' }}>◀</button>
            <button onClick={() => handleForwardAction(this)} style={{ marginRight: '8px' }}>▶</button>
            <button onClick={this.refreshPage} style={{ marginRight: '8px' }}>↻</button>
            <button onClick={this.stopLoading} style={{ marginRight: '8px' }}>✕</button>
            
            {/* Address bar */}
            {showAddressBar && (
              <form onSubmit={this.handleAddressSubmit} style={{ flex: 1, display: 'flex' }}>
                <input 
                  type="text"
                  className="voyager-address-bar"
                  defaultValue={this.state.url}
                  onChange={this.handleAddressChange}
                  style={{ flex: 1, padding: '4px 8px' }}
                  ref={el => this.addressInput = el}
                />
              </form>
            )}
            
            {/* Reader mode toggle */}
            <button onClick={this.toggleReaderMode} style={{ marginLeft: '8px' }}>
              📖
            </button>
            
            {/* Bookmark button */}
            <button onClick={() => handleBookmarkCreation(this)} style={{ marginLeft: '8px' }}>
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
              flex: this.state.viewMode === 'reader' ? 0 : (this.state.viewMode === 'split' ? 1 : 1),
              display: this.state.viewMode === 'reader' ? 'none' : 'block',
              height: '100%',
              position: 'relative'
            }}
          >
            {/* This div will be populated with webview or iframe */}
          </div>
          
          {/* Reader view */}
          {(this.state.viewMode === 'reader' || this.state.viewMode === 'split') && (
            <div 
              className="voyager-reader-view"
              style={{
                flex: this.state.viewMode === 'browser' ? 0 : (this.state.viewMode === 'split' ? 1 : 1),
                display: this.state.viewMode === 'browser' ? 'none' : 'block',
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
          
          {/* Error state */}
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
              <h2>Browser Error</h2>
              <p>Error Code: {this.state.errorState.code}</p>
              <p>URL: {this.state.errorState.url}</p>
              <p>{this.state.errorState.message}</p>
              <button onClick={() => this.navigate(this.state.url)}>Try Again</button>
              <button onClick={() => this.setState({ errorState: null })}>Dismiss</button>
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