/**
 * BrowserWorker - Web Worker for browser component CPU-intensive tasks
 * 
 * This worker handles various CPU-intensive tasks for the browser component,
 * such as content extraction, DOM processing, and text analysis.
 */

// Worker context - 'self' refers to the worker global scope
const workerContext = self;

// Implement DOMParser for Web Worker context since it's not available by default
if (typeof DOMParser === 'undefined') {
  // Import the text-encoding library if needed for TextDecoder (optional)
  // importScripts('path/to/text-encoding.js');

  /**
   * Simple HTML parser to create a DOM-like structure
   * This is used when DOMParser is not available in the worker context
   */
  class WorkerDOMParser {
    parseFromString(html, mimeType) {
      // Create a mock document object
      const doc = {
        documentElement: { lang: '' },
        createElement: tag => this._createElement(tag),
        createTextNode: text => ({ nodeType: 3, textContent: text }),
        querySelectorAll: selector => {
          try {
            // Return serializable results
            const results = this._querySelectorAll(doc.body, selector);
            // Ensure the results are cloneable for IPC communication
            return Array.isArray(results) ? results : [];
          } catch (err) {
            console.warn('Error in document querySelectorAll:', err);
            return [];
          }
        },
        querySelector: selector => {
          try {
            const results = this._querySelectorAll(doc.body, selector);
            // Return first element or null and ensure it's serializable
            return results && results.length > 0 ? results[0] : null;
          } catch (err) {
            console.warn('Error in document querySelector:', err);
            return null;
          }
        },
        title: '',
        body: null,
        dir: '',
        head: { querySelectorAll: () => [], querySelector: () => null }
      };

      // Parse the HTML and populate the document
      try {
        const parsed = this._parseHTML(html);
        doc.body = parsed.body;
        doc.title = parsed.title || '';
        return doc;
      } catch (e) {
        workerContext.postMessage({
          type: 'log',
          level: 'error',
          message: `HTML parsing error: ${e.message}`
        });
        
        // Return a minimal document
        doc.body = this._createElement('body');
        return doc;
      }
    }

    _parseHTML(html) {
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extract body content
      let bodyContent = '';
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        bodyContent = bodyMatch[1];
      } else {
        // If no body tags, use everything after </head>
        const headEndIndex = html.indexOf('</head>');
        if (headEndIndex !== -1) {
          bodyContent = html.substring(headEndIndex + 7);
        } else {
          bodyContent = html;
        }
      }

      // Create a body element
      const body = this._createElement('body');
      body.innerHTML = bodyContent;

      return { body, title };
    }

    _createElement(tag) {
      const element = {
        tagName: tag.toUpperCase(),
        nodeName: tag.toUpperCase(),
        nodeType: 1,
        children: [],
        childNodes: [],
        attributes: {},
        style: {},
        innerHTML: '',
        textContent: '',
        appendChild: child => {
          element.children.push(child);
          element.childNodes.push(child);
          child.parentNode = element;
          return child;
        },
        getAttribute: attr => element.attributes[attr] || null,
        setAttribute: (attr, value) => { element.attributes[attr] = value; },
        hasAttribute: attr => attr in element.attributes,
        removeChild: child => {
          const index = element.children.indexOf(child);
          if (index !== -1) {
            element.children.splice(index, 1);
            element.childNodes.splice(index, 1);
            child.parentNode = null;
          }
          return child;
        },
        querySelectorAll: selector => {
          try {
            // Return serializable results
            const results = this._querySelectorAll(element, selector);
            // Ensure the results are cloneable for IPC communication
            return Array.isArray(results) ? results : [];
          } catch (err) {
            console.warn('Error in querySelectorAll:', err);
            return [];
          }
        },
        querySelector: selector => {
          try {
            const results = this._querySelectorAll(element, selector);
            // Return first element or null and ensure it's serializable
            return results && results.length > 0 ? results[0] : null;
          } catch (err) {
            console.warn('Error in querySelector:', err);
            return null;
          }
        },
        closest: selector => null, // Simplified implementation
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 })
      };
      
      return element;
    }

    _querySelectorAll(element, selector) {
      // Very basic selector implementation for essential functionality
      // Handles tag, class, id, and attribute selectors
      const parts = selector.split(',').map(s => s.trim());
      const results = [];

      // Helper to check if an element matches a simple selector
      const matches = (el, sel) => {
        // Tag selector
        if (sel.match(/^[a-z]+$/i)) {
          return el.tagName === sel.toUpperCase();
        }
        // Class selector
        else if (sel.startsWith('.')) {
          const className = sel.substring(1);
          const elClasses = (el.getAttribute('class') || '').split(' ');
          return elClasses.includes(className);
        }
        // ID selector
        else if (sel.startsWith('#')) {
          const id = sel.substring(1);
          return el.getAttribute('id') === id;
        }
        // Attribute selector [attr]
        else if (sel.startsWith('[') && sel.endsWith(']')) {
          const attrMatch = sel.match(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/);
          if (attrMatch) {
            const [, attr, value] = attrMatch;
            if (value === undefined) {
              return el.hasAttribute(attr);
            } else {
              return el.getAttribute(attr) === value;
            }
          }
        }
        return false;
      };

      // Traverse the element tree and collect matching elements
      const traverse = (node, selectors) => {
        if (!node || node.nodeType !== 1) return;

        for (const sel of selectors) {
          if (matches(node, sel) && !results.includes(node)) {
            results.push(node);
          }
        }

        for (const child of node.children || []) {
          traverse(child, selectors);
        }
      };

      traverse(element, parts);
      
      // Make sure all elements in results are fully serializable
      // by converting to simple objects with only essential properties
      return results.map(el => {
        if (!el || typeof el !== 'object') return null;
        return {
          nodeType: el.nodeType || 1,
          tagName: el.tagName || '',
          textContent: el.textContent || '',
          attributes: el.attributes || {},
          // Include minimal properties needed for queries
          _type: 'serialized-element'
        };
      }).filter(Boolean);
    }
  }

  // Expose the DOMParser to the worker scope
  self.DOMParser = WorkerDOMParser;
}

