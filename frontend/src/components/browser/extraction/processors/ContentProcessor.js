/**
 * ContentProcessor - Process extracted content
 * 
 * This processor handles cleaning, formatting, and enhancing raw content
 * extracted from web pages, ensuring consistent output format.
 */

import logger from '../../../../utils/logger';
import TextProcessor from './TextProcessor';
import HeadingProcessor from './HeadingProcessor';
import LinksProcessor from './LinksProcessor';
import MetadataProcessor from './MetadataProcessor';

// Create a logger instance for this module
const processorLogger = logger.scope('ContentProcessor');

/**
 * Process raw extracted content
 * @param {Object} rawContent - Raw content data
 * @returns {Promise<Object>} Processed content
 */
async function process(rawContent) {
  if (!rawContent) {
    processorLogger.warn('No content to process');
    return {
      title: '',
      text: '',
      url: '',
      processed: false
    };
  }
  
  try {
    processorLogger.info('Processing content from: ' + (rawContent.url || 'unknown URL'));
    
    // Handle different extraction types appropriately
    const extractionMethod = rawContent.extractionMethod || 'unknown';
    
    // Special handling for Readability-extracted content
    if (extractionMethod === 'readability') {
      return processReadabilityContent(rawContent);
    }
    
    // Special handling for JSON DOM content
    if (extractionMethod === 'jsondom' && rawContent.jsonDom) {
      return processJsonDomContent(rawContent);
    }
    
    // Default processing for other content types
    return processStandardContent(rawContent);
  } catch (error) {
    processorLogger.error(`Error processing content: ${error.message}`, error);
    
    // Return minimal processed content on error
    return {
      title: rawContent.title || '',
      text: rawContent.text || '',
      url: rawContent.url || '',
      error: error.message,
      processed: false
    };
  }
}

/**
 * Process content extracted with Readability
 * @param {Object} readabilityContent - Readability extraction result
 * @returns {Promise<Object>} Processed content
 */
async function processReadabilityContent(readabilityContent) {
  // Readability already provides clean text, so less processing is needed
  const processedText = readabilityContent.text || '';
  
  // Process headings if available
  const processedHeadings = HeadingProcessor.process(readabilityContent.headings || []);
  
  // Process links if available
  const processedLinks = LinksProcessor.process(readabilityContent.links || [], readabilityContent.url || '');
  
  // Process metadata - now using async
  const processedMetadata = await MetadataProcessor.process(readabilityContent.metadata || {}, readabilityContent);
  
  // Use HTML content from Readability
  const processedHtml = readabilityContent.html || '';
  
  // Extract byline and site information
  const byline = readabilityContent.byline || '';
  const siteName = readabilityContent.siteName || '';
  
  // Use excerpt as summary or generate one
  const summary = readabilityContent.excerpt || generateSummary(processedText, readabilityContent.title || '');
  
  // Count words
  const wordCount = countWords(processedText);
  
  // Create processed content object
  return {
    title: readabilityContent.title || '',
    text: processedText,
    html: processedHtml,
    url: readabilityContent.url || '',
    headings: processedHeadings,
    links: processedLinks,
    metadata: processedMetadata,
    byline,
    siteName,
    summary,
    wordCount,
    extractionMethod: 'readability',
    timestamp: readabilityContent.timestamp || new Date().toISOString(),
    processed: true
  };
}

/**
 * Process content extracted with JSON DOM representation
 * @param {Object} jsonDomContent - JSON DOM extraction result
 * @returns {Promise<Object>} Processed content
 */
