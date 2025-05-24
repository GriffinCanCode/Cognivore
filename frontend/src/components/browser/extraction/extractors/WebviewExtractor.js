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
    if (!webview.isConnected) {
      extractorLogger.debug('Webview is not connected to DOM');
      return false;
    }
    
    // Check if webview has executeJavaScript method
    if (typeof webview.executeJavaScript !== 'function') {
      extractorLogger.debug('Webview missing executeJavaScript method');
      return false;
    }
    
    // For Electron webviews, try to access getWebContentsId which throws
    // if the webview is not ready
    if (typeof webview.getWebContentsId === 'function') {
      try {
        webview.getWebContentsId();
        extractorLogger.debug('Webview is ready (getWebContentsId successful)');
        return true;
      } catch (e) {
        // getWebContentsId throws when webview is not ready
        if (e.message && e.message.includes('must be attached to the DOM')) {
          extractorLogger.debug('Webview not ready: ' + e.message);
          return false;
        }
        // Other errors might not be related to readiness
        extractorLogger.warn('Unexpected error checking webview readiness:', e.message);
      }
    }
    
    // Check various states to determine if webview is likely ready
    const hasDataReady = webview.getAttribute('data-ready') === 'true';
    const hasLoadFinished = webview.getAttribute('data-load-finished') === 'true';
    const isVisible = webview.style.visibility !== 'hidden' && webview.style.display !== 'none';
    const hasContentDocument = typeof webview.getURL === 'function' && webview.getURL() !== 'about:blank';
    
    // If any positive indicators exist, consider it ready
    if (hasDataReady || hasLoadFinished || isVisible || hasContentDocument) {
      extractorLogger.debug('Webview appears ready based on attributes and state');
      return true;
    }
    
    // Additional check: try a simple no-op executeJavaScript call
    try {
      webview.executeJavaScript('true')
        .then(() => {
          extractorLogger.debug('Webview passed executeJavaScript test');
          webview.setAttribute('data-js-ready', 'true');
        })
        .catch(err => {
          extractorLogger.debug('Webview failed executeJavaScript test:', err);
        });
      
      // If we got here without throwing, we can probably execute scripts
      return true;
    } catch (err) {
      extractorLogger.debug('executeJavaScript test threw an error:', err);
      return false;
    }
  } catch (e) {
    extractorLogger.warn(`Error checking webview readiness: ${e.message}`);
    return false;
  }
}

/**
 * Force webview to be ready for extraction if possible
 * @param {Object} webview - Webview element
 * @returns {boolean} Whether webview was successfully prepared
 */
