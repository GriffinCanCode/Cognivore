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

// Import researcher component
import Researcher from './researcher/Researcher';

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
      const { updatePageTitle } = require('./renderers/BrowserRenderer');
      if (typeof updatePageTitle === 'function') {
        updatePageTitle(this, title);
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
    
    // Add to browsing history
    const historyRecord = createHistoryRecord(
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
   * Toggle research mode for the browser
   * @returns {boolean} The new research mode state
   */
  toggleResearchMode() {
    console.log('Toggle research mode called');
    
    // CRITICAL CHANGE: First explicitly modify state directly to ensure toggling works
    // (setState is asynchronous, so using it directly wouldn't work for returns)
    const newResearchMode = !this.state.researchMode;
    
    // Set state directly for immediate use
    this.state.researchMode = newResearchMode;
    
    // Log the new state
    console.log(`TOGGLED RESEARCH MODE: ${newResearchMode ? 'ON' : 'OFF'}`);
    
    // Then use setState to trigger component updates (async)
    this.setState({ researchMode: newResearchMode }, () => {
      console.log(`Research mode ${newResearchMode ? 'activated' : 'deactivated'}`);
      
      // Check if research panel exists, if not create it
      if (!this.researchPanel) {
        // Get the research panel element - it was created during setupBrowserLayout 
        // and should already be in the DOM
        this.researchPanel = this.containerRef.current?.querySelector('.browser-research-panel');
        
        // If it still doesn't exist, create it
        if (!this.researchPanel) {
          console.log('Creating new research panel');
          const { createResearchPanel } = require('./renderers/BrowserRenderer');
          this.researchPanel = createResearchPanel();
          
          // Make sure it's attached to the DOM
          if (this.containerRef.current) {
            this.containerRef.current.appendChild(this.researchPanel);
          } else {
            document.body.appendChild(this.researchPanel);
          }
          
          // Set up event handlers
          const closeBtn = this.researchPanel.querySelector('.research-panel-close');
          if (closeBtn) {
            closeBtn.addEventListener('click', () => {
              this.toggleResearchMode();
            });
          }
          
          const clearBtn = this.researchPanel.querySelector('.research-panel-clear');
          if (clearBtn) {
            clearBtn.addEventListener('click', () => {
              if (this.researcher && typeof this.researcher.clearResearch === 'function') {
                this.researcher.clearResearch();
              } else {
                // Fallback implementation
                const content = this.researchPanel.querySelector('.research-panel-content');
                if (content) {
                  content.innerHTML = `
                    <div class="research-empty-state">
                      <p>No research data available yet.</p>
                      <p>Enable research mode to automatically save pages as you browse.</p>
                    </div>
                  `;
                }
              }
            });
          }
        }
      }
      
      // Toggle research panel visibility - IMPORTANT: Force panel into view explicitly
      // EMERGENCY FIX: Create a completely new panel directly as a modal
      console.log('Creating emergency direct research panel');
      
      // First, remove any existing panel
      if (this.researchPanel && this.researchPanel.isConnected) {
        this.researchPanel.remove();
      }
      
      // Also find and remove any existing research panels in the body
      const existingPanels = document.querySelectorAll('.browser-research-panel');
      existingPanels.forEach(panel => panel.remove());
      
      if (newResearchMode) {
        // Create a completely new panel with direct body attachment
        const directPanel = document.createElement('div');
        directPanel.id = 'emergency-research-panel-' + Date.now();
        directPanel.className = 'browser-research-panel direct-emergency-panel';
        
        // Direct style application with important flag on every property
        directPanel.setAttribute('style', `
          display: block !important;
          z-index: 999999 !important;
          opacity: 1 !important;
          visibility: visible !important;
          position: fixed !important;
          right: 0 !important;
          top: 0 !important;
          bottom: 0 !important;
          height: 100vh !important;
          width: 350px !important;
          background-color: #ffffff !important;
          box-shadow: -5px 0 25px rgba(0, 0, 0, 0.25) !important;
          overflow: auto !important;
          font-family: system-ui, -apple-system, sans-serif !important;
          color: #000000 !important;
          border-left: 3px solid #335eea !important;
        `);
        
        // Add header with inline styles
        directPanel.innerHTML = `
          <div style="padding: 15px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; background-color: #f8f9fa;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 500; color: #333;">Research Panel 📝</h3>
            <div style="display: flex; gap: 10px;">
              <button id="research-clear-btn" style="background: none; border: none; cursor: pointer; font-size: 14px; padding: 5px 8px; border-radius: 4px; color: #333;">Clear</button>
              <button id="research-close-btn" style="background: none; border: none; cursor: pointer; font-size: 18px; padding: 5px 8px; border-radius: 4px; color: #333;">×</button>
            </div>
          </div>
          <div style="flex: 1; overflow-y: auto; padding: 20px; height: calc(100vh - 51px);">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; margin-top: 40px; color: #666; text-align: center;">
              <p style="margin-bottom: 10px; font-size: 16px; color: #333;">Research panel activated!</p>
              <p style="color: #666; font-size: 14px;">Browse the web to collect research automatically.</p>
              <p style="margin-top: 20px; color: #666; font-size: 13px;">Current URL: ${this.state.url || 'None'}</p>
              <div style="margin-top: 30px; border: 1px solid #eee; border-radius: 8px; padding: 15px; background: #f9f9f9; width: 80%;">
                <p style="font-weight: 500; color: #333; margin-bottom: 8px;">Page Title: ${this.state.title || 'Not loaded'}</p>
                <p style="color: #666;">Research entries: ${this.researcher?.state?.researchEntries?.length || 0}</p>
              </div>
            </div>
          </div>
        `;
        
        // Add to document body
        document.body.appendChild(directPanel);
        
        // Store reference
        this.researchPanel = directPanel;
        
        // Add event listeners
        const closeBtn = directPanel.querySelector('#research-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            console.log('Close button clicked');
            this.toggleResearchMode();
          });
        }
        
        // Clear button
        const clearBtn = directPanel.querySelector('#research-clear-btn');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            console.log('Clear button clicked');
            const content = directPanel.querySelector('div:nth-child(2)');
            if (content) {
              content.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; margin-top: 40px; color: #666; text-align: center;">
                  <p style="margin-bottom: 10px; font-size: 16px;">Research data cleared.</p>
                  <p style="color: #999; font-size: 14px;">Browse the web to collect more research.</p>
                </div>
              `;
            }
          });
        }
        
        // MEGA CRITICAL: Log that panel was created and do visibility check
        console.log('🔴 EMERGENCY PANEL CREATED AND ATTACHED TO BODY 🔴', directPanel);
        
        // Force a browser layout calculation to ensure the panel is painted
        void directPanel.offsetHeight;
        
        // Multiple visibility checks with increasing delays
        [10, 100, 500].forEach(delay => {
          setTimeout(() => {
            if (directPanel.isConnected) {
              const rect = directPanel.getBoundingClientRect();
              console.log(`CHECK AT ${delay}ms - PANEL VISIBILITY:`, {
                id: directPanel.id,
                isConnected: directPanel.isConnected,
                width: rect.width,
                height: rect.height,
                right: rect.right,
                display: window.getComputedStyle(directPanel).display,
                visibility: window.getComputedStyle(directPanel).visibility,
                zIndex: window.getComputedStyle(directPanel).zIndex
              });
            } else {
              console.log(`CHECK AT ${delay}ms - PANEL NOT CONNECTED TO DOM`);
            }
          }, delay);
        });
      } else {
        // If researchMode is false, make sure any panel is removed
        const existingPanels = document.querySelectorAll('.browser-research-panel');
        existingPanels.forEach(panel => panel.remove());
      }
      
      // Update the research button active state 
      const researchBtn = this.containerRef.current?.querySelector('.browser-research-btn');
      if (researchBtn) {
        if (newResearchMode) {
          researchBtn.classList.add('active');
          researchBtn.title = 'Research mode active';
          
          // Show a toast notification
          const { showToastNotification } = require('./renderers/BrowserRenderer');
          if (typeof showToastNotification === 'function') {
            showToastNotification('Research mode activated');
          }
        } else {
          researchBtn.classList.remove('active');
          researchBtn.title = 'Toggle research mode';
          
          // Show a toast notification
          const { showToastNotification } = require('./renderers/BrowserRenderer');
          if (typeof showToastNotification === 'function') {
            showToastNotification('Research mode deactivated');
          }
        }
      }
      
              // If research mode is active, extract content from the current page
      if (this.state.researchMode && this.state.url) {
        // Initialize the researcher if needed
        if (!this.researcher) {
          try {
            // Import Researcher dynamically if needed
            const Researcher = require('./researcher/Researcher').default;
            
            // Create a new instance with proper configuration
            this.researcher = new Researcher({
              browser: this,
              containerRef: this.researchPanel || this.containerRef.current,
              currentUrl: this.state.url,
              currentTitle: this.state.title,
              onToggle: (isActive) => {
                console.log(`Researcher component ${isActive ? 'activated' : 'deactivated'}`);
              }
            });
            
            console.log('Researcher component initialized on demand');
          } catch (err) {
            console.error('Failed to initialize researcher component:', err);
          }
        }
        
        // If researcher was created successfully, activate it
        if (this.researcher) {
          // If the researcher has no state, initialize it
          if (!this.researcher.state) {
            this.researcher.state = {
              isActive: false,
              isProcessing: false,
              currentUrl: this.state.url,
              currentTitle: this.state.title,
              researchEntries: [],
              autoExtract: true,
              error: null,
              llmConnected: false
            };
          }
          
          // Ensure researcher has proper container reference
          this.researcher.props = this.researcher.props || {};
          this.researcher.props.browser = this;
          this.researcher.props.containerRef = this.researchPanel;
          this.researcher.props.currentUrl = this.state.url;
          this.researcher.props.currentTitle = this.state.title;
          
          // Activate researcher component if not already active
          if (typeof this.researcher.toggleActive === 'function') {
            // Only toggle if not already active
            if (!this.researcher.state.isActive) {
              console.log('Activating researcher component');
              this.researcher.toggleActive();
            } else {
              console.log('Researcher component already active');
            }
          }
          
          // Either way, process the current page
          if (typeof this.researcher.processPage === 'function') {
            console.log('Processing current page in researcher');
            this.researcher.processPage(this.state.url, this.state.title);
          } else {
            console.warn('processPage method not found on researcher component');
          }
        }
      } else {
        // Deactivate researcher component if active
        if (this.researcher && 
            typeof this.researcher.toggleActive === 'function' && 
            this.researcher.state && 
            this.researcher.state.isActive) {
          this.researcher.toggleActive();
        }
      }
      
      // Notify parent component if callback provided
      if (this.props && this.props.onResearchModeToggle) {
        this.props.onResearchModeToggle(newResearchMode);
      }
    });
    
    // CRITICAL CHANGE: Return the new mode value directly
    return newResearchMode;
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
    }
    
    // Otherwise use the default implementation
    return new Promise((resolve, reject) => {
      try {
        if (!this.webview || !this.state.url) {
          reject(new Error('Webview or URL not available'));
          return;
        }
        
        // Extract content using the Extractor utility
        extractFullPageContent(this)
          .then(content => {
            if (!content) {
              reject(new Error('No content extracted'));
              return;
            }
            
            // Update research panel with content
            const { updateResearchPanel } = require('./handlers/ContentExtractor');
            updateResearchPanel(this, content);
            
            // Notify parent component if callback provided
            if (this.props.onContentExtracted) {
              this.props.onContentExtracted(content);
            }
            
            resolve(content);
          })
          .catch(err => {
            console.error('Error extracting page content:', err);
            reject(err);
          });
      } catch (err) {
        console.error('Error in extractPageContent:', err);
        reject(err);
      }
    });
  }
  
  /**
   * Captures and processes the content of the current page
   * @returns {Promise<Object>} Promise resolving to the captured content
   */
  capturePageContent() {
    return new Promise((resolve, reject) => {
      if (!this.webview) {
        reject(new Error('Webview not available'));
        return;
      }
      
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
        if (!result) {
          reject(new Error('No content retrieved'));
          return;
        }
        
        // Update page title using our safe method
        const pageTitle = result.title || 'Untitled Page';
        this.setState({ title: pageTitle });
        
        // Call updatePageTitle with proper context
        if (typeof this.updatePageTitle === 'function') {
          this.updatePageTitle(pageTitle);
        } else {
          // Fallback to imported function if method not available
          const { updatePageTitle } = require('./renderers/BrowserRenderer');
          if (typeof updatePageTitle === 'function') {
            updatePageTitle(this, pageTitle);
          }
        }
        
        // Clean up HTML for memory storage
        const { cleanupHtmlForMemory, extractMainContent } = require('./handlers/ContentExtractor');
        const cleanHtml = cleanupHtmlForMemory ? cleanupHtmlForMemory(result.html) : result.html;
        
        // Extract main content
        const mainContent = extractMainContent ? extractMainContent(cleanHtml) : cleanHtml;
        
        // Update state with reader content
        this.setState({ readerContent: mainContent });
        
        const content = {
          url: this.state.url,
          title: pageTitle,
          html: cleanHtml,
          mainContent: mainContent,
          headings: result.headings || [],
          capturedAt: new Date().toISOString(),
          text: mainContent.replace(/<[^>]*>/g, ' ').trim() // Extract plain text from HTML
        };
        
        // Update research panel if in research mode
        if (this.state.researchMode && this.researcher) {
          // Use processPage instead of addResearchItem (which doesn't exist)
          if (typeof this.researcher.processPage === 'function') {
            this.researcher.processPage(this.state.url, this.state.title, content);
          } else if (typeof this.researcher.addResearchItem === 'function') {
            // Legacy fallback
            this.researcher.addResearchItem(content);
          }
        }
        
        // Capture page metadata for memory
        if (this.props && this.props.onContentCapture) {
          this.props.onContentCapture(content);
        }
        
        resolve(content);
      }).catch(err => {
        console.error('Error capturing page content:', err);
        reject(err);
      });
    });
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
    
    // Bind button event handlers in the header with additional checks
    const header = this.containerRef.current?.querySelector('.browser-header');
    const backButton = header?.querySelector('.browser-back-btn');
    const forwardButton = header?.querySelector('.browser-forward-btn');
    const refreshButton = header?.querySelector('.browser-refresh-btn');
    const stopButton = header?.querySelector('.browser-stop-btn');
    
    if (backButton) backButton.addEventListener('click', this.handleBackAction);
    if (forwardButton) forwardButton.addEventListener('click', this.handleForwardAction);
    if (refreshButton) refreshButton.addEventListener('click', this.refreshPage);
    if (stopButton) stopButton.addEventListener('click', this.stopLoading);
    
    // Set initial URL if provided - with a longer delay to ensure webview is fully mounted
    if (this.props?.initialUrl && this.props.initialUrl !== 'about:blank') {
      // Enhanced timing to ensure webview is properly set up before navigation
      setTimeout(() => {
        // Double-check that webview still exists and is connected to DOM
        if (this.webview && this.webview.isConnected) {
          this.navigate(this.props.initialUrl);
        } else {
          console.warn('Webview not connected to DOM, delaying navigation');
          // Try one more time with longer delay
          setTimeout(() => {
            if (this.webview && this.webview.isConnected) {
              this.navigate(this.props.initialUrl);
            }
          }, 500);
        }
      }, 800); // Increased from 500ms to 800ms for better reliability
    }
    
    // Initialize researcher component if needed
    if (!this.researcher && this.props && this.props.enableResearch !== false) {
      try {
        // Import Researcher dynamically
        const Researcher = require('./researcher/Researcher').default;
        
        // Create a new instance with proper configuration
        this.researcher = new Researcher({
          browser: this,
          containerRef: this.researchPanel || this.containerRef.current,
          currentUrl: this.state?.url,
          currentTitle: this.state?.title,
          onToggle: (isActive) => {
            console.log(`Researcher component ${isActive ? 'activated' : 'deactivated'}`);
          },
          onResearchItemClick: (item) => {
            if (item && item.url) {
              this.navigate(item.url);
            }
          },
          onResearchClear: () => {
            console.log('Research data cleared');
          }
        });
        
        console.log('Researcher component initialized');
      } catch (err) {
        console.error('Failed to initialize researcher component:', err);
      }
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

        {/* Research component (renderless) */}
        {this.state.isMounted && <Researcher 
          ref={(ref) => this.researcher = ref}
          browser={this}
          currentUrl={this.state.url}
          currentTitle={this.state.title}
          autoAnalyze={this.props.autoAnalyzeContent}
        />}
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