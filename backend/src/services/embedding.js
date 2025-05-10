/**
 * Embedding Service
 * Responsible for generating vector embeddings from text
 */

const { NeuralNetwork } = require('node-nlp');
const config = require('../config');
const fs = require('fs');
const path = require('path');

// Ensure model cache directory exists
if (!fs.existsSync(config.paths.modelCache)) {
  fs.mkdirSync(config.paths.modelCache, { recursive: true });
}

// Initialize the embedding model
const embeddingModel = new NeuralNetwork({
  log: false,
  useAllWordVectors: true
});

/**
 * Generate an embedding vector for a text chunk
 * Note: This implementation uses a basic approach since node-nlp doesn't have
 * direct support for the specific embedding models like sentence-transformers.
 * For production, consider using a more advanced embedding solution.
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
    
    // Generate embedding using node-nlp's neural network
    // This is a simplified approach and doesn't match the quality of dedicated embedding models
    const result = await embeddingModel.encodeCorpus([processedText]);
    
    // Ensure we have a fixed-length vector as specified in the config
    let vector = result[0] || [];
    
    // Pad or truncate to match the expected dimensions
    if (vector.length < config.embeddings.dimensions) {
      // Pad with zeros to meet the required dimensions
      vector = [...vector, ...new Array(config.embeddings.dimensions - vector.length).fill(0)];
    } else if (vector.length > config.embeddings.dimensions) {
      // Truncate to the required dimensions
      vector = vector.slice(0, config.embeddings.dimensions);
    }
    
    return vector;
  } catch (error) {
    console.error('Error generating embedding:', error);
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
  const embeddings = [];
  
  for (const chunk of textChunks) {
    const embedding = await generateEmbedding(chunk);
    embeddings.push(embedding);
  }
  
  return embeddings;
}

module.exports = {
  generateEmbedding,
  generateEmbeddings
}; 