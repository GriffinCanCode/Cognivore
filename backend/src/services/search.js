/**
 * Search Service
 * Handles semantic search functionality
 */

const { generateEmbedding, calculateSimilarity } = require('./embedding');
const { vectorSearch } = require('./database');
const { createContextLogger } = require('../utils/logger');
const logger = createContextLogger('Search');

/**
 * Perform semantic search based on a natural language query
 * @param {string} query The search query
 * @param {number} limit Maximum number of results to return
 * @returns {Promise<Array>} Array of search results with relevant text chunks
 */
async function semanticSearch(query, limit = 5) {
  try {
    logger.info(`Performing semantic search for query: "${query}"`);
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    logger.debug('Generated query embedding');
    
    // Perform vector search
    const results = await vectorSearch(queryEmbedding, limit);
    logger.info(`Found ${results.length} results for query`);
    
    // Format results with relevant information
    const formattedResults = results.map(result => {
      // Parse metadata if it's stored as a JSON string
      let metadata = {};
      try {
        if (typeof result.metadata === 'string') {
          metadata = JSON.parse(result.metadata);
        } else if (typeof result.metadata === 'object') {
          metadata = result.metadata;
        }
      } catch (error) {
        logger.warn(`Failed to parse metadata for item ${result.id}`, { error: error.message });
      }
      
      return {
        id: result.id,
        title: result.title,
        sourceType: result.source_type,
        sourceIdentifier: result.source_identifier,
        textChunk: result.text_chunks ? result.text_chunks[0] : '',
        similarity: result._distance || 0,
        metadata
      };
    });
    
    return formattedResults;
  } catch (error) {
    logger.error('Error performing semantic search:', error);
    throw error;
  }
}

module.exports = {
  semanticSearch
}; 