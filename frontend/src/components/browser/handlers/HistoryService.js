/**
 * HistoryService.js - Provides browser history navigation functionality
 * 
 * This service serves as the central point for all history-related operations
 * in the Voyager browser, leveraging HistoryManager for the underlying implementation.
 */

import HistoryManager from '../utils/HistoryManager';

/**
 * Navigate back in browser history
 * 
 * @param {Object} browser - Browser instance
 * @returns {boolean} Success flag
 */
export function goBack(browser) {
  if (!browser || !browser.webview) {
    console.error('Cannot navigate back: No webview available');
    return false;
  }
  
  // Check if the webview can go back
  if (browser.webview.canGoBack()) {
    browser.webview.goBack();
    return true;
  } else {
    console.log('Cannot go back: No history available');
    return false;
  }
}

/**
 * Navigate forward in browser history
 * 
 * @param {Object} browser - Browser instance
 * @returns {boolean} Success flag
 */
export function goForward(browser) {
  if (!browser || !browser.webview) {
    console.error('Cannot navigate forward: No webview available');
    return false;
  }
  
  // Check if the webview can go forward
  if (browser.webview.canGoForward()) {
    browser.webview.goForward();
    return true;
  } else {
    console.log('Cannot go forward: No forward history available');
    return false;
  }
}

/**
 * Record a page visit in history
 * 
 * @param {Object} browser - Browser instance
 * @param {string} url - URL of page visited
 * @param {string} title - Title of page visited
 * @param {string} favicon - Favicon URL of the page
 * @returns {Promise<Object>} Promise resolving to the recorded history entry
 */
export function recordVisit(browser, url, title, favicon = null) {
  if (!url) {
    console.error('Cannot record history: No URL provided');
    return Promise.reject(new Error('No URL provided'));
  }
  
  // Skip recording for certain URLs
  if (url.startsWith('about:') || url.startsWith('chrome:') || url.startsWith('devtools:')) {
    console.log(`Skipping history recording for internal URL: ${url}`);
    return Promise.resolve(null);
  }
  
  const historyEntry = {
    url,
    title: title || url,
    favicon,
    visitedAt: new Date().toISOString()
  };
  
  // Add to browser's navigation history 
  if (browser && browser.state && Array.isArray(browser.state.history)) {
    HistoryManager.updateVisitedUrls(browser, url);
  }
  
  // Add to persistent history
  return HistoryManager.addHistoryEntry(historyEntry)
    .then(entry => {
      // Update browser state with recent history
      updateRecentHistory(browser);
      return entry;
    })
    .catch(err => {
      console.error('Error recording history entry:', err);
      throw err;
    });
}

/**
 * Update recent history in browser state
 * 
 * @param {Object} browser - Browser instance
 * @param {number} limit - Maximum number of entries to retrieve
 * @returns {Promise<Array>} Promise resolving to recent history entries
 */
export function updateRecentHistory(browser, limit = 20) {
  if (!browser) {
    return Promise.resolve([]);
  }
  
  return HistoryManager.getRecentHistory(limit)
    .then(recentHistory => {
      if (browser.setState) {
        browser.setState({ recentHistory });
      }
      return recentHistory;
    })
    .catch(err => {
      console.error('Error updating recent history:', err);
      return [];
    });
}

/**
 * Find history entries matching a search query
 * 
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} Promise resolving to matching history entries
 */
export function searchHistory(query, limit = 10) {
  if (!query) {
    return Promise.resolve([]);
  }
  
  return HistoryManager.searchHistory(query, limit)
    .catch(err => {
      console.error('Error searching history:', err);
      return [];
    });
}

/**
 * Clear browser history
 * 
 * @param {Object} browser - Browser instance
 * @param {Object} options - Clear options (timeRange, etc.)
 * @returns {Promise<boolean>} Promise resolving to success flag
 */
export function clearHistory(browser, options = {}) {
  return HistoryManager.clearHistory(options)
    .then(success => {
      if (success && browser) {
        updateRecentHistory(browser, 0);
      }
      return success;
    })
    .catch(err => {
      console.error('Error clearing history:', err);
      return false;
    });
}

