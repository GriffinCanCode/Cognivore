/**
 * Browser Component - Web browsing and research functionality for Cognivore
 */
class Browser {
  /**
   * Constructor for Browser component
   * @param {Object} notificationService - Service for showing notifications
   */
  constructor(notificationService) {
    this.container = null;
    this.webview = null;
    this.searchInput = null;
    this.isLoading = false;
    this.currentUrl = '';
    this.history = [];
    this.historyIndex = -1;
    this.bookmarks = [];
    this.notificationService = notificationService;
    this.researchMode = false;
    
    // Bind methods
    this.handleSearch = this.handleSearch.bind(this);
    this.handleBack = this.handleBack.bind(this);
    this.handleForward = this.handleForward.bind(this);
    this.handleRefresh = this.handleRefresh.bind(this);
    this.handleStop = this.handleStop.bind(this);
    this.handleWebviewLoad = this.handleWebviewLoad.bind(this);
    this.handleWebviewError = this.handleWebviewError.bind(this);
    this.toggleResearchMode = this.toggleResearchMode.bind(this);
    this.savePageToVectorDB = this.savePageToVectorDB.bind(this);
  }
  
  /**
   * Initialize the browser component
   */
  initialize() {
    // Load saved bookmarks if available
    this.loadBookmarks();
  }
  
