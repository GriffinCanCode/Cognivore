/**
 * ExtractorManager - Orchestrates content extraction processes
 * 
 * This manager coordinates different extraction methods and processors,
 * selecting the most appropriate strategy based on context.
 */

import logger from '../../../utils/logger';
import WebviewExtractor from './extractors/WebviewExtractor';
import ReadabilityExtractor from './extractors/ReadabilityExtractor';
import IpcExtractor from './extractors/IpcExtractor';
import DomProxyExtractor from './extractors/DomProxyExtractor';
import FetchExtractor from './extractors/FetchExtractor';
import FallbackExtractor from './extractors/FallbackExtractor';
import ContentProcessor from './processors/ContentProcessor';
import ContentEnhancer from './utils/ContentEnhancer';
import ContentValidator from './utils/ContentValidator';
import DomUtils from './utils/DomUtils';
import UrlUtils from './utils/UrlUtils';

// Create a logger instance for this module
const extractionLogger = logger.scope('ExtractorManager');

/**
 * Extract content using the most appropriate method available
 * @param {Object} browser - Browser instance
 * @param {string} url - Current URL
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Promise resolving to extracted content
 */
async function extract(browser, url, options = {}) {
  // Determine actual URL if not provided
  const targetUrl = url || (browser && browser.currentUrl) || '';
  if (!targetUrl) {
    return Promise.reject(new Error('No URL provided for content extraction'));
  }
  
  extractionLogger.info(`Extracting content from ${targetUrl} with ${options.preferredMethod || 'strategy selector'}`);
  
  // Record start time for performance tracking
  const startTime = Date.now();
  
  try {
    let result = null;
    
    // If a preferred method is specified, try it first
    if (options.preferredMethod) {
      try {
        result = await executeExtractorByName(options.preferredMethod, browser, targetUrl, options);
        if (ContentValidator.isValidExtractionResult(result)) {
          const extractionTime = Date.now() - startTime;
          extractionLogger.info(`${options.preferredMethod} extraction successful in ${extractionTime}ms`);
          
          // Add extraction time to result before enhancing
          result.extractionTime = extractionTime;
          return await ContentEnhancer.enhance(result, targetUrl);
        }
      } catch (e) {
        extractionLogger.warn(`Preferred method (${options.preferredMethod}) failed: ${e.message}`);
        // Continue with strategy selection if preferred method fails
      }
    }
    
    // Use strategy selector to determine the best extraction method
    const strategies = selectExtractionStrategies(browser, targetUrl, options);
    
    // Log selected strategies
    extractionLogger.info(`Selected strategies in order: ${strategies.join(', ')}`);
    
    // Try each strategy in order until one succeeds
    for (const strategy of strategies) {
      try {
        extractionLogger.info(`Attempting extraction via ${strategy} strategy`);
        result = await executeExtractorByName(strategy, browser, targetUrl, options);
        
        if (ContentValidator.isValidExtractionResult(result)) {
          const extractionTime = Date.now() - startTime;
          extractionLogger.info(`${strategy} extraction successful in ${extractionTime}ms`);
          
          // Add extraction time to result before enhancing
          result.extractionTime = extractionTime;
          return await ContentEnhancer.enhance(result, targetUrl);
        } else {
          extractionLogger.warn(`${strategy} extraction result failed validation, trying next strategy`);
        }
      } catch (error) {
        extractionLogger.warn(`${strategy} extraction failed: ${error.message}, trying next strategy`);
      }
    }
    
    // If all strategies fail, use fallback
    extractionLogger.warn('All extraction strategies failed, using fallback extraction');
    
    // Mark extraction time for fallback too
    const fallbackTime = Date.now() - startTime;
    const fallbackResult = FallbackExtractor.extract(browser, targetUrl);
    fallbackResult.extractionTime = fallbackTime;
    
    return await ContentEnhancer.enhance(fallbackResult, targetUrl);
  } catch (error) {
    extractionLogger.error(`Content extraction error: ${error.message}`, error);
    
    // Return error information in a structured format
    return {
      title: getPageTitle(browser) || 'Unknown Page',
      text: `Error extracting content: ${error.message}`,
      url: targetUrl,
      error: error.message,
      extractionMethod: 'error',
      extractionSuccess: false,
      extractionTime: Date.now() - startTime
    };
  }
}

/**
 * Select the most appropriate extraction strategies based on context
 * @param {Object} browser - Browser instance
 * @param {string} url - Target URL
 * @param {Object} options - Extraction options
 * @returns {Array<string>} Prioritized list of extraction strategies
 */
