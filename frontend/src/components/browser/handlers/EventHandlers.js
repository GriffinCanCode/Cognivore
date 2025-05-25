/**
 * EventHandlers - Event handlers for browser component
 */
import { renderErrorPage, handleWebviewError as handleWebviewErrorCentral, showNavigationErrorPage } from './ErrorHandler.js';
import { applyRenderingFixes } from '../utils/ContentUtils.js';
import * as HistoryService from './HistoryService.js';
import { clearNavigationTimeout } from './NavigationService.js';

/**
 * Handle webview/iframe load event
 * @param {Object} browser - Browser instance
 * @param {Event} e - Load event
 */
export function handleWebviewLoad(browser, e) {
  // CRITICAL FIX: Get the actual URL from the webview first
  let currentUrl = null;
  let currentTitle = null;
  
  // Extract URL and title from webview
  if (browser.webview && browser.webview.tagName && 
      browser.webview.tagName.toLowerCase() === 'webview' && 
      typeof browser.webview.getURL === 'function') {
    try {
      currentUrl = browser.webview.getURL();
      
      // Also try to get the title
      if (typeof browser.webview.getTitle === 'function') {
        currentTitle = browser.webview.getTitle();
      }
      
      // Get title from webContents if available
      if (!currentTitle && browser.webview.getWebContents && typeof browser.webview.getWebContents === 'function') {
        try {
          const webContents = browser.webview.getWebContents();
          if (webContents && typeof webContents.getTitle === 'function') {
            currentTitle = webContents.getTitle();
          }
        } catch (titleError) {
          console.warn('Error getting title from webContents:', titleError);
        }
      }
      
      console.log('Webview loaded successfully:', currentUrl, 'Title:', currentTitle);
      
      // CRITICAL FIX: Update browser state with the actual URL and title
      if (currentUrl && currentUrl !== 'about:blank') {
        browser.setState({ 
          url: currentUrl, 
          title: currentTitle || currentUrl,
          isLoading: false 
        });
        
        // Update current URL tracking
        browser.currentUrl = currentUrl;
        
        // Update address bar if it exists
        if (browser.searchInput) {
          browser.searchInput.value = currentUrl;
        }
        
        // CRITICAL FIX: Emit navigation event to tab manager with proper URL and title
        if (browser.tabManager && !browser.tabManager.isSwitchingTabs) {
          console.log('Emitting webview load navigation event to tab manager:', currentUrl, currentTitle);
          browser.tabManager.emitEvent('navigation', {
            url: currentUrl,
            title: currentTitle || currentUrl,
            source: 'webview_load'
          });
        }
      }
    } catch (err) {
      console.warn('Error getting URL/title from webview:', err);
      console.log('Webview loaded successfully: (URL extraction failed)');
    }
  } else {
    console.log('Webview loaded successfully: (no webview URL method available)');
  }
  
  // CRITICAL FIX: Clear navigation timeout to prevent timeout message
  clearNavigationTimeout(browser, 'handleWebviewLoad');
  
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
  
  // Apply critical styles to webview and container for immediate visibility
  setTimeout(() => {
    if (browser.webview && browser.webview.isConnected) {
      // Simple visibility check - WebviewInitializer handles comprehensive styling
      if (browser.webview.style.visibility !== 'visible') {
        browser.webview.style.visibility = 'visible';
        browser.webview.style.opacity = '1';
      }
    }
  }, 200);
  
  // First apply critical styles before hiding loading content
  enforceFullscreenStyles(browser);

  // Apply specialized fixes for Google with enhanced reliability
  if (browser.webview && 
      currentUrl && 
      currentUrl.includes('google.com') && 
      typeof browser.webview.executeJavaScript === 'function') {
    try {
      // First ensure webview is fully visible regardless of load state
      browser.webview.style.visibility = 'visible';
      browser.webview.style.opacity = '1';
      browser.webview.style.display = 'flex';
      browser.webview.style.zIndex = '10';
      
      // Force a layout recalculation to ensure styles are applied
      void browser.webview.offsetHeight;
      
      // Apply critical visibility styles as a backup method
      if (typeof browser.webview.applyAllCriticalStyles === 'function') {
        browser.webview.applyAllCriticalStyles(true);
      }
      
      // Apply MINIMAL Google fixes that don't break layout
      browser.webview.executeJavaScript(`
        (function() {
          // Apply minimal Google-specific fixes - non-intrusive
          let style = document.getElementById('cognivore-google-fixes');
          if (!style) {
            style = document.createElement('style');
            style.id = 'cognivore-google-fixes';
            style.textContent = \`
              /* Only apply basic margin/padding fixes - let Google handle its own layout */
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
              }
              
              /* Remove any forced positioning that breaks Google's layout */
              html, body {
                position: static !important;
              }
              
              /* Ensure no horizontal scrollbars */
              body {
                overflow-x: hidden !important;
              }
            \`;
            document.head.appendChild(style);
            console.log("Applied minimal Google fixes that preserve layout");
          }
          
          return true;
        })()
      `).catch(err => console.warn('Could not apply minimal Google fixes:', err));
      
    } catch (err) {
      console.warn('Error applying minimal Google fixes:', err);
    }
  }
  
  // Then hide loading content with a delay to ensure webview is ready
  setTimeout(() => {
    // Check if hideLoadingContent exists before calling it
    if (typeof browser.hideLoadingContent === 'function') {
      browser.hideLoadingContent();
    }
    
    // Apply styles again after hiding loading content
    enforceFullscreenStyles(browser);
    
    // Ensure webview is visible with direct style enforcement
    if (browser.webview) {
      try {
        // Simple visibility check - WebviewInitializer handles comprehensive styling
        if (browser.webview.style.visibility !== 'visible') {
          browser.webview.style.visibility = 'visible';
          browser.webview.style.opacity = '1';
        }
      } catch (err) {
        console.warn('Error checking webview visibility:', err);
      }
    }
  }, 200);
  
  // If research mode is enabled, extract content
  if (browser.researchMode) {
    browser.extractPageContent();
  }
  
  // CRITICAL FIX: Add content capture for tab analysis
  // This ensures that tab content is captured for analysis even when not in research mode
  if (browser.capturePageContent && typeof browser.capturePageContent === 'function') {
    console.log('🎯 Starting content capture for tab analysis');
    browser.capturePageContent().then(content => {
      console.log('🎯 Content captured successfully:', {
        hasContent: !!content,
        hasTabManager: !!browser.tabManager,
        contentKeys: content ? Object.keys(content) : [],
        url: content?.url || 'unknown'
      });
      
      if (browser.tabManager && content) {
        console.log('📡 Emitting contentCaptured event to tab manager');
        browser.tabManager.emitEvent('contentCaptured', content);
        console.log('✅ contentCaptured event emitted successfully');
      } else {
        console.warn('❌ Cannot emit contentCaptured event:', {
          hasTabManager: !!browser.tabManager,
          hasContent: !!content
        });
      }
    }).catch(err => {
      console.warn('❌ Error in capturePageContent during load:', err);
    });
  } else {
    console.warn('⚠️ capturePageContent method not available on browser instance');
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
 * Apply fullscreen styles to ensure the browser takes up the full viewport
 * @param {Object} browser - Browser instance 
 */
export function enforceFullscreenStyles(browser) {
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
          (function() {
            // Check if already applied to prevent duplicate execution
            if (window._stylesEnforced) return;
            window._stylesEnforced = true;
            
            // Function to apply minimal, non-intrusive fixes
            function applyMinimalFixes() {
              const isGoogle = window.location.hostname.includes('google.com');
              
              // Create or update style element
              let styleEl = document.getElementById('cognivore-browser-overrides');
              if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'cognivore-browser-overrides';
                document.head.appendChild(styleEl);
              }
              
              // Apply minimal CSS that doesn't break layouts
              if (isGoogle) {
                styleEl.textContent = \`
                  /* Minimal Google fixes - preserve Google's layout */
                  html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box !important;
                  }
                  
                  /* Only fix overflow issues, don't force positioning */
                  body {
                    overflow-x: hidden !important;
                  }
                \`;
              } else {
                // Minimal generic styles for other sites
                styleEl.textContent = \`
                  html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box !important;
                    overflow-x: hidden !important;
                  }
                \`;
              }
              
              // Apply minimal direct styles without breaking positioning
              document.documentElement.style.cssText += "margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;";
              document.body.style.cssText += "margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; overflow-x: hidden !important;";
              
              console.log("Applied minimal display fixes that preserve layout");
            }
            
            // Run fixes immediately
            applyMinimalFixes();
            
            // Set up a single check to ensure styles are maintained
            setTimeout(applyMinimalFixes, 1000);
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
  // Use the centralized error handler
  return handleWebviewErrorCentral(browser, e);
}

/**
 * Render error in content frame
 * @param {Object} browser - Browser instance
 * @param {string} errorType - Type of error
 * @param {Object} data - Error data
 */
function renderErrorInFrame(browser, errorType, data) {
  // Use the centralized handler
  return renderErrorPage(browser, errorType, data);
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
      
      // Clear navigation timeout when webview is ready
      clearNavigationTimeout(browser, 'webview-ready message');
    } 
    else if (event.data.type === 'webview-loaded') {
      console.log('Webview content loaded');
      browser.contentRendered = true;
      updateLoadingState(browser);
      
      // Force complete page loading state
      browser.isLoading = false;
      updateLoadingState(browser);
      updateLoadingProgress(browser, 100);
      
      // Clear navigation timeout when content is loaded
      clearNavigationTimeout(browser, 'webview-loaded message');
    }
    else if (event.data.type === 'webview-error') {
      console.error('Webview error:', event.data);
      handleWebviewErrorCentral(browser, event.data);
      
      // Clear navigation timeout on error
      clearNavigationTimeout(browser, 'webview-error message');
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
            
            // Clear navigation timeout when page appears loaded
            clearNavigationTimeout(browser, 'webview-heartbeat detection');
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
 * Handle back button action
 * @param {Object} browser - Browser instance
 */
export function handleBackAction(browser) {
  // Use centralized HistoryService instead of direct webview manipulation
  HistoryService.goBack(browser);
  updateNavigationButtons(browser);
}

/**
 * Handle forward button action
 * @param {Object} browser - Browser instance
 */
export function handleForwardAction(browser) {
  // Use centralized HistoryService instead of direct webview manipulation
  HistoryService.goForward(browser);
  updateNavigationButtons(browser);
}

/**
 * Update navigation buttons state
 * @param {Object} browser - Browser instance
 */
export function updateNavigationButtons(browser) {
  const backButton = browser.container?.querySelector('.browser-back-btn');
  const forwardButton = browser.container?.querySelector('.browser-forward-btn');
  
  if (!browser || !browser.webview) return;
  
  // Get canGoBack/canGoForward from HistoryService
  const canGoBack = HistoryService.canGoBack(browser);
  const canGoForward = HistoryService.canGoForward(browser);
  
  if (backButton) {
    backButton.disabled = !canGoBack;
  }
  
  if (forwardButton) {
    forwardButton.disabled = !canGoForward;
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
            // Apply minimal styling first to ensure proper display while checking
            document.documentElement.style.cssText = "margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; overflow-x: hidden !important;";
            if (document.body) { 
              document.body.style.cssText = "margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; overflow-x: hidden !important;";
              
              // Add minimal style tag with !important rules
              if (!document.getElementById('cognivore-essential-fix')) {
                const style = document.createElement('style');
                style.id = 'cognivore-essential-fix';
                style.textContent = 'html, body { margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; overflow-x: hidden !important; }';
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
            
            // Apply full styling immediately as fallback
            browser.webview.executeJavaScript(`
              (function() {
                // Apply minimal styles that don't break layout
                document.documentElement.style.cssText = "margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; overflow-x: hidden !important;";
                document.body.style.cssText = "margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; overflow-x: hidden !important;";
                
                // Add minimal style tag
                const style = document.createElement('style');
                style.textContent = "html, body { margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; overflow-x: hidden !important; }";
                document.head.appendChild(style);
                
                // Skip Google-specific fixes to preserve layout
                console.log("Applied minimal styling that preserves site layout");
                
                return true;
              })();
            `).catch(() => {});
            
            // Update state and hide loading immediately
            browser.isLoading = false;
            updateLoadingState(browser);
            
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
  
  // CRITICAL FIX: Clear navigation timeout to prevent timeout message
  clearNavigationTimeout(browser, 'handleLoadStop');
  
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
  
  // Update address bar - look for both searchInput and addressInput
  // searchInput is the old property name, addressInput is the new one
  if (browser.searchInput) {
    browser.searchInput.value = e.url;
  }
  
  // Directly check for addressInput in case the property name has changed
  const addressInput = browser.addressInput || 
                      browser.container?.querySelector('.voyager-address-bar');
  if (addressInput) {
    addressInput.value = e.url;
    console.log('Updated address bar input with new URL:', e.url);
  }
  
  // Update UI state if it exists
  if (browser.setState) {
    browser.setState({ url: e.url });
  }
  
  // Record the visit using HistoryService
  HistoryService.recordVisit(browser, e.url, browser.pageTitle || '');
  
  // Update navigation buttons
  updateNavigationButtons(browser);
  
  // Apply site-specific settings based on the new URL
  if (typeof browser.applySiteSpecificSettings === 'function') {
    browser.applySiteSpecificSettings(e.url);
  }
}

/**
 * Centralized handler for successful page load events
 * This function should be called whenever a page successfully loads to ensure
 * consistent timeout clearing and state updates across the codebase
 * @param {Object} browser - Browser instance
 * @param {string} source - Source of the load event (for logging)
 * @param {Object} options - Optional configuration
 */
export function handleSuccessfulPageLoad(browser, source = 'unknown', options = {}) {
  console.log(`🎉 Page successfully loaded - source: ${source}`);
  
  // CRITICAL: Clear all navigation timeouts and intervals
  clearNavigationTimeout(browser, `successful load from ${source}`);
  
  // Update loading state
  browser.isLoading = false;
  browser.contentRendered = true;
  updateLoadingState(browser);
  
  // Complete progress bar
  if (typeof browser.showLoadingProgress === 'function') {
    browser.showLoadingProgress(100);
  } else {
    updateLoadingProgress(browser, 100);
  }
  
  // Apply final styles if requested
  if (options.applyStyles !== false) {
    enforceFullscreenStyles(browser);
  }
  
  // Hide loading content with optional delay
  const hideDelay = options.hideDelay || 200;
  setTimeout(() => {
    if (typeof browser.hideLoadingContent === 'function') {
      browser.hideLoadingContent();
    }
  }, hideDelay);
  
  // Update browser state if available
  if (browser.setState && options.updateState !== false) {
    browser.setState({ isLoading: false, error: null });
  }
  
  return true;
}

/**
 * Centralized handler for page load errors
 * This function should be called whenever a page fails to load
 * @param {Object} browser - Browser instance
 * @param {string} source - Source of the error (for logging)
 * @param {Object} errorData - Error details
 */
export function handlePageLoadError(browser, source = 'unknown', errorData = {}) {
  console.log(`❌ Page load error - source: ${source}`, errorData);
  
  // CRITICAL: Clear all navigation timeouts and intervals
  clearNavigationTimeout(browser, `error from ${source}`);
  
  // Update loading state
  browser.isLoading = false;
  updateLoadingState(browser);
  
  // Use centralized error handler
  if (errorData.code || errorData.message) {
    handleWebviewErrorCentral(browser, errorData);
  }
  
  return false;
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
  handlePageNavigation,
  handleSuccessfulPageLoad,
  handlePageLoadError
}; 