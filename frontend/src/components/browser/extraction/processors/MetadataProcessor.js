/**
 * MetadataProcessor - Process and normalize page metadata
 * 
 * This processor handles extracting, normalizing, and organizing
 * metadata from webpages, including Open Graph, Twitter cards,
 * and standard meta tags.
 */

import logger from '../../../../utils/logger';
import { franc } from 'franc';

// Import metascraper and rule packages
import MetascraperFactory from 'metascraper';
import metascraperAuthor from 'metascraper-author';
import metascraperDate from 'metascraper-date';
import metascraperDescription from 'metascraper-description';
import metascraperImage from 'metascraper-image';
import metascraperLogo from 'metascraper-logo';
import metascraperPublisher from 'metascraper-publisher';
import metascraperTitle from 'metascraper-title';
import metascraperUrl from 'metascraper-url';

// Initialize metascraper with rules
const metascraper = MetascraperFactory([
  metascraperAuthor(),
  metascraperDate(),
  metascraperDescription(),
  metascraperImage(),
  metascraperLogo(),
  metascraperPublisher(),
  metascraperTitle(),
  metascraperUrl()
]);

// Create a logger instance for this module
const metadataLogger = logger.scope('MetadataProcessor');

/**
 * Process webpage metadata asynchronously
 * @param {Object} rawMetadata - Raw metadata key-value pairs
 * @param {Object} pageData - Additional page data for context
 * @returns {Promise<Object>} Processed metadata with normalized fields
 */
async function process(rawMetadata, pageData = {}) {
  return processAsync(rawMetadata, pageData);
}

/**
 * Process webpage metadata asynchronously
 * @param {Object} rawMetadata - Raw metadata key-value pairs
 * @param {Object} pageData - Additional page data for context
 * @returns {Promise<Object>} Processed metadata with normalized fields
 */
async function processAsync(rawMetadata, pageData = {}) {
  if (!rawMetadata || Object.keys(rawMetadata).length === 0) {
    return extractBasicMetadata(pageData);
  }
  
  try {
    metadataLogger.info(`Processing metadata from ${pageData.url || 'unknown URL'}`);
    
    let metascraperResults = {};
    
    // Use metascraper if we have HTML and URL
    if (pageData.html && pageData.url) {
      try {
        // This is the proper way to use metascraper
        metascraperResults = await metascraper({
          html: pageData.html, 
          url: pageData.url
        });
        metadataLogger.info('Successfully processed metadata with metascraper');
      } catch (error) {
        metadataLogger.warn(`Metascraper failed: ${error.message}`);
      }
    }
    
    // Merge metascraper results with our manual extraction for any missing fields
    const useMetascraperResults = metascraperResults && Object.keys(metascraperResults).length > 0;
    
    const processed = {
      // Basic information
      url: pageData.url || '',
      title: useMetascraperResults && metascraperResults.title ? metascraperResults.title : extractTitle(rawMetadata, pageData),
      description: useMetascraperResults && metascraperResults.description ? metascraperResults.description : extractDescription(rawMetadata, pageData),
      author: useMetascraperResults && metascraperResults.author ? metascraperResults.author : extractAuthor(rawMetadata, pageData),
      publisher: useMetascraperResults && metascraperResults.publisher ? metascraperResults.publisher : extractPublisher(rawMetadata, pageData),
      
      // Social metadata
      openGraph: extractOpenGraphData(rawMetadata),
      twitter: extractTwitterCardData(rawMetadata),
      
      // Other metadata
      keywords: extractKeywords(rawMetadata, pageData),
      language: useMetascraperResults && metascraperResults.language ? metascraperResults.language : extractLanguage(rawMetadata, pageData),
      favicon: extractFavicon(rawMetadata, pageData),
      
      // Timestamps
      published: extractPublishedDate(rawMetadata, pageData),
      modified: extractModifiedDate(rawMetadata, pageData),
      
      // Additional fields if available
      image: useMetascraperResults && metascraperResults.image ? metascraperResults.image : (rawMetadata['og:image'] || rawMetadata['twitter:image']),
      type: classifyContentType(rawMetadata, pageData),
      
      // Raw metadata for reference
      raw: rawMetadata
    };
    
    return processed;
  } catch (error) {
    metadataLogger.error(`Error processing metadata asynchronously: ${error.message}`, error);
    return extractBasicMetadata(pageData);
  }
}

/**
 * Extract basic metadata from page data when raw metadata is unavailable
 * @param {Object} pageData - Page data for context
 * @returns {Object} Basic metadata
 */
function extractBasicMetadata(pageData) {
  return {
    url: pageData.url || '',
    title: pageData.title || '',
    description: pageData.excerpt || '',
    language: detectLanguage(pageData.text || ''),
    published: pageData.timestamp || new Date().toISOString()
  };
}

