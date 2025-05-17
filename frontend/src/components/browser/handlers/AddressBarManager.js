/**
 * AddressBarManager.js - Handles address bar functionality
 * 
 * This module provides methods for handling address bar input, validation,
 * and interactions with the browser navigation system.
 */

import { formatUrl } from '../utils/BrowserEnv.js';
import { navigate } from './NavigationService.js';

/**
 * Handle address bar submission (user pressing Enter)
 * 
 * @param {Event} event - Submit event from the form
 */
export function handleAddressSubmit(event) {
  // Prevent default form submission
  if (event) event.preventDefault();
  
  // Get browser instance from this context
  const browser = this;
  
  // Get address from input or state
  let address = '';
  
  // Support both direct DOM elements and React refs
  if (browser.addressInput) {
    if (browser.addressInput.current) {
      // React ref
      address = browser.addressInput.current.value.trim();
    } else if (browser.addressInput.value !== undefined) {
      // Direct DOM element
      address = browser.addressInput.value.trim();
    }
  } else if (browser.state && browser.state.displayUrl) {
    address = browser.state.displayUrl.trim();
  }
  
  // Skip if empty
  if (!address) return;
  
  // Handle special URL schemes
  if (address.startsWith('bookmark:')) {
    // Handle bookmark: scheme
    handleBookmarkScheme(browser, address);
    return;
  } else if (address.startsWith('history:')) {
    // Handle history: scheme
    handleHistoryScheme(browser, address);
    return;
  } else if (address.startsWith('settings:')) {
    // Handle settings: scheme
    handleSettingsScheme(browser, address);
    return;
  } else if (address.startsWith('debug:')) {
    // Handle debug: scheme
    handleDebugScheme(browser, address);
    return;
  }
  
  // Navigate to the address
  navigateToAddress(browser, address);
}

/**
 * Navigate to the specified address
 * 
 * @param {Object} browser - Browser instance
 * @param {string} address - Address to navigate to
 */
function navigateToAddress(browser, address) {
  // Use the NavigationService to handle navigation
  // This ensures consistent behavior with all other navigation methods
  navigate(browser, address);
}

/**
 * Handle address bar text change
 * 
 * @param {Event} event - Change event from the input
 */
export function handleAddressChange(event) {
  // Get browser instance from this context
  const browser = this;
  
  // Get address from event
  const address = event?.target?.value || '';
  
  // Update display URL in state if needed
  if (typeof browser.setState === 'function') {
    browser.setState({ 
      displayUrl: address,
      isAddressSearch: isLikelySearchQuery(address)
    });
  }
}

/**
 * Determine if the input is likely a search query vs a URL
 * 
 * @param {string} input - User input to analyze
 * @returns {boolean} True if the input is likely a search query
 */
function isLikelySearchQuery(input) {
  if (!input) return false;
  
  const trimmed = input.trim();
  
  // Check for URL patterns
  const hasProtocol = /^[a-z]+:\/\//.test(trimmed);
  const hasDomain = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}(\/.*)?$/i.test(trimmed);
  const hasLocalhost = /^localhost(:[0-9]+)?(\/.*)?$/.test(trimmed);
  const hasIPAddress = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(:[0-9]+)?(\/.*)?$/.test(trimmed);
  
  // Check for search patterns
  const hasSpaces = trimmed.includes(' ');
  const hasQuestionMark = trimmed.includes('?') && !trimmed.includes('/?');
  const isShortQuery = trimmed.length < 8 && !hasDomain;
  
  // If it has any URL-like patterns, it's probably not a search
  if (hasProtocol || hasDomain || hasLocalhost || hasIPAddress) {
    return false;
  }
  
  // If it has common search patterns, it's probably a search
  return hasSpaces || hasQuestionMark || isShortQuery;
}

/**
 * Process a bookmark scheme URL
 * 
 * @param {Object} browser - Browser instance
 * @param {string} url - Bookmark URL to process
 */
function handleBookmarkScheme(browser, address) {
  // Extract command and parameters
  const parts = address.substring('bookmark:'.length).split('/');
  const command = parts[0]?.toLowerCase() || 'list';
  
  if (command === 'list') {
    // Show bookmark list
    if (browser.bookmarkManager && typeof browser.bookmarkManager.showBookmarksList === 'function') {
      browser.bookmarkManager.showBookmarksList();
    }
  } else if (command === 'add') {
    // Add current page to bookmarks
    if (browser.bookmarkManager && typeof browser.bookmarkManager.addCurrentPageToBookmarks === 'function') {
      browser.bookmarkManager.addCurrentPageToBookmarks();
    } else if (typeof browser.addBookmark === 'function') {
      browser.addBookmark();
    }
  } else if (command === 'open' && parts[1]) {
    // Open a specific bookmark
    if (browser.bookmarkManager && typeof browser.bookmarkManager.openBookmarkById === 'function') {
      browser.bookmarkManager.openBookmarkById(parts[1]);
    }
  }
  
  // Restore the address bar to current URL
  updateAddressBarValue(browser);
}

/**
 * Process a history scheme URL
 * 
 * @param {Object} browser - Browser instance
 * @param {string} address - History URL to process
 */
