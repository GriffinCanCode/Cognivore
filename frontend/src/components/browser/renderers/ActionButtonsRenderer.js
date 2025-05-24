/**
 * ActionButtonsRenderer - Handles rendering and management of browser action buttons
 */

/**
 * Create action buttons container with bookmark, save, reader mode, and research buttons
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Action buttons container
 */
export function createActionButtons(browser) {
  const actionButtons = document.createElement('div');
  actionButtons.className = 'browser-action-buttons';
  
  // Create and add action buttons
  const bookmarkButton = createBookmarkButton(browser);
  const saveButton = createSaveButton(browser);
  const readerModeButton = createReaderModeButton(browser);
  const researchButton = createResearchButton(browser);
  
  actionButtons.appendChild(bookmarkButton);
  actionButtons.appendChild(saveButton);
  actionButtons.appendChild(readerModeButton);
  actionButtons.appendChild(researchButton);
  
  // Store references on browser object
  browser.bookmarkButton = bookmarkButton;
  browser.saveButton = saveButton;
  browser.readerModeButton = readerModeButton;
  browser.researchButton = researchButton;
  
  return actionButtons;
}

/**
 * Create bookmark button
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Bookmark button element
 */
function createBookmarkButton(browser) {
  const bookmarkButton = document.createElement('button');
  bookmarkButton.className = 'browser-bookmark-btn';
  bookmarkButton.title = 'Bookmark this page';
  bookmarkButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  
  // Add enhanced bookmark functionality
  bookmarkButton.addEventListener('click', () => {
    // Check if page is already bookmarked
    const isBookmarked = bookmarkButton.classList.contains('active');
    
    // Toggle bookmark state with visual feedback
    if (isBookmarked) {
      bookmarkButton.classList.remove('active');
      bookmarkButton.title = 'Bookmark this page';
      // Show toast notification
      showToastNotification('Bookmark removed');
    } else {
      bookmarkButton.classList.add('active');
      bookmarkButton.title = 'Remove bookmark';
      // Show animation for bookmarking
      addBookmarkAnimation(bookmarkButton);
      // Show toast notification
      showToastNotification('Page bookmarked');
    }
    
    // Call original handler
    if (typeof browser.addBookmark === 'function') {
      browser.addBookmark();
    }
  });
  
  return bookmarkButton;
}

/**
 * Create save button
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Save button element
 */
function createSaveButton(browser) {
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
  
  // Add enhanced save functionality with loading state
  saveButton.addEventListener('click', () => {
    // Show loading state
    saveButton.classList.add('loading');
    
    // Call original handler and handle response
    if (typeof browser.savePage === 'function') {
      const savePromise = browser.savePage();
      
      // If it returns a promise, wait for completion
      if (savePromise && typeof savePromise.then === 'function') {
        savePromise.then(() => {
          // Success state
          saveButton.classList.remove('loading');
          showToastNotification('Page saved to knowledge base!');
        }).catch((error) => {
          // Error state
          saveButton.classList.remove('loading');
          showToastNotification('Failed to save page: ' + (error.message || 'Unknown error'), 'error');
        });
      } else {
        // If no promise, remove loading state after a delay
        setTimeout(() => {
          saveButton.classList.remove('loading');
          showToastNotification('Page saved to knowledge base!');
        }, 800);
      }
    }
  });
  
  return saveButton;
}

/**
 * Create reader mode button
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Reader mode button element
 */
