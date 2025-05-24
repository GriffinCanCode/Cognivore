/**
 * WebviewInitializer - SINGLE SOURCE OF TRUTH for webview creation
 * 
 * Handles webview element creation, event binding, and initial configuration.
 * This is the ONLY place where webview creation should happen to prevent conflicts.
 */

import logger from '../../../utils/logger';
import StyleManager from './StyleManager';
import { handleWebviewLoad } from './EventHandlers';
import { handlePageLoadError, handleCertificateError } from './ErrorHandler';

// Create a logger instance
const webviewLogger = logger.scope('WebviewInitializer');

/**
 * UNIFIED webview creation - the ONLY method that should create webviews
 * @param {Object} browser - Browser component instance
 * @returns {HTMLElement} Created and fully configured webview element
 */
function createWebview(browser) {
  if (!browser) {
    webviewLogger.error('Cannot create webview: browser object is missing');
    return null;
  }
  
  try {
    // Get the container element
    const container = browser.containerRef?.current?.querySelector('.browser-webview-container') ||
                     browser.containerRef?.current?.querySelector('.browser-content') ||
                     browser.containerRef?.current;
    
    if (!container || !container.isConnected) {
      webviewLogger.error('Cannot create webview: container not available or not connected to DOM');
      return null;
    }
    
    webviewLogger.debug('Creating webview element with unified approach');
    
    // Create the webview element
    const webview = document.createElement('webview');
    
    // Generate unique ID and partition
    const uniqueId = `webview-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const partition = `persist:voyager-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    // Set essential attributes in specific order to prevent conflicts
    webview.id = uniqueId;
    webview.setAttribute('partition', partition);
    webview.setAttribute('webpreferences', 'contextIsolation=yes, javascript=yes, webSecurity=no');
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('disablewebsecurity', 'true');
    webview.setAttribute('autosize', 'false');
    
    // Apply COMPREHENSIVE styles via StyleManager - SINGLE SOURCE OF TRUTH
    webviewLogger.debug('Applying comprehensive styles via StyleManager');
    StyleManager.applyInitialStyles(webview);
    
    // Set readiness flags
    webview.isReady = false;
    webview.readyToShow = true;
    
    // UNIFIED event handlers - bind ALL events here to prevent duplication
    bindAllWebviewEvents(browser, webview);
    
    // Add enhanced methods to webview instance
    addWebviewMethods(browser, webview);
    
    // Clear container and append webview
    container.innerHTML = '';
    container.appendChild(webview);
    
    // Verify DOM attachment
    if (webview.isConnected || document.contains(webview)) {
      webview.isAttached = true;
      webview._isAttached = true;
      
      // Force layout recalculation
      void webview.offsetHeight;
      
      // Apply comprehensive styling immediately after attachment
      StyleManager.applyWebviewStyles(browser, webview, true);
      
      // Schedule style maintenance checks
      StyleManager.scheduleStyleChecks(browser, webview);
      
      webviewLogger.debug('Webview created and attached successfully:', uniqueId);
      
      // Set up visibility timeout as safety measure
      setTimeout(() => {
        if (webview && webview.isConnected) {
          // Use StyleManager for safe visibility application
          StyleManager.safeApplyStyles(webview, true);
          webview.readyToShow = true;
        }
      }, 1000);
      
      return webview;
    } else {
      webviewLogger.error('Webview attachment failed');
      return null;
    }
  } catch (error) {
    webviewLogger.error('Error creating webview:', error);
    return null;
  }
}

/**
 * Bind ALL webview events in one place to prevent duplication
 * @param {Object} browser - Browser component instance
 * @param {HTMLElement} webview - Webview element
 */
