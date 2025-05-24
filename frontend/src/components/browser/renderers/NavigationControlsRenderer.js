/**
 * NavigationControlsRenderer - Handles rendering and management of navigation controls
 */

/**
 * Create navigation controls container with back, forward, refresh, and stop buttons
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Navigation controls container
 */
export function createNavigationControls(browser) {
  const navControls = document.createElement('div');
  navControls.className = 'browser-nav-controls';
  
  // Create and add navigation buttons
  const backButton = createBackButton(browser);
  const forwardButton = createForwardButton(browser);
  const refreshButton = createRefreshButton(browser);
  const stopButton = createStopButton(browser);
  
  navControls.appendChild(backButton);
  navControls.appendChild(forwardButton);
  navControls.appendChild(refreshButton);
  navControls.appendChild(stopButton);
  
  // Store references on browser object
  browser.backButton = backButton;
  browser.forwardButton = forwardButton;
  browser.refreshButton = refreshButton;
  browser.stopButton = stopButton;
  
  // Initialize button states
  updateNavigationButtonStates(browser, false, false);
  
  return navControls;
}

/**
 * Create back button
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Back button element
 */
function createBackButton(browser) {
  const backButton = document.createElement('button');
  backButton.className = 'browser-back-btn';
  backButton.title = 'Back';
  backButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  `;
  backButton.disabled = true;
  
  // Add enhanced click handling with visual feedback
  backButton.addEventListener('click', (e) => {
    if (!backButton.disabled) {
      // Add visual feedback
      addButtonClickEffect(backButton);
      // Call original handler
      if (typeof browser.handleBack === 'function') {
        browser.handleBack(e);
      } else if (typeof browser.handleBackAction === 'function') {
        browser.handleBackAction(browser);
      }
    }
  });
  
  return backButton;
}

/**
 * Create forward button
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Forward button element
 */
function createForwardButton(browser) {
  const forwardButton = document.createElement('button');
  forwardButton.className = 'browser-forward-btn';
  forwardButton.title = 'Forward';
  forwardButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `;
  forwardButton.disabled = true;
  
  // Add enhanced click handling with visual feedback
  forwardButton.addEventListener('click', (e) => {
    if (!forwardButton.disabled) {
      // Add visual feedback
      addButtonClickEffect(forwardButton);
      // Call original handler
      if (typeof browser.handleForward === 'function') {
        browser.handleForward(e);
      } else if (typeof browser.handleForwardAction === 'function') {
        browser.handleForwardAction(browser);
      }
    }
  });
  
  return forwardButton;
}

/**
 * Create refresh button
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Refresh button element
 */
function createRefreshButton(browser) {
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
  
  // Add enhanced click handling with visual feedback
  refreshButton.addEventListener('click', (e) => {
    // Add visual feedback - show rotation animation
    refreshButton.classList.add('rotating');
    setTimeout(() => {
      refreshButton.classList.remove('rotating');
    }, 1000);
    
    // Call original handler
    if (typeof browser.handleRefresh === 'function') {
      browser.handleRefresh(e);
    } else if (typeof browser.refreshPage === 'function') {
      browser.refreshPage();
    }
  });
  
  return refreshButton;
}

/**
 * Create stop button
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Stop button element
 */
function createStopButton(browser) {
  const stopButton = document.createElement('button');
  stopButton.className = 'browser-stop-btn';
  stopButton.title = 'Stop';
  stopButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="6" width="12" height="12"></rect>
    </svg>
  `;
  stopButton.style.display = 'none';
  
  // Add enhanced click handling with visual feedback
  stopButton.addEventListener('click', (e) => {
    // Add visual feedback
    addButtonClickEffect(stopButton);
    // Call original handler
    if (typeof browser.handleStop === 'function') {
      browser.handleStop(e);
    } else if (typeof browser.stopLoading === 'function') {
      browser.stopLoading();
    }
  });
  
  return stopButton;
}

/**
 * Update navigation button states based on browser history
 * @param {Object} browser - Browser instance
 * @param {boolean} canGoBack - Whether back navigation is available
 * @param {boolean} canGoForward - Whether forward navigation is available
 */
export function updateNavigationButtonStates(browser, canGoBack, canGoForward) {
  if (browser.backButton) {
    browser.backButton.disabled = !canGoBack;
  }
  if (browser.forwardButton) {
    browser.forwardButton.disabled = !canGoForward;
  }
}

/**
 * Show/hide stop button based on loading state
 * @param {Object} browser - Browser instance
 * @param {boolean} isLoading - Whether page is currently loading
 */
export function updateLoadingControls(browser, isLoading) {
  if (browser.refreshButton && browser.stopButton) {
    if (isLoading) {
      browser.refreshButton.style.display = 'none';
      browser.stopButton.style.display = 'block';
    } else {
      browser.refreshButton.style.display = 'block';
      browser.stopButton.style.display = 'none';
    }
  }
}

/**
 * Helper function to add button click effect
 * @param {HTMLElement} button - The button to apply effect to
 */
function addButtonClickEffect(button) {
  // Add ripple effect
  const ripple = document.createElement('span');
  ripple.className = 'button-ripple';
  ripple.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  `;
  
  button.appendChild(ripple);
  
  // Animate ripple
  requestAnimationFrame(() => {
    ripple.style.width = '120%';
    ripple.style.height = '120%';
    ripple.style.opacity = '0';
    ripple.style.transition = 'all 0.6s ease-out';
  });
  
  // Remove ripple after animation
  setTimeout(() => {
    if (ripple.parentNode === button) {
      button.removeChild(ripple);
    }
  }, 600);
} 