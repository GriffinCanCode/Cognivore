/**
 * EventHandlers - Event handlers for browser component
 */
import { renderErrorPage } from '../renderers/ErrorPageRenderer.js';
import { applyRenderingFixes } from '../utils/ContentUtils.js';

/**
 * Handle webview/iframe load event
 * @param {Object} browser - Browser instance
 * @param {Event} e - Load event
 */
export function handleWebviewLoad(browser, e) {
  console.log('Webview loaded successfully:', e);
  
  // Mark as not loading
  browser.isLoading = false;
  browser.contentRendered = true;
  updateLoadingState(browser);
  
  // Set progress to 100% to complete the progress bar
  if (typeof browser.showLoadingProgress === 'function') {
    browser.showLoadingProgress(100);
  } else {
    updateLoadingProgress(browser, 100);
  }
  
  // First apply critical styles before hiding loading content
  enforceFullscreenStyles(browser);
  
  // Then hide loading content with a delay to ensure webview is ready
  setTimeout(() => {
    // Check if hideLoadingContent exists before calling it
    if (typeof browser.hideLoadingContent === 'function') {
      browser.hideLoadingContent();
    }
    
    // Apply styles again after hiding loading content
    enforceFullscreenStyles(browser);
    
    // Set up periodic style enforcement
    const styleInterval = setInterval(() => {
      enforceFullscreenStyles(browser);
    }, 500);
    
    // Clear interval after 5 seconds (10 checks)
    setTimeout(() => {
      clearInterval(styleInterval);
    }, 5000);
  }, 200);
  
  // If research mode is enabled, extract content
  if (browser.researchMode) {
    browser.extractPageContent();
  }
  
  // Update the URL in the search input if needed
  // For webview in Electron, get the URL from the webview
  if (browser.webview && browser.webview.tagName && 
      browser.webview.tagName.toLowerCase() === 'webview' && 
      typeof browser.webview.getURL === 'function') {
    try {
      const currentUrl = browser.webview.getURL();
      if (currentUrl && currentUrl !== 'about:blank' && browser.searchInput) {
        browser.currentUrl = currentUrl;
        browser.searchInput.value = currentUrl;
      }
    } catch (err) {
      console.warn('Error getting URL from webview:', err);
    }
  }
  
  // Set up a content transition observer to handle page navigations within the webview
  if (browser.webview && browser.webview.tagName && 
      browser.webview.tagName.toLowerCase() === 'webview' && 
      typeof browser.webview.executeJavaScript === 'function' &&
      browser.webview.isConnected) {
    try {
      // First check if webview is ready for script execution 
      browser.webview.executeJavaScript('true')
        .then(() => {
          // Now safe to execute more complex scripts
          browser.webview.executeJavaScript(`
            // Set up history change listener to detect in-page navigations
            (function() {
              // Check if we've already set this up to prevent duplicate listeners
              if (window.cognivoreNavigationSetup) {
                return;
              }
              
              // Mark as set up
              window.cognivoreNavigationSetup = true;
              
              const originalPushState = history.pushState;
              const originalReplaceState = history.replaceState;
              
              // Override pushState
              history.pushState = function() {
                const result = originalPushState.apply(this, arguments);
                window.dispatchEvent(new Event('locationchange'));
                return result;
              };
              
              // Override replaceState
              history.replaceState = function() {
                const result = originalReplaceState.apply(this, arguments);
                window.dispatchEvent(new Event('locationchange'));
                return result;
              };
              
              // Listen for popstate
              window.addEventListener('popstate', function() {
                window.dispatchEvent(new Event('locationchange'));
              });
              
              // Listen for location changes
              window.addEventListener('locationchange', function() {
                console.log('Page navigation detected, reapplying styles');
                
                // Tell parent we're navigating
                try {
                  window.parent.postMessage({
                    type: 'webview-navigation',
                    url: window.location.href
                  }, '*');
                } catch (e) {
                  console.error('Failed to send navigation message:', e);
                }
                
                // Reapply styles after navigation
                setTimeout(function() {
                  // Create override stylesheet
                  let styleEl = document.getElementById('cognivore-browser-overrides');
                  if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'cognivore-browser-overrides';
                    document.head.appendChild(styleEl);
                  }
                  
                  // Apply Google-specific CSS
                  if (window.location.hostname.includes('google.com')) {
                    styleEl.textContent = \`
                      html, body {
                        width: 100% !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: auto !important;
                      }
                      /* Google Search specific fixes */
                      #main, #cnt, #rcnt, #center_col, .yuRUbf, .MjjYud, #rso, main, [role="main"] {
                        width: 100% !important;
                        min-height: 100% !important;
                        max-width: none !important;
                      }
                      .g, .yuRUbf, .MjjYud {
                        width: 100% !important;
                        margin-right: 0 !important;
                        padding-right: 0 !important;
                      }
                    \`;
                  } else {
                    // Generic styles for other sites
                    styleEl.textContent = \`
                      html, body {
                        width: 100% !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: auto !important;
                      }
                      main, [role="main"], #main, .main-content, .content, #content, article {
                        width: 100% !important;
                        min-height: 100% !important;
                      }
                    \`;
                  }
                  
                  // Directly apply styles to body and html
                  document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; overflow: hidden !important;";
                  document.body.style.cssText += "width: 100% !important; height: 100% !important; overflow: auto !important; position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;";
                  
                  console.log("Reapplied styles after navigation");
                }, 100);
              });
              
              console.log("Set up navigation style maintenance");
            })();
          `).catch(err => console.warn('Error setting up navigation listener:', err));
        })
        .catch(err => {
          console.warn('Webview not ready for script execution:', err);
        });
    } catch (err) {
      console.warn('Error executing script for navigation handling:', err);
    }
  }
}

