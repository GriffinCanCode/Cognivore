/**
 * ContentExtractor - Functions for extracting and processing web page content
 */

import logger from '../../../utils/logger';
import extractionSystem from './ContentExtractionSystem';

// Create a logger instance for this module
const extractorLogger = logger.scope('ContentExtractor');

/**
 * Extract and save page content to vector database
 * @param {Object} browser - Browser instance
 */
export function extractPageContent(browser) {
  if (!browser.webview) return;
  
  // Different extraction method based on environment
  try {
    // Track extraction attempt
    extractorLogger.info('Attempting to extract content from:', browser.currentUrl);
    
    // Use the new extraction system
    extractionSystem.extractContent(browser, browser.currentUrl)
      .then(contentResult => {
        if (contentResult && contentResult.extractionSuccess !== false) {
          savePageToVectorDB(browser, contentResult);
        } else {
          extractorLogger.warn('Extraction failed:', contentResult?.error || 'Unknown reason');
          
          // Try fallback methods if not already attempted
          if (!contentResult || contentResult.extractionMethod === 'error') {
            if (browser.contentFrame) {
              extractContentFromIframe(browser);
            } else if (window.ipcRenderer && typeof window.ipcRenderer.invoke === 'function') {
              extractContentViaProxy(browser);
            }
          }
        }
      })
      .catch(error => {
        extractorLogger.error('Error using extraction system:', error);
        
        // Try legacy fallback methods
        if (browser.contentFrame) {
          extractContentFromIframe(browser);
        } else if (window.ipcRenderer && typeof window.ipcRenderer.invoke === 'function') {
          extractContentViaProxy(browser);
        }
      });
  } catch (error) {
    extractorLogger.error('Error extracting page content:', error);
    
    // Try proxy extraction as last resort
    if (window.ipcRenderer && typeof window.ipcRenderer.invoke === 'function') {
      extractContentViaProxy(browser);
    }
  }
}

/**
 * Extract content using Electron webview API
 * @param {Object} browser - Browser instance
 */