/**
 * Extract page title from metadata
 * @param {Object} metadata - Raw metadata
 * @param {Object} pageData - Additional page data
 * @returns {string} Page title
 */
function extractTitle(metadata, pageData) {
  // Try Open Graph title
  if (metadata['og:title']) {
    return metadata['og:title'];
  }
  
  // Try Twitter title
  if (metadata['twitter:title']) {
    return metadata['twitter:title'];
  }
  
  // Try standard meta title
  if (metadata['title']) {
    return metadata['title'];
  }
  
  // Fall back to page title
  return pageData.title || '';
}

/**
 * Extract page description from metadata
 * @param {Object} metadata - Raw metadata
 * @param {Object} pageData - Additional page data
 * @returns {string} Page description
 */
function extractDescription(metadata, pageData) {
  // Try Open Graph description
  if (metadata['og:description']) {
    return metadata['og:description'];
  }
  
  // Try Twitter description
  if (metadata['twitter:description']) {
    return metadata['twitter:description'];
  }
  
  // Try standard meta description
  if (metadata['description']) {
    return metadata['description'];
  }
  
  // Fall back to page excerpt
  return pageData.excerpt || pageData.summary || '';
}

/**
 * Extract author information from metadata
 * @param {Object} metadata - Raw metadata
 * @param {Object} pageData - Additional page data
 * @returns {string} Author information
 */
function extractAuthor(metadata, pageData) {
  // Check various author meta tags
  if (metadata['author']) {
    return metadata['author'];
  }
  
  if (metadata['article:author']) {
    return metadata['article:author'];
  }
  
  if (metadata['dc.creator']) {
    return metadata['dc.creator'];
  }
  
  // Fall back to page byline
  return pageData.byline || '';
}

/**
 * Extract publisher information from metadata
 * @param {Object} metadata - Raw metadata
 * @param {Object} pageData - Additional page data
 * @returns {string} Publisher information
 */
function extractPublisher(metadata, pageData) {
  // Check various publisher meta tags
  if (metadata['og:site_name']) {
    return metadata['og:site_name'];
  }
  
  if (metadata['publisher']) {
    return metadata['publisher'];
  }
  
  if (metadata['dc.publisher']) {
    return metadata['dc.publisher'];
  }
  
  return '';
}

/**
 * Extract OpenGraph data from metadata
 * @param {Object} metadata - Raw metadata
 * @returns {Object} Extracted OpenGraph data
 */
function extractOpenGraphData(metadata) {
  const ogData = {};
  
  // Find all og: prefixed metadata
  for (const [key, value] of Object.entries(metadata)) {
    if (key.startsWith('og:')) {
      const ogKey = key.replace('og:', '');
      ogData[ogKey] = value;
    }
  }
  
  return ogData;
}

/**
 * Extract Twitter card data from metadata
 * @param {Object} metadata - Raw metadata
 * @returns {Object} Extracted Twitter card data
 */
function extractTwitterCardData(metadata) {
  const twitterData = {};
  
  // Find all twitter: prefixed metadata
  for (const [key, value] of Object.entries(metadata)) {
    if (key.startsWith('twitter:')) {
      const twitterKey = key.replace('twitter:', '');
      twitterData[twitterKey] = value;
    }
  }
  
  return twitterData;
}

/**
 * Extract keywords from metadata
 * @param {Object} metadata - Raw metadata
 * @param {Object} pageData - Additional page data
 * @returns {Array} Keywords array
 */
function extractKeywords(metadata, pageData) {
  // Try to get keywords from meta tags
  let keywords = [];
  
  if (metadata['keywords']) {
    // Keywords may be comma-separated
    keywords = metadata['keywords'].split(',').map(k => k.trim());
  } else if (metadata['article:tag']) {
    // Some sites use article:tag
    if (Array.isArray(metadata['article:tag'])) {
      keywords = metadata['article:tag'];
    } else {
      keywords = [metadata['article:tag']];
    }
  } else if (pageData.tags && Array.isArray(pageData.tags)) {
    // Use page tags if available
    keywords = pageData.tags;
  }
  
  // Filter out empty keywords
  return keywords.filter(k => k && k.length > 0);
}

/**
 * Extract language information from metadata
 * @param {Object} metadata - Raw metadata
 * @param {Object} pageData - Additional page data
 * @returns {string} Language code
 */
function extractLanguage(metadata, pageData) {
  // Try to get language from meta tags
  if (metadata['lang'] || metadata['language']) {
    return metadata['lang'] || metadata['language'];
  }
  
  if (metadata['og:locale']) {
    // og:locale might be in format like 'en_US'
    const locale = metadata['og:locale'];
    return locale.includes('_') ? locale.split('_')[0] : locale;
  }
  
  if (pageData.language) {
    return pageData.language;
  }
  
  // Try to detect language from content
  if (pageData.text) {
    return detectLanguage(pageData.text);
  }
  
  return 'en'; // Default to English
}

