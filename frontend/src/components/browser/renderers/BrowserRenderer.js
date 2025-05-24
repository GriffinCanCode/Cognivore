/**
 * BrowserRenderer - Core webview management for the browser
 * 
 * SIMPLIFIED VERSION - WebviewInitializer.js now handles all webview creation and events
 * This file is kept for legacy compatibility but most functionality moved to specialized renderers
 * 
 * @deprecated Many functions in this file have been moved to specialized renderers:
 * - Webview creation -> WebviewInitializer.js  
 * - Address bar functionality -> AddressBarRenderer.js
 * - Navigation controls -> NavigationControlsRenderer.js  
 * - Action buttons -> ActionButtonsRenderer.js
 * - Content rendering -> ContentRenderer.js
 * - Layout coordination -> BrowserLayoutManager.js
 */
import { createBrowserPlaceholder } from './ContentRenderer.js';
import { updateAddressBar as updateAddressBarRenderer } from './AddressBarRenderer.js';
import { updateLoadingControls } from './NavigationControlsRenderer.js';

/**
 * @deprecated Use WebviewInitializer.createWebview() instead
 * This function is kept for legacy compatibility only
 */
export function createWebviewElement(browser, implementation = 'webview', sandboxLevel = 'full') {
  console.warn('BrowserRenderer.createWebviewElement is deprecated. Use WebviewInitializer.createWebview() instead.');
  
  // Delegate to WebviewInitializer for unified webview creation
  try {
    const WebviewInitializer = require('../handlers/WebviewInitializer');
    if (WebviewInitializer && typeof WebviewInitializer.default?.createWebview === 'function') {
      return WebviewInitializer.default.createWebview(browser);
    }
  } catch (err) {
    console.error('Error delegating to WebviewInitializer:', err);
  }
  
  return null;
}

/**
 * @deprecated Use WebviewInitializer.createWebview() instead
 * This function is kept for legacy compatibility only
 */
export function createWebview(browser, implementation, sandboxLevel) {
  console.warn('BrowserRenderer.createWebview is deprecated. Use WebviewInitializer.createWebview() instead.');
  
  // Delegate to WebviewInitializer
  try {
    const WebviewInitializer = require('../handlers/WebviewInitializer');
    if (WebviewInitializer && typeof WebviewInitializer.default?.createWebview === 'function') {
      const webview = WebviewInitializer.default.createWebview(browser);
      
      if (webview) {
        // Return both container and webview for legacy compatibility
        const container = webview.parentNode || browser.containerRef?.current;
        return { container, webview };
      }
    }
  } catch (err) {
    console.error('Error delegating to WebviewInitializer:', err);
  }
  
  return { container: null, webview: null };
}

/**
 * @deprecated Use a dedicated progress component or NavigationControlsRenderer instead
 * This function will be removed in a future version
 */
export function createProgressBar() {
  console.warn('createProgressBar is deprecated. Use NavigationControlsRenderer or a dedicated progress component instead.');
  
  const progressContainer = document.createElement('div');
  progressContainer.className = 'browser-progress-container';
  progressContainer.style.cssText = `
    width: 100%;
    height: 3px;
    background-color: var(--progress-bg-color, #e2e8f0);
    position: relative;
    overflow: hidden;
    display: none;
  `;
  
  const progressBar = document.createElement('div');
  progressBar.className = 'browser-progress-bar';
  progressBar.style.cssText = `
    height: 100%;
    background-color: var(--progress-color, #3b82f6);
    width: 0%;
    transition: width 0.3s ease;
  `;
  
  progressContainer.appendChild(progressBar);
  
  return progressContainer;
}

/**
 * @deprecated Use ContentRenderer.showLoadingContent() instead
 * This function will be removed in a future version
 */
export function showLoadingContent(browser, url) {
  console.warn('showLoadingContent is deprecated. Use ContentRenderer.showLoadingContent() instead.');
  return createBrowserPlaceholder(browser);
}

/**
 * @deprecated Use ContentRenderer.hideLoadingContent() instead  
 * This function will be removed in a future version
 */
export function hideLoadingContent(browser) {
  console.warn('hideLoadingContent is deprecated. Use ContentRenderer.hideLoadingContent() instead.');
  // Basic hide functionality
  if (browser.loadingContent) {
    browser.loadingContent.style.display = 'none';
  }
}

/**
 * @deprecated Webview styling is now handled by WebviewInitializer.js
 * This function is kept for legacy compatibility but does minimal work
 */
export function enforceWebviewStyles(browser, forcedApply = false) {
  console.warn('BrowserRenderer.enforceWebviewStyles is deprecated. Styling is handled by WebviewInitializer.');
  
  if (!browser || !browser.webview) {
    console.warn('Cannot enforce webview styles - missing browser or webview');
    return;
  }
  
  try {
    // Apply only essential visibility styles as fallback
    browser.webview.style.visibility = 'visible';
    browser.webview.style.opacity = '1';
    browser.webview.style.display = 'block';
    
    // Mark webview as ready to show
    browser.webview.readyToShow = true;
    
    console.log('Applied minimal fallback webview styles');
  } catch (err) {
    console.error('Error applying fallback webview styles:', err);
  }
}

/**
 * @deprecated Use BrowserLayoutManager for layout concerns and specialized renderers for UI updates
 * Address bar updates should use AddressBarRenderer.updateAddressBar() directly
 */
export function updateAddressBar(browser, url) {
  console.warn('BrowserRenderer.updateAddressBar is deprecated. Use AddressBarRenderer.updateAddressBar() directly.');
  // Delegate to the specialized AddressBarRenderer
  return updateAddressBarRenderer(browser, url);
}

/**
 * @deprecated Use NavigationControlsRenderer.updateLoadingControls() directly
 * Progress bar functionality should be handled by a dedicated progress component
 */
export function updateLoadingIndicator(browser, isLoading) {
  console.warn('BrowserRenderer.updateLoadingIndicator is deprecated. Use NavigationControlsRenderer.updateLoadingControls() and a dedicated progress component.');
  
  // Delegate to the specialized NavigationControlsRenderer for button updates
  updateLoadingControls(browser, isLoading);

  // Minimal progress bar updates for backward compatibility
  const progressBar = browser.progressBar || 
                     browser.container?.querySelector('.browser-progress-bar');
  
  if (progressBar) {
    if (isLoading) {
      progressBar.style.display = 'block';
      progressBar.style.width = '80%';
    } else {
      progressBar.style.width = '100%';
      setTimeout(() => {
        if (progressBar.isConnected) {
          progressBar.style.display = 'none';
          progressBar.style.width = '0%';
        }
      }, 300);
    }
  }
}

/**
 * @deprecated Use a dedicated title management component or handle in Voyager.js directly
 * This function will be removed in a future version
 */
export function updatePageTitle(browser, title) {
  console.warn('BrowserRenderer.updatePageTitle is deprecated. Handle title updates in Voyager.js or a dedicated title component.');
  
  if (!browser) {
    console.error('Cannot update page title - browser instance is missing');
    return;
  }
  
  // Basic title update functionality for backward compatibility
  if (browser.setState && typeof browser.setState === 'function') {
    browser.setState({ title });
  }
  
  // Update document title if needed
  if (browser.props && browser.props.updateDocumentTitle && title) {
    document.title = title;
  }
}

// Export only minimal compatibility functions
export default {
  createWebviewElement, // Legacy compatibility - delegates to WebviewInitializer
  createWebview,        // Legacy compatibility - delegates to WebviewInitializer
  enforceWebviewStyles, // Legacy compatibility - minimal fallback only
}; 