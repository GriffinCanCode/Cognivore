/**
 * WebviewExtractor - Extract content using Electron webview
 * 
 * This extractor uses the executeJavaScript method of Electron's webview
 * to run content extraction scripts directly in the page context.
 */

import logger from '../../../../utils/logger';

// Create a logger instance for this module
const extractorLogger = logger.scope('WebviewExtractor');

/**
 * Check if webview is ready for JavaScript execution
 * @param {Object} webview - Webview element
 * @returns {boolean} Whether webview is ready
 */
function isWebviewReady(webview) {
  if (!webview) return false;
  
  try {
    // Check if webview is connected to DOM
    if (!webview.isConnected) return false;
    
    // Check if webview has executeJavaScript method
    if (typeof webview.executeJavaScript !== 'function') return false;
    
    // For Electron webviews, try to access getWebContentsId which throws
    // if the webview is not ready
    if (typeof webview.getWebContentsId === 'function') {
      try {
        webview.getWebContentsId();
        return true;
      } catch (e) {
        // getWebContentsId throws when webview is not ready
        if (e.message && e.message.includes('must be attached to the DOM')) {
          return false;
        }
        // Other errors might not be related to readiness
        return false;
      }
    }
    
    // If we can't determine readiness explicitly, check for loaded state
    return webview.getAttribute('data-ready') === 'true';
  } catch (e) {
    extractorLogger.warn(`Error checking webview readiness: ${e.message}`);
    return false;
  }
}

/**
 * Extract content using webview's executeJavaScript
 * @param {Object} webview - Webview element
 * @param {string} url - URL to extract from
 * @returns {Promise<Object>} Extracted content
 */