function extractContentWithWebviewAPI(browser) {
  browser.webview.executeJavaScript(`
    (function() {
      try {
        // Check if we're on Wikipedia
        const isWikipedia = window.location.hostname.includes('wikipedia.org');
        
        // Collect page data
        const extractedContent = {
          title: document.title || '',
          url: window.location.href,
          domain: window.location.hostname,
          timestamp: new Date().toISOString(),
          content: {
            text: '',
            html: '',
            headlines: [],
            links: [],
            metadata: {}
          }
        };
        
        // Extract main text content - with special handling for Wikipedia
        let mainContentNode;
        
        if (isWikipedia) {
          // Wikipedia-specific content extraction
          mainContentNode = document.getElementById('content') || 
                           document.getElementById('mw-content-text') || 
                           document.querySelector('.mw-parser-output');
          
          // If we found Wikipedia content, get the paragraphs and headings
          if (mainContentNode) {
            const paragraphs = Array.from(mainContentNode.querySelectorAll('p, h1, h2, h3, h4, h5, h6'));
            extractedContent.content.text = paragraphs
              .map(el => el.textContent.trim())
              .filter(text => text.length > 0)
              .join('\\n\\n');
            
            // Also get the infobox if available
            const infobox = document.querySelector('.infobox');
            if (infobox) {
              const infoboxText = Array.from(infobox.querySelectorAll('tr'))
                .map(row => {
                  const label = row.querySelector('th')?.textContent?.trim() || '';
                  const value = row.querySelector('td')?.textContent?.trim() || '';
                  return label && value ? label + ': ' + value : '';
                })
                .filter(text => text.length > 0)
                .join('\\n');
              
              extractedContent.content.text = 'INFOBOX:\\n' + infoboxText + '\\n\\nCONTENT:\\n' + extractedContent.content.text;
            }
          }
        } else {
          // Standard content extraction for non-Wikipedia sites
          const contentNodes = Array.from(document.querySelectorAll('article, [role="main"], main, #content, .content, .article, .post, .entry, .news-content, .page-content'));
          
          // If no content nodes are found, fallback to body
          mainContentNode = contentNodes.length > 0 
            ? contentNodes[0] 
            : document.body;
          
          // Extract readable text
          extractedContent.content.text = (function getReadableText() {
            // Use Readability if available
            if (typeof Readability === 'function') {
              try {
                const documentClone = document.cloneNode(true);
                const reader = new Readability(documentClone);
                const article = reader.parse();
                if (article && article.textContent) {
                  return article.textContent.trim();
                }
              } catch (e) {
                console.warn('Readability extraction failed:', e);
              }
            }
            
            // Fallback text extraction
            const paragraphs = Array.from(mainContentNode.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, div:not(:has(*))'))
              .filter(el => {
                // Filter out elements that are too short or hidden
                const text = el.textContent.trim();
                const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                return text.length > 10 && isVisible;
              })
              .map(el => el.textContent.trim())
              .filter(text => text.length > 0);
            
            return paragraphs.join('\\n\\n').trim();
          })();
        }
        
        // Make sure we have some text content
        if (!extractedContent.content.text || extractedContent.content.text.length < 50) {
          // Last resort fallback: get all visible text from the page
          extractedContent.content.text = Array.from(document.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
            .map(el => el.textContent.trim())
            .filter(text => text.length > 0)
            .join('\\n\\n');
        }
        
        // Extract basic HTML content
        if (mainContentNode) {
          extractedContent.content.html = mainContentNode.innerHTML;
        } else {
          extractedContent.content.html = document.body.innerHTML;
        }
        
        // Extract headlines
        extractedContent.content.headlines = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
          .map(el => ({
            level: parseInt(el.tagName.substring(1)),
            text: el.textContent.trim()
          }))
          .filter(headline => headline.text.length > 0);
        
        // Extract links
        extractedContent.content.links = Array.from(document.querySelectorAll('a[href]'))
          .filter(a => a.href && a.href.startsWith('http') && a.textContent.trim().length > 0)
          .map(a => ({
            text: a.textContent.trim(),
            href: a.href,
            title: a.title || ''
          }))
          .filter((link, index, self) => 
            // Remove duplicates
            index === self.findIndex(l => l.href === link.href)
          )
          .slice(0, 100); // Limit to 100 links
        
        // Extract metadata
        const metaTags = Array.from(document.querySelectorAll('meta[name], meta[property]'));
        metaTags.forEach(meta => {
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');
          if (name && content) {
            extractedContent.content.metadata[name] = content;
          }
        });
        
        // Specifically extract important metadata
        const importantMetaTags = [
          'description', 'keywords', 'author', 'og:title', 'og:description', 'og:image',
          'twitter:title', 'twitter:description', 'twitter:image'
        ];
        
        importantMetaTags.forEach(name => {
          const selector = name.startsWith('og:') || name.startsWith('twitter:')
            ? \`meta[property="\${name}"]\`
            : \`meta[name="\${name}"]\`;
          
          const metaEl = document.querySelector(selector);
          if (metaEl && metaEl.getAttribute('content')) {
            extractedContent.content.metadata[name] = metaEl.getAttribute('content');
          }
        });
        
        // Return the extracted content
        return extractedContent;
      } catch (error) {
        // Return error information
        return {
          error: true,
          message: error.message || 'Unknown error during content extraction',
          stack: error.stack,
          timestamp: new Date().toISOString()
        };
      }
    })();
  `)
  .then(result => {
    if (result.error) {
      extractorLogger.error('Error in content extraction script:', result.message);
      // Try a simpler extraction as fallback
      extractSimpleContent(browser);
    } else {
      savePageToVectorDB(browser, result.content);
    }
  })
  .catch(error => {
    extractorLogger.error('Failed to execute content extraction script:', error);
    extractSimpleContent(browser);
  });
}

/**
 * Extract content from iframe
 * @param {Object} browser - Browser instance
 */
