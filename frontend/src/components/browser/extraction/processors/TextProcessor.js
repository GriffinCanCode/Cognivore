/**
 * TextProcessor - Process and format text content
 * 
 * This processor handles cleaning, formatting, and converting text content
 * to different formats including HTML.
 */

import logger from '../../../../utils/logger';

// Create a logger instance for this module
const textLogger = logger.scope('TextProcessor');

/**
 * Process raw text content
 * @param {string} text - Raw text content
 * @returns {string} Processed text
 */
function process(text) {
  if (!text) return '';
  
  try {
    // Normalize whitespace
    let processedText = text.replace(/\s+/g, ' ').trim();
    
    // Break into paragraphs - look for double line breaks or multiple spaces
    processedText = processedText.replace(/\.\s+/g, '.\n\n');
    
    // Further improve paragraph breaks by identifying sentence patterns
    processedText = improveParagraphBreaks(processedText);
    
    // Remove excessive line breaks
    processedText = processedText.replace(/\n{3,}/g, '\n\n');
    
    return processedText;
  } catch (error) {
    textLogger.error(`Error processing text: ${error.message}`, error);
    return text;
  }
}

/**
 * Improve paragraph breaks by identifying sentence patterns
 * @param {string} text - Text with basic paragraph breaks
 * @returns {string} Text with improved paragraph breaks
 */
function improveParagraphBreaks(text) {
  if (!text) return '';
  
  try {
    // Split text into paragraphs
    let paragraphs = text.split(/\n\n+/);
    
    // Process each paragraph to break up large ones
    const processedParagraphs = paragraphs.map(paragraph => {
      // Skip small paragraphs
      if (paragraph.length < 500) return paragraph;
      
      // Split long paragraph at logical points (periods followed by capital letters)
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      
      // Group sentences into smaller paragraphs (3-5 sentences per paragraph)
      const newParagraphs = [];
      let currentParagraph = '';
      let sentenceCount = 0;
      
      sentences.forEach(sentence => {
        currentParagraph += sentence;
        sentenceCount++;
        
        // At every 3-5 sentences, create a new paragraph
        if (sentenceCount >= 3 && 
            (sentenceCount >= 5 || sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?'))) {
          newParagraphs.push(currentParagraph);
          currentParagraph = '';
          sentenceCount = 0;
        }
      });
      
      // Add any remaining content
      if (currentParagraph) {
        newParagraphs.push(currentParagraph);
      }
      
      return newParagraphs.join('\n\n');
    });
    
    return processedParagraphs.join('\n\n');
  } catch (error) {
    textLogger.warn(`Error improving paragraph breaks: ${error.message}`);
    return text;
  }
}

/**
 * Convert plain text to HTML
 * @param {string} text - Plain text content
 * @returns {string} HTML formatted content
 */
function textToHtml(text) {
  if (!text) return '';
  
  try {
    // Split text into paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    
    // Convert each paragraph to HTML
    const htmlParagraphs = paragraphs.map(paragraph => {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) return '';
      
      // Check if paragraph is a heading (starts with # or ##)
      if (trimmedParagraph.startsWith('# ')) {
        const heading = trimmedParagraph.substring(2);
        return `<h1>${escapeHtml(heading)}</h1>`;
      } else if (trimmedParagraph.startsWith('## ')) {
        const heading = trimmedParagraph.substring(3);
        return `<h2>${escapeHtml(heading)}</h2>`;
      } else if (trimmedParagraph.startsWith('### ')) {
        const heading = trimmedParagraph.substring(4);
        return `<h3>${escapeHtml(heading)}</h3>`;
      } else if (trimmedParagraph.startsWith('> ')) {
        // Handle blockquotes
        const quote = trimmedParagraph.substring(2);
        return `<blockquote>${escapeHtml(quote)}</blockquote>`;
      } else if (trimmedParagraph.startsWith('```')) {
        // Handle code blocks
        const code = trimmedParagraph.replace(/```.*\n([\s\S]*?)```/, '$1');
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      } else if (trimmedParagraph.startsWith('- ') || trimmedParagraph.match(/^\d+\.\s/)) {
        // Handle lists
        const items = trimmedParagraph.split('\n');
        const isBullet = trimmedParagraph.startsWith('- ');
        
        let html = isBullet ? '<ul>' : '<ol>';
        
        items.forEach(item => {
          const trimmedItem = item.trim();
          if (isBullet && trimmedItem.startsWith('- ')) {
            html += `<li>${escapeHtml(trimmedItem.substring(2))}</li>`;
          } else if (!isBullet && trimmedItem.match(/^\d+\.\s/)) {
            html += `<li>${escapeHtml(trimmedItem.replace(/^\d+\.\s/, ''))}</li>`;
          }
        });
        
        html += isBullet ? '</ul>' : '</ol>';
        return html;
      } else {
        // Regular paragraph
        return `<p>${formatLinks(escapeHtml(trimmedParagraph))}</p>`;
      }
    });
    
    return htmlParagraphs.filter(p => p).join('\n');
  } catch (error) {
    textLogger.error(`Error converting text to HTML: ${error.message}`, error);
    return `<p>${escapeHtml(text)}</p>`;
  }
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, match => htmlEntities[match]);
}

/**
 * Format URLs in text as HTML links
 * @param {string} text - Text with URLs
 * @returns {string} Text with HTML link tags
 */
function formatLinks(text) {
  if (!text) return '';
  
  // Replace URLs with anchor tags
  return text.replace(
    /(https?:\/\/[^\s<>"']+)/g, 
    url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`
  );
}

/**
 * Extract keywords from text
 * @param {string} text - Text content
 * @param {number} maxKeywords - Maximum number of keywords to extract
 * @returns {Array<string>} Keywords
 */
function extractKeywords(text, maxKeywords = 10) {
  if (!text || typeof text !== 'string') return [];
  
  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'am', 'was', 'were', 
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 
    'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'to', 
    'of', 'in', 'on', 'at', 'for', 'with', 'by', 'about', 'against', 'between', 
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 
    'up', 'down', 'this', 'that', 'these', 'those', 'it', 'its', 'them', 'their'
  ]);
  
  // Split text into words, make lowercase, and filter
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && !stopWords.has(word)
    );
  
  // Count word frequency
  const wordCounts = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  // Sort by frequency and return top keywords
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

// Export methods
const TextProcessor = {
  process,
  improveParagraphBreaks,
  textToHtml,
  escapeHtml,
  formatLinks,
  extractKeywords
};

export default TextProcessor; 