// Task handlers
const taskHandlers = {
  // Content extraction tasks
  'extract-readability': extractReadability,
  'extract-dom': extractDom,
  'extract-metadata': extractMetadata,
  
  // DOM processing tasks
  'process-dom': processDom,
  'clean-dom': cleanDom,
  'create-dom-json': createDomJson,
  
  // Text processing tasks
  'process-text': processText,
  'extract-headings': extractHeadings,
  'extract-links': extractLinks,
  
  // Content processing tasks
  'enhance-content': enhanceContent,
  'validate-content': validateContent,
  'sanitize-html': sanitizeHtml,
  
  // URL and data processing
  'process-url': processUrl,
  'process-metadata': processMetadata,
  
  // Resource management tasks
  'optimize-resources': optimizeResources,
  'batch-process': batchProcess
};

/**
 * Message handler for worker
 * @param {MessageEvent} event - Message event
 */
workerContext.onmessage = function(event) {
  const { taskId, type, data } = event.data;
  
  // Log task received
  console.log(`[Worker] Received task ${taskId} of type ${type}`);
  
  // Process the task
  processTask(taskId, type, data);
};

/**
 * Process a task and send the result back to the main thread
 * @param {string} taskId - Task ID
 * @param {string} type - Task type
 * @param {Object} data - Task data
 */
function processTask(taskId, type, data) {
  try {
    // Check if we have a handler for this task type
    if (!taskHandlers[type]) {
      throw new Error(`Unknown task type: ${type}`);
    }
    
    // Execute the task handler
    const result = taskHandlers[type](data);
    
    // Handle promises returned by task handlers
    if (result instanceof Promise) {
      result
        .then(finalResult => {
          sendSuccess(taskId, finalResult);
        })
        .catch(error => {
          sendError(taskId, error.message || 'Error in async task handler');
        });
    } else {
      // Send success response for synchronous handlers
      sendSuccess(taskId, result);
    }
  } catch (error) {
    // Send error response
    sendError(taskId, error.message || 'Unknown error in worker');
  }
}

/**
 * Send a success response to the main thread
 * @param {string} taskId - Task ID
 * @param {any} result - Task result
 */
function sendSuccess(taskId, result) {
  workerContext.postMessage({
    taskId,
    type: 'success',
    result
  });
}

/**
 * Send an error response to the main thread
 * @param {string} taskId - Task ID
 * @param {string} error - Error message
 */
