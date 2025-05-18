/**
 * ReadabilityAdapter - Adapter for Mozilla's Readability library
 * 
 * This utility provides methods to use Mozilla's Readability library
 * for content extraction outside of a browser context.
 */

import logger from '../../../../utils/logger';
import { Readability, isProbablyReaderable } from '@mozilla/readability';
import DOMPurify from 'dompurify';

// Create a logger instance for this module
const adapterLogger = logger.scope('ReadabilityAdapter');

// State flag to track if Readability is available
let readabilityLoaded = false;

/**
 * Check if Readability library is available
 * @returns {boolean} Readability availability
 */
function isAvailable() {
  return readabilityLoaded || typeof Readability === 'function';
}

/**
 * Load Readability library if not already loaded
 * @returns {Promise<boolean>} Success state
 */
async function loadReadabilityLibrary() {
  if (isAvailable()) {
    adapterLogger.info('Readability library already loaded');
    return true;
  }
  
  try {
    adapterLogger.info('Loading Readability library');
    // Readability should be imported at the top of the file via ES modules
    // This function is mainly for compatibility with older code or dynamic loading
    readabilityLoaded = true;
    return true;
  } catch (error) {
    adapterLogger.error(`Error loading Readability library: ${error.message}`, error);
    return false;
  }
}

/**
 * Extract article content from HTML using Readability
 * @param {string} html - HTML content
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted article data
 */
function extractArticle(html, options = {}) {
  if (!html) {
    return {
      success: false,
      error: 'No HTML content provided'
    };
  }
  
  try {
    // Create a document object from HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Sanitize the document to prevent XSS if needed
    const sanitizedDoc = DOMPurify.sanitize(doc.documentElement.outerHTML, { 
      RETURN_DOM: true, 
      SANITIZE_DOM: true 
    });
    
    // Check if content is likely readable
    const isReadable = isProbablyReaderable(sanitizedDoc);
    
    // Process with Readability
    const reader = new Readability(sanitizedDoc, options);
    const article = reader.parse();
    
    if (!article) {
      adapterLogger.warn('Readability could not extract article content');
      return {
        success: false,
        error: 'Readability could not extract article content',
        isReadable
      };
    }
    
    return {
      success: true,
      title: article.title,
      byline: article.byline,
      siteName: article.siteName,
      excerpt: article.excerpt,
      textContent: article.textContent,
      content: article.content,
      length: article.length,
      isReadable
    };
  } catch (error) {
    adapterLogger.error(`Error extracting article with Readability: ${error.message}`, error);
    return {
      success: false,
      error: `Error extracting article: ${error.message}`
    };
  }
}

/**
 * Check if content is likely readable
 * @param {string} html - HTML content to check
 * @returns {boolean} Readability likelihood
 */
function isReadable(html) {
  if (!html) return false;
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return isProbablyReaderable(doc);
  } catch (error) {
    adapterLogger.error(`Error checking readability: ${error.message}`, error);
    return false;
  }
}

/**
 * Create a simplified version of the document for Readability
 * @param {string} html - HTML content
 * @returns {Document} Simplified document
 */
function prepareDocument(html) {
  if (!html) return null;
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove scripts, styles, and other noise
    const elementsToRemove = [
      'script', 'style', 'iframe', 'canvas', 'svg',
      'noscript', 'form', 'aside', 'header', 'footer'
    ];
    
    elementsToRemove.forEach(selector => {
      const elements = doc.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        elements[i].remove();
      }
    });
    
    return doc;
  } catch (error) {
    adapterLogger.error(`Error preparing document for Readability: ${error.message}`, error);
    return null;
  }
}

// Export methods
const ReadabilityAdapter = {
  isAvailable,
  loadReadabilityLibrary,
  extractArticle,
  isReadable,
  prepareDocument
};

export default ReadabilityAdapter; 