async function processJsonDomContent(jsonDomContent) {
  // Extract text from JSON DOM
  const extractedText = extractTextFromJsonDom(jsonDomContent.jsonDom);
  const processedText = TextProcessor.process(extractedText);
  
  // Generate HTML from JSON DOM
  const processedHtml = jsonDomToHtml(jsonDomContent.jsonDom);
  
  // Extract headings from JSON DOM
  const headings = extractHeadingsFromJsonDom(jsonDomContent.jsonDom);
  const processedHeadings = HeadingProcessor.process(headings);
  
  // Extract links from JSON DOM
  const links = extractLinksFromJsonDom(jsonDomContent.jsonDom);
  const processedLinks = LinksProcessor.process(links, jsonDomContent.url || '');
  
  // Process metadata - now using async
  const processedMetadata = await MetadataProcessor.process(jsonDomContent.metadata || {}, jsonDomContent);
  
  // Generate summary
  const summary = generateSummary(processedText, jsonDomContent.title || '');
  
  // Count words
  const wordCount = countWords(processedText);
  
  // Create processed content object
  return {
    title: jsonDomContent.title || '',
    text: processedText,
    html: processedHtml,
    url: jsonDomContent.url || '',
    headings: processedHeadings,
    links: processedLinks,
    metadata: processedMetadata,
    summary,
    wordCount,
    extractionMethod: 'jsondom',
    timestamp: jsonDomContent.timestamp || new Date().toISOString(),
    processed: true
  };
}

/**
 * Process standard content from regular extractors
 * @param {Object} standardContent - Standard extraction result
 * @returns {Promise<Object>} Processed content
 */
async function processStandardContent(standardContent) {
  // Process text content
  const processedText = TextProcessor.process(standardContent.text || '');
  
  // Process headings
  const processedHeadings = HeadingProcessor.process(standardContent.headings || []);
  
  // Process links
  const processedLinks = LinksProcessor.process(standardContent.links || [], standardContent.url || '');
  
  // Process metadata - now using async
  const processedMetadata = await MetadataProcessor.process(standardContent.metadata || {}, standardContent);
  
  // Generate HTML content from the text if needed
  let processedHtml = standardContent.processedContent || standardContent.html || '';
  if (!processedHtml && processedText) {
    processedHtml = TextProcessor.textToHtml(processedText);
  }
  
  // Generate summary
  const summary = generateSummary(processedText, standardContent.title || '');
  
  // Count words
  const wordCount = countWords(processedText);
  
  // Create processed content object
  return {
    title: standardContent.title || '',
    text: processedText,
    html: processedHtml,
    url: standardContent.url || '',
    headings: processedHeadings,
    links: processedLinks,
    metadata: processedMetadata,
    summary,
    wordCount,
    extractionMethod: standardContent.extractionMethod || 'standard',
    timestamp: standardContent.timestamp || new Date().toISOString(),
    processed: true
  };
}

/**
 * Extract text from JSON DOM structure
 * @param {Object} jsonDom - JSON DOM representation
 * @returns {string} Extracted text
 */
function extractTextFromJsonDom(jsonDom) {
  if (!jsonDom) return '';
  
  let text = '';
  
  function processNode(node) {
    if (!node) return;
    
    if (node.type === 'text') {
      text += node.content + ' ';
    } else if (node.type === 'element') {
      // Add newlines for block elements
      const blockElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'];
      if (blockElements.includes(node.tagName)) {
        text += '\n\n';
      }
      
      // Process children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => processNode(child));
      } else if (node.textContent) {
        text += node.textContent + ' ';
      }
      
      // Add newline after block elements
      if (blockElements.includes(node.tagName)) {
        text += '\n\n';
      }
    }
  }
  
  processNode(jsonDom);
  
  // Clean up extra whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Convert JSON DOM to HTML
 * @param {Object} jsonDom - JSON DOM representation
 * @returns {string} HTML string
 */
