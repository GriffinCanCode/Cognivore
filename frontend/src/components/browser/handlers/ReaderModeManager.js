/**
 * ReaderModeManager.js - Handles reader mode functionality
 * 
 * This module provides methods for toggling and managing reader mode
 * in the Voyager browser component.
 */

import logger from '../../../utils/logger';
import ExtractorManager from '../extraction/ExtractorManager';

// Create a logger instance for this module
const readerLogger = logger.scope('ReaderModeManager');

// Track last attempted extraction to prevent duplicate attempts
const extractionAttempts = new Map();

// Add Wikipedia to the list of complex sites
const COMPLEX_SITES = [
  'reddit.com',
  'old.reddit.com',
  'new.reddit.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'wikipedia.org', // Added Wikipedia
  'britannica.com' // Added Britannica
];

// Debounce function to prevent rapid toggling
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Debounced toggle function to prevent rapid clicks
const debouncedToggle = debounce((browser, callback) => {
  const currentMode = browser.state.viewMode;
  let newMode;
  
  if (currentMode === 'browser') {
    newMode = 'reader';
  } else if (currentMode === 'reader') {
    newMode = 'split';
  } else {
    newMode = 'browser';
  }
  
  browser.setState({ viewMode: newMode });
  
  // If entering reader mode and we don't have content yet, try to fetch it
  if ((newMode === 'reader' || newMode === 'split') && !browser.state.readerContent) {
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'reader-loading-indicator';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Loading reader view...</p>';
    
    if (browser.containerRef && browser.containerRef.current) {
      browser.containerRef.current.appendChild(loadingIndicator);
    }

    // Add a short timeout to force UI update before extraction starts
    setTimeout(() => {
      extractAndApplyReaderMode(browser)
        .then(content => {
          // Remove loading indicator if it exists
          const indicator = browser.containerRef?.current?.querySelector('.reader-loading-indicator');
          if (indicator) indicator.remove();
          
          renderReaderMode(browser, newMode);
        })
        .catch(err => {
          readerLogger.warn('Error capturing content for reader mode:', err);
          // Remove loading indicator if it exists
          const indicator = browser.containerRef?.current?.querySelector('.reader-loading-indicator');
          if (indicator) indicator.remove();
          
          // Show error message in reader view
          showReaderError(browser, err);
        });
    }, 100); // Short delay to ensure loading indicator is visible
  } else {
    // Render the reader mode with existing content
    renderReaderMode(browser, newMode);
  }
  
  // Update reader mode button state if it exists
  updateReaderModeButton(browser, newMode);
  
  if (callback) callback(newMode);
  
  return newMode;
}, 300); // 300ms debounce

/**
 * Toggle reader mode between browser, reader, and split views
 * 
 * @param {Object} browser - Browser instance
 * @returns {string} The new view mode
 */
export function toggleReaderMode(browser) {
  // Ensure any stuck loading indicators are removed before toggling
  cleanupLoadingIndicators(browser);
  return debouncedToggle(browser);
}

/**
 * Utility function to clean up any stuck loading indicators
 * 
 * @param {Object} browser - Browser instance 
 */
function cleanupLoadingIndicators(browser) {
  if (!browser || !browser.containerRef || !browser.containerRef.current) return;
  
  const loadingIndicators = browser.containerRef.current.querySelectorAll('.reader-loading-indicator');
  if (loadingIndicators.length > 0) {
    readerLogger.debug('Cleaning up stuck loading indicators:', loadingIndicators.length);
    loadingIndicators.forEach(el => el.remove());
  }
  
  const loadingElements = browser.containerRef.current.querySelectorAll('.reader-loading');
  if (loadingElements.length > 0) {
    readerLogger.debug('Cleaning up stuck loading elements:', loadingElements.length);
    loadingElements.forEach(el => el.remove());
  }
}

/**
 * Extract and apply reader mode content to the browser
 * @param {Object} browser - Browser instance 
 * @returns {Promise<Object>} - Promise resolving to the reader content
 */
function extractAndApplyReaderMode(browser) {
  // Get the current URL from browser
  const currentUrl = browser.webview?.src || browser.state?.url || '';
  readerLogger.debug('Extracting content for URL:', currentUrl);
  
  // Check if we've already attempted extraction for this URL in the last few seconds
  // This prevents duplicate extractions during rapid toggling
  const now = Date.now();
  const lastAttempt = extractionAttempts.get(currentUrl);
  
  if (lastAttempt && (now - lastAttempt.timestamp < 5000) && lastAttempt.content) {
    readerLogger.info('Using cached extraction for:', currentUrl);
    return Promise.resolve(lastAttempt.content);
  }
  
  // Check if site is a complex site that needs special handling
  const isComplexSite = COMPLEX_SITES.some(domain => currentUrl.includes(domain));
  
  // Store the attempt timestamp
  extractionAttempts.set(currentUrl, { 
    timestamp: now,
    content: null
  });
  
  // Determine extraction options based on site complexity
  const extractionOptions = {
    preferredMethod: isComplexSite ? 'webview' : undefined,
    complexSite: isComplexSite
  };
  
  // Set a timeout to proceed with minimal content if extraction takes too long
  const extractionTimeout = setTimeout(() => {
    readerLogger.warn('Content extraction timed out for:', currentUrl);
    const fallbackContent = {
      title: browser.state?.title || 'Content Unavailable',
      url: currentUrl,
      text: 'The content could not be extracted from this page. Try refreshing the page or switching to split view to see the original content.',
      processedContent: '<p>The content could not be extracted from this page. Try refreshing the page or switching to split view to see the original content.</p>'
    };
    
    // Store in cache
    const entry = extractionAttempts.get(currentUrl);
    if (entry) {
      entry.content = fallbackContent;
    }
    browser.setState({ readerContent: fallbackContent });
    
    // Remove loading indicator
    const indicator = browser.containerRef?.current?.querySelector('.reader-loading-indicator');
    if (indicator) indicator.remove();
    
    // Also remove reader-loading class elements which might be stuck
    const loadingElements = browser.containerRef?.current?.querySelectorAll('.reader-loading');
    if (loadingElements) {
      loadingElements.forEach(el => el.remove());
    }
    
    // Render reader mode with fallback content
    renderReaderMode(browser, browser.state.viewMode);
  }, 10000);  // 10 second timeout - increased from 5 seconds
  
  return new Promise((resolve, reject) => {
    try {
      // Use the new extraction system
      ExtractorManager.extract(browser, currentUrl, extractionOptions)
        .then(content => {
          clearTimeout(extractionTimeout);
          // Store in cache
          const entry = extractionAttempts.get(currentUrl);
          if (entry) {
            entry.content = content;
          }
          browser.setState({ readerContent: content });
          resolve(content);
        })
        .catch(err => {
          clearTimeout(extractionTimeout);
          readerLogger.error('Extraction failed:', err);
          
          // Fallback to legacy extraction methods
          if (isComplexSite) {
            // Try enhanced extraction for complex sites
            extractContentForComplexSite(browser)
              .then(content => {
                // Store in cache
                const entry = extractionAttempts.get(currentUrl);
                if (entry) {
                  entry.content = content;
                }
                browser.setState({ readerContent: content });
                resolve(content);
              })
              .catch(fallbackErr => {
                readerLogger.error('Enhanced extraction fallback failed:', fallbackErr);
                // As a last resort, try standard extraction
                standardExtraction(browser)
                  .then(resolve)
                  .catch(standardErr => {
                    readerLogger.error('All extraction methods failed:', standardErr);
                    reject(standardErr);
                  });
              });
          } else {
            // Fallback to standard extraction
            standardExtraction(browser)
              .then(content => {
                // Store in cache
                const entry = extractionAttempts.get(currentUrl);
                if (entry) {
                  entry.content = content;
                }
                browser.setState({ readerContent: content });
                resolve(content);
              })
              .catch(standardErr => {
                readerLogger.error('Standard extraction failed:', standardErr);
                reject(standardErr);
              });
          }
        });
    } catch (err) {
      // Catch any unexpected errors in the extraction process itself
      clearTimeout(extractionTimeout);
      readerLogger.error('Unexpected error during content extraction setup:', err);
      reject(err);
    }
  });
}

