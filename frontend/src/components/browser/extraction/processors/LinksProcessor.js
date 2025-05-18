/**
 * LinksProcessor - Process and enhance link data
 * 
 * This processor handles cleaning, filtering, and enhancing links
 * extracted from web pages, including resolving relative URLs.
 */

import logger from '../../../../utils/logger';
// Node.js URL module import removed - using browser's native URL API instead

// Create a logger instance for this module
const linksLogger = logger.scope('LinksProcessor');

/**
 * Process links from a webpage
 * @param {Array} links - Raw links array with text and URLs
 * @param {string} baseUrl - Base URL for resolving relative URLs
 * @returns {Array} Processed links with enhanced data
 */
function process(links, baseUrl) {
  if (!links || !Array.isArray(links) || links.length === 0) {
    return [];
  }
  
  try {
    linksLogger.info(`Processing ${links.length} links from ${baseUrl}`);
    
    // Parse base URL
    let parsedBaseUrl;
    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch (error) {
      linksLogger.warn(`Invalid base URL: ${baseUrl}, using https://example.com as fallback`);
      parsedBaseUrl = new URL('https://example.com');
    }
    
    // Clean and normalize the links
    const processedLinks = links
      // Keep only links with valid URLs
      .filter(link => link && typeof link.url === 'string' && link.url.trim())
      // Process each link
      .map(link => processLink(link, parsedBaseUrl))
      // Remove duplicates by URL
      .filter((link, index, self) => 
        index === self.findIndex(l => l.url === link.url)
      );
    
    // Sort links by type (internal first, then external)
    processedLinks.sort((a, b) => {
      // Sort internal links before external
      if (a.isInternal && !b.isInternal) return -1;
      if (!a.isInternal && b.isInternal) return 1;
      
      // Within each group, sort alphabetically
      return a.url.localeCompare(b.url);
    });
    
    // Calculate some statistics
    const stats = {
      total: processedLinks.length,
      internal: processedLinks.filter(link => link.isInternal).length,
      external: processedLinks.filter(link => !link.isInternal).length
    };
    
    linksLogger.info(`Processed ${stats.total} links: ${stats.internal} internal, ${stats.external} external`);
    
    return processedLinks;
  } catch (error) {
    linksLogger.error(`Error processing links: ${error.message}`, error);
    return links;
  }
}

/**
 * Process a single link
 * @param {Object} link - Raw link object
 * @param {URL} baseUrl - Parsed base URL
 * @returns {Object} Processed link
 */
function processLink(link, baseUrl) {
  // Clean the link text
  const cleanedText = (link.text || '').trim().replace(/\s+/g, ' ');
  
  // Resolve relative URL to absolute
  let resolvedUrl;
  try {
    resolvedUrl = new URL(link.url, baseUrl.href).href;
  } catch (error) {
    // If URL is invalid, try to clean it up
    const cleanedUrl = cleanUrl(link.url);
    try {
      resolvedUrl = new URL(cleanedUrl, baseUrl.href).href;
    } catch (innerError) {
      // If still invalid, return original
      resolvedUrl = link.url;
    }
  }
  
  // Parse the URL to get components
  let parsedUrl;
  try {
    parsedUrl = new URL(resolvedUrl);
  } catch (error) {
    // For invalid URLs, create a placeholder parsed URL
    parsedUrl = {
      hostname: 'invalid',
      pathname: '',
      searchParams: new URLSearchParams()
    };
  }
  
  // Extract domain name (without www)
  const domain = parsedUrl.hostname.replace(/^www\./, '');
  
  // Determine if link is internal (same domain)
  const isInternal = domain === baseUrl.hostname.replace(/^www\./, '');
  
  // Extract path and query parameters
  const path = parsedUrl.pathname || '';
  const searchParams = {};
  
  try {
    // Convert search params to object
    for (const [key, value] of parsedUrl.searchParams.entries()) {
      searchParams[key] = value;
    }
  } catch (error) {
    // Handle case where searchParams is not iterable
    linksLogger.warn(`Error extracting search params: ${error.message}`);
  }
  
  // Classify link type
  const linkType = classifyLinkType(resolvedUrl, isInternal);
  
  // Generate a link title if none provided
  const title = link.title || generateLinkTitle(cleanedText, domain, path);
  
  // Return processed link
  return {
    text: cleanedText || title,
    url: resolvedUrl,
    title,
    domain,
    path,
    isInternal,
    type: linkType,
    searchParams,
    originalUrl: link.url
  };
}

/**
 * Clean a URL string
 * @param {string} url - URL to clean
 * @returns {string} Cleaned URL
 */
function cleanUrl(url) {
  if (!url) return '';
  
  return url
    .trim()
    .replace(/[\n\r\t]/g, '')   // Remove newlines, tabs
    .replace(/\s+/g, '')        // Remove spaces
    .replace(/^javascript:/, '') // Remove javascript: protocol
    .replace(/^mailto:/, '')     // Remove mailto: protocol
    .replace(/^tel:/, '');       // Remove tel: protocol
}

/**
 * Classify link type based on URL pattern
 * @param {string} url - URL to classify
 * @param {boolean} isInternal - Whether the link is internal
 * @returns {string} Link type
 */
function classifyLinkType(url, isInternal) {
  if (!url) return 'unknown';
  
  const lowerUrl = url.toLowerCase();
  
  // Page anchors
  if (lowerUrl.startsWith('#') || lowerUrl.includes('/#')) {
    return 'anchor';
  }
  
  // Basic internal/external classification
  if (isInternal) {
    return 'internal';
  } else {
    return 'external';
  }
  
  // Additional classifications could include:
  // - File downloads (PDF, DOC, etc.)
  // - Social media links
  // - Reference links
  // But these require more complex patterns
}

/**
 * Generate a title for a link if none provided
 * @param {string} text - Link text
 * @param {string} domain - Domain name
 * @param {string} path - URL path
 * @returns {string} Generated title
 */
function generateLinkTitle(text, domain, path) {
  if (text && text.length > 0) {
    return text; // Use text as title if available
  }
  
  if (path && path !== '/') {
    // Extract meaningful name from path
    const pathSegments = path.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      // Get last segment and clean it
      const lastSegment = pathSegments[pathSegments.length - 1]
        .replace(/[-_]/g, ' ')  // Replace dashes and underscores with spaces
        .replace(/\.\w+$/, '')  // Remove file extensions
        .replace(/([a-z])([A-Z])/g, '$1 $2'); // Add spaces between camelCase
      
      if (lastSegment) {
        return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
      }
    }
  }
  
  // Fallback to domain name
  return domain;
}

/**
 * Group links by domain
 * @param {Array} links - Processed links
 * @returns {Object} Links grouped by domain
 */
function groupByDomain(links) {
  if (!links || !Array.isArray(links)) {
    return {};
  }
  
  const groups = {};
  
  links.forEach(link => {
    const domain = link.domain || 'unknown';
    
    if (!groups[domain]) {
      groups[domain] = [];
    }
    
    groups[domain].push(link);
  });
  
  return groups;
}

/**
 * Extract unique domains from links
 * @param {Array} links - Processed links
 * @returns {Array} Unique domains
 */
function extractDomains(links) {
  if (!links || !Array.isArray(links)) {
    return [];
  }
  
  const domains = new Set();
  
  links.forEach(link => {
    if (link.domain) {
      domains.add(link.domain);
    }
  });
  
  return Array.from(domains).sort();
}

// Export methods
const LinksProcessor = {
  process,
  groupByDomain,
  extractDomains,
  classifyLinkType,
  processLink
};

export default LinksProcessor; 