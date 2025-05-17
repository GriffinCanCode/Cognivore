/**
 * BookmarkService.js - Provides UI-integrated bookmark functionality
 * 
 * This service extends the BookmarkManager with methods for UI integration
 * and handling bookmark operations in the context of the Voyager browser.
 */

import BookmarkManager from './BookmarkManager';

/**
 * Check if the current page is bookmarked
 * 
 * @param {Object} browser - Browser instance
 * @returns {Promise<boolean>} Promise resolving to bookmark status
 */
export function isCurrentPageBookmarked(browser) {
  if (!browser || !browser.state.url) {
    return Promise.resolve(false);
  }
  
  return BookmarkManager.isBookmarked(browser.state.url);
}

/**
 * Toggle bookmark status for the current page
 * 
 * @param {Object} browser - Browser instance
 * @returns {Promise<boolean>} Promise resolving to new bookmark status
 */
export function toggleBookmark(browser) {
  if (!browser || !browser.state.url) {
    console.error('Cannot toggle bookmark: No active URL');
    return Promise.resolve(false);
  }
  
  const url = browser.state.url;
  const title = browser.state.title || url;
  const favicon = browser.state.favicon || null;
  
  return isCurrentPageBookmarked(browser)
    .then(isBookmarked => {
      if (isBookmarked) {
        // Remove bookmark
        return BookmarkManager.removeBookmark(url).then(() => {
          updateBookmarkButton(browser, false);
          return false;
        });
      } else {
        // Add bookmark
        const bookmark = {
          url,
          title,
          favicon,
          addedAt: new Date().toISOString()
        };
        
        return BookmarkManager.addBookmark(bookmark).then(() => {
          updateBookmarkButton(browser, true);
          return true;
        });
      }
    })
    .catch(err => {
      console.error('Error toggling bookmark:', err);
      return false;
    });
}

/**
 * Update the bookmark button state
 * 
 * @param {Object} browser - Browser instance
 * @param {boolean} isBookmarked - Whether the current page is bookmarked
 */
export function updateBookmarkButton(browser, isBookmarked) {
  if (!browser || !browser.containerRef || !browser.containerRef.current) {
    return;
  }
  
  const bookmarkBtn = browser.containerRef.current.querySelector('.browser-bookmark-btn');
  if (!bookmarkBtn) return;
  
  if (isBookmarked) {
    bookmarkBtn.classList.add('active');
    bookmarkBtn.title = 'Remove bookmark';
  } else {
    bookmarkBtn.classList.remove('active');
    bookmarkBtn.title = 'Add bookmark';
  }
}

/**
 * Update bookmark status when page changes
 * 
 * @param {Object} browser - Browser instance
 */
export function updateBookmarkStatus(browser) {
  if (!browser || !browser.state.url) return;
  
  isCurrentPageBookmarked(browser)
    .then(isBookmarked => {
      updateBookmarkButton(browser, isBookmarked);
    })
    .catch(err => {
      console.error('Error checking bookmark status:', err);
    });
}

/**
 * Find bookmarks matching a search query
 * 
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} Promise resolving to matching bookmarks
 */
export function searchBookmarks(query, limit = 10) {
  if (!query) {
    return Promise.resolve([]);
  }
  
  return BookmarkManager.getBookmarks()
    .then(bookmarks => {
      query = query.toLowerCase();
      
      // Filter and sort bookmarks by relevance
      const results = bookmarks.filter(bookmark => {
        const url = bookmark.url.toLowerCase();
        const title = (bookmark.title || '').toLowerCase();
        
        return url.includes(query) || title.includes(query);
      });
      
      // Sort by relevance (title matches first, then URL matches)
      results.sort((a, b) => {
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        const aUrl = a.url.toLowerCase();
        const bUrl = b.url.toLowerCase();
        
        const aTitleIndex = aTitle.indexOf(query);
        const bTitleIndex = bTitle.indexOf(query);
        const aUrlIndex = aUrl.indexOf(query);
        const bUrlIndex = bUrl.indexOf(query);
        
        // If both have title matches, sort by title match position
        if (aTitleIndex !== -1 && bTitleIndex !== -1) {
          return aTitleIndex - bTitleIndex;
        }
        
        // Title matches first
        if (aTitleIndex !== -1) return -1;
        if (bTitleIndex !== -1) return 1;
        
        // Then URL matches
        return aUrlIndex - bUrlIndex;
      });
      
      return results.slice(0, limit);
    })
    .catch(err => {
      console.error('Error searching bookmarks:', err);
      return [];
    });
}

export default {
  toggleBookmark,
  isCurrentPageBookmarked,
  updateBookmarkStatus,
  updateBookmarkButton,
  searchBookmarks
}; 