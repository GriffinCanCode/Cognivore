/**
 * NavigationService.js - Handles browser navigation functionality
 * 
 * This service provides navigation methods, timeout handling, and URL processing
 * for the Voyager browser component.
 */

import { formatUrl, applySiteSpecificSettings } from '../utils/BrowserUtilities';
import { updateAddressBar, updateLoadingIndicator } from '../renderers/BrowserRenderer';
import { renderErrorPage } from './ErrorHandler';

/**
 * Navigate to a URL
 * @param {Object} browser - Browser instance
 * @param {string} url - URL to navigate to
 * @param {boolean} forceNavigate - If true, will navigate even if URL matches current URL
 */
export function navigate(browser, url, forceNavigate = false) {
  if (!url) return;
  
  let formattedUrl = url;
  try {
    // Add protocol if missing
    if (!url.match(/^[a-zA-Z]+:\/\//)) {
      // If it looks like a domain, add https://
      if (url.match(/^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}/) || url.includes('.')) {
        formattedUrl = 'https://' + url;
      } else {
        // Otherwise, treat as search
        formattedUrl = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }
    
    // Standard URL validation and formatting
    formattedUrl = formatUrl(formattedUrl);
    
    console.log(`Navigation request: ${url} -> ${formattedUrl}`);
  } catch (err) {
    console.error('Error formatting URL:', err);
    
    // Use direct URL as fallback
    formattedUrl = url;
  }
  
  // Don't navigate if already at this URL
  if (!forceNavigate && browser.state && browser.state.currentUrl === formattedUrl) {
    console.log('Already at URL:', formattedUrl);
    return;
  }
  
  // Start loading process
  if (browser.setState) {
    browser.setState({ isLoading: true, loadError: false, currentUrl: formattedUrl });
  }
  
  // Update address bar immediately
  if (browser.searchInput) {
    browser.searchInput.value = formattedUrl;
  }
  
  // Show loading indicator
  updateLoadingIndicator(browser, true);
  
  // Update browser state
  browser.isLoading = true;
  
  // Clear any existing navigation timeouts
  if (browser._navigationTimeout) {
    clearTimeout(browser._navigationTimeout);
    browser._navigationTimeout = null;
  }
  
  // Set a timeout to show error page if navigation takes too long
  const navigationTimeoutPeriod = 10000; // Increased to 10 seconds for better reliability
  
  // Store timeout reference for clearing
  browser._navigationTimeout = setTimeout(() => {
    console.log('Navigation timeout reached, hiding loading content');
    
    // Check if still in loading state
    if (browser.isLoading && !browser.navigationCancelled) {
      console.log('Navigation timed out, showing error message');
      
      // Stop loading indicator
      updateLoadingIndicator(browser, false);
      
      // Update state
      if (browser.setState) {
        browser.setState({ isLoading: false, loadError: true });
      }
      
      // Provide feedback that navigation timed out
      browser.isLoading = false;
      browser.loadError = true;
      
      // Check if page loaded despite timeout
      browser.checkIfPageIsLoaded(() => {
        // If checking loaded state didn't resolve the issue, show a message
        if (browser.isLoading) {
          // Try to recover by explicitly stopping loading
          try {
            if (browser.webview && typeof browser.webview.stop === 'function') {
              browser.webview.stop();
            }
          } catch (err) {
            console.warn('Error stopping webview:', err);
          }
          
          // Show error UI if still loading
          renderErrorPage(browser, {
            code: 'TIMEOUT',
            url: formattedUrl,
            message: 'Navigation timed out. The website might be unavailable or loading slowly.'
          });
          
          // Try to recover navigation with alternative approach
          try {
            recoverFromNavigationFailure(browser, formattedUrl);
          } catch (err) {
            console.warn('Error recovering from navigation timeout:', err);
          }
        }
      });
    }
  }, navigationTimeoutPeriod);
  
  // Navigate based on implementation type
  if (browser.webview && browser.state.environment.webviewImplementation === 'webview') {
    try {
      console.log(`🌐 Navigating webview to: ${formattedUrl}`);
      
      // Ensure webview is fully ready before navigation
      if (!browser.webviewReady) {
        console.log('Webview not fully ready. Setting up delayed navigation.');
        
        // Set up a delayed navigation attempt that checks for readiness
        const checkAndNavigate = () => {
          if (browser.webviewReady) {
            // Safe to navigate
            performWebviewNavigation(browser, formattedUrl);
          } else {
            // Check again after a short delay
            setTimeout(checkAndNavigate, 50);
          }
        };
        
        // Start the check cycle
        setTimeout(checkAndNavigate, 50);
        return;
      }
      
      // Webview is ready, perform navigation
      performWebviewNavigation(browser, formattedUrl);
      
    } catch (err) {
      console.error('WebView navigation error:', err);
      renderErrorPage(browser, {
        code: 'NAV_ERROR',
        url: formattedUrl,
        message: 'Failed to navigate: ' + err.message
      });
    }
  } else if (browser.contentFrame) {
    // Navigate via iframe
    try {
      browser.contentFrame.src = formattedUrl;
    } catch (err) {
      console.error('Content frame navigation error:', err);
      renderErrorPage(browser, {
        code: 'NAV_ERROR',
        url: formattedUrl,
        message: 'Failed to navigate: ' + err.message
      });
    }
  } else {
    console.error('No webview or contentFrame available for navigation');
    
    // Clear timeout to prevent error page from displaying twice
    if (browser._navigationTimeout) {
      clearTimeout(browser._navigationTimeout);
      browser._navigationTimeout = null;
    }
    
    // Show error page
    renderErrorPage(browser, {
      code: 'NO_RENDERER',
      url: formattedUrl,
      message: 'Browser view is not available'
    });
  }
}

/**
 * Perform the actual webview navigation with proper error handling
 * @param {Object} browser - Browser instance
 * @param {string} url - URL to navigate to
 */
function performWebviewNavigation(browser, url) {
  // Handle the partition error case more gracefully
  try {
    // First try to load the URL using loadURL if available (preferred method)
    if (typeof browser.webview.loadURL === 'function') {
      browser.webview.loadURL(url)
        .catch(err => {
          console.warn('loadURL failed, falling back to src attribute:', err);
          safeSetSrc(browser.webview, url);
        });
    } else {
      // Fall back to src attribute
      safeSetSrc(browser.webview, url);
    }
    
    // Set up redundant load detection for better reliability
    setupRedundantLoadDetection(browser, url);
  } catch (partitionErr) {
    handleNavigationError(browser, partitionErr, url);
  }
}

/**
 * Safely set the src attribute of a webview with error handling
 * @param {HTMLElement} webview - The webview element
 * @param {string} url - URL to navigate to
 */
function safeSetSrc(webview, url) {
  try {
    webview.src = url;
  } catch (err) {
    console.error('Error setting webview src:', err);
    
    // Try one more time with about:blank first to reset state
    try {
      webview.src = 'about:blank';
      setTimeout(() => {
        try {
          webview.src = url;
        } catch (finalErr) {
          console.error('Final attempt to set src failed:', finalErr);
        }
      }, 100);
    } catch (resetErr) {
      console.error('Failed to reset webview src to about:blank:', resetErr);
    }
  }
}

/**
 * Handle navigation errors with appropriate recovery strategies
 * @param {Object} browser - Browser instance
 * @param {Error} err - The error that occurred
 * @param {string} url - URL that was being navigated to
 */
function handleNavigationError(browser, err, url) {
  // Check for partition error specifically
  if (err.message && err.message.includes("partition cannot be changed")) {
    console.warn('Partition error detected. Attempting alternative navigation...');
    
    // Alternative approach: try to reload the current page first, then navigate
    setTimeout(() => {
      try {
        // Try to reload first to clear any state
        if (typeof browser.webview.reload === 'function') {
          browser.webview.reload();
          
          // After a short delay, attempt to set src again
          setTimeout(() => {
            try {
              browser.webview.src = url;
            } catch (finalErr) {
              console.error('Final navigation attempt failed:', finalErr);
              // Reset loading state if all attempts fail
              browser.setState({ isLoading: false });
              updateLoadingIndicator(browser, false);
              
              // Show error page
              renderErrorPage(browser, {
                code: 'PARTITION_ERROR',
                url: url,
                message: 'Failed to navigate: ' + finalErr.message
              });
            }
          }, 100);
        } else {
          // If reload isn't available, try navigation directly
          console.warn('Reload not available, trying direct navigation...');
          browser.webview.src = url;
        }
      } catch (recoveryErr) {
        console.error('Recovery navigation error:', recoveryErr);
        // Reset loading state if recovery fails
        browser.setState({ isLoading: false });
        updateLoadingIndicator(browser, false);
        
        // Show error page
        renderErrorPage(browser, {
          code: 'RECOVERY_ERROR',
          url: url,
          message: 'Failed to recover from navigation error: ' + recoveryErr.message
        });
      }
    }, 50);
  } else if (err.message && err.message.includes("GUEST_VIEW_MANAGER_CALL")) {
    // Handle the specific GUEST_VIEW_MANAGER_CALL error
    console.warn('GUEST_VIEW_MANAGER_CALL error detected. Attempting to recreate webview...');
    
    // Try to recover by recreating the webview
    try {
      // First stop loading and clear any state
      if (typeof browser.webview.stop === 'function') {
        browser.webview.stop();
      }
      
      // Remove and recreate the webview
      const container = browser.webview.parentElement;
      if (container) {
        // Keep a reference to the old webview to remove event listeners
        const oldWebview = browser.webview;
        
        // Create a new webview
        if (typeof browser.createWebview === 'function') {
          // Use browser's create method if available
          browser.createWebview();
          
          // Update loading state
          browser.setState({ isLoading: true });
          updateLoadingIndicator(browser, true);
          
          // Try navigation again after a delay
          setTimeout(() => {
            try {
              browser.navigate(url, true);
            } catch (finalErr) {
              console.error('Final navigation attempt after recreation failed:', finalErr);
            }
          }, 500);
        } else {
          // Reset loading state if recovery fails
          browser.setState({ isLoading: false });
          updateLoadingIndicator(browser, false);
          
          // Show error page in the current webview
          renderErrorPage(browser, {
            code: 'GUEST_VIEW_ERROR',
            url: url,
            message: 'Browser view encountered an error and needs to be restarted.'
          });
        }
      }
    } catch (recreateErr) {
      console.error('Error recreating webview:', recreateErr);
      
      // Reset loading state if recovery fails
      browser.setState({ isLoading: false });
      updateLoadingIndicator(browser, false);
      
      // Show error page
      renderErrorPage(browser, {
        code: 'RECREATION_ERROR',
        url: url,
        message: 'Failed to recover from navigation error: ' + recreateErr.message
      });
    }
  } else {
    // Not a specific recognized error, handle generically
    console.error('WebView navigation error:', err);
    
    // Reset loading state
    browser.setState({ isLoading: false });
    updateLoadingIndicator(browser, false);
    
    // Show error page
    renderErrorPage(browser, {
      code: 'NAV_ERROR',
      url: url,
      message: 'Failed to navigate: ' + err.message
    });
  }
}

/**
 * Setup redundant load detection for more reliable navigation
 * @param {Object} browser - Browser instance
 * @param {string} targetUrl - The URL being loaded
 */
export function setupRedundantLoadDetection(browser, targetUrl) {
  // We'll poll periodically to check if the page has navigated successfully
  // This works around cases where the load events don't fire properly
  
  // Clear any existing detection intervals
  if (browser._loadDetectionInterval) {
    clearInterval(browser._loadDetectionInterval);
  }
  
  // Start time for tracking duration
  const startTime = Date.now();
  const maxDetectionTime = 8000; // Max 8 seconds of detection
  
  // Use a relatively fast polling interval (250ms)
  browser._loadDetectionInterval = setInterval(() => {
    // Check if we've been polling too long
    if (Date.now() - startTime > maxDetectionTime) {
      clearInterval(browser._loadDetectionInterval);
      return;
    }
    
    // Skip checks if we're not loading anymore
    if (!browser.state.isLoading) {
      clearInterval(browser._loadDetectionInterval);
      return;
    }
    
    // Call our check method
    checkIfPageIsLoaded(browser);
  }, 250);
}

/**
 * Check if the page is actually loaded based on URL changes or other signals
 * @param {Object} browser - Browser instance
 * @param {Function} callback - Optional callback after check completes
 */
export function checkIfPageIsLoaded(browser, callback) {
  if (!browser.webview || !browser.state?.isLoading) {
    if (callback) callback();
    return;
  }
  
  console.log('Checking if page is actually loaded despite missing events');
  
  try {
    // For webview, we'll use executeJavaScript to check current URL
    if (browser.webview.tagName?.toLowerCase() === 'webview' && 
        typeof browser.webview.executeJavaScript === 'function') {
      
      browser.webview.executeJavaScript(`
        {
          currentUrl: window.location.href,
          readyState: document.readyState,
          title: document.title
        }
      `).then(result => {
        if (!result) {
          if (callback) callback();
          return;
        }
        
        // Check if URL has changed, indicating successful navigation
        if (result.currentUrl && result.currentUrl !== 'about:blank' && 
            result.currentUrl !== browser.currentUrl &&
            result.readyState === 'complete') {
          
          console.log(`Page appears to be loaded based on URL change: ${result.currentUrl}`);
          
          // Update title if available
          if (result.title) {
            browser.setState({ title: result.title });
            browser.updatePageTitle(result.title);
          }
          
          // Update loading state
          browser.setState({ isLoading: false });
          updateLoadingIndicator(browser, false);
          
          // Make webview fully visible
          if (typeof browser.webview.applyAllCriticalStyles === 'function') {
            browser.webview.applyAllCriticalStyles(true);
          }
          
          // Capture content
          browser.capturePageContent();
          
          // Clear navigation timeout
          if (browser._navigationTimeout) {
            clearTimeout(browser._navigationTimeout);
            browser._navigationTimeout = null;
          }
          
          // Clear detection interval
          if (browser._loadDetectionInterval) {
            clearInterval(browser._loadDetectionInterval);
          }
        }
        
        if (callback) callback();
      }).catch(err => {
        console.warn('Error checking if page is loaded:', err);
        if (callback) callback();
      });
    } else if (callback) {
      callback();
    }
  } catch (err) {
    console.warn('Error in checkIfPageIsLoaded:', err);
    if (callback) callback();
  }
}

/**
 * Refresh the current page
 * @param {Object} browser - Browser instance
 */
export function refreshPage(browser) {
  if (browser.webview) {
    browser.webview.reload();
  } else if (browser.iframe) {
    browser.iframe.src = browser.iframe.src;
  }
  
  browser.setState({ isLoading: true });
  updateLoadingIndicator(browser, true);
}

/**
 * Stop loading the current page
 * @param {Object} browser - Browser instance
 */
export function stopLoading(browser) {
  if (browser.webview) {
    browser.webview.stop();
  } else if (browser.iframe) {
    // For iframe, we just update the UI state since we can't actually stop it
    browser.setState({ isLoading: false });
    updateLoadingIndicator(browser, false);
  }
}

/**
 * Render HTML content in the browser
 * @param {Object} browser - Browser instance
 * @param {string} html - HTML content to render
 */
export function renderHtml(browser, html) {
  // Implementation depends on browser implementation
  if (browser.webview && typeof browser.webview.executeJavaScript === 'function') {
    browser.webview.executeJavaScript(`
      document.open();
      document.write(${JSON.stringify(html)});
      document.close();
    `).catch(err => {
      console.error('Error rendering HTML in webview:', err);
    });
  } else if (browser.iframe) {
    try {
      const doc = browser.iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    } catch (err) {
      console.error('Error rendering HTML in iframe:', err);
    }
  }
}

export default {
  navigate,
  setupRedundantLoadDetection,
  checkIfPageIsLoaded,
  refreshPage,
  stopLoading,
  renderHtml
}; 