/**
 * Helper function to enforce fullscreen styles
 * @param {Object} browser - Browser instance 
 */
function enforceFullscreenStyles(browser) {
  if (!browser || !browser.container) return;
  
  // Apply critical styles to container with more aggressive enforcement
  browser.container.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 9999 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column !important;
    transform: none !important;
    max-height: 100vh !important;
    min-height: 100vh !important;
    border: none !important;
    box-sizing: border-box !important;
    flex: 1 1 auto !important;
  `;
  
  // Fix webview container with improved dimensions
  const webviewContainer = browser.container.querySelector('.browser-webview-container');
  if (webviewContainer) {
    webviewContainer.style.cssText = `
      flex: 1 1 auto !important;
      position: relative !important;
      overflow: hidden !important;
      display: flex !important;
      width: 100% !important;
      height: calc(100vh - 52px) !important;
      min-height: calc(100vh - 52px) !important;
      max-height: calc(100vh - 52px) !important;
      margin: 0 !important;
      padding: 0 !important;
      transform: none !important;
      z-index: 1 !important;
      box-sizing: border-box !important;
      flex-grow: 1 !important;
      flex-shrink: 0 !important;
      flex-basis: auto !important;
    `;
  }
  
  // Ensure the webview element is visible with more aggressive styling
  if (browser.webview) {
    // Enforce critical styles directly on webview with more properties
    browser.webview.style.cssText = `
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 1 !important;
      width: 100% !important;
      height: 100% !important;
      position: relative !important;
      background-color: white !important;
      flex: 1 1 auto !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      min-height: 100% !important;
      max-height: 100% !important;
      transform: none !important;
      box-sizing: border-box !important;
      object-fit: contain !important;
      object-position: top left !important;
      isolation: isolate !important;
      inset: 0 !important;
    `;
    
    // Try to apply styles to webview content with enhanced selectors
    if (browser.webview.tagName.toLowerCase() === 'webview' && typeof browser.webview.executeJavaScript === 'function') {
      try {
        browser.webview.executeJavaScript(`
          // Use IIFE to prevent variable redeclaration
          (function() {
            // Check if already applied to prevent duplicate execution
            if (window._stylesEnforced) return;
            window._stylesEnforced = true;
            
            // Function to apply Google-specific fixes
            function applyGoogleFixes() {
              const isGoogle = window.location.hostname.includes('google.com');
              
              // Create or update style element
              let styleEl = document.getElementById('cognivore-browser-overrides');
              if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'cognivore-browser-overrides';
                document.head.appendChild(styleEl);
              }
              
              // Apply Google-specific CSS if on Google with enhanced selectors
              if (isGoogle) {
                styleEl.textContent = \`
                  html, body {
                    width: 100% !important;
                    height: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: auto !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    box-sizing: border-box !important;
                  }
                  /* Google Search specific fixes with enhanced selectors */
                  body, #main, #cnt, #rcnt, #center_col, .yuRUbf, .MjjYud, #rso, main, [role="main"],
                  div[role="main"], #search, #searchform, .sfbg, .minidiv, .g, .appbar, #searchform {
                    width: 100% !important;
                    min-height: 100% !important;
                    max-width: none !important;
                    box-sizing: border-box !important;
                  }
                  .g, .yuRUbf, .MjjYud, .v7W49e, .ULSxyf, .MUxGbd, .aLF0Z {
                    width: 100% !important;
                    margin-right: 0 !important;
                    padding-right: 0 !important;
                    box-sizing: border-box !important;
                  }
                  /* Force horizontal containers to proper width */
                  .s6JM6d, .s6JM6d *, .T4LgNb, .T4LgNb *, .SDkEP, .SDkEP * {
                    max-width: 100% !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                  }
                  /* Apply comprehensive fixes */
                  * {
                    max-width: 100vw !important;
                    overflow-x: hidden !important;
                  }
                \`;
                
                // Find and force Google's main containers to proper width
                const containers = [
                  document.getElementById('main'),
                  document.getElementById('cnt'),
                  document.getElementById('rcnt'),
                  document.getElementById('center_col'),
                  document.getElementById('rso'),
                  document.querySelector('[role="main"]'),
                  document.querySelector('main'),
                  document.getElementById('search'),
                  document.getElementById('searchform'),
                  document.querySelector('.sfbg'),
                  document.querySelector('.minidiv')
                ];
                
                containers.forEach(container => {
                  if (container) {
                    container.style.cssText += "width: 100% !important; max-width: none !important; min-height: 100% !important; box-sizing: border-box !important;";
                  }
                });

                // Apply broader fixes to all major elements
                document.querySelectorAll('div[role="main"], .g, .MjjYud, .v7W49e, .ULSxyf').forEach(el => {
                  el.style.cssText += "width: 100% !important; max-width: none !important; margin-right: 0 !important; padding-right: 0 !important; box-sizing: border-box !important;";
                });
              } else {
                // Generic styles for other sites with enhanced targeting
                styleEl.textContent = \`
                  html, body {
                    width: 100% !important;
                    height: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: auto !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    box-sizing: border-box !important;
                  }
                  main, [role="main"], #main, .main-content, .content, #content, article, 
                  header, footer, section, nav, aside, div[role="main"], .container, 
                  .container-fluid, .wrapper, #wrapper, #page, .page, #page-container, .site-content {
                    width: 100% !important;
                    min-height: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    margin-left: 0 !important;
                    margin-right: 0 !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                  }
                  /* Apply comprehensive fixes */
                  * {
                    max-width: 100vw !important;
                    overflow-x: hidden !important;
                  }
                \`;
              }
              
              // Apply direct styles to HTML and BODY with more aggressive fix
              document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;";
              document.body.style.cssText += "width: 100% !important; height: 100% !important; overflow: auto !important; position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;";
              
              console.log("Applied comprehensive display fixes to webview content");
            }
            
            // Run fixes immediately
            applyGoogleFixes();
            
            // Clear any existing timers
            if (window.cognivoreTimers) {
              window.cognivoreTimers.forEach(timerId => clearTimeout(timerId));
              window.cognivoreTimers = [];
            } else {
              window.cognivoreTimers = [];
            }
            
            // Set up multiple checks to ensure styles are applied even after dynamic content loads
            window.cognivoreTimers.push(setTimeout(applyGoogleFixes, 100));
            window.cognivoreTimers.push(setTimeout(applyGoogleFixes, 500));
            window.cognivoreTimers.push(setTimeout(applyGoogleFixes, 1000));
            window.cognivoreTimers.push(setTimeout(applyGoogleFixes, 2000));
            
            // Add a mutation observer to reapply styles when DOM changes
            if (!window.cognivoreObserver) {
              window.cognivoreObserver = new MutationObserver(function(mutations) {
                applyGoogleFixes();
              });
              
              window.cognivoreObserver.observe(document.body, {
                childList: true,
                subtree: true
              });
              
              console.log("Set up mutation observer for style maintenance");
            }
          })();
        `)
        .catch(err => console.warn('Site-specific style application error:', err));
      } catch (err) {
        console.warn('Error executing script for site-specific styles:', err);
      }
    }
  }
}

