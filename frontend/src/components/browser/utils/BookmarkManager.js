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

/**
 * Handle bookmark creation/removal for a page
 * @param {Object} browser - Browser instance 
 * @param {string} url - Current URL
 * @param {string} title - Page title
 */
export function handleBookmarkCreation(browser, url, title) {
  if (!browser || !url) return;
  
  // Check if already bookmarked
  const isCurrentlyBookmarked = isBookmarked(browser.bookmarks, url);
  
  if (isCurrentlyBookmarked) {
    // Remove bookmark
    browser.bookmarks = removeBookmark(browser.bookmarks, url);
    console.log(`Removed bookmark: ${url}`);
  } else {
    // Add bookmark
    browser.bookmarks = addBookmark(browser.bookmarks, url, title);
    console.log(`Added bookmark: ${url} - ${title}`);
  }
  
  // Update bookmark button state
  updateBookmarkButtonState(browser, url);
  
  // Update bookmarks panel if visible
  updateBookmarksPanel(browser);
  
  // Save bookmarks to storage
  try {
    localStorage.setItem('voyager_bookmarks', JSON.stringify(browser.bookmarks));
  } catch (err) {
    console.warn('Error saving bookmarks to storage:', err);
  }
}

/**
 * Update bookmark button state
 * @param {Object} browser - Browser instance
 * @param {string} url - Current URL
 */
export function updateBookmarkButtonState(browser, url) {
  const bookmarkButton = browser.container?.querySelector('.bookmark-button');
  if (!bookmarkButton) return;
  
  const bookmarked = isBookmarked(browser.bookmarks, url);
  
  // Update button appearance
  if (bookmarked) {
    bookmarkButton.classList.add('bookmarked');
    bookmarkButton.setAttribute('title', 'Remove Bookmark');
    
    // Update icon if it uses SVG
    const svgIcon = bookmarkButton.querySelector('svg');
    if (svgIcon) {
      const pathElements = svgIcon.querySelectorAll('path');
      if (pathElements.length > 0) {
        // Assuming the first path is the fill element for a bookmark icon
        pathElements[0].setAttribute('fill', 'currentColor');
      }
    }
  } else {
    bookmarkButton.classList.remove('bookmarked');
    bookmarkButton.setAttribute('title', 'Add Bookmark');
    
    // Update icon if it uses SVG
    const svgIcon = bookmarkButton.querySelector('svg');
    if (svgIcon) {
      const pathElements = svgIcon.querySelectorAll('path');
      if (pathElements.length > 0) {
        // Assuming the first path is the fill element for a bookmark icon
        pathElements[0].setAttribute('fill', 'none');
      }
    }
  }
}

/**
 * Update bookmarks panel with current bookmarks
 * @param {Object} browser - Browser instance
 */
export function updateBookmarksPanel(browser) {
  if (!browser || !browser.bookmarks) return;
  
  const bookmarksPanel = browser.container?.querySelector('.bookmarks-panel');
  if (!bookmarksPanel) return;
  
  // Clear existing bookmarks
  bookmarksPanel.innerHTML = '';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'bookmarks-header';
  header.innerHTML = '<h3>Bookmarks</h3>';
  bookmarksPanel.appendChild(header);
  
  // No bookmarks message
  if (!browser.bookmarks.length) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-bookmarks';
    emptyMessage.textContent = 'No bookmarks yet. Add some by clicking the bookmark icon.';
    bookmarksPanel.appendChild(emptyMessage);
    return;
  }
  
  // Create bookmark list
  const bookmarksList = document.createElement('div');
  bookmarksList.className = 'bookmarks-list';
  
  // Add each bookmark
  browser.bookmarks.forEach(bookmark => {
    const bookmarkItem = document.createElement('div');
    bookmarkItem.className = 'bookmark-item';
    
    // Create favicon if available
    let faviconHtml = '';
    try {
      const domain = new URL(bookmark.url).hostname;
      faviconHtml = `<img class="bookmark-favicon" src="https://www.google.com/s2/favicons?domain=${domain}" alt="">`;
    } catch (err) {
      // Skip favicon if URL is invalid
    }
    
    // Create bookmark item content
    bookmarkItem.innerHTML = `
      ${faviconHtml}
      <a class="bookmark-link" href="${bookmark.url}" title="${bookmark.url}">${bookmark.title || bookmark.url}</a>
      <button class="bookmark-remove" data-url="${bookmark.url}" title="Remove">&times;</button>
    `;
    
    // Add click handler for bookmark links
    const link = bookmarkItem.querySelector('.bookmark-link');
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Navigate to bookmark URL
        if (browser.navigateTo && typeof browser.navigateTo === 'function') {
          browser.navigateTo(bookmark.url);
        } else if (browser.webview) {
          browser.webview.src = bookmark.url;
        }
        
        // Hide bookmarks panel
        bookmarksPanel.style.display = 'none';
      });
    }
    
    // Add click handler for remove button
    const removeButton = bookmarkItem.querySelector('.bookmark-remove');
    if (removeButton) {
      removeButton.addEventListener('click', () => {
        const url = removeButton.getAttribute('data-url');
        if (url) {
          browser.bookmarks = removeBookmark(browser.bookmarks, url);
          
          // Update UI
          updateBookmarkButtonState(browser, browser.currentUrl);
          updateBookmarksPanel(browser);
          
          // Save to storage
          try {
            localStorage.setItem('voyager_bookmarks', JSON.stringify(browser.bookmarks));
          } catch (err) {
            console.warn('Error saving bookmarks to storage:', err);
          }
        }
      });
    }
    
    bookmarksList.appendChild(bookmarkItem);
  });
  
  bookmarksPanel.appendChild(bookmarksList);
}

export default {
  loadBookmarks,
  saveBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  searchBookmarks,
  sortBookmarks,
  handleBookmarkCreation,
  updateBookmarkButtonState,
  updateBookmarksPanel
}; 