/**
 * Update navigation button states based on history
 * 
 * @param {Object} browser - Browser instance
 */
export function updateNavigationButtons(browser) {
  if (!browser || !browser.webview) return;
  
  const canGoBack = browser.webview.canGoBack();
  const canGoForward = browser.webview.canGoForward();
  
  if (browser.backButton) {
    browser.backButton.disabled = !canGoBack;
  }
  
  if (browser.forwardButton) {
    browser.forwardButton.disabled = !canGoForward;
  }
}

/**
 * Handle URL navigation and history update
 * 
 * @param {Object} browser - Browser instance
 * @param {string} url - URL to navigate to
 * @param {Object} options - Navigation options
 * @returns {Promise<boolean>} Promise resolving to success flag
 */
export function navigateAndUpdateHistory(browser, url, options = {}) {
  if (!browser || !url) {
    return Promise.resolve(false);
  }
  
  const { updateHistory = true, showLoading = true } = options;
  
  // Show loading indicator if needed
  if (showLoading && browser.showLoadingContent && typeof browser.showLoadingContent === 'function') {
    browser.showLoadingContent(url);
  }
  
  // Actual navigation
  let navigated = false;
  try {
    // Try to navigate using the browser's methods
    if (browser.navigate && typeof browser.navigate === 'function') {
      browser.navigate(url);
      navigated = true;
    } 
    // Fallback to direct webview methods
    else if (browser.webview) {
      HistoryManager.tryDirectNavigation(browser, url);
      navigated = true;
    }
    
    // Update history if needed
    if (navigated && updateHistory) {
      // Update browser's in-memory navigation history
      if (browser.state && Array.isArray(browser.state.history)) {
        HistoryManager.updateVisitedUrls(browser, url);
      }
      
      // Update UI elements
      if (browser.searchInput) {
        browser.searchInput.value = url;
      }
      
      // Update UI state
      if (browser.setState) {
        browser.setState({ currentUrl: url, isLoading: true });
      }
    }
    
    return Promise.resolve(navigated);
  } catch (err) {
    console.error('Error navigating to URL:', err);
    return Promise.resolve(false);
  }
}

/**
 * Get history entry for a URL
 * 
 * @param {string} url - URL to look up
 * @returns {Promise<Object>} Promise resolving to the history entry, or null if not found
 */
export function getHistoryEntryForUrl(url) {
  if (!url) return Promise.resolve(null);
  
  return HistoryManager.getRecentHistory(1000)
    .then(history => {
      return history.find(entry => entry.url === url) || null;
    })
    .catch(err => {
      console.error('Error getting history entry for URL:', err);
      return null;
    });
}

/**
 * Initialize history for a browser instance
 * 
 * @param {Object} browser - Browser instance
 */
export function initializeBrowserHistory(browser) {
  if (!browser) return;
  
  // Initialize browser's navigation history
  const { history, historyIndex } = HistoryManager.loadHistory();
  
  if (browser.setState) {
    browser.setState({
      history: history || [],
      historyPosition: historyIndex || -1,
      recentHistory: []
    });
  }
  
  // Load recent browsing history
  updateRecentHistory(browser);
}

// Export both individual functions and a default object for flexibility
export default {
  goBack,
  goForward,
  recordVisit,
  updateRecentHistory,
  searchHistory,
  clearHistory,
  updateNavigationButtons,
  navigateAndUpdateHistory,
  getHistoryEntryForUrl,
  initializeBrowserHistory,
  
  // Expose underlying HistoryManager functions for direct access if needed
  addToHistory: HistoryManager.addToHistory,
  canGoBack: HistoryManager.canGoBack,
  canGoForward: HistoryManager.canGoForward,
  getCurrentUrl: HistoryManager.getCurrentUrl,
  loadHistory: HistoryManager.loadHistory,
  saveHistory: HistoryManager.saveHistory,
  handleBackAction: HistoryManager.handleBackAction,
  handleForwardAction: HistoryManager.handleForwardAction,
  createHistoryRecord: HistoryManager.createHistoryRecord
}; 