/**
 * Handle webview/iframe error event
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
  
  // Hide loading content
  browser.hideLoadingContent();
  
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
  updateLoadingState(browser);
  
  // Set progress to 100% to complete the progress bar
  browser.showLoadingProgress(100);
  
  // Show error page
  const url = e.validatedURL || browser.currentUrl;
  const errorMessage = e.errorDescription || 'Unknown error loading page';
  browser.showNavigationErrorPage(url, errorMessage);
}

/**
 * Render error page in content frame
 * @param {Object} browser - Browser instance
 * @param {string} errorType - Type of error
 * @param {Object} data - Error data
 */
function renderErrorInFrame(browser, errorType, data) {
  if (!browser.contentFrame) return;
  
  try {
    // Access the iframe document
    const doc = browser.contentFrame.contentDocument;
    if (doc) {
      renderErrorPage(doc, errorType, data);
    }
  } catch (error) {
    console.error('Failed to render error page:', error);
  }
}

/**
 * Handle DOM content loaded event
 * @param {Object} browser - Browser instance
 * @param {Event} e - DOMContentLoaded event
 */
export function handleDOMContentLoaded(browser, e) {
  console.log('DOM content loaded event triggered', e);
  
  // Mark document as ready
  browser.documentReady = true;
  
  // If enough content has loaded, hide the loading screen
  if (browser.documentReady && (browser.resourcesLoaded.length > 0 || Date.now() - browser.navigationStartTime > 1000)) {
    // After a small delay, hide the loading content
    setTimeout(() => {
      browser.hideLoadingContent();
    }, 500);
  }
  
  // Check if the page has a title
  const getTitle = () => {
    try {
      if (browser.webview) {
        if (browser.webview.tagName.toLowerCase() === 'webview' && typeof browser.webview.getTitle === 'function') {
          return browser.webview.getTitle();
        } else if (browser.contentFrame && browser.contentFrame.contentDocument) {
          return browser.contentFrame.contentDocument.title;
        }
      }
      return '';
    } catch (err) {
      console.error('Error getting title:', err);
      return '';
    }
  };
  
  // Get the page title
  const pageTitle = getTitle();
  console.log('Page title:', pageTitle);
  
  // Check if document has loaded successfully
  if (browser.contentFrame && browser.contentFrame.contentDocument) {
    // Apply CSS fixes for common rendering issues
    applyRenderingFixes(null, browser.contentFrame);
  }
}

