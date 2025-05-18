/**
 * ContentValidator - Validate extraction results
 * 
 * This utility provides functions to validate extraction results
 * and ensure they meet minimum quality standards.
 */

import logger from '../../../../utils/logger';

// Create a logger instance for this module
const validatorLogger = logger.scope('ContentValidator');

/**
 * Check if extraction result is valid
 * @param {Object} result - Extraction result to validate
 * @returns {boolean} Whether result is valid
 */
function isValidExtractionResult(result) {
  if (!result) {
    validatorLogger.warn('Validation failed: result is null or undefined');
    return false;
  }
  
  // Check for error flag
  if (result.error) {
    validatorLogger.warn(`Validation failed: result has error: ${result.message || 'Unknown error'}`);
    return false;
  }
  
  // Must have title or text
  if (!result.title && !result.text) {
    validatorLogger.warn('Validation failed: result has no title or text');
    return false;
  }
  
  // Text should have meaningful content if present
  if (result.text && typeof result.text === 'string' && result.text.length < 50) {
    validatorLogger.warn('Validation failed: text content is too short');
    return false;
  }
  
  // URL should be valid if present
  if (result.url && typeof result.url === 'string') {
    try {
      new URL(result.url);
    } catch (e) {
      validatorLogger.warn(`Validation failed: invalid URL (${result.url})`);
      return false;
    }
  }
  
  validatorLogger.debug('Validation passed');
  return true;
}

/**
 * Validate text content quality
 * @param {string} text - Text content to validate
 * @returns {Object} Validation result with quality score
 */
function validateTextQuality(text) {
  if (!text || typeof text !== 'string') {
    return {
      valid: false,
      score: 0,
      reason: 'No text content'
    };
  }
  
  // Calculate quality metrics
  const length = text.length;
  const wordCount = text.split(/\s+/).length;
  const sentenceCount = (text.match(/[.!?]+/g) || []).length;
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  
  // Quality scores (0-100)
  let contentScore = 0;
  
  // Score based on length
  if (length > 5000) contentScore += 35;
  else if (length > 2000) contentScore += 25;
  else if (length > 1000) contentScore += 15;
  else if (length > 500) contentScore += 10;
  else if (length > 200) contentScore += 5;
  
  // Score based on word count
  if (wordCount > 1000) contentScore += 25;
  else if (wordCount > 500) contentScore += 20;
  else if (wordCount > 200) contentScore += 15;
  else if (wordCount > 100) contentScore += 10;
  else if (wordCount > 50) contentScore += 5;
  
  // Score based on sentence structure
  if (sentenceCount > 20 && avgWordsPerSentence > 5 && avgWordsPerSentence < 25) {
    contentScore += 20;
  } else if (sentenceCount > 10 && avgWordsPerSentence > 5) {
    contentScore += 10;
  } else if (sentenceCount > 5) {
    contentScore += 5;
  }
  
  // Check for common junk patterns
  const junkPatterns = [
    /access denied/i,
    /forbidden/i,
    /error 4\d\d/i,
    /login required/i,
    /please enable javascript/i,
    /captcha/i,
    /sorry, we couldn't find that page/i
  ];
  
  const hasJunkContent = junkPatterns.some(pattern => pattern.test(text));
  
  if (hasJunkContent) {
    contentScore = Math.max(0, contentScore - 30);
  }
  
  // Determine if valid based on score
  const isValid = contentScore >= 30 && !hasJunkContent;
  
  return {
    valid: isValid,
    score: contentScore,
    wordCount,
    sentenceCount,
    avgWordsPerSentence,
    hasJunkContent,
    reason: isValid ? 'Content meets quality standards' : 'Content quality below threshold'
  };
}

/**
 * Validate HTML content
 * @param {string} html - HTML content to validate
 * @returns {Object} Validation result
 */
function validateHtmlContent(html) {
  if (!html || typeof html !== 'string') {
    return {
      valid: false,
      reason: 'No HTML content'
    };
  }
  
  // Check for minimum HTML structure
  const hasHtmlStructure = /<\w+>.*<\/\w+>/s.test(html);
  
  // Check for common content elements
  const hasParagraphs = /<p>.*<\/p>/s.test(html);
  const hasHeadings = /<h[1-6]>.*<\/h[1-6]>/s.test(html);
  
  // Check for empty HTML or HTML with only whitespace or very short content
  const strippedHtml = html.replace(/<[^>]*>/g, '').trim();
  const isTooShort = strippedHtml.length < 100;
  
  // Content is valid if it has HTML structure, contains paragraphs, and isn't too short
  const isValid = hasHtmlStructure && hasParagraphs && !isTooShort;
  
  return {
    valid: isValid,
    hasHtmlStructure,
    hasParagraphs,
    hasHeadings,
    contentLength: strippedHtml.length,
    isTooShort,
    reason: isValid ? 'HTML content is valid' : 'HTML content has structural issues'
  };
}

// Export methods
const ContentValidator = {
  isValidExtractionResult,
  validateTextQuality,
  validateHtmlContent
};

export default ContentValidator; 