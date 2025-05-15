/**
 * Browser Component - Web browsing and research functionality for Cognivore
 */
import { detectEnvironment, formatUrl, applySandboxSettings, forceElectronMode } from './utils/BrowserEnv.js';
import { renderProxiedContent, createBrowserPlaceholder, loadContentDirectly } from './renderers/ContentRenderer.js';
import { renderErrorPage } from './renderers/ErrorPageRenderer.js';
import BrowserRenderer from './renderers/BrowserRenderer.js';
import EventHandlers from './handlers/EventHandlers.js';
import * as ContentExtractor from './handlers/ContentExtractor.js';
import * as BookmarkManager from './utils/BookmarkManager.js';
import * as HistoryManager from './utils/HistoryManager.js';

class Browser {
  /**
   * Constructor for Browser component
   * @param {Object} notificationService - Service for showing notifications
   */
  constructor(notificationService) {
    this.container = null;
    this.webview = null;
    this.contentFrame = null; // Added separate reference for content frame
    this.searchInput = null;
    this.isLoading = false;
    this.currentUrl = '';
    this.history = [];
    this.historyIndex = -1;
    this.bookmarks = [];
    this.notificationService = notificationService;
    this.researchMode = false;
    this.renderingMode = 'auto'; // 'auto', 'compatibility', or 'strict'
    this.sandboxLevel = 'standard'; // 'none', 'standard', 'strict'
    this.contentRendered = false;
    this.documentReady = false;
    this.resourcesLoaded = [];
    this.failedResources = [];
    this.webviewImplementation = 'iframe-fallback'; // Default, will be updated by detectEnvironment
    this.isElectronApp = false; // Flag to track if running in Electron app
    this.defaultUrl = ''; // Added default URL property
    this.navigationTimeoutId = null; // Track navigation timeouts
    
    // Manually force Electron mode if title is Cognivore (our app)
    if (document.title === 'Cognivore' || 
        navigator.userAgent.toLowerCase().includes('electron') ||
        window.isElectron === true) {
      console.log('Forcing Electron mode based on app-specific indicators');
      window.isElectron = true;
    }
    
    // Bind methods - ensure all methods exist before binding
    this.handleSearch = this.handleSearch ? this.handleSearch.bind(this) : () => console.warn('handleSearch not defined');
    this.handleBack = this.handleBack ? this.handleBack.bind(this) : () => console.warn('handleBack not defined');
    this.handleForward = this.handleForward ? this.handleForward.bind(this) : () => console.warn('handleForward not defined');
    this.handleRefresh = this.handleRefresh ? this.handleRefresh.bind(this) : () => console.warn('handleRefresh not defined');
    this.handleStop = this.handleStop ? this.handleStop.bind(this) : () => console.warn('handleStop not defined');
    this.handleWebviewLoad = this.handleWebviewLoad ? this.handleWebviewLoad.bind(this) : () => console.warn('handleWebviewLoad not defined');
    this.handleWebviewError = this.handleWebviewError ? this.handleWebviewError.bind(this) : () => console.warn('handleWebviewError not defined');
    this.toggleResearchMode = this.toggleResearchMode ? this.toggleResearchMode.bind(this) : () => console.warn('toggleResearchMode not defined');
    this.savePageToVectorDB = this.savePageToVectorDB ? this.savePageToVectorDB.bind(this) : () => console.warn('savePageToVectorDB not defined');
    this.handleDOMContentLoaded = this.handleDOMContentLoaded ? this.handleDOMContentLoaded.bind(this) : () => console.warn('handleDOMContentLoaded not defined');
    this.handleResourceLoad = this.handleResourceLoad ? this.handleResourceLoad.bind(this) : () => console.warn('handleResourceLoad not defined');
    this.handleFrameMessages = this.handleFrameMessages ? this.handleFrameMessages.bind(this) : () => console.warn('handleFrameMessages not defined');
    this.tryBasicBrowsing = this.tryBasicBrowsing ? this.tryBasicBrowsing.bind(this) : () => console.warn('tryBasicBrowsing not defined');
    this.extractPageContent = this.extractPageContent ? this.extractPageContent.bind(this) : () => console.warn('extractPageContent not defined');
    this.savePage = this.savePage ? this.savePage.bind(this) : () => console.warn('savePage not defined');
    this.navigateTo = this.navigateTo ? this.navigateTo.bind(this) : () => console.warn('navigateTo not defined');
    this.setupWebviewEventListeners = this.setupWebviewEventListeners ? this.setupWebviewEventListeners.bind(this) : () => console.warn('setupWebviewEventListeners not defined');
    this.ensureWebviewAttached = this.ensureWebviewAttached ? this.ensureWebviewAttached.bind(this) : () => console.warn('ensureWebviewAttached not defined');
    this.checkIfPageIsLoaded = this.checkIfPageIsLoaded ? this.checkIfPageIsLoaded.bind(this) : () => console.warn('checkIfPageIsLoaded not defined');
    this.useDirectLoadingMethod = this.useDirectLoadingMethod ? this.useDirectLoadingMethod.bind(this) : () => console.warn('useDirectLoadingMethod not defined');
  }
  
  /**
   * Initialize the browser component
   */
  initialize() {
    // Load saved bookmarks if available
    this.loadBookmarks();
    
    // Load history if available
    this.loadHistory();
    
    // FORCE ELECTRON MODE
    // Always use Electron/webview mode for better compatibility
    console.log('🔍 Forcing Electron mode for reliable browser functionality');
    window.isElectron = true;
    this.isElectronApp = true;
    this.renderingMode = 'full';
    this.webviewImplementation = 'webview';
    
    // Initialize event listener for messages
    window.addEventListener('message', this.handleFrameMessages);
    
    // Set default URL to Google
    this.defaultUrl = 'https://www.google.com';
    
    // Set up header modification to bypass X-Frame-Options
    this.setupHeaderModification();
  }
  
  /**
   * Set up header modification to bypass X-Frame-Options and other restrictive headers
   */
  setupHeaderModification() {
    if (this.webview && this.webview.tagName.toLowerCase() === 'webview') {
      try {
        console.log('🔑 Setting up X-Frame-Options bypass');
        
        // Get session from webview as fallback
        const session = this.webview.getSession ? this.webview.getSession() : null;
        
        if (!session && window.electron && window.electron.session) {
          // Fallback to electron global if available
          const { session } = window.electron;
          this.applyHeaderModificationToSession(session.defaultSession);
        } else if (session) {
          // Use webview's session directly
          this.applyHeaderModificationToSession(session);
        } else {
          console.warn('Could not access session to modify headers - X-Frame-Options bypass may not work');
          this.attemptAlternativeHeadersBypass();
        }
      } catch (err) {
        console.error('Error setting up header modification:', err);
        this.attemptAlternativeHeadersBypass();
      }
    } else {
      // For iframe implementation, we'll use a different approach
      this.attemptAlternativeHeadersBypass();
    }
  }
  
