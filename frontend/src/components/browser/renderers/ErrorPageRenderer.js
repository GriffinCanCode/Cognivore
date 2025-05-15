/**
 * ErrorPageRenderer - Renders custom error pages for browser errors
 */

/**
 * Render an error page
 * @param {Document} doc - Document to render error page in
 * @param {string} errorType - Type of error ('network', 'ssl', 'notfound', 'generic')
 * @param {Object} data - Error data including URL and error message
 */
export function renderErrorPage(doc, errorType, data) {
  if (!doc) return;
  
  try {
    // Clear any existing content
    doc.open();
    
    // Create appropriate error page content
    let pageContent = '';
    
    switch (errorType) {
      case 'network':
        pageContent = createNetworkErrorPage(data);
        break;
        
      case 'ssl':
        pageContent = createSSLErrorPage(data);
        break;
        
      case 'notfound':
        pageContent = createNotFoundErrorPage(data);
        break;
        
      case 'generic':
      default:
        pageContent = createGenericErrorPage(data);
        break;
    }
    
    // Write error page HTML
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
            color: #333;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .error-container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            padding: 40px;
            max-width: 600px;
            text-align: center;
            margin: 20px;
          }
          .error-icon {
            color: #666;
            margin-bottom: 20px;
          }
          .network-error-icon { color: #e67e22; }
          .ssl-error-icon { color: #e74c3c; }
          .notfound-error-icon { color: #3498db; }
          .generic-error-icon { color: #7f8c8d; }
          h1 {
            margin: 0 0 20px 0;
            font-weight: 600;
            font-size: 24px;
          }
          p {
            margin: 0 0 20px 0;
            line-height: 1.5;
            color: #666;
          }
          .error-details {
            background-color: #f8f9fa;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: left;
            font-family: monospace;
            font-size: 14px;
            overflow-wrap: break-word;
          }
          .error-details p {
            margin: 5px 0;
          }
          .error-actions {
            display: flex;
            justify-content: center;
            gap: 10px;
          }
          button {
            padding: 10px 20px;
            border-radius: 4px;
            font-weight: 500;
            cursor: pointer;
            font-size: 14px;
            border: none;
            transition: background-color 0.2s;
          }
          .primary-button {
            background-color: #4c6ef5;
            color: white;
          }
          .primary-button:hover {
            background-color: #3b5de7;
          }
          .secondary-button {
            background-color: #e9ecef;
            color: #495057;
          }
          .secondary-button:hover {
            background-color: #dee2e6;
          }
          .warning-button {
            background-color: #e74c3c;
            color: white;
          }
          .warning-button:hover {
            background-color: #c0392b;
          }
        </style>
      </head>
      <body>
        ${pageContent}
        <script>
          // Add event listeners for buttons
          document.addEventListener('DOMContentLoaded', function() {
            const refreshButton = document.getElementById('refresh-button');
            if (refreshButton) {
              refreshButton.addEventListener('click', function() {
                window.parent.postMessage({ type: 'cognivore-refresh-page' }, '*');
              });
            }
            
            const backButton = document.getElementById('back-button');
            if (backButton) {
              backButton.addEventListener('click', function() {
                window.parent.postMessage({ type: 'cognivore-go-back' }, '*');
              });
            }
            
            const proceedButton = document.getElementById('proceed-button');
            if (proceedButton) {
              proceedButton.addEventListener('click', function() {
                window.parent.postMessage({ 
                  type: 'cognivore-proceed-anyway',
                  url: '${data.url}'
                }, '*');
              });
            }
          });
        </script>
      </body>
      </html>
    `);
    
    doc.close();
  } catch (error) {
    console.error('Error rendering error page:', error);
  }
}

/**
 * Create network error page content
 * @param {Object} data - Error data
 * @returns {string} HTML content
 */
function createNetworkErrorPage(data) {
  return `
    <div class="error-container">
      <div class="error-icon network-error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
          <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
      </div>
      <h1>Network Error</h1>
      <p>Could not connect to the website. Please check your internet connection and try again.</p>
      <div class="error-details">
        <p>URL: ${data.url}</p>
        <p>Error: ${data.error}</p>
      </div>
      <div class="error-actions">
        <button id="refresh-button" class="primary-button">Try Again</button>
      </div>
    </div>
  `;
}

/**
 * Create SSL error page content
 * @param {Object} data - Error data
 * @returns {string} HTML content
 */
function createSSLErrorPage(data) {
  return `
    <div class="error-container">
      <div class="error-icon ssl-error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          <circle cx="12" cy="16" r="1"></circle>
        </svg>
      </div>
      <h1>Security Warning</h1>
      <p>The security certificate for this site is invalid or not trusted. Proceeding to this site may be risky.</p>
      <div class="error-details">
        <p>URL: ${data.url}</p>
        <p>Error: ${data.error}</p>
      </div>
      <div class="error-actions">
        <button id="back-button" class="secondary-button">Go Back</button>
        <button id="proceed-button" class="warning-button">Proceed Anyway (Not Recommended)</button>
      </div>
    </div>
  `;
}

/**
 * Create not found error page content
 * @param {Object} data - Error data
 * @returns {string} HTML content
 */
function createNotFoundErrorPage(data) {
  return `
    <div class="error-container">
      <div class="error-icon notfound-error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <path d="M13 2v7h7"></path>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
      </div>
      <h1>Page Not Found</h1>
      <p>The page you are looking for does not exist or has been moved.</p>
      <div class="error-details">
        <p>URL: ${data.url}</p>
        <p>Error: ${data.error}</p>
      </div>
      <div class="error-actions">
        <button id="back-button" class="secondary-button">Go Back</button>
      </div>
    </div>
  `;
}

/**
 * Create generic error page content
 * @param {Object} data - Error data
 * @returns {string} HTML content
 */
function createGenericErrorPage(data) {
  return `
    <div class="error-container">
      <div class="error-icon generic-error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h1>Something Went Wrong</h1>
      <p>An error occurred while trying to load this page.</p>
      <div class="error-details">
        <p>URL: ${data.url}</p>
        <p>Error: ${data.error}</p>
      </div>
      <div class="error-actions">
        <button id="back-button" class="secondary-button">Go Back</button>
        <button id="refresh-button" class="primary-button">Try Again</button>
      </div>
    </div>
  `;
}

/**
 * Show navigation error page in the browser
 * @param {Object} browser - Browser instance
 * @param {string} url - The URL that failed to load
 * @param {string} errorMessage - The error message to display
 */
export function showNavigationErrorPage(browser, url, errorMessage) {
  if (!browser.webview) return;
  
  console.error(`Navigation error for ${url}: ${errorMessage}`);
  
  // Hide loading content
  if (typeof browser.hideLoadingContent === 'function') {
    browser.hideLoadingContent();
  }
  
  // Create error page HTML
  const errorHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Navigation Error</title>
      <style>
        html, body {
          height: 100%;
          width: 100%;
          margin: 0;
          padding: 0;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
          background-color: #f7f7f7;
          color: #333;
        }
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          padding: 20px;
          box-sizing: border-box;
          text-align: center;
        }
        .error-icon {
          width: 64px;
          height: 64px;
          margin-bottom: 24px;
          color: #e74c3c;
        }
        .error-title {
          font-size: 24px;
          margin-bottom: 16px;
          color: #e74c3c;
        }
        .error-message {
          font-size: 16px;
          margin-bottom: 24px;
          max-width: 600px;
          line-height: 1.5;
        }
        .error-url {
          font-size: 14px;
          color: #666;
          margin-bottom: 24px;
          word-break: break-all;
          max-width: 80%;
          padding: 8px 16px;
          background-color: #eee;
          border-radius: 4px;
        }
        .retry-button {
          padding: 10px 20px;
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          transition: background-color 0.3s;
        }
        .retry-button:hover {
          background-color: #2980b9;
        }
        .alternative-button {
          padding: 10px 20px;
          background-color: transparent;
          color: #3498db;
          border: 1px solid #3498db;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          margin-left: 10px;
          transition: background-color 0.3s;
        }
        .alternative-button:hover {
          background-color: rgba(52, 152, 219, 0.1);
        }
        .error-help {
          font-size: 14px;
          color: #666;
          margin-top: 24px;
          max-width: 600px;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h1 class="error-title">Navigation Error</h1>
        <p class="error-message">${errorMessage || 'There was an error loading this page.'}</p>
        <div class="error-url">${url}</div>
        <div>
          <button class="retry-button" onclick="window.location.reload()">Retry</button>
          <button class="alternative-button" onclick="window.location.href='https://www.google.com'">Go to Google</button>
        </div>
        <p class="error-help">
          If the problem persists, please try again later or check your internet connection.
        </p>
      </div>
      <script>
        // Add message handling to communicate with parent
        document.addEventListener('DOMContentLoaded', function() {
          // Retry button
          const retryButton = document.querySelector('.retry-button');
          if (retryButton) {
            retryButton.addEventListener('click', function(e) {
              e.preventDefault();
              window.parent.postMessage({ 
                type: 'cognivore-refresh-page',
                url: '${url}'
              }, '*');
            });
          }
          
          // Go to Google button
          const alternativeButton = document.querySelector('.alternative-button');
          if (alternativeButton) {
            alternativeButton.addEventListener('click', function(e) {
              e.preventDefault();
              window.parent.postMessage({ 
                type: 'cognivore-navigate', 
                url: 'https://www.google.com' 
              }, '*');
            });
          }
        });
      </script>
    </body>
    </html>
  `;
  
  // Load error page into webview
  if (browser.webview.tagName.toLowerCase() === 'webview') {
    try {
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`;
      
      if (typeof browser.webview.loadURL === 'function') {
        browser.webview.loadURL(dataUrl).catch(err => {
          console.error('Failed to load error page via loadURL:', err);
          browser.webview.src = dataUrl;
        });
      } else {
        browser.webview.src = dataUrl;
      }
    } catch (err) {
      console.error('Error showing navigation error page:', err);
      // Last resort
      browser.webview.src = `data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`;
    }
  } else {
    // For iframe fallback
    browser.webview.src = `data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`;
  }
  
  // Update loading state if there's a method for it
  if (typeof browser.updateLoadingState === 'function') {
    browser.isLoading = false;
    browser.updateLoadingState(false);
  }
}

export default {
  renderErrorPage,
  showNavigationErrorPage
}; 