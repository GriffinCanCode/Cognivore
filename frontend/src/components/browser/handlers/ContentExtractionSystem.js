/**
 * ContentExtractionSystem.js - Robust content extraction with multiple fallback mechanisms
 * 
 * This system provides several methods for extracting content from web pages in order of preference:
 * 1. Direct webview execution (when webview is ready)
 * 2. IPC-based extraction via main process
 * 3. DOM proxy extraction
 * 4. Simple metadata extraction
 */

import logger from '../../../utils/logger';

// Create a logger instance for this module
const extractionLogger = logger.scope('ContentExtraction');

/**
 * Extract content using the most appropriate method available
 * @param {Object} browser - Browser instance
 * @param {string} url - Current URL
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Promise resolving to extracted content
 */
export async function extractContent(browser, url, options = {}) {
  extractionLogger.info(`Extracting content from ${url} with ${options.preferredMethod || 'auto'} method`);
  
  // Determine actual URL if not provided
  const targetUrl = url || (browser && browser.currentUrl) || '';
  if (!targetUrl) {
    return Promise.reject(new Error('No URL provided for content extraction'));
  }
  
  // Record start time for performance tracking
  const startTime = Date.now();
  
  try {
    // Try extraction methods in order of preference
    let result = null;
    
    // Method 1: Direct webview execution (if available and ready)
    if (!options.skipWebview && browser && browser.webview && isWebviewReady(browser.webview)) {
      extractionLogger.info('Attempting extraction via direct webview execution');
      try {
        result = await extractViaWebview(browser.webview, targetUrl);
        if (isValidExtractionResult(result)) {
          extractionLogger.info(`Webview extraction successful in ${Date.now() - startTime}ms`);
          return enhanceContent(result, targetUrl);
        }
      } catch (e) {
        extractionLogger.warn(`Webview extraction failed: ${e.message}, trying next method`);
      }
    }
    
    // Method 2: IPC-based extraction (if available)
    if (!options.skipIpc && window.ipcRenderer && typeof window.ipcRenderer.invoke === 'function') {
      extractionLogger.info('Attempting extraction via IPC to main process');
      try {
        result = await extractViaIpc(targetUrl);
        if (isValidExtractionResult(result)) {
          extractionLogger.info(`IPC extraction successful in ${Date.now() - startTime}ms`);
          return enhanceContent(result, targetUrl);
        }
      } catch (e) {
        extractionLogger.warn(`IPC extraction failed: ${e.message}, trying next method`);
      }
    }
    
    // Method 3: DOM Proxy (if browser has contentFrame)
    if (!options.skipDomProxy && browser && browser.contentFrame) {
      extractionLogger.info('Attempting extraction via content frame');
      try {
        result = extractViaDomProxy(browser.contentFrame, targetUrl);
        if (isValidExtractionResult(result)) {
          extractionLogger.info(`DOM proxy extraction successful in ${Date.now() - startTime}ms`);
          return enhanceContent(result, targetUrl);
        }
      } catch (e) {
        extractionLogger.warn(`DOM proxy extraction failed: ${e.message}, trying next method`);
      }
    }
    
    // Method 4: Fetch API (for public pages, as last resort)
    if (!options.skipFetch && targetUrl.startsWith('http') && 
        !targetUrl.includes('localhost') && !isIntranetUrl(targetUrl)) {
      extractionLogger.info('Attempting extraction via background fetch');
      try {
        result = await extractViaFetch(targetUrl);
        if (isValidExtractionResult(result)) {
          extractionLogger.info(`Fetch extraction successful in ${Date.now() - startTime}ms`);
          return enhanceContent(result, targetUrl);
        }
      } catch (e) {
        extractionLogger.warn(`Fetch extraction failed: ${e.message}, falling back to minimal info`);
      }
    }
    
    // Last resort: Return minimal information
    extractionLogger.warn('All extraction methods failed, returning minimal information');
    return {
      title: getPageTitle(browser) || 'Unknown Page',
      text: 'Content extraction failed. The page may be protected or require authentication.',
      url: targetUrl,
      extractionMethod: 'fallback',
      extractionSuccess: false
    };
  } catch (error) {
    extractionLogger.error(`Content extraction error: ${error.message}`, error);
    
    // Return error information in a structured format
    return {
      title: getPageTitle(browser) || 'Unknown Page',
      text: `Error extracting content: ${error.message}`,
      url: targetUrl,
      error: error.message,
      extractionMethod: 'error',
      extractionSuccess: false
    };
  }
}

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
    extractionLogger.warn(`Error checking webview readiness: ${e.message}`);
    return false;
  }
}