function bindAllWebviewEvents(browser, webview) {
  if (!browser || !webview) return;
  
  try {
    webviewLogger.debug('Binding unified event handlers');
    
    // Navigation timeout clearing - SINGLE source of truth
    const clearNavigationTimeout = () => {
      if (browser._navigationTimeout) {
        clearTimeout(browser._navigationTimeout);
        browser._navigationTimeout = null;
        webviewLogger.debug('Navigation timeout cleared');
      }
      if (browser._handlingNavigationTimeout) {
        browser._handlingNavigationTimeout = false;
      }
    };
    
    // UNIFIED load events
    webview.addEventListener('did-start-loading', () => {
      webviewLogger.debug('Webview started loading');
      webview.setAttribute('data-loading', 'true');
      // Use StyleManager for comprehensive visibility
      StyleManager.safeApplyStyles(webview, true);
    });
    
    webview.addEventListener('did-stop-loading', () => {
      webviewLogger.debug('Webview stopped loading');
      webview.setAttribute('data-loading', 'false');
      webview.setAttribute('data-load-finished', 'true');
      webview.isReady = true;
      
      // Clear timeouts and call load handler
      clearNavigationTimeout();
      
      // Apply load complete styling via StyleManager
      StyleManager.applyLoadCompleteStyling(webview);
      
      handleWebviewLoad(browser);
    });
    
    webview.addEventListener('did-finish-load', () => {
      webviewLogger.debug('Webview finished loading');
      webview.isReady = true;
      webview.setAttribute('data-load-finished', 'true');
      
      // Clear timeouts and ensure comprehensive styling
      clearNavigationTimeout();
      StyleManager.applyWebviewStyles(browser, webview, true);
      
      // Apply site-specific fixes if needed
      applySiteSpecificFixes(browser, webview);
    });
    
    // DOM ready event
    webview.addEventListener('dom-ready', () => {
      webviewLogger.debug('Webview DOM ready');
      webview.setAttribute('data-ready', 'true');
      webview.isReady = true;
      
      // Clear timeouts and apply essential styling
      clearNavigationTimeout();
      StyleManager.applyEssentialStyles(webview);
      
      // Apply critical styles via JavaScript
      applyCriticalContentStyles(webview);
    });
    
    // Navigation events
    webview.addEventListener('did-navigate', (event) => {
      webviewLogger.debug('Webview navigated to:', event.url);
      webview.setAttribute('data-load-finished', 'false');
    });
    
    // Error events
    webview.addEventListener('did-fail-load', (event) => {
      webviewLogger.warn('Webview failed to load:', event);
      handlePageLoadError(browser, event);
    });
    
    webview.addEventListener('certificate-error', (event) => {
      webviewLogger.warn('Webview certificate error:', event);
      handleCertificateError(browser, event);
    });
    
    webviewLogger.debug('All unified event handlers bound successfully');
  } catch (error) {
    webviewLogger.error('Error binding webview events:', error);
  }
}

/**
 * Add enhanced methods to webview instance
 * @param {Object} browser - Browser component instance
 * @param {HTMLElement} webview - Webview element
 */
function addWebviewMethods(browser, webview) {
  // Enhanced visibility method using StyleManager
  webview.forceVisibility = function() {
    webviewLogger.debug('Forcing visibility on webview via StyleManager:', this.id);
    StyleManager.safeApplyStyles(this, true);
    void this.offsetHeight; // Force reflow
  };
  
  // UNIFIED critical styles application
  webview.applyAllCriticalStyles = function() {
    // Use StyleManager for comprehensive styling
    webviewLogger.debug('Applying all critical styles via StyleManager for:', this.id);
    StyleManager.applyWebviewStyles(browser, this, true);
    
    // Apply content styles if this is a Google page
    const isGoogle = browser.state?.url?.includes('google.com');
    if (isGoogle) {
      applySiteSpecificFixes(browser, this);
    }
    
    // Apply general content fixes
    applyCriticalContentStyles(this);
    
    webviewLogger.debug('Applied all critical styles to webview:', this.id);
  };
}

/**
 * Apply critical content styles via JavaScript
 * @param {HTMLElement} webview - Webview element
 */
function applyCriticalContentStyles(webview) {
  if (!webview || typeof webview.executeJavaScript !== 'function') return;
  
  try {
    webview.executeJavaScript(`
      (function() {
        try {
          // Apply critical visibility styles
          if (document.documentElement) {
            document.documentElement.style.visibility = 'visible';
            document.documentElement.style.display = 'block';
          }
          if (document.body) {
            document.body.style.visibility = 'visible';
            document.body.style.display = 'block';
          }
          return true;
        } catch (e) {
          console.warn('Error applying critical styles:', e.message);
          return false;
        }
      })();
    `).catch(err => {
      webviewLogger.warn('Error applying critical content styles:', err.message);
    });
  } catch (err) {
    webviewLogger.warn('Error executing critical styles script:', err.message);
  }
}

/**
 * Apply site-specific fixes (Google, etc.)
 * @param {Object} browser - Browser component instance  
 * @param {HTMLElement} webview - Webview element
 */
function applySiteSpecificFixes(browser, webview) {
  if (!browser.state?.url || typeof webview.executeJavaScript !== 'function') return;
  
  const isGoogle = browser.state.url.includes('google.com');
  
  if (isGoogle) {
    try {
      webview.executeJavaScript(`
        (function() {
          try {
            // Create style element for minimal Google fixes
            let styleEl = document.getElementById('unified-google-fixes');
            if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = 'unified-google-fixes';
              document.head.appendChild(styleEl);
            }
            
            // Apply minimal Google fixes that preserve layout
            styleEl.textContent = \`
              /* Minimal fixes - preserve Google's responsive design */
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
              }
              
              /* Only fix overflow, don't force dimensions */
              body {
                overflow-x: hidden !important;
              }
            \`;
            
            return true;
          } catch (e) {
            console.warn('Error applying minimal Google fixes:', e.message);
            return false;
          }
        })();
      `).catch(err => {
        webviewLogger.warn('Error applying minimal Google fixes:', err.message);
      });
    } catch (err) {
      webviewLogger.warn('Error executing minimal Google fixes script:', err.message);
    }
  }
}

// Export ONLY the unified interface
export default {
  createWebview
};