function sendError(taskId, error) {
  workerContext.postMessage({
    taskId,
    type: 'error',
    error
  });
}

// TASK HANDLER IMPLEMENTATIONS

/**
 * Extract content using Readability
 * @param {Object} data - Task data
 * @returns {Object} Extracted content
 */
function extractReadability(data) {
  const { html, url } = data;
  
  // Create a new document
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Use Readability to extract the main content
  // Note: Readability.js would need to be included in the worker
  try {
    // This is a placeholder - the actual implementation would use the Readability library
    // In a real implementation, you would need to include Readability.js in the worker
    const article = {
      title: doc.title || '',
      content: extractMainContent(doc),
      textContent: doc.body.textContent || '',
      excerpt: extractExcerpt(doc),
      byline: extractByline(doc),
      dir: doc.dir || null,
      siteName: extractSiteName(doc),
      lang: doc.documentElement.lang || null
    };
    
    return {
      title: article.title,
      html: article.content,
      text: article.textContent,
      excerpt: article.excerpt,
      author: article.byline,
      siteName: article.siteName,
      language: article.lang,
      url: url,
      extractionMethod: 'readability-worker'
    };
  } catch (error) {
    throw new Error(`Readability extraction failed: ${error.message}`);
  }
}

/**
 * Extract main content from a document
 * @param {Document} doc - HTML document
 * @returns {string} Main content HTML
 */
function extractMainContent(doc) {
  // This is a simple implementation - the actual implementation would be more sophisticated
  const mainElements = Array.from(doc.querySelectorAll('main, article, [role="main"], .main, .content, .article'));
  
  if (mainElements.length > 0) {
    // Return the first main element's HTML
    return mainElements[0].innerHTML;
  }
  
  // Fallback to body content
  return doc.body.innerHTML;
}

/**
 * Extract excerpt from a document
 * @param {Document} doc - HTML document
 * @returns {string} Excerpt text
 */
function extractExcerpt(doc) {
  // Try to find a meta description
  const metaDesc = doc.querySelector('meta[name="description"]');
  if (metaDesc && metaDesc.getAttribute('content')) {
    return metaDesc.getAttribute('content');
  }
  
  // Try to find the first paragraph with substantial text
  const paragraphs = Array.from(doc.querySelectorAll('p'));
  for (const p of paragraphs) {
    const text = p.textContent.trim();
    if (text.length > 50 && text.length < 300) {
      return text;
    }
  }
  
  // Fallback to first 200 characters of text
  const text = doc.body.textContent.trim();
  return text.length > 200 ? text.substring(0, 197) + '...' : text;
}

/**
 * Extract byline/author from a document
 * @param {Document} doc - HTML document
 * @returns {string} Author name
 */
function extractByline(doc) {
  // Check meta tags first
  const metaAuthor = doc.querySelector('meta[name="author"], meta[property="article:author"]');
  if (metaAuthor && metaAuthor.getAttribute('content')) {
    return metaAuthor.getAttribute('content');
  }
  
  // Check for author-related elements
  const authorElements = Array.from(doc.querySelectorAll('.author, .byline, [rel="author"]'));
  if (authorElements.length > 0) {
    return authorElements[0].textContent.trim();
  }
  
  return '';
}

/**
 * Extract site name from a document
 * @param {Document} doc - HTML document
 * @returns {string} Site name
 */
function extractSiteName(doc) {
  // Check meta tags first
  const metaSite = doc.querySelector('meta[property="og:site_name"]');
  if (metaSite && metaSite.getAttribute('content')) {
    return metaSite.getAttribute('content');
  }
  
  // Try to extract from title
  const title = doc.title || '';
  const titleParts = title.split(' | ');
  if (titleParts.length > 1) {
    return titleParts[titleParts.length - 1].trim();
  }
  
  // Fallback to domain name from URL
  const linkElement = doc.querySelector('link[rel="canonical"]');
  if (linkElement && linkElement.href) {
    try {
      const url = new URL(linkElement.href);
      return url.hostname;
    } catch (e) {
      // Invalid URL, ignore
    }
  }
  
  return '';
}

/**
 * Process DOM to extract content
 * @param {Object} data - Task data
 * @returns {Object} Processed DOM content
 */
