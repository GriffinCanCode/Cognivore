/**
 * FallbackExtractor - Simple fallback extraction when other methods fail
 * 
 * This extractor provides minimal content extraction as a last resort
 * when all other extraction methods have failed.
 */

import logger from '../../../../utils/logger';

// Create a logger instance for this module
const extractorLogger = logger.scope('FallbackExtractor');

/**
 * Extract minimal content as a fallback
 * @param {Object} browser - Browser instance
 * @param {string} url - Target URL
 * @returns {Object} Basic content object
 */
function extract(browser, url) {
  extractorLogger.info(`Using fallback extraction for ${url}`);
  
  // Get title from browser if available
  let title = 'Unknown Page';
  
  if (browser) {
    if (browser.state && browser.state.title) {
      title = browser.state.title;
    } else if (browser.currentTitle) {
      title = browser.currentTitle;
    } else if (browser.webview && typeof browser.webview.getTitle === 'function') {
      try {
        const webviewTitle = browser.webview.getTitle();
        if (webviewTitle) {
          title = webviewTitle;
        }
      } catch (e) {
        // Ignore errors accessing webview
      }
    }
  }
  
  // Create minimal content object
  return {
    title: title,
    text: 'Content extraction failed. The page may be protected or require authentication.',
    url: url,
    extractionMethod: 'fallback',
    extractionSuccess: false,
    timestamp: new Date().toISOString(),
    metadata: {
      title: title,
      url: url
    }
  };
}

/**
 * Extract basic info from browser state
 * @param {Object} browser - Browser instance
 * @returns {Object} Basic info object
 */
function extractBasicInfo(browser) {
  if (!browser) {
    return {
      title: 'Unknown Page',
      url: '',
      success: false
    };
  }
  
  // Get URL from browser state or current URL
  const url = browser.state?.url || browser.currentUrl || '';
  
  // Get title from browser state or current title
  const title = browser.state?.title || browser.currentTitle || 'Unknown Page';
  
  return {
    title,
    url,
    success: true
  };
}

// Export methods
const FallbackExtractor = {
  extract,
  extractBasicInfo
};

export default FallbackExtractor; 