function extractContentFromIframe(browser) {
  try {
    const contentDoc = browser.contentFrame.contentDocument;
    
    if (!contentDoc) {
      throw new Error('Cannot access iframe content document (likely CORS restriction)');
    }
    
    // Extract basic content
    const pageData = {
      title: contentDoc.title,
      text: contentDoc.body.innerText,
      url: browser.currentUrl,
      metadata: {
        title: contentDoc.title,
        description: contentDoc.querySelector('meta[name="description"]')?.content || ''
      }
    };
    
    savePageToVectorDB(browser, pageData);
  } catch (error) {
    extractorLogger.error('Failed to access iframe content (likely CORS restriction):', error);
    
    // Try proxy-based extraction if available
    if (window.ipcRenderer && typeof window.ipcRenderer.invoke === 'function') {
      extractContentViaProxy(browser);
    } else {
      // Notify user about restriction
      if (browser.notificationService) {
        browser.notificationService.show('Cannot extract content from this page due to security restrictions. Try using the desktop app for better compatibility.', 'warning');
      }
    }
  }
}

/**
 * Extract content via proxy (main process)
 * @param {Object} browser - Browser instance
 */
function extractContentViaProxy(browser) {
  if (!window.ipcRenderer || !browser.currentUrl) return;
  
  window.ipcRenderer.invoke('extract-page-content', browser.currentUrl)
    .then(result => {
      if (result.success) {
        savePageToVectorDB(browser, {
          title: result.title || 'Unknown Title',
          text: result.content || '',
          url: browser.currentUrl,
          metadata: result.metadata || {}
        });
      } else {
        throw new Error(result.error || 'Failed to extract content via proxy');
      }
    })
    .catch(error => {
      extractorLogger.error('Error extracting content via proxy:', error);
      
      if (browser.notificationService) {
        browser.notificationService.show('Failed to extract content from this page', 'error');
      }
    });
}

/**
 * Extract simple content as fallback
 * @param {Object} browser - Browser instance
 */
function extractSimpleContent(browser) {
  if (browser.webviewImplementation === 'webview' && typeof browser.webview.executeJavaScript === 'function') {
    // Use a simpler script for extraction
    browser.webview.executeJavaScript(`
      {
        title: document.title,
        text: document.body.innerText,
        url: window.location.href
      }
    `)
    .then(result => {
      savePageToVectorDB(browser, result);
    })
    .catch(error => {
      extractorLogger.error('Failed to extract simple content:', error);
      
      if (browser.notificationService) {
        browser.notificationService.show('Failed to extract content from this page', 'error');
      }
    });
  }
}

/**
 * Save page content to vector database
 * @param {Object} browser - Browser instance
 * @param {Object} content - The extracted page content
 */
export function savePageToVectorDB(browser, content) {
  // Validate content
  if (!content) {
    extractorLogger.error('Invalid content: content is null or undefined');
    return;
  }
  
  if (!content.text) {
    extractorLogger.error('Invalid content: missing text property');
    return;
  }
  
  if (typeof content.text !== 'string') {
    extractorLogger.error('Invalid content: text is not a string', typeof content.text);
    return;
  }
  
  if (content.text.trim().length < 10) {
    extractorLogger.error('Invalid content: text is too short', content.text);
    return;
  }
  
  // Prepare final content object with defaults for missing fields
  const contentToSave = {
    url: browser.currentUrl,
    title: content.title || 'Unknown Title',
    text: content.text,
    timestamp: new Date().toISOString(),
    metadata: content.metadata || {},
    links: content.links || [],
    images: content.images || []
  };
  
  // Send content to main process via IPC to save in vector DB
  window.ipcRenderer.invoke('save-browser-content', contentToSave)
    .then(result => {
      if (result.success) {
        if (browser.notificationService) {
          browser.notificationService.show('Page saved to knowledge base', 'success');
        }
        
        // Update research panel if visible
        updateResearchPanel(browser, contentToSave);
      } else {
        throw new Error(result.error || 'Failed to save page content');
      }
    })
    .catch(error => {
      extractorLogger.error('Error saving page to vector DB:', error);
      if (browser.notificationService) {
        browser.notificationService.show('Failed to save page to knowledge base', 'error');
      }
    });
}