/**
 * Standard content extraction using capturePageContent
 * @param {Object} browser - Browser instance
 * @returns {Promise<Object>} - Promise resolving to content
 */
function standardExtraction(browser) {
  // Create a controller to abort the operation if it takes too long
  const controller = new AbortController();
  const signal = controller.signal;
  
  // Set a 4-second timeout to ensure this doesn't hang forever
  const timeoutId = setTimeout(() => {
    controller.abort();
    readerLogger.warn('Standard extraction aborted due to timeout');
  }, 4000);
  
  return new Promise((resolve, reject) => {
    // Add auto-recovery timeout that will resolve with minimal content
    // This ensures we always exit the loading state
    const forceResolveTimeout = setTimeout(() => {
      readerLogger.error('Force-resolving extraction after extended timeout');
      clearTimeout(timeoutId);
      
      // Provide minimal content to avoid being stuck in loading state
      const fallbackContent = {
        title: browser.state?.title || 'Content Unavailable',
        url: browser.webview?.src || browser.state?.url || '',
        text: 'Unable to extract content from this page. The page might be too complex or require authentication.',
        processedContent: '<p>Unable to extract content from this page. The page might be too complex or require authentication.</p>' +
                          '<p>Try refreshing the page or switching to normal view to see the original content.</p>'
      };
      
      browser.setState({ readerContent: fallbackContent });
      
      // Remove any stuck loading indicators
      const loadingElements = browser.containerRef?.current?.querySelectorAll('.reader-loading');
      if (loadingElements) {
        loadingElements.forEach(el => el.remove());
      }
      
      const loadingIndicator = browser.containerRef?.current?.querySelector('.reader-loading-indicator');
      if (loadingIndicator) loadingIndicator.remove();
      
      resolve(fallbackContent);
    }, 15000); // Ultimate fallback after 15 seconds (increased from 7 seconds)
    
    // Main extraction attempt
    capturePageContent(browser)
      .then(content => {
        clearTimeout(timeoutId);
        clearTimeout(forceResolveTimeout);
        
        if (!content || (!content.text && !content.processedContent)) {
          throw new Error('No content extracted');
        }
        
        browser.setState({ readerContent: content });
        resolve(content);
      })
      .catch(err => {
        clearTimeout(timeoutId);
        
        readerLogger.error('Error in capturePageContent:', err);
        
        // Don't clear forceResolveTimeout - let it handle the fallback if needed
        // But if the error happens quickly, provide content right away
        if (err.message === 'Content extraction timed out' || err.message === 'Content extraction was aborted') {
          clearTimeout(forceResolveTimeout);
          
          const fallbackContent = {
            title: browser.state?.title || 'Extraction Timeout',
            url: browser.webview?.src || browser.state?.url || '',
            text: 'The content extraction timed out. The page might be too complex or contain dynamic content.',
            processedContent: '<p>The content extraction timed out. The page might be too complex or contain dynamic content.</p>' +
                              '<p>Try switching to normal view to see the original content.</p>'
          };
          
          browser.setState({ readerContent: fallbackContent });
          resolve(fallbackContent);
        } else {
          reject(err);
        }
      });
  });
}

/**
 * Enhanced extraction for complex sites
 * @param {Object} browser - Browser instance
 * @returns {Promise<Object>} - Promise resolving to content
 */