/**
 * Handle resource load event
 * @param {Object} browser - Browser instance
 * @param {Event} e - Load event
 */
export function handleResourceLoad(browser, e) {
  // Track loaded resources
  if (e.target && e.target.tagName) {
    const resource = {
      type: e.target.tagName.toLowerCase(),
      src: e.target.src || e.target.href || null,
      time: new Date().getTime()
    };
    
    browser.resourcesLoaded.push(resource);
    console.log(`Resource loaded: ${resource.type} - ${resource.src}`);
  }
}

/**
 * Handle iframe messages
 * @param {Object} browser - Browser instance
 * @param {MessageEvent} event - Message event
 */
export function handleFrameMessages(browser, event) {
  // Ensure event and data exist
  if (!event || !event.data) {
    return;
  }
  
  try {
    // Log message for debugging in development
    if (event.data.type) {
      console.log(`Received frame message: ${event.data.type}`);
    }
    
    // Handle different message types
    if (event.data.type === 'webview-ready') {
      console.log('Webview is ready');
      browser.documentReady = true;
      updateLoadingState(browser);
      
      // Reset navigation timeout when webview is ready
      if (browser.navigationTimeoutId) {
        clearTimeout(browser.navigationTimeoutId);
        browser.navigationTimeoutId = null;
      }
    } 
    else if (event.data.type === 'webview-loaded') {
      console.log('Webview content loaded');
      browser.contentRendered = true;
      updateLoadingState(browser);
      
      // Force complete page loading state
      browser.isLoading = false;
      updateLoadingState(browser);
      updateLoadingProgress(browser, 100);
      
      // Clear any navigation timeouts
      if (browser.navigationTimeoutId) {
        clearTimeout(browser.navigationTimeoutId);
        browser.navigationTimeoutId = null;
      }
    }
    else if (event.data.type === 'webview-error') {
      console.error('Webview error:', event.data);
      handleWebviewError(browser, event.data);
      
      // Ensure timeouts are cleared on error
      if (browser.navigationTimeoutId) {
        clearTimeout(browser.navigationTimeoutId);
        browser.navigationTimeoutId = null;
      }
    }
    else if (event.data.type === 'webview-navigation') {
      // Handle a navigation request from the webview content
      if (event.data.url) {
        browser.navigateTo(event.data.url);
      }
    }
    else if (event.data.type === 'webview-heartbeat') {
      // Keep track of webview connection status
      browser.lastHeartbeat = Date.now();
      
      // If we're waiting for navigation to complete and receive heartbeat,
      // check if the page seems responsive
      if (browser.isLoading && Date.now() - browser.navigationStartTime > 5000) {
        // Page might be loaded but didn't trigger the proper events
        console.log('Received heartbeat while still loading, checking webview status');
        
        // Try to detect if page is actually loaded
        if (browser.webview && browser.webview.getTitle && typeof browser.webview.getTitle === 'function') {
          const title = browser.webview.getTitle();
          console.log('Webview title:', title);
          
          if (title && title !== 'Loading...') {
            console.log('Page appears to be loaded based on title, forcing loaded state');
            browser.isLoading = false;
            browser.contentRendered = true;
            updateLoadingState(browser);
            updateLoadingProgress(browser, 100);
            
            // Clear any navigation timeouts
            if (browser.navigationTimeoutId) {
              clearTimeout(browser.navigationTimeoutId);
              browser.navigationTimeoutId = null;
            }
          }
        }
      }
    }
    else if (event.data.type === 'cognivore-try-direct') {
      // Handle the user clicking the "Try Alternative Method" button on the error page
      if (event.data.url) {
        console.log('Received request to try direct navigation for:', event.data.url);
        browser.tryDirectNavigation(event.data.url);
      }
    }
    else if (event.data.type === 'webview-progress') {
      // Handle progress updates from the webview
      if (typeof event.data.progress === 'number') {
        updateLoadingProgress(browser, event.data.progress);
        
        // If progress is 100%, consider the page loaded
        if (event.data.progress >= 100) {
          console.log('Progress reached 100%, considering page loaded');
          browser.isLoading = false;
          browser.contentRendered = true;
          updateLoadingState(browser);
        }
      }
    }
    else if (event.data.type === 'webview-title-changed') {
      // Update the page title if provided
      if (event.data.title) {
        console.log('Page title changed:', event.data.title);
        browser.pageTitle = event.data.title;
        
        // If we're still loading and get a title, the page might be partially loaded
        if (browser.isLoading && event.data.title !== 'Loading...') {
          console.log('Title changed during loading, page may be partially rendered');
          // Don't mark as fully loaded yet, but update progress
          updateLoadingProgress(browser, 60);
        }
      }
    }
  } catch (error) {
    console.error('Error handling iframe message:', error);
  }
}

