/**
 * ErrorPageRenderer - Renders custom error pages for browser errors
 */

/**
 * Render an error page
 * @param {Document|Object} doc - Document or browser instance to render error page in
 * @param {string} errorType - Type of error ('network', 'ssl', 'notfound', 'generic')
 * @param {Object} data - Error data including URL and error message
 */
export function renderErrorPage(doc, errorType, data) {
  if (!doc) return;
  
  try {
    // Handle both document and browser object cases
    let targetDoc = doc;
    
    // Check if we got a browser instance instead of a document
    if (doc.webview || doc.contentFrame || typeof doc.open !== 'function') {
      // This is a browser instance, not a document
      console.log('Received browser instance instead of document, finding appropriate target');
      
      if (doc.webview && typeof doc.webview.executeJavaScript === 'function') {
        // Use webview's executeJavaScript to render the error page
        const errorHTML = createErrorPageHTML(errorType, data);
        doc.webview.executeJavaScript(`
          document.open();
          document.write(${JSON.stringify(errorHTML)});
          document.close();
        `).catch(err => {
          console.error('Error rendering error page in webview:', err);
        });
        return;
      } else if (doc.contentFrame && doc.contentFrame.contentDocument) {
        // Use contentFrame's document
        targetDoc = doc.contentFrame.contentDocument;
      } else if (doc.errorContainer) {
        // If there's a dedicated error container, use innerHTML
        const errorHTML = createErrorPageHTML(errorType, data);
        doc.errorContainer.innerHTML = errorHTML;
        return;
      } else {
        // Create an error container if one doesn't exist
        const container = document.createElement('div');
        container.className = 'browser-error-container';
        container.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #f5f5f5;
          z-index: 1000;
          padding: 20px;
          overflow: auto;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        
        // Create an inner container for the error content
        const innerContainer = document.createElement('div');
        innerContainer.className = 'browser-error-content';
        innerContainer.style.cssText = `
          max-width: 600px;
          padding: 30px;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        `;
        
        // Get the appropriate error page content
        let errorContent = '';
        switch (errorType) {
          case 'network':
            errorContent = createNetworkErrorPage(data);
            break;
          case 'ssl':
            errorContent = createSSLErrorPage(data);
            break;
          case 'notfound':
            errorContent = createNotFoundErrorPage(data);
            break;
          case 'generic':
          default:
            errorContent = createGenericErrorPage(data);
            break;
        }
        
        // Set the inner HTML and append to the document
        innerContainer.innerHTML = errorContent;
        container.appendChild(innerContainer);
        
        // Append to the browser container if available
        if (doc.container && doc.container.appendChild) {
          doc.container.appendChild(container);
        } else if (doc.contentFrame && doc.contentFrame.parentNode) {
          doc.contentFrame.parentNode.appendChild(container);
        } else {
          // Last resort: append to body
          document.body.appendChild(container);
        }
        
        // Store a reference to the error container
        doc.errorContainer = container;
        return;
      }
    }
    
    // If we have a valid document with open method, use it
    if (targetDoc && typeof targetDoc.open === 'function') {
      // Clear any existing content
      targetDoc.open();
      
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
      
      // Get complete HTML document with styles
      const completeHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error</title>
          <style>
            ${getErrorPageStyles()}
          </style>
        </head>
        <body>
          ${pageContent}
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const refreshButton = document.getElementById('refresh-button');
              if (refreshButton) {
                refreshButton.addEventListener('click', function() {
                  window.location.reload();
                });
              }
              
              const backButton = document.getElementById('back-button');
              if (backButton) {
                backButton.addEventListener('click', function() {
                  window.history.back();
                });
              }
            });
          </script>
        </body>
        </html>
      `;
      
      // Write the error page content
      targetDoc.write(completeHTML);
      targetDoc.close();
    } else {
      console.error('No valid document or container to render error page');
    }
  } catch (error) {
    console.error('Error rendering error page:', error);
  }
}

/**
 * Create a complete error page HTML
 * @param {string} errorType - Type of error
 * @param {Object} data - Error data
 * @returns {string} Complete HTML document
 */
function createErrorPageHTML(errorType, data) {
  // Get error content based on type
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
  
  // Return complete HTML document
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Error</title>
      <style>
        ${getErrorPageStyles()}
      </style>
    </head>
    <body>
      ${pageContent}
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          const refreshButton = document.getElementById('refresh-button');
          if (refreshButton) {
            refreshButton.addEventListener('click', function() {
              window.location.reload();
            });
          }
          
          const backButton = document.getElementById('back-button');
          if (backButton) {
            backButton.addEventListener('click', function() {
              window.history.back();
            });
          }
        });
      </script>
    </body>
    </html>
  `;
}

/**
 * Get common error page styles
 * @returns {string} CSS styles
 */
function getErrorPageStyles() {
  return `
    html, body {
      height: 100%;
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
    h1 {
      font-size: 24px;
      margin-bottom: 16px;
      color: #e74c3c;
    }
    p {
      font-size: 16px;
      margin-bottom: 16px;
      max-width: 600px;
      line-height: 1.5;
    }
    .error-details {
      font-size: 14px;
      color: #666;
      margin-bottom: 24px;
      padding: 16px;
      background-color: #eee;
      border-radius: 4px;
      width: 100%;
      max-width: 600px;
      text-align: left;
    }
    .error-actions {
      display: flex;
      gap: 16px;
      margin-top: 24px;
    }
    button {
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      transition: background-color 0.3s;
    }
    .primary-button {
      background-color: #3498db;
      color: white;
      border: none;
    }
    .primary-button:hover {
      background-color: #2980b9;
    }
    .secondary-button {
      background-color: transparent;
      color: #3498db;
      border: 1px solid #3498db;
    }
    .secondary-button:hover {
      background-color: rgba(52, 152, 219, 0.1);
    }
  `;
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