function extractContentForComplexSite(browser) {
  if (!browser || !browser.webview) {
    return Promise.reject(new Error('Webview not available'));
  }
  
  const currentUrl = browser.webview.src || browser.state?.url || '';
  const isWikipedia = currentUrl.includes('wikipedia.org');
  const isBritannica = currentUrl.includes('britannica.com');
  
  // Set a timeout for this specific extraction method
  let complexSiteTimeout = null;
  
  // For Wikipedia, set up a shorter emergency fallback timeout
  let emergencyFallbackTimeout = null;
  
  return new Promise((resolve, reject) => {
    // Set a timeout specific to complex site extraction
    complexSiteTimeout = setTimeout(() => {
      readerLogger.warn(`Complex site extraction timed out for: ${currentUrl}`);
      return reject(new Error('Complex site extraction timed out'));
    }, 12000); // 12 second timeout for complex sites
    
    // For Wikipedia, add a quicker emergency fallback that will resolve with minimal content
    if (isWikipedia) {
      emergencyFallbackTimeout = setTimeout(() => {
        clearTimeout(complexSiteTimeout); // Clear the main timeout
        readerLogger.warn('Using emergency fallback for Wikipedia extraction');
        
        // Create minimal content from the page title for immediate display
        const fallbackContent = {
          title: browser.state?.title || 'Wikipedia Article',
          url: currentUrl,
          text: 'Wikipedia content is being loaded. This is a simplified view while the full content is being prepared.',
          processedContent: `<h1>${browser.state?.title || 'Wikipedia Article'}</h1>
                           <p>Wikipedia content is being loaded. This is a simplified view while the full content is being prepared.</p>
                           <p>You can continue reading in the original view while the content is extracted.</p>`
        };
        
        browser.setState({ readerContent: fallbackContent });
        resolve(fallbackContent);
        
        // Continue attempting to extract in the background
        browser.webview.executeJavaScript(`
          (function() {
            document.title;  // Simple operation to check if page is accessible
          })();
        `)
        .then(() => {
          // Page is accessible, try simplified extraction just to get main content
          browser.webview.executeJavaScript(`
            (function() {
              const title = document.querySelector('h1')?.textContent || document.title;
              const mainText = Array.from(document.querySelectorAll('p')).map(p => p.textContent).join('\\n\\n');
              return { title, text: mainText };
            })();
          `)
          .then(result => {
            if (result && result.title && result.text) {
              // Update with better content if we get it
              const betterContent = {
                title: result.title,
                url: currentUrl,
                text: result.text,
                processedContent: `<h1>${result.title}</h1>` + 
                  result.text.split('\\n\\n').map(p => `<p>${p}</p>`).join('')
              };
              browser.setState({ readerContent: betterContent });
            }
          })
          .catch(err => {
            readerLogger.debug('Background extraction failed:', err);
          });
        })
        .catch(err => {
          readerLogger.debug('Page not accessible for background extraction:', err);
        });
      }, 5000); // 5 second emergency fallback for Wikipedia
    }
  
    // Special handling for Wikipedia and Britannica
    if (isWikipedia || isBritannica) {
      const siteName = isWikipedia ? 'Wikipedia' : 'Britannica';
      readerLogger.info(`Using ${siteName}-specific extraction for:`, currentUrl);
      browser.webview.executeJavaScript(`
        (function() {
          try {
            // Get the page title
            const title = document.querySelector('h1')?.textContent || document.title;
            
            // Get the main content
            const content = document.getElementById('content');
            const article = document.getElementById('bodyContent') || document.querySelector('.mw-body-content');
            
            let text = '';
            let processedContent = '';
            
            if (article) {
              // Get all paragraphs, headings, and lists
              const elements = article.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote');
              
              // Build HTML content directly
              processedContent = Array.from(elements).map(el => {
                // Skip empty paragraphs and reference sections
                if ((el.tagName === 'P' && !el.textContent.trim()) || 
                    el.closest('.reflist') || 
                    el.closest('.reference')) {
                  return '';
                }
                
                // Clone the element to avoid modifying the original
                const clone = el.cloneNode(true);
                
                // Remove reference elements
                const refs = clone.querySelectorAll('.reference, .noprint');
                refs.forEach(ref => ref.remove());
                
                return clone.outerHTML;
              }).join('\\n');
              
              // Also get plain text for fallback
              text = Array.from(elements)
                .filter(el => !el.closest('.reflist') && !el.closest('.reference'))
                .map(el => el.textContent.trim())
                .filter(text => text.length > 0)
                .join('\\n\\n');
            } else {
              // Fallback extraction
              const paragraphs = document.querySelectorAll('p');
              text = Array.from(paragraphs)
                .map(p => p.textContent.trim())
                .filter(text => text.length > 0)
                .join('\\n\\n');
            }
            
            // Get metadata
            const metadata = {
              title: title,
              url: window.location.href,
              lastModified: document.querySelector('#footer-info-lastmod')?.textContent || '',
              authors: 'Wikipedia contributors',
              site: 'Wikipedia'
            };
            
            return {
              title: title,
              url: window.location.href,
              text: text,
              processedContent: processedContent,
              mainContent: text,
              metadata: metadata
            };
          } catch (error) {
            return {
              error: true,
              message: error.message || 'Error extracting Wikipedia content',
              stack: error.stack,
              url: window.location.href
            };
          }
        })();
      `)
      .then(result => {
        if (result && result.error) {
          clearTimeout(complexSiteTimeout);
          // Also clear emergencyFallbackTimeout if it exists
          if (emergencyFallbackTimeout) {
            clearTimeout(emergencyFallbackTimeout);
          }
          readerLogger.error('Error in Wikipedia extraction:', result.message);
          return reject(new Error('Could not extract Wikipedia content: ' + result.message));
        }
        
        clearTimeout(complexSiteTimeout);
        // Also clear emergencyFallbackTimeout if it exists
        if (emergencyFallbackTimeout) {
          clearTimeout(emergencyFallbackTimeout);
        }
        browser.setState({ readerContent: result });
        resolve(result);
      })
      .catch(err => {
        clearTimeout(complexSiteTimeout);
        // Also clear emergencyFallbackTimeout if it exists
        if (emergencyFallbackTimeout) {
          clearTimeout(emergencyFallbackTimeout);
        }
        readerLogger.error('Failed to execute Wikipedia extraction script:', err);
        reject(err);
      });
    } else {
      // Use the original complex site extraction for non-Wikipedia sites
      // Existing implementation...
      browser.webview.executeJavaScript(`
        (function() {
          try {
            const getTextFromNode = function(node) {
              // Skip invisible elements
              if (node.style && (
                node.style.display === 'none' || 
                node.style.visibility === 'hidden' ||
                node.style.opacity === '0')
              ) {
                return '';
              }
              
              // Skip small elements likely to be UI controls
              if (node.offsetWidth < 20 || node.offsetHeight < 20) {
                return '';
              }
              
              // Get computed style to check visibility
              const style = window.getComputedStyle(node);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return '';
              }
              
              return node.textContent || '';
            };
            
            // Function to clean text
            const cleanText = function(text) {
              if (!text) return '';
              return text.replace(/\\s+/g, ' ').trim();
            };
            
            // Get the page URL
            const url = window.location.href;
            
            // Get title and basic info
            const title = document.title;
            const output = {
              title: title,
              url: url,
              text: '',
              mainContent: '',
              headings: [],
              links: [],
              timestamp: new Date().toISOString()
            };
            
            // Check if we're on Reddit or other social sites
            const isReddit = url.includes('reddit.com');
            const isTwitter = url.includes('twitter.com') || url.includes('x.com');
            const isFacebook = url.includes('facebook.com');
            
            // Get the main content based on site type
            // [existing social media handling code]
            
            // For other sites, use general extraction
            if (!isReddit && !isTwitter && !isFacebook) {
              // Try to find the main content using multiple approaches
              
              // 1. Look for common content containers
              const possibleContainers = [
                document.querySelector('article'),
                document.querySelector('main'),
                document.querySelector('[role="main"]'),
                document.querySelector('#content'),
                document.querySelector('.content'),
                document.querySelector('.article'),
                document.querySelector('.post')
              ].filter(Boolean);
              
              // Sort by amount of text content
              possibleContainers.sort((a, b) => 
                (b.textContent?.length || 0) - (a.textContent?.length || 0)
              );
              
              // Use the container with the most text
              let mainContentElement = null;
              if (possibleContainers.length > 0) {
                mainContentElement = possibleContainers[0];
              } else {
                // If no obvious content container, gather all paragraphs and headings
                const allParagraphs = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
                  .filter(p => {
                    const text = cleanText(getTextFromNode(p));
                    return text.length > 10; // Ignore very short paragraphs
                  });
                
                const allText = allParagraphs.map(p => cleanText(getTextFromNode(p))).join('\\n\\n');
                output.text = allText;
                output.mainContent = allText;
              }
              
              // If we found a main content element, extract text from it
              if (mainContentElement) {
                const paragraphs = Array.from(mainContentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'));
                if (paragraphs.length > 0) {
                  const allText = paragraphs.map(p => cleanText(getTextFromNode(p))).join('\\n\\n');
                  output.text = allText;
                  output.mainContent = allText;
                } else {
                  output.text = cleanText(getTextFromNode(mainContentElement));
                  output.mainContent = output.text;
                }
              }
            }
            
            // Collect headings and links
            // [existing code]
            
            // Process text into HTML for reader mode
            const processedContent = processTextToHtml(output.text || output.mainContent);
            output.processedContent = processedContent;
            
            return output;
          } catch (error) {
            return {
              error: true,
              message: error.message || 'Unknown error during enhanced extraction',
              stack: error.stack,
              url: window.location.href,
              title: document.title
            };
          }
        }
        
        // Helper to process text into HTML
        function processTextToHtml(text) {
          if (!text) return '';
          
          // Split by double newlines for paragraphs
          const paragraphs = text.split(/\\n\\n+/);
          
          // Process each paragraph
          return paragraphs.map(p => {
            p = p.trim();
            if (!p) return '';
            
            // Check for headings and other block elements
            // [existing formatting code]
            
            // Wrap in paragraph tag
            return '<p>' + p + '</p>';
          }).join('\\n');
        }
      })();
      `)
      .then(result => {
        if (result && result.error) {
          clearTimeout(complexSiteTimeout);
          readerLogger.error('Error in complex site extraction:', result.message);
          return reject(new Error('Could not extract content: ' + result.message));
        }
        
        // Process result
        const content = {
          url: result.url || browser.state.url,
          title: result.title || 'Untitled Page',
          text: result.text || 'No content extracted',
          mainContent: result.mainContent || result.text || 'No content extracted',
          headings: result.headings || [],
          links: result.links || [],
          processedContent: result.processedContent || formatTextContent(result.text || '', result.url)
        };
        
        if (!content.text || content.text.trim().length < 20) {
          clearTimeout(complexSiteTimeout);
          readerLogger.warn('Complex site extraction returned insufficient content');
          return reject(new Error('Could not find meaningful content on this page'));
        }
        
        clearTimeout(complexSiteTimeout);
        browser.setState({ readerContent: content });
        resolve(content);
      })
      .catch(err => {
        clearTimeout(complexSiteTimeout);
        readerLogger.error('Failed to execute complex site extraction script:', err);
        reject(err);
      });
    }
  });
}