/**
 * Update loading state UI
 * @param {Object} browser - Browser instance
 */
export function updateLoadingState(browser) {
  const refreshButton = browser.container?.querySelector('.browser-refresh-btn');
  const stopButton = browser.container?.querySelector('.browser-stop-btn');
  
  if (refreshButton && stopButton) {
    if (browser.isLoading) {
      refreshButton.style.display = 'none';
      stopButton.style.display = 'block';
    } else {
      refreshButton.style.display = 'block';
      stopButton.style.display = 'none';
    }
  }
}

/**
 * Update navigation buttons state
 * @param {Object} browser - Browser instance
 */
export function updateNavigationButtons(browser) {
  const backButton = browser.container?.querySelector('.browser-back-btn');
  const forwardButton = browser.container?.querySelector('.browser-forward-btn');
  
  if (backButton) {
    backButton.disabled = browser.historyIndex <= 0;
  }
  
  if (forwardButton) {
    forwardButton.disabled = browser.historyIndex >= browser.history.length - 1;
  }
}

/**
 * Update loading progress indicator
 * @param {Object} browser - Browser instance
 * @param {number} percent - Loading progress percentage (0-100)
 */
export function updateLoadingProgress(browser, percent) {
  const progressBar = browser.container?.querySelector('.browser-progress-bar');
  if (!progressBar) return;
  
  // Update progress bar
  progressBar.style.width = `${percent}%`;
  
  // Show progress bar if not already visible
  if (percent > 0 && percent < 100) {
    progressBar.style.display = 'block';
    progressBar.style.opacity = '1';
  } else if (percent >= 100) {
    // Fade out progress bar when complete
    progressBar.style.opacity = '0';
    setTimeout(() => {
      progressBar.style.display = 'none';
    }, 300); // Match transition duration
  }
}

