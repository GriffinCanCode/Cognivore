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

/**
 * Generate embeddings for multiple chunks in parallel batches
 * This is a more efficient implementation that processes chunks in parallel
 * @param {Array<string>} textChunks Array of text chunks
 * @param {Object} options Batch processing options
 * @param {number} [options.batchSize=10] Number of chunks to process in each batch
 * @param {number} [options.concurrency=2] Number of batches to process concurrently
 * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
 */
async function generateEmbeddingsBatch(textChunks, options = {}) {
  const batchSize = options.batchSize || 10;
  const concurrency = options.concurrency || 2;
  
  logger.info(`Generating embeddings for ${textChunks.length} chunks with batch processing`, {
    batchSize,
    concurrency
  });
  
  // For backward compatibility, this function uses internal implementation
  // rather than importing the batch utilities, which would create circular dependencies
  
  // Create batches
  const batches = [];
  for (let i = 0; i < textChunks.length; i += batchSize) {
    batches.push(textChunks.slice(i, i + batchSize));
  }
  
  logger.debug(`Created ${batches.length} batches for processing`);
  
  const allEmbeddings = [];
  
  // Process batches with limited concurrency
  for (let i = 0; i < batches.length; i += concurrency) {
    const currentBatches = batches.slice(i, i + concurrency);
    
    logger.debug(`Processing batch group ${Math.floor(i / concurrency) + 1}/${Math.ceil(batches.length / concurrency)}`);
    
    // Process batches in parallel
    const batchPromises = currentBatches.map(async (batch) => {
      return Promise.all(batch.map(chunk => generateEmbedding(chunk)));
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // Flatten and add to results
    batchResults.forEach(result => {
      allEmbeddings.push(...result);
    });
  }
  
  logger.info(`Generated ${allEmbeddings.length} embeddings with batch processing`);
  return allEmbeddings;
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {Array<number>} a First vector
 * @param {Array<number>} b Second vector
 * @returns {number} Similarity score between -1 and 1
 */
function calculateSimilarity(a, b) {
  if (a.length !== b.length) {
    logger.error(`Vector dimensions do not match: ${a.length} vs ${b.length}`);
    throw new Error('Vector dimensions must match');
  }
  
  // Calculate dot product
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  // Calculate magnitudes
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  // Return cosine similarity
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

module.exports = {
  generateEmbedding,
  generateEmbeddings,
  generateEmbeddingsBatch,
  calculateSimilarity
}; 