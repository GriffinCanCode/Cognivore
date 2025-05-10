/**
 * Embedding Service
 * Responsible for generating vector embeddings from text
 */

const config = require('../config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createContextLogger } = require('../utils/logger');
const logger = createContextLogger('Embedding');

// Ensure model cache directory exists
if (!fs.existsSync(config.paths.modelCache)) {
  fs.mkdirSync(config.paths.modelCache, { recursive: true });
  logger.info(`Created model cache directory: ${config.paths.modelCache}`);
}

/**
 * Generate a simple embedding vector for a text chunk
 * Note: This is a simplified implementation for demonstration purposes.
 * In a production environment, you would use a proper embedding model.
 * 
 * @param {string} text The text to generate an embedding for
 * @returns {Promise<Array<number>>} The embedding vector
 */
async function generateEmbedding(text) {
  try {
    // Preprocess text
    const processedText = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Replace multiple spaces with a single space
      .trim();
    
    // For demonstration purposes, create a deterministic but unique vector
    // based on the hash of the text. This ensures consistent vectors for the same text.
    // In a real application, you would use a proper embedding model.
    const hash = crypto.createHash('md5').update(processedText).digest('hex');
    
    // Convert the hash to a series of numbers to create a vector of the required dimension
    const vector = [];
    for (let i = 0; i < config.embeddings.dimensions; i++) {
      // Use the hash to generate numbers between -1 and 1
      const bytePosition = i % 16; // md5 hash is 16 bytes
      const byte = parseInt(hash.substring(bytePosition * 2, bytePosition * 2 + 2), 16);
      const value = (byte / 255) * 2 - 1; // Convert to range -1 to 1
      vector.push(value);
    }
    
    logger.debug(`Generated embedding for text of length ${text.length}`, { 
      textLength: text.length, 
      vectorDimensions: vector.length 
    });
    return vector;
  } catch (error) {
    logger.error('Error generating embedding', { error: error.message, stack: error.stack });
    // Return a zero vector as fallback
    return new Array(config.embeddings.dimensions).fill(0);
  }
}

/**
 * Generate embeddings for multiple text chunks
 * @param {Array<string>} textChunks Array of text chunks
 * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
 */
async function generateEmbeddings(textChunks) {
  logger.info(`Generating embeddings for ${textChunks.length} chunks`);
  const embeddings = [];
  
  for (const chunk of textChunks) {
    const embedding = await generateEmbedding(chunk);
    embeddings.push(embedding);
  }
  
  logger.info(`Generated ${embeddings.length} embeddings`);
  return embeddings;
}

module.exports = {
  generateEmbedding,
  generateEmbeddings
}; 