function processDom(data) {
  const { html, url, options } = data;
  
  // Parse HTML to DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Clean the DOM if requested
  if (options && options.clean) {
    cleanDomImpl(doc.body, options);
  }
  
  // Extract main content if requested
  const mainContent = options && options.extractMain ? 
    extractMainContent(doc) : 
    doc.body.innerHTML;
  
  // Extract text
  const text = doc.body.textContent || '';
  
  // Extract headings if requested
  const headings = options && options.extractHeadings ? 
    extractHeadingsImpl(doc) : 
    [];
  
  // Extract links if requested
  const links = options && options.extractLinks ? 
    extractLinksImpl(doc, url) : 
    [];
  
  // Extract metadata if requested
  const metadata = options && options.extractMetadata ? 
    extractMetadataImpl(doc) : 
    {};
  
  // Create JSON representation of DOM if requested
  const jsonDom = options && options.createJsonDom ? 
    createDomJsonImpl(doc.body, options.jsonDomOptions) : 
    null;
  
  return {
    title: doc.title || '',
    text,
    html: mainContent,
    url,
    headings,
    links,
    metadata,
    jsonDom,
    extractionMethod: 'domprocessor-worker',
    timestamp: new Date().toISOString(),
    extractionSuccess: true
  };
}

/**
 * Clean DOM by removing unwanted elements
 * @param {Element} element - Root element to clean
 * @param {Object} options - Cleaning options
 */
function cleanDomImpl(element, options = {}) {
  if (!element) return;
  
  const {
    removeSelectors = ['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'aside'],
    removeHidden = true,
    removeEmpty = true
  } = options;
  
  // Remove elements matching selectors
  if (removeSelectors && removeSelectors.length > 0) {
    removeSelectors.forEach(selector => {
      element.querySelectorAll(selector).forEach(el => {
        el.parentNode?.removeChild(el);
      });
    });
  }
  
  // Remove hidden elements
  if (removeHidden) {
    element.querySelectorAll('*').forEach(el => {
      // In a worker context, getComputedStyle is not available
      // Look for inline style attributes and hidden attribute instead
      const styleAttr = el.getAttribute('style') || '';
      const isHidden = styleAttr.includes('display: none') || 
                       styleAttr.includes('visibility: hidden') ||
                       el.getAttribute('hidden') !== null;
      
      if (isHidden) {
        el.parentNode?.removeChild(el);
      }
    });
  }
  
  // Remove empty elements
  if (removeEmpty) {
    const nonEmptyTextContent = (el) => {
      return el.textContent.trim().length > 0;
    };
    
    // Multiple passes to remove nested empty elements
    let removed = true;
    while (removed) {
      removed = false;
      element.querySelectorAll('div, section, article, aside, p, span, h1, h2, h3, h4, h5, h6').forEach(el => {
        if (!nonEmptyTextContent(el) && !el.querySelector('img, video, audio, iframe, embed, object')) {
          el.parentNode?.removeChild(el);
          removed = true;
        }
      });
    }
  }
}

/**
 * Extract headings from document
 * @param {Document} doc - HTML document
 * @returns {Array<Object>} Extracted headings
 */
function extractHeadingsImpl(doc) {
  return Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .map(h => ({
      level: parseInt(h.tagName.substring(1), 10),
      text: h.textContent.trim()
    }));
}

/**
 * Extract links from document
 * @param {Document} doc - HTML document
 * @param {string} baseUrl - Base URL for resolving relative URLs
 * @returns {Array<Object>} Extracted links
 */
function extractLinksImpl(doc, baseUrl) {
  return Array.from(doc.querySelectorAll('a[href]'))
    .filter(a => a.href && (a.href.startsWith('http') || a.href.startsWith('/')))
    .map(a => {
      // Resolve relative URLs
      let url = a.href;
      if (url.startsWith('/') && baseUrl) {
        try {
          url = new URL(url, baseUrl).href;
        } catch (e) {
          // Invalid URL, use as is
        }
      }
      
      return {
        text: a.textContent.trim(),
        url: url,
        title: a.getAttribute('title') || ''
      };
    })
    .filter((link, index, self) => 
      // Remove duplicates
      index === self.findIndex(l => l.url === link.url)
    )
    .slice(0, 100); // Limit to 100 links
}

/**
 * Extract metadata from document
 * @param {Document} doc - HTML document
 * @returns {Object} Extracted metadata
 */
function extractMetadataImpl(doc) {
  const metadata = {};
  
  // Process meta tags
  doc.querySelectorAll('meta[name], meta[property]').forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property');
    const content = meta.getAttribute('content');
    if (name && content) {
      metadata[name] = content;
    }
  });
  
  // Process Open Graph and Twitter card data
  const ogTags = ['title', 'description', 'image', 'url', 'type', 'site_name'];
  ogTags.forEach(tag => {
    const element = doc.querySelector(`meta[property="og:${tag}"]`);
    if (element && element.getAttribute('content')) {
      metadata[`og:${tag}`] = element.getAttribute('content');
    }
  });
  
  const twitterTags = ['card', 'site', 'creator', 'title', 'description', 'image'];
  twitterTags.forEach(tag => {
    const element = doc.querySelector(`meta[name="twitter:${tag}"]`);
    if (element && element.getAttribute('content')) {
      metadata[`twitter:${tag}`] = element.getAttribute('content');
    }
  });
  
  return metadata;
}

