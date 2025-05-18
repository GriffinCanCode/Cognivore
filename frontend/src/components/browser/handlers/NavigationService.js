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
  
  // Clear any existing navigation timeouts
  if (browser._navigationTimeout) {
    clearTimeout(browser._navigationTimeout);
    browser._navigationTimeout = null;
  }
  
  // Format the URL (add protocol if needed)
  const formattedUrl = formatUrl(url);
  
  // Check if we're already on this URL to avoid partition errors
  if (!forceNavigate && browser.state?.url === formattedUrl) {
    console.log(`Already on URL: "${formattedUrl}", skipping navigation to prevent partition errors`);
    
    // Instead of skipping completely, we should still update our UI state
    // This helps when switching between tabs with the same URL
    updateAddressBar(browser, formattedUrl);
    
    return;
  }
  
  // Store the original URL for logging
  const originalUrl = url;
  
  console.log(`Navigating from "${originalUrl}" to formatted URL: "${formattedUrl}"`);
  
  // Apply site-specific settings
  applySiteSpecificSettings.call(browser, formattedUrl);
  
  // Update state
  browser.setState({ 
    url: formattedUrl,
    isLoading: true,
    errorState: null
  });
  
  // Update address bar display
  updateAddressBar(browser, formattedUrl);
  
  // Update loading indicator
  updateLoadingIndicator(browser, true);
  
  // Set current URL for tracking
  browser.currentUrl = formattedUrl;
  
  // Create a more reliable navigation timeout with progressive fallbacks
  // Start with a longer timeout period (8 seconds instead of 5)
  const navigationTimeoutPeriod = 8000;
  
  browser._navigationTimeout = setTimeout(() => {
    console.log('Navigation timeout reached, hiding loading content');
    
    // Set a flag that we're handling a timeout
    browser._handlingNavigationTimeout = true;
    
    // Check if we need to handle the timeout (if page is not already loaded)
    if (browser.state.isLoading) {
      // First, try to see if the page actually loaded despite not triggering load events
      checkIfPageIsLoaded(browser, () => {
        // If checking loaded state didn't resolve the issue, show a message
        if (browser.state.isLoading && browser._handlingNavigationTimeout) {
          // Update loading state to help UI recover
          browser.setState({ isLoading: false });
          updateLoadingIndicator(browser, false);
          
          // Try a fallback approach - sometimes the load event doesn't fire
          if (browser.webview) {
            try {
              // For webview implementations, try to force completion
              if (browser.webview.tagName.toLowerCase() === 'webview') {
                // Apply full styles to ensure visibility
                if (typeof browser.webview.applyAllCriticalStyles === 'function') {
                  browser.webview.applyAllCriticalStyles(true);
                }
                
                // Make sure webview is visible
                browser.webview.style.visibility = 'visible';
                browser.webview.style.opacity = '1';
                browser.webview.readyToShow = true;
                
                // Update UI to reflect completion
                updateLoadingIndicator(browser, false);
                
                // Try to gracefully extract information from the page
                if (typeof browser.webview.executeJavaScript === 'function') {
                  browser.webview.executeJavaScript(`
                    {
                      title: document.title || 'Unknown Page',
                      url: window.location.href,
                      loaded: true
                    }
                  `).then(result => {
                    if (result) {
                      console.log('Retrieved page info despite timeout:', result);
                      
                      // Update title if available
                      if (result.title) {
                        browser.setState({ title: result.title });
                        browser.updatePageTitle(result.title);
                      }
                      
                      // Capture content if possible
                      browser.capturePageContent();
                    }
                  }).catch(err => {
                    console.warn('Failed to get page info after timeout:', err);
                  });
                }
              }
            } catch (err) {
              console.warn('Error recovering from navigation timeout:', err);
            }
          }
        }
      });
    }
  }, navigationTimeoutPeriod);
  
  // Navigate based on implementation type
  if (browser.webview && browser.state.environment.webviewImplementation === 'webview') {
    try {
      console.log(`🌐 Navigating webview to: ${formattedUrl}`);
      
      // Handle the partition error case more gracefully
      try {
        browser.webview.src = formattedUrl;
      } catch (partitionErr) {
        // Check for partition error specifically
        if (partitionErr.message && partitionErr.message.includes("partition cannot be changed")) {
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
                    browser.webview.src = formattedUrl;
                  } catch (finalErr) {
                    console.error('Final navigation attempt failed:', finalErr);
                    // Reset loading state if all attempts fail
                    browser.setState({ isLoading: false });
                    updateLoadingIndicator(browser, false);
                  }
                }, 100);
              } else {
                // If reload isn't available, try navigation directly
                console.warn('Reload not available, trying direct navigation...');
                browser.webview.src = formattedUrl;
              }
            } catch (recoveryErr) {
              console.error('Recovery navigation error:', recoveryErr);
              // Reset loading state if recovery fails
              browser.setState({ isLoading: false });
              updateLoadingIndicator(browser, false);
            }
          }, 50);
        } else {
          // Not a partition error, rethrow
          throw partitionErr;
        }
      }
      
      // Set up redundant load detection for better reliability
      setupRedundantLoadDetection(browser, formattedUrl);
    } catch (err) {
      // Check for partition error and handle gracefully
      if (err.message && err.message.includes("partition cannot be changed")) {
        console.warn('Partition error detected during navigation. This tab is already navigated.');
        // Reset loading state
        browser.setState({ isLoading: false });
        updateLoadingIndicator(browser, false);
        
        // Clear navigation timeout
        if (browser._navigationTimeout) {
          clearTimeout(browser._navigationTimeout);
          browser._navigationTimeout = null;
        }
        return;
      }
      
      console.error('WebView navigation error:', err);
      renderErrorPage(browser, {
        code: 'NAV_ERROR',
        url: formattedUrl,
        message: 'Failed to navigate: ' + err.message
      });
    }
  } else if (browser.iframe) {
    try {
      console.log(`🌐 Navigating iframe to: ${formattedUrl}`);
      // Handle navigation errors for iframes
      browser.iframe.onload = browser.handleWebviewLoad;
      browser.iframe.onerror = (event) => {
        renderErrorPage(browser, {
          code: 'IFRAME_LOAD_ERROR',
          url: formattedUrl,
          message: 'Failed to load content in iframe'
        });
      };
      browser.iframe.src = formattedUrl;
    } catch (err) {
      console.error('iframe navigation error:', err);
      renderErrorPage(browser, {
        code: 'NAV_ERROR',
        url: formattedUrl,
        message: 'Failed to navigate: ' + err.message
      });
    }
  } else {
    // Fallback renderer for when neither webview nor iframe is available
    renderHtml(browser, `
      <div style="font-family: system-ui; padding: 20px; text-align: center;">
        <h2>Navigation Not Supported</h2>
        <p>This browser view cannot navigate directly to: ${formattedUrl}</p>
        <p>Please use an external browser or enable the internal browser view.</p>
        <a href="${formattedUrl}" target="_blank" rel="noopener noreferrer">Open in new window</a>
      </div>
    `);
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