function handleHistoryScheme(browser, address) {
  // Extract command and parameters
  const parts = address.substring('history:'.length).split('/');
  const command = parts[0]?.toLowerCase() || 'list';
  
  if (command === 'list') {
    // Show history list
    if (browser.historyManager && typeof browser.historyManager.showHistoryList === 'function') {
      browser.historyManager.showHistoryList();
    }
  } else if (command === 'clear') {
    // Clear history
    if (browser.historyManager && typeof browser.historyManager.clearHistory === 'function') {
      browser.historyManager.clearHistory();
    }
  } else if (command === 'open' && parts[1]) {
    // Open a specific history entry
    if (browser.historyManager && typeof browser.historyManager.openHistoryEntryById === 'function') {
      browser.historyManager.openHistoryEntryById(parts[1]);
    }
  }
  
  // Restore the address bar to current URL
  updateAddressBarValue(browser);
}

/**
 * Process a settings scheme URL
 * 
 * @param {Object} browser - Browser instance
 * @param {string} address - Settings URL to process
 */
function handleSettingsScheme(browser, address) {
  // Extract command and parameters
  const parts = address.substring('settings:'.length).split('/');
  const command = parts[0]?.toLowerCase() || 'general';
  
  // Set a flag to show settings panel
  if (typeof browser.setState === 'function') {
    browser.setState({ 
      showSettings: true,
      settingsPanel: command 
    });
  }
  
  // Restore the address bar to current URL
  updateAddressBarValue(browser);
}

/**
 * Process a debug scheme URL
 * 
 * @param {Object} browser - Browser instance
 * @param {string} address - Debug URL to process
 */
function handleDebugScheme(browser, address) {
  // Extract command and parameters
  const parts = address.substring('debug:'.length).split('/');
  const command = parts[0]?.toLowerCase() || 'console';
  
  if (command === 'console') {
    // Open dev tools if webview is available
    if (browser.webview && typeof browser.webview.openDevTools === 'function') {
      browser.webview.openDevTools();
    }
  } else if (command === 'log') {
    // Show browser logs
    console.log('Browser state:', browser.state);
    console.log('URL:', browser.state.url);
    console.log('History:', browser.state.history);
  } else if (command === 'reload') {
    // Force a full reload without cache
    if (browser.webview && typeof browser.webview.reloadIgnoringCache === 'function') {
      browser.webview.reloadIgnoringCache();
    } else if (browser.webview && typeof browser.webview.reload === 'function') {
      browser.webview.reload();
    }
  }
  
  // Restore the address bar to current URL
  updateAddressBarValue(browser);
}

/**
 * Set focus to the address bar and select all text
 * 
 * @param {Object} browser - Browser instance
 */
export function focusAddressBar() {
  // Get browser instance from this context
  const browser = this;
  
  let inputElement = null;
  
  // Handle both React refs and direct DOM elements
  if (browser.addressInput) {
    if (browser.addressInput.current) {
      // React ref
      inputElement = browser.addressInput.current;
    } else if (browser.addressInput.focus) {
      // Direct DOM element
      inputElement = browser.addressInput;
    }
  }
  
  // Focus and select if we found the element
  if (inputElement) {
    inputElement.focus();
    inputElement.select();
  }
}

/**
 * Update the address bar value to the current URL
 * 
 * @param {Object} browser - Browser instance
 */
function updateAddressBarValue(browser) {
  // Get current URL from state
  const currentUrl = browser.state?.url || browser.state?.currentUrl || '';
  
  // Update address input
  if (browser.addressInput) {
    if (browser.addressInput.current) {
      // React ref
      browser.addressInput.current.value = currentUrl;
    } else if (browser.addressInput.value !== undefined) {
      // Direct DOM element
      browser.addressInput.value = currentUrl;
    }
  }
}

/**
 * Update the address bar with the current URL
 * 
 * @param {string} url - The URL to display
 */
export function updateAddressBar(url) {
  // Get browser instance from this context
  const browser = this;
  
  // Skip if no URL
  if (!url) return;
  
  // Handle both React refs and direct DOM elements
  if (browser.addressInput) {
    if (browser.addressInput.current) {
      // React ref
      browser.addressInput.current.value = url;
    } else if (browser.addressInput.value !== undefined) {
      // Direct DOM element
      browser.addressInput.value = url;
    }
  }
  
  // Update state if setState exists
  if (typeof browser.setState === 'function') {
    browser.setState({
      url: url,
      currentUrl: url,
      displayUrl: url
    });
  }
}

/**
 * Initialize address bar functionality for a browser instance
 * 
 * @param {Object} browser - Browser instance to initialize
 */
export function initAddressBar(browser) {
  if (!browser) return;
  
  // Bind methods to the browser instance
  browser.handleAddressSubmit = handleAddressSubmit.bind(browser);
  browser.handleAddressChange = handleAddressChange.bind(browser);
  browser.focusAddressBar = focusAddressBar.bind(browser);
  browser.updateAddressBar = updateAddressBar.bind(browser);
  
  // Find address input if not already set
  if (!browser.addressInput) {
    // Try to find it in the DOM
    const addressInput = 
      browser.containerRef?.current?.querySelector('.voyager-address-bar') ||
      browser.containerRef?.current?.querySelector('.browser-search-input');
    
    if (addressInput) {
      browser.addressInput = addressInput;
    }
  }
  
  console.log('Address bar manager initialized for browser instance');
}

export default {
  initAddressBar,
  handleAddressSubmit,
  handleAddressChange,
  focusAddressBar,
  updateAddressBar
}; 