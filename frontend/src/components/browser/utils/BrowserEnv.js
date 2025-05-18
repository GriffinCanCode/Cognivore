/**
 * BrowserEnv - Utilities for browser environment detection and configuration
 */

// Import formatUrl and other utilities from BrowserUtilities
import { 
  formatUrl, 
  applySiteSpecificSettings, 
  applySandboxSettings 
} from './BrowserUtilities';

/**
 * Detect environment and determine best rendering options
 * @returns {Object} Environment configuration object
 */
export function detectEnvironment() {
  // More robust Electron detection - check multiple indicators
  const indicators = [
    // Standard process check
    window.process && window.process.type === 'renderer',
    // Check for Electron-specific globals
    typeof window.electron !== 'undefined',
    typeof window.ipcRenderer !== 'undefined',
    // Check for browser features that are only present in Electron
    navigator.userAgent.toLowerCase().includes('electron'),
    // Check for specific Electron environment variables
    window.process && window.process.versions && window.process.versions.electron
  ];
  
  // If any of the indicators are true, we're in Electron
  let isElectron = indicators.some(indicator => indicator);
  
  // Force Electron mode if application name is Cognivore or if global flag is set
  if (window.isElectron === true || document.title === 'Cognivore') {
    console.log('Forcing Electron environment detection based on app name or global flag');
    isElectron = true;
  }
  
  // Check console for Electron security warnings as a definitive sign we're in Electron
  try {
    // Look for security warnings in the console output DOM
    const consoleOutput = document.querySelectorAll('.console-message');
    for (const message of consoleOutput) {
      if (message.textContent && (
          message.textContent.includes('Electron Security Warning') || 
          message.textContent.includes('webSecurity') || 
          message.textContent.includes('allowRunningInsecureContent'))) {
        console.log('🔍 Found Electron security warnings in console - forcing Electron mode');
        isElectron = true;
        break;
      }
    }
  } catch (err) {
    console.log('Error checking console output:', err);
  }
  
  // Additional check for URL containing electron
  if (window.location.href && window.location.href.includes('cognivore')) {
    console.log('Application URL contains cognivore - likely in Electron app');
    isElectron = true;
  }
  
  // FORCE ELECTRON MODE FOR NOW - Will be removed once detection is reliable
  // This ensures the browser works immediately while we improve detection
  console.log('⚠️ FORCING ELECTRON MODE FOR IMMEDIATE FUNCTIONALITY');
  isElectron = true;
  window.isElectron = true;
  
  // Check if we have access to certain Node APIs through preload
  const hasNodeAccess = typeof window.ipcRenderer !== 'undefined';
  
  // Set rendering strategy based on environment
  let renderingMode, webviewImplementation;
  
  if (isElectron) {
    renderingMode = 'full';
    webviewImplementation = 'webview';
    console.log('✅ Detected Electron environment - enabling full browsing capabilities');
  } else if (hasNodeAccess) {
    renderingMode = 'compatibility';
    webviewImplementation = 'iframe-proxy';
  } else {
    renderingMode = 'restricted';
    webviewImplementation = 'iframe-fallback';
  }
  
  // Log the detected configuration
  console.log(`Browser environment detected: rendering mode: ${renderingMode}, implementation: ${webviewImplementation}`);
  
  return {
    isElectron,
    hasNodeAccess,
    renderingMode,
    webviewImplementation
  };
}

/**
 * Force Electron mode for the browser
 * Call this function to bypass environment detection and force Electron mode
 */
export function forceElectronMode() {
  console.log('🔧 Manually forcing Electron mode for browser');
  
  // Set multiple global flags that we can check
  window.isElectron = true;
  window.__ELECTRON_MODE_FORCED__ = true;
  
  // Add a data attribute to the document for CSS selection
  document.documentElement.setAttribute('data-electron-mode', 'true');
  
  // Log all possible indicators for later debugging
  console.log('Electron environment indicators:', {
    isElectron: window.isElectron,
    processIsRenderer: window.process && window.process.type === 'renderer',
    hasElectronGlobal: typeof window.electron !== 'undefined',
    hasIpcRenderer: typeof window.ipcRenderer !== 'undefined',
    userAgent: navigator.userAgent,
  });
  
  return detectEnvironment();
}

// Try to detect Electron on script load and set global flag
(function() {
  try {
    if (document.title === 'Cognivore' || 
        navigator.userAgent.toLowerCase().includes('electron') ||
        (window.process && window.process.type === 'renderer')) {
      console.log('Setting global isElectron flag automatically');
      window.isElectron = true;
    }
  } catch (e) {
    console.log('Error during automatic Electron detection:', e);
  }
})();