function createReaderModeButton(browser) {
  const readerModeButton = document.createElement('button');
  readerModeButton.className = 'browser-action-btn browser-reader-btn';
  readerModeButton.title = 'Toggle reader mode';
  readerModeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1"></path>
      <path d="M12 17v-6"></path>
      <path d="M8 13h8"></path>
    </svg>
  `;
  
  // Add enhanced reader mode toggle functionality
  readerModeButton.addEventListener('click', (event) => {
    // Prevent default to avoid any unexpected behaviors
    event.preventDefault();
    event.stopPropagation();
    
    try {
      // Call the toggleReaderMode handler with debounce
      if (typeof browser.toggleReaderMode === 'function') {
        // Disable button temporarily to prevent multiple clicks
        readerModeButton.disabled = true;
        setTimeout(() => {
          readerModeButton.disabled = false;
        }, 500);
        
        const newMode = browser.toggleReaderMode();
        
        // Show appropriate toast notification
        if (newMode === 'reader') {
          showToastNotification('Reader mode enabled');
        } else if (newMode === 'split') {
          showToastNotification('Split view enabled');
        } else {
          showToastNotification('Normal view restored');
        }
      } else {
        console.error('toggleReaderMode method not available on browser instance');
        throw new Error('Reader mode toggle not available');
      }
    } catch (err) {
      console.error('Error toggling reader mode:', err);
      
      // Show error notification
      try {
        showToastNotification('Failed to toggle reader mode: ' + (err.message || 'Unknown error'), 'error');
      } catch (notifyErr) {
        console.warn('Could not show error notification:', notifyErr);
      }
    }
  });
  
  return readerModeButton;
}

/**
 * Create research button
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Research button element
 */
function createResearchButton(browser) {
  const researchButton = document.createElement('button');
  researchButton.className = 'browser-research-btn';
  researchButton.title = 'Toggle research mode';
  researchButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
  `;
  
  // Ultra-enhanced research mode toggle with maximum resilience
  researchButton.addEventListener('click', (event) => {
    // Prevent default to avoid any unexpected behaviors
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Research button clicked');
    
    try {
      // Call the toggleResearchMode handler to delegate to the Researcher component
      if (typeof browser.toggleResearchMode === 'function') {
        console.log('Calling toggleResearchMode');
        const result = browser.toggleResearchMode();
        console.log('toggleResearchMode result:', result);
      } else {
        console.error('toggleResearchMode method not available on browser instance');
        throw new Error('Research mode toggle not available');
      }
    } catch (err) {
      console.error('Error toggling research mode:', err);
      
      // Show error notification
      try {
        showToastNotification('Failed to toggle research mode: ' + (err.message || 'Unknown error'), 'error');
      } catch (notifyErr) {
        console.warn('Could not show error notification:', notifyErr);
      }
    }
  });
  
  return researchButton;
}

/**
 * Update action button states based on browser context
 * @param {Object} browser - Browser instance
 */
export function updateActionButtonStates(browser) {
  // Initialize research panel state if available in browser
  if (browser.researchButton && browser.isResearchModeActive && browser.isResearchModeActive()) {
    browser.researchButton.classList.add('active');
    browser.researchButton.title = 'Research mode active';
  }
}

/**
 * Helper to add bookmark animation
 * @param {HTMLElement} button - Bookmark button
 */
function addBookmarkAnimation(button) {
  // Add a small pop animation
  button.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(1.3)' },
    { transform: 'scale(1)' }
  ], {
    duration: 400,
    easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
  });
  
  // Change SVG fill to show it's active
  const svg = button.querySelector('svg');
  if (svg) {
    svg.setAttribute('fill', 'currentColor');
  }
}

/**
 * Helper to show toast notifications
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (default, error, etc.)
 */
function showToastNotification(message, type = 'default') {
  // Check if toast container exists
  let toastContainer = document.querySelector('.browser-toast-container');
  
  // Create if doesn't exist
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'browser-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }
  
  // Create toast
  const toast = document.createElement('div');
  toast.className = `browser-toast ${type}`;
  toast.textContent = message;
  
  // Style toast based on type
  const bgColor = type === 'error' ? 'rgba(220, 38, 38, 0.9)' : 'rgba(37, 99, 235, 0.9)';
  
  toast.style.cssText = `
    padding: 10px 16px;
    background-color: ${bgColor};
    color: white;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateX(100%);
    transition: transform 0.3s ease-out;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
  });
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (toast.parentNode === toastContainer) {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode === toastContainer) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }
  }, 3000);
} 