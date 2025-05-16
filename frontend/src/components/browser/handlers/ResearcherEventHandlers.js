/**
 * ResearcherEventHandlers.js - Event handlers for the Researcher component
 * 
 * These handlers manage webview events specifically for research and content extraction
 * use cases, including webview readiness detection and error recovery.
 */

import logger from '../../../utils/logger';
import extractionSystem from './ContentExtractionSystem';

// Create a dedicated logger for research event handlers
const researchLogger = logger.scope('ResearchEvents');

/**
 * Handles page load completion in the webview for research purposes
 * @param {Object} event - The load event
 * @param {Object} browser - Browser instance
 * @param {Object} researcher - Researcher component instance
 */
export function handlePageLoadForResearch(event, browser, researcher) {
  if (!browser || !browser.webview) return;
  
  // Mark webview as ready for extraction
  if (browser.webview.isConnected) {
    browser.webview.setAttribute('data-ready', 'true');
    researchLogger.info('Webview marked as ready for extraction');
  }
  
  // If researcher has auto-extract enabled, perform content extraction
  if (researcher && researcher.state.autoExtract) {
    researchLogger.info('Auto-extracting content for research');
    extractContentForResearch(browser, researcher);
  }
}

/**
 * Handle DOM ready event for research preparation
 * @param {Object} event - The DOM ready event
 * @param {Object} browser - Browser instance
 */
export function handleDomReadyForResearch(event, browser) {
  if (!browser || !browser.webview) return;
  
  // Mark webview as DOM-ready
  browser.webview.setAttribute('data-ready', 'true');
  
  // Inject any necessary helper scripts or listeners
  try {
    // Add readiness detection script
    browser.webview.executeJavaScript(`
      document.body.setAttribute('data-extraction-ready', 'true');
      // Listen for page mutations that might indicate content is still loading
      const observer = new MutationObserver((mutations) => {
        if (mutations.length > 10) {
          document.body.setAttribute('data-content-changing', 'true');
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      // Signal readiness
      true;
    `)
    .then(() => {
      researchLogger.debug('Research readiness script injected');
    })
    .catch(error => {
      researchLogger.warn('Failed to inject research readiness script:', error.message);
    });
  } catch (error) {
    researchLogger.error('Error in DOM ready handler:', error);
  }
}

/**
 * Extract content from the current page for research
 * @param {Object} browser - Browser instance 
 * @param {Object} researcher - Researcher component instance
 * @returns {Promise<Object>} Promise resolving to extracted content
 */
export function extractContentForResearch(browser, researcher) {
  if (!browser || !browser.webview) {
    return Promise.reject(new Error('Browser or webview not available'));
  }
  
  researchLogger.info(`Extracting content from ${browser.currentUrl}`);
  
  // Check if webview is ready for extraction
  if (!extractionSystem.isWebviewReady(browser.webview)) {
    researchLogger.warn('Webview not ready for extraction, waiting...');
    
    // Wait and retry once
    return new Promise(resolve => {
      setTimeout(() => {
        // Check again if webview is ready
        if (extractionSystem.isWebviewReady(browser.webview)) {
          researchLogger.info('Webview now ready, proceeding with extraction');
          resolve(performExtraction(browser, researcher));
        } else {
          researchLogger.warn('Webview still not ready, using fallback methods');
          // Use fallback extraction that doesn't require webview readiness
          resolve(performExtraction(browser, researcher, { skipWebview: true }));
        }
      }, 1000); // Wait 1 second before retrying
    });
  }
  
  // Webview is ready, proceed with extraction
  return performExtraction(browser, researcher);
}

/**
 * Handle extraction for the researcher component
 * @param {Object} browser - Browser instance
 * @param {Object} researcher - Researcher component instance
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Promise resolving to extracted content
 */
function performExtraction(browser, researcher, options = {}) {
  const url = browser.currentUrl;
  
  return extractionSystem.extractContent(browser, url, options)
    .then(content => {
      researchLogger.info(`Content extracted successfully: ${content.title}`);
      
      // If researcher is available, pass content to it
      if (researcher && typeof researcher._processAndAnalyze === 'function') {
        // Instead of returning directly, let the researcher component handle the content
        researcher._processAndAnalyze(browser, content);
      }
      
      return content;
    })
    .catch(error => {
      researchLogger.error(`Content extraction failed: ${error.message}`);
      
      // If researcher is available, notify of error
      if (researcher && typeof researcher.setState === 'function') {
        researcher.setState({
          error: `Content extraction failed: ${error.message}`,
          isProcessing: false
        });
      }
      
      return {
        title: browser.webview.getTitle?.() || 'Failed Extraction',
        text: `Failed to extract content: ${error.message}`,
        url: url,
        extractionSuccess: false,
        error: error.message
      };
    });
}

/**
 * Handle navigation events for research tracking
 * @param {Object} event - Navigation event
 * @param {Object} browser - Browser instance
 * @param {Object} researcher - Researcher component instance
 */
export function handleNavigationForResearch(event, browser, researcher) {
  if (!researcher) return;
  
  // Track the navigation in research state
  researcher.setState({
    currentUrl: browser.currentUrl,
    currentTitle: browser.webview.getTitle?.() || 'Unknown Page'
  });
  
  // Reset any existing extraction state
  researcher.setState({
    isProcessing: false,
    error: null
  });
}

/**
 * Handle crashes or errors in the webview for research
 * @param {Object} event - Error event
 * @param {Object} browser - Browser instance
 * @param {Object} researcher - Researcher component instance
 */
export function handleErrorForResearch(event, browser, researcher) {
  if (!researcher) return;
  
  researchLogger.error(`Webview error in research: ${event.type}`);
  
  // Notify researcher of error
  researcher.setState({
    error: `Browser error: ${event.type}`,
    isProcessing: false
  });
}

export default {
  handlePageLoadForResearch,
  handleDomReadyForResearch,
  extractContentForResearch,
  handleNavigationForResearch,
  handleErrorForResearch
}; 