function prepareWebviewForExtraction(webview) {
  if (!webview || !webview.isConnected) return false;
  
  try {
    // Set data attributes to indicate readiness
    webview.setAttribute('data-ready', 'true');
    
    // Ensure the webview is visible
    webview.style.visibility = 'visible';
    webview.style.opacity = '1';
    webview.style.display = 'block';
    webview.style.zIndex = '10';
    
    // Force layout recalculation
    void webview.offsetHeight;
    
    // If webview has a forceVisibility method (added by WebviewInitializer), use it
    if (typeof webview.forceVisibility === 'function') {
      webview.forceVisibility();
    }
    
    // If webview has an applyAllCriticalStyles method, use it
    if (typeof webview.applyAllCriticalStyles === 'function') {
      webview.applyAllCriticalStyles();
    }
    
    extractorLogger.debug('Prepared webview for extraction');
    return true;
  } catch (e) {
    extractorLogger.error(`Error preparing webview for extraction: ${e.message}`);
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
  extractorLogger.debug('Extracting content from webview', { url });
  
  // First try to prepare the webview for extraction
  prepareWebviewForExtraction(webview);
  
  if (!isWebviewReady(webview)) {
    extractorLogger.warn('Webview not ready for extraction, will try forcing readiness');
    
    // Wait briefly and try again with forced readiness
    await new Promise(resolve => setTimeout(resolve, 300));
    prepareWebviewForExtraction(webview);
    
    // Second readiness check
    if (!isWebviewReady(webview)) {
      extractorLogger.warn('Webview still not ready after first attempt, trying more aggressive preparation');
      
      // Apply more aggressive preparation
      try {
        // Set maximum visibility
        webview.style.visibility = 'visible';
        webview.style.opacity = '1';
        webview.style.display = 'block';
        webview.style.zIndex = '10';
        
        // Try to fix common issues with a simple script
        if (typeof webview.executeJavaScript === 'function') {
          try {
            await webview.executeJavaScript('document.body.style.visibility = "visible"');
            extractorLogger.debug('Applied visibility fix via JavaScript');
          } catch (err) {
            extractorLogger.warn('Failed to execute visibility script:', err);
          }
        }
        
        // Wait a bit longer for the aggressive preparation to take effect
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        extractorLogger.error('Error during aggressive preparation:', err);
      }
      
      // Final readiness check
      if (!isWebviewReady(webview)) {
        return Promise.reject(new Error('Webview not ready for extraction after multiple preparation attempts'));
      }
    }
  }
  
  // Determine if we're extracting from Google for special handling
  const isGooglePage = url && url.includes('google.com');
  const isYouTubePage = url && url.includes('youtube.com');
  
  // Choose the appropriate extraction script
  let extractionScript;
  if (isGooglePage) {
    extractorLogger.debug('Using Google-specific extraction script');
    extractionScript = getGoogleExtractionScript();
  } else if (isYouTubePage) {
    extractorLogger.debug('Using YouTube-specific extraction script');
    extractionScript = getYouTubeExtractionScript();
  } else {
    extractorLogger.debug('Using standard extraction script');
    extractionScript = getStandardExtractionScript();
  }
  
  try {
    // Execute the extraction script with timeout handling
    const extractionPromise = webview.executeJavaScript(extractionScript);
    
    // Set up a timeout for extraction
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Extraction timed out after 10 seconds')), 10000);
    });
    
    // Race the extraction against the timeout
    const result = await Promise.race([extractionPromise, timeoutPromise]);
    
    // Log success and return the result
    extractorLogger.debug('Content extraction successful', { 
      contentLength: result.text ? result.text.length : 0,
      success: result.success 
    });
    
    return result;
  } catch (error) {
    extractorLogger.error(`WebviewExtractor error: ${error.message}`);
    
    // Try a fallback extraction method
    try {
      extractorLogger.debug('Attempting fallback extraction method');
      const fallbackScript = getFallbackExtractionScript();
      const fallbackResult = await webview.executeJavaScript(fallbackScript);
      
      extractorLogger.debug('Fallback extraction completed', {
        success: fallbackResult.success,
        contentLength: fallbackResult.text ? fallbackResult.text.length : 0
      });
      
      return fallbackResult;
    } catch (fallbackError) {
      extractorLogger.error(`Fallback extraction also failed: ${fallbackError.message}`);
      throw new Error(`WebviewExtractor failed: ${error.message}`);
    }
  }
}

/**
 * Get specialized extraction script for Google pages
 * @returns {string} JavaScript extraction script
 */