/**
 * Update research panel with extracted content
 * @param {Object} browser - Browser instance
 * @param {Object} content - The extracted page content
 */
export function updateResearchPanel(browser, content) {
  const researchPanel = browser.container?.querySelector('.browser-research-panel');
  const researchContent = researchPanel?.querySelector('.research-panel-content');
  
  if (!researchPanel || !researchContent) return;
  
  // Show the panel if it's not already visible
  researchPanel.style.display = 'flex';
  
  // Remove empty state if present
  const emptyState = researchContent.querySelector('.research-empty-state');
  if (emptyState) {
    emptyState.remove();
  }
  
  // Create content entry
  const entryElement = document.createElement('div');
  entryElement.className = 'research-entry';
  
  const timestamp = new Date().toLocaleTimeString();
  
  entryElement.innerHTML = `
    <div class="research-entry-header">
      <h4>${content.title}</h4>
      <span class="research-timestamp">${timestamp}</span>
    </div>
    <div class="research-entry-url">${content.url}</div>
    <div class="research-entry-preview">${content.text.substring(0, 200)}...</div>
  `;
  
  // Add to panel
  researchContent.prepend(entryElement);
}

/**
 * Extract basic page info (title, description, etc)
 * @param {Document} doc - DOM document object
 * @returns {Object} Object with page info
 */
export function extractPageInfo(doc) {
  if (!doc) return {};
  
  // Extract basic info
  const info = {
    title: doc.title || '',
    metaDescription: '',
    canonicalUrl: '',
    ogImage: '',
    ogTitle: '',
    ogDescription: '',
    faviconUrl: ''
  };
  
  // Get meta description
  const metaDesc = doc.querySelector('meta[name="description"]');
  if (metaDesc) info.metaDescription = metaDesc.getAttribute('content') || '';
  
  // Get canonical URL
  const canonical = doc.querySelector('link[rel="canonical"]');
  if (canonical) info.canonicalUrl = canonical.getAttribute('href') || '';
  
  // Get OG image
  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) info.ogImage = ogImage.getAttribute('content') || '';
  
  // Get OG title
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) info.ogTitle = ogTitle.getAttribute('content') || '';
  
  // Get OG description
  const ogDesc = doc.querySelector('meta[property="og:description"]');
  if (ogDesc) info.ogDescription = ogDesc.getAttribute('content') || '';
  
  // Get favicon URL
  const favicon = doc.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
  if (favicon) info.faviconUrl = favicon.getAttribute('href') || '';
  
  return info;
}

/**
 * Extract all page content including text, links, and structure
 * @param {Object|Document} doc - DOM document object or browser instance
 * @param {string} url - Current page URL
 * @returns {Object} Extracted content
 */
