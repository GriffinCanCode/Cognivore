/**
 * ErrorHandler.js - Handles error conditions in the browser
 * 
 * This module provides a comprehensive system for handling different error scenarios
 * that can occur during browser navigation and page loading.
 * It is the central hub for all error-related functionality in the browser.
 */

import { renderErrorPage as renderErrorPageOriginal, showNavigationErrorPage as showNavigationErrorPageOriginal } from '../renderers/ErrorPageRenderer';
import { updateLoadingIndicator } from '../renderers/BrowserRenderer';

/**
 * Render an error page in the browser
 * This is a wrapper around the original renderErrorPage to ensure all error rendering goes through ErrorHandler
 * 
 * @param {Object} browser - Browser instance
 * @param {Object} options - Error options including code, description, url, etc.
 */
export function renderErrorPage(browser, options) {
  // If the options is just an error type and data, handle that format
  if (typeof options === 'string') {
    const errorType = options;
    const data = arguments[2] || {};
    return renderErrorPageOriginal(browser, errorType, data);
  }
  
  // Extract error details from options
  const {
    code = 'unknown',
    description = 'An unknown error occurred',
    url = browser?.state?.url || '',
    type = getErrorType(code),
    onRetry,
    onBack,
    certificate
  } = options;
  
  // Create error data object
  const errorData = {
    url,
    error: description,
    code,
    onRetry,
    onBack,
    certificate
  };
  
  // Call the original renderErrorPage function
  return renderErrorPageOriginal(browser, type, errorData);
}

/**
 * Show navigation error page in the browser
 * This is a wrapper around the original showNavigationErrorPage to ensure all error rendering goes through ErrorHandler
 * 
 * @param {Object} browser - Browser instance
 * @param {string} url - The URL that failed to load
 * @param {string} errorMessage - The error message to display
 */
export function showNavigationErrorPage(browser, url, errorMessage) {
  return showNavigationErrorPageOriginal(browser, url, errorMessage);
}

/**
 * Handle a page load failure
 * 
 * @param {Object} browser - Browser instance
 * @param {Event} event - The error event
 * @param {number} errorCode - Error code from webview
 * @param {string} errorDescription - Human-readable error description
 * @param {string} validatedURL - The URL that failed to load
 */
export function handlePageLoadError(browser, event, errorCode, errorDescription, validatedURL) {
  // Normalize parameters in case they come in different formats
  if (typeof errorCode === 'undefined' && event) {
    errorCode = event.errorCode;
    errorDescription = event.errorDescription;
    validatedURL = event.validatedURL;
  }
  
  console.error(`Page load failed: ${errorCode} ${errorDescription} (${validatedURL})`);
  
  // For errors in non-main frames (like iframes), we don't need to show the error page
  if (event && event.isMainFrame === false) {
    console.log('Error in subframe, not showing error page');
    return;
  }
  
  // Special handling for specific error codes
  if (errorCode === -3) {
    // -3 is ERR_ABORTED, which often happens during navigation and isn't serious
    console.log('Navigation was aborted, likely due to redirect or user navigation');
    return;
  }
  
  if (errorCode === -2 || errorCode === -102 || errorCode === -118) {
    // Connection aborted or navigation canceled - user might have clicked on a link
    console.log('Connection interrupted, possibly by user or redirect');
    return;
  }
  
  // Stop the loading indicator
  updateLoadingIndicator(browser, false);
  
  // Parse and handle different error types
  const errorType = getErrorType(errorCode);
  
  // Set error state
  if (browser.setState) {
    browser.setState({
      isLoading: false,
      error: {
        code: errorCode,
        description: errorDescription,
        url: validatedURL,
        type: errorType
      }
    });
  }
  
  // Render appropriate error page
  renderErrorPage(browser, {
    errorCode,
    errorDescription,
    validatedURL,
    errorType,
    onRetry: () => {
      // Clear error and try again
      if (browser.setState) {
        browser.setState({ error: null });
      }
      
      // Retry navigation to the same URL
      if (validatedURL) {
        if (typeof browser.navigate === 'function') {
          browser.navigate(validatedURL, true);
        } else if (browser.webview) {
          try {
            browser.webview.src = validatedURL;
          } catch (err) {
            console.error('Error retrying navigation:', err);
          }
        }
      }
    }
  });
}

/**
 * Parse an error code and determine the error type
 * 
 * @param {number} errorCode - The error code from webview
 * @returns {string} The error type category
 */
export function getErrorType(errorCode) {
  // Common error codes and their types
  if (errorCode === -2) return 'aborted'; // Navigation aborted
  if (errorCode === -3) return 'timeout'; // Timed out
  if (errorCode === -105 || errorCode === -106) return 'dns'; // DNS error
  if (errorCode === -7) return 'certificate'; // Certificate error
  if (errorCode === -20) return 'offline'; // No internet connection
  if (errorCode >= -299 && errorCode <= -200) return 'http'; // HTTP error
  if (errorCode === -501) return 'insecure'; // Insecure connection
  
  // Map numeric HTML error codes to error types
  if (errorCode === 404) return 'notfound';
  if (errorCode >= 400 && errorCode < 500) return 'http';
  if (errorCode >= 500 && errorCode < 600) return 'server';
  
  // For non-numeric or string error codes
  if (typeof errorCode === 'string') {
    const code = errorCode.toLowerCase();
    if (code.includes('timeout')) return 'timeout';
    if (code.includes('dns')) return 'dns';
    if (code.includes('ssl') || code.includes('cert')) return 'certificate';
    if (code.includes('offline')) return 'offline';
    if (code.includes('not found') || code.includes('404')) return 'notfound';
  }
  
  // Default to generic error
  return 'general';
}