function selectExtractionStrategies(browser, url, options = {}) {
  // Default strategy order (fallback is added automatically at the end if needed)
  const defaultOrder = ['readability', 'webview', 'domproxy', 'ipc', 'fetch-readability', 'fetch'];
  
  // Strategies to skip based on options
  const skipStrategies = [];
  if (options.skipReadability) skipStrategies.push('readability');
  if (options.skipWebview) skipStrategies.push('webview');
  if (options.skipIpc) skipStrategies.push('ipc');
  if (options.skipDomProxy) skipStrategies.push('domproxy');
  if (options.skipFetch) skipStrategies.push('fetch', 'fetch-readability');
  
  // Check browser state to determine available strategies
  const hasWebview = browser && browser.webview && WebviewExtractor.isWebviewReady(browser.webview);
  const hasContentFrame = browser && browser.contentFrame;
  const hasIpcRenderer = window.ipcRenderer && typeof window.ipcRenderer.invoke === 'function';
  
  // Unavailable strategies based on browser state
  if (!hasWebview) {
    skipStrategies.push('readability', 'webview');
  }
  
  if (!hasContentFrame) {
    skipStrategies.push('domproxy');
  }
  
  if (!hasIpcRenderer) {
    skipStrategies.push('ipc');
  }
  
  // Check URL type to prioritize strategies
  let priorityStrategies = [];
  
  // Don't use fetch for intranet/localhost URLs
  if (UrlUtils.isIntranetUrl(url)) {
    skipStrategies.push('fetch', 'fetch-readability');
  }
  
  // For article-like pages, prioritize Readability
  if (UrlUtils.isLikelyArticleUrl(url) && !skipStrategies.includes('readability')) {
    priorityStrategies.push('readability');
  }
  
  // For social media, prioritize webview extraction
  if (UrlUtils.isSocialMediaUrl(url) && !skipStrategies.includes('webview')) {
    priorityStrategies.push('webview');
  }
  
  // Use past extraction success metrics to influence strategy order
  const metrics = ContentEnhancer.getExtractionMetrics();
  const successRates = {};
  
  Object.keys(metrics.counts || {}).forEach(method => {
    const count = metrics.counts[method] || 0;
    const successes = metrics.successes[method] || 0;
    if (count > 0) {
      successRates[method] = successes / count;
    }
  });
  
  // Create the final ordered strategy list
  const orderedStrategies = [...new Set([
    ...priorityStrategies,
    ...defaultOrder.sort((a, b) => {
      // Sort by success rate if available
      const rateA = successRates[a] || 0;
      const rateB = successRates[b] || 0;
      return rateB - rateA;
    })
  ])].filter(strategy => !skipStrategies.includes(strategy));
  
  // Always ensure fallback is not included (it's used separately)
  return orderedStrategies.filter(s => s !== 'fallback');
}

/**
 * Fetch content and process with Readability
 * @param {string} url - URL to fetch and process
 * @returns {Promise<Object>} Extraction result
 */
async function fetchWithReadability(url) {
  try {
    // Fetch the page content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Process with Readability
    return await ReadabilityExtractor.extractFromHtml(html, url);
  } catch (error) {
    extractionLogger.warn(`Fetch with Readability failed: ${error.message}`);
    throw error;
  }
}

/**
 * Execute a specific extractor by name
 * @param {string} extractorName - Name of the extractor to use
 * @param {Object} browser - Browser instance
 * @param {string} url - URL to extract from
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extraction result
 */
async function executeExtractorByName(extractorName, browser, url, options = {}) {
  switch (extractorName.toLowerCase()) {
    case 'readability':
      return ReadabilityExtractor.extract(browser.webview, url);
    case 'webview':
      return WebviewExtractor.extract(browser.webview, url);
    case 'ipc':
      return IpcExtractor.extract(url);
    case 'domproxy':
      return DomProxyExtractor.extract(browser.contentFrame, url);
    case 'fetch':
      return FetchExtractor.extract(url);
    case 'fetch-readability':
      return fetchWithReadability(url);
    case 'fallback':
      return FallbackExtractor.extract(browser, url);
    default:
      throw new Error(`Unknown extractor: ${extractorName}`);
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
  return browser.currentTitle || browser.state?.title || '';
}

/**
 * Process the raw content after extraction
 * @param {Object} rawContent - Raw content from extraction
 * @returns {Promise<Object>} Processed content
 */
async function processContent(rawContent) {
  try {
    return await ContentProcessor.process(rawContent);
  } catch (error) {
    extractionLogger.error(`Error processing content: ${error.message}`, error);
    return {
      title: rawContent.title || 'Unknown Page',
      text: rawContent.text || `Error processing content: ${error.message}`,
      url: rawContent.url || '',
      error: error.message,
      extractionMethod: rawContent.extractionMethod || 'error',
      extractionSuccess: false
    };
  }
}

/**
 * Extract content as JSON DOM representation
 * @param {Object} browser - Browser instance
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} JSON DOM representation
 */
async function extractAsJsonDom(browser, options = {}) {
  if (!browser || !browser.webview || typeof browser.webview.executeJavaScript !== 'function') {
    return Promise.reject(new Error('Invalid browser object for JSON DOM extraction'));
  }
  
  extractionLogger.info('Extracting content as JSON DOM representation');
  
  try {
    // Execute script to extract DOM as JSON
    const domToJsonScript = `
      (function() {
        try {
          ${DomUtils.domToJson.toString()}
          
          // Find main content element
          const mainElement = document.querySelector('article, main, [role="main"]') || document.body;
          
          // Convert to JSON representation
          const result = domToJson(mainElement, {
            maxDepth: ${options.maxDepth || 5},
            includeContent: true,
            includeAttributes: true
          });
          
          return {
            title: document.title,
            url: window.location.href,
            jsonDom: result,
            timestamp: new Date().toISOString(),
            extractionMethod: 'jsondom',
            extractionSuccess: true
          };
        } catch (error) {
          return {
            error: true,
            message: error.message || 'Error extracting JSON DOM',
            stack: error.stack
          };
        }
      })();
    `;
    
    const result = await browser.webview.executeJavaScript(domToJsonScript);
    
    if (result.error) {
      throw new Error(result.message || 'Error extracting JSON DOM');
    }
    
    return result;
  } catch (error) {
    extractionLogger.error(`Error extracting JSON DOM: ${error.message}`);
    throw error;
  }
}

// Export the module
const ExtractorManager = {
  extract,
  executeExtractorByName,
  getPageTitle,
  processContent,
  extractAsJsonDom,
  fetchWithReadability,
  selectExtractionStrategies // Export the strategy selector for testing
};

export default ExtractorManager; 