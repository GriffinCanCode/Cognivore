/**
 * NavigationService.js - Handles browser navigation functionality
 * 
 * This service provides navigation methods, timeout handling, and URL processing
 * for the Voyager browser component.
 */

import { formatUrl } from '../utils/BrowserUtilities';
import { renderErrorPage } from './ErrorHandler';
import { enforceFullscreenStyles } from './EventHandlers';
import { updateLoadingControls } from '../renderers/NavigationControlsRenderer';

/**
 * Navigate to a URL
 * @param {Object} browser - Browser instance
 * @param {string} url - URL to navigate to
 * @param {boolean} forceNavigate - If true, will navigate even if URL matches current URL
 */
export function navigate(browser, url, forceNavigate = false) {
  if (!url) return;
  
  console.log('Navigation request:', browser?.state?.url, '->', url);
  
  // Format URL for navigation
  const formattedUrl = formatUrl(url);
  
  // If URL is the same and we're not forcing navigation, do nothing
  if (!forceNavigate && browser.state && browser.state.url === formattedUrl) {
    console.log('Already at requested URL, skipping navigation');
    return;
  }
  
  // Update browser state
  if (browser.setState) {
    browser.setState({
      url: formattedUrl,
      isLoading: true,
      error: null
    });
  } else {
    browser.state = browser.state || {};
    browser.state.url = formattedUrl;
    browser.state.isLoading = true;
    browser.state.error = null;
  }
  
  // Update loading indicator
  updateLoadingControls(browser, true);
  
  // Show loading content if available
  if (typeof browser.showLoadingContent === 'function') {
    browser.showLoadingContent(formattedUrl);
  }
  
  // Set timeout for navigation
  // Clear any existing navigation timeout
  if (browser._navigationTimeout) {
    clearTimeout(browser._navigationTimeout);
    browser._navigationTimeout = null;
  }
  
  // Set a new timeout for 10 seconds (was 8 seconds)
  browser._navigationTimeout = setTimeout(() => {
    console.log('Navigation timeout reached for URL:', formattedUrl);
    
    // Prevent duplicate timeout handling
    if (browser._handlingNavigationTimeout) {
      console.log('Already handling navigation timeout, skipping duplicate');
      return;
    }
    
    browser._handlingNavigationTimeout = true;
    
    // Special handling for Google to try to recover and make page visible
    if (formattedUrl.includes('google.com')) {
      console.log('Google page detected, applying special timeout handling');
      
      // Force visibility of webview if present
      if (browser.webview) {
        console.log('Applying aggressive visibility styles to Google webview');
        
        // Ensure webview is visible
        browser.webview.style.visibility = 'visible';
        browser.webview.style.opacity = '1';
        browser.webview.style.display = 'block';
        
        // Try to apply critical styles if method exists
        if (typeof browser.webview.applyAllCriticalStyles === 'function') {
          browser.webview.applyAllCriticalStyles();
        }
        
        // Apply fullscreen styles as backup method
        enforceFullscreenStyles(browser);
        
        // Try to execute JavaScript to fix Google directly
        if (typeof browser.webview.executeJavaScript === 'function') {
          try {
            browser.webview.executeJavaScript(`
              (function() {
                // Create or update style for critical elements
                let styleEl = document.getElementById('cognivore-emergency-styles');
                if (!styleEl) {
                  styleEl = document.createElement('style');
                  styleEl.id = 'cognivore-emergency-styles';
                  document.head.appendChild(styleEl);
                }
                
                // Apply visibility styles to all critical elements
                styleEl.textContent = \`
                  html, body {
                    visibility: visible !important;
                    opacity: 1 !important;
                    display: block !important;
                    width: 100% !important;
                    height: 100% !important;
                    overflow-x: hidden !important;
                  }
                  
                  #main, #cnt, #rcnt, #center_col, #rso, [role="main"],
                  .g, .yuRUbf, .MjjYud, #search, #searchform {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                  }
                \`;
                
                // Force layout recalculation
                document.documentElement.scrollTop = 0;
                
                // Return the document title to check if page is loaded
                return document.title;
              })()
            `).then(title => {
              console.log('Page appears to be loaded with title:', title);
              
              if (title && title !== 'about:blank' && !title.includes('Error')) {
                // Page is likely loaded but had a visibility issue
                console.log('Page successfully recovered after timeout');
                
                // Update browser state
                browser.setState({
                  isLoading: false,
                  error: null
                });
                
                // Update loading indicator
                updateLoadingControls(browser, false);
                
                // Set navigation timeout flag to false
                browser._handlingNavigationTimeout = false;
              } else {
                // Title doesn't look good, probably still an issue
                console.log('Google page not fully loaded after timeout, title:', title);
                
                // Continue with normal timeout handling
                handleNavigationTimeout(browser, formattedUrl);
              }
            }).catch(err => {
              console.error('Error applying emergency styles:', err);
              
              // Continue with normal timeout handling
              handleNavigationTimeout(browser, formattedUrl);
            });
            
            // Don't continue with the rest of the timeout handling yet
            // It will be called in the error handler if needed
            return;
          } catch (err) {
            console.error('Failed to execute emergency script:', err);
            // Continue with normal timeout handling
          }
        }
      }
    }
    
    // If we reached here, handle timeout normally
    handleNavigationTimeout(browser, formattedUrl);
  }, 10000); // Increased timeout from 8000 to 10000 ms
  
  // Check if webview exists before navigating
  // This addresses the issue of missing webview
  if (!browser.webview && !browser.contentFrame) {
    console.log('No webview or contentFrame found - creating webview first');
    
    // Try to re-initialize webview if needed
    if (typeof browser.initializeWebview === 'function') {
      browser.initializeWebview(() => {
        // Retry navigation after webview is initialized
        setTimeout(() => {
          executeNavigation(browser, formattedUrl);
        }, 100);
      });
      return;
    }
    
    // Wait a brief moment to see if webview gets created
    setTimeout(() => {
      if (browser.webview || browser.contentFrame) {
        executeNavigation(browser, formattedUrl);
      } else {
        console.error('Could not create webview for navigation');
        renderErrorPage(browser, {
          code: 'NO_RENDERER',
          url: formattedUrl,
          message: 'Browser renderer is not available'
        });
      }
    }, 100);
    return;
  }
  
  // Execute the navigation
  executeNavigation(browser, formattedUrl);
}