async function extract(webview, url) {
  if (!isWebviewReady(webview)) {
    return Promise.reject(new Error('Webview not ready for extraction'));
  }
  
  // Extraction script to execute in webview
  const extractionScript = `
    (function() {
      try {
        // Helper to extract text with proper spacing
        function extractText(element) {
          if (!element) return '';
          
          // Clone the element to avoid modifying the actual page
          const clone = element.cloneNode(true);
          
          // Remove script and style elements that might contain unwanted text
          const scripts = clone.querySelectorAll('script, style, svg, iframe, noscript');
          scripts.forEach(s => s.remove());
          
          // Special formatting for specific elements
          const headings = clone.querySelectorAll('h1, h2, h3, h4, h5, h6');
          headings.forEach(h => {
            h.insertAdjacentHTML('beforebegin', '\\n\\n');
            h.insertAdjacentHTML('afterend', '\\n');
          });
          
          const paragraphs = clone.querySelectorAll('p, div > br');
          paragraphs.forEach(p => {
            p.insertAdjacentHTML('beforebegin', '\\n\\n');
          });
          
          const listItems = clone.querySelectorAll('li');
          listItems.forEach(li => {
            li.insertAdjacentHTML('beforebegin', '\\n• ');
          });
          
          return clone.textContent.replace(/\\s+/g, ' ').trim();
        }
        
        // Detect page type for special handling
        const hostname = window.location.hostname;
        const isWikipedia = hostname.includes('wikipedia.org');
        const isGitHub = hostname.includes('github.com');
        const isStackOverflow = hostname.includes('stackoverflow.com');
        const isBritannica = hostname.includes('britannica.com');
        
        // Find main content area based on page type or common selectors
        let mainContentElement = null;
        let extractionMethod = 'general';
        
        if (isWikipedia) {
          // Wikipedia-specific extraction
          mainContentElement = document.getElementById('mw-content-text') || 
                               document.querySelector('.mw-parser-output');
          extractionMethod = 'wikipedia';
        } else if (isBritannica) {
          // Britannica-specific extraction
          mainContentElement = document.getElementById('content') ||
                               document.querySelector('article') ||
                               document.querySelector('.md-article-body');
          extractionMethod = 'britannica';
        } else if (isGitHub) {
          // GitHub-specific extraction
          mainContentElement = document.querySelector('.repository-content') || 
                               document.querySelector('#readme') ||
                               document.querySelector('.markdown-body');
          extractionMethod = 'github';
        } else if (isStackOverflow) {
          // Stack Overflow-specific extraction
          mainContentElement = document.querySelector('.question') || 
                               document.querySelector('#answers');
          extractionMethod = 'stackoverflow';
        } else {
          // General content detection heuristics
          const contentSelectors = [
            'article',
            'main',
            '[role="main"]',
            '#content',
            '.content',
            '.article',
            '.post',
            '.page-content',
            '.main-content'
          ];
          
          // Find first content container with significant text
          for (const selector of contentSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              // Skip small or hidden elements
              if (el.textContent.length < 200 || 
                  el.offsetWidth === 0 || 
                  el.offsetHeight === 0) {
                continue;
              }
              
              mainContentElement = el;
              break;
            }
            
            if (mainContentElement) break;
          }
          
          // If no good content container found, use body
          if (!mainContentElement) {
            mainContentElement = document.body;
            extractionMethod = 'body-fallback';
          }
        }
        
        // Extract main text content
        const mainText = mainContentElement ? extractText(mainContentElement) : '';
        
        // Extract headings for structure
        const headingsData = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          level: parseInt(h.tagName.substring(1), 10),
          text: h.textContent.trim()
        }));
        
        // Extract links
        const linkData = Array.from(document.querySelectorAll('a[href]'))
          .filter(a => a.href && a.href.startsWith('http') && a.textContent.trim().length > 0)
          .map(a => ({
            text: a.textContent.trim(),
            url: a.href,
            title: a.title || '',
            isInternal: a.href.includes(window.location.hostname)
          }))
          .filter((link, index, self) => 
            // Remove duplicates
            index === self.findIndex(l => l.url === link.url)
          )
          .slice(0, 100); // Limit to 100 links
        
        // Extract images
        const imageData = Array.from(document.querySelectorAll('img[src]'))
          .filter(img => img.src && img.src.startsWith('http') && 
                  img.offsetWidth > 100 && img.offsetHeight > 100)
          .map(img => ({
            src: img.src,
            alt: img.alt || '',
            width: img.width,
            height: img.height
          }))
          .slice(0, 20); // Limit to 20 images
        
        // Extract metadata
        const metadata = {};
        Array.from(document.querySelectorAll('meta[name], meta[property]')).forEach(meta => {
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');
          if (name && content) {
            metadata[name] = content;
          }
        });
        
        // Extract any structured data if available
        let structuredData = [];
        try {
          const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
          jsonLdElements.forEach(element => {
            try {
              const parsed = JSON.parse(element.textContent);
              structuredData.push(parsed);
            } catch (e) {
              // Skip invalid JSON
            }
          });
        } catch (e) {
          // Ignore errors in structured data extraction
        }
        
        // Return final extraction result
        return {
          title: document.title || '',
          url: window.location.href,
          text: mainText,
          headings: headingsData,
          links: linkData,
          images: imageData,
          metadata,
          structuredData,
          mainContent: mainContentElement ? mainContentElement.innerHTML : document.body.innerHTML,
          extractionMethod,
          timestamp: new Date().toISOString(),
          success: mainText.length > 0
        };
      } catch (error) {
        return {
          error: true,
          message: error.message || 'Unknown error in content extraction',
          stack: error.stack,
          title: document.title || 'Error Page',
          url: window.location.href,
          timestamp: new Date().toISOString(),
          success: false
        };
      }
    })();
  `;
  
  try {
    return await webview.executeJavaScript(extractionScript);
  } catch (error) {
    extractorLogger.error(`WebviewExtractor error: ${error.message}`);
    throw new Error(`WebviewExtractor failed: ${error.message}`);
  }
}

// Export methods
const WebviewExtractor = {
  isWebviewReady,
  extract
};

export default WebviewExtractor; 