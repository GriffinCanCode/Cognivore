/**
 * VoyagerTabManager.js - Integration layer between TabManager and Voyager browser
 * 
 * This module provides a bridge between the TabManager and Voyager browser,
 * handling synchronization of tab state, content extraction, and event handling.
 */

import TabManager from './TabManager';
import webviewStateManager from './WebviewStateManager.js';

class VoyagerTabManager {
  constructor(voyager) {
    this.voyager = voyager;
    this.tabManager = new TabManager();
    this.initialized = false;
    this.isCleaningUp = false; // Track cleanup state to prevent race conditions
    this.isSwitchingTabs = false; // Track tab switching state
    
    // Event emitter for tab changes
    this.eventListeners = new Map();
    
    // Content processing queue to prevent overloading
    this.contentQueue = [];
    this.isProcessingContent = false;
    this.maxConcurrentProcessing = 2;
    this.processingCount = 0;
    
    // Initialize the tab manager
    this.init();
  }
  
  /**
   * Initialize the tab manager and set up event listeners
   */
  init() {
    if (this.initialized || this.isCleaningUp) return;
    
    try {
      // CRITICAL FIX: Ensure we always have a valid URL and don't create duplicate tabs
      if (this.voyager) {
        let initialUrl = 'https://www.google.com';
        let initialTitle = 'Google';
        
        // Only use voyager URL if it's actually valid
        if (this.voyager.state?.url && 
            this.voyager.state.url !== '' && 
            this.voyager.state.url !== 'about:blank' &&
            this.voyager.state.url !== null &&
            this.voyager.state.url !== undefined) {
          initialUrl = this.voyager.state.url;
          initialTitle = this.voyager.state.title || this.voyager.state.url;
        }
        
        console.log('Initializing VoyagerTabManager with:', { initialUrl, initialTitle });
        
        // CRITICAL FIX: Clear any existing tabs first to prevent duplicates
        if (this.tabManager.getTabs().length > 0) {
          console.log('Clearing existing tabs before initialization');
          this.tabManager.getTabs().forEach(tab => {
            this.tabManager.closeTab(tab.id);
          });
        }
        
        // Create initial tab with guaranteed valid URL
        const initialTab = this.tabManager.addTab({
          url: initialUrl,
          title: initialTitle,
          favicon: this.getFaviconFromUrl(initialUrl),
          isActive: true
        });
        
        // Ensure the tab is set as active
        this.tabManager.setActiveTab(initialTab.id);
        
        console.log('Created initial tab:', initialTab);
        
        // Set up clean event listeners
        this.setupEventListeners();
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing VoyagerTabManager:', error);
    }
  }
  
  /**
   * Set up event listeners using a clean event-based approach
   */
  setupEventListeners() {
    if (this.isCleaningUp) return;
    
    try {
      // Listen for Voyager navigation events
      this.addEventListener('navigation', (event) => {
        if (!this.isCleaningUp && !this.isSwitchingTabs) {
          this.handlePageNavigation(event.detail);
        }
      });
      
      // Listen for content capture events
      this.addEventListener('contentCaptured', (event) => {
        if (!this.isCleaningUp) {
          this.handleContentCapture(event.detail);
        }
      });
      
      // Subscribe to tab manager changes
      this.tabManager.subscribe((state) => {
        if (!this.isCleaningUp) {
          this.handleTabManagerUpdate(state);
        }
      });
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }
  
  /**
   * Add event listener
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler
   */
  addEventListener(eventType, handler) {
    if (this.isCleaningUp) return;
    
    try {
      if (!this.eventListeners.has(eventType)) {
        this.eventListeners.set(eventType, []);
      }
      this.eventListeners.get(eventType).push(handler);
    } catch (error) {
      console.error('Error adding event listener:', error);
    }
  }
  
  /**
   * Emit event to listeners
   * @param {string} eventType - Event type
   * @param {Object} detail - Event detail
   */
  emitEvent(eventType, detail) {
    if (this.isCleaningUp) return;
    
    try {
      const listeners = this.eventListeners.get(eventType) || [];
      const event = new CustomEvent(eventType, { detail });
      listeners.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    } catch (error) {
      console.error('Error emitting event:', error);
    }
  }
  
  /**
   * Handle page navigation in Voyager to update tab state
   * @param {Object} navigationData - Page navigation data
   */
  handlePageNavigation(navigationData) {
    // CRITICAL FIX: More robust checks to prevent navigation event interference during tab switching
    if (!navigationData || !navigationData.url || this.isCleaningUp) return;
    
    // CRITICAL FIX: Ignore ALL navigation events during tab switching operations
    if (this.isSwitchingTabs) {
      console.log('Ignoring navigation event during tab switching:', navigationData.url, 'source:', navigationData.source);
      return;
    }
    
    // CRITICAL FIX: Enhanced filtering based on navigation source and timing
    const { url, title, source } = navigationData;
    
    // CRITICAL FIX: More aggressive filtering for webview events near tab switches
    if (source === 'webview_load' || source === 'webview_navigation') {
      // Check if we just finished a tab switch recently (within 3 seconds)
      if (this._lastTabSwitchTime && (Date.now() - this._lastTabSwitchTime) < 3000) {
        console.log(`Ignoring ${source} event - too close to recent tab switch:`, url);
        return;
      }
    }
    
    // CRITICAL FIX: Validate URL before processing
    if (!url || url === '' || url === 'about:blank' || url === null || url === undefined) {
      console.log('Ignoring navigation event with invalid URL:', url);
      return;
    }
    
    // CRITICAL FIX: Check if this is a tab switch navigation by comparing with existing tab URLs
    const existingTab = this.tabManager.getTabs().find(tab => tab.url === url);
    if (existingTab && existingTab.id !== this.tabManager.getActiveTabId()) {
      console.log('Navigation appears to be a tab switch, ignoring to prevent URL corruption:', url);
      return;
    }
    
    try {
      const activeTab = this.tabManager.getActiveTab();
      
      if (activeTab) {
        // CRITICAL FIX: Better URL validation and comparison
        if (!activeTab.url || activeTab.url === '' || activeTab.url === null) {
          console.log('Active tab has invalid URL, updating with navigation URL:', url);
          this.tabManager.updateTab(activeTab.id, {
            url,
            title: title || activeTab.title || url,
            lastVisited: new Date().toISOString()
          });
          return;
        }
        
        // CRITICAL FIX: Only update tab URL if it's actually different and not a tab switch
        const normalizedCurrentUrl = this.normalizeUrl(activeTab.url);
        const normalizedNewUrl = this.normalizeUrl(url);
        
        // Don't update if URLs are essentially the same (prevents unnecessary updates)
        if (normalizedCurrentUrl === normalizedNewUrl) {
          console.log('URL unchanged, skipping navigation update:', url);
          return;
        }
        
        console.log(`Page navigation detected: ${activeTab.url} -> ${url} (source: ${source || 'unknown'})`);
        
        // CRITICAL FIX: Capture current state BEFORE updating URL to preserve the previous page state
        if (this.voyager && this.voyager.webview) {
          // Immediate basic state capture to preserve current page before URL change
          webviewStateManager.captureBasicState(activeTab.id, this.voyager.webview);
        }
        
        // Update existing active tab with new navigation data
        this.tabManager.updateTab(activeTab.id, {
          url,
          title: title || activeTab.title,
          lastVisited: new Date().toISOString()
        });

        // CRITICAL FIX: Enhanced state capture after navigation with better timing
        if (this.voyager && this.voyager.webview) {
          // Clear any existing capture timeout to prevent overlapping captures
          if (this._navigationCaptureTimeout) {
            clearTimeout(this._navigationCaptureTimeout);
          }
          
          this._navigationCaptureTimeout = setTimeout(async () => {
            if (!this.isCleaningUp && !this.isSwitchingTabs) {
              try {
                console.log(`Capturing state for tab ${activeTab.id} after navigation to ${url}`);
                await webviewStateManager.captureState(activeTab.id, this.voyager.webview);
              } catch (error) {
                console.warn('Failed to capture state after navigation:', error);
              }
            }
          }, 2000); // Increased delay to ensure page is fully loaded
        }
      } else {
        // Create new tab if none exists - but ensure it has a valid URL
        const newTab = this.tabManager.addTab({
          url,
          title: title || url,
          favicon: this.getFaviconFromUrl(url),
          isActive: true
        });
        this.tabManager.setActiveTab(newTab.id);
        console.log('Created new tab for navigation:', newTab);
      }
    } catch (error) {
      console.error('Error handling page navigation:', error);
    }
  }
  
  /**
   * Handle content capture from Voyager to update tab content
   * @param {Object} content - Captured page content
   */
  handleContentCapture(content) {
    if (!content || !content.url || this.isCleaningUp) return;
    
    try {
      const activeTab = this.tabManager.getActiveTab();
      if (activeTab && activeTab.url === content.url) {
        // Queue content processing instead of processing immediately
        this.queueContentProcessing(activeTab.id, content);
      }
    } catch (error) {
      console.error('Error handling content capture:', error);
    }
  }
  
  /**
   * Queue content processing to prevent system overload
   * @param {string} tabId - Tab ID
   * @param {Object} content - Content to process
   */
  queueContentProcessing(tabId, content) {
    if (this.isCleaningUp) return;
    
    try {
      this.contentQueue.push({ tabId, content, timestamp: Date.now() });
      this.processContentQueue();
    } catch (error) {
      console.error('Error queuing content processing:', error);
    }
  }
  
  /**
   * Process content queue efficiently
   */
  async processContentQueue() {
    // Prevent concurrent processing beyond limit or during cleanup
    if (this.processingCount >= this.maxConcurrentProcessing || this.isCleaningUp) {
      return;
    }

    // Get next item from queue
    const item = this.contentQueue.shift();
    if (!item) return;

    this.processingCount++;

    try {
      await this.processTabContent(item.tabId, item.content);
    } catch (error) {
      console.error('Error processing tab content:', error);
    } finally {
      this.processingCount--;
      
      // Process next item if queue has items and not cleaning up
      if (this.contentQueue.length > 0 && !this.isCleaningUp) {
        // Small delay to prevent overwhelming the system
        setTimeout(() => {
          if (!this.isCleaningUp) {
            this.processContentQueue();
          }
        }, 100);
      }
    }
  }
  
  /**
   * Process individual tab content
   * @param {string} tabId - Tab ID
   * @param {Object} content - Content to process
   */
  async processTabContent(tabId, content) {
    if (this.isCleaningUp) return;
    
    try {
      const extractedContent = {
        title: content.title,
        text: content.text || '',
        html: content.processedContent || '',
        summary: content.text?.substring(0, 1000) || '',
        paragraphs: this.extractParagraphs(content.text),
        keywords: this.extractKeywords(content.title, content.text),
        capturedAt: content.timestamp || new Date().toISOString()
      };

      // Update tab content only if not cleaning up
      if (!this.isCleaningUp) {
        this.tabManager.updateTabContent(tabId, { extractedContent });
      }
    } catch (error) {
      console.error('Error processing tab content:', error);
    }
  }
  
  /**
   * Handle tab manager state updates
   * @param {Object} state - New tab manager state
   */
  handleTabManagerUpdate(state) {
    if (this.isCleaningUp) return;
    
    try {
      // Emit event for UI components to update
      this.emitEvent('tabsUpdated', state);
      
      // Update Voyager if active tab changed and not currently switching tabs
      if (!this.isSwitchingTabs) {
        const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
        if (activeTab && this.voyager) {
          // Only navigate if URL is different from current
          if (activeTab.url !== this.voyager.state?.url) {
            this.emitEvent('tabSwitched', { tab: activeTab });
          }
        }
      }
    } catch (error) {
      console.error('Error handling tab manager update:', error);
    }
  }
  
  /**
   * Switch to a specific tab with state preservation
   * @param {string} tabId - Tab ID to switch to
   */
  async switchToTab(tabId) {
    if (this.isCleaningUp) {
      console.log('Component cleaning up, skipping tab switch');
      return;
    }
    
    // CRITICAL FIX: Prevent overlapping tab switches with better locking
    if (this.isSwitchingTabs) {
      console.log('Tab switch already in progress, queueing request for tab:', tabId);
      
      // Queue the tab switch for later execution instead of ignoring it
      setTimeout(() => {
        if (!this.isCleaningUp && !this.isSwitchingTabs) {
          console.log('Executing queued tab switch to:', tabId);
          this.switchToTab(tabId);
        }
      }, 600); // Wait for current switch to complete
      return;
    }
    
    // Set flag to prevent race conditions
    this.isSwitchingTabs = true;
    // CRITICAL FIX: Track tab switch timing for navigation event filtering
    this._lastTabSwitchTime = Date.now();
    
    try {
      const targetTab = this.tabManager.getTabById(tabId);
      const currentActiveTab = this.tabManager.getActiveTab();
      
      if (!targetTab) {
        console.warn(`Cannot switch to tab ${tabId}: tab not found`);
        this.isSwitchingTabs = false;
        return;
      }

      // CRITICAL FIX: Validate target tab has a valid URL
      if (!targetTab.url || targetTab.url === '' || targetTab.url === null || targetTab.url === undefined) {
        console.warn(`Target tab ${tabId} has invalid URL, setting default`);
        targetTab.url = 'https://www.google.com';
        this.tabManager.updateTab(tabId, { url: targetTab.url, title: 'Google' });
      }

      // Skip if already the active tab
      if (currentActiveTab && currentActiveTab.id === tabId) {
        console.log('Target tab is already active, no switch needed');
        this.isSwitchingTabs = false;
        return;
      }

      console.log(`Switching from tab ${currentActiveTab?.id || 'none'} to tab ${tabId}`, {
        currentUrl: currentActiveTab?.url,
        targetUrl: targetTab.url,
        timestamp: new Date().toISOString()
      });

      // Step 1: Save current tab state if we have an active tab and webview
      if (currentActiveTab && this.voyager && this.voyager.webview) {
        try {
          // CRITICAL FIX: Only capture state if current tab has a valid URL
          if (currentActiveTab.url && currentActiveTab.url !== '' && currentActiveTab.url !== null) {
            console.log(`Capturing state for current tab ${currentActiveTab.id} (${currentActiveTab.url})`);
            await webviewStateManager.captureState(currentActiveTab.id, this.voyager.webview);
          } else {
            console.log(`Skipping state capture for tab ${currentActiveTab.id} - invalid URL`);
          }
        } catch (error) {
          console.warn('Failed to capture current tab state:', error);
          // Continue with tab switch even if state capture fails
        }
      }

      // Step 2: Set the new active tab in TabManager
      this.tabManager.setActiveTab(tabId);
      
      // Step 3: Navigate and restore state for the target tab
      if (this.voyager && targetTab.url) {
        try {
          // Check if we have saved state for this tab
          const savedState = webviewStateManager.getState(tabId);
          
          if (savedState && savedState.url && this.voyager.webview) {
            // CRITICAL FIX: Validate saved state URL before restoration
            if (savedState.url !== 'about:blank' && savedState.url !== '' && savedState.url !== null) {
              console.log(`Restoring saved state for tab ${tabId} (${savedState.url})`);
              const restored = await webviewStateManager.restoreState(
                tabId, 
                this.voyager.webview, 
                targetTab.url
              );
              
              if (restored) {
                console.log(`Successfully restored state for tab ${tabId}`);
              } else {
                console.log(`State restoration failed for tab ${tabId}, navigating normally`);
                // Fallback to normal navigation
                await this.safeNavigate(targetTab.url);
              }
            } else {
              console.log(`Saved state has invalid URL for tab ${tabId}, navigating normally`);
              await this.safeNavigate(targetTab.url);
            }
          } else {
            // No saved state, just navigate normally
            console.log(`No saved state for tab ${tabId}, navigating to ${targetTab.url}`);
            await this.safeNavigate(targetTab.url);
          }
        } catch (error) {
          console.error('Error during tab navigation/restoration:', error);
          // Fallback to basic navigation
          await this.safeNavigate(targetTab.url);
        }
      }

      // CRITICAL FIX: Extended delay to ensure navigation completes before clearing flag
      setTimeout(() => {
        this.isSwitchingTabs = false;
        console.log(`Tab switch to ${tabId} completed at ${new Date().toISOString()}`);
      }, 700); // Increased delay to prevent race conditions

    } catch (error) {
      console.error('Error switching to tab:', error);
      this.isSwitchingTabs = false;
    }
  }
  
  /**
   * Safe navigation wrapper that handles errors gracefully
   * @param {string} url - URL to navigate to
   */
  async safeNavigate(url) {
    try {
      if (this.voyager && this.voyager.navigate && typeof this.voyager.navigate === 'function') {
        await this.voyager.navigate(url);
      } else {
        console.warn('Voyager navigate method not available');
      }
    } catch (error) {
      console.error('Error in safe navigation:', error);
    }
  }
  
  /**
   * Create a new tab with enhanced state management
   * @param {Object} tabData - Tab data
   * @returns {Object} - Created tab
   */
  createTab(tabData = {}) {
    if (this.isCleaningUp) return null;
    
    try {
      // Capture current tab state before creating new tab
      const currentActiveTab = this.tabManager.getActiveTab();
      if (currentActiveTab && this.voyager && this.voyager.webview) {
        // Do a quick basic state capture for the current tab
        webviewStateManager.captureBasicState(currentActiveTab.id, this.voyager.webview);
      }

      // CRITICAL FIX: Ensure new tab has a valid URL
      const defaultUrl = 'https://www.google.com';
      const newTabData = {
        url: tabData.url || defaultUrl,
        title: tabData.title || 'New Tab',
        favicon: tabData.favicon || this.getFaviconFromUrl(tabData.url || defaultUrl),
        ...tabData
      };

      console.log('Creating new tab with data:', newTabData);

      const newTab = this.tabManager.addTab(newTabData);
      
      // Switch to new tab with state preservation
      this.switchToTab(newTab.id);
      
      return newTab;
    } catch (error) {
      console.error('Error creating tab:', error);
      return null;
    }
  }
  
  /**
   * Close a tab
   * @param {string} tabId - Tab ID to close
   */
  closeTab(tabId) {
    if (this.isCleaningUp) return;
    
    try {
      const tabs = this.tabManager.getTabs();
      
      // Prevent closing the last tab
      if (tabs.length <= 1) {
        // Instead of closing, navigate to Google
        this.switchToTab(tabId);
        if (this.voyager) {
          this.voyager.navigate('https://www.google.com');
        }
        return;
      }
      
      this.tabManager.closeTab(tabId);
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  }
  
  /**
   * Extract paragraphs from HTML content
   * @param {string} html - HTML content
   * @returns {Array} - Array of paragraph texts
   */
  extractParagraphs(html) {
    if (!html) return [];
    
    try {
      // Create temporary DOM element
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Get all paragraphs
      const paragraphs = Array.from(tempDiv.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(text => text.length > 30); // Only keep substantial paragraphs
      
      return paragraphs.slice(0, 10); // Limit to 10 paragraphs
    } catch (error) {
      console.error('Error extracting paragraphs:', error);
      return [];
    }
  }
  
  /**
   * Extract keywords from title and content
   * @param {string} title - Page title
   * @param {string} content - Page content
   * @returns {Array} - Array of keywords
   */
  extractKeywords(title, content) {
    if (!title && !content) return [];
    
    try {
      // Combine title and content
      const text = `${title || ''} ${content || ''}`;
      
      // Remove HTML tags
      const plainText = text.replace(/<[^>]*>/g, ' ');
      
      // Split into words and clean up
      const words = plainText.toLowerCase()
        .split(/\s+/)
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length > 3);
      
      // Count word frequencies
      const wordCounts = {};
      words.forEach(word => {
        if (!this.isStopWord(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
      
      // Sort by frequency
      const sortedWords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([word]) => word);
      
      return sortedWords.slice(0, 15); // Limit to 15 keywords
    } catch (error) {
      console.error('Error extracting keywords:', error);
      return [];
    }
  }
  
  /**
   * Check if a word is a common stop word
   * @param {string} word - Word to check
   * @returns {boolean} - True if word is a stop word
   */
  isStopWord(word) {
    const stopWords = ['the', 'and', 'that', 'this', 'with', 'from', 'for', 'have', 'has', 'are', 'were', 'was', 'you', 'your', 'they', 'their', 'our', 'ours', 'what', 'which', 'when', 'where', 'why', 'how'];
    return stopWords.includes(word.toLowerCase());
  }
  
  /**
   * Normalize URL for comparison
   * @param {string} url - URL to normalize
   * @returns {string} - Normalized URL
   */
  normalizeUrl(url) {
    if (!url) return '';
    
    try {
      // Remove protocol and trailing slashes
      return url.toLowerCase()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '');
    } catch (error) {
      return url.toLowerCase();
    }
  }
  
  /**
   * Get favicon URL from page URL
   * @param {string} url - Page URL
   * @returns {string} - Favicon URL
   */
  getFaviconFromUrl(url) {
    if (!url) return null;
    
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.protocol}//${parsedUrl.hostname}/favicon.ico`;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get the internal TabManager instance
   * @returns {TabManager} - TabManager instance
   */
  getTabManager() {
    return this.tabManager;
  }
  
  /**
   * Get serialized tab data for React components
   * @returns {Object} - Serialized tab data
   */
  getSerializedTabData() {
    const state = this.tabManager.getState();
    return {
      tabs: state.tabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favicon: tab.favicon,
        isActive: tab.id === state.activeTabId
      })),
      activeTabId: state.activeTabId,
      onTabClick: (tabId) => this.switchToTab(tabId),
      onTabClose: (tabId) => this.closeTab(tabId),
      onNewTab: () => this.createTab()
    };
  }
  
  /**
   * Analyze tabs using the specified clustering method
   * @param {string} method - Clustering method ('dbscan' or 'kmeans')
   * @param {Object} options - Clustering options
   * @returns {Promise<Object>} - Clustering results
   */
  async analyzeTabs(method = 'dbscan', options = {}) {
    return this.tabManager.analyzeTabs(method, options);
  }
  
  /**
   * Remove event listener
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler to remove
   */
  removeEventListener(eventType, handler) {
    if (this.isCleaningUp) return;
    
    try {
      if (!this.eventListeners.has(eventType)) return;
      
      const listeners = this.eventListeners.get(eventType);
      const index = listeners.indexOf(handler);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      // Clean up empty listener arrays
      if (listeners.length === 0) {
        this.eventListeners.delete(eventType);
      }
    } catch (error) {
      console.error('Error removing event listener:', error);
    }
  }

  /**
   * Clean up VoyagerTabManager resources and event listeners
   */
  cleanup() {
    // Prevent multiple cleanup calls and race conditions
    if (this.isCleaningUp) {
      console.log('VoyagerTabManager cleanup already in progress, skipping');
      return;
    }
    
    this.isCleaningUp = true;
    
    try {
      console.log('VoyagerTabManager cleaning up...');
      
      // Stop any ongoing tab switching
      this.isSwitchingTabs = false;
      
      // CRITICAL FIX: Clear navigation capture timeout
      if (this._navigationCaptureTimeout) {
        clearTimeout(this._navigationCaptureTimeout);
        this._navigationCaptureTimeout = null;
      }
      
      // Clear content processing queue
      this.contentQueue = [];
      this.isProcessingContent = false;
      this.processingCount = 0;
      
      // Clear all event listeners safely
      try {
        this.eventListeners.clear();
      } catch (error) {
        console.warn('Error clearing event listeners:', error);
      }
      
      // Clean up webview state manager
      try {
        webviewStateManager.clearAllStates();
      } catch (error) {
        console.warn('Error cleaning up webview state manager:', error);
      }
      
      // Clean up tab manager
      if (this.tabManager && typeof this.tabManager.cleanup === 'function') {
        try {
          this.tabManager.cleanup();
        } catch (error) {
          console.warn('Error cleaning up tab manager:', error);
        }
      }
      
      // Clear references
      this.voyager = null;
      this.tabManager = null;
      this.initialized = false;
      
      console.log('VoyagerTabManager cleaned up successfully');
    } catch (error) {
      console.error('Error during VoyagerTabManager cleanup:', error);
    }
  }
}

export default VoyagerTabManager; 