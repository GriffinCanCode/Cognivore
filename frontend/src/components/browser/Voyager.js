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

// Import researcher component and research panel styles
import Researcher from './researcher/Researcher';

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

import {
  handleBookmarkCreation,
} from './utils/BookmarkManager';

import {
  renderHtml,
} from './renderers/ContentRenderer';

import {
  setupBrowserLayout,
  setupNavigationBar,
  setupWebViewContainer,
  updateAddressBar,
  updateLoadingIndicator,
  updatePageTitle as updatePageTitleRenderer
} from './renderers/BrowserRenderer';

import { toggleReaderMode, setReaderMode, getReaderMode, isReaderModeActive as checkReaderModeActive } from './handlers/ReaderModeManager';
import ExtractorManager from './extraction/ExtractorManager';

// Import specific event handlers
const { 
  handleLoadStart, 
  handleLoadStop, 
  handlePageNavigation, 
  handleWebviewLoad, 
  handleWebviewError,
  updateNavigationButtons
} = EventHandlers;

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
  }
  
  componentDidMount() {
    console.log(`Voyager browser component mounted (ID: ${this.browserId})`);
    
    // Set isMounted state to enable rendering of child components
    this.setState({
      isMounted: true
    }, () => {
      // Initialize the browser once state is updated
      this.initialize();
    });
    
    // Ensure we have the correct initial view mode
    if (!this.state.viewMode) {
      this.setState({ viewMode: 'browser' });
    }
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
    
    // Call BrowserRenderer version if available
    try {
      if (typeof updatePageTitleRenderer === 'function') {
        updatePageTitleRenderer(this, title);
      }
    } catch (err) {
      // Silently handle import errors
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
              this.updatePageTitle(result.title);
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
      updateLoadingIndicator(this, false);
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
   * Handle webview/iframe load completion
   * @param {Event} event - Load event
   */
  handleWebviewLoad(event) {
    console.log('Webview loaded:', this.state.url);
    
    // Update UI state
    this.setState({ isLoading: false });
    updateLoadingIndicator(this, false);
    
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
    
    // Notify parent component if callback provided - fix the null check
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
   * Captures and processes the content of the current page
   * @returns {Promise<Object>} Promise resolving to the captured content
   */
  capturePageContent() {
    // Use ExtractorManager directly to extract content
    return ExtractorManager.extract(this, this.state?.url || '')
      .then(result => {
        // Format the result to match the expected API
        return {
          title: result.title || this.state?.title || 'Untitled Page',
          url: result.url || this.state?.url || '',
          text: result.text || '',
          processedContent: result.html || result.text || '',
          timestamp: result.timestamp || new Date().toISOString()
        };
      })
      .catch(error => {
        console.error('Content extraction error:', error);
        // Return minimal content in case of error
        return {
          title: this.state?.title || 'Untitled Page',
          url: this.state?.url || '',
          text: 'Content extraction failed. The page might be too complex or require authentication.',
          processedContent: '<p>Content extraction failed. The page might be too complex or require authentication.</p>'
        };
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
        currentUrl: this.state?.url,
        currentTitle: this.state?.title,
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
  initialize() {
    console.log('Initializing Voyager browser component');
    
    // Check if component is already initialized
    if (this._isInitialized) {
      console.log('Voyager browser already initialized, skipping');
      return;
    }
    
    // Make sure component is mounted
    if (!this.containerRef?.current || !this.containerRef.current.isConnected) {
      console.warn('Cannot initialize Voyager - container not mounted');
      
      // Try to initialize again after a short delay with increasing backoff
      if (!this._initAttempts) {
        this._initAttempts = 0;
      }
      
      this._initAttempts++;
      const delay = Math.min(this._initAttempts * 200, 2000); // Increasing delay with cap at 2000ms (up from 1000ms)
      
      if (this._initAttempts < 20) { // Limit retries to prevent infinite loop
        console.log(`Retry #${this._initAttempts} scheduled in ${delay}ms`);
        setTimeout(() => {
          // Double-check if component wasn't cleaned up in the meantime
          if (!this._isUnloading) {
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
    
    // Log container details for debugging
    console.log('Container ready for setup:', {
      id: this.containerRef.current.id,
      isConnected: this.containerRef.current.isConnected,
      dimensions: `${this.containerRef.current.offsetWidth}x${this.containerRef.current.offsetHeight}`
    });
    
    // Set up browser layout
    setupBrowserLayout(this);
    
    // Set up navigation bar
    setupNavigationBar(this);
    
    // Set up webview container
    setupWebViewContainer(this);
    
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
          const ReactDOM = require('react-dom');
          ReactDOM.render(
            <TabManagerButton 
              voyager={this} 
              tabManager={this.tabManager.getTabManager()} 
            />,
            tabManagerContainer
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
    
    // Always load Google.com on startup, regardless of initialUrl
    setTimeout(() => {
      // Double-check that webview still exists and is connected to DOM
      if (this.webview && this.webview.isConnected) {
        this.navigate('https://www.google.com');
      } else {
        console.warn('Webview not connected to DOM, delaying navigation');
        // Try one more time with longer delay
        setTimeout(() => {
          if (this.webview && this.webview.isConnected) {
            this.navigate('https://www.google.com');
          }
        }, 500);
      }
    }, 800); // Increased from 500ms to 800ms for better reliability
    
    // Initialize researcher component if needed
    if (!this.researcher && this.props && this.props.enableResearch !== false) {
      this.initializeResearcher();
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
      this.webview.removeEventListener('did-fail-load', this.handleDidFailLoad);
      this.webview.removeEventListener('certificate-error', this.handleCertificateError);
    }
    
    // Clean up sidebar observer if it exists
    if (this._sidebarObserver) {
      this._sidebarObserver.disconnect();
      this._sidebarObserver = null;
    }
    
    // Remove sidebar state change listener
    if (this._sidebarStateHandler) {
      document.removeEventListener('click', this._sidebarStateHandler);
      this._sidebarStateHandler = null;
    }
    
    // Clean up tab manager button if it exists
    const actionButtonsContainer = document.querySelector('.browser-action-buttons');
    if (actionButtonsContainer) {
      try {
        const ReactDOM = require('react-dom');
        // Find the tab-manager-container inside the action buttons container
        const tabManagerContainer = actionButtonsContainer.querySelector('.tab-manager-container');
        if (tabManagerContainer) {
          ReactDOM.unmountComponentAtNode(tabManagerContainer);
          console.log('Tab manager button unmounted successfully');
        }
      } catch (err) {
        console.warn('Error cleaning up tab manager button:', err);
      }
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
    
    // Clean up container contents if available
    if (this.containerRef && this.containerRef.current) {
      // Clear container contents
      while (this.containerRef.current.firstChild) {
        this.containerRef.current.removeChild(this.containerRef.current.firstChild);
      }
    }
    
    // Clean up research panel if it exists
    if (this.researchPanel && this.researchPanel.isConnected) {
      this.researchPanel.remove();
      this.researchPanel = null;
    }
    
    // Remove any stand-alone research panels that might be in the body
    const researchPanels = document.querySelectorAll('body > .browser-research-panel');
    researchPanels.forEach(panel => {
      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
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
            <button onClick={() => handleBackAction(this)} style={{ marginRight: '4px' }}>◀</button>
            <button onClick={() => handleForwardAction(this)} style={{ marginRight: '8px' }}>▶</button>
            <button onClick={this.refreshPage} style={{ marginRight: '8px' }}>↻</button>
            <button onClick={this.stopLoading} style={{ marginRight: '8px' }}>✕</button>
            
            {/* Reader mode toggle */}
            <button onClick={this.toggleReaderMode} style={{ marginLeft: '8px' }}>
              <span className="material-icons" title="Toggle reader mode">
                {isReaderModeActive ? 'chrome_reader_mode' : 'view_headline'}
              </span>
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

        {/* Research component (renderless) */}
        {this.state.isMounted && enableResearch && (
          <Researcher 
            ref={(ref) => this.researcher = ref}
            browser={this}
            containerRef={this.researchPanel}
            currentUrl={this.state.url}
            currentTitle={this.state.title}
            autoAnalyze={autoAnalyzeContent}
            onToggle={(isActive) => {
              console.log(`Research panel ${isActive ? 'activated' : 'deactivated'}`);
              this.setState({ researchMode: isActive });
            }}
            onResearchItemClick={(item) => {
              if (item && item.url) {
                this.navigate(item.url);
              }
            }}
          />
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