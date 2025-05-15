/**
 * BrowserEnv - Utilities for browser environment detection and configuration
 */

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
 * Apply sandbox settings based on security level
 * @param {HTMLElement} element - The webview or iframe element
 * @param {string} sandboxLevel - Security level ('none', 'standard', 'strict')
 */
export function applySandboxSettings(element, sandboxLevel) {
  if (!element) return;
  
  // Don't apply to Electron webview which has its own security model
  if (element.tagName.toLowerCase() === 'webview') {
    // Configure Electron webview security with better defaults for navigation
    element.setAttribute('allowpopups', 'true'); // Allow popups for better site compatibility
    element.setAttribute('disablewebsecurity', 'true'); // Disable web security for easier cross-origin content
    element.setAttribute('partition', 'persist:browserview'); // Use persistent session
    
    // IMPORTANT: Add more permissive properties to ensure content loads
    element.setAttribute('nodeintegration', 'false'); // Keeps renderer process secure
    element.setAttribute('webpreferences', 'allowRunningInsecureContent=true, javascript=true, webSecurity=false, images=true, textAreasAreResizable=true, webgl=true');
    element.setAttribute('plugins', 'true');
    element.setAttribute('allowtransparency', 'true');
    
    // Set a standard user agent for better compatibility
    element.setAttribute('useragent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    
    // Set critical CSS properties directly for visibility
    setTimeout(() => {
      if (element.style) {
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.display = 'block';
        element.style.visibility = 'visible';
        element.style.opacity = '1';
        
        // Force layout recalculation
        element.getBoundingClientRect();
      }
    }, 100);
    
    return;
  }
  
  // For iframes, apply sandbox attribute based on security level
  switch (sandboxLevel) {
    case 'none':
      // Very permissive - not recommended
      element.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-modals');
      break;
    
    case 'strict':
      // Very restrictive - most secure but might break functionality
      element.setAttribute('sandbox', 'allow-same-origin allow-scripts');
      break;
    
    case 'standard':
    default:
      // Balanced approach - secure but functional
      // Check if we're in Electron to allow more permissive settings
      const isElectron = window.isElectron || (window.process && window.process.type === 'renderer');
      if (isElectron) {
        element.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-modals');
        // Remove any CSP meta tags that might be added in the iframe
        setTimeout(() => {
          try {
            const frameDocument = element.contentDocument;
            if (frameDocument) {
              const metaTags = frameDocument.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
              metaTags.forEach(tag => tag.remove());
            }
          } catch (e) {
            console.log('Could not modify iframe CSP:', e);
          }
        }, 1000);
      } else {
        element.setAttribute('sandbox', 'allow-same-origin allow-scripts');
      }
      break;
  }
}

/**
 * Format a URL for navigation
 * @param {string} url - Raw URL input
 * @returns {string} Formatted URL with correct protocol
 */
export function formatUrl(url) {
  if (!url) return '';
  
  // Add http:// prefix if needed
  let formattedUrl = url;
  if (!/^https?:\/\//i.test(url)) {
    // Check if it's a search or a URL
    if (url.includes(' ') || !url.includes('.')) {
      // Treat as search query
      formattedUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    } else {
      // Treat as URL
      formattedUrl = `https://${url}`;
    }
  }
  
  return formattedUrl;
}

/**
 * Apply site-specific settings based on URL
 * @param {string} url - The URL being navigated to
 */
export function applySiteSpecificSettings(url) {
  if (!url) return;
  
  // Default settings
  let settings = {
    sandbox: 'standard',
    headers: {},
    userAgent: null,
    bypassCSP: true
  };
  
  // Google-specific settings
  if (url.includes('google.com')) {
    settings = {
      sandbox: 'standard',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      bypassCSP: true
    };
  }
  
  // YouTube-specific settings
  else if (url.includes('youtube.com')) {
    settings = {
      sandbox: 'standard',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      bypassCSP: true
    };
  }
  
  // Apply settings to webview
  if (this.webview && this.webview.tagName.toLowerCase() === 'webview') {
    try {
      // Apply sandbox settings
      if (settings.sandbox && typeof applySandboxSettings === 'function') {
        applySandboxSettings(this.webview, settings.sandbox);
      }
      
      // Apply user agent
      if (settings.userAgent && typeof this.webview.setUserAgent === 'function') {
        this.webview.setUserAgent(settings.userAgent);
      }
      
      // Handle CSP bypass through session if available
      if (settings.bypassCSP && this.webview.getSession) {
        try {
          const session = this.webview.getSession();
          if (session && session.webRequest) {
            session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
              if (details.responseHeaders && details.responseHeaders['content-security-policy']) {
                delete details.responseHeaders['content-security-policy'];
              }
              callback({ responseHeaders: details.responseHeaders });
            });
          }
        } catch (err) {
          console.warn('Error setting up CSP bypass:', err);
        }
      }
      
      console.log(`Applied site-specific settings for: ${url}`);
    } catch (err) {
      console.warn('Error applying site-specific settings:', err);
    }
  }
}

export default {
  detectEnvironment,
  applySandboxSettings,
  formatUrl,
  forceElectronMode,
  applySiteSpecificSettings
}; 