/**
 * Set reader mode directly to a specific mode
 * 
 * @param {Object} browser - Browser instance
 * @param {string} mode - Mode to set ('browser', 'reader', or 'split')
 * @returns {boolean} Success flag
 */
export function setReaderMode(browser, mode) {
  if (!['browser', 'reader', 'split'].includes(mode)) {
    readerLogger.error(`Invalid reader mode: ${mode}`);
    return false;
  }
  
  // Clean up any stuck loading indicators first
  cleanupLoadingIndicators(browser);
  
  browser.setState({ viewMode: mode });
  
  // If entering reader mode and we don't have content yet, try to fetch it
  if ((mode === 'reader' || mode === 'split') && !browser.state.readerContent) {
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'reader-loading-indicator';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Loading reader view...</p>';
    
    if (browser.containerRef && browser.containerRef.current) {
      browser.containerRef.current.appendChild(loadingIndicator);
    }
    
    extractAndApplyReaderMode(browser)
      .then(content => {
        // Remove loading indicator if it exists
        const indicator = browser.containerRef?.current?.querySelector('.reader-loading-indicator');
        if (indicator) indicator.remove();
        
        renderReaderMode(browser, mode);
      })
      .catch(err => {
        readerLogger.warn('Error capturing content for reader mode:', err);
        // Remove loading indicator if it exists
        const indicator = browser.containerRef?.current?.querySelector('.reader-loading-indicator');
        if (indicator) indicator.remove();
        
        showReaderError(browser, err);
      });
  } else {
    // Render the reader mode with existing content
    renderReaderMode(browser, mode);
  }
  
  // Update reader mode button state if it exists
  updateReaderModeButton(browser, mode);
  
  return true;
}

/**
 * Get the current reader mode
 * 
 * @param {Object} browser - Browser instance
 * @returns {string} Current view mode
 */
export function getReaderMode(browser) {
  return browser.state?.viewMode || 'browser';
}