/**
 * Check if the page is actually loaded even if events didn't fire
 * This is a fallback for when navigation events don't fire properly
 * @param {Object} browser - Browser instance
 */
export function checkIfPageIsLoaded(browser) {
  if (!browser.webview) return;
  
  console.log('Checking if page is actually loaded despite missing events');
  
  // For Electron webview
  if (browser.webview.tagName.toLowerCase() === 'webview') {
    try {
      // Try to use executeJavaScript to check readyState
      if (typeof browser.webview.executeJavaScript === 'function') {
        browser.webview.executeJavaScript(`
          (function() {
            // Apply crucial styling first to ensure proper display while checking
            document.documentElement.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
            if (document.body) { 
              document.body.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
              
              // Add a style tag with !important rules to ensure they're applied
              if (!document.getElementById('cognivore-essential-fix')) {
                const style = document.createElement('style');
                style.id = 'cognivore-essential-fix';
                style.textContent = 'html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow-x: hidden !important; overflow-y: auto !important; }';
                document.head.appendChild(style);
              }
            }
            
            // Return true if page appears to be loaded
            return document.readyState === 'complete' || document.readyState === 'interactive';
          })();
        `)
        .then((isReady) => {
          if (isReady) {
            console.log('Page appears to be loaded based on readyState check');
            
            // Apply comprehensive styling immediately
            if (typeof browser.webview.applyAllCriticalStyles === 'function') {
              browser.webview.applyAllCriticalStyles(true);
            } else {
              // Apply full styling immediately as fallback
              browser.webview.executeJavaScript(`
                (function() {
                  // Apply comprehensive styles
                  document.documentElement.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                  document.body.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
                  
                  // Force fix in case default styles haven't been applied yet
                  const style = document.createElement('style');
                  style.textContent = "html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow-x: hidden !important; overflow-y: auto !important; }";
                  document.head.appendChild(style);
                  
                  // Apply Google-specific fixes if on Google
                  if (window.location.hostname.includes('google.com')) {
                    const mainElements = document.querySelectorAll('#main, #cnt, #rcnt, #center_col, #rso');
                    mainElements.forEach(el => {
                      if (el) {
                        el.style.cssText += "width: 100% !important; max-width: 100% !important; margin: 0 auto !important; box-sizing: border-box !important;";
                      }
                    });
                    
                    // Fix any search results container
                    const searchContainer = document.querySelector('#center_col, #rso, #search');
                    if (searchContainer) {
                      searchContainer.style.cssText += "width: 100% !important; max-width: 900px !important; margin: 0 auto !important;";
                    }
                  }
                  
                  return true;
                })();
              `).catch(() => {});
            }
            
            // Update state and hide loading immediately
            browser.isLoading = false;
            updateLoadingState(browser, false);
            
            // Mark webview as ready to show
            if (typeof browser.webview.readyToShow === 'undefined') {
              browser.webview.readyToShow = true;
            } else {
              browser.webview.readyToShow = true;
            }
            
            // Make webview visible with crucial styling
            browser.webview.style.visibility = 'visible';
            browser.webview.style.opacity = '1';
            
            // Hide loading content without delay
            if (typeof browser.hideLoadingContent === 'function') {
              browser.hideLoadingContent();
            }
          }
        }).catch(err => {
          console.warn('Error checking readyState:', err);
        });
      }
      
      // Get the current URL to check if navigation happened as a fallback
      if (typeof browser.webview.getURL === 'function') {
        const currentURL = browser.webview.getURL();
        
        // If URL changed, consider it loaded
        if (currentURL && currentURL !== 'about:blank' && currentURL !== browser.currentUrl) {
          console.log('Page appears to be loaded based on URL change:', currentURL);
          browser.currentUrl = currentURL;
          browser.isLoading = false;
          updateLoadingState(browser, false);
          
          // Mark as ready
          if (typeof browser.webview.readyToShow === 'undefined') {
            browser.webview.readyToShow = true;
          } else {
            browser.webview.readyToShow = true;
          }
          
          // Apply immediate styling
          if (typeof browser.enforceWebviewStyles === 'function') {
            browser.enforceWebviewStyles(true);
          }
          
          // Ensure webview is visible
          browser.webview.style.visibility = 'visible';
          browser.webview.style.opacity = '1';
          
          // Hide loading content
          if (typeof browser.hideLoadingContent === 'function') {
            browser.hideLoadingContent();
          }
        }
      }
    } catch (err) {
      console.warn('Error checking if page is loaded:', err);
    }
  } else {
    // For iframe fallback
    try {
      const contentWindow = browser.webview.contentWindow;
      if (contentWindow && contentWindow.document) {
        const readyState = contentWindow.document.readyState;
        
        if (readyState === 'complete' || readyState === 'interactive') {
          console.log('Page appears to be loaded based on iframe readyState:', readyState);
          browser.isLoading = false;
          updateLoadingState(browser, false);
          
          if (typeof browser.webview.readyToShow === 'undefined') {
            browser.webview.readyToShow = true;
          } else {
            browser.webview.readyToShow = true;
          }
          
          // Hide loading content
          if (typeof browser.hideLoadingContent === 'function') {
            browser.hideLoadingContent();
          }
        }
      }
    } catch (err) {
      // Security errors are expected for cross-origin iframes
      console.warn('Error checking iframe loaded state (likely due to cross-origin restrictions)');
    }
  }
}