/**
 * Detect language from text
 * @param {string} text - Text to analyze
 * @returns {string} Detected language code
 */
function detectLanguage(text) {
  if (!text || text.length < 10) {
    return 'en'; // Default to English for short text
  }
  
  try {
    // Use franc to detect language
    // Sample 100 chars max to avoid processing too much text
    const sample = text.slice(0, 1000);
    const langCode = franc(sample);
    
    if (langCode === 'und') {
      return 'en'; // Return English if detection was unsuccessful
    }
    
    return langCode;
  } catch (error) {
    metadataLogger.warn(`Language detection failed: ${error.message}`);
    return 'en'; // Default to English
  }
}

/**
 * Extract favicon from metadata
 * @param {Object} metadata - Raw metadata
 * @param {Object} pageData - Additional page data
 * @returns {string} Favicon URL
 */
function extractFavicon(metadata, pageData) {
  // Check for favicon in metadata
  if (metadata['favicon']) {
    return metadata['favicon'];
  }
  
  // Check for shortcut icon
  if (metadata['shortcut icon']) {
    return metadata['shortcut icon'];
  }
  
  // If URL is available, construct default favicon path
  if (pageData.url) {
    try {
      const url = new URL(pageData.url);
      return `${url.protocol}//${url.hostname}/favicon.ico`;
    } catch (error) {
      // Ignore URL parsing errors
    }
  }
  
  return '';
}

/**
 * Extract published date from metadata
 * @param {Object} metadata - Raw metadata
 * @param {Object} pageData - Additional page data
 * @returns {string} Published date in ISO format
 */
function extractPublishedDate(metadata, pageData) {
  // Check various date meta tags
  const dateTags = [
    'article:published_time',
    'datePublished',
    'pubdate',
    'publishdate',
    'dc.date.issued',
    'published_time'
  ];
  
  for (const tag of dateTags) {
    if (metadata[tag]) {
      try {
        const date = new Date(metadata[tag]);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch (error) {
        // Continue checking other tags
      }
    }
  }
  
  // Use page timestamp if available
  if (pageData.timestamp) {
    return pageData.timestamp;
  }
  
  // Default to current time
  return new Date().toISOString();
}

/**
 * Extract modified date from metadata
 * @param {Object} metadata - Raw metadata
 * @param {Object} pageData - Additional page data
 * @returns {string} Modified date in ISO format
 */
function extractModifiedDate(metadata, pageData) {
  // Check various date meta tags
  const dateTags = [
    'article:modified_time',
    'dateModified',
    'modified_time',
    'dc.date.modified'
  ];
  
  for (const tag of dateTags) {
    if (metadata[tag]) {
      try {
        const date = new Date(metadata[tag]);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch (error) {
        // Continue checking other tags
      }
    }
  }
  
  // If no modified date is found, use published date
  return extractPublishedDate(metadata, pageData);
}

/**
 * Enrich metadata with additional data
 * @param {Object} metadata - Original metadata
 * @param {Object} enrichmentData - Additional data to enrich with
 * @returns {Object} Enriched metadata
 */
function enrichMetadata(metadata, enrichmentData = {}) {
  // Create a new object to avoid modifying the original
  const enriched = { ...metadata };
  
  // Add enrichment data
  for (const [key, value] of Object.entries(enrichmentData)) {
    if (value !== null && value !== undefined) {
      // Don't overwrite existing values unless they're empty
      if (!enriched[key] || enriched[key] === '') {
        enriched[key] = value;
      }
    }
  }
  
  return enriched;
}

/**
 * Classify content type based on metadata
 * @param {Object} metadata - Raw metadata
 * @param {Object} pageData - Additional page data
 * @returns {string} Content type
 */
function classifyContentType(metadata, pageData = {}) {
  // Check for explicit type in metadata
  if (metadata['og:type']) {
    return metadata['og:type'];
  }
  
  // Try to infer from other metadata
  if (metadata['article:published_time'] || metadata['datePublished']) {
    return 'article';
  }
  
  if (metadata['product:price'] || metadata['og:price:amount']) {
    return 'product';
  }
  
  if (metadata['video:url'] || metadata['og:video']) {
    return 'video';
  }
  
  if (metadata['music:musician'] || metadata['og:audio']) {
    return 'music';
  }
  
  // Default to webpage
  return 'webpage';
}

// Export the processor functions
const MetadataProcessor = {
  process,
  processAsync, // Export the async version for future use
  extractBasicMetadata,
  extractTitle,
  extractDescription,
  extractAuthor,
  extractPublisher,
  extractOpenGraphData,
  extractTwitterCardData,
  extractKeywords,
  extractLanguage,
  detectLanguage,
  extractFavicon,
  extractPublishedDate,
  extractModifiedDate,
  enrichMetadata,
  classifyContentType
};

export default MetadataProcessor; 