/**
 * Check if reader mode is active (either reader or split mode)
 * 
 * @param {Object} browser - Browser instance
 * @returns {boolean} True if reader mode is active
 */
export function isReaderModeActive(browser) {
  const mode = getReaderMode(browser);
  return mode === 'reader' || mode === 'split';
}

/**
 * Create and manage reader mode UI container
 * 
 * @param {Object} browser - Browser instance 
 * @param {Object} content - Page content to display
 * @returns {HTMLElement} Reader mode container element
 */
function createReaderModeContainer(browser, content) {
  // Check if container already exists
  let container = browser.containerRef.current.querySelector('.reader-mode-container');
  
  if (!container) {
    // Create new container if it doesn't exist
    container = document.createElement('div');
    container.className = 'reader-mode-container';
    browser.containerRef.current.appendChild(container);
  }
  
  // Clear container content
  container.innerHTML = '';
  
  // Create reader toolbar with controls
  const toolbar = createReaderToolbar(browser);
  container.appendChild(toolbar);
  
  // Create content container
  const contentElement = document.createElement('div');
  contentElement.className = 'reader-mode-content';
  
  // Parse and render content
  if (content && content.text) {
    // Add title
    if (content.title) {
      const titleElement = document.createElement('h1');
      titleElement.textContent = content.title;
      contentElement.appendChild(titleElement);
    }
    
    // Add source link
    if (content.url) {
      const sourceContainer = document.createElement('p');
      sourceContainer.className = 'reader-source';
      sourceContainer.innerHTML = `Source: <a href="${content.url}" target="_blank">${content.url}</a>`;
      contentElement.appendChild(sourceContainer);
    }
    
    // Add main content
    if (typeof content.processedContent === 'string' && content.processedContent.trim()) {
      // Use processed content if available
      contentElement.innerHTML += content.processedContent;
    } else if (typeof content.text === 'string' && content.text.trim()) {
      // Use text content and apply basic formatting
      contentElement.innerHTML += formatTextContent(content.text, content.url);
    } else {
      const noContentMsg = document.createElement('p');
      noContentMsg.textContent = 'No readable content found on this page.';
      contentElement.appendChild(noContentMsg);
    }
  } else {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'reader-loading';
    loadingElement.innerHTML = `
      <div class="browser-loading-spinner"></div>
      <p>Preparing reader view...</p>
    `;
    contentElement.appendChild(loadingElement);
  }
  
  container.appendChild(contentElement);
  
  return container;
}

/**
 * Create reader mode toolbar with controls
 * 
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Toolbar element
 */
