/**
 * ErrorHandler.js - Handles error conditions in the browser
 * 
 * This module provides a comprehensive system for handling different error scenarios
 * that can occur during browser navigation and page loading.
 * It is the central hub for all error-related functionality in the browser.
 */

// Browser-compatible implementations of Node.js modules
// Simple browser-compatible logger
const electronLog = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  transports: {
    console: { level: 'error' },
    file: { 
      level: 'error',
      getFile: () => ({ path: '' })
    }
  }
};

// Simple browser-compatible storage
const storage = {
  get: (key, callback) => {
    try {
      const data = localStorage.getItem(key);
      callback(null, data ? JSON.parse(data) : {});
    } catch (error) {
      callback(error, {});
    }
  },
  set: (key, data, callback) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      callback && callback(null);
    } catch (error) {
      callback && callback(error);
    }
  }
};

// Simple browser-compatible winston
const winston = {
  format: {
    timestamp: () => ({ transform: (info) => info }),
    json: () => ({ transform: (info) => info }),
    combine: (...formats) => ({ transform: (info) => info })
  },
  transports: {
    File: function({ filename, dirname }) {
      this.filename = filename;
      this.dirname = dirname;
    }
  },
  createLogger: (options) => ({
    level: options.level,
    format: options.format,
    transports: options.transports,
    error: (message, meta) => console.error(`[${meta?.category || 'ERROR'}] ${message}`, meta)
  })
};

import { renderErrorPage as renderErrorPageOriginal, showNavigationErrorPage as showNavigationErrorPageOriginal } from '../renderers/ErrorPageRenderer';
import { updateLoadingIndicator } from '../renderers/BrowserRenderer';

// Configure specialized error logging that doesn't overlap with main logger
const errorLog = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'error.log',
      dirname: '' // Browser can't write to filesystem directly
    })
  ]
});

// Error history for tracking and aggregation
let errorHistory = [];
const MAX_ERROR_HISTORY = 100;

// Error categories for better organization
export const ErrorCategories = {
  NETWORK: 'network',
  CERTIFICATE: 'certificate',
  DNS: 'dns',
  TIMEOUT: 'timeout',
  HTTP: 'http',
  NOTFOUND: 'notfound',
  SERVER: 'server',
  OFFLINE: 'offline',
  INSECURE: 'insecure',
  ABORTED: 'aborted',
  GENERAL: 'general'
};

// Load existing error history from storage
function loadErrorHistory() {
  storage.get('errorHistory', (error, data) => {
    if (error) {
      electronLog.error('Failed to load error history', error);
      return;
    }
    
    if (data && Array.isArray(data.errors)) {
      errorHistory = data.errors;
      
      // Keep error history under the max size
      if (errorHistory.length > MAX_ERROR_HISTORY) {
        errorHistory = errorHistory.slice(-MAX_ERROR_HISTORY);
      }
      
      electronLog.info(`Loaded ${errorHistory.length} previous errors from storage`);
    }
  });
}

// Save error history to storage
function saveErrorHistory() {
  storage.set('errorHistory', { errors: errorHistory }, (error) => {
    if (error) {
      electronLog.error('Failed to save error history', error);
    }
  });
}

// Initialize error tracking
function initializeErrorTracking() {
  // Set up logging levels
  electronLog.transports.console.level = 'error';
  electronLog.transports.file.level = 'error';
  
  // Load error history from storage
  loadErrorHistory();
  
  electronLog.info('Error tracking initialized');
}

// Call initialization
initializeErrorTracking();

/**
 * Record an error with our open-source error tracking system
 * 
 * @param {Error|string} error - The error object or message
 * @param {Object} context - Additional context data
 * @param {string} category - Error category
 */
export function recordError(error, context = {}, category = ErrorCategories.GENERAL) {
  try {
    // Create error entry with timestamp, category, etc.
    const errorEntry = {
      timestamp: new Date().toISOString(),
      category,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : { message: String(error) },
      context
    };
    
    // Log error using winston for structured logging
    errorLog.error(errorEntry.error.message || 'Unknown error', {
      category,
      context,
      errorDetails: errorEntry.error
    });
    
    // Also log with electron-log for desktop app visibility
    electronLog.error(
      `[${category}] ${errorEntry.error.message || 'Unknown error'}`,
      context
    );
    
    // Add error to history for tracking and aggregation
    errorHistory.unshift(errorEntry);
    
    // Keep error history under max size
    if (errorHistory.length > MAX_ERROR_HISTORY) {
      errorHistory = errorHistory.slice(0, MAX_ERROR_HISTORY);
    }
    
    // Periodically save error history (avoid saving after every error)
    if (errorHistory.length % 5 === 0) {
      saveErrorHistory();
    }
    
    // Check for error patterns and repeated errors
    analyzeErrorPatterns(errorEntry);
    
  } catch (err) {
    // Fail silently if error recording fails
    console.error('Failed to record error:', err);
  }
}

/**
 * Analyze errors for patterns to detect larger issues
 * 
 * @param {Object} currentError - The current error being processed
 */
function analyzeErrorPatterns(currentError) {
  try {
    // Count similar errors in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const similarErrors = errorHistory.filter(entry => 
      entry.category === currentError.category && 
      entry.timestamp >= oneHourAgo &&
      (entry.error.message === currentError.error.message ||
       entry.context.url === currentError.context.url)
    );
    
    // If we have multiple similar errors, this might indicate a systemic issue
    if (similarErrors.length > 3) {
      electronLog.warn(`Potential issue detected: ${similarErrors.length} similar errors in the last hour`, {
        category: currentError.category,
        message: currentError.error.message,
        url: currentError.context.url
      });
      
      // Could trigger an alert or notification here
    }
  } catch (err) {
    console.error('Error analyzing error patterns:', err);
  }
}

