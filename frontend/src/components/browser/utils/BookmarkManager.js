/**
 * BookmarkManager - Utility for browser bookmark management
 */

/**
 * Load bookmarks from storage
 * @returns {Array} Array of bookmark objects
 */
export function loadBookmarks() {
  try {
    const savedBookmarks = localStorage.getItem('browser-bookmarks');
    if (savedBookmarks) {
      return JSON.parse(savedBookmarks);
    }
  } catch (error) {
    console.error('Error loading bookmarks:', error);
  }
  return [];
}

/**
 * Save bookmarks to storage
 * @param {Array} bookmarks - Array of bookmark objects
 */
export function saveBookmarks(bookmarks) {
  try {
    localStorage.setItem('browser-bookmarks', JSON.stringify(bookmarks));
    return true;
  } catch (error) {
    console.error('Error saving bookmarks:', error);
    return false;
  }
}

/**
 * Add a bookmark
 * @param {Array} bookmarks - Current bookmarks array
 * @param {string} url - URL to bookmark
 * @param {string} title - Title of the page
 * @returns {Array} Updated bookmarks array
 */
export function addBookmark(bookmarks, url, title = '') {
  if (!url) return bookmarks;
  
  // Don't add duplicate bookmarks
  if (bookmarks.some(b => b.url === url)) {
    return bookmarks;
  }
  
  const newBookmarks = [...bookmarks, {
    url,
    title: title || url,
    date: new Date().toISOString()
  }];
  
  saveBookmarks(newBookmarks);
  return newBookmarks;
}

/**
 * Remove a bookmark
 * @param {Array} bookmarks - Current bookmarks array
 * @param {string} url - URL to remove
 * @returns {Array} Updated bookmarks array
 */
export function removeBookmark(bookmarks, url) {
  const newBookmarks = bookmarks.filter(bookmark => bookmark.url !== url);
  saveBookmarks(newBookmarks);
  return newBookmarks;
}

/**
 * Check if a URL is bookmarked
 * @param {Array} bookmarks - Current bookmarks array
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is bookmarked
 */
export function isBookmarked(bookmarks, url) {
  return bookmarks.some(bookmark => bookmark.url === url);
}

/**
 * Search bookmarks
 * @param {Array} bookmarks - Current bookmarks array
 * @param {string} query - Search query
 * @returns {Array} Matching bookmarks
 */
export function searchBookmarks(bookmarks, query) {
  if (!query) return bookmarks;
  
  const lowerQuery = query.toLowerCase();
  return bookmarks.filter(bookmark => 
    bookmark.title.toLowerCase().includes(lowerQuery) || 
    bookmark.url.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Sort bookmarks by date or title
 * @param {Array} bookmarks - Bookmarks array
 * @param {string} sortBy - 'date' or 'title'
 * @param {boolean} ascending - Sort direction
 * @returns {Array} Sorted bookmarks
 */
export function sortBookmarks(bookmarks, sortBy = 'date', ascending = false) {
  return [...bookmarks].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'date') {
      comparison = new Date(a.date) - new Date(b.date);
    } else if (sortBy === 'title') {
      comparison = a.title.localeCompare(b.title);
    }
    
    return ascending ? comparison : -comparison;
  });
}

export default {
  loadBookmarks,
  saveBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  searchBookmarks,
  sortBookmarks
}; 