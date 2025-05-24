/**
 * VoyagerTabManager.js - Integration layer between TabManager and Voyager browser
 * 
 * This module provides a bridge between the TabManager and Voyager browser,
 * handling synchronization of tab state, content extraction, and event handling.
 */

import TabManager from './TabManager';

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
      // Get initial tab data from current page or create default Google tab
      if (this.voyager) {
        const url = this.voyager.state?.url || 'https://www.google.com';
        const title = this.voyager.state?.title || 'Google';
        
        // Always create initial tab (either with current data or default Google)
        this.tabManager.addTab({
          url,
          title,
          favicon: this.getFaviconFromUrl(url),
          isActive: true
        });
        
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
    if (!navigationData || !navigationData.url || this.isCleaningUp || this.isSwitchingTabs) return;
    
    try {
      const { url, title } = navigationData;
      const activeTab = this.tabManager.getActiveTab();
      
      if (activeTab) {
        // Update existing active tab
        this.tabManager.updateTab(activeTab.id, {
          url,
          title: title || activeTab.title,
          lastVisited: new Date().toISOString()
        });
      } else {
        // Create new tab if none exists
        const newTab = this.tabManager.addTab({
          url,
          title: title || url,
          favicon: this.getFaviconFromUrl(url),
          isActive: true
        });
        this.tabManager.setActiveTab(newTab.id);
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
   * Switch to a specific tab
   * @param {string} tabId - Tab ID to switch to
   */
  switchToTab(tabId) {
    if (this.isCleaningUp || this.isSwitchingTabs) return;
    
    // Set flag to prevent race conditions
    this.isSwitchingTabs = true;
    
    try {
      const tab = this.tabManager.getTabById(tabId);
      if (tab) {
        this.tabManager.setActiveTab(tabId);
        
        // Navigate Voyager to the tab's URL
        if (this.voyager && tab.url) {
          // Use setTimeout to avoid blocking the UI during navigation
          setTimeout(() => {
            try {
              if (!this.isCleaningUp && this.voyager) {
                this.voyager.navigate(tab.url);
              }
            } catch (error) {
              console.error('Error navigating to tab URL:', error);
            } finally {
              // Clear the switching flag after navigation
              this.isSwitchingTabs = false;
            }
          }, 10);
        } else {
          this.isSwitchingTabs = false;
        }
      } else {
        this.isSwitchingTabs = false;
      }
    } catch (error) {
      console.error('Error switching to tab:', error);
      this.isSwitchingTabs = false;
    }
  }
  
  /**
   * Create a new tab
   * @param {Object} tabData - Tab data
   * @returns {Object} - Created tab
   */
  createTab(tabData = {}) {
    if (this.isCleaningUp) return null;
    
    try {
      const newTab = this.tabManager.addTab({
        url: tabData.url || 'https://www.google.com',
        title: tabData.title || 'New Tab',
        favicon: tabData.favicon || this.getFaviconFromUrl(tabData.url),
        ...tabData
      });
      
      // Switch to new tab
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