function createReaderToolbar(browser) {
  const toolbar = document.createElement('div');
  toolbar.className = 'reader-mode-toolbar';
  
  // Left side controls
  const leftControls = document.createElement('div');
  leftControls.className = 'reader-mode-controls';
  
  // Font size controls
  const fontSizeControls = document.createElement('div');
  fontSizeControls.className = 'font-size-controls';
  
  const decreaseFontBtn = document.createElement('button');
  decreaseFontBtn.className = 'reader-mode-button';
  decreaseFontBtn.title = 'Decrease font size';
  decreaseFontBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>
  `;
  decreaseFontBtn.addEventListener('click', () => {
    changeFontSize(browser, 'decrease');
  });
  
  const increaseFontBtn = document.createElement('button');
  increaseFontBtn.className = 'reader-mode-button';
  increaseFontBtn.title = 'Increase font size';
  increaseFontBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="16"></line>
      <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>
  `;
  increaseFontBtn.addEventListener('click', () => {
    changeFontSize(browser, 'increase');
  });
  
  fontSizeControls.appendChild(decreaseFontBtn);
  fontSizeControls.appendChild(increaseFontBtn);
  
  // Font family control
  const fontFamilyControl = document.createElement('div');
  fontFamilyControl.className = 'font-family-control';
  
  const fontSelect = document.createElement('select');
  fontSelect.innerHTML = `
    <option value="sans">Sans-serif</option>
    <option value="serif">Serif</option>
  `;
  fontSelect.addEventListener('change', (e) => {
    changeFontFamily(browser, e.target.value);
  });
  
  fontFamilyControl.appendChild(fontSelect);
  
  // Add controls to left side
  leftControls.appendChild(fontSizeControls);
  leftControls.appendChild(fontFamilyControl);
  
  // Right side controls
  const rightControls = document.createElement('div');
  rightControls.className = 'reader-mode-controls';
  
  // Mode toggle buttons
  const readerModeBtn = document.createElement('button');
  readerModeBtn.className = 'reader-mode-button';
  readerModeBtn.title = 'Reader view';
  readerModeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1"></path>
      <path d="M12 17v-6"></path>
      <path d="M8 13h8"></path>
    </svg>
  `;
  const currentMode = getReaderMode(browser);
  if (currentMode === 'reader') {
    readerModeBtn.classList.add('active');
  }
  
  readerModeBtn.addEventListener('click', () => {
    setReaderMode(browser, 'reader');
  });
  
  const splitModeBtn = document.createElement('button');
  splitModeBtn.className = 'reader-mode-button';
  splitModeBtn.title = 'Split view';
  splitModeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="12" y1="3" x2="12" y2="21"></line>
    </svg>
  `;
  if (currentMode === 'split') {
    splitModeBtn.classList.add('active');
  }
  
  splitModeBtn.addEventListener('click', () => {
    setReaderMode(browser, 'split');
  });
  
  const webModeBtn = document.createElement('button');
  webModeBtn.className = 'reader-mode-button';
  webModeBtn.title = 'Normal view';
  webModeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8" cy="12" r="2"></circle>
      <circle cx="16" cy="12" r="2"></circle>
    </svg>
  `;
  if (currentMode === 'browser') {
    webModeBtn.classList.add('active');
  }
  
  webModeBtn.addEventListener('click', () => {
    setReaderMode(browser, 'browser');
  });
  
  // Add mode buttons to right controls
  rightControls.appendChild(readerModeBtn);
  rightControls.appendChild(splitModeBtn);
  rightControls.appendChild(webModeBtn);
  
  // Add both control sections to toolbar
  toolbar.appendChild(leftControls);
  toolbar.appendChild(rightControls);
  
  return toolbar;
}

/**
 * Create split view container with reader mode and original content
 * 
 * @param {Object} browser - Browser instance
 * @param {Object} content - Page content for reader mode
 * @returns {HTMLElement} Split view container
 */
function createSplitView(browser, content) {
  // Check if container already exists
  let container = browser.containerRef.current.querySelector('.split-view-container');
  
  if (!container) {
    // Create new container if it doesn't exist
    container = document.createElement('div');
    container.className = 'split-view-container';
    browser.containerRef.current.appendChild(container);
  }
  
  // Clear container content
  container.innerHTML = '';
  
  // Create reader column
  const readerColumn = document.createElement('div');
  readerColumn.className = 'split-view-column split-view-reader';
  
  // Create reader toolbar
  const toolbar = createReaderToolbar(browser);
  readerColumn.appendChild(toolbar);
  
  // Create reader content
  const readerContent = document.createElement('div');
  readerContent.className = 'reader-mode-content';
  
  // Parse and render content
  if (content && content.text) {
    // Add title
    if (content.title) {
      const titleElement = document.createElement('h1');
      titleElement.textContent = content.title;
      readerContent.appendChild(titleElement);
    }
    
    // Add source link
    if (content.url) {
      const sourceContainer = document.createElement('p');
      sourceContainer.className = 'reader-source';
      sourceContainer.innerHTML = `Source: <a href="${content.url}" target="_blank">${content.url}</a>`;
      readerContent.appendChild(sourceContainer);
    }
    
    // Add main content
    if (typeof content.processedContent === 'string' && content.processedContent.trim()) {
      // Use processed content if available
      readerContent.innerHTML += content.processedContent;
    } else if (typeof content.text === 'string' && content.text.trim()) {
      // Use text content and apply basic formatting
      readerContent.innerHTML += formatTextContent(content.text, content.url);
    } else {
      const noContentMsg = document.createElement('p');
      noContentMsg.textContent = 'No readable content found on this page.';
      readerContent.appendChild(noContentMsg);
    }
  } else {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'reader-loading';
    loadingElement.innerHTML = `
      <div class="browser-loading-spinner"></div>
      <p>Preparing reader view...</p>
    `;
    readerContent.appendChild(loadingElement);
  }
  
  readerColumn.appendChild(readerContent);
  
  // Create original content column
  const originalColumn = document.createElement('div');
  originalColumn.className = 'split-view-column split-view-original';
  
  // Add columns to container
  container.appendChild(readerColumn);
  container.appendChild(originalColumn);
  
  return container;
}

/**
 * Update reader mode button state in browser header
 * 
 * @param {Object} browser - Browser instance
 * @param {string} mode - Current view mode
 */
function updateReaderModeButton(browser, mode) {
  // Find reader mode button in browser header
  const readerModeBtn = browser.containerRef.current?.querySelector('.browser-reader-btn');
  
  if (readerModeBtn) {
    if (mode === 'reader' || mode === 'split') {
      readerModeBtn.classList.add('active');
      readerModeBtn.title = 'Exit reader mode';
    } else {
      readerModeBtn.classList.remove('active');
      readerModeBtn.title = 'Toggle reader mode';
    }
  }
}

/**
 * Render the appropriate view based on reader mode
 * 
 * @param {Object} browser - Browser instance
 * @param {string} mode - View mode to render
 */
function renderReaderMode(browser, mode) {
  // Get content from browser state
  const content = browser.state.readerContent;
  
  // Remove existing reader containers
  const existingReaderContainer = browser.containerRef.current?.querySelector('.reader-mode-container');
  if (existingReaderContainer) {
    existingReaderContainer.remove();
  }
  
  const existingSplitContainer = browser.containerRef.current?.querySelector('.split-view-container');
  if (existingSplitContainer) {
    existingSplitContainer.remove();
  }
  
  // Try multiple possible container selectors to improve compatibility
  const selectors = [
    '.voyager-content',
    '.voyager-browser-container',
    '.browser-webview-container',
    '.webview-container'
  ];
  
  // Find the browser content container using multiple possible selectors
  let browserContainer = null;
  for (const selector of selectors) {
    browserContainer = browser.containerRef.current?.querySelector(selector);
    if (browserContainer) break;
  }
  
  // If still not found, use the containerRef directly as a last resort
  if (!browserContainer && browser.containerRef && browser.containerRef.current) {
    readerLogger.info('Using container ref directly as fallback');
    browserContainer = browser.containerRef.current;
  }
  
  // We need this container to exist
  if (!browserContainer) {
    readerLogger.error('Could not find browser content container - tried multiple selectors');
    return;
  }
  
  // Handle based on mode
  if (mode === 'reader') {
    // Create reader container
    const readerContainer = document.createElement('div');
    readerContainer.className = 'reader-mode-container';
    
    // Create reader toolbar
    const toolbar = createReaderToolbar(browser);
    readerContainer.appendChild(toolbar);
    
    // Create content container
    const contentElement = document.createElement('div');
    contentElement.className = 'reader-mode-content';
    
    // Parse and render content
    if (content && (content.text || content.processedContent)) {
      // Add title
      if (content.title) {
        const titleElement = document.createElement('h1');
        titleElement.textContent = content.title;
        contentElement.appendChild(titleElement);
      }
      
      // Add source link
      if (content.url) {
        const sourceContainer = document.createElement('p');
        sourceContainer.className = 'reader-source';
        sourceContainer.innerHTML = `Source: <a href="${content.url}" target="_blank">${content.url}</a>`;
        contentElement.appendChild(sourceContainer);
      }
      
      // Add main content
      if (typeof content.processedContent === 'string' && content.processedContent.trim()) {
        // Use processed content if available
        contentElement.innerHTML += content.processedContent;
      } else if (typeof content.text === 'string' && content.text.trim()) {
        // Use text content and apply basic formatting
        contentElement.innerHTML += formatTextContent(content.text, content.url);
      } else {
        const noContentMsg = document.createElement('p');
        noContentMsg.textContent = 'No readable content found on this page.';
        contentElement.appendChild(noContentMsg);
      }
    } else {
      const loadingElement = document.createElement('div');
      loadingElement.className = 'reader-loading';
      loadingElement.innerHTML = `
        <div class="browser-loading-spinner"></div>
        <p>Preparing reader view...</p>
      `;
      contentElement.appendChild(loadingElement);
    }
    
    readerContainer.appendChild(contentElement);
    
    // Find the webview element to hide
    const webview = browser.containerRef.current.querySelector('webview');
    if (webview) {
      // Instead of hiding the container, set a CSS variable to track its position
      webview.style.setProperty('--original-position', 'fixed');
      webview.style.opacity = '0';
      webview.style.pointerEvents = 'none';
    }
    
    // Add reader container to browser content
    browser.containerRef.current.appendChild(readerContainer);
    
    // Apply font settings
    applyFontSettings(browser);
  } else if (mode === 'split') {
    // Create split view
    const splitContainer = document.createElement('div');
    splitContainer.className = 'split-view-container';
    
    // Create reader column
    const readerColumn = document.createElement('div');
    readerColumn.className = 'split-view-column split-view-reader';
    
    // Create reader toolbar
    const toolbar = createReaderToolbar(browser);
    readerColumn.appendChild(toolbar);
    
    // Create reader content
    const readerContent = document.createElement('div');
    readerContent.className = 'reader-mode-content';
    
    // Parse and render content
    if (content && (content.text || content.processedContent)) {
      // Add title
      if (content.title) {
        const titleElement = document.createElement('h1');
        titleElement.textContent = content.title;
        readerContent.appendChild(titleElement);
      }
      
      // Add source link
      if (content.url) {
        const sourceContainer = document.createElement('p');
        sourceContainer.className = 'reader-source';
        sourceContainer.innerHTML = `Source: <a href="${content.url}" target="_blank">${content.url}</a>`;
        readerContent.appendChild(sourceContainer);
      }
      
      // Add main content
      if (typeof content.processedContent === 'string' && content.processedContent.trim()) {
        // Use processed content if available
        readerContent.innerHTML += content.processedContent;
      } else if (typeof content.text === 'string' && content.text.trim()) {
        // Use text content and apply basic formatting
        readerContent.innerHTML += formatTextContent(content.text, content.url);
      } else {
        const noContentMsg = document.createElement('p');
        noContentMsg.textContent = 'No readable content found on this page.';
        readerContent.appendChild(noContentMsg);
      }
    } else {
      const loadingElement = document.createElement('div');
      loadingElement.className = 'reader-loading';
      loadingElement.innerHTML = `
        <div class="browser-loading-spinner"></div>
        <p>Preparing reader view...</p>
      `;
      readerContent.appendChild(loadingElement);
    }
    
    readerColumn.appendChild(readerContent);
    
    // Create original content column
    const originalColumn = document.createElement('div');
    originalColumn.className = 'split-view-column split-view-original';
    
    // Find the webview element to display in split view
    const webview = browser.containerRef.current.querySelector('webview');
    if (webview) {
      // Instead of cloning, we'll create a placeholder where the original should be
      const placeholder = document.createElement('div');
      placeholder.className = 'split-view-webview-placeholder';
      placeholder.style.width = '100%';
      placeholder.style.height = '100%';
      placeholder.style.position = 'relative';
      
      // Add the placeholder to the original column
      originalColumn.appendChild(placeholder);
      
      // Move webview to the right position for split view
      webview.style.position = 'fixed';
      webview.style.top = placeholder.getBoundingClientRect().top + 'px';
      webview.style.left = placeholder.getBoundingClientRect().left + 'px';
      webview.style.width = placeholder.getBoundingClientRect().width + 'px';
      webview.style.height = placeholder.getBoundingClientRect().height + 'px';
      webview.style.opacity = '1';
      webview.style.zIndex = '5';
      webview.style.pointerEvents = 'auto';
    }
    
    // Add columns to container
    splitContainer.appendChild(readerColumn);
    splitContainer.appendChild(originalColumn);
    
    // Add split container to browser content
    browser.containerRef.current.appendChild(splitContainer);
    
    // Apply font settings
    applyFontSettings(browser);
  } else {
    // Normal browser mode - restore webview to original position
    const webview = browser.containerRef.current.querySelector('webview');
    if (webview) {
      webview.style.position = '';
      webview.style.top = '';
      webview.style.left = '';
      webview.style.width = '';
      webview.style.height = '';
      webview.style.opacity = '1';
      webview.style.zIndex = '';
      webview.style.pointerEvents = 'auto';
    }
  }
}

/**
 * Apply font settings from localStorage
 * 
 * @param {Object} browser - Browser instance
 */
function applyFontSettings(browser) {
  const fontFamily = localStorage.getItem('reader-font-family') || 'sans';
  const fontSize = localStorage.getItem('reader-font-size') || 'medium';
  
  // Get the container
  const readerContainer = browser.containerRef.current;
  if (!readerContainer) return;
  
  // Apply font family
  readerContainer.classList.remove('font-sans', 'font-serif');
  readerContainer.classList.add(`font-${fontFamily}`);
  
  // Apply font size
  readerContainer.classList.remove('font-size-small', 'font-size-medium', 'font-size-large', 'font-size-xlarge');
  readerContainer.classList.add(`font-size-${fontSize}`);
}

/**
 * Change font size in reader mode
 * 
 * @param {Object} browser - Browser instance
 * @param {string} direction - 'increase' or 'decrease'
 */
function changeFontSize(browser, direction) {
  // Get current font size class from container
  const container = browser.containerRef.current;
  const currentSize = 
    container.classList.contains('font-size-small') ? 'small' :
    container.classList.contains('font-size-large') ? 'large' :
    container.classList.contains('font-size-xlarge') ? 'xlarge' :
    'medium';
  
  // Determine new size based on direction
  let newSize;
  if (direction === 'increase') {
    newSize = 
      currentSize === 'small' ? 'medium' :
      currentSize === 'medium' ? 'large' :
      currentSize === 'large' ? 'xlarge' :
      'xlarge';
  } else {
    newSize = 
      currentSize === 'xlarge' ? 'large' :
      currentSize === 'large' ? 'medium' :
      currentSize === 'medium' ? 'small' :
      'small';
  }
  
  // Remove all size classes
  container.classList.remove('font-size-small', 'font-size-medium', 'font-size-large', 'font-size-xlarge');
  
  // Add new size class
  container.classList.add(`font-size-${newSize}`);
  
  // Save preference
  localStorage.setItem('reader-font-size', newSize);
}

/**
 * Change font family in reader mode
 * 
 * @param {Object} browser - Browser instance
 * @param {string} fontFamily - 'sans' or 'serif'
 */
function changeFontFamily(browser, fontFamily) {
  // Get container
  const container = browser.containerRef.current;
  
  // Remove existing font classes
  container.classList.remove('font-sans', 'font-serif');
  
  // Add new font class
  container.classList.add(`font-${fontFamily}`);
  
  // Update select element if it exists
  const fontSelect = container.querySelector('.font-family-control select');
  if (fontSelect) {
    fontSelect.value = fontFamily;
  }
  
  // Save preference
  localStorage.setItem('reader-font-family', fontFamily);
}

/**
 * Format plain text content for reader mode
 * 
 * @param {string} text - Raw text content
 * @param {string} baseUrl - Base URL for resolving relative links
 * @returns {string} Formatted HTML content
 */
function formatTextContent(text, baseUrl) {
  if (!text) return '';
  
  // Convert newlines to paragraphs
  let html = '';
  const paragraphs = text.split(/\n\s*\n/);
  
  paragraphs.forEach(paragraph => {
    if (paragraph.trim()) {
      // Check if paragraph is a heading (starts with # or ##)
      if (paragraph.trim().startsWith('# ')) {
        const heading = paragraph.trim().substring(2);
        html += `<h1>${heading}</h1>`;
      } else if (paragraph.trim().startsWith('## ')) {
        const heading = paragraph.trim().substring(3);
        html += `<h2>${heading}</h2>`;
      } else if (paragraph.trim().startsWith('### ')) {
        const heading = paragraph.trim().substring(4);
        html += `<h3>${heading}</h3>`;
      } else if (paragraph.trim().startsWith('> ')) {
        // Handle blockquotes
        const quote = paragraph.trim().substring(2);
        html += `<blockquote>${quote}</blockquote>`;
      } else if (paragraph.trim().startsWith('```')) {
        // Handle code blocks
        const code = paragraph.trim().replace(/```.*\n([\s\S]*?)```/, '$1');
        html += `<pre><code>${escapeHTML(code)}</code></pre>`;
      } else if (paragraph.trim().startsWith('- ') || paragraph.trim().match(/^\d+\.\s/)) {
        // Handle lists
        const items = paragraph.split('\n');
        const isBullet = paragraph.trim().startsWith('- ');
        
        html += isBullet ? '<ul>' : '<ol>';
        
        items.forEach(item => {
          const trimmedItem = item.trim();
          if (isBullet && trimmedItem.startsWith('- ')) {
            html += `<li>${trimmedItem.substring(2)}</li>`;
          } else if (!isBullet && trimmedItem.match(/^\d+\.\s/)) {
            html += `<li>${trimmedItem.replace(/^\d+\.\s/, '')}</li>`;
          }
        });
        
        html += isBullet ? '</ul>' : '</ol>';
      } else {
        // Regular paragraph
        html += `<p>${formatLinks(paragraph, baseUrl)}</p>`;
      }
    }
  });
  
  return html;
}

