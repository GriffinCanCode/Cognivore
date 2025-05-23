/**
 * FetchExtractor - Extract content using fetch API
 * 
 * This extractor uses the browser's fetch API to retrieve content
 * from URLs and then processes it to extract meaningful data.
 * It now supports fallback to server-side fetching via IPC to bypass CSP.
 */

import logger from '../../../../utils/logger';
import ContentValidator from '../utils/ContentValidator';

// Create a logger instance for this module
const extractorLogger = logger.scope('FetchExtractor');

/**
 * Extract content using fetch API
 * @param {string} url - URL to fetch content from
 * @returns {Promise<Object>} Promise resolving to extracted content
 */
async function extract(url) {
  if (!url) {
    return Promise.reject(new Error('No URL provided for fetch extraction'));
  }
  
  try {
    extractorLogger.info(`Extracting content via fetch from ${url}`);
    
    // Try browser fetch first
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Cognivore/1.0; +https://cognivore.app)'
        },
        credentials: 'omit',
        redirect: 'follow',
        mode: 'cors'
      });
      
      if (response.ok) {
        return processResponse(response, url);
      }
      
      extractorLogger.warn(`Browser fetch failed with status: ${response.status}, trying IPC fetch`);
    } catch (browserFetchError) {
      extractorLogger.warn(`Browser fetch error (possibly CSP): ${browserFetchError.message}, trying IPC fetch`);
    }
    
    // If browser fetch fails, try IPC-based server fetch (bypasses CSP)
    if (window.electron && window.electron.ipcRenderer) {
      try {
        extractorLogger.info(`Attempting server-side fetch via IPC for ${url}`);
        
        const result = await window.electron.ipcRenderer.invoke('server-fetch', { 
          url,
          options: {
            bypassCSP: true,
            timeout: 30000,
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
          }
        });
        
        if (!result) {
          throw new Error('Empty response from server-fetch');
        }
        
        if (result.error) {
          throw new Error(`Server fetch error: ${result.error}`);
        }
        
        // Process the data based on content type
        const contentType = result.contentType || '';
        
        if (contentType.includes('text/html')) {
          extractorLogger.info(`Successfully fetched HTML content (${result.data.length} bytes) via IPC`);
          return extractFromHtml(result.data, url);
        } else if (contentType.includes('application/json')) {
          extractorLogger.info(`Successfully fetched JSON content via IPC`);
          return extractFromJson(JSON.parse(result.data), url);
        } else if (contentType.includes('text/plain')) {
          extractorLogger.info(`Successfully fetched text content via IPC`);
          return extractFromText(result.data, url);
        } else {
          throw new Error(`Unsupported content type: ${contentType}`);
        }
      } catch (ipcError) {
        extractorLogger.error(`IPC fetch error: ${ipcError.message}`);
        throw ipcError;
      }
    } else {
      extractorLogger.error('Browser fetch failed and IPC not available (electron.ipcRenderer not found) for fallback');
      throw new Error('Browser fetch failed and IPC not available for fallback');
    }
  } catch (error) {
    extractorLogger.error(`FetchExtractor error: ${error.message}`);
    throw new Error(`FetchExtractor failed: ${error.message}`);
  }
}

/**
 * Process fetch response based on content type
 * @param {Response} response - Fetch response object
 * @param {string} url - Original URL
 * @returns {Promise<Object>} Extracted content
 */
async function processResponse(response, url) {
  const contentType = response.headers.get('content-type') || '';
  
  // Handle different content types
  if (contentType.includes('text/html')) {
    return extractFromHtml(await response.text(), url);
  } else if (contentType.includes('application/json')) {
    return extractFromJson(await response.json(), url);
  } else if (contentType.includes('text/plain')) {
    return extractFromText(await response.text(), url);
  } else {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
}

/**
 * Extract content from HTML
 * @param {string} html - HTML content
 * @param {string} url - URL of the content
 * @returns {Object} Extracted content
 */
function extractFromHtml(html, url) {
  if (!html) {
    throw new Error('No HTML content to extract from');
  }
  
  try {
    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract title
    const title = doc.title || '';
    
    // Extract text content
    let text = doc.body ? doc.body.textContent : '';
    text = text.replace(/\s+/g, ' ').trim();
    
    // Extract headings
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => ({
        level: parseInt(h.tagName.substring(1), 10),
        text: h.textContent.trim()
      }));
    
    // Extract links
    const links = Array.from(doc.querySelectorAll('a[href]'))
      .filter(a => a.href && a.href.startsWith('http'))
      .map(a => ({
        text: a.textContent.trim(),
        url: a.href,
        title: a.getAttribute('title') || ''
      }))
      .filter((link, index, self) => 
        index === self.findIndex(l => l.url === link.url)
      )
      .slice(0, 100); // Limit to 100 links
    
    // Extract metadata
    const metadata = {};
    doc.querySelectorAll('meta[name], meta[property]').forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        metadata[name] = content;
      }
    });
    
    // Format result
    const result = {
      title,
      text,
      html: doc.body ? doc.body.innerHTML : '',
      url,
      headings,
      links,
      metadata,
      extractionMethod: 'fetch-html',
      timestamp: new Date().toISOString(),
      extractionSuccess: ContentValidator.validateTextQuality(text).valid
    };
    
    return result;
  } catch (error) {
    extractorLogger.error(`HTML extraction error: ${error.message}`);
    throw error;
  }
}

/**
 * Extract content from JSON
 * @param {Object} json - JSON content
 * @param {string} url - URL of the content
 * @returns {Object} Extracted content
 */
function extractFromJson(json, url) {
  if (!json) {
    throw new Error('No JSON content to extract from');
  }
  
  try {
    // Try to find title in common JSON fields
    const title = json.title || json.name || json.heading || '';
    
    // Try to find text content in common JSON fields
    const textFields = ['content', 'text', 'description', 'body', 'article'];
    let text = '';
    
    for (const field of textFields) {
      if (json[field] && typeof json[field] === 'string') {
        text = json[field];
        break;
      }
    }
    
    // Format result
    return {
      title,
      text,
      url,
      json: json, // Include original JSON
      extractionMethod: 'fetch-json',
      timestamp: new Date().toISOString(),
      extractionSuccess: !!(title || text)
    };
  } catch (error) {
    extractorLogger.error(`JSON extraction error: ${error.message}`);
    throw error;
  }
}

/**
 * Extract content from plain text
 * @param {string} text - Plain text content
 * @param {string} url - URL of the content
 * @returns {Object} Extracted content
 */
function extractFromText(text, url) {
  if (!text) {
    throw new Error('No text content to extract from');
  }
  
  try {
    // Try to find a title (first line or null)
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const title = lines.length > 0 ? lines[0] : '';
    
    // Format result
    return {
      title,
      text,
      url,
      extractionMethod: 'fetch-text',
      timestamp: new Date().toISOString(),
      extractionSuccess: text.length > 0
    };
  } catch (error) {
    extractorLogger.error(`Text extraction error: ${error.message}`);
    throw error;
  }
}

// Export methods
const FetchExtractor = {
  extract,
  extractFromHtml,
  extractFromJson,
  extractFromText,
  processResponse
};

export default FetchExtractor; 