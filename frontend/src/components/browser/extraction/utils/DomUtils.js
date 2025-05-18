/**
 * DomUtils - Utilities for DOM manipulation and conversion
 * 
 * This utility provides methods for working with DOM elements,
 * including conversion to JSON representation and cleaning functions.
 */

import logger from '../../../../utils/logger';

// Create a logger instance for this module
const domLogger = logger.scope('DomUtils');

/**
 * Convert DOM element to a JSON representation (jsondomify)
 * @param {Element} element - DOM element to convert
 * @param {Object} options - Conversion options
 * @returns {Object} JSON representation of DOM
 */
function domToJson(element, options = {}) {
  if (!element) return null;
  
  try {
    const {
      maxDepth = 5,
      includeContent = true,
      includeAttributes = true,
      excludeTags = ['script', 'style', 'noscript', 'svg', 'iframe']
    } = options;
    
    function processNode(node, depth = 0) {
      // Respect maximum depth
      if (depth > maxDepth) return null;
      
      // Skip excluded tag types
      if (node.nodeType === Node.ELEMENT_NODE && 
          excludeTags.includes(node.tagName.toLowerCase())) {
        return null;
      }
      
      // Process based on node type
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        return text ? { type: 'text', content: text } : null;
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const result = {
          type: 'element',
          tagName: node.tagName.toLowerCase()
        };
        
        // Add attributes if requested
        if (includeAttributes && node.attributes && node.attributes.length > 0) {
          result.attributes = {};
          for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            result.attributes[attr.name] = attr.value;
          }
        }
        
        // Add children
        const children = [];
        for (let i = 0; i < node.childNodes.length; i++) {
          const childResult = processNode(node.childNodes[i], depth + 1);
          if (childResult) children.push(childResult);
        }
        
        if (children.length > 0) {
          result.children = children;
        } else if (includeContent && node.textContent.trim()) {
          result.textContent = node.textContent.trim();
        }
        
        return result;
      }
      
      return null;
    }
    
    return processNode(element);
  } catch (error) {
    domLogger.error(`Error converting DOM to JSON: ${error.message}`, error);
    return null;
  }
}

/**
 * Clean DOM element by removing unwanted nodes
 * @param {Element} element - DOM element to clean
 * @param {Object} options - Cleaning options
 * @returns {Element} Cleaned element
 */
function cleanDom(element, options = {}) {
  if (!element) return null;
  
  try {
    const {
      removeSelectors = ['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'aside'],
      removeHidden = true,
      removeEmpty = true,
      unwrapNested = false
    } = options;
    
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true);
    
    // Remove elements matching selectors
    removeSelectors.forEach(selector => {
      const elements = clone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // Remove hidden elements
    if (removeHidden) {
      const hiddenElements = clone.querySelectorAll(
        '[style*="display: none"], [style*="display:none"], [style*="visibility: hidden"], [style*="visibility:hidden"], [hidden]'
      );
      hiddenElements.forEach(el => el.remove());
    }
    
    // Remove empty elements (no text content)
    if (removeEmpty) {
      const allElements = clone.querySelectorAll('*');
      for (let i = allElements.length - 1; i >= 0; i--) {
        const el = allElements[i];
        if (el.textContent.trim() === '' && !el.querySelector('img')) {
          el.remove();
        }
      }
    }
    
    // Unwrap unnecessary nested containers
    if (unwrapNested) {
      const containers = clone.querySelectorAll('div > div:only-child, section > div:only-child');
      containers.forEach(el => {
        if (el.parentNode && !el.id && !el.className) {
          while (el.firstChild) {
            el.parentNode.insertBefore(el.firstChild, el);
          }
          el.remove();
        }
      });
    }
    
    return clone;
  } catch (error) {
    domLogger.error(`Error cleaning DOM: ${error.message}`, error);
    return element;
  }
}

/**
 * Extract important DOM elements based on content relevance
 * @param {Document} document - Document to analyze
 * @returns {Element} Most relevant content element
 */
function extractMainContent(document) {
  if (!document || !document.body) return null;
  
  try {
    // First try common content selectors
    const contentSelectors = [
      'article', 'main', '[role="main"]', '.article', '.post-content',
      '.entry-content', '#content', '.content', '.main-content'
    ];
    
    for (const selector of contentSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 1) {
        return elements[0];
      } else if (elements.length > 1) {
        // Find the one with most text
        return Array.from(elements)
          .sort((a, b) => b.textContent.length - a.textContent.length)[0];
      }
    }
    
    // No standard content container found, use heuristics
    
    // Count paragraphs in each div
    const divs = document.querySelectorAll('div');
    const divScores = Array.from(divs).map(div => {
      const paragraphs = div.querySelectorAll('p');
      const textLength = div.textContent.length;
      const linkRatio = div.querySelectorAll('a').length / 
                       (div.textContent.length || 1);
      
      // Higher score for more paragraphs, more text, and lower link ratio
      return {
        element: div,
        score: (paragraphs.length * 10) + (textLength / 100) - (linkRatio * 50)
      };
    });
    
    // Sort by score and return the highest
    const sortedDivs = divScores.sort((a, b) => b.score - a.score);
    
    return sortedDivs.length > 0 ? sortedDivs[0].element : document.body;
  } catch (error) {
    domLogger.error(`Error extracting main content: ${error.message}`, error);
    return document.body;
  }
}

// Export methods
const DomUtils = {
  domToJson,
  cleanDom,
  extractMainContent
};

export default DomUtils; 