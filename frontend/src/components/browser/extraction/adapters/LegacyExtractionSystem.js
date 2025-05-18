/**
 * LegacyExtractionSystem - Adapter for backward compatibility
 * 
 * This provides a compatibility layer for older code still using
 * the legacy extraction system instead of ExtractorManager directly.
 */

import ExtractorManager from '../ExtractorManager';
import logger from '../../../../utils/logger';

// Create a logger instance for this module
const legacyLogger = logger.scope('LegacyExtractionSystem');

/**
 * Extract content using modern extraction system
 * @param {Object} browser - Browser instance
 * @param {string} url - URL to extract from
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extraction result
 */
export const extractContent = async (browser, url, options = {}) => {
  legacyLogger.info('Using modern extraction system for URL:', url);
  return ExtractorManager.extract(browser, url, options);
};

/**
 * Processes raw extraction result for backward compatibility
 * @param {Object} rawResult - Raw extraction result
 * @returns {Promise<Object>} Processed result
 */
export const processResult = async (rawResult) => {
  legacyLogger.info('Processing extraction result via modern system');
  return ExtractorManager.processContent(rawResult);
};

// Export a default adapter object
export default {
  extractContent,
  processResult
}; 