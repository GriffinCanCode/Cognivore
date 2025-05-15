/**
 * Special preload script for webviews
 * This script will be injected into webview contexts to disable security policies
 * and enable cross-origin content loading
 */

// Disable content security policy by injecting meta tag
const disableCSP = () => {
  try {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';";
    document.head.appendChild(meta);
    console.log('CSP disabled via meta tag');
  } catch (error) {
    console.error('Failed to disable CSP:', error);
  }
};

// Fix black border/margin issues
const fixMargins = () => {
  try {
    // Immediately add style to remove margins
    const styleEl = document.createElement('style');
    styleEl.id = 'cognivore-preload-fixes';
    styleEl.textContent = `
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
        height: 100% !important;
        width: 100% !important;
        position: relative !important;
        min-height: 100% !important;
      }
      
      /* Target main containers that often cause margin issues */
      #main, main, [role="main"], .main,
      form[role="search"], #search, .search, [role="search"],
      div.container, div.content, div.wrapper, div.page,
      div#container, div#content, div#wrapper, div#page,
      div[class*="container"], div[class*="content"], div[class*="wrapper"],
      #cnt, #rcnt, #center_col, #rso, .g-blk, .kp-blk,
      /* Google-specific elements */
      #s8TaEd, #appbar, #searchform, #search, form[action="/search"] {
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      
      /* Ensure scrollbars don't cause horizontal overflow */
      body::-webkit-scrollbar {
        width: 8px !important;
      }
      
      * {
        max-width: 100vw !important;
        box-sizing: border-box !important;
      }
    `;
    document.head.appendChild(styleEl);
    
    // Also set direct styles
    if (document.body) {
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.minHeight = '100%';
      document.body.style.position = 'relative';
      document.body.style.overflow = 'auto';
      document.body.style.overflowX = 'hidden';
    }
    
    // Also apply to document element
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';
    document.documentElement.style.minHeight = '100%';
    document.documentElement.style.position = 'relative';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.overflowX = 'hidden';
    
    // Set up a MutationObserver to ensure the fix persists
    const observer = new MutationObserver(() => {
      if (document.body) {
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.body.style.minHeight = '100%';
      }
      
      // Check for Google-specific elements that might have been added dynamically
      const googleElements = [
        document.querySelector('#main'),
        document.querySelector('#rcnt'),
        document.querySelector('#center_col'),
        document.querySelector('#rso'),
        document.querySelector('#s8TaEd'),
        document.querySelector('#appbar'),
        document.querySelector('#searchform')
      ];
      
      googleElements.forEach(el => {
        if (el) {
          el.style.margin = '0';
          el.style.width = '100%';
          el.style.maxWidth = '100%';
          el.style.boxSizing = 'border-box';
          el.style.overflowX = 'hidden';
        }
      });
    });
    
    // Start observing with more comprehensive settings
    observer.observe(document.documentElement, { 
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'width', 'height', 'margin', 'padding']
    });
    
    // Apply fixes periodically as fallback
    if (!window.marginFixInterval) {
      window.marginFixInterval = setInterval(() => {
        if (document.body) {
          document.body.style.margin = '0';
          document.body.style.padding = '0';
        }
      }, 500);
    }
    
    console.log('Enhanced margin fixes applied via preload script');
  } catch (error) {
    console.error('Failed to fix margins:', error);
  }
};

// Configure communication with parent window
const setupMessaging = () => {
  // Send ready message to parent
  window.parent.postMessage({ type: 'webview-ready', url: window.location.href }, '*');
  
  // Setup heartbeat
  setInterval(() => {
    window.parent.postMessage({ 
      type: 'webview-heartbeat',
      url: window.location.href,
      title: document.title,
      timestamp: Date.now() 
    }, '*');
  }, 1000);
  
  // Monitor page load events
  window.addEventListener('load', () => {
    window.parent.postMessage({ 
      type: 'webview-loaded',
      url: window.location.href,
      title: document.title,
      readyState: document.readyState 
    }, '*');
    
    // Re-apply margin fixes after full page load
    fixMargins();
  });
  
  console.log('Parent window messaging set up');
};

// Override fetch to allow cross-origin requests
const enableCrossOriginFetch = () => {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const [resource, config] = args;
    
    // Add CORS headers to all requests
    const newConfig = {
      ...config,
      mode: 'cors',
      credentials: 'include',
      headers: {
        ...(config?.headers || {}),
        'Origin': window.location.origin,
      }
    };
    
    try {
      return await originalFetch(resource, newConfig);
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  };
  
  console.log('Cross-origin fetch enabled');
};

// Initialize when DOM is ready
const init = () => {
  disableCSP();
  fixMargins(); // Apply margin fixes early
  setupMessaging();
  enableCrossOriginFetch();
  
  // Set up a timeout to apply margin fixes again
  setTimeout(fixMargins, 100);
  
  console.log('Webview preload script initialized');
};

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
  // Also apply basic margin fixes immediately, even before DOMContentLoaded
  setTimeout(fixMargins, 0);
} else {
  init();
}

// Make sure fixes are applied when any resources load
window.addEventListener('load', fixMargins);

// This script will be loaded by Electron's webview system