/**
 * Setup webview environment with necessary configurations
 * @param {HTMLElement} webview - The webview element to set up
 * @returns {Promise<boolean>} Promise resolving to setup success status
 */
export function setupWebviewEnvironment(webview) {
  if (!webview || !webview.isConnected) {
    console.warn('Cannot setup webview environment - webview not connected');
    return Promise.resolve(false);
  }
  
  if (typeof webview.executeJavaScript !== 'function') {
    console.warn('Cannot setup webview environment - executeJavaScript not available');
    return Promise.resolve(false);
  }
  
  console.log('Setting up webview environment...');
  
  const environmentSetupScript = `
    (function() {
      // Avoid duplicate execution
      if (window._browserEnvSetup) {
        console.log('Browser environment already set up, skipping');
        return true;
      }
      
      // Mark as set up
      window._browserEnvSetup = true;
      
      try {
        // Add helper functions to detect if environment is ready
        window.cognivoreEnv = {
          isReady: true,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          browserInfo: {
            vendor: navigator.vendor,
            appName: navigator.appName,
            appVersion: navigator.appVersion
          },
          sendMessage: function(message) {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage(message, '*');
            }
          },
          notifyParent: function(type, data) {
            this.sendMessage({
              type: type,
              timestamp: Date.now(),
              data: data || {}
            });
          }
        };
        
        // Send ready message to parent
        window.cognivoreEnv.notifyParent('webview-ready', {
          url: window.location.href,
          title: document.title
        });
        
        // Set up scroll event
        window.addEventListener('scroll', function() {
          const scrollData = {
            scrollTop: window.scrollY || document.documentElement.scrollTop,
            scrollHeight: document.documentElement.scrollHeight,
            clientHeight: document.documentElement.clientHeight,
            scrollPercentage: Math.round(
              (window.scrollY || document.documentElement.scrollTop) / 
              (document.documentElement.scrollHeight - document.documentElement.clientHeight) * 100
            )
          };
          
          // Only send message every 500ms to avoid flooding
          if (!window._lastScrollMessage || (Date.now() - window._lastScrollMessage) > 500) {
            window._lastScrollMessage = Date.now();
            window.cognivoreEnv.notifyParent('webview-scroll', scrollData);
          }
        }, { passive: true });
        
        // Monitor DOM changes
        if (window.MutationObserver) {
          const bodyObserver = new MutationObserver(function(mutations) {
            // Batch notifications to reduce overhead
            if (!window._domChangePending) {
              window._domChangePending = true;
              setTimeout(function() {
                window._domChangePending = false;
                window.cognivoreEnv.notifyParent('dom-changed', {
                  url: window.location.href,
                  title: document.title
                });
              }, 500);
            }
          });
          
          // Start observing when body is available
          if (document.body) {
            bodyObserver.observe(document.body, { 
              childList: true, 
              subtree: true,
              attributes: false, 
              characterData: false 
            });
          } else {
            // Wait for body to be available
            document.addEventListener('DOMContentLoaded', function() {
              if (document.body) {
                bodyObserver.observe(document.body, { 
                  childList: true, 
                  subtree: true,
                  attributes: false, 
                  characterData: false 
                });
              }
            });
          }
        }
        
        // Track navigation events
        window.addEventListener('popstate', function() {
          window.cognivoreEnv.notifyParent('navigation-event', {
            type: 'popstate',
            url: window.location.href
          });
        });
        
        // Set up click handler for external links
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a');
          if (!link) return;
          
          const href = link.getAttribute('href');
          if (!href) return;
          
          // Check if link is external
          const isExternal = (
            link.hostname !== window.location.hostname || 
            link.protocol !== window.location.protocol
          );
          
          // Only intercept http/https links
          const isHttp = link.protocol === 'http:' || link.protocol === 'https:';
          
          if (isHttp) {
            window.cognivoreEnv.notifyParent('link-clicked', {
              href: link.href,
              text: link.textContent.trim(),
              isExternal: isExternal
            });
          }
        }, { passive: true });
        
        console.log('Browser environment setup complete');
        return true;
      } catch (error) {
        console.error('Error setting up browser environment:', error);
        return {
          error: true,
          message: error.message || 'Unknown error during environment setup'
        };
      }
    })();
  `;
  
  return webview.executeJavaScript(environmentSetupScript)
    .then(result => {
      console.log('Webview environment setup:', result);
      return !!result;
    })
    .catch(error => {
      console.error('Error executing environment setup script:', error);
      return false;
    });
}

export default {
  detectEnvironment,
  formatUrl,
  forceElectronMode,
  applySiteSpecificSettings,
  applySandboxSettings,
  setupWebviewEnvironment
}; 