/**
 * ReadabilityExtractor - Extract content using Mozilla's Readability
 * 
 * This extractor uses Mozilla's Readability library to extract clean,
 * reader-friendly content from web pages.
 */

import logger from '../../../../utils/logger';
import ReadabilityAdapter from '../utils/ReadabilityAdapter';

// Create a logger instance for this module
const extractorLogger = logger.scope('ReadabilityExtractor');

/**
 * Extract content using Readability from webview
 * @param {Object} webview - Webview element
 * @param {string} url - URL to extract from
 * @returns {Promise<Object>} Extracted content
 */
async function extract(webview, url) {
  if (!webview || typeof webview.executeJavaScript !== 'function') {
    return Promise.reject(new Error('Invalid webview object for Readability extraction'));
  }
  
  extractorLogger.info(`Extracting content with Readability from ${url}`);
  
  // Injection script that loads Readability if needed and extracts content
  const extractionScript = `
    (async function() {
      try {
        // Check if Readability is already available
        if (typeof Readability !== 'function') {
          // Load Readability library - try local version first, then CDN
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            // Try to load from node_modules first
            script.src = '../../node_modules/@mozilla/readability/Readability.js';
            script.onload = resolve;
            script.onerror = () => {
              console.log('Failed to load local Readability, trying CDN fallback');
              // Fall back to CDN
              const fallbackScript = document.createElement('script');
              fallbackScript.src = 'https://unpkg.com/@mozilla/readability@0.4.4/Readability.js';
              fallbackScript.onload = resolve;
              fallbackScript.onerror = reject;
              document.head.appendChild(fallbackScript);
            };
            document.head.appendChild(script);
          });
        }
        
        // Clone document to avoid modifying the original
        const documentClone = document.cloneNode(true);
        
        // Process with Readability
        const reader = new Readability(documentClone);
        const article = reader.parse();
        
        // Extract additional metadata
        const metadata = {};
        document.querySelectorAll('meta[name], meta[property]').forEach(meta => {
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');
          if (name && content) {
            metadata[name] = content;
          }
        });
        
        // Extract links
        const links = Array.from(document.querySelectorAll('a[href]'))
          .filter(a => a.href && a.href.startsWith('http'))
          .map(a => ({
            text: a.textContent.trim(),
            url: a.href,
            title: a.getAttribute('title') || ''
          }))
          .filter((link, index, self) => 
            // Remove duplicates
            index === self.findIndex(l => l.url === link.url)
          )
          .slice(0, 100); // Limit to 100 links
        
        // Extract headings for structure
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
          .map(h => ({
            level: parseInt(h.tagName.substring(1), 10),
            text: h.textContent.trim()
          }));
        
        // Return extracted content
        return {
          title: article ? article.title : document.title,
          byline: article ? article.byline : null,
          siteName: article ? article.siteName : null,
          excerpt: article ? article.excerpt : null,
          text: article ? article.textContent : document.body.textContent,
          html: article ? article.content : document.body.innerHTML,
          url: window.location.href,
          headings,
          links,
          metadata,
          extractionMethod: article ? 'readability' : 'fallback',
          extractionSuccess: !!article,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return {
          error: true,
          message: error.message || 'Unknown error during Readability extraction',
          stack: error.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href
        };
      }
    })();
  `;
  
  try {
    return await webview.executeJavaScript(extractionScript);
  } catch (error) {
    extractorLogger.error(`ReadabilityExtractor error: ${error.message}`);
    throw new Error(`ReadabilityExtractor failed: ${error.message}`);
  }
}

/**
 * Extract content using Readability from HTML
 * @param {string} html - HTML content
 * @param {string} url - URL of the content
 * @returns {Promise<Object>} Extracted content
 */
async function extractFromHtml(html, url) {
  extractorLogger.info(`Extracting content with Readability from HTML (${url})`);
  
  try {
    // Make sure Readability is available
    if (!ReadabilityAdapter.isAvailable()) {
      await ReadabilityAdapter.loadReadabilityLibrary();
    }
    
    // Extract article using the adapter
    const article = ReadabilityAdapter.extractArticle(html);
    
    if (!article.success) {
      throw new Error(article.error || 'Failed to extract content with Readability');
    }
    
    // Parse HTML to extract additional data
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract metadata
    const metadata = {};
    doc.querySelectorAll('meta[name], meta[property]').forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        metadata[name] = content;
      }
    });
    
    // Extract links
    const links = Array.from(doc.querySelectorAll('a[href]'))
      .filter(a => a.href && a.href.startsWith('http'))
      .map(a => ({
        text: a.textContent.trim(),
        url: a.href,
        title: a.getAttribute('title') || ''
      }))
      .filter((link, index, self) => 
        // Remove duplicates
        index === self.findIndex(l => l.url === link.url)
      )
      .slice(0, 100); // Limit to 100 links
    
    // Extract headings
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => ({
        level: parseInt(h.tagName.substring(1), 10),
        text: h.textContent.trim()
      }));
    
    // Return extracted content
    return {
      title: article.title || doc.title || '',
      byline: article.byline || '',
      siteName: article.siteName || '',
      excerpt: article.excerpt || '',
      text: article.textContent || '',
      html: article.content || '',
      url: url,
      headings,
      links,
      metadata,
      extractionMethod: 'readability',
      extractionSuccess: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    extractorLogger.error(`ReadabilityExtractor HTML error: ${error.message}`);
    throw new Error(`ReadabilityExtractor HTML failed: ${error.message}`);
  }
}

// Export methods
const ReadabilityExtractor = {
  extract,
  extractFromHtml
};

export default ReadabilityExtractor; 