/**
 * Handle load stop event for webview
 * @param {Object} browser - Browser instance
 * @param {Event} e - Event
 */
export function handleLoadStop(browser, e) {
  console.log('Webview stopped loading - applying final styles and marking ready');
  
  // Mark as not loading
  browser.isLoading = false;
  updateLoadingState(browser);
  
  // Set progress to 100% to complete the progress bar
  if (typeof browser.showLoadingProgress === 'function') {
    browser.showLoadingProgress(100);
  } else {
    updateLoadingProgress(browser, 100);
  }
  
  // Apply styles one final time to ensure everything is perfect
  if (browser.webview && typeof browser.webview.applyAllCriticalStyles === 'function') {
    browser.webview.applyAllCriticalStyles(true);
  }
  
  // Make fully visible with a slight delay to allow styles to take effect
  if (browser.webview) {
    browser.webview.style.visibility = 'visible';
    browser.webview.style.opacity = '1';
    
    if (typeof browser.webview.readyToShow !== 'undefined') {
      browser.webview.readyToShow = true;
    }
  }
  
  // Hide loading content after a small delay to ensure webview is visible
  setTimeout(() => {
    if (typeof browser.hideLoadingContent === 'function') {
      browser.hideLoadingContent();
    }
  }, 50);
}

/**
 * Handle page navigation event for webview
 * @param {Object} browser - Browser instance
 * @param {Event} e - Event
 */
export function handlePageNavigation(browser, e) {
  if (!e || !e.url) return;
  
  console.log('Page navigated to:', e.url);
  
  // Update current URL
  browser.currentUrl = e.url;
  
  // Update address bar
  if (browser.searchInput) {
    browser.searchInput.value = e.url;
  }
  
  // Add to history if this is a new navigation and history is properly initialized
  if (Array.isArray(browser.history) && typeof browser.historyIndex === 'number') {
    // Check if this is a new URL compared to current history position
    const currentHistoryUrl = browser.historyIndex >= 0 && browser.historyIndex < browser.history.length 
      ? browser.history[browser.historyIndex] 
      : null;
      
    if (currentHistoryUrl !== e.url) {
      // Remove forward history if navigating from middle of history
      if (browser.historyIndex < browser.history.length - 1) {
        browser.history = browser.history.slice(0, browser.historyIndex + 1);
      }
      
      // Add new URL to history
      browser.history.push(e.url);
      browser.historyIndex = browser.history.length - 1;
      
      // Update navigation buttons
      updateNavigationButtons(browser);
    }
  } else {
    // Initialize history if it doesn't exist
    browser.history = browser.history || [];
    browser.historyIndex = browser.historyIndex || 0;
    
    // Add URL to fresh history
    browser.history.push(e.url);
    browser.historyIndex = 0;
  }
  
  // Apply site-specific settings based on the new URL
  if (typeof browser.applySiteSpecificSettings === 'function') {
    browser.applySiteSpecificSettings(e.url);
  }
}

export default {
  handleWebviewLoad,
  handleWebviewError,
  handleDOMContentLoaded,
  handleResourceLoad,
  handleFrameMessages,
  updateLoadingState,
  updateNavigationButtons,
  updateLoadingProgress,
  checkIfPageIsLoaded,
  handleLoadStop,
  handlePageNavigation
}; 