export function extractFullPageContent(doc, url) {
  // Handle case when browser object is passed instead of document
  if (doc && doc.webview && !doc.querySelector) {
    // Get URL from browser if not provided
    if (!url) {
      url = doc.currentUrl || '';
    }
    
    // Use the new extraction system for browser objects
    return extractionSystem.extractContent(doc, url)
      .then(result => {
        // Map the results to match the expected format
        return {
          title: result.title || '',
          text: result.text || '',
          links: result.links || [],
          headings: result.headings || [],
          pageInfo: {
            title: result.title || '',
            metaDescription: result.metadata?.description || '',
            canonicalUrl: result.metadata?.['canonical-url'] || '',
            ogImage: result.metadata?.['og:image'] || '',
            ogTitle: result.metadata?.['og:title'] || '',
            ogDescription: result.metadata?.['og:description'] || ''
          },
          mainContent: result.mainContent || result.text || '',
          extractionMethod: result.extractionMethod
        };
      })
      .catch(error => {
        extractorLogger.error('Error using extraction system:', error);
        // Return minimal content on error to avoid breaking the application
        return {
          title: doc.currentTitle || 'Unknown Title',
          text: 'Error extracting content: ' + error.message,
          links: [],
          headings: [],
          mainContent: 'Content extraction failed',
          extractionError: error.message
        };
      });
  }

  // Original functionality for document object
  if (!doc) return { text: '', links: [], headings: [] };
  
  try {
    // Basic page info
    const pageInfo = extractPageInfo(doc);
    
    // Get all text content
    let textContent = doc.body ? doc.body.textContent || '' : '';
    textContent = textContent.replace(/\s+/g, ' ').trim();
    
    // Extract all links
    const linkElements = doc.querySelectorAll('a[href]');
    const links = Array.from(linkElements).map(link => {
      const href = link.getAttribute('href') || '';
      let absoluteUrl = href;
      
      // Convert relative URLs to absolute
      if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          absoluteUrl = new URL(href, url).href;
        } catch (err) {
          // Keep original if URL construction fails
          extractorLogger.warn('Error converting relative URL:', err);
        }
      }
      
      return {
        text: link.textContent.trim(),
        url: absoluteUrl,
        title: link.getAttribute('title') || ''
      };
    }).filter(link => link.url && link.url.startsWith('http'));
    
    // Extract heading structure
    const headings = extractHeadingStructure(doc);
    
    return {
      pageInfo,
      text: textContent,
      links,
      headings,
      mainContent: extractMainContent(doc)
    };
  } catch (err) {
    extractorLogger.warn('Error extracting page content:', err);
    return { 
      text: doc.body ? doc.body.textContent : '',
      links: [],
      headings: []
    };
  }
}

/**
 * Extract meaningful main content from the page
 * Uses heuristics to find the main content area
 * @param {Document} doc - DOM document object
 * @returns {string} Main content text
 */
export function extractMainContent(doc) {
  if (!doc || !doc.body) return '';
  
  try {
    // Possible content containers
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.main-content',
      '.content',
      '#content',
      '.post-content',
      '.entry-content',
      '.article-content'
    ];
    
    // Try to find a good content container
    let contentElement = null;
    
    for (const selector of contentSelectors) {
      const elements = doc.querySelectorAll(selector);
      
      if (elements.length === 1) {
        // Perfect - unique match
        contentElement = elements[0];
        break;
      } else if (elements.length > 1) {
        // Multiple matches - find the one with most text
        let bestElement = null;
        let maxLength = 0;
        
        for (const el of elements) {
          const text = el.textContent || '';
          if (text.length > maxLength) {
            maxLength = text.length;
            bestElement = el;
          }
        }
        
        if (bestElement && maxLength > 500) {
          contentElement = bestElement;
          break;
        }
      }
    }
    
    // If we found a content element, use it
    if (contentElement) {
      const content = contentElement.textContent || '';
      return content.replace(/\s+/g, ' ').trim();
    }
    
    // Fallback: look for the element with the most paragraph text
    const paragraphs = doc.querySelectorAll('p');
    if (paragraphs.length > 5) {
      return Array.from(paragraphs)
        .map(p => p.textContent)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Final fallback
    return doc.body.textContent.replace(/\s+/g, ' ').trim();
  } catch (err) {
    extractorLogger.warn('Error extracting main content:', err);
    return doc.body.textContent || '';
  }
}

/**
 * Extract heading structure from the document
 * @param {Document} doc - DOM document object
 * @returns {Array} Array of headings with their level and text
 */
export function extractHeadingStructure(doc) {
  if (!doc) return [];
  
  try {
    const headingElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    return Array.from(headingElements).map(heading => {
      // Get heading level
      const level = parseInt(heading.tagName.substring(1), 10);
      
      return {
        level,
        text: heading.textContent.trim()
      };
    });
  } catch (err) {
    extractorLogger.warn('Error extracting heading structure:', err);
    return [];
  }
}

export default {
  extractPageContent,
  savePageToVectorDB,
  updateResearchPanel,
  extractPageInfo,
  extractFullPageContent,
  extractMainContent,
  extractHeadingStructure
}; 