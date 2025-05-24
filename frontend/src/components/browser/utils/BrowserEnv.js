/**
 * BrowserEnv - Centralized browser environment detection and configuration
 * Single source of truth for all browser environment logic
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
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  const hasWebView = typeof document !== 'undefined' && !!document.createElement('webview').constructor.name;
  
  // Set rendering strategy based on environment
  let renderingMode, webviewImplementation;
  
  if (isElectron) {
    renderingMode = 'full';
    webviewImplementation = hasWebView ? 'webview' : 'iframe';
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
    isNode,
    hasNodeAccess,
    hasWebView,
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

/**
 * Format URL with proper protocol
 * @param {string} url - URL to format
 * @returns {string} Formatted URL with protocol
 */
export function formatUrl(url) {
  if (!url) return '';
  
  // Remove leading/trailing whitespace
  url = url.trim();
  
  // Check if the URL already has a protocol
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
    return url;
  }
  
  // If it already looks like a domain name with TLD, add https://
  if (/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/.test(url)) {
    return `https://${url}`;
  }
  
  // If it has spaces, definitely treat as a search query
  if (/\s/.test(url)) {
    return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  }
  
  // For single words without dots, try to intelligently determine if it's a domain or search
  if (!/\./.test(url)) {
    // Common domain patterns - try .com first
    const commonDomains = [
      'wikipedia', 'facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 
      'github', 'stackoverflow', 'reddit', 'amazon', 'google', 'microsoft',
      'apple', 'netflix', 'spotify', 'discord', 'slack', 'zoom', 'dropbox',
      'pinterest', 'tumblr', 'quora', 'medium', 'wordpress', 'blogger'
    ];
    
    // Check if it's a known common domain
    if (commonDomains.includes(url.toLowerCase())) {
      return `https://${url}.com`;
    }
    
    // If it's a single word with only letters/numbers/hyphens, likely a domain
    if (/^[a-zA-Z0-9-]+$/.test(url) && url.length >= 3 && url.length <= 63) {
      // Try .com first for single word domains
      return `https://${url}.com`;
    }
    
    // If it contains special characters or numbers mixed with text, likely a search
    if (/[^a-zA-Z0-9-]/.test(url) || /\d.*[a-zA-Z]|[a-zA-Z].*\d/.test(url)) {
      return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
    
    // Default for single words: try as domain first
    return `https://${url}.com`;
  }
  
  // Has dots but doesn't match domain pattern - could be partial domain or search
  // If it looks like a partial domain (word.word), try adding https
  if (/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(url)) {
    return `https://${url}`;
  }
  
  // Fallback to search for anything else
  return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
}

/**
 * Apply site-specific settings based on URL
 * @param {string} url - The URL being navigated to
 * @param {HTMLElement} webview - The webview element to apply settings to
 */
export function applySiteSpecificSettings(url, webview) {
  if (!url || !webview) return;
  
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
  if (webview && webview.tagName && 
      webview.tagName.toLowerCase() === 'webview' && 
      webview.isConnected) {
    try {
      // Apply sandbox settings
      if (settings.sandbox) {
        applySandboxSettings(webview, settings.sandbox);
      }
      
      // Apply user agent - but only if the webview is ready
      if (settings.userAgent && typeof webview.setUserAgent === 'function') {
        try {
          // Check if webview has initialized its WebContents
          if (typeof webview.getWebContentsId === 'function') {
            try {
              const hasWebContents = webview.getWebContentsId() !== -1;
              if (hasWebContents) {
                webview.setUserAgent(settings.userAgent);
              }
            } catch (webContentsError) {
              // WebContents not ready yet, log and continue
              console.log('WebContents not ready: The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.');
            }
          }
        } catch (userAgentError) {
          console.warn('Error setting user agent:', userAgentError);
        }
      }
      
      // Handle CSP bypass through session if available
      if (settings.bypassCSP && typeof webview.getWebContents === 'function') {
        try {
          // First check if webview has WebContents
          const webContents = webview.getWebContents();
          if (webContents && webContents.session && webContents.session.webRequest) {
            webContents.session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
              if (details.responseHeaders && details.responseHeaders['content-security-policy']) {
                delete details.responseHeaders['content-security-policy'];
              }
              callback({ responseHeaders: details.responseHeaders });
            });
          }
        } catch (err) {
          // WebContents might not be ready yet
          console.warn('WebContents not ready for CSP bypass, will try later:', err.message);
        }
      }
      
      console.log(`Applied site-specific settings for: ${url}`);
    } catch (err) {
      console.warn('Error applying site-specific settings:', err);
    }
  }
}