/**
 * Handle certificate errors
 * 
 * @param {Object} browser - Browser instance
 * @param {Event} event - The certificate error event
 * @param {string} url - The URL with certificate issues
 * @param {Object} error - Certificate error details
 * @param {Object} certificate - Certificate information
 */
export function handleCertificateError(browser, event, url, error, certificate) {
  // Normalize parameters in case they come in different formats
  if (typeof url === 'undefined' && event) {
    url = event.url;
    error = event.error;
    certificate = event.certificate;
  }
  
  console.warn(`Certificate error: ${error} for ${url}`);
  
  // Create detailed error description
  const errorDescription = `Certificate error: ${error}`;
  
  // Set error state
  if (browser.setState) {
    browser.setState({
      isLoading: false,
      error: {
        code: -7, // Certificate error code
        description: errorDescription,
        url: url,
        type: 'certificate',
        certificate: certificate
      }
    });
  }
  
  // Render certificate error page
  renderErrorPage(browser, {
    errorCode: -7,
    errorDescription,
    validatedURL: url,
    errorType: 'certificate',
    certificate,
    onRetry: () => {
      // Clear error
      if (browser.setState) {
        browser.setState({ error: null });
      }
      
      // Attempt to continue anyway (not recommended for security reasons)
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      
      // Navigate again
      if (url) {
        if (typeof browser.navigate === 'function') {
          browser.navigate(url, true);
        } else if (browser.webview) {
          try {
            browser.webview.src = url;
          } catch (err) {
            console.error('Error retrying navigation after certificate error:', err);
          }
        }
      }
    },
    onBack: () => {
      if (typeof browser.goBack === 'function') {
        browser.goBack();
      }
    }
  });
}

/**
 * Handle general webview/iframe error events
 * Consolidates error handling from EventHandlers.js
 * 
 * @param {Object} browser - Browser instance 
 * @param {Event} e - Error event
 */
export function handleWebviewError(browser, e) {
  console.error('Webview error:', e);
  
  // If it's a very generic error without details, might not be serious
  if (!e.errorDescription && !e.validatedURL) {
    console.log('Generic error without details, might not be critical');
    // Still allow the page to continue loading
    return;
  }
  
  // Hide loading content if method exists
  if (typeof browser.hideLoadingContent === 'function') {
    browser.hideLoadingContent();
  }
  
  // Handle specific errors
  if (e.errorCode === -3) {
    // -3 is ERR_ABORTED, which often happens during navigation and isn't serious
    console.log('Navigation was aborted, likely due to redirect or user navigation');
    return;
  }
  
  if (e.errorCode === -2 || e.errorCode === -102 || e.errorCode === -118) {
    // Connection aborted or navigation canceled - user might have clicked on a link
    console.log('Connection interrupted, possibly by user or redirect');
    return;
  }
  
  // For errors in non-main frames (like iframes), we don't need to show the error page
  if (e.isMainFrame === false) {
    console.log('Error in subframe, not showing error page');
    return;
  }
  
  // Mark as not loading
  browser.isLoading = false;
  if (typeof browser.updateLoadingState === 'function') {
    browser.updateLoadingState();
  }
  
  // Show error page
  const url = e.validatedURL || browser.currentUrl;
  const errorMessage = e.errorDescription || 'Unknown error loading page';
  
  // Use the common showNavigationErrorPage method for consistent error handling
  showNavigationErrorPage(browser, url, errorMessage);
}

/**
 * Reset error state and clear error display
 * 
 * @param {Object} browser - Browser instance
 */
export function clearError(browser) {
  if (browser.setState) {
    browser.setState({ error: null });
  }
  
  // If we have a webview, make sure error page is removed
  if (browser.webview && browser.webview.getURL) {
    try {
      const currentUrl = browser.webview.getURL();
      if (currentUrl && currentUrl.startsWith('data:text/html')) {
        // If we're on an error page and want to clear, go back to the previous page
        if (typeof browser.goBack === 'function') {
          browser.goBack();
        }
      }
    } catch (err) {
      console.warn('Error clearing error page:', err);
    }
  }
}

/**
 * Render an error in a content frame
 * @param {Object} browser - Browser instance
 * @param {string} errorType - Type of error
 * @param {Object} data - Error data
 */
export function renderErrorInFrame(browser, errorType, data) {
  if (!browser.contentFrame) return;
  
  try {
    // Access the iframe document
    const doc = browser.contentFrame.contentDocument;
    if (doc) {
      renderErrorPageOriginal(doc, errorType, data);
    }
  } catch (error) {
    console.error('Failed to render error page in frame:', error);
  }
}

// Export all functions to make this the central error handling module
export default {
  handlePageLoadError,
  handleCertificateError,
  handleWebviewError,
  getErrorType,
  clearError,
  renderErrorPage,
  showNavigationErrorPage,
  renderErrorInFrame
}; 