function getGoogleExtractionScript() {
  return `
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
        
        // Specific extraction logic for Google
        let mainContentElement = null;
        let searchResults = [];
        
        // Enhanced search result extraction for modern Google layout
        function extractSearchResults() {
          // Select all possible result containers with comprehensive selectors
          const resultElements = document.querySelectorAll(
            '.g, .MjjYud, .yuRUbf, .v7W49e, .ULSxyf, .Gx5Zad, .tF2Cxc, .IsZvec, .aCOpRe'
          );
          
          const results = [];
          resultElements.forEach(el => {
            if (el) {
              // Use multiple selectors to find title elements
              const titleEl = el.querySelector('h3, .LC20lb, [role="heading"]');
              // Find link with multiple strategies
              const linkEl = el.querySelector('a[href], .yuRUbf a, .NJjxre a, .tF2Cxc a');
              // Find snippet with multiple selectors
              const snippetEl = el.querySelector('.VwiC3b, .st, .IsZvec, .s, .aCOpRe');
              
              if (titleEl && linkEl && linkEl.href) {
                // Check if this is a duplicate of an already found result
                const isDuplicate = results.some(r => r.url === linkEl.href);
                
                if (!isDuplicate) {
                  results.push({
                    title: titleEl.textContent.trim(),
                    url: linkEl.href,
                    snippet: snippetEl ? snippetEl.textContent.trim() : '',
                    position: results.length + 1
                  });
                }
              }
            }
          });
          
          return results;
        }
        
        // Find search results using enhanced extraction
        searchResults = extractSearchResults();
        
        // Find main content with better container detection
        const googleContainers = [
          document.getElementById('search'),
          document.getElementById('main'),
          document.getElementById('rcnt'),
          document.getElementById('center_col'),
          document.getElementById('rso'),
          document.querySelector('[role="main"]'),
          document.querySelector('main'),
          document.querySelector('#cnt')
        ];
        
        // Find the container with the most content
        let bestContainerTextLength = 0;
        for (const container of googleContainers) {
          if (container && container.textContent) {
            const textLength = container.textContent.trim().length;
            if (textLength > bestContainerTextLength) {
              mainContentElement = container;
              bestContainerTextLength = textLength;
            }
          }
        }
        
        // Fallback to body if no suitable container found
        if (!mainContentElement || bestContainerTextLength < 100) {
          mainContentElement = document.body;
        }
        
        // Extract main text content
        const mainText = mainContentElement ? extractText(mainContentElement) : '';
        
        // Extract featured snippet if present
        let featuredSnippet = null;
        const featuredSnippetElement = document.querySelector('.kp-wholepage, .xpdopen, .c2xzTb, .g tF2Cxc, .ULSxyf');
        if (featuredSnippetElement) {
          const snippetTitleEl = featuredSnippetElement.querySelector('h3, [role="heading"]');
          const snippetContentEl = featuredSnippetElement.querySelector('.hgKElc, .Z0LcW, .IZ6rdc');
          const snippetSourceEl = featuredSnippetElement.querySelector('a[href], .iUh30');
          
          if (snippetContentEl) {
            featuredSnippet = {
              title: snippetTitleEl ? snippetTitleEl.textContent.trim() : 'Featured Snippet',
              content: snippetContentEl.textContent.trim(),
              source: snippetSourceEl && snippetSourceEl.href ? snippetSourceEl.href : null
            };
          }
        }
        
        // Extract metadata
        const metadata = {};
        Array.from(document.querySelectorAll('meta[name], meta[property]')).forEach(meta => {
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');
          if (name && content) {
            metadata[name] = content;
          }
        });
        
        // Extract related searches
        const relatedSearches = [];
        document.querySelectorAll('.Q3DXx, .brs_col a, a.k8XOCe').forEach(el => {
          if (el && el.textContent) {
            relatedSearches.push(el.textContent.trim());
          }
        });
        
        // Get search query if available
        let searchQuery = '';
        const searchInput = document.querySelector('input[name="q"], input.gLFyf');
        if (searchInput && searchInput.value) {
          searchQuery = searchInput.value;
        }
        
        // Return final extraction result with enhanced data
        return {
          title: document.title || '',
          url: window.location.href,
          text: mainText,
          searchResults,
          featuredSnippet,
          relatedSearches,
          searchQuery,
          metadata,
          extractionMethod: 'google-enhanced',
          timestamp: new Date().toISOString(),
          success: mainText.length > 0 || searchResults.length > 0
        };
      } catch (error) {
        return {
          error: true,
          message: error.message || 'Unknown error in Google content extraction',
          stack: error.stack,
          title: document.title || 'Error Page',
          url: window.location.href,
          timestamp: new Date().toISOString(),
          success: false
        };
      }
    })();
  `;
}

/**
 * Get specialized extraction script for YouTube pages
 * @returns {string} JavaScript extraction script
 */
