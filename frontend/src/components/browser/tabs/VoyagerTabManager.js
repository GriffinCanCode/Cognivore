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
    
    // Initialize the tab manager
    this.init();
  }
  
  /**
   * Initialize the tab manager and set up event listeners
   */
  init() {
    if (this.initialized) return;
    
    // Get initial tab data from current page
    if (this.voyager) {
      const url = this.voyager.state?.url;
      const title = this.voyager.state?.title;
      
      if (url) {
        // Create initial tab
        this.tabManager.addTab({
          url,
          title: title || url,
          favicon: this.getFaviconFromUrl(url)
        });
      }
      
      // Set up event listeners
      this.setupEvents();
    }
    
    this.initialized = true;
  }
  
  /**
   * Set up event listeners for Voyager browser events
   */
  setupEvents() {
    // Handle page load
    if (this.voyager.props && typeof this.voyager.props.onPageLoad === 'function') {
      const originalOnPageLoad = this.voyager.props.onPageLoad;
      
      // Wrap the original onPageLoad to also track tabs
      this.voyager.props.onPageLoad = (historyRecord) => {
        // Call original handler
        originalOnPageLoad(historyRecord);
        
        // Update or add tab in tab manager
        this.handlePageNavigation(historyRecord);
      };
    } else {
      // If no onPageLoad handler exists, create one
      this.voyager.props = this.voyager.props || {};
      this.voyager.props.onPageLoad = (historyRecord) => {
        this.handlePageNavigation(historyRecord);
      };
    }
    
    // Handle content capture
    if (this.voyager.props && typeof this.voyager.props.onContentCapture === 'function') {
      const originalOnContentCapture = this.voyager.props.onContentCapture;
      
      // Wrap the original onContentCapture to also update tab content
      this.voyager.props.onContentCapture = (content) => {
        // Call original handler
        originalOnContentCapture(content);
        
        // Update tab content
        this.handleContentCapture(content);
      };
    } else {
      // If no onContentCapture handler exists, create one
      this.voyager.props = this.voyager.props || {};
      this.voyager.props.onContentCapture = (content) => {
        this.handleContentCapture(content);
      };
    }
  }
  
  /**
   * Handle page navigation in Voyager to update tab state
   * @param {Object} historyRecord - Page navigation record
   */
  handlePageNavigation(historyRecord) {
    if (!historyRecord || !historyRecord.url) return;
    
    const { url, title } = historyRecord;
    
    // Check if tab already exists
    const existingTab = this.findTabByUrl(url);
    
    if (existingTab) {
      // Update existing tab
      this.tabManager.updateTab(existingTab.id, {
        title: title || existingTab.title,
        url,
        lastVisited: new Date().toISOString()
      });
      
      // Set as active tab
      this.tabManager.setActiveTab(existingTab.id);
    } else {
      // Create new tab
      const newTab = this.tabManager.addTab({
        url,
        title: title || url,
        favicon: this.getFaviconFromUrl(url),
        lastVisited: new Date().toISOString()
      });
      
      // Set as active tab
      this.tabManager.setActiveTab(newTab.id);
    }
  }
  
  /**
   * Handle content capture from Voyager to update tab content
   * @param {Object} content - Captured page content
   */
  handleContentCapture(content) {
    if (!content || !content.url) return;
    
    // Find tab by URL
    const tab = this.findTabByUrl(content.url);
    
    if (tab) {
      // Update tab with extracted content
      this.tabManager.updateTabContent(tab.id, {
        summary: content.mainContent?.substring(0, 1000) || '',
        paragraphs: this.extractParagraphs(content.mainContent),
        keywords: this.extractKeywords(content.title, content.mainContent),
        html: content.html,
        text: content.text,
        title: content.title,
        capturedAt: content.capturedAt || new Date().toISOString()
      });
    }
  }
  
  /**
   * Find a tab by URL
   * @param {string} url - URL to search for
   * @returns {Object|null} - Tab object or null if not found
   */
  findTabByUrl(url) {
    // Normalize URL for comparison
    const normalizedUrl = this.normalizeUrl(url);
    
    return this.tabManager.getTabs().find(tab => {
      return this.normalizeUrl(tab.url) === normalizedUrl;
    });
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
   * Analyze tabs using the specified clustering method
   * @param {string} method - Clustering method ('dbscan' or 'kmeans')
   * @param {Object} options - Clustering options
   * @returns {Promise<Object>} - Clustering results
   */
  analyzeTabs(method = 'dbscan', options = {}) {
    return this.tabManager.analyzeTabs(method, options);
  }
}

export default VoyagerTabManager; 