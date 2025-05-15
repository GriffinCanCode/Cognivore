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
      if (typeof this.webview.applyAllCriticalStyles === 'function') {
        this.webview.applyAllCriticalStyles(true);
      } else {
        this.enforceWebviewStyles(true);
      }
      
      // Only hide loading content when webview is ready to show
      if (typeof this.webview.readyToShow === 'undefined' || this.webview.readyToShow === true) {
        // Webview is ready, proceed with hiding loading content immediately
        this._hideLoadingContent(loadingContent);
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
            this._hideLoadingContent(loadingContent);
            
            // Force webview visibility
            if (this.webview) {
              this.webview.style.visibility = 'visible';
              this.webview.style.opacity = '1';
              this.webview.readyToShow = true;
              
              // Apply all styling immediately
              if (typeof this.webview.applyAllCriticalStyles === 'function') {
                this.webview.applyAllCriticalStyles(true);
              } else {
                this.enforceWebviewStyles(true);
              }
            }
            return;
          }
          
          if (this.webview.readyToShow === true) {
            // Webview is now ready
            clearInterval(readyCheckInterval);
            this._hideLoadingContent(loadingContent);
          }
        }, 10); // Check every 10ms for faster response
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
    // Hide loading content immediately
    loadingContent.style.opacity = '0';
    loadingContent.style.display = 'none';
    
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
      
      // Immediately apply content styles if possible
      if (this.webview.tagName.toLowerCase() === 'webview' && typeof this.webview.executeJavaScript === 'function') {
        try {
          this.webview.executeJavaScript(`
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
   * @param {boolean} [forcedApply=false] - If true, ignores the throttle check for immediate application
   */
  enforceWebviewStyles(forcedApply = false) {
    // Only proceed if it's been at least 2 seconds since the last enforcement
    // to prevent excessive style application
    if (!forcedApply && this._lastStyleEnforcement && (Date.now() - this._lastStyleEnforcement < 1000)) {
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
        pointer-events: auto !important;
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
        pointer-events: auto !important;
        min-height: calc(100vh - 52px) !important;
        max-height: calc(100vh - 52px) !important;
        min-width: 100vw !important;
        max-width: 100vw !important;
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
          pointer-events: auto !important;
          user-select: auto !important;
          touch-action: auto !important;
        `;
        
        // Ensure DevTools is completely disabled
        this.webview.setAttribute('disabledevtools', 'true');
        
        // Add webpreferences with DevTools disabled
        const webPrefs = this.webview.getAttribute('webpreferences') || '';
        if (!webPrefs.includes('devTools=false')) {
          const updatedPrefs = webPrefs ? `${webPrefs}, devTools=false` : 'devTools=false';
          this.webview.setAttribute('webpreferences', updatedPrefs);
        }
        
        // Set up continuous style monitoring if not already established
        if (!this._permanentStyleInterval) {
          this._permanentStyleInterval = setInterval(() => {
            // Check if the webview still needs styling fixes
            if (this.webview && this.webview.isConnected && 
                document.body.contains(this.webview) && !this._isUnloading) {
              
              // Only re-apply styles if webview dimensions are incorrect
              const rect = this.webview.getBoundingClientRect();
              const expectedHeight = window.innerHeight - 52;
              const expectedWidth = window.innerWidth;
              
              // If dimensions are off by more than 5px, reapply styles
              if (Math.abs(rect.width - expectedWidth) > 5 ||
                  Math.abs(rect.height - expectedHeight) > 5 ||
                  rect.top !== 52 || rect.left !== 0) {
                
                console.log('Webview dimensions incorrect, reapplying styles:', {
                  current: {width: rect.width, height: rect.height, top: rect.top, left: rect.left},
                  expected: {width: expectedWidth, height: expectedHeight, top: 52, left: 0}
                });
                
                // Force immediate style reapplication
                this.enforceWebviewStyles(true);
                
                // Force content styles as well
                this.applyContentStyles(true);
              }
            }
          }, 500); // Check every 500ms
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
          pointer-events: auto !important;
          user-select: auto !important;
          touch-action: auto !important;
        `;
      }
      
      // Apply content fixes immediately
      this.applyContentStyles(forcedApply);
    }
  }
  
  /**
   * Apply content styles to webview contents
   * Separated method for better organization and focused styling
   * @param {boolean} [forcedApply=false] - If true, forces style application
   */
  applyContentStyles(forcedApply = false) {
    // Try to apply content fixes for webview contents
    if (this.webview && this.webview.tagName && 
        this.webview.tagName.toLowerCase() === 'webview' && 
        typeof this.webview.executeJavaScript === 'function') {
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
              
              /* Force correct margin values */
              html { margin-top: 0 !important; margin-left: 0 !important; margin-right: 0 !important; margin-bottom: 0 !important; }
              body { margin-top: 0 !important; margin-left: 0 !important; margin-right: 0 !important; margin-bottom: 0 !important; }
              
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
              
              /* Force all main containers to proper width */
              #main, #body, #content, .content, .main, [role="main"], 
              [id="main"], [id="content"], [class="main"], [class="content"] {
                width: 100% !important;
                max-width: 100% !important;
                min-width: auto !important;
                margin: 0 auto !important;
                padding: 0 !important;
                box-sizing: border-box !important;
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
            
            // Setup persistent style maintenance
            if (!window._styleMaintenanceSetup) {
              // Create mutation observer to maintain styles
              const observer = new MutationObserver((mutations) => {
                // Re-apply direct styles if body or html changed
                document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                document.body.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
              });
              
              // Observe html and body for style changes
              observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
              observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
              
              window._styleMaintenanceSetup = true;
            }
            
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
            
            // Add a periodic style enforcer as a fallback
            if (!window._contentFixesInterval) {
              window._contentFixesInterval = setInterval(() => {
                document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                document.body.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
              }, 1000);
            }
            
            console.log("Applied comprehensive display fixes to webview content");
          })();
          
          // Return the stored result
          window.__contentFixesResult;
        `;
        
        // Execute with proper error handling and throttling
        if (forcedApply || !this._lastContentFix || (Date.now() - this._lastContentFix > 1000)) {
          this._lastContentFix = Date.now();
          this.webview.executeJavaScript(contentFixScript)
            .catch(err => console.warn('Error applying content fixes:', err));
        }
      } catch (err) {
        console.warn('Error executing script in webview:', err);
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
      }, 25); // Reduced from 50ms for faster recovery
      return;
    }
    
    // Validate URL format
    if (!url || typeof url !== 'string') {
      console.error('Navigation failed: invalid URL', url);
      return;
    }
    
    // Force immediate style enforcement before navigation
    if (typeof this.webview.applyAllCriticalStyles === 'function') {
      // Use the enhanced applyAllCriticalStyles method if available
      this.webview.applyAllCriticalStyles(true);
    } else {
      // Fallback to standard enforcement
      this.enforceWebviewStyles(true);
    }
    
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
    
    // Show loading content - make sure it's fully visible before navigation
    this.showLoadingContent(url);
    
    // Reset readyToShow flag to ensure we wait for the new page to load
    if (this.webview) {
      this.webview.readyToShow = false;
    }
    
    try {
      // Apply site-specific settings for the target website before navigation starts
      this.applySiteSpecificSettings(url);
      
      // Keep webview partially visible during loading for better perceived performance
      if (this.webview) {
        this.webview.style.visibility = 'visible';
        this.webview.style.opacity = '0.4';  // Just visible enough to see structure forming
      }
      
      // Set a navigation timeout to prevent indefinite loading - reduced to 2.5 seconds
      this.navigationTimeoutId = setTimeout(() => {
        console.log('Navigation timeout reached, hiding loading content');
        this.hideLoadingContent();
        
        // Force webview visibility in case it's still hidden
        if (this.webview) {
          this.webview.style.visibility = 'visible';
          this.webview.style.opacity = '1';
          this.webview.readyToShow = true;
          
          // Force apply styling once more
          if (typeof this.webview.applyAllCriticalStyles === 'function') {
            this.webview.applyAllCriticalStyles(true);
          } else {
            this.enforceWebviewStyles(true);
          }
        }
      }, 2500); // 2.5 seconds is enough for most connections
      
      // Schedule style checks at multiple intervals for progressively catching and fixing style issues
      this.scheduleStyleChecks();
      
      // For webview implementations in Electron
      if (this.webview.tagName.toLowerCase() === 'webview') {
        // Make the webview visible just before navigation to improve perceived performance
        this.webview.style.visibility = 'visible';
        this.webview.style.opacity = '0.4'; // Visible enough to show loading progress
        
        // Apply critical base styles before navigation
        this.applyPreNavigationStyles();
        
        // Clear any existing load event listeners to prevent duplicates
        if (this._navigationListeners) {
          this._navigationListeners.forEach(({ event, handler }) => {
            this.webview.removeEventListener(event, handler);
          });
        }
        
        // Add one-time event listeners for this navigation
        this._navigationListeners = [];
        
        // Listen for did-start-loading to update UI immediately
        const startLoadingHandler = () => {
          console.log('Navigation started, updating UI');
          this.webview.style.opacity = '0.4'; // Make partially visible during load
          
          // Apply early style fixes
          if (typeof this.webview.executeJavaScript === 'function') {
            this.webview.executeJavaScript(`
              // Apply immediate fix for margins
              if (document.documentElement) document.documentElement.style.margin = '0';
              if (document.body) document.body.style.margin = '0';
              true;
            `).catch(() => {});
          }
        };
        this.webview.addEventListener('did-start-loading', startLoadingHandler, { once: true });
        this._navigationListeners.push({ event: 'did-start-loading', handler: startLoadingHandler });
        
        // Listen for dom-ready to apply comprehensive styling
        const domReadyHandler = () => {
          console.log('DOM ready, applying styles');
          
          // Apply comprehensive styling when DOM is ready
          if (typeof this.webview.applyAllCriticalStyles === 'function') {
            this.webview.applyAllCriticalStyles(true);
          } else {
            this.enforceWebviewStyles(true);
          }
          
          // Increase visibility as page becomes interactive
          this.webview.style.opacity = '0.6';
        };
        this.webview.addEventListener('dom-ready', domReadyHandler, { once: true });
        this._navigationListeners.push({ event: 'dom-ready', handler: domReadyHandler });
        
        // Listen for did-finish-load to complete the process
        const finishLoadHandler = () => {
          console.log('Page load finished, making fully visible');
          
          // Final style application
          if (typeof this.webview.applyAllCriticalStyles === 'function') {
            this.webview.applyAllCriticalStyles(true);
          } else {
            this.enforceWebviewStyles(true);
          }
          
          // Make fully visible
          this.webview.style.opacity = '1';
          this.webview.readyToShow = true;
          
          // Hide loading screen with a short delay to ensure styles are fully applied
          setTimeout(() => {
            this.hideLoadingContent();
          }, 10);
        };
        this.webview.addEventListener('did-finish-load', finishLoadHandler, { once: true });
        this._navigationListeners.push({ event: 'did-finish-load', handler: finishLoadHandler });
        
        // Navigate to URL
        this.webview.src = url;
      } 
      // For iframe fallback implementations
      else if (this.contentFrame) {
        this.contentFrame.src = url;
      }
    } catch (error) {
      console.error('Navigation error:', error);
      this.showNavigationErrorPage(url, error.message);
    }
  }
  
  /**
   * Apply critical styles immediately before navigation starts
   * This helps prevent the flickering effect
   */
  applyPreNavigationStyles() {
    if (!this.webview || this.webview.tagName.toLowerCase() !== 'webview') {
      return;
    }
    
    try {
      // Apply direct styling to the webview element with transition support
      this.webview.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 0 !important;
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
        pointer-events: auto !important;
        user-select: auto !important;
        touch-action: auto !important;
        transition: opacity 0.3s ease-in-out !important;
      `;
      
      // Force a layout recalculation to ensure styles are applied
      void this.webview.offsetHeight;
      
      // Directly manipulate key properties to ensure they're set correctly
      this.webview.style.top = '52px';
      this.webview.style.position = 'fixed';
      
      if (typeof this.webview.applyAllCriticalStyles === 'function') {
        this.webview.applyAllCriticalStyles(true);
      }
      
      // Apply critical content styles immediately if possible
      if (typeof this.webview.executeJavaScript === 'function') {
        this.webview.executeJavaScript(`
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
        `).catch(() => {});
      }
    } catch (e) {
      console.warn('Error applying pre-navigation styles:', e);
    }
  }
  
  /**
   * Schedule multiple style checks at different intervals
   * This creates a cascading approach to catch and fix any styling issues
   */
  scheduleStyleChecks() {
    // Clear any existing style check timers
    if (this._styleCheckTimers) {
      this._styleCheckTimers.forEach(timer => {
        if (typeof timer === 'number') {
          clearTimeout(timer);
        } else if (timer) {
          clearInterval(timer);
        }
      });
    }
    
    this._styleCheckTimers = [];
    
    // Instead of multiple checks, apply all critical styles at once
    if (typeof this.webview.applyAllCriticalStyles !== 'function') {
      // Add the comprehensive style application method to the webview
      this.webview.applyAllCriticalStyles = (forceApply = false) => {
        console.log('Applying all critical webview styles at once');
        
        // Apply direct styling to the webview element
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
          pointer-events: auto !important;
          user-select: auto !important;
          touch-action: auto !important;
        `;
        
        // Execute all styles at once in a single script
        if (this.webview.tagName.toLowerCase() === 'webview' && typeof this.webview.executeJavaScript === 'function') {
          try {
            const allInOneStyleScript = `
              (function() {
                // --- PART 1: Basic HTML/Body Styling ---
                document.documentElement.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                document.body.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                
                // --- PART 2: Style Element Creation ---
                let styleEl = document.getElementById('cognivore-content-fixes');
                if (!styleEl) {
                  styleEl = document.createElement('style');
                  styleEl.id = 'cognivore-content-fixes';
                  document.head.appendChild(styleEl);
                }
                
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
                  
                  /* Force correct margin values */
                  html { margin-top: 0 !important; margin-left: 0 !important; margin-right: 0 !important; margin-bottom: 0 !important; }
                  body { margin-top: 0 !important; margin-left: 0 !important; margin-right: 0 !important; margin-bottom: 0 !important; }
                  
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
                \`;
                
                // --- PART 3: Remove any DevTools ---
                const devTools = document.querySelectorAll('[class*="devtools-"], [id*="devtools-"], .drawer-content, .panel, .console-view');
                devTools.forEach(el => {
                  if (el && el.parentNode) {
                    try {
                      el.parentNode.removeChild(el);
                    } catch(e) {}
                  }
                });
                
                // --- PART 4: Google-specific fixes ---
                if (window.location.hostname.includes('google.com')) {
                  const mainElements = document.querySelectorAll('#main, #cnt, #rcnt, #center_col, #rso');
                  mainElements.forEach(el => {
                    if (el) {
                      el.style.cssText += "width: 100% !important; max-width: 100% !important; margin: 0 auto !important; box-sizing: border-box !important;";
                    }
                  });
                  
                  const searchContainer = document.querySelector('#center_col, #rso, #search');
                  if (searchContainer) {
                    searchContainer.style.cssText += "width: 100% !important; max-width: 900px !important; margin: 0 auto !important;";
                  }
                }
                
                // --- PART 5: Setup mutation observer ---
                if (!window._styleMaintenanceSetup) {
                  const observer = new MutationObserver(() => {
                    document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                    document.body.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                  });
                  
                  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
                  observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
                  
                  window._styleMaintenanceSetup = true;
                }
                
                // Store result in a global variable instead of using return
                window.__styleResult = true;
              })();
              
              // Access result outside the IIFE
              window.__styleResult;
            `;
            
            // Execute all styles at once
            this.webview.executeJavaScript(allInOneStyleScript)
              .then(() => console.log('Comprehensive webview content styles successfully applied'))
              .catch(err => console.warn('Error applying comprehensive styles:', err));
          } catch (err) {
            console.warn('Error executing style script:', err);
          }
        }
        
        // Mark as ready to show
        this.webview.readyToShow = true;
      };
    }
    
    // Apply a single comprehensive style pass instead of multiple checks
    if (this.webview && !this._isUnloading) {
      this.webview.applyAllCriticalStyles(true);
      
      // Immediately mark as ready to show
      this.webview.readyToShow = true;
      this.webview.style.opacity = '1';
      
      // Check page load once after a short delay
      setTimeout(() => {
        if (this.webview && !this._isUnloading) {
          this.checkIfPageIsLoaded();
        }
      }, 300);
    }
    
    // Set a single interval to verify dimensions (reduced frequency)
    const dimensionCheck = setInterval(() => {
      if (!this.webview || this._isUnloading) {
        clearInterval(dimensionCheck);
        return;
      }
      
      // Only check dimensions if webview is connected to DOM
      if (this.webview.isConnected) {
        const rect = this.webview.getBoundingClientRect();
        const expectedHeight = window.innerHeight - 52;
        const expectedWidth = window.innerWidth;
        
        // If dimensions are off by more than 3px, reapply styles
        if (Math.abs(rect.width - expectedWidth) > 3 ||
            Math.abs(rect.height - expectedHeight) > 3 ||
            rect.top !== 52 || rect.left !== 0) {
          
          console.log('Webview dimensions incorrect, reapplying styles:', {
            current: {width: rect.width, height: rect.height, top: rect.top, left: rect.left},
            expected: {width: expectedWidth, height: expectedHeight, top: 52, left: 0}
          });
          
          // Force immediate style reapplication
          this.webview.applyAllCriticalStyles(true);
        }
      }
    }, 500);
    
    this._styleCheckTimers.push(dimensionCheck);
    
    // Clean up timers after max time
    setTimeout(() => {
      if (this._styleCheckTimers) {
        this._styleCheckTimers.forEach(timer => {
          if (typeof timer === 'number') {
            clearTimeout(timer);
          } else if (timer) {
            clearInterval(timer);
          }
        });
        this._styleCheckTimers = [];
      }
    }, 3000);
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
    
    // Create webview with container - but keep it hidden initially
    const { container: webviewContainer, webview } = BrowserRenderer.createWebview(this, 'webview', 'standard');
    
    // Apply initial hiding styles to prevent ANY flickering
    webview.style.cssText = `
      display: flex !important;
      visibility: hidden !important;
      opacity: 0 !important;
      z-index: -1 !important;
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
      pointer-events: none !important;
    `;
    
    // Add special class for tracking
    webview.classList.add('hidden-until-ready');
    
    // Add to DOM
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
      
      // Initialize readyToShow property
      this.webview.readyToShow = false;
      
      // Automatically navigate to blank page to initialize - with short delay to ensure DOM is ready
      setTimeout(() => {
        if (!this.currentUrl) {
          // Show loading content first
          this.showLoadingContent('about:blank');
          
          // Use a direct src assignment for initial navigation
          this.webview.src = 'about:blank';
          this.currentUrl = 'about:blank';
          
          // Set up visibility handler after first navigation
          const completeInitHandler = () => {
            this.webview.removeEventListener('did-finish-load', completeInitHandler);
            
            // Make sure we apply styles immediately
            if (typeof this.webview.applyAllCriticalStyles === 'function') {
              this.webview.applyAllCriticalStyles(true);
            } else {
              this.enforceWebviewStyles(true);
            }
            
            // Delay showing to ensure styles are applied
            setTimeout(() => {
              // Mark as ready to show
              this.webview.readyToShow = true;
              
              // Remove hidden class
              this.webview.classList.remove('hidden-until-ready');
              
              // Update styles to show webview
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
                pointer-events: auto !important;
              `;
              
              // Hide loading content
              this.hideLoadingContent();
            }, 100);
          };
          
          this.webview.addEventListener('did-finish-load', completeInitHandler);
        }
      }, 50);
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
    
    // Set a flag to indicate unloading
    this._isUnloading = true;
    
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
    if (this._permanentStyleInterval) {
      clearInterval(this._permanentStyleInterval);
      this._permanentStyleInterval = null;
    }
    
    // Clear any navigation timeout
    if (this.navigationTimeoutId) {
      clearTimeout(this.navigationTimeoutId);
      this.navigationTimeoutId = null;
    }
    
    // Clear any style check timers
    if (this._styleCheckTimers) {
      this._styleCheckTimers.forEach(timer => {
        if (typeof timer === 'number') {
          clearTimeout(timer);
        } else if (timer) {
          clearInterval(timer);
        }
      });
      this._styleCheckTimers = [];
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
          if (window._contentFixesInterval) {
            clearInterval(window._contentFixesInterval);
            window._contentFixesInterval = null;
          }
          // Disconnect any observers
          if (window.cognivoreStyleObserver) {
            window.cognivoreStyleObserver.disconnect();
            window.cognivoreStyleObserver = null;
          }
          if (window._styleMaintenanceSetup) {
            window._styleMaintenanceSetup = false;
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
        // Try to use executeJavaScript to check readyState
        if (typeof this.webview.executeJavaScript === 'function') {
          this.webview.executeJavaScript(`
            {
              // Apply crucial styling first to ensure proper display while checking
              document.documentElement.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
              if (document.body) { 
                document.body.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                
                // Add a style tag with !important rules to ensure they're applied
                if (!document.getElementById('cognivore-essential-fix')) {
                  const style = document.createElement('style');
                  style.id = 'cognivore-essential-fix';
                  style.textContent = 'html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow-x: hidden !important; overflow-y: auto !important; }';
                  document.head.appendChild(style);
                }
              }
              
              // Return true if page appears to be loaded
              document.readyState === 'complete' || document.readyState === 'interactive';
            }
          `).then((isReady) => {
            if (isReady) {
              console.log('Page appears to be loaded based on readyState check');
              
              // Apply comprehensive styling immediately
              if (typeof this.webview.applyAllCriticalStyles === 'function') {
                this.webview.applyAllCriticalStyles(true);
              } else {
                // Apply full styling immediately as fallback
                this.webview.executeJavaScript(`
                  // Apply comprehensive styles
                  document.documentElement.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                  document.body.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                  
                  // Force fix in case default styles haven't been applied yet
                  const style = document.createElement('style');
                  style.textContent = "html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow-x: hidden !important; overflow-y: auto !important; }";
                  document.head.appendChild(style);
                  
                  // Apply Google-specific fixes if on Google
                  if (window.location.hostname.includes('google.com')) {
                    const mainElements = document.querySelectorAll('#main, #cnt, #rcnt, #center_col, #rso');
                    mainElements.forEach(el => {
                      if (el) {
                        el.style.cssText += "width: 100% !important; max-width: 100% !important; margin: 0 auto !important; box-sizing: border-box !important;";
                      }
                    });
                    
                    // Fix any search results container
                    const searchContainer = document.querySelector('#center_col, #rso, #search');
                    if (searchContainer) {
                      searchContainer.style.cssText += "width: 100% !important; max-width: 900px !important; margin: 0 auto !important;";
                    }
                  }
                  
                  true;
                `).catch(() => {});
              }
              
              // Update state and hide loading immediately
              this.isLoading = false;
              this.updateLoadingState(false);
              
              // Mark webview as ready to show
              if (typeof this.webview.readyToShow === 'undefined') {
                this.webview.readyToShow = true;
              } else {
                this.webview.readyToShow = true;
              }
              
              // Make webview visible with crucial styling
              this.webview.style.visibility = 'visible';
              this.webview.style.opacity = '1';
              
              // Hide loading content without delay
              this.hideLoadingContent();
              
              // Apply force styling
              this.enforceWebviewStyles(true);
            }
          }).catch(err => {
            console.warn('Error checking readyState:', err);
          });
        }
        
        // Get the current URL to check if navigation happened as a fallback
        if (typeof this.webview.getURL === 'function') {
          const currentURL = this.webview.getURL();
          
          // If URL changed, consider it loaded
          if (currentURL && currentURL !== 'about:blank' && currentURL !== this.currentUrl) {
            console.log('Page appears to be loaded based on URL change:', currentURL);
            this.currentUrl = currentURL;
            this.isLoading = false;
            this.updateLoadingState(false);
            
            // Mark as ready
            if (typeof this.webview.readyToShow === 'undefined') {
              this.webview.readyToShow = true;
            } else {
              this.webview.readyToShow = true;
            }
            
            // Apply immediate styling
            this.enforceWebviewStyles(true);
            
            // Ensure webview is visible
            this.webview.style.visibility = 'visible';
            this.webview.style.opacity = '1';
            
            // Hide loading content
            this.hideLoadingContent();
          }
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
            
            if (typeof this.webview.readyToShow === 'undefined') {
              this.webview.readyToShow = true;
            } else {
              this.webview.readyToShow = true;
            }
            
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

  /**
   * Navigate the browser to a URL
   * @param {string} url - The URL to navigate to
   */
  navigate(url) {
    if (!url) {
      console.warn('Attempted navigation with empty URL');
      return;
    }
    
    // Normalize URL - ensure it has a protocol
    if (!url.includes('://')) {
      if (url.startsWith('localhost') || url.match(/^[\\d\\.]+:\\d+$/)) {
        url = `http://${url}`;
      } else {
        url = `https://${url}`;
      }
    }
    
    // Store navigation start time for performance tracking
    this._lastNavigationStartTime = Date.now();
    
    try {
      // Apply immediate style enforcement before navigation
      if (typeof this.webview.applyAllCriticalStyles === 'function') {
        // Use the enhanced applyAllCriticalStyles method if available
        this.webview.applyAllCriticalStyles(true);
      } else {
        // Fallback to standard enforcement
        this.enforceWebviewStyles(true);
      }
      
      // Apply pre-navigation styles for smoother transitions
      this.applyPreNavigationStyles();

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
      
      // Show loading content - make sure it's fully visible before navigation
      this.showLoadingContent(url);
      
      // Send message to preload script to apply fixes before navigation starts
      if (this.webview && this.webview.tagName.toLowerCase() === 'webview') {
        try {
          this.webview.contentWindow?.postMessage({ type: 'apply-webview-fixes' }, '*');
        } catch (e) {
          console.warn('Unable to send pre-navigation fix message to webview:', e);
        }
      }
      
      // Reset readyToShow flag to ensure we wait for the new page to load
      if (this.webview) {
        this.webview.readyToShow = false;
      }
      
      // Set progressive opacity steps during loading
      this.scheduleOpacityTransitions();
      
      // Apply site-specific settings for the target website before navigation starts
      this.applySiteSpecificSettings(url);
      
      // Set a navigation timeout to prevent indefinite loading - reduced to 1.5 seconds
      this.navigationTimeoutId = setTimeout(() => {
        console.log('Navigation timeout reached, hiding loading content');
        this.hideLoadingContent();
        
        // Force webview visibility in case it's still hidden
        if (this.webview) {
          // Use transition for smoother appearance
          this.webview.style.transition = 'opacity 0.2s ease-in-out';
          this.webview.style.visibility = 'visible';
          this.webview.style.opacity = '1';
          this.webview.readyToShow = true;
          
          // Force apply styling once more
          if (typeof this.webview.applyAllCriticalStyles === 'function') {
            this.webview.applyAllCriticalStyles(true);
          } else {
            this.enforceWebviewStyles(true);
          }
        }
      }, 1500);
      
      // Set up event listeners to handle different webview states
      if (this.webview && this.webview.tagName.toLowerCase() === 'webview') {
        // Schedule cascading style checks for this navigation
        this.scheduleStyleChecks();
        
        // Clean up any existing navigation listeners
        if (this._navigationListeners) {
          this._navigationListeners.forEach(({ event, handler }) => {
            this.webview.removeEventListener(event, handler);
          });
        }
        
        this._navigationListeners = [];
        
        // Add a finish load handler that fires once
        const finishLoadHandler = (e) => {
          this.hideLoadingContent();
          console.log(`📄 Page load complete: ${url} (${Date.now() - this.navigationStartTime}ms)`);
          
          // Ensure webview is fully visible
          this.webview.style.visibility = 'visible';
          this.webview.style.opacity = '1';
          this.webview.readyToShow = true;
          
          // Force final style application
          setTimeout(() => {
            if (typeof this.webview.applyAllCriticalStyles === 'function') {
              this.webview.applyAllCriticalStyles(true);
            } else {
              this.enforceWebviewStyles(true);
            }
            this.checkIfPageIsLoaded();
          }, 10);
        };
        this.webview.addEventListener('did-finish-load', finishLoadHandler, { once: true });
        this._navigationListeners.push({ event: 'did-finish-load', handler: finishLoadHandler });
        
        // Navigate to URL
        this.webview.src = url;
      } 
      // For iframe fallback implementations
      else if (this.contentFrame) {
        this.contentFrame.src = url;
      }
    } catch (error) {
      console.error('Navigation error:', error);
      this.showNavigationErrorPage(url, error.message);
    }
  }
  
  /**
   * Schedule a series of opacity transitions to create a smoother loading experience
   */
  scheduleOpacityTransitions() {
    if (!this.webview) return;
    
    // Clear any existing opacity timers
    if (this._opacityTimers) {
      this._opacityTimers.forEach(timer => clearTimeout(timer));
      this._opacityTimers = [];
    }
    
    // Start with invisibility for smoother transition
    this.webview.style.cssText += `
      visibility: visible !important;
      opacity: 0 !important;
      transition: opacity 0.3s ease-in-out !important;
    `;
    
    // Apply a single transition to full opacity after a brief delay
    const timer = setTimeout(() => {
      if (this.webview && this.webview.isConnected && !this._isUnloading) {
        // Apply full styles first to ensure dimensions are correct
        if (typeof this.webview.applyAllCriticalStyles === 'function') {
          this.webview.applyAllCriticalStyles(true);
        }
        
        // Fade in with transition
        this.webview.style.opacity = '1';
      }
    }, 50);
    
    this._opacityTimers = [timer];
    
    // Clean up timers after max time
    setTimeout(() => {
      if (this._opacityTimers) {
        this._opacityTimers.forEach(timer => clearTimeout(timer));
        this._opacityTimers = [];
      }
    }, 1000);
  }
}

export default Browser; 