  /**
   * Apply header modification to a session
   * @param {Object} session - Electron session object
   */
  applyHeaderModificationToSession(session) {
    try {
      if (session && session.webRequest && typeof session.webRequest.onHeadersReceived === 'function') {
        console.log('🔧 Setting up header modification to remove X-Frame-Options');
        
        // Listen for all response headers
        session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
          const { responseHeaders } = details;
          
          // Check for and remove restrictive headers
          this.removeRestrictiveHeaders(responseHeaders);
          
          // Continue with modified headers
          callback({ responseHeaders });
        });
        
        console.log('✅ Header modification set up successfully');
      } else {
        console.warn('Session does not support webRequest API');
      }
    } catch (err) {
      console.error('Failed to apply header modification:', err);
    }
  }
  
  /**
   * Remove restrictive headers from response
   * @param {Object} headers - Response headers object
   */
  removeRestrictiveHeaders(headers) {
    if (!headers) return;
    
    // Headers can be case-sensitive or case-insensitive depending on implementation
    // So we'll check for both common variations
    const headersToRemove = [
      'x-frame-options', 'X-Frame-Options',
      'content-security-policy', 'Content-Security-Policy',
      'x-content-security-policy', 'X-Content-Security-Policy',
      'frame-options', 'Frame-Options'
    ];
    
    // Remove restrictive headers
    headersToRemove.forEach(header => {
      if (headers[header]) {
        console.log(`🔄 Removing restrictive header: ${header}`);
        delete headers[header];
      }
    });
  }
  
  /**
   * Attempt alternative methods to bypass headers when session API is not available
   */
  attemptAlternativeHeadersBypass() {
    console.log('⚠️ Using alternative method to bypass X-Frame-Options');
    
    // Store this for access in rendered webview
    window.bypassHeaders = true;
    
    // For iframe implementation, we'll use the IPC channel if available
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.send('setup-header-bypass');
    }
  }
  
  /**
   * Load bookmarks from storage
   */
  loadBookmarks() {
    this.bookmarks = BookmarkManager.loadBookmarks();
  }
  
  /**
   * Save bookmarks to storage
   */
  saveBookmarks() {
    BookmarkManager.saveBookmarks(this.bookmarks);
  }
  
  /**
   * Load browser history from storage
   */
  loadHistory() {
    const { history, historyIndex } = HistoryManager.loadHistory();
    this.history = history;
    this.historyIndex = historyIndex;
  }
  
  /**
   * Save browser history to storage
   */
  saveHistory() {
    HistoryManager.saveHistory(this.history, this.historyIndex);
  }
  
  /**
   * Add current page to bookmarks
   */
  addBookmark() {
    if (!this.currentUrl) return;
    
    const title = this.webview ? 
      (typeof this.webview.getTitle === 'function' ? this.webview.getTitle() : document.title) : 
      'Untitled';
    
    this.bookmarks = BookmarkManager.addBookmark(this.bookmarks, this.currentUrl, title);
    
    if (this.notificationService) {
      this.notificationService.show('Bookmark added', 'success');
    }
  }
  
  /**
   * Handle URL search
   * @param {Event} e - Submit event
   */
  handleSearch(e) {
    e.preventDefault();
    const url = this.searchInput.value.trim();
    
    if (!url) return;
    
    // Format URL and navigate
    const formattedUrl = formatUrl(url);
    this.navigateTo(formattedUrl);
  }
  
  /**
   * Show loading content in the browser
   * @param {string} url - The URL being loaded
   */
  showLoadingContent(url) {
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
    if (this.webview) {
      // Apply critical styling but keep it hidden
      this.webview.style.cssText = `
        display: flex !important;
        visibility: hidden !important;
        opacity: 0 !important;
        z-index: 0 !important;
        position: fixed !important;
        top: 52px !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: calc(100vh - 52px) !important;
        min-height: calc(100vh - 52px) !important;
        max-height: calc(100vh - 52px) !important;
        min-width: 100vw !important;
        max-width: 100vw !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        background-color: white !important;
        flex: 1 1 auto !important;
        transform: none !important;
      `;
      
      // Reset readyToShow flag if it exists
      if (typeof this.webview.readyToShow !== 'undefined') {
        this.webview.readyToShow = false;
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
   */
  hideLoadingContent() {
    const loadingContent = document.querySelector('.browser-loading-content');
    if (!loadingContent) return;
    
    // Check if webview is ready to show before hiding loading screen
    if (this.webview) {
      // Apply immediate crucial styling first
      this.enforceWebviewStyles(true);
      
      // Only hide loading content when webview is ready to show
      if (typeof this.webview.readyToShow === 'undefined' || this.webview.readyToShow === true) {
        // Webview is ready, proceed with hiding loading content
        this._hideLoadingContent(loadingContent);
      } else {
        // Webview not ready yet, wait for readyToShow flag to become true
        console.log('Webview not yet ready to show, waiting before hiding loading screen');
        
        // Check every 100ms if webview is ready
        const readyCheckInterval = setInterval(() => {
          if (this.webview.readyToShow === true) {
            // Webview is now ready
            clearInterval(readyCheckInterval);
            this._hideLoadingContent(loadingContent);
          }
        }, 100);
        
        // Set a maximum timeout of 5 seconds
        setTimeout(() => {
          if (readyCheckInterval) {
            clearInterval(readyCheckInterval);
            console.log('Forcing loading content hide after timeout');
            this._hideLoadingContent(loadingContent);
            
            // Force webview visibility
            if (this.webview) {
              this.webview.style.visibility = 'visible';
              this.webview.style.opacity = '1';
            }
          }
        }, 5000);
      }
    } else {
      // No webview, just hide loading content
      this._hideLoadingContent(loadingContent);
    }
  }
  
  /**
   * Internal method to actually hide the loading content
   * @private
   * @param {HTMLElement} loadingContent - The loading content element to hide
   */
  _hideLoadingContent(loadingContent) {
    // Hide loading content
    loadingContent.style.opacity = '0';
    
    // Ensure webview is immediately visible with proper styling
    if (this.webview) {
      // Now show the webview with all styles applied
      this.webview.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 1 !important;
        position: fixed !important;
        top: 52px !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: calc(100vh - 52px) !important;
        min-height: calc(100vh - 52px) !important;
        max-height: calc(100vh - 52px) !important;
        min-width: 100vw !important;
        max-width: 100vw !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        background-color: white !important;
        flex: 1 1 auto !important;
        transform: none !important;
        overflow: hidden !important;
      `;
    }
    
    // Then remove loading content after transition completes
    setTimeout(() => {
      if (loadingContent && loadingContent.parentNode) {
        loadingContent.style.display = 'none';
        try {
          // Try to remove from DOM completely
          loadingContent.parentNode.removeChild(loadingContent);
        } catch (err) {
          console.warn('Error removing loading content:', err);
        }
      }
    }, 300);
  }
  
  /**
   * Enforce proper webview styling
   * This should be called periodically to ensure proper display
   * @param {boolean} immediate - If true, ignores the throttle check for immediate application
   */
  enforceWebviewStyles(immediate = false) {
    // Only proceed if it's been at least 2 seconds since the last enforcement
    // to prevent excessive style application
    if (!immediate && this._lastStyleEnforcement && (Date.now() - this._lastStyleEnforcement < 2000)) {
      return;
    }
    
    // Track when we last enforced styles
    this._lastStyleEnforcement = Date.now();
    
    // Ensure parent container has proper styling
    if (this.container) {
      this.container.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 9999 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        transform: none !important;
        box-sizing: border-box !important;
        background-color: #fff !important;
      `;
    }
    
    // Set webview container to proper size with extremely aggressive styling
    const webviewContainer = this.container?.querySelector('.browser-webview-container');
    if (webviewContainer) {
      webviewContainer.style.cssText = `
        flex: 1 1 auto !important;
        position: fixed !important;
        top: 52px !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        overflow: hidden !important;
        display: flex !important;
        width: 100vw !important;
        height: calc(100vh - 52px) !important;
        margin: 0 !important;
        padding: 0 !important;
        transform: none !important;
        z-index: 1 !important;
        box-sizing: border-box !important;
        border: none !important;
        background: #fff !important;
      `;
    }
    
    // Apply maximum enforcement to webview element
    if (this.webview) {
      // Super aggressive styling directly on webview
      if (this.webview.tagName?.toLowerCase() === 'webview') {
        this.webview.style.cssText = `
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 1 !important;
          position: fixed !important;
          top: 52px !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: calc(100vh - 52px) !important;
          min-height: calc(100vh - 52px) !important;
          max-height: calc(100vh - 52px) !important;
          min-width: 100vw !important;
          max-width: 100vw !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          background-color: white !important;
          transform: none !important;
          overflow: hidden !important;
          flex: 1 1 auto !important;
        `;
        
        // Ensure DevTools is completely disabled
        this.webview.setAttribute('disabledevtools', 'true');
        
        // Add webpreferences with DevTools disabled
        const webPrefs = this.webview.getAttribute('webpreferences') || '';
        if (!webPrefs.includes('devTools=false')) {
          const updatedPrefs = webPrefs ? `${webPrefs}, devTools=false` : 'devTools=false';
          this.webview.setAttribute('webpreferences', updatedPrefs);
        }
      } else {
        // iframe fallback styling (same aggressive styling)
        this.webview.style.cssText = `
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 1 !important;
          position: fixed !important;
          top: 52px !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: calc(100vh - 52px) !important;
          min-height: calc(100vh - 52px) !important;
          max-height: calc(100vh - 52px) !important;
          min-width: 100vw !important;
          max-width: 100vw !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          background-color: white !important;
          transform: none !important;
          overflow: hidden !important;
          flex: 1 1 auto !important;
        `;
      }
      
      // Try to apply content fixes for webview contents
      if (this.webview.tagName && this.webview.tagName.toLowerCase() === 'webview' && typeof this.webview.executeJavaScript === 'function') {
        try {
          // Apply content fixes immediately for critical styling
          const contentFixScript = `
            (function() {
              // Create style element if needed
              let styleEl = document.getElementById('cognivore-content-fixes');
              if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'cognivore-content-fixes';
                document.head.appendChild(styleEl);
              }
              
              // Set comprehensive style content
              styleEl.textContent = \`
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  min-width: 100% !important;
                  min-height: 100% !important;
                  overflow-x: hidden !important;
                  overflow-y: auto !important;
                  position: relative !important;
                }
                
                /* Specific fixes for Google search layout */
                body div, body form, body center {
                  width: auto !important;
                  max-width: 100% !important;
                  margin-left: auto !important;
                  margin-right: auto !important;
                }
                
                /* Google search results container */
                #center_col, #main, #rcnt, #cnt, .col {
                  width: 100% !important;
                  max-width: 100% !important;
                  min-width: initial !important;
                  margin: 0 auto !important;
                }
                
                /* Google's main page */
                .jsb, .sfbg, .minidiv, .RNNXgb, .o44hBf, .a4bIc, .k1zIA {
                  width: 100% !important;
                  max-width: 584px !important;
                  margin: 0 auto !important;
                }
                
                /* Fix for footer to not cause horizontal scroll */
                footer, .fbar {
                  width: 100% !important;
                  max-width: 100% !important;
                  box-sizing: border-box !important;
                }
                
                /* Completely hide DevTools elements */
                .devtools, #devtools, 
                div[id^="devtools-"], div[class^="devtools-"],
                [class*="console"], [class*="inspector"], [class*="panel"], 
                [class*="drawer"], [id*="console"], [id*="inspector"], 
                [id*="panel"], [id*="drawer"] {
                  display: none !important;
                  visibility: hidden !important;
                  width: 0 !important;
                  height: 0 !important;
                  opacity: 0 !important;
                  pointer-events: none !important;
                  position: absolute !important;
                  left: -9999px !important;
                  top: -9999px !important;
                  z-index: -9999 !important;
                }
              \`;
              
              // Apply direct style fixes to document elements
              document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
              document.body.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
              
              // Remove any DevTools elements that may have been injected
              const devTools = document.querySelectorAll('[class*="devtools-"], [id*="devtools-"], .drawer-content, .panel, .console-view');
              devTools.forEach(el => {
                if (el && el.parentNode) {
                  try {
                    el.parentNode.removeChild(el);
                  } catch(e) {}
                }
              });
              
              // Apply Google-specific fixes
              if (window.location.hostname.includes('google.com')) {
                // Force proper sizing for Google's main elements
                const mainElements = document.querySelectorAll('#main, #cnt, #rcnt, #center_col, #rso');
                mainElements.forEach(el => {
                  if (el) {
                    el.style.width = '100%';
                    el.style.maxWidth = '100%';
                    el.style.margin = '0 auto';
                    el.style.padding = '0';
                    el.style.boxSizing = 'border-box';
                  }
                });
                
                // Fix any search results that might be too narrow
                const searchContainer = document.querySelector('#center_col, #rso, #search');
                if (searchContainer) {
                  searchContainer.style.width = '100%';
                  searchContainer.style.maxWidth = '900px';
                  searchContainer.style.margin = '0 auto';
                }
              }
              
              // Store the result in a global variable to avoid return statement errors
              window.__contentFixesResult = "Content fixes applied successfully";
            })();
            
            // Return the stored result
            window.__contentFixesResult;
          `;
          
          // Execute with proper error handling and throttling
          if (immediate || !this._lastContentFix || (Date.now() - this._lastContentFix > 2000)) {
            this._lastContentFix = Date.now();
            this.webview.executeJavaScript(contentFixScript)
              .catch(err => console.warn('Error applying content fixes:', err));
          }
        } catch (err) {
          console.warn('Error executing script in webview:', err);
        }
      }
    }
  }
  
  /**
   * Navigate to a URL
   * @param {string} url - The URL to navigate to
   */
  navigateTo(url) {
    if (!this.webview) {
      console.error('Navigation failed: webview not available');
      return;
    }
    
    // Check if webview is properly attached to DOM
    if (this.webview.tagName.toLowerCase() === 'webview' && !this.webview.isConnected) {
      console.error('Cannot navigate: webview is not attached to the DOM');
      
      // Try to force attachment to DOM
      this.ensureWebviewAttached();
      
      // Set a retry after a short delay
      setTimeout(() => {
        if (this.webview && this.webview.isConnected) {
          console.log('Retrying navigation after ensuring webview is attached');
          this.navigateTo(url);
        } else {
          console.error('Failed to attach webview to DOM, cannot navigate');
          this.showLoadingContent(url); // Show loading content anyway
          
          // Create a placeholder message in the loading content
          const loadingContent = document.querySelector('.browser-loading-content');
          if (loadingContent) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'browser-error-message';
            errorMsg.innerHTML = `
              <h3 style="color: #ff6b6b;">WebView Error</h3>
              <p>There was an error initializing the browser component.</p>
              <button onclick="window.location.reload()">Reload Application</button>
            `;
            loadingContent.appendChild(errorMsg);
          }
        }
      }, 500);
      return;
    }
    
    // Validate URL format
    if (!url || typeof url !== 'string') {
      console.error('Navigation failed: invalid URL', url);
      return;
    }
    
    // Force immediate style enforcement before navigation
    this.enforceWebviewStyles(true);
    
    // Continue with the existing navigation code...
    // Clear any existing navigation timeout
    if (this.navigationTimeoutId) {
      clearTimeout(this.navigationTimeoutId);
      this.navigationTimeoutId = null;
    }
    
    console.log(`🌐 Navigating to: ${url}`);
    this.currentUrl = url;
    if (this.searchInput) {
      this.searchInput.value = url;
    }
    
    // Reset content state tracking
    this.contentRendered = false;
    this.documentReady = false;
    this.resourcesLoaded = [];
    this.failedResources = [];
    this.navigationStartTime = Date.now();
    
    // Always ensure placeholder is hidden and webview is visible
    const placeholder = this.container?.querySelector('.browser-placeholder');
    if (placeholder) {
      placeholder.style.display = 'none';
    }
    
    if (this.contentFrame) {
      this.contentFrame.style.display = 'block';
    }
    
    // Show loading content
    this.showLoadingContent(url);
    
    // Ensure styles are enforced one more time after a short delay
    setTimeout(() => this.enforceWebviewStyles(true), 50);
    
    try {
      // Special handling for Google
      const isGoogle = url.includes('google.com');
      const isYouTube = url.includes('youtube.com');
      
      // Apply site-specific settings for the target website
      this.applySiteSpecificSettings(url);
      
      // Show loading progress immediately
      this.isLoading = true;
      this.updateLoadingState();
      this.showLoadingProgress(10);
      
      // Add to history (do this early to ensure it's recorded even if navigation fails)
      const { history, historyIndex } = HistoryManager.addToHistory(this.history, this.historyIndex, url);
      this.history = history;
      this.historyIndex = historyIndex;
      
      // Save history
      this.saveHistory();
      
      // Update navigation buttons state
      EventHandlers.updateNavigationButtons(this);
      
      // Clear webview event listeners and re-add them to ensure they're fresh
      this.setupWebviewEventListeners();
      
      // Special handling for common sites (more reliable)
      if (isGoogle || isYouTube) {
        console.log(`🌟 Using enhanced loading for ${isGoogle ? 'Google' : 'YouTube'}`);
        
        // Force webview to be fully visible first
        if (this.webview) {
          this.webview.style.display = 'block';
          this.webview.style.opacity = '1';
          this.webview.style.visibility = 'visible';
        }
        
        // Use direct loading method immediately for these sites
        this.useDirectLoadingMethod(url);
        
        // Set shorter timeout for Google/YouTube
        this.navigationTimeoutId = setTimeout(() => {
          if (this.isLoading) {
            console.log('Still loading after initial attempt, checking status');
            this.checkIfPageIsLoaded();
          }
        }, 3000);
        
        return; // Skip standard navigation for these sites
      }
      
      // Continue with the rest of the navigation code...
      // [Rest of the existing navigation code should follow here]
      // Use appropriate navigation method based on element type
      if (this.webview.tagName.toLowerCase() === 'webview') {
        console.log('Using Electron webview to navigate');
        
        // For Electron webview - use loadURL with specific options for better compatibility
        if (typeof this.webview.loadURL === 'function') {
          // Enhanced loadURL with options to improve loading success
          const loadOptions = {
            httpReferrer: 'https://www.google.com',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            extraHeaders: 'pragma: no-cache\nCache-Control: no-cache',
            timeout: 30000 // 30 second timeout
          };
          
          // Use a promise to handle success/failure
          this.webview.loadURL(url, loadOptions)
            .then(() => {
              console.log('Webview loadURL successful');
              this.showLoadingProgress(50);
            })
            .catch(err => {
              console.error('Webview loadURL error:', err);
              
              // Don't immediately fall back to src attribute, show a better error
              if (err.code) {
                console.log(`Error code: ${err.code}`);
                
                // Handle specific error codes
                if (err.code === -105) { // ERR_NAME_NOT_RESOLVED
                  this.showNavigationErrorPage(url, 'Could not resolve the server hostname. Check the URL or your internet connection.');
                } else if (err.code === -106) { // ERR_INTERNET_DISCONNECTED
                  this.showNavigationErrorPage(url, 'Internet connection appears to be offline. Please check your network.');
                } else if (err.code === -501) { // ERR_INSECURE_RESPONSE
                  this.showNavigationErrorPage(url, 'The server presented an insecure certificate. This might be a security issue.');
                } else {
                  // Try direct loading method for other errors
                  console.log('Trying direct loading method after error');
                  this.useDirectLoadingMethod(url);
                }
              } else {
                // Try direct loading method for unknown errors
                console.log('Trying direct loading method for unknown error');
                this.useDirectLoadingMethod(url);
              }
            });
        } else {
          // Fallback to src attribute if loadURL isn't available
          this.webview.src = url;
        }
        
        // Update loading indicator progress immediately
        this.showLoadingProgress(30);
      } else {
        // For iframe fallback
        console.log('Using iframe fallback to navigate');
        this.webview.src = url;
      }
      
      // Set a timeout to check if navigation succeeded - first a quick check
      this.navigationTimeoutId = setTimeout(() => {
        if (this.isLoading) {
          console.warn('Navigation taking longer than expected:', url);
          this.showLoadingProgress(60); // Still show progress
          
          // Try to detect if the page is actually loaded but didn't trigger events
          this.checkIfPageIsLoaded();
          
          // Set a longer timeout for final failure
          this.navigationTimeoutId = setTimeout(() => {
            if (this.isLoading) {
              console.warn('Navigation still in progress after 15 seconds, trying direct loading method');
              
              // Try direct loading instead of reload
              this.useDirectLoadingMethod(url);
              
              // Set the final timeout to show an error
              this.navigationTimeoutId = setTimeout(() => {
                // If still loading after 30 seconds total, consider it failed
                if (this.isLoading) {
                  console.error('Navigation timeout after 30 seconds. Aborting:', url);
                  this.isLoading = false;
                  this.updateLoadingState();
                  this.showLoadingProgress(100); // End the progress
                  
                  // Hide loading content
                  this.hideLoadingContent();
                  
                  // Show error page for timeout
                  this.showNavigationErrorPage(url, 'Navigation timeout - page took too long to load. This may be due to slow server response or connectivity issues.');
                }
              }, 15000); // Additional 15 seconds (30 seconds total)
            }
          }, 10000); // 10 more seconds (15 seconds total at this point)
        }
      }, 5000); // Initial 5 seconds
      
    } catch (error) {
      console.error('Error during navigation:', error);
      this.isLoading = false;
      this.updateLoadingState();
      
      // Hide loading content
      this.hideLoadingContent();
      
      // Show error page
      this.showNavigationErrorPage(url, error.message || 'Unknown error during navigation');
    }
  }
  
  /**
   * Ensure the webview is properly attached to the DOM
   */
  ensureWebviewAttached() {
    if (!this.webview) return false;
    
    try {
      // Check if webview is already connected to the DOM
      if (this.webview.isConnected) {
        console.log('Webview is already attached to DOM');
        return true;
      }
      
      console.warn('Webview is not attached to DOM, trying to reattach');
      
      // Try to find webview container
      const webviewContainer = this.container?.querySelector('.browser-webview-container');
            if (webviewContainer) {
        // Clear any existing content
        webviewContainer.innerHTML = '';
        
        // Add the webview back
        webviewContainer.appendChild(this.webview);
        
        // Force layout recalculation
        void this.webview.offsetHeight;
        
        // Check if now attached
        if (this.webview.isConnected) {
          console.log('Successfully reattached webview to DOM');
          
          // Reinitialize webview
          this.setupWebviewEventListeners();
          return true;
        }
      }
      
      // If webview container not found or reattachment failed
      console.error('Failed to reattach webview to DOM');
      return false;
    } catch (error) {
      console.error('Error ensuring webview attachment:', error);
      return false;
    }
  }
  
  /**
   * Handle webview load event
   * @param {Event} e - Load event
   */
  handleWebviewLoad(e) {
    // Apply immediate body margin fix after page loads
    if (this.webview && this.webview.tagName.toLowerCase() === 'webview' && typeof this.webview.executeJavaScript === 'function') {
      try {
        const safeScript = `
          // Apply immediate fix to ensure no black border
          if (document && document.body) {
            document.body.style.margin = '0px';
            document.body.style.padding = '0px';
            document.documentElement.style.margin = '0px';
            document.documentElement.style.padding = '0px';
            
            // Add a style tag with !important rules
            const styleTag = document.createElement('style');
            styleTag.id = 'cognivore-initial-fix';
            styleTag.textContent = 'html, body { margin: 0px !important; padding: 0px !important; border: none !important; }';
            document.head.appendChild(styleTag);
            console.log("Applied initial margin fix to webview content");
            true;
          } else {
            console.log("Document not ready yet for margin fix");
            true;
          }
        `;
        
        // Safely execute with proper error handling for the 'catch' error
        this.webview.executeJavaScript(safeScript)
          .then(result => console.log("Initial margin fix applied successfully"))
          .catch(err => console.warn("Error applying initial margin fix:", err));
      } catch (err) {
        console.warn("Failed to execute margin fix script:", err);
      }
    }
    
    // Continue with regular event handling
    EventHandlers.handleWebviewLoad(this, e);
  }
  
  /**
   * Handle webview error event
   * @param {Event} e - Error event
   */
  handleWebviewError(e) {
    EventHandlers.handleWebviewError(this, e);
  }
  
  /**
   * Handle DOM content loaded event
   * @param {Event} e - DOMContentLoaded event
   */
  handleDOMContentLoaded(e) {
    console.log('DOM READY EVENT FIRED', e);
    
    // Apply margin fix immediately when DOM is ready
    if (this.webview && this.webview.tagName.toLowerCase() === 'webview' && typeof this.webview.executeJavaScript === 'function') {
      try {
        this.webview.executeJavaScript(`
          // Apply immediate fix on DOM ready
          document.body.style.margin = '0px';
          document.body.style.padding = '0px';
          document.documentElement.style.margin = '0px';
          document.documentElement.style.padding = '0px';
          
          // Force fix in case default styles haven't been applied yet
          setTimeout(() => {
            document.body.style.margin = '0px';
            document.body.style.padding = '0px';
          }, 0);
        `).catch(() => {});
      } catch (err) {}
    }
    
    EventHandlers.handleDOMContentLoaded(this, e);
  }
  
  /**
   * Handle resource load event
   * @param {Event} e - Load event
   */
  handleResourceLoad(e) {
    EventHandlers.handleResourceLoad(this, e);
  }
  
  /**
   * Handle frame messages
   * @param {MessageEvent} event - Message event
   */
  handleFrameMessages(event) {
    EventHandlers.handleFrameMessages(this, event);
  }
  
  /**
   * Handle back button click
   */
  handleBack() {
    const result = HistoryManager.goBack(this.history, this.historyIndex);
    if (result) {
      this.historyIndex = result.historyIndex;
      this.currentUrl = result.url;
      
      if (this.searchInput) {
        this.searchInput.value = result.url;
      }
      
      if (this.webview) {
        this.webview.src = result.url;
      }
      
      // Update navigation buttons state
      EventHandlers.updateNavigationButtons(this);
    }
  }
  
  /**
   * Handle forward button click
   */
  handleForward() {
    const result = HistoryManager.goForward(this.history, this.historyIndex);
    if (result) {
      this.historyIndex = result.historyIndex;
      this.currentUrl = result.url;
      
      if (this.searchInput) {
        this.searchInput.value = result.url;
      }
      
      if (this.webview) {
        this.webview.src = result.url;
      }
      
      // Update navigation buttons state
      EventHandlers.updateNavigationButtons(this);
    }
  }
  
  /**
   * Handle refresh button click
   */
  handleRefresh() {
    if (this.webview && typeof this.webview.reload === 'function') {
      this.webview.reload();
    } else if (this.webview) {
      // Fallback for iframe
      this.webview.src = this.currentUrl;
    }
  }
  
  /**
   * Handle stop button click
   */
  handleStop() {
    if (this.webview && typeof this.webview.stop === 'function') {
      this.webview.stop();
    }
    
    this.isLoading = false;
    this.updateLoadingState();
    
    // Also clear any loading progress
    clearInterval(this.progressInterval);
    this.progressInterval = null;
    
    // Clear any navigation timeout
    if (this.navigationTimeoutId) {
      clearTimeout(this.navigationTimeoutId);
      this.navigationTimeoutId = null;
    }
  }
  
  /**
   * Toggle research mode
   */
  toggleResearchMode() {
    this.researchMode = !this.researchMode;
    
    if (this.researchMode && this.notificationService) {
      this.notificationService.show('Research mode enabled. Pages will be saved to your knowledge base.', 'info');
    }
    
    // Update UI to reflect research mode
    const researchButton = this.container?.querySelector('.browser-research-btn');
    if (researchButton) {
      researchButton.classList.toggle('active', this.researchMode);
    }
    
    // If research mode is enabled and we have content, extract it
    if (this.researchMode && this.contentRendered) {
      this.extractPageContent();
    }
  }
  
  /**
   * Extract page content
   */
  extractPageContent() {
    ContentExtractor.extractPageContent(this);
  }
  
  /**
   * Save page content to vector database
   * @param {Object} content - The extracted page content 
   */
  savePageToVectorDB(content) {
    ContentExtractor.savePageToVectorDB(this, content);
  }
  
  /**
   * Try basic browsing despite limitations
   */
  tryBasicBrowsing() {
    // Ensure iframe is visible
    if (this.contentFrame) {
      this.contentFrame.style.display = 'block';
    }
    
    // Hide the placeholder
    const browserPlaceholder = this.container?.querySelector('.browser-placeholder');
    if (browserPlaceholder) {
      browserPlaceholder.style.display = 'none';
    }
    
    // Initialize with a default URL if none set
    if (!this.currentUrl) {
      this.navigateTo('https://www.google.com');
    } else if (this.currentUrl) {
      this.navigateTo(this.currentUrl);
    }
  }
  
  /**
   * Manually save current page to vector database
   */
  savePage() {
    if (!this.webview || !this.currentUrl) return;
    
    this.extractPageContent();
  }
  
  /**
   * Render the browser component
   * @param {HTMLElement} container - Optional container to render into
   * @returns {HTMLElement} - The rendered browser component
   */
  render(container) {
    // Create full browser container
    console.log('📋 Rendering browser component with direct body mounting...');
    
    // Determine where to mount the browser
    let targetContainer = container;
    
    if (!targetContainer) {
      // Create container element if not provided
      targetContainer = document.createElement('div');
      targetContainer.className = 'browser-container';
      targetContainer.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        z-index: 9999 !important;
        background-color: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
      `;
      
      // Mount to body as the highest-level component
      document.body.appendChild(targetContainer);
    } else {
      // Setup existing container for flexible browser sizing
      targetContainer.style.cssText = `
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        background-color: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
      `;
    }
    
    // Store container reference
    this.container = targetContainer;
    
    // Create the header with navigation controls
    const header = BrowserRenderer.createBrowserHeader(this);
    this.container.appendChild(header);
    
    // Create progress bar for loading indication
    this.progressContainer = BrowserRenderer.createProgressBar();
    this.container.appendChild(this.progressContainer);
    this.progressBar = this.progressContainer.querySelector('.browser-progress-bar');
    
    // Create webview with container
    const { container: webviewContainer, webview } = BrowserRenderer.createWebview(this, 'webview', 'standard');
    this.container.appendChild(webviewContainer);
    this.webviewContainer = webviewContainer;
    
    // Store webview reference
    this.webview = webview;
    
    // Create research panel
    this.researchPanel = BrowserRenderer.createResearchPanel();
    this.container.appendChild(this.researchPanel);
    
    // Hide progress bar initially
    this.showProgressBar(false);
    
    // Make sure webview is properly initialized before setting up events and navigating
    if (this.webview) {
      // Set up event handlers
      this.setupWebviewEventListeners();
      
      // Automatically navigate to blank page to initialize
      setTimeout(() => {
        if (!this.currentUrl) {
          // Use a direct src assignment for initial navigation
          this.webview.src = 'about:blank';
          this.currentUrl = 'about:blank';
        }
      }, 100);
    } else {
      console.error('Failed to initialize webview component');
    }
    
    console.log('📋 Browser component rendered');
    return this.container;
  }
  
  /**
   * Clean up component resources
   */
  cleanup() {
    console.log('Cleaning up browser component...');
    
    // Save bookmarks and history before cleanup
    this.saveBookmarks();
    this.saveHistory();
    
    // Remove global event listeners
    window.removeEventListener('message', this.handleFrameMessages);
    
    // Remove any intervals
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    // Clear permanent style interval
    if (this.permanentStyleInterval) {
      clearInterval(this.permanentStyleInterval);
      this.permanentStyleInterval = null;
    }
    
    // Clear any navigation timeout
    if (this.navigationTimeoutId) {
      clearTimeout(this.navigationTimeoutId);
      this.navigationTimeoutId = null;
    }
    
    // Remove loading content if present
    const loadingContent = document.querySelector('.browser-loading-content');
    if (loadingContent && loadingContent.parentNode) {
      try {
        loadingContent.parentNode.removeChild(loadingContent);
      } catch (err) {
        console.warn('Error removing loading content during cleanup:', err);
      }
    }
    
    // Clean up DOM elements - remove the container from document.body
    if (this.container) {
      try {
        // Remove from document body if it's directly attached there
        if (this.container.parentNode === document.body) {
          document.body.removeChild(this.container);
          console.log('Browser container removed from document.body');
        } 
        // Otherwise if it's attached elsewhere, remove it from its parent
        else if (this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
          console.log('Browser container removed from parent node');
        }
        // If not attached, just log it
        else {
          console.log('Browser container not attached to DOM, nothing to remove');
        }
      } catch (err) {
        console.error('Error removing browser container:', err);
      }
    }
    
    // Additionally, clean up any orphaned browser containers in the body
    // This is a safety measure in case cleanup is called multiple times or containers are left behind
    try {
      const browserContainers = document.querySelectorAll('body > .browser-container');
      console.log(`Found ${browserContainers.length} orphaned browser containers to clean up`);
      
      browserContainers.forEach(container => {
        try {
          document.body.removeChild(container);
        } catch (err) {
          console.warn('Error removing orphaned container:', err);
        }
      });
    } catch (err) {
      console.warn('Error cleaning up orphaned containers:', err);
    }
    
    // Remove any injected scripts from the previous page
    if (this.webview && this.webview.tagName && this.webview.tagName.toLowerCase() === 'webview' && typeof this.webview.executeJavaScript === 'function') {
      try {
        this.webview.executeJavaScript(`
          // Clean up any intervals we created
          if (window.cognivoreStyleInterval) {
            clearInterval(window.cognivoreStyleInterval);
            window.cognivoreStyleInterval = null;
          }
          if (window.cognivoreSlowerStyleInterval) {
            clearInterval(window.cognivoreSlowerStyleInterval);
            window.cognivoreSlowerStyleInterval = null;
          }
          // Disconnect any observers
          if (window.cognivoreStyleObserver) {
            window.cognivoreStyleObserver.disconnect();
            window.cognivoreStyleObserver = null;
          }
          console.log("Cleaned up browser injected scripts");
        `).catch(() => {});
      } catch (err) {}
    }
    
    this.container = null;
    this.webview = null;
    this.contentFrame = null;
    this.searchInput = null;
    
    console.log('Browser component cleanup completed');
  }
  
  /**
   * Set up webview event listeners
   * This ensures all the necessary event listeners are attached to the webview
   */
  setupWebviewEventListeners() {
    if (!this.webview) {
      console.warn('Cannot setup webview event listeners: webview not available');
      return;
    }

    // Remove any existing event listeners to prevent duplicates
    this.webview.removeEventListener('load', this.handleWebviewLoad);
    this.webview.removeEventListener('loadstart', () => this.updateLoadingState(true));
    this.webview.removeEventListener('loadstop', () => this.updateLoadingState(false));
    this.webview.removeEventListener('did-start-loading', () => this.updateLoadingState(true));
    this.webview.removeEventListener('did-stop-loading', () => this.updateLoadingState(false));
    this.webview.removeEventListener('dom-ready', this.handleDOMContentLoaded);
    this.webview.removeEventListener('did-fail-load', this.handleWebviewError);
    this.webview.removeEventListener('crashed', this.handleWebviewError);
    this.webview.removeEventListener('did-finish-load', this.handleWebviewLoad);
    
    // Add event listeners for webview
    this.webview.addEventListener('load', this.handleWebviewLoad);
    this.webview.addEventListener('loadstart', () => this.updateLoadingState(true));
    this.webview.addEventListener('loadstop', () => this.updateLoadingState(false));
    this.webview.addEventListener('did-start-loading', () => this.updateLoadingState(true));
    this.webview.addEventListener('did-stop-loading', () => this.updateLoadingState(false));
    this.webview.addEventListener('dom-ready', this.handleDOMContentLoaded);
    this.webview.addEventListener('did-fail-load', this.handleWebviewError);
    this.webview.addEventListener('crashed', this.handleWebviewError);
    this.webview.addEventListener('did-finish-load', this.handleWebviewLoad);
    
    console.log('Webview event listeners set up successfully');
  }
  
  /**
   * Update the loading state and UI elements
   * @param {boolean} isLoading - Whether the webview is currently loading
   */
  updateLoadingState(isLoading = false) {
    // Update loading state
    this.isLoading = isLoading;
    
    // Update UI to reflect loading state
    const refreshButton = this.container?.querySelector('.browser-refresh-btn');
    const stopButton = this.container?.querySelector('.browser-stop-btn');
    const progressBar = this.container?.querySelector('.browser-progress-bar');
    
    if (refreshButton && stopButton) {
      if (isLoading) {
        refreshButton.style.display = 'none';
        stopButton.style.display = 'block';
      } else {
        refreshButton.style.display = 'block';
        stopButton.style.display = 'none';
      }
    }
    
    // Update progress bar
    if (progressBar) {
      if (isLoading) {
        progressBar.style.display = 'block';
        // Start progress animation if not already running
        if (!this.progressInterval) {
          this.showLoadingProgress(0);
          
          // Simulate progress to 80% (the last 20% will be when loading completes)
          let progress = 0;
          this.progressInterval = setInterval(() => {
            progress += 5;
            if (progress > 80) {
              progress = 80; // Cap at 80% until loading completes
              clearInterval(this.progressInterval);
            }
            this.showLoadingProgress(progress);
          }, 200);
        }
      } else {
        // Complete the progress bar animation
        this.showLoadingProgress(100);
        
        // Clear the interval if it exists
        if (this.progressInterval) {
          clearInterval(this.progressInterval);
          this.progressInterval = null;
        }
        
        // Hide progress bar after animation completes
        setTimeout(() => {
          if (progressBar) {
            progressBar.style.display = 'none';
          }
        }, 300);
      }
    }
  }
  
  /**
   * Show loading progress in the progress bar
   * @param {number} progress - Progress percentage (0-100)
   */
  showLoadingProgress(progress) {
    const progressBar = this.container?.querySelector('.browser-progress-bar');
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      progressBar.style.display = 'block';
      
      // Hide progress bar after completion
      if (progress >= 100) {
        setTimeout(() => {
          progressBar.style.display = 'none';
        }, 500);
      }
    }
  }
  
  /**
   * Check if the page is actually loaded even if events didn't fire
   * This is a fallback for when navigation events don't fire properly
   */
  checkIfPageIsLoaded() {
    if (!this.webview) return;
    
    console.log('Checking if page is actually loaded despite missing events');
    
    // For Electron webview
    if (this.webview.tagName.toLowerCase() === 'webview') {
      try {
        // Get the current URL to check if navigation happened
        if (typeof this.webview.getURL === 'function') {
          const currentURL = this.webview.getURL();
          
          // If URL changed, consider it loaded
          if (currentURL && currentURL !== 'about:blank' && currentURL !== this.currentUrl) {
            console.log('Page appears to be loaded based on URL change:', currentURL);
            this.currentUrl = currentURL;
            this.isLoading = false;
            this.updateLoadingState(false);
            
            // Ensure progress bar completes
            this.showLoadingProgress(100);
            
            // Try to hide loading content
            this.hideLoadingContent();
            
            // Force webview visibility
            if (this.webview) {
              this.webview.style.opacity = '1';
              this.webview.style.visibility = 'visible';
              this.webview.style.display = 'block';
            }
            
            return;
          }
        }
        
        // Try to use executeJavaScript to check readyState
        if (typeof this.webview.executeJavaScript === 'function') {
          this.webview.executeJavaScript(`
            document.readyState;
          `).then((readyState) => {
            if (readyState === 'complete' || readyState === 'interactive') {
              console.log('Page appears to be loaded based on readyState:', readyState);
              this.isLoading = false;
              this.updateLoadingState(false);
              
              // Hide loading content
              this.hideLoadingContent();
            } else {
              console.log('Page readyState indicates still loading:', readyState);
            }
          }).catch(err => {
            console.warn('Error checking readyState:', err);
          });
        }
      } catch (err) {
        console.warn('Error checking if page is loaded:', err);
      }
    } else {
      // For iframe fallback
      try {
        const contentWindow = this.webview.contentWindow;
        if (contentWindow && contentWindow.document) {
          const readyState = contentWindow.document.readyState;
          
          if (readyState === 'complete' || readyState === 'interactive') {
            console.log('Page appears to be loaded based on iframe readyState:', readyState);
            this.isLoading = false;
            this.updateLoadingState(false);
            
            // Hide loading content
            this.hideLoadingContent();
          }
        }
      } catch (err) {
        // Security errors are expected for cross-origin iframes
        console.warn('Error checking iframe loaded state (likely due to cross-origin restrictions)');
      }
    }
  }
  
  /**
   * Use direct loading method as a fallback
   * This sets the src attribute directly instead of using loadURL
   * @param {string} url - The URL to load
   */
  useDirectLoadingMethod(url) {
    if (!this.webview) return;
    
    console.log('Using direct loading method for URL:', url);
    
    // Ensure loading state is updated
    this.isLoading = true;
    this.updateLoadingState(true);
    
    // Show loading content
    this.showLoadingContent(url);
    
    // Set src attribute directly
    this.webview.src = url;
    
    // Set a timeout to check if it loads
    setTimeout(() => {
      this.checkIfPageIsLoaded();
    }, 3000);
  }
  
  /**
   * Apply site-specific settings based on URL
   * @param {string} url - The URL being navigated to
   */
  applySiteSpecificSettings(url) {
    if (!url) return;
    
    // Default settings
    let settings = {
      sandbox: 'standard',
      headers: {},
      userAgent: null,
      bypassCSP: true
    };
    
    // Google-specific settings
    if (url.includes('google.com')) {
      settings = {
        sandbox: 'standard',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        bypassCSP: true
      };
    }
    
    // YouTube-specific settings
    else if (url.includes('youtube.com')) {
      settings = {
        sandbox: 'standard',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        bypassCSP: true
      };
    }
    
    // Apply settings to webview
    if (this.webview && this.webview.tagName.toLowerCase() === 'webview') {
      try {
        // Apply sandbox settings
        if (settings.sandbox && typeof applySandboxSettings === 'function') {
          applySandboxSettings(this.webview, settings.sandbox);
        }
        
        // Apply user agent
        if (settings.userAgent && typeof this.webview.setUserAgent === 'function') {
          this.webview.setUserAgent(settings.userAgent);
        }
        
        // Handle CSP bypass through session if available
        if (settings.bypassCSP && this.webview.getSession) {
          try {
            const session = this.webview.getSession();
            if (session && session.webRequest) {
              session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
                if (details.responseHeaders && details.responseHeaders['content-security-policy']) {
                  delete details.responseHeaders['content-security-policy'];
                }
                callback({ responseHeaders: details.responseHeaders });
              });
            }
          } catch (err) {
            console.warn('Error setting up CSP bypass:', err);
          }
        }
        
        console.log(`Applied site-specific settings for: ${url}`);
      } catch (err) {
        console.warn('Error applying site-specific settings:', err);
      }
    }
  }
  
  /**
   * Show navigation error page
   * @param {string} url - The URL that failed to load
   * @param {string} errorMessage - The error message to display
   */
  showNavigationErrorPage(url, errorMessage) {
    if (!this.webview) return;
    
    console.error(`Navigation error for ${url}: ${errorMessage}`);
    
    // Hide loading content
    this.hideLoadingContent();
    
    // Create error page HTML
    const errorHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Navigation Error</title>
        <style>
          html, body {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            background-color: #f7f7f7;
            color: #333;
          }
          .error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            padding: 20px;
            box-sizing: border-box;
            text-align: center;
          }
          .error-icon {
            width: 64px;
            height: 64px;
            margin-bottom: 24px;
            color: #e74c3c;
          }
          .error-title {
            font-size: 24px;
            margin-bottom: 16px;
            color: #e74c3c;
          }
          .error-message {
            font-size: 16px;
            margin-bottom: 24px;
            max-width: 600px;
            line-height: 1.5;
          }
          .error-url {
            font-size: 14px;
            color: #666;
            margin-bottom: 24px;
            word-break: break-all;
            max-width: 80%;
            padding: 8px 16px;
            background-color: #eee;
            border-radius: 4px;
          }
          .retry-button {
            padding: 10px 20px;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s;
          }
          .retry-button:hover {
            background-color: #2980b9;
          }
          .alternative-button {
            padding: 10px 20px;
            background-color: transparent;
            color: #3498db;
            border: 1px solid #3498db;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-left: 10px;
            transition: background-color 0.3s;
          }
          .alternative-button:hover {
            background-color: rgba(52, 152, 219, 0.1);
          }
          .error-help {
            font-size: 14px;
            color: #666;
            margin-top: 24px;
            max-width: 600px;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h1 class="error-title">Navigation Error</h1>
          <p class="error-message">${errorMessage || 'There was an error loading this page.'}</p>
          <div class="error-url">${url}</div>
          <div>
            <button class="retry-button" onclick="window.location.reload()">Retry</button>
            <button class="alternative-button" onclick="window.location.href='https://www.google.com'">Go to Google</button>
          </div>
          <p class="error-help">
            If the problem persists, please try again later or check your internet connection.
          </p>
        </div>
      </body>
      </html>
    `;
    
    // Load error page into webview
    if (this.webview.tagName.toLowerCase() === 'webview') {
      try {
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`;
        
        if (typeof this.webview.loadURL === 'function') {
          this.webview.loadURL(dataUrl).catch(err => {
            console.error('Failed to load error page via loadURL:', err);
            this.webview.src = dataUrl;
          });
        } else {
          this.webview.src = dataUrl;
        }
      } catch (err) {
        console.error('Error showing navigation error page:', err);
        // Last resort
        this.webview.src = dataUrl;
      }
    } else {
      // For iframe fallback
      this.webview.src = `data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`;
    }
    
    // Update loading state
    this.isLoading = false;
    this.updateLoadingState(false);
  }

  /**
   * Show or hide the progress bar
   * @param {boolean} show - Whether to show the progress bar
   */
  showProgressBar(show) {
    if (!this.progressBar) {
      // Try to find progress bar if not directly referenced
      this.progressBar = this.progressContainer?.querySelector('.browser-progress-bar');
      if (!this.progressBar && this.container) {
        this.progressBar = this.container.querySelector('.browser-progress-bar');
      }
    }
    
    if (this.progressBar) {
      this.progressBar.style.display = show ? 'block' : 'none';
      
      // If showing, reset to 0%
      if (show) {
        this.progressBar.style.width = '0%';
      }
    }
  }
}

export default Browser; 