/**
 * Extract content using webview's executeJavaScript
 * @param {Object} webview - Webview element
 * @param {string} url - URL to extract from
 * @returns {Promise<Object>} Extracted content
 */
async function extractViaWebview(webview, url) {
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
        
        // Find main content area based on page type or common selectors
        let mainContentElement = null;
        let extractionMethod = 'general';
        
        if (isWikipedia) {
          // Wikipedia-specific extraction
          mainContentElement = document.getElementById('mw-content-text') || 
                               document.querySelector('.mw-parser-output');
          extractionMethod = 'wikipedia';
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
  
  return webview.executeJavaScript(extractionScript);
}

/**
 * Extract content via IPC to the main process
 * @param {string} url - URL to extract content from
 * @returns {Promise<Object>} Extracted content
 */
async function extractViaIpc(url) {
  if (!window.ipcRenderer || !url) {
    return Promise.reject(new Error('IPC or URL not available'));
  }
  
  const result = await window.ipcRenderer.invoke('extract-page-content', url);
  
  if (!result || result.error) {
    throw new Error(result?.error || 'Failed to extract content via IPC');
  }
  
  return {
    title: result.title || 'Unknown Title',
    text: result.content || '',
    url: url,
    metadata: result.metadata || {},
    extractionMethod: 'ipc',
    timestamp: new Date().toISOString(),
    success: !!result.content
  };
}

/**
 * Extract content via DOM proxy from contentFrame
 * @param {Object} contentFrame - Content frame reference
 * @param {string} url - URL to extract from
 * @returns {Object} Extracted content
 */
function extractViaDomProxy(contentFrame, url) {
  try {
    const contentDoc = contentFrame.contentDocument;
    
    if (!contentDoc) {
      throw new Error('Cannot access content frame document');
    }
    
    // Extract basic content
    const textContent = contentDoc.body ? contentDoc.body.textContent : '';
    const title = contentDoc.title || '';
    
    // Extract metadata
    const metadata = {};
    const metaTags = contentDoc.querySelectorAll('meta[name], meta[property]');
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        metadata[name] = content;
      }
    });
    
    return {
      title,
      text: textContent,
      url,
      metadata,
      extractionMethod: 'dom-proxy',
      timestamp: new Date().toISOString(),
      success: textContent.length > 0
    };
  } catch (error) {
    extractionLogger.error(`DOM proxy extraction error: ${error.message}`);
    throw error;
  }
}

/**
 * Extract content via background fetch request
 * @param {string} url - URL to fetch content from
 * @returns {Promise<Object>} Extracted content
 */
async function extractViaFetch(url) {
  try {
    // Use a proxy for CORS if needed
    const response = await fetch(`https://cors-anywhere.herokuapp.com/${url}`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Use DOMParser to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract text content
    const textContent = doc.body ? doc.body.textContent.replace(/\s+/g, ' ').trim() : '';
    const title = doc.title || '';
    
    // Extract metadata
    const metadata = {};
    const metaTags = doc.querySelectorAll('meta[name], meta[property]');
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        metadata[name] = content;
      }
    });
    
    return {
      title,
      text: textContent,
      url,
      metadata,
      extractionMethod: 'fetch',
      timestamp: new Date().toISOString(),
      success: textContent.length > 0
    };
  } catch (error) {
    extractionLogger.error(`Fetch extraction error: ${error.message}`);
    throw error;
  }
}

/**
 * Get page title from browser instance
 * @param {Object} browser - Browser instance
 * @returns {string} Page title or empty string
 */