/**
 * Create JSON representation of DOM
 * @param {Element} element - Root element
 * @param {Object} options - Options for JSON conversion
 * @returns {Object} JSON representation of DOM
 */
function createDomJsonImpl(element, options = {}) {
  if (!element) return null;
  
  const {
    maxDepth = 5,
    includeContent = true,
    includeAttributes = true
  } = options;
  
  /**
   * Convert element to JSON recursively
   * @param {Element} el - Element to convert
   * @param {number} depth - Current depth
   * @returns {Object} JSON representation of element
   */
  function elementToJson(el, depth) {
    if (!el || depth > maxDepth) return null;
    
    // Create basic JSON structure
    const result = {
      tag: el.tagName.toLowerCase(),
      children: []
    };
    
    // Add content if requested and this is a text node
    if (includeContent) {
      const textContent = Array.from(el.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent)
        .join('')
        .trim();
      
      if (textContent) {
        result.content = textContent;
      }
    }
    
    // Add attributes if requested
    if (includeAttributes && el.attributes && el.attributes.length > 0) {
      result.attributes = {};
      Array.from(el.attributes).forEach(attr => {
        result.attributes[attr.name] = attr.value;
      });
    }
    
    // Process child elements
    if (depth < maxDepth) {
      Array.from(el.children).forEach(child => {
        const childJson = elementToJson(child, depth + 1);
        if (childJson) {
          result.children.push(childJson);
        }
      });
    }
    
    return result;
  }
  
  return elementToJson(element, 0);
}

/**
 * Process text content for analysis
 * @param {Object} data - Task data
 * @returns {Object} Processed text data
 */
function processText(data) {
  const { text, options } = data;
  
  if (!text) {
    return {
      original: '',
      processed: '',
      wordCount: 0,
      sentenceCount: 0,
      paragraphCount: 0,
      readabilityScore: 0
    };
  }
  
  // Process the text
  const processed = text
    .replace(/\s+/g, ' ')
    .trim();
  
  // Count words, sentences, and paragraphs
  const wordCount = processed.split(/\s+/).length;
  const sentenceCount = processed.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const paragraphCount = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  
  // Calculate simple readability score
  // This is a very basic implementation - real implementations would use more sophisticated algorithms
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const readabilityScore = Math.max(0, 100 - Math.abs(avgWordsPerSentence - 15) * 5);
  
  return {
    original: text,
    processed,
    wordCount,
    sentenceCount,
    paragraphCount,
    readabilityScore: Math.round(readabilityScore)
  };
}

/**
 * Extract headings from content
 * @param {Object} data - Task data
 * @returns {Array<Object>} Extracted headings
 */
function extractHeadings(data) {
  return extractHeadingsImpl(parseHtml(data.html));
}

/**
 * Extract links from content
 * @param {Object} data - Task data
 * @returns {Array<Object>} Extracted links
 */
function extractLinks(data) {
  return extractLinksImpl(parseHtml(data.html), data.url);
}

/**
 * Extract DOM from content
 * @param {Object} data - Task data
 * @returns {Object} Extracted DOM data
 */
