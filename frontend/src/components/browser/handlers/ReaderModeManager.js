/**
 * ReaderModeManager.js - Handles reader mode functionality
 * 
 * This module provides methods for toggling and managing reader mode
 * in the Voyager browser component.
 */

import { capturePageContent } from './ContentExtractor';

/**
 * Toggle reader mode between browser, reader, and split views
 * 
 * @param {Object} browser - Browser instance
 * @returns {string} The new view mode
 */
export function toggleReaderMode(browser) {
  const currentMode = browser.state.viewMode;
  let newMode;
  
  if (currentMode === 'browser') {
    newMode = 'reader';
  } else if (currentMode === 'reader') {
    newMode = 'split';
  } else {
    newMode = 'browser';
  }
  
  browser.setState({ viewMode: newMode });
  
  // If entering reader mode and we don't have content yet, try to fetch it
  if ((newMode === 'reader' || newMode === 'split') && !browser.state.readerContent) {
    capturePageContent(browser).catch(err => {
      console.warn('Error capturing content for reader mode:', err);
    });
  }
  
  return newMode;
}

/**
 * Set reader mode directly to a specific mode
 * 
 * @param {Object} browser - Browser instance
 * @param {string} mode - Mode to set ('browser', 'reader', or 'split')
 * @returns {boolean} Success flag
 */
export function setReaderMode(browser, mode) {
  if (!['browser', 'reader', 'split'].includes(mode)) {
    console.error(`Invalid reader mode: ${mode}`);
    return false;
  }
  
  browser.setState({ viewMode: mode });
  
  // If entering reader mode and we don't have content yet, try to fetch it
  if ((mode === 'reader' || mode === 'split') && !browser.state.readerContent) {
    capturePageContent(browser).catch(err => {
      console.warn('Error capturing content for reader mode:', err);
    });
  }
  
  return true;
}

/**
 * Get the current reader mode
 * 
 * @param {Object} browser - Browser instance
 * @returns {string} Current view mode
 */
export function getReaderMode(browser) {
  return browser.state?.viewMode || 'browser';
}

/**
 * Check if reader mode is active (either reader or split mode)
 * 
 * @param {Object} browser - Browser instance
 * @returns {boolean} True if reader mode is active
 */
export function isReaderModeActive(browser) {
  const mode = getReaderMode(browser);
  return mode === 'reader' || mode === 'split';
}

export default {
  toggleReaderMode,
  setReaderMode,
  getReaderMode,
  isReaderModeActive
}; 