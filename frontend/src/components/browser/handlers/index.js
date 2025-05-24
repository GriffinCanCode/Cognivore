/**
 * Browser Handler Index
 * Exports all browser handlers for easier importing
 */

import AddressBarManager from './AddressBarManager';
import ExtractorManager from '../extraction/ExtractorManager';
import ErrorHandler, { ErrorCategories, recordError, getErrorStats, getErrorHistory, exportErrorHistory, clearErrorHistory } from './ErrorHandler';
import EventHandlers, { updateNavigationButtons } from './EventHandlers';
import HistoryService from './HistoryService';
import NavigationService from './NavigationService';
import ReaderModeManager from './ReaderModeManager';
import ResearchManager from './ResearchManager';
import ResearcherEventHandlers from './ResearcherEventHandlers';
import StyleManager from './StyleManager';
import VoyagerLifecycle from './VoyagerLifecycle';
import WebviewInitializer from './WebviewInitializer';

// Export all handlers
export {
  AddressBarManager,
  ExtractorManager,
  ErrorHandler,
  EventHandlers,
  HistoryService,
  NavigationService,
  ReaderModeManager,
  ResearchManager,
  ResearcherEventHandlers,
  StyleManager,
  VoyagerLifecycle,
  WebviewInitializer,
  
  // Export specific utilities from EventHandlers
  updateNavigationButtons,
  
  // Export specific utilities from ErrorHandler
  ErrorCategories,
  recordError,
  getErrorStats,
  getErrorHistory,
  exportErrorHistory,
  clearErrorHistory
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

// Default export for easier importing
export default {
  AddressBarManager,
  ExtractorManager,
  ErrorHandler,
  EventHandlers,
  HistoryService,
  NavigationService,
  ReaderModeManager,
  ResearchManager,
  ResearcherEventHandlers,
  StyleManager,
  VoyagerLifecycle,
  WebviewInitializer
}; 