function extractDom(data) {
  return processDom(data);
}

/**
 * Extract metadata from content
 * @param {Object} data - Task data
 * @returns {Object} Extracted metadata
 */
function extractMetadata(data) {
  return extractMetadataImpl(parseHtml(data.html));
}

/**
 * Clean DOM content
 * @param {Object} data - Task data
 * @returns {string} Cleaned HTML
 */
function cleanDom(data) {
  const doc = parseHtml(data.html);
  cleanDomImpl(doc.body, data.options);
  return doc.body.innerHTML;
}

/**
 * Create JSON representation of DOM
 * @param {Object} data - Task data
 * @returns {Object} JSON representation of DOM
 */
function createDomJson(data) {
  return createDomJsonImpl(parseHtml(data.html).body, data.options);
}

/**
 * Enhance content with additional information
 * @param {Object} data - Task data
 * @returns {Object} Enhanced content
 */
function enhanceContent(data) {
  // This is a placeholder implementation
  const { content, url } = data;
  
  // Return a copy of the content with additional fields
  return {
    ...content,
    enhancedAt: new Date().toISOString(),
    estimatedReadingTime: calculateReadingTime(content.text || '')
  };
}

/**
 * Calculate estimated reading time for text
 * @param {string} text - Text to analyze
 * @returns {number} Reading time in minutes
 */