/**
 * Handle a navigation timeout
 * @param {Object} browser - Browser instance
 * @param {string} url - URL that timed out
 */
function handleNavigationTimeout(browser, url) {
  console.log(`Navigation timeout for URL: ${url}`);
  
  // Reset the flag
  browser._handlingNavigationTimeout = false;
  
  // Set timeout for Google-specific recovery
  if (url.includes('google.com') && browser.webview) {
    console.log('Page still appears to be loading after timeout, forcing visibility');
    
    // Force visibility of the webview
    browser.webview.style.visibility = 'visible';
    browser.webview.style.opacity = '1';
    browser.webview.style.display = 'block';
    
    // Try to apply critical styles if method exists
    if (typeof browser.webview.applyAllCriticalStyles === 'function') {
      browser.webview.applyAllCriticalStyles();
    }
    
    // Check if we want to still show a timeout error
    const showTimeoutError = false; // Set to true to show error, false to try recovery
    
    if (!showTimeoutError) {
      // Continue as if page loaded successfully
      if (browser.setState) {
        browser.setState({ isLoading: false });
      }
      
      // Update loading indicator
      updateLoadingControls(browser, false);
      
      return;
    }
  }
  
  // Render a timeout error page
  renderErrorPage(browser, {
    code: 'TIMEOUT',
    description: 'The page took too long to load.',
    url,
    type: 'network',
    onRetry: () => {
      // Clear error and retry navigation
      if (browser.setState) {
        browser.setState({ error: null });
      }
      
      navigate(browser, url, true);
    }
  });
}

/**
 * Execute the actual navigation after checks
 * @param {Object} browser - Browser instance
 * @param {string} formattedUrl - Formatted URL to navigate to
 */