function getPageTitle(browser) {
  if (!browser) return '';
  
  // Get title from webview if available
  if (browser.webview && typeof browser.webview.getTitle === 'function') {
    try {
      return browser.webview.getTitle() || '';
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Get title from contentFrame if available
  if (browser.contentFrame && browser.contentFrame.contentDocument) {
    try {
      return browser.contentFrame.contentDocument.title || '';
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Get title directly from browser state
  return browser.currentTitle || '';
}

/**
 * Check if extraction result is valid
 * @param {Object} result - Extraction result to validate
 * @returns {boolean} Whether result is valid
 */
function isValidExtractionResult(result) {
  if (!result) return false;
  
  // Check for error flag
  if (result.error) return false;
  
  // Must have title or text
  return (result.title || result.text) && 
         // Text should have meaningful content
         (typeof result.text !== 'string' || result.text.length > 50);
}

/**
 * Enhance extracted content with additional derived information
 * @param {Object} content - Raw extracted content
 * @param {string} url - Source URL
 * @returns {Object} Enhanced content
 */
function enhanceContent(content, url) {
  // Ensure we have a URL
  const finalUrl = content.url || url || '';
  
  // Parse domain from URL
  let domain = '';
  try {
    domain = new URL(finalUrl).hostname;
  } catch (e) {
    // Ignore URL parsing errors
  }
  
  // Create basic summary if text is available
  let summary = '';
  const text = content.text || '';
  if (text.length > 100) {
    // Extract first paragraph as summary
    const firstParagraph = text.split(/\n\s*\n/)[0];
    summary = firstParagraph.length < 300 ? 
      firstParagraph : 
      firstParagraph.substring(0, 297) + '...';
  }
  
  // Extract most common keywords
  const keywords = extractKeywords(text);
  
  // Create word count
  const wordCount = countWords(text);
  
  // Identify content type based on patterns
  const contentType = identifyContentType(content, domain);
  
  // Return enhanced content
  return {
    ...content,
    url: finalUrl,
    domain,
    summary,
    keywords,
    wordCount,
    contentType,
    enhancedAt: new Date().toISOString()
  };
}

/**
 * Extract common keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {Array<string>} Top keywords
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'am', 'was', 'were', 
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 
    'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'to', 
    'of', 'in', 'on', 'at', 'for', 'with', 'by', 'about', 'against', 'between', 
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 
    'up', 'down', 'this', 'that', 'these', 'those', 'it', 'its', 'them', 'their'
  ]);
  
  // Split text into words, make lowercase, and filter
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && !stopWords.has(word)
    );
  
  // Count word frequency
  const wordCounts = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  // Sort by frequency and return top 10 words
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Count words in text
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Identify content type based on patterns
 * @param {Object} content - Extracted content
 * @param {string} domain - Source domain
 * @returns {string} Content type
 */
function identifyContentType(content, domain) {
  // Default to 'article'
  let type = 'article';
  
  // Check common domains
  if (domain.includes('wikipedia.org')) {
    return 'encyclopedia';
  } else if (domain.includes('github.com')) {
    return 'code-repository';
  } else if (domain.includes('stackoverflow.com') || domain.includes('stackexchange.com')) {
    return 'forum-qa';
  } else if (domain.includes('youtube.com') || domain.includes('vimeo.com')) {
    return 'video';
  } else if (domain.includes('twitter.com') || domain.includes('facebook.com') || 
            domain.includes('instagram.com') || domain.includes('linkedin.com')) {
    return 'social-media';
  } else if (domain.includes('amazon.com') || domain.includes('ebay.com') || 
            domain.includes('etsy.com') || domain.includes('shop')) {
    return 'e-commerce';
  }
  
  // Check content patterns
  const text = content.text || '';
  const title = content.title || '';
  
  if (title.includes('Documentation') || domain.includes('docs.')) {
    return 'documentation';
  } else if (text.includes('Abstract') && text.includes('References')) {
    return 'academic-paper';
  } else if (text.includes('FAQ') || title.includes('FAQ')) {
    return 'faq';
  } else if (text.match(/step\s+\d|how\s+to|guide|tutorial/i)) {
    return 'tutorial';
  } else if (text.match(/reviews|review of|rated|stars/i)) {
    return 'review';
  } else if (content.contentType === 'blog' || domain.includes('blog')) {
    return 'blog-post';
  }
  
  // Default
  return type;
}

/**
 * Check if URL is likely an intranet or private network URL
 * @param {string} url - URL to check
 * @returns {boolean} Whether URL is likely an intranet URL
 */
function isIntranetUrl(url) {
  try {
    const { hostname } = new URL(url);
    
    // Check for obvious private IPs
    if (hostname.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|::1$)/)) {
      return true;
    }
    
    // Check for reserved domains
    if (hostname.includes('.local') || 
        hostname.includes('.internal') || 
        hostname.includes('.intranet') || 
        hostname.includes('.corp') ||
        hostname.includes('.private')) {
      return true;
    }
    
    // Check for hostnames without dots (likely local)
    if (!hostname.includes('.')) {
      return true;
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

export default {
  extractContent,
  isWebviewReady
}; 