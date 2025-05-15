/**
 * ContentExtractor - Functions for extracting and processing web page content
 */

/**
 * Extract and save page content to vector database
 * @param {Object} browser - Browser instance
 */
export function extractPageContent(browser) {
  if (!browser.webview) return;
  
  // Different extraction method based on environment
  try {
    // Track extraction attempt
    console.log('Attempting to extract content from:', browser.currentUrl);
    
    if (browser.webviewImplementation === 'webview' && typeof browser.webview.executeJavaScript === 'function') {
      // Electron webview - use executeJavaScript for full DOM access
      extractContentWithWebviewAPI(browser);
    } else if (browser.contentFrame) {
      // Try to extract from iframe if available
      extractContentFromIframe(browser);
    }
  } catch (error) {
    console.error('Error extracting page content:', error);
    
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
        // Extract main content
        const getMostRelevantContent = () => {
          // Potential content containers by priority
          const contentSelectors = [
            'article', 'main', '.main-content', '#main-content', 
            '[role="main"]', '.post-content', '.article-content',
            '.content', '#content'
          ];
          
          // Try to find main content container
          for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim().length > 500) {
              return element;
            }
          }
          
          // Fallback to body if no content container found
          return document.body;
        };
        
        // Get content container and extract text
        const contentContainer = getMostRelevantContent();
        
        // Remove unnecessary elements that might contain unrelated text
        const clonedContainer = contentContainer.cloneNode(true);
        const elementsToRemove = [
          'nav', 'header', 'footer', 'aside', 
          '.nav', '.navigation', '.menu', '.sidebar', 
          '.footer', '.comments', '.advertisement',
          'script', 'style', 'noscript'
        ];
        
        elementsToRemove.forEach(selector => {
          const elements = clonedContainer.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        });
        
        // Extract links for potential follow-up research
        const links = Array.from(document.links).slice(0, 50).map(link => ({
          href: link.href,
          text: link.textContent.trim() || link.title || link.href,
          isInternal: link.host === window.location.host
        })).filter(link => {
          // Filter out common non-content links
          const href = link.href.toLowerCase();
          return !href.includes('javascript:') && 
                 !href.includes('#') &&
                 !href.includes('/cdn-cgi/') &&
                 link.text.length > 0;
        });
        
        // Extract metadata
        const metadata = {
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content || '',
          keywords: document.querySelector('meta[name="keywords"]')?.content || '',
          author: document.querySelector('meta[name="author"]')?.content || '',
          siteName: document.querySelector('meta[property="og:site_name"]')?.content || '',
          publishedTime: document.querySelector('meta[property="article:published_time"]')?.content || ''
        };
        
        // Main text extraction with better formatting
        const textContent = clonedContainer.textContent
          .replace(/\\s+/g, ' ')
          .replace(/\\t/g, ' ')
          .trim();
        
        // Get a sampling of images
        const images = Array.from(document.querySelectorAll('img')).slice(0, 10).map(img => ({
          src: img.src,
          alt: img.alt || '',
          width: img.width,
          height: img.height
        })).filter(img => img.src && !img.src.includes('data:image') && (img.width > 100 || img.height > 100));
        
        return {
          title: document.title,
          text: textContent,
          url: window.location.href,
          metadata: metadata,
          links: links,
          images: images
        };
      } catch (error) {
        // Return error information
        return {
          error: error.toString(),
          url: window.location.href,
          title: document.title || 'Unknown Title'
        };
      }
    })();
  `)
  .then(result => {
    if (result.error) {
      console.error('Error in content extraction script:', result.error);
      // Try a simpler extraction as fallback
      extractSimpleContent(browser);
    } else {
      savePageToVectorDB(browser, result);
    }
  })
  .catch(error => {
    console.error('Failed to execute content extraction script:', error);
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
    console.error('Failed to access iframe content (likely CORS restriction):', error);
    
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
      console.error('Error extracting content via proxy:', error);
      
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
      console.error('Failed to extract simple content:', error);
      
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
    console.error('Invalid content: content is null or undefined');
    return;
  }
  
  if (!content.text) {
    console.error('Invalid content: missing text property');
    return;
  }
  
  if (typeof content.text !== 'string') {
    console.error('Invalid content: text is not a string', typeof content.text);
    return;
  }
  
  if (content.text.trim().length < 10) {
    console.error('Invalid content: text is too short', content.text);
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
      console.error('Error saving page to vector DB:', error);
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
 * @param {Document} doc - DOM document object
 * @param {string} url - Current page URL
 * @returns {Object} Extracted content
 */
export function extractFullPageContent(doc, url) {
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
          console.warn('Error converting relative URL:', err);
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
    console.warn('Error extracting page content:', err);
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
    console.warn('Error extracting main content:', err);
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
    console.warn('Error extracting heading structure:', err);
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