function executeNavigation(browser, formattedUrl) {
  // Record navigation start time
  browser.navigationStartTime = Date.now();
  
  // Check webview type and execute appropriate navigation
  if (browser.webview && browser.webview.tagName.toLowerCase() === 'webview') {
    try {
      // Use the src attribute for navigation
      browser.webview.src = formattedUrl;
      console.log('Navigating webview to:', formattedUrl);
    } catch (err) {
      console.error('Webview navigation error:', err);
      renderErrorPage(browser, {
        code: 'NAV_ERROR',
        url: formattedUrl,
        message: 'Failed to navigate: ' + err.message
      });
    }
  } 
  else if (browser.contentFrame) {
    // Navigate via iframe
    try {
      browser.contentFrame.src = formattedUrl;
      console.log('Navigating content frame to:', formattedUrl);
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
 * Go back in browser history
 * @param {Object} browser - Browser instance
 */
export function goBack(browser) {
  // Clear any current navigation timeout
  if (browser._navigationTimeout) {
    clearTimeout(browser._navigationTimeout);
    browser._navigationTimeout = null;
  }
  
  if (browser.webview && typeof browser.webview.goBack === 'function') {
    if (browser.webview.canGoBack()) {
      browser.webview.goBack();
      
      // Update browser state
      if (browser.setState) {
        browser.setState({ isLoading: true });
      } else if (browser.state) {
        browser.state.isLoading = true;
      }
      
      // Update loading indicator - use the same function as navigate uses
      updateLoadingControls(browser, true);
    }
  }
}

/**
 * Go forward in browser history
 * @param {Object} browser - Browser instance
 */
export function goForward(browser) {
  // Clear any current navigation timeout
  if (browser._navigationTimeout) {
    clearTimeout(browser._navigationTimeout);
    browser._navigationTimeout = null;
  }
  
  if (browser.webview && typeof browser.webview.goForward === 'function') {
    if (browser.webview.canGoForward()) {
      browser.webview.goForward();
      
      // Update browser state
      if (browser.setState) {
        browser.setState({ isLoading: true });
      } else if (browser.state) {
        browser.state.isLoading = true;
      }
      
      // Update loading indicator - use the same function as navigate uses
      updateLoadingControls(browser, true);
    }
  }
}

/**
 * Refresh the current page
 * @param {Object} browser - Browser instance
 */
export function refreshPage(browser) {
  // Clear any current navigation timeout
  if (browser._navigationTimeout) {
    clearTimeout(browser._navigationTimeout);
    browser._navigationTimeout = null;
  }
  
  if (browser.webview) {
    if (typeof browser.webview.reload === 'function') {
      browser.webview.reload();
    } else {
      // Fallback for when reload method is not available
      const currentUrl = browser.webview.src || browser.state.url;
      if (currentUrl) {
        browser.webview.src = currentUrl;
      }
    }
  } else if (browser.iframe) {
    browser.iframe.src = browser.iframe.src;
  }
  
  // Update browser state
  if (browser.setState) {
    browser.setState({ isLoading: true });
  } else if (browser.state) {
    browser.state.isLoading = true;
  }
  
  // Update loading indicator
  updateLoadingControls(browser, true);
}

/**
 * Stop loading the current page
 * @param {Object} browser - Browser instance
 */
export function stopLoading(browser) {
  // Clear any current navigation timeout
  if (browser._navigationTimeout) {
    clearTimeout(browser._navigationTimeout);
    browser._navigationTimeout = null;
  }
  
  if (browser.webview && typeof browser.webview.stop === 'function') {
    browser.webview.stop();
  }
  
  // Update browser state
  if (browser.setState) {
    browser.setState({ isLoading: false });
  } else if (browser.state) {
    browser.state.isLoading = false;
  }
  
  updateLoadingControls(browser, false);
  
  // Force visibility of the webview in case it was stuck
  if (browser.webview) {
    browser.webview.style.visibility = 'visible';
    browser.webview.style.opacity = '1';
    
    // Try to apply critical styles if method exists
    if (typeof browser.webview.applyAllCriticalStyles === 'function') {
      browser.webview.applyAllCriticalStyles();
    }
  }
}

/**
 * Render HTML content in the browser
 * @param {Object} browser - Browser instance
 * @param {string} html - HTML content to render
 */
export function renderHtml(browser, html) {
  // Clear any current navigation timeout
  if (browser._navigationTimeout) {
    clearTimeout(browser._navigationTimeout);
    browser._navigationTimeout = null;
  }
  
  // Implementation depends on browser implementation
  if (browser.webview && typeof browser.webview.executeJavaScript === 'function') {
    browser.webview.executeJavaScript(`
      document.open();
      document.write(${JSON.stringify(html)});
      document.close();
    `).catch(err => {
      console.error('Error rendering HTML in webview:', err);
      
      // Fallback to data URI if executeJavaScript fails
      try {
        const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        browser.webview.src = dataUri;
      } catch (dataUriErr) {
        console.error('Data URI fallback also failed:', dataUriErr);
      }
    });
  } else if (browser.contentFrame) {
    try {
      const doc = browser.contentFrame.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      } else {
        // Fallback to data URI if contentDocument not available
        const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        browser.contentFrame.src = dataUri;
      }
    } catch (err) {
      console.error('Error rendering HTML in iframe:', err);
      
      // Ultimate fallback - create error container in DOM
      try {
        const container = document.createElement('div');
        container.innerHTML = html;
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.backgroundColor = '#fff';
        container.style.zIndex = '1000';
        container.style.overflow = 'auto';
        
        // Append to browser container
        if (browser.container) {
          browser.container.appendChild(container);
        } else if (document.body) {
          document.body.appendChild(container);
        }
      } catch (fallbackErr) {
        console.error('All HTML rendering methods failed:', fallbackErr);
      }
    }
  } else {
    console.error('No suitable renderer available for HTML content');
  }
  
  // Update state
  if (browser.setState) {
    browser.setState({ isLoading: false });
  }
  
  // Update loading indicator
  updateLoadingControls(browser, false);
}

export default {
  navigate,
  goBack,
  goForward,
  refreshPage,
  stopLoading,
  renderHtml
}; 