/**
 * UrlUtils - URL utility functions for extraction system
 * 
 * Browser-compatible URL utilities that don't rely on Node.js modules
 */

import logger from '../../../../utils/logger';

// Create a logger instance for this module
const urlLogger = logger.scope('UrlUtils');

/**
 * Parse a URL string into components
 * @param {string} urlStr - URL string to parse
 * @returns {URL} URL object with components
 */
function parseUrl(urlStr) {
  try {
    // Use the browser's built-in URL API instead of Node.js url module
    return new URL(urlStr);
  } catch (error) {
    urlLogger.error(`Error parsing URL: ${urlStr}`, error);
    // Return a minimal URL-like object to prevent errors
    return {
      href: urlStr,
      origin: '',
      hostname: '',
      pathname: '',
      search: '',
      hash: ''
    };
  }
}

/**
 * Normalize URL by handling common issues
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  if (!url) return '';
  
  try {
    // Handle relative URLs or URLs without protocol
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (!url.includes('://')) {
      if (!url.startsWith('/')) {
        url = '/' + url;
      }
      // Assume current origin
      if (typeof window !== 'undefined') {
        url = window.location.origin + url;
      }
    }
    
    // Parse and create a new URL to normalize it
    const urlObj = new URL(url);
    return urlObj.href;
  } catch (error) {
    urlLogger.error(`Error normalizing URL: ${url}`, error);
    return url;
  }
}

/**
 * Join base URL with path
 * @param {string} base - Base URL
 * @param {string} path - Path to join
 * @returns {string} Joined URL
 */
function joinUrl(base, path) {
  try {
    // Use the URL constructor to resolve paths
    const resolvedUrl = new URL(path, base);
    return resolvedUrl.href;
  } catch (error) {
    urlLogger.error(`Error joining URLs: ${base} + ${path}`, error);
    // Simple fallback
    if (base.endsWith('/')) {
      base = base.slice(0, -1);
    }
    if (path.startsWith('/')) {
      path = path.slice(1);
    }
    return `${base}/${path}`;
  }
}

/**
 * Extract domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    urlLogger.error(`Error extracting domain from URL: ${url}`, error);
    return '';
  }
}

/**
 * Check if URL is external relative to a base URL
 * @param {string} baseUrl - Base URL
 * @param {string} testUrl - URL to test
 * @returns {boolean} True if external
 */
function isExternalUrl(baseUrl, testUrl) {
  try {
    // Handle relative URLs
    if (testUrl.startsWith('/') && !testUrl.startsWith('//')) {
      return false;
    }
    
    const baseUrlObj = new URL(baseUrl);
    const testUrlObj = new URL(testUrl, baseUrl);
    
    return baseUrlObj.hostname !== testUrlObj.hostname;
  } catch (error) {
    urlLogger.error(`Error checking if URL is external: ${baseUrl} / ${testUrl}`, error);
    return true;
  }
}

// Export all utility functions
const UrlUtils = {
  parseUrl,
  normalizeUrl,
  joinUrl,
  extractDomain,
  isExternalUrl
};

export default UrlUtils; 