/**
 * Format links in text
 * 
 * @param {string} text - Text to process
 * @param {string} baseUrl - Base URL for resolving relative links
 * @returns {string} Text with formatted links
 */
function formatLinks(text, baseUrl) {
  if (!text) return '';
  
  // Replace URLs with anchor tags
  const urlRegex = /https?:\/\/[^\s<>"']*/g;
  const formattedText = text.replace(urlRegex, url => {
    return `<a href="${url}" target="_blank">${url}</a>`;
  });
  
  return formattedText;
}

/**
 * Escape HTML special characters to prevent XSS
 * 
 * @param {string} unsafe - Unsafe HTML string
 * @returns {string} Safe HTML string
 */
function escapeHTML(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Show an error message in the reader view
 * @param {Object} browser - Browser instance
 * @param {Error} error - The error that occurred
 */
function showReaderError(browser, error) {
  // Find browser container
  const browserContainer = browser.containerRef?.current;
  if (!browserContainer) {
    readerLogger.error('Could not find browser container to show error');
    return;
  }
  
  // Create error container
  const errorContainer = document.createElement('div');
  errorContainer.className = 'reader-mode-container reader-error';
  
  // Create error content
  const errorContent = document.createElement('div');
  errorContent.className = 'reader-error-content';
  
  // Add error message
  errorContent.innerHTML = `
    <h1>Reader Mode Unavailable</h1>
    <p>Sorry, we couldn't generate a reader view for this page.</p>
    <p class="error-details">${error.message || 'Unknown error'}</p>
    <div class="reader-error-actions">
      <button class="try-again-btn">Try Again</button>
      <button class="return-btn">Return to Normal View</button>
    </div>
  `;
  
  // Add event listeners
  const tryAgainBtn = errorContent.querySelector('.try-again-btn');
  if (tryAgainBtn) {
    tryAgainBtn.addEventListener('click', () => {
      // Remove existing error
      if (errorContainer.parentNode) {
        errorContainer.parentNode.removeChild(errorContainer);
      }
      
      // Try extraction again
      extractAndApplyReaderMode(browser)
        .then(content => {
          renderReaderMode(browser, browser.state.viewMode);
        })
        .catch(err => {
          showReaderError(browser, err);
        });
    });
  }
  
  const returnBtn = errorContent.querySelector('.return-btn');
  if (returnBtn) {
    returnBtn.addEventListener('click', () => {
      // Set view mode back to browser
      browser.setState({ viewMode: 'browser' });
      
      // Update reader mode button state
      updateReaderModeButton(browser, 'browser');
      
      // Render normal view
      renderReaderMode(browser, 'browser');
      
      // Remove error container
      if (errorContainer.parentNode) {
        errorContainer.parentNode.removeChild(errorContainer);
      }
    });
  }
  
  // Add content to container
  errorContainer.appendChild(errorContent);
  
  // Add to browser container
  browserContainer.appendChild(errorContainer);
}

export default {
  toggleReaderMode,
  setReaderMode,
  getReaderMode,
  isReaderModeActive
}; 