/**
 * Get error statistics and trends
 * 
 * @returns {Object} Statistics about recent errors
 */
export function getErrorStats() {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Count errors by category in different time frames
    const hourlyStats = {};
    const dailyStats = {};
    
    // Populate category counts
    Object.values(ErrorCategories).forEach(category => {
      hourlyStats[category] = errorHistory.filter(e => 
        e.category === category && e.timestamp >= oneHourAgo
      ).length;
      
      dailyStats[category] = errorHistory.filter(e => 
        e.category === category && e.timestamp >= oneDayAgo
      ).length;
    });
    
    return {
      hourly: hourlyStats,
      daily: dailyStats,
      total: errorHistory.length
    };
  } catch (err) {
    console.error('Error getting error stats:', err);
    return { hourly: {}, daily: {}, total: 0 };
  }
}

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
    
    // Record error with our tracking system
    recordError(`Error type: ${errorType}`, data, errorType);
    
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
  
  // Record error with our tracking system
  recordError(description, {
    code,
    url,
    errorType: type,
    hasCertificate: !!certificate
  }, type);
  
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
  // Record navigation error
  recordError(errorMessage, { url }, ErrorCategories.NETWORK);
  
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
  
  // Record error in our tracking system with additional context
  recordError(errorDescription, {
    errorCode,
    url: validatedURL,
    errorType,
    browser: browser?.id || 'unknown'
  }, errorType);
  
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
    code: errorCode,
    description: errorDescription,
    url: validatedURL,
    type: errorType,
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
            recordError(err, { action: 'retry_navigation', url: validatedURL });
          }
        }
      }
    }
  });
}

/**
 * Parse an error code and determine the error type
 * 
 * @param {number|string} errorCode - The error code from webview
 * @returns {string} The error type category
 */
export function getErrorType(errorCode) {
  // Common error codes and their types
  if (errorCode === -2) return ErrorCategories.ABORTED; // Navigation aborted
  if (errorCode === -3) return ErrorCategories.TIMEOUT; // Timed out
  if (errorCode === -105 || errorCode === -106) return ErrorCategories.DNS; // DNS error
  if (errorCode === -7) return ErrorCategories.CERTIFICATE; // Certificate error
  if (errorCode === -20) return ErrorCategories.OFFLINE; // No internet connection
  if (errorCode >= -299 && errorCode <= -200) return ErrorCategories.HTTP; // HTTP error
  if (errorCode === -501) return ErrorCategories.INSECURE; // Insecure connection
  
  // Map numeric HTML error codes to error types
  if (errorCode === 404) return ErrorCategories.NOTFOUND;
  if (errorCode >= 400 && errorCode < 500) return ErrorCategories.HTTP;
  if (errorCode >= 500 && errorCode < 600) return ErrorCategories.SERVER;
  
  // For non-numeric or string error codes
  if (typeof errorCode === 'string') {
    const code = errorCode.toLowerCase();
    if (code.includes('timeout')) return ErrorCategories.TIMEOUT;
    if (code.includes('dns')) return ErrorCategories.DNS;
    if (code.includes('ssl') || code.includes('cert')) return ErrorCategories.CERTIFICATE;
    if (code.includes('offline')) return ErrorCategories.OFFLINE;
    if (code.includes('not found') || code.includes('404')) return ErrorCategories.NOTFOUND;
  }
  
  // Default to generic error
  return ErrorCategories.GENERAL;
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
  
  // Record certificate error in our tracking system
  recordError(`Certificate error: ${error}`, {
    url,
    certificate: certificate ? {
      issuer: certificate.issuerName,
      subject: certificate.subjectName,
      validExpiry: certificate.validExpiry
    } : null
  }, ErrorCategories.CERTIFICATE);
  
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
        type: ErrorCategories.CERTIFICATE,
        certificate: certificate
      }
    });
  }
  
  // Render certificate error page
  renderErrorPage(browser, {
    code: -7,
    description: errorDescription,
    url: url,
    type: ErrorCategories.CERTIFICATE,
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
            recordError(err, { action: 'retry_after_certificate_error', url });
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
  
  // Record error in our tracking system
  const errorDetails = {
    errorCode: e.errorCode,
    errorDescription: e.errorDescription,
    url: e.validatedURL || browser?.currentUrl,
    isMainFrame: e.isMainFrame
  };
  
  recordError(e.errorDescription || 'Webview error', errorDetails, getErrorType(e.errorCode));
  
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
      recordError(err, { action: 'clear_error' });
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
    recordError(error, { action: 'render_error_frame', errorType, data });
  }
}

/**
 * Get the error history for debugging and analysis
 * 
 * @param {number} limit - Maximum number of errors to return
 * @returns {Array} Array of recent errors
 */
export function getErrorHistory(limit = 50) {
  return errorHistory.slice(0, limit);
}

/**
 * Export the track error history for development/debugging
 * 
 * @returns {Object} Error history JSON
 */
export function exportErrorHistory() {
  return {
    exportedAt: new Date().toISOString(),
    errors: errorHistory,
    stats: getErrorStats()
  };
}

/**
 * Clear error history
 */
export function clearErrorHistory() {
  errorHistory = [];
  saveErrorHistory();
  return { success: true, message: 'Error history cleared' };
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
  renderErrorInFrame,
  recordError,
  getErrorStats,
  getErrorHistory,
  exportErrorHistory,
  clearErrorHistory,
  ErrorCategories
}; 