function jsonDomToHtml(jsonDom) {
  if (!jsonDom) return '';
  
  function processNode(node) {
    if (!node) return '';
    
    if (node.type === 'text') {
      return TextProcessor.escapeHtml(node.content);
    } else if (node.type === 'element') {
      // Handle special case for void elements
      const voidElements = ['img', 'br', 'hr', 'input', 'meta', 'link'];
      if (voidElements.includes(node.tagName)) {
        let attributes = '';
        if (node.attributes) {
          Object.entries(node.attributes).forEach(([key, value]) => {
            attributes += ` ${key}="${TextProcessor.escapeHtml(value)}"`;
          });
        }
        return `<${node.tagName}${attributes}>`;
      }
      
      // Handle regular elements
      let html = `<${node.tagName}`;
      
      // Add attributes
      if (node.attributes) {
        Object.entries(node.attributes).forEach(([key, value]) => {
          html += ` ${key}="${TextProcessor.escapeHtml(value)}"`;
        });
      }
      
      html += '>';
      
      // Add children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => {
          html += processNode(child);
        });
      } else if (node.textContent) {
        html += TextProcessor.escapeHtml(node.textContent);
      }
      
      html += `</${node.tagName}>`;
      return html;
    }
    
    return '';
  }
  
  return processNode(jsonDom);
}

/**
 * Extract headings from JSON DOM
 * @param {Object} jsonDom - JSON DOM representation
 * @returns {Array} Array of headings
 */
function extractHeadingsFromJsonDom(jsonDom) {
  const headings = [];
  
  function processNode(node) {
    if (!node) return;
    
    if (node.type === 'element' && node.tagName.match(/^h[1-6]$/)) {
      const level = parseInt(node.tagName.substring(1), 10);
      let text = '';
      
      // Extract text from this heading
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => {
          if (child.type === 'text') {
            text += child.content + ' ';
          } else if (child.textContent) {
            text += child.textContent + ' ';
          }
        });
      } else if (node.textContent) {
        text = node.textContent;
      }
      
      headings.push({
        level,
        text: text.trim()
      });
    }
    
    // Process children recursively
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => processNode(child));
    }
  }
  
  processNode(jsonDom);
  return headings;
}

/**
 * Extract links from JSON DOM
 * @param {Object} jsonDom - JSON DOM representation
 * @returns {Array} Array of links
 */
function extractLinksFromJsonDom(jsonDom) {
  const links = [];
  
  function processNode(node) {
    if (!node) return;
    
    if (node.type === 'element' && node.tagName === 'a' && node.attributes && node.attributes.href) {
      let text = '';
      
      // Extract link text
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => {
          if (child.type === 'text') {
            text += child.content + ' ';
          } else if (child.textContent) {
            text += child.textContent + ' ';
          }
        });
      } else if (node.textContent) {
        text = node.textContent;
      }
      
      links.push({
        text: text.trim(),
        url: node.attributes.href,
        title: node.attributes.title || ''
      });
    }
    
    // Process children recursively
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => processNode(child));
    }
  }
  
  processNode(jsonDom);
  return links;
}

/**
 * Generate a summary from text content
 * @param {string} text - Full text content
 * @param {string} title - Page title
 * @returns {string} Generated summary
 */
function generateSummary(text, title) {
  if (!text) return '';
  
  try {
    // Get first substantial paragraph (at least 100 characters)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 100);
    
    if (paragraphs.length > 0) {
      // Use first substantial paragraph
      let summary = paragraphs[0].trim();
      
      // Truncate if too long (max 300 characters)
      if (summary.length > 300) {
        summary = summary.substring(0, 297) + '...';
      }
      
      return summary;
    } else {
      // If no substantial paragraph, use beginning of text
      const trimmedText = text.trim();
      if (trimmedText.length > 0) {
        if (trimmedText.length > 300) {
          return trimmedText.substring(0, 297) + '...';
        }
        return trimmedText;
      } else {
        // If no text at all, use title
        return title || '';
      }
    }
  } catch (error) {
    processorLogger.warn(`Error generating summary: ${error.message}`);
    return text.substring(0, 200) + (text.length > 200 ? '...' : '');
  }
}

/**
 * Count words in text
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

// Export methods
const ContentProcessor = {
  process,
  processReadabilityContent,
  processJsonDomContent,
  processStandardContent,
  generateSummary,
  countWords,
  extractTextFromJsonDom,
  jsonDomToHtml
};

export default ContentProcessor; 