  /**
   * Load bookmarks from storage
   */
  loadBookmarks() {
    try {
      const savedBookmarks = localStorage.getItem('browser-bookmarks');
      if (savedBookmarks) {
        this.bookmarks = JSON.parse(savedBookmarks);
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  }
  
  /**
   * Save bookmarks to storage
   */
  saveBookmarks() {
    try {
      localStorage.setItem('browser-bookmarks', JSON.stringify(this.bookmarks));
    } catch (error) {
      console.error('Error saving bookmarks:', error);
    }
  }
  
  /**
   * Add current page to bookmarks
   */
  addBookmark() {
    if (!this.currentUrl) return;
    
    // Don't add duplicate bookmarks
    if (this.bookmarks.some(b => b.url === this.currentUrl)) {
      return;
    }
    
    const title = this.webview ? this.webview.getTitle() : 'Untitled';
    
    this.bookmarks.push({
      url: this.currentUrl,
      title: title || this.currentUrl,
      date: new Date().toISOString()
    });
    
    this.saveBookmarks();
    
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
    
    // Add http:// prefix if needed
    let formattedUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      // Check if it's a search or a URL
      if (url.includes(' ') || !url.includes('.')) {
        // Treat as search query
        formattedUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      } else {
        // Treat as URL
        formattedUrl = `https://${url}`;
      }
    }
    
    this.navigateTo(formattedUrl);
  }
  
  /**
   * Navigate to a URL
   * @param {string} url - The URL to navigate to
   */
  navigateTo(url) {
    if (!this.webview) return;
    
    this.currentUrl = url;
    this.searchInput.value = url;
    this.webview.src = url;
    this.isLoading = true;
    
    // Update loading indicator
    this.updateLoadingState();
    
    // Add to history (and truncate forward history if navigating from middle)
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    this.history.push(url);
    this.historyIndex = this.history.length - 1;
    
    // Update navigation buttons state
    this.updateNavigationButtons();
  }
  
  /**
   * Handle back button click
   */
  handleBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const url = this.history[this.historyIndex];
      this.currentUrl = url;
      this.searchInput.value = url;
      this.webview.src = url;
      
      // Update navigation buttons state
      this.updateNavigationButtons();
    }
  }
  
  /**
   * Handle forward button click
   */
  handleForward() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const url = this.history[this.historyIndex];
      this.currentUrl = url;
      this.searchInput.value = url;
      this.webview.src = url;
      
      // Update navigation buttons state
      this.updateNavigationButtons();
    }
  }
  
  /**
   * Handle refresh button click
   */
  handleRefresh() {
    if (this.webview) {
      this.webview.reload();
    }
  }
  
  /**
   * Handle stop button click
   */
  handleStop() {
    if (this.webview) {
      this.webview.stop();
      this.isLoading = false;
      this.updateLoadingState();
    }
  }
  
  /**
   * Handle webview load event
   * @param {Event} e - Load event
   */
  handleWebviewLoad(e) {
    this.isLoading = false;
    this.updateLoadingState();
    
    // Update URL in search bar
    let currentUrl = '';
    
    // Check if we're in Electron environment with a webview or browser environment with iframe
    if (this.webview) {
      if (typeof this.webview.getURL === 'function') {
        // Electron webview
        currentUrl = this.webview.getURL();
      } else if (this.webview.contentWindow && this.webview.contentWindow.location) {
        // Iframe fallback
        try {
          currentUrl = this.webview.contentWindow.location.href;
        } catch (err) {
          // Cross-origin restriction might prevent accessing location
          currentUrl = this.webview.src || this.currentUrl;
        }
      } else {
        // Last resort fallback
        currentUrl = this.webview.src || this.currentUrl;
      }
    }
    
    if (currentUrl && currentUrl !== 'about:blank') {
      this.currentUrl = currentUrl;
      this.searchInput.value = currentUrl;
    }
    
    // Check if we're in research mode and save page content
    if (this.researchMode) {
      this.extractPageContent();
    }
  }
  
  /**
   * Handle webview error event
   * @param {Event} e - Error event
   */
  handleWebviewError(e) {
    this.isLoading = false;
    this.updateLoadingState();
    
    if (this.notificationService) {
      this.notificationService.show(`Page load error: ${e.errorDescription || 'Unknown error'}`, 'error');
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
  }
  
  /**
   * Extract and save page content to vector database
   */
  extractPageContent() {
    if (!this.webview) return;
    
    // Different extraction method based on environment
    try {
      if (typeof this.webview.executeJavaScript === 'function') {
        // Electron webview
        this.webview.executeJavaScript(`
          {
            title: document.title,
            content: document.body.innerText,
            url: window.location.href
          }
        `)
        .then(result => {
          this.savePageToVectorDB(result);
        })
        .catch(error => {
          console.error('Failed to extract page content:', error);
        });
      } else {
        // Browser iframe fallback - limited by CORS
        try {
          const contentFrame = this.webview.contentWindow;
          if (contentFrame) {
            const pageData = {
              title: contentFrame.document.title,
              content: contentFrame.document.body.innerText,
              url: contentFrame.location.href
            };
            this.savePageToVectorDB(pageData);
          }
        } catch (error) {
          console.error('Failed to access iframe content (likely CORS restriction):', error);
          
          // Notify user
          if (this.notificationService) {
            this.notificationService.show('Cannot extract content from this page due to security restrictions', 'warning');
          }
        }
      }
    } catch (error) {
      console.error('Error extracting page content:', error);
    }
  }
  
  /**
   * Save page content to vector database
   * @param {Object} content - The extracted page content
   */
  savePageToVectorDB(content) {
    // Send content to main process via IPC to save in vector DB
    if (!content || !content.text || !content.title) {
      console.error('Invalid content for vector DB');
      return;
    }
    
    // Use IPC to communicate with main process
    window.ipcRenderer.invoke('save-browser-content', {
      url: this.currentUrl,
      title: content.title,
      text: content.text,
      metadata: content.metadata,
      links: content.links
    })
    .then(result => {
      if (result.success) {
        if (this.notificationService) {
          this.notificationService.show('Page saved to knowledge base', 'success');
        }
      } else {
        throw new Error(result.error || 'Failed to save page content');
      }
    })
    .catch(error => {
      console.error('Error saving page to vector DB:', error);
      if (this.notificationService) {
        this.notificationService.show('Failed to save page to knowledge base', 'error');
      }
    });
  }
  
  /**
   * Manually save current page to vector database
   */
  savePage() {
    if (!this.webview || !this.currentUrl) return;
    
    this.extractPageContent();
  }
  
  /**
   * Update loading state UI
   */
  updateLoadingState() {
    const refreshButton = this.container?.querySelector('.browser-refresh-btn');
    const stopButton = this.container?.querySelector('.browser-stop-btn');
    
    if (refreshButton && stopButton) {
      if (this.isLoading) {
        refreshButton.style.display = 'none';
        stopButton.style.display = 'block';
      } else {
        refreshButton.style.display = 'block';
        stopButton.style.display = 'none';
      }
    }
  }
  
  /**
   * Update navigation buttons state
   */
  updateNavigationButtons() {
    const backButton = this.container?.querySelector('.browser-back-btn');
    const forwardButton = this.container?.querySelector('.browser-forward-btn');
    
    if (backButton) {
      backButton.disabled = this.historyIndex <= 0;
    }
    
    if (forwardButton) {
      forwardButton.disabled = this.historyIndex >= this.history.length - 1;
    }
  }
  
  /**
   * Render the browser component
   * @returns {HTMLElement} The rendered component
   */
  render() {
    this.container = document.createElement('div');
    this.container.className = 'browser-container';
    
    // Create browser header
    const header = document.createElement('div');
    header.className = 'browser-header';
    
    // Navigation controls
    const navControls = document.createElement('div');
    navControls.className = 'browser-nav-controls';
    
    const backButton = document.createElement('button');
    backButton.className = 'browser-back-btn';
    backButton.title = 'Back';
    backButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    `;
    backButton.disabled = true;
    backButton.addEventListener('click', this.handleBack);
    navControls.appendChild(backButton);
    
    const forwardButton = document.createElement('button');
    forwardButton.className = 'browser-forward-btn';
    forwardButton.title = 'Forward';
    forwardButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
    forwardButton.disabled = true;
    forwardButton.addEventListener('click', this.handleForward);
    navControls.appendChild(forwardButton);
    
    const refreshButton = document.createElement('button');
    refreshButton.className = 'browser-refresh-btn';
    refreshButton.title = 'Refresh';
    refreshButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
    `;
    refreshButton.addEventListener('click', this.handleRefresh);
    navControls.appendChild(refreshButton);
    
    const stopButton = document.createElement('button');
    stopButton.className = 'browser-stop-btn';
    stopButton.title = 'Stop';
    stopButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="6" width="12" height="12"></rect>
      </svg>
    `;
    stopButton.style.display = 'none';
    stopButton.addEventListener('click', this.handleStop);
    navControls.appendChild(stopButton);
    
    header.appendChild(navControls);
    
    // URL/search input
    const searchForm = document.createElement('form');
    searchForm.className = 'browser-search-form';
    searchForm.addEventListener('submit', this.handleSearch);
    
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'browser-search-input';
    this.searchInput.placeholder = 'Search or enter website name';
    this.searchInput.spellcheck = false;
    this.searchInput.autocomplete = 'off';
    searchForm.appendChild(this.searchInput);
    
    const searchButton = document.createElement('button');
    searchButton.type = 'submit';
    searchButton.className = 'browser-search-btn';
    searchButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    `;
    searchForm.appendChild(searchButton);
    
    header.appendChild(searchForm);
    
    // Action buttons
    const actionButtons = document.createElement('div');
    actionButtons.className = 'browser-action-buttons';
    
    const bookmarkButton = document.createElement('button');
    bookmarkButton.className = 'browser-bookmark-btn';
    bookmarkButton.title = 'Bookmark this page';
    bookmarkButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    bookmarkButton.addEventListener('click', () => this.addBookmark());
    actionButtons.appendChild(bookmarkButton);
    
    const saveButton = document.createElement('button');
    saveButton.className = 'browser-save-btn';
    saveButton.title = 'Save page to knowledge base';
    saveButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
    `;
    saveButton.addEventListener('click', () => this.savePage());
    actionButtons.appendChild(saveButton);
    
    const researchButton = document.createElement('button');
    researchButton.className = 'browser-research-btn';
    researchButton.title = 'Toggle research mode';
    researchButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
      </svg>
    `;
    researchButton.addEventListener('click', this.toggleResearchMode);
    actionButtons.appendChild(researchButton);
    
    header.appendChild(actionButtons);
    
    this.container.appendChild(header);
    
    // Create webview container
    const webviewContainer = document.createElement('div');
    webviewContainer.className = 'browser-webview-container';
    
    // Create webview element (using iframe as fallback in browser)
    if (window.process && window.process.type === 'renderer') {
      // Electron environment - use webview
      this.webview = document.createElement('webview');
      this.webview.className = 'browser-webview';
      this.webview.src = 'about:blank';
      this.webview.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no');
      this.webview.setAttribute('allowpopups', 'yes');
      this.webview.addEventListener('did-start-loading', () => {
        this.isLoading = true;
        this.updateLoadingState();
      });
      this.webview.addEventListener('did-stop-loading', this.handleWebviewLoad);
      this.webview.addEventListener('did-fail-load', this.handleWebviewError);
    } else {
      // Regular browser environment - use iframe as fallback
      this.webview = document.createElement('iframe');
      this.webview.className = 'browser-webview';
      this.webview.src = 'about:blank';
      this.webview.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms');
      this.webview.addEventListener('load', this.handleWebviewLoad);
      this.webview.addEventListener('error', this.handleWebviewError);
    }
    
    webviewContainer.appendChild(this.webview);
    this.container.appendChild(webviewContainer);
    
    // Create research panel (initially hidden)
    const researchPanel = document.createElement('div');
    researchPanel.className = 'browser-research-panel';
    researchPanel.style.display = 'none';
    
    const researchHeader = document.createElement('div');
    researchHeader.className = 'research-panel-header';
    researchHeader.innerHTML = `
      <h3>Research</h3>
      <button class="research-panel-close">×</button>
    `;
    researchHeader.querySelector('.research-panel-close').addEventListener('click', () => {
      researchPanel.style.display = 'none';
    });
    
    researchPanel.appendChild(researchHeader);
    
    const researchContent = document.createElement('div');
    researchContent.className = 'research-panel-content';
    researchContent.innerHTML = `
      <div class="research-empty-state">
        <p>No research data available yet.</p>
        <p>Enable research mode to automatically save pages as you browse.</p>
      </div>
    `;
    
    researchPanel.appendChild(researchContent);
    this.container.appendChild(researchPanel);
    
    return this.container;
  }
  
  /**
   * Clean up component resources
   */
  cleanup() {
    // Save bookmarks before cleanup
    this.saveBookmarks();
    
    // Remove event listeners
    if (this.webview) {
      if (this.webview.tagName === 'WEBVIEW') {
        this.webview.removeEventListener('did-start-loading', null);
        this.webview.removeEventListener('did-stop-loading', this.handleWebviewLoad);
        this.webview.removeEventListener('did-fail-load', this.handleWebviewError);
      } else {
        this.webview.removeEventListener('load', this.handleWebviewLoad);
        this.webview.removeEventListener('error', this.handleWebviewError);
      }
    }
    
    // Clean up DOM elements
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    this.container = null;
    this.webview = null;
    this.searchInput = null;
  }
}

export default Browser; 