function getYouTubeExtractionScript() {
  return `
    (function() {
      try {
        // Helper to extract clean text
        function extractText(element) {
          if (!element) return '';
          
          // Clone to avoid modifying the page
          const clone = element.cloneNode(true);
          
          // Remove scripts and styles
          clone.querySelectorAll('script, style, svg, iframe').forEach(el => el.remove());
          
          return clone.textContent.replace(/\\s+/g, ' ').trim();
        }
        
        // Get video information
        const videoData = {};
        
        // Get video title
        const titleElement = document.querySelector('#title h1, .title .ytd-video-primary-info-renderer');
        if (titleElement) {
          videoData.title = titleElement.textContent.trim();
        } else {
          videoData.title = document.title.replace(' - YouTube', '').trim();
        }
        
        // Get video description
        const descriptionElement = document.querySelector('#description, #description-text');
        if (descriptionElement) {
          videoData.description = extractText(descriptionElement);
        }
        
        // Get channel info
        const channelElement = document.querySelector('#owner #channel-name, #owner-name a');
        if (channelElement) {
          videoData.channel = channelElement.textContent.trim();
          
          // Get channel URL if available
          const channelLink = channelElement.closest('a');
          if (channelLink && channelLink.href) {
            videoData.channelUrl = channelLink.href;
          }
        }
        
        // Get view count
        const viewCountElement = document.querySelector('.view-count, #count');
        if (viewCountElement) {
          videoData.viewCount = viewCountElement.textContent.trim();
        }
        
        // Get video metadata (like, publish date)
        const metaItems = document.querySelectorAll('ytd-video-primary-info-renderer #info-text');
        if (metaItems.length > 0) {
          videoData.metadata = extractText(metaItems[0]);
        }
        
        // Get comments if available
        const comments = [];
        document.querySelectorAll('ytd-comment-thread-renderer').forEach(commentEl => {
          const authorEl = commentEl.querySelector('#author-text');
          const contentEl = commentEl.querySelector('#content');
          
          if (authorEl && contentEl) {
            comments.push({
              author: authorEl.textContent.trim(),
              text: extractText(contentEl)
            });
          }
        });
        
        if (comments.length > 0) {
          videoData.comments = comments.slice(0, 10); // Limit to 10 comments
        }
        
        // Get recommended videos
        const recommendedVideos = [];
        document.querySelectorAll('ytd-compact-video-renderer, ytd-watch-next-secondary-results-renderer ytd-compact-video-renderer').forEach(videoEl => {
          const titleEl = videoEl.querySelector('#video-title');
          const thumbnailEl = videoEl.querySelector('#thumbnail img');
          const channelEl = videoEl.querySelector('#channel-name, #byline');
          
          if (titleEl) {
            const videoInfo = {
              title: titleEl.textContent.trim(),
              url: titleEl.href || '',
            };
            
            if (channelEl) {
              videoInfo.channel = channelEl.textContent.trim();
            }
            
            if (thumbnailEl && thumbnailEl.src) {
              videoInfo.thumbnail = thumbnailEl.src;
            }
            
            recommendedVideos.push(videoInfo);
          }
        });
        
        if (recommendedVideos.length > 0) {
          videoData.recommendedVideos = recommendedVideos.slice(0, 10); // Limit to 10 videos
        }
        
        // Get main content text combining title, description and metadata
        const mainText = [
          videoData.title || '',
          videoData.channel ? 'Channel: ' + videoData.channel : '',
          videoData.metadata || '',
          videoData.description || ''
        ].filter(Boolean).join('\\n\\n');
        
        return {
          title: videoData.title || document.title || '',
          url: window.location.href,
          text: mainText,
          videoData,
          extractionMethod: 'youtube',
          timestamp: new Date().toISOString(),
          success: mainText.length > 0
        };
      } catch (error) {
        return {
          error: true,
          message: error.message || 'Unknown error in YouTube content extraction',
          stack: error.stack,
          title: document.title || 'Error Page',
          url: window.location.href,
          timestamp: new Date().toISOString(),
          success: false
        };
      }
    })();
  `;
}

/**
 * Get standard extraction script for non-Google pages
 * @returns {string} JavaScript extraction script
 */
function getStandardExtractionScript() {
  return `
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
        const isMedium = hostname.includes('medium.com');
        const isNews = /news|article|blog/.test(hostname);
        
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
        } else if (isMedium) {
          // Medium-specific extraction
          mainContentElement = document.querySelector('article') ||
                               document.querySelector('.section-content');
          extractionMethod = 'medium';
        } else if (isNews) {
          // News article extraction
          mainContentElement = document.querySelector('article') ||
                               document.querySelector('.article-body') ||
                               document.querySelector('.entry-content') ||
                               document.querySelector('.post-content');
          extractionMethod = 'news';
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
            '.main-content',
            '.entry-content',
            '.article-content',
            '.post-body',
            '.story-body'
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
}

/**
 * Get fallback extraction script that extracts minimal content
 * @returns {string} JavaScript extraction script
 */
function getFallbackExtractionScript() {
  return `
    (function() {
      try {
        // Minimal extraction logic that should work in most cases
        const title = document.title || '';
        const url = window.location.href;
        
        // Get page text with minimal processing
        let text = '';
        if (document.body) {
          // Simple cleanup
          const clonedBody = document.body.cloneNode(true);
          const unwantedElements = clonedBody.querySelectorAll('script, style, svg, iframe, noscript');
          unwantedElements.forEach(el => el.remove());
          
          text = clonedBody.textContent.replace(/\\s+/g, ' ').trim();
        }
        
        // Get all visible links
        const links = Array.from(document.querySelectorAll('a[href]'))
          .filter(a => a.offsetWidth > 0 && a.offsetHeight > 0)
          .map(a => ({
            text: a.textContent.trim(),
            url: a.href
          }))
          .filter(link => link.text && link.url)
          .slice(0, 50); // Limit to 50 links
        
        return {
          title,
          url,
          text,
          links,
          extractionMethod: 'fallback',
          timestamp: new Date().toISOString(),
          success: text.length > 0
        };
      } catch (error) {
        // Absolute minimal return - should never fail
        return {
          title: document.title || '',
          url: window.location.href,
          text: document.body ? document.body.textContent.substring(0, 10000) : '',
          extractionMethod: 'emergency-fallback',
          error: error.message,
          timestamp: new Date().toISOString(),
          success: false
        };
      }
    })();
  `;
}

// Export methods
const WebviewExtractor = {
  isWebviewReady,
  prepareWebviewForExtraction,
  extract
};

export default WebviewExtractor; 