/**
 * Apply sandbox settings to a webview element
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
      const environment = detectEnvironment();
      if (environment.isElectron) {
        element.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-modals');
      } else {
        element.setAttribute('sandbox', 'allow-same-origin allow-scripts');
      }
      break;
  }
}

/**
 * Get icon URL for a given website URL
 * @param {string} url - Website URL
 * @returns {string} Icon URL
 */
export function getIconForUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Option 1: Return a data URL placeholder icon
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktZ2xvYmUiIHZpZXdCb3g9IjAgMCAxNiAxNiI+PHBhdGggZD0iTTAgOGE4IDggMCAxIDEgMTYgMEE4IDggMCAwIDEgMCA4em03LjUtNi45NWEuNS41IDAgMCAwLS41LjV2MS4yNWEuNS41IDAgMCAwIC41LjVoLjVhLjUuNSAwIDAgMSAuNS41djUuNWEuNS41IDAgMCAxLS41LjVoLS41YS41LjUgMCAwIDAgMCAxaDFhLjUuNSAwIDAgMCAuNS0uNXYtNS41YS41LjUgMCAwIDEgLjUtLjVoNWEuNS41IDAgMCAwIDAtMWgtNWEuNS41IDAgMCAxLS41LS41di0xLjI1YS41LjUgMCAwIDAtLjUtLjVoLTV6Ii8+PC9zdmc+';
    
    // Option 2: If backend proxy is available, use it instead
    // Uncomment this and comment out Option 1 if backend proxy is implemented
    // return `/api/favicon?url=${encodeURIComponent(urlObj.origin)}`;
  } catch (e) {
    // Return default icon on error
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktZmlsZS1lYXJtYXJrIiB2aWV3Qm94PSIwIDAgMTYgMTYiPjxwYXRoIGQ9Ik03IDEwLjVhLjUuNSAwIDAgMSAuNS0uNWgxYS41LjUgMCAwIDEgLjUuNXYxYS41LjUgMCAwIDEtLjUuNWgtMWEuNS41IDAgMCAxLS41LS41di0xeiIvPjxwYXRoIGQ9Ik0yIDJhMiAyIDAgMCAxIDItMmg4YTIgMiAwIDAgMSAyIDJ2MTJhMiAyIDAgMCAxLTIgMkgyYTIgMiAwIDAgMS0yLTJWMnptMi0xYTEgMSAwIDAgMC0xIDF2MTJhMSAxIDAgMCAwIDEgMWg4YTEgMSAwIDAgMCAxLTFWMmExIDEgMCAwIDAtMS0xSDR6Ii8+PC9zdmc+';
  }
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size string
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Show a toast notification in the browser UI
 * @param {string} message - Toast message
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {number} duration - Notification duration in ms
 */
export function showToastNotification(message, type = 'info', duration = 3000) {
  // Create toast element if it doesn't exist
  let toast = document.getElementById('browser-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'browser-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '4px';
    toast.style.color = '#fff';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '14px';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease-in-out';
    document.body.appendChild(toast);
  }
  
  // Set background color based on type
  switch(type) {
    case 'success':
      toast.style.backgroundColor = '#4CAF50';
      break;
    case 'error':
      toast.style.backgroundColor = '#F44336';
      break;
    case 'warning':
      toast.style.backgroundColor = '#FF9800';
      break;
    default:
      toast.style.backgroundColor = '#2196F3';
  }
  
  // Set message and show toast
  toast.textContent = message;
  toast.style.opacity = '1';
  
  // Hide toast after duration
  setTimeout(() => {
    toast.style.opacity = '0';
  }, duration);
}

/**
 * Update the page title in browser and document
 * @param {Object} browser - Browser instance
 * @param {string} title - Page title
 */
export function updatePageTitle(browser, title) {
  if (!browser || !title) return;
  
  // Update component state if it exists
  if (browser.setState) {
    browser.setState({ title });
  }
  
  // Update document title if needed
  if (browser.props && browser.props.updateDocumentTitle) {
    document.title = title;
  }
}

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

export default {
  detectEnvironment,
  forceElectronMode,
  formatUrl,
  applySiteSpecificSettings,
  applySandboxSettings,
  getIconForUrl,
  formatBytes,
  showToastNotification,
  updatePageTitle,
  setupWebviewEnvironment
}; 