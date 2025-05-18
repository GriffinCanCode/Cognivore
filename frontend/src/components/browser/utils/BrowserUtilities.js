/**
 * Browser Utilities - Helper functions for browser component
 */

/**
 * Detect the current environment for proper browser rendering
 * @returns {Object} Environment information
 */
export function detectEnvironment() {
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  const isElectron = typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0;
  const hasWebView = typeof document !== 'undefined' && !!document.createElement('webview').constructor.name;
  
  return {
    isElectron,
    isNode,
    hasWebView,
    webviewImplementation: hasWebView ? 'webview' : 'iframe'
  };
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
  
  // Check if the URL has a protocol
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
    // If it looks like a domain name with TLD, add https://
    if (/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/.test(url)) {
      return `https://${url}`;
    }
    
    // If it has spaces or doesn't look like a URL, treat as a search query
    if (/\s/.test(url) || !/\./.test(url)) {
      return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
    
    // Default to adding https://
    return `https://${url}`;
  }
  
  return url;
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
      const isElectron = window.isElectron || (window.process && window.process.type === 'renderer');
      if (isElectron) {
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