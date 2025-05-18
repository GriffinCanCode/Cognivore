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
 * Check if URL is an intranet or localhost URL
 * @param {string} url - URL to check
 * @returns {boolean} True if intranet URL
 */
function isIntranetUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Check for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
    
    // Check for IP addresses (typically used in intranet)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }
    
    // Check for common intranet domains
    if (hostname.endsWith('.local') || hostname.endsWith('.internal') || 
        hostname.endsWith('.intranet') || hostname.endsWith('.lan') || 
        !hostname.includes('.')) {
      return true;
    }
    
    return false;
  } catch (error) {
    urlLogger.error(`Error checking if URL is intranet: ${url}`, error);
    return false;
  }
}

/**
 * Check if URL is likely to be an article page
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is likely to be an article
 */
function isLikelyArticleUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    // Common news/article sites
    const articleDomains = [
      'medium.com', 'nytimes.com', 'washingtonpost.com', 'bbc.com', 'bbc.co.uk',
      'theguardian.com', 'cnn.com', 'economist.com', 'wired.com', 'theatlantic.com',
      'newyorker.com', 'reuters.com', 'bloomberg.com', 'forbes.com', 'wsj.com',
      'huffpost.com', 'techcrunch.com', 'engadget.com', 'mashable.com', 'vice.com',
      'nationalgeographic.com', 'time.com', 'aljazeera.com', 'zdnet.com', 'thedailybeast.com',
      'arstechnica.com', 'vox.com', 'slate.com', 'salon.com', 'axios.com',
      'news.google.com', 'news.yahoo.com', 'insider.com', 'businessinsider.com'
    ];
    
    // Check if it's a known news/article site
    if (articleDomains.some(domain => hostname.includes(domain))) {
      return true;
    }

    // Check for Wikipedia articles
    if (hostname.includes('wikipedia.org') && pathname.includes('/wiki/')) {
      return true;
    }
    
    // Check URL patterns that commonly indicate articles
    const articlePatterns = [
      /\/article(s)?\//, /\/blog(s)?\//, /\/news\//, /\/post(s)?\//, 
      /\/story\//, /\/read\//, /\/opinion\//, /\/editorial\//, 
      /\/\d{4}\/\d{1,2}\/\d{1,2}\//, // Date-based URLs like /2023/05/25/
      /\/category\/[\w-]+\/[\w-]+/, // Category then article pattern
    ];
    
    if (articlePatterns.some(pattern => pattern.test(pathname))) {
      return true;
    }

    // Look for common URL segments that indicate a specific content piece
    if (/\/[a-z0-9-]{10,}(\/|$)/.test(pathname) && pathname.split('/').length > 2) {
      return true;
    }
    
    return false;
  } catch (error) {
    urlLogger.error(`Error checking if URL is an article: ${url}`, error);
    return false;
  }
}

/**
 * Check if URL is from a social media site
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is from a social media site
 */
function isSocialMediaUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Common social media domains
    const socialDomains = [
      'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
      'linkedin.com', 'reddit.com', 'tiktok.com', 'youtube.com',
      'pinterest.com', 'tumblr.com', 'quora.com', 'snapchat.com',
      'threads.net', 'whatsapp.com', 'telegram.org', 'discord.com',
      'threads.net', 'mastodon.social', 'twitch.tv', 'vimeo.com'
    ];
    
    // Check if the hostname contains any of the social media domains
    return socialDomains.some(domain => hostname.includes(domain));
  } catch (error) {
    urlLogger.error(`Error checking if URL is social media: ${url}`, error);
    return false;
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

/**
 * Fetch with timeout functionality
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options including timeout in ms
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithTimeout(url, options = {}) {
  const { timeout = 5000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

// Export all utility functions
const UrlUtils = {
  parseUrl,
  normalizeUrl,
  joinUrl,
  extractDomain,
  isExternalUrl,
  isIntranetUrl,
  isLikelyArticleUrl,
  isSocialMediaUrl,
  fetchWithTimeout
};

export default UrlUtils; 