function calculateReadingTime(text) {
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Validate content extraction result
 * @param {Object} data - Task data
 * @returns {Object} Validation result
 */
function validateContent(data) {
  const { content } = data;
  
  // Basic validation criteria
  const hasTitle = Boolean(content.title && content.title.trim().length > 0);
  const hasText = Boolean(content.text && content.text.trim().length > 0);
  const hasUrl = Boolean(content.url && content.url.trim().length > 0);
  
  // Text length check (at least 50 characters to be considered valid)
  const hasSubstantialText = hasText && content.text.trim().length >= 50;
  
  // Overall validation result
  const isValid = hasTitle && hasUrl && hasSubstantialText;
  
  return {
    isValid,
    validationDetails: {
      hasTitle,
      hasText,
      hasUrl,
      hasSubstantialText
    }
  };
}

/**
 * Sanitize HTML content
 * @param {Object} data - Task data
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(data) {
  const { html, allowedTags, allowedAttributes } = data;
  
  // Very basic sanitizer implementation
  // In a real application, you would use a proper HTML sanitizer library
  
  const doc = parseHtml(html);
  
  // Default allowed tags if not specified
  const defaultAllowedTags = [
    'a', 'b', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody',
    'td', 'th', 'thead', 'tr', 'ul'
  ];
  
  // Default allowed attributes if not specified
  const defaultAllowedAttributes = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height']
  };
  
  const tagsToAllow = allowedTags || defaultAllowedTags;
  const attributesToAllow = allowedAttributes || defaultAllowedAttributes;
  
  // Remove disallowed tags
  Array.from(doc.body.querySelectorAll('*')).forEach(el => {
    const tagName = el.tagName.toLowerCase();
    
    if (!tagsToAllow.includes(tagName)) {
      // Replace with contents
      const parent = el.parentNode;
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    } else {
      // Remove disallowed attributes
      Array.from(el.attributes).forEach(attr => {
        const attrName = attr.name;
        const elemAllowedAttrs = attributesToAllow[tagName] || [];
        
        if (!elemAllowedAttrs.includes(attrName)) {
          el.removeAttribute(attrName);
        }
      });
    }
  });
  
  return doc.body.innerHTML;
}

/**
 * Process URL for validation and normalization
 * @param {Object} data - Task data
 * @returns {Object} Processed URL data
 */
function processUrl(data) {
  const { url } = data;
  
  if (!url) {
    return {
      original: '',
      normalized: '',
      isValid: false,
      domain: '',
      path: '',
      query: {},
      isArticle: false
    };
  }
  
  try {
    // Parse and normalize URL
    const parsedUrl = new URL(url);
    const normalized = parsedUrl.href;
    
    // Extract query parameters
    const query = {};
    for (const [key, value] of parsedUrl.searchParams.entries()) {
      query[key] = value;
    }
    
    // Check if URL likely points to an article
    const path = parsedUrl.pathname;
    const isArticle = /\/(article|post|blog|news)\/|\.html$/.test(path);
    
    return {
      original: url,
      normalized,
      isValid: true,
      domain: parsedUrl.hostname,
      path: parsedUrl.pathname,
      query,
      isArticle
    };
  } catch (error) {
    return {
      original: url,
      normalized: '',
      isValid: false,
      error: error.message
    };
  }
}

/**
 * Process metadata for standardization
 * @param {Object} data - Task data
 * @returns {Object} Processed metadata
 */
function processMetadata(data) {
  const { metadata } = data;
  
  // Standardized metadata object
  const standardized = {
    title: '',
    description: '',
    author: '',
    publishedDate: '',
    modifiedDate: '',
    keywords: [],
    image: '',
    type: '',
    section: '',
    siteName: ''
  };
  
  // Map common metadata fields to standardized format
  
  // Title
  standardized.title = metadata['og:title'] || 
                      metadata['twitter:title'] || 
                      metadata['title'] || 
                      '';
  
  // Description
  standardized.description = metadata['og:description'] || 
                            metadata['twitter:description'] || 
                            metadata['description'] || 
                            '';
  
  // Author
  standardized.author = metadata['author'] || 
                       metadata['article:author'] || 
                       '';
  
  // Dates
  standardized.publishedDate = metadata['article:published_time'] || 
                              metadata['publishedDate'] || 
                              metadata['date'] || 
                              '';
  
  standardized.modifiedDate = metadata['article:modified_time'] || 
                             metadata['modifiedDate'] || 
                             '';
  
  // Keywords
  if (metadata['keywords']) {
    standardized.keywords = metadata['keywords'].split(',').map(k => k.trim());
  }
  
  // Image
  standardized.image = metadata['og:image'] || 
                      metadata['twitter:image'] || 
                      '';
  
  // Type
  standardized.type = metadata['og:type'] || 
                     '';
  
  // Section
  standardized.section = metadata['article:section'] || 
                        '';
  
  // Site name
  standardized.siteName = metadata['og:site_name'] || 
                         '';
  
  return {
    original: metadata,
    standardized
  };
}

/**
 * Parse HTML string to DOM
 * @param {string} html - HTML string
 * @returns {Document} Parsed document
 */
function parseHtml(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

/**
 * Optimize resource usage by analyzing page content
 * Detects resources that could be preloaded for better performance
 * @param {Object} data - Task data containing HTML and options
 * @returns {Object} Analysis results with resource suggestions
 */
function optimizeResources(data) {
  const { html, url, options = {} } = data;
  
  if (!html || !url) {
    return {
      success: false,
      error: 'Missing HTML or URL for resource optimization'
    };
  }
  
  try {
    // Parse HTML to DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Initialize results
    const results = {
      url: url,
      timestamp: new Date().toISOString(),
      resources: {
        images: [],
        scripts: [],
        styles: [],
        fonts: [],
        videos: []
      },
      suggestions: [],
      preloadableResources: [],
      resourceStats: {
        totalSize: 0,
        imageCount: 0,
        largeImageCount: 0,
        scriptCount: 0,
        styleCount: 0,
        fontCount: 0,
        videoCount: 0
      },
      success: true
    };
    
    // Analyze images
    const images = Array.from(doc.querySelectorAll('img'));
    results.resourceStats.imageCount = images.length;
    
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (!src) return;
      
      const isLarge = img.width > 500 || img.height > 500 || 
                     img.getAttribute('width') > 500 || 
                     img.getAttribute('height') > 500;
      
      if (isLarge) {
        results.resourceStats.largeImageCount++;
      }
      
      // Only include the first 20 images to avoid excessive data
      if (results.resources.images.length < 20) {
        results.resources.images.push({
          src: src,
          width: img.width || img.getAttribute('width'),
          height: img.height || img.getAttribute('height'),
          alt: img.getAttribute('alt') || '',
          isLarge: isLarge
        });
      }
      
      // Add suggestion for preloading large important images
      if (isLarge && img.getBoundingClientRect().top < 1000) {
        results.suggestions.push({
          type: 'preload',
          resource: src,
          resourceType: 'image',
          importance: 'high',
          reason: 'Large image in visible area'
        });
        
        results.preloadableResources.push({
          url: src,
          type: 'image',
          importance: 'high'
        });
      }
    });
    
    // Analyze scripts
    const scripts = Array.from(doc.querySelectorAll('script[src]'));
    results.resourceStats.scriptCount = scripts.length;
    
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (!src) return;
      
      const isAsync = script.hasAttribute('async');
      const isDefer = script.hasAttribute('defer');
      
      // Only include the first 10 scripts
      if (results.resources.scripts.length < 10) {
        results.resources.scripts.push({
          src: src,
          async: isAsync,
          defer: isDefer,
          type: script.getAttribute('type') || 'text/javascript'
        });
      }
      
      // Add suggestions for scripts blocking render
      if (!isAsync && !isDefer) {
        results.suggestions.push({
          type: 'optimize',
          resource: src,
          resourceType: 'script',
          suggestion: 'Add async or defer attribute',
          reason: 'Blocking script'
        });
      }
    });
    
    // Analyze stylesheets
    const styles = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    results.resourceStats.styleCount = styles.length;
    
    styles.forEach(style => {
      const href = style.getAttribute('href');
      if (!href) return;
      
      // Only include the first 5 stylesheets
      if (results.resources.styles.length < 5) {
        results.resources.styles.push({
          href: href,
          media: style.getAttribute('media') || 'all'
        });
      }
      
      // Preload critical CSS
      if (style.getAttribute('media') !== 'print') {
        results.preloadableResources.push({
          url: href,
          type: 'style',
          importance: 'high'
        });
      }
    });
    
    // Analyze fonts
    const fonts = Array.from(doc.querySelectorAll('link[rel="preload"][as="font"]'));
    results.resourceStats.fontCount = fonts.length;
    
    fonts.forEach(font => {
      const href = font.getAttribute('href');
      if (!href) return;
      
      results.resources.fonts.push({
        href: href,
        type: font.getAttribute('type') || ''
      });
    });
    
    // Analyze videos
    const videos = Array.from(doc.querySelectorAll('video, source[type^="video"]'));
    results.resourceStats.videoCount = videos.length;
    
    videos.forEach(video => {
      let src = video.getAttribute('src');
      
      // For source elements, get the parent video element's info
      if (video.tagName.toLowerCase() === 'source' && !src) {
        const parentVideo = video.closest('video');
        if (parentVideo) {
          src = video.getAttribute('src') || parentVideo.getAttribute('src');
        }
      }
      
      if (!src) return;
      
      results.resources.videos.push({
        src: src,
        type: video.getAttribute('type') || ''
      });
    });
    
    return results;
  } catch (error) {
    return {
      success: false,
      error: `Resource optimization failed: ${error.message}`
    };
  }
}

/**
 * Process multiple tasks in a batch to reduce worker creation overhead
 * @param {Object} data - Task data containing array of tasks
 * @returns {Object} Results for all tasks
 */
function batchProcess(data) {
  const { tasks } = data;
  
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      success: false,
      error: 'No tasks provided for batch processing'
    };
  }
  
  try {
    // Process each task with the appropriate handler
    const results = tasks.map(task => {
      const { type, data: taskData, taskId } = task;
      
      if (!type || !taskHandlers[type]) {
        return {
          taskId,
          success: false,
          error: `Unknown task type: ${type}`
        };
      }
      
      try {
        // Execute the task handler
        const result = taskHandlers[type](taskData);
        
        // Handle promises returned by task handlers
        if (result instanceof Promise) {
          // For async tasks, we return a placeholder - this is a limitation
          // of the batch process approach for async tasks
          return {
            taskId,
            success: true,
            isPending: true,
            message: 'Async task started but not completed in batch'
          };
        }
        
        // Return successful result
        return {
          taskId,
          success: true,
          result
        };
      } catch (error) {
        // Return error for this specific task
        return {
          taskId,
          success: false,
          error: error.message || 'Error in task handler'
        };
      }
    });
    
    return {
      success: true,
      results
    };
  } catch (error) {
    return {
      success: false,
      error: `Batch processing failed: ${error.message}`
    };
  }
}

// Log that the worker is ready
console.log('[Worker] Browser worker initialized and ready for tasks');

// Send ready message to main thread
self.postMessage({ type: 'ready' }); 