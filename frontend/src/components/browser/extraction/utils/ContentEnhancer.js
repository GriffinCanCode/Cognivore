/**
 * ContentEnhancer - Enhance extraction results with additional data
 * 
 * This utility enhances extraction results with additional data and metrics,
 * improving the quality and consistency of extracted content.
 */

import logger from '../../../../utils/logger';
import ContentProcessor from '../processors/ContentProcessor';

// Create a logger instance for this module
const enhancerLogger = logger.scope('ContentEnhancer');

/**
 * Enhance extraction result with additional data
 * @param {Object} result - Extraction result to enhance
 * @param {string} url - URL of content
 * @returns {Promise<Object>} Enhanced result
 */
async function enhance(result, url) {
  if (!result) {
    enhancerLogger.warn('No result to enhance');
    return result;
  }
  
  try {
    enhancerLogger.info(`Enhancing extraction result for ${url}`);
    
    // Add timestamp if missing
    if (!result.timestamp) {
      result.timestamp = new Date().toISOString();
    }
    
    // Add URL if missing
    if (!result.url) {
      result.url = url;
    }
    
    // Ensure extractionMethod exists
    if (!result.extractionMethod) {
      result.extractionMethod = 'unknown';
    }
    
    // Add word count if text exists and no count present
    if (result.text && !result.wordCount) {
      result.wordCount = ContentProcessor.countWords(result.text);
    }
    
    // Add read time estimate (avg reading speed ~200-250 wpm)
    if (result.wordCount) {
      result.readTimeMinutes = Math.max(1, Math.ceil(result.wordCount / 200));
    }
    
    // Generate summary if not present
    if (!result.summary && result.text) {
      try {
        // Instead of awaiting, call the function directly since it's not async
        result.summary = ContentProcessor.generateSummary(result.text, result.title || '');
      } catch (e) {
        enhancerLogger.warn(`Error generating summary: ${e.message}`);
        // Provide a simple fallback summary
        result.summary = result.text.substring(0, 200) + (result.text.length > 200 ? '...' : '');
      }
    }
    
    // Get language if not present
    if (!result.language && result.text) {
      try {
        // Simplified language detection based on content
        result.language = detectLanguage(result.text);
      } catch (e) {
        enhancerLogger.warn(`Language detection failed: ${e.message}`);
      }
    }
    
    // Add extraction metrics
    result.metrics = {
      contentLength: result.text ? result.text.length : 0,
      extractionTime: result.extractionTime || null,
      wordCount: result.wordCount || 0,
      headingCount: result.headings ? result.headings.length : 0,
      linkCount: result.links ? result.links.length : 0
    };
    
    // Track extraction in performance metrics
    trackExtractionMetrics(result);
    
    return result;
  } catch (error) {
    enhancerLogger.error(`Error enhancing content: ${error.message}`, error);
    return result;
  }
}

/**
 * Simple language detection function
 * @param {string} text - Text to detect language from
 * @returns {string} Detected language code
 */
function detectLanguage(text) {
  if (!text || text.length < 10) {
    return 'en';
  }
  
  // This is a very simplified detection method
  // For better detection, use a library like franc or compact-language-detector
  
  // Count common words in different languages
  const patterns = {
    en: /\b(the|and|that|have|for|not|with|you|this|but|his|from|they|say|her|she|will|one|all|would|there|their|what|out|about|who|get|which|when|make|can|like|time|just|him|know|take|person|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|back|after|use|two|how|our|work|first|well|way|even|new|want|because|any|these|give|day|most)\b/gi,
    es: /\b(el|la|de|que|y|a|en|un|ser|se|no|haber|por|con|su|para|como|estar|tener|le|lo|lo|todo|pero|más|hacer|o|poder|decir|este|ir|otro|ese|si|me|ya|ver|porque|dar|cuando|él|muy|sin|vez|mucho|saber|qué|sobre|mi|alguno|mismo|yo|también|hasta)\b/gi,
    fr: /\b(le|la|de|et|à|un|être|avoir|que|pour|dans|ce|il|qui|ne|sur|se|pas|plus|pouvoir|par|je|avec|tout|faire|son|mettre|autre|on|mais|nous|comme|ou|si|leur|y|dire|elle|devoir|avant|même|aussi|celui|donner|où|leurs|donc|cette|quand|fois)\b/gi,
    de: /\b(der|die|und|den|von|zu|das|mit|sich|des|auf|für|ist|im|dem|nicht|ein|eine|als|auch|es|an|werden|aus|er|hat|daß|sie|nach|bei|um|am|können|noch|zur|haben|nur|oder|aber|vor|zum|dann|ihnen|seiner|alle|wieder|meine|Zeit|gegen|vom|gehen)\b/gi
  };
  
  // Count matches for each language
  const counts = {};
  for (const [lang, pattern] of Object.entries(patterns)) {
    const matches = text.match(pattern) || [];
    counts[lang] = matches.length;
  }
  
  // Find language with most matches
  let bestLang = 'en';
  let bestCount = 0;
  
  for (const [lang, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestLang = lang;
      bestCount = count;
    }
  }
  
  return bestLang;
}

/**
 * Track extraction metrics for performance analysis
 * @param {Object} result - Extraction result
 */
function trackExtractionMetrics(result) {
  if (!result || !result.extractionMethod) return;
  
  try {
    // Get or create metrics store
    if (!window.__extractionMetrics) {
      window.__extractionMetrics = {
        counts: {},
        successes: {},
        failures: {},
        timings: {},
        lastExtraction: null
      };
    }
    
    const metrics = window.__extractionMetrics;
    const method = result.extractionMethod;
    
    // Update counts
    metrics.counts[method] = (metrics.counts[method] || 0) + 1;
    
    // Update success/failure counts
    if (result.extractionSuccess) {
      metrics.successes[method] = (metrics.successes[method] || 0) + 1;
    } else {
      metrics.failures[method] = (metrics.failures[method] || 0) + 1;
    }
    
    // Update timing information if available
    if (result.extractionTime) {
      if (!metrics.timings[method]) {
        metrics.timings[method] = {
          total: 0,
          count: 0,
          min: result.extractionTime,
          max: result.extractionTime
        };
      }
      
      const timing = metrics.timings[method];
      timing.total += result.extractionTime;
      timing.count += 1;
      timing.min = Math.min(timing.min, result.extractionTime);
      timing.max = Math.max(timing.max, result.extractionTime);
    }
    
    // Update last extraction
    metrics.lastExtraction = {
      method,
      success: result.extractionSuccess,
      timestamp: result.timestamp || new Date().toISOString(),
      url: result.url
    };
  } catch (error) {
    enhancerLogger.warn(`Error tracking metrics: ${error.message}`);
  }
}

/**
 * Get extraction performance metrics
 * @returns {Object} Extraction metrics
 */
function getExtractionMetrics() {
  if (!window.__extractionMetrics) {
    return {
      counts: {},
      successes: {},
      failures: {},
      timings: {},
      lastExtraction: null
    };
  }
  
  return window.__extractionMetrics;
}

// Export methods
const ContentEnhancer = {
  enhance,
  getExtractionMetrics,
  detectLanguage
};

export default ContentEnhancer; 