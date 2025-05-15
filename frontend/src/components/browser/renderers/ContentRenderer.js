/**
 * ContentRenderer - Renders proxied web content in various formats
 */
import { sanitizeHTML, handleContentCSS, handleContentJavaScript } from '../utils/ContentUtils.js';

/**
 * Render content fetched through a proxy
 * @param {HTMLIFrameElement} contentFrame - The iframe to render content in
 * @param {string} content - HTML content
 * @param {string} baseUrl - Base URL for relative links
 * @param {string} contentType - Content type header
 * @param {string} sandboxLevel - Security sandbox level
 */
export function renderProxiedContent(contentFrame, content, baseUrl, contentType, sandboxLevel) {
  if (!contentFrame) return;
  
  try {
    // Sanitize content first
    const sanitizedContent = sanitizeHTML(content);
    
    // Access the iframe document
    const doc = contentFrame.contentDocument;
    if (!doc) {
      console.error('Cannot access iframe document');
      return;
    }
    
    // Clear any existing content
    doc.open();
    
    // Insert the base tag to handle relative URLs
    const baseTag = `<base href="${baseUrl}">`;
    
    // Add content to document
    let htmlWithBase = sanitizedContent;
    
    // Add base tag if not already present
    if (!htmlWithBase.includes('<base')) {
      htmlWithBase = htmlWithBase.replace('<head>', `<head>${baseTag}`);
    }
    
    // Special handling for non-HTML content
    if (contentType && !contentType.includes('html')) {
      htmlWithBase = formatSpecialContent(content, contentType, baseUrl, baseTag);
    }
    
    // Write content to document
    doc.write(htmlWithBase);
    doc.close();
    
    // Apply CSS and JavaScript handling
    handleContentCSS(doc, baseUrl);
    handleContentJavaScript(doc, sandboxLevel);
    
    return true;
  } catch (error) {
    console.error('Error rendering proxied content:', error);
    return false;
  }
}

/**
 * Format special content types (JSON, plain text, images)
 * @param {string} content - Content to format
 * @param {string} contentType - Content type
 * @param {string} baseUrl - Base URL
 * @param {string} baseTag - HTML base tag
 * @returns {string} Formatted HTML
 */
function formatSpecialContent(content, contentType, baseUrl, baseTag) {
  if (contentType.includes('json')) {
    // Format JSON content
    try {
      const jsonData = JSON.parse(content);
      const formattedJson = JSON.stringify(jsonData, null, 2);
      
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${baseTag}
          <title>JSON Data</title>
          <style>
            body { font-family: monospace; white-space: pre; }
            pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; }
          </style>
        </head>
        <body>
          <pre>${formattedJson}</pre>
        </body>
        </html>
      `;
    } catch (e) {
      console.error('Error parsing JSON:', e);
    }
  } else if (contentType.includes('text/plain')) {
    // Format plain text content
    const escapedText = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseTag}
        <title>Text Content</title>
        <style>
          body { font-family: monospace; white-space: pre-wrap; word-break: break-word; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; }
        </style>
      </head>
      <body>
        <pre>${escapedText}</pre>
      </body>
      </html>
    `;
  } else if (contentType.includes('image/')) {
    // Display image content
    const imageUrl = baseUrl;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseTag}
        <title>Image</title>
        <style>
          body { 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
            flex-direction: column;
          }
          img { 
            max-width: 100%; 
            max-height: 90vh;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          }
          .url {
            margin-top: 1rem;
            font-family: monospace;
            color: #555;
          }
        </style>
      </head>
      <body>
        <img src="${imageUrl}" alt="Image content">
        <div class="url">${imageUrl}</div>
      </body>
      </html>
    `;
  }
  
  // Default - return original content
  return content;
}

/**
 * Create a fallback content placeholder for environments with restrictions
 * @param {Object} browser - Browser instance for event handlers
 * @returns {HTMLElement} The browser placeholder element
 */
export function createBrowserPlaceholder(browser) {
  const placeholder = document.createElement('div');
  placeholder.className = 'browser-placeholder';
  
  // Set full-height styles
  placeholder.style.position = 'absolute';
  placeholder.style.top = '0';
  placeholder.style.left = '0';
  placeholder.style.width = '100%';
  placeholder.style.height = '100%';
  
  // Skip showing placeholder in Electron app
  if (window.isElectron === true || (browser && browser.isElectronApp)) {
    placeholder.style.display = 'none';
    return placeholder;
  }
  
  placeholder.innerHTML = `
    <h3>Browser functionality restricted</h3>
    <p>Full web browsing is available in the Electron app version.</p>
    <p>Web content loading is restricted in browser environments due to security policies.</p>
    <div class="browser-buttons">
      <button class="open-external-btn">Open in system browser</button>
      <button class="browser-try-anyway-btn">Try basic browsing</button>
    </div>
  `;
  
  // Add event listeners directly if browser instance is provided
  if (browser) {
    // Open in external browser button
    const openExternalButton = placeholder.querySelector('.open-external-btn');
    if (openExternalButton) {
      openExternalButton.addEventListener('click', () => {
        if (browser.currentUrl) {
          window.open(browser.currentUrl, '_blank');
        } else {
          window.open('https://www.google.com', '_blank');
        }
      });
    }
    
    // Try basic browsing button
    const tryAnywayButton = placeholder.querySelector('.browser-try-anyway-btn');
    if (tryAnywayButton) {
      tryAnywayButton.addEventListener('click', () => {
        if (typeof browser.tryBasicBrowsing === 'function') {
          browser.tryBasicBrowsing();
        }
      });
    }
  }
  
  return placeholder;
}

/**
 * Load content directly into webview with enhanced display handling
 * @param {HTMLElement} webview - The webview element 
 * @param {string} url - URL to load
 * @returns {Promise<void>}
 */
export async function loadContentDirectly(webview, url) {
  console.log('🔄 loadContentDirectly: Loading direct content for:', url);
  
  if (!webview || !url) {
    console.error('Cannot load content - missing webview or URL');
    return Promise.reject(new Error('Missing webview or URL'));
  }
  
  try {
    // Create a wrapper HTML that properly sets up the content display
    const wrapper = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Loading ${url}</title>
        <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; frame-src *; connect-src *">
        <style>
          html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
            display: block !important;
          }
          
          iframe {
            width: 100%;
            height: 100%;
            border: none;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          }
          
          .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: #fff;
            z-index: 1000;
            transition: opacity 0.5s ease-in-out;
          }
          
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top-color: #3498db;
            animation: spin 1s linear infinite;
            margin-bottom: 15px;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          .message {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #333;
            text-align: center;
            max-width: 80%;
          }
        </style>
      </head>
      <body>
        <div class="loading" id="loadingIndicator">
          <div class="spinner"></div>
          <div class="message">
            <p>Loading content from ${url}</p>
            <p id="loadingStatus">Initializing...</p>
          </div>
        </div>
        
        <iframe id="contentFrame" src="${url}" allowfullscreen sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-top-navigation-by-user-activation"></iframe>
        
        <script>
          // Wait for content to load
          const frame = document.getElementById('contentFrame');
          const loadingIndicator = document.getElementById('loadingIndicator');
          const loadingStatus = document.getElementById('loadingStatus');
          let loadingProgress = 0;
          
          // Update loading status periodically
          const updateInterval = setInterval(() => {
            loadingProgress += 10;
            if (loadingProgress <= 100) {
              loadingStatus.textContent = 'Loading: ' + loadingProgress + '%';
            }
          }, 300);
          
          // Hide loading indicator when iframe is loaded
          frame.onload = function() {
            // Clear the update interval
            clearInterval(updateInterval);
            
            // Update loading indicator
            loadingStatus.textContent = 'Content loaded!';
            
            // Wait a moment, then fade out the loading indicator
            setTimeout(() => {
              loadingIndicator.style.opacity = '0';
              
              // Once faded, remove it from DOM
              setTimeout(() => {
                loadingIndicator.style.display = 'none';
              }, 500);
            }, 500);
            
            // Notify parent that we have loaded
            try {
              window.parent.postMessage({
                type: 'content-loaded',
                url: '${url}'
              }, '*');
            } catch (e) {
              console.error('Failed to send load message:', e);
            }
          };
          
          // Check for navigation events in the iframe
          frame.addEventListener('load', function() {
            try {
              window.parent.postMessage({
                type: 'iframe-navigation',
                url: frame.contentWindow.location.href || '${url}'
              }, '*');
            } catch (e) {
              // If we can't access frame.contentWindow.location due to cross-origin,
              // just send the initial URL
              window.parent.postMessage({
                type: 'iframe-navigation',
                url: '${url}'
              }, '*');
            }
          });
          
          // In case of errors, still hide loading after a timeout
          setTimeout(() => {
            loadingIndicator.style.opacity = '0';
            setTimeout(() => {
              loadingIndicator.style.display = 'none';
            }, 500);
          }, 8000);
        </script>
      </body>
      </html>
    `;
    
    // Create data URL from wrapper HTML
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(wrapper)}`;
    console.log('📝 Using loadURL to load data URL with iframe');
    
    // Use the appropriate loading method based on webview type
    if (webview.tagName.toLowerCase() === 'webview' && typeof webview.loadURL === 'function') {
      await webview.loadURL(dataUrl);
    } else {
      webview.src = dataUrl;
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error loading content directly:', error);
    return Promise.reject(error);
  }
}

export default {
  renderProxiedContent,
  createBrowserPlaceholder,
  loadContentDirectly
}; 