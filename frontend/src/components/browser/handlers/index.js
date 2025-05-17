/**
 * Handlers index file - centralizes all browser handlers for easy importing
 */

// Import all handler files
import AddressBarManager from './AddressBarManager.js';
import NavigationService from './NavigationService.js';
import EventHandlers from './EventHandlers.js';
import ContentExtractor from './ContentExtractor.js';

// Re-export for easy import in other files
export {
  AddressBarManager,
  NavigationService,
  EventHandlers,
  ContentExtractor
};

/**
 * Initialize all handlers for a browser instance
 * @param {Object} browser - Browser instance to initialize
 */
export function initBrowserHandlers(browser) {
  if (!browser) {
    console.error('Cannot initialize browser handlers - browser instance is null');
    return;
  }
  
  // Initialize address bar handling
  AddressBarManager.initAddressBar(browser);
  
  // Set up checkIfPageIsLoaded reference for NavigationService
  // (NavigationService expects this method to be available on the browser)
  if (typeof browser.checkIfPageIsLoaded !== 'function') {
    browser.checkIfPageIsLoaded = function(callback) {
      NavigationService.checkIfPageIsLoaded(browser, callback);
    };
  }
  
  // Set browser navigate method if not already available
  if (typeof browser.navigate !== 'function') {
    browser.navigate = function(url, forceNavigate = false) {
      NavigationService.navigate(browser, url, forceNavigate);
    };
  }
  
  // Set up refresh and stop loading methods
  if (typeof browser.refreshPage !== 'function') {
    browser.refreshPage = function() {
      NavigationService.refreshPage(browser);
    };
  }
  
  if (typeof browser.stopLoading !== 'function') {
    browser.stopLoading = function() {
      NavigationService.stopLoading(browser);
    };
  }
  
  console.log('Browser handlers initialized successfully');
}

export default {
  initBrowserHandlers,
  AddressBarManager,
  NavigationService,
  EventHandlers,
  ContentExtractor
}; 