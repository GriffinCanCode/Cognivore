/**
 * Local Embedding Service
 * Provides local embedding generation using node-nlp
 * This service runs entirely locally without requiring API calls
 */

const { NlpManager } = require('node-nlp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createContextLogger } = require('../utils/logger');
const config = require('../config');

const logger = createContextLogger('LocalEmbedding');

class LocalEmbeddingService {
  constructor() {
    this.nlpManager = null;
    this.isInitialized = false;
    this.embeddingCache = new Map();
    this.dimensions = 384; // Standard dimension for local embeddings
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the NLP manager for local embeddings
   */
  async initialize() {
    try {
      logger.info('Initializing local embedding service...');
      
      // Create NLP manager with minimal configuration for embeddings
      this.nlpManager = new NlpManager({ 
        languages: ['en'],
        forceNER: false,
        autoLoad: false,
        autoSave: false
      });

      // Add a simple corpus to initialize the embedding space
      // This helps create a baseline for similarity calculations
      const sampleTexts = [
        'This is a sample document about technology and computers.',
        'This text discusses science and research topics.',
        'This content covers business and finance subjects.',
        'This article talks about health and medical information.',
        'This document contains educational and learning materials.',
        'This text is about entertainment and media content.',
        'This content discusses travel and tourism topics.',
        'This article covers sports and fitness information.',
        'This document talks about food and cooking recipes.',
        'This text discusses art and creative subjects.'
      ];

      // Add sample documents to build vocabulary
      sampleTexts.forEach((text, index) => {
        this.nlpManager.addDocument('en', text, `sample_${index}`);
      });

      // Train the model to build the embedding space
      await this.nlpManager.train();
      
      this.isInitialized = true;
      logger.info('Local embedding service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize local embedding service:', error);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initPromise;
    }
  }

  /**
   * Generate a local embedding for text using a simple but effective method
   * @param {string} text - The text to embed
   * @returns {Promise<Array<number>>} - The embedding vector
   */
  async generateEmbedding(text) {
    await this.ensureInitialized();

    if (typeof text !== 'string') {
      throw new Error('Text must be a string');
    }

    // Handle empty or very short text gracefully
    if (!text || text.trim().length === 0) {
      logger.debug('Generating embedding for empty text, using fallback');
      return this.createFallbackEmbedding('empty_text_placeholder');
    }

    // Check cache first
    const cacheKey = crypto.createHash('md5').update(text).digest('hex');
    if (this.embeddingCache.has(cacheKey)) {
      logger.debug('Retrieved cached local embedding');
      return this.embeddingCache.get(cacheKey);
    }

    try {
      // Preprocess text
      const processedText = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Generate embedding using a combination of techniques
      const embedding = await this.createHybridEmbedding(processedText || 'short_text');
      
      // Cache the result
      this.embeddingCache.set(cacheKey, embedding);
      
      logger.debug(`Generated local embedding for text of length ${text.length}`);
      return embedding;
      
    } catch (error) {
      logger.error('Error generating local embedding:', error);
      // Return a fallback embedding based on text hash
      return this.createFallbackEmbedding(text);
    }
  }

  /**
   * Create a hybrid embedding using multiple techniques
   * @param {string} text - Preprocessed text
   * @returns {Array<number>} - Embedding vector
   */
  async createHybridEmbedding(text) {
    const embedding = new Array(this.dimensions).fill(0);
    
    // 1. Word frequency-based features (first 128 dimensions)
    const wordFreqFeatures = this.createWordFrequencyFeatures(text, 128);
    for (let i = 0; i < 128; i++) {
      embedding[i] = wordFreqFeatures[i] || 0;
    }
    
    // 2. Character n-gram features (next 128 dimensions)
    const ngramFeatures = this.createNgramFeatures(text, 128);
    for (let i = 0; i < 128; i++) {
      embedding[128 + i] = ngramFeatures[i] || 0;
    }
    
    // 3. Semantic features using NLP manager (remaining 128 dimensions)
    const semanticFeatures = await this.createSemanticFeatures(text, 128);
    for (let i = 0; i < 128; i++) {
      embedding[256 + i] = semanticFeatures[i] || 0;
    }
    
    // Normalize the embedding vector
    return this.normalizeVector(embedding);
  }

  /**
   * Create word frequency-based features
   * @param {string} text - Input text
   * @param {number} dimensions - Number of dimensions
   * @returns {Array<number>} - Feature vector
   */
  createWordFrequencyFeatures(text, dimensions) {
    const words = text.split(/\s+/).filter(word => word.length > 2);
    const wordCounts = {};
    
    // Count word frequencies
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Create feature vector based on word hashes
    const features = new Array(dimensions).fill(0);
    Object.entries(wordCounts).forEach(([word, count]) => {
      const hash = this.hashString(word);
      const index = Math.abs(hash) % dimensions;
      features[index] += count / words.length; // Normalized frequency
    });
    
    return features;
  }

  /**
   * Create character n-gram features
   * @param {string} text - Input text
   * @param {number} dimensions - Number of dimensions
   * @returns {Array<number>} - Feature vector
   */
  createNgramFeatures(text, dimensions) {
    const features = new Array(dimensions).fill(0);
    const ngramSize = 3; // Use trigrams
    
    // Generate character trigrams
    for (let i = 0; i <= text.length - ngramSize; i++) {
      const ngram = text.substring(i, i + ngramSize);
      const hash = this.hashString(ngram);
      const index = Math.abs(hash) % dimensions;
      features[index] += 1 / (text.length - ngramSize + 1); // Normalized
    }
    
    return features;
  }

  /**
   * Create semantic features using NLP processing
   * @param {string} text - Input text
   * @param {number} dimensions - Number of dimensions
   * @returns {Array<number>} - Feature vector
   */
  async createSemanticFeatures(text, dimensions) {
    const features = new Array(dimensions).fill(0);
    
    try {
      // Process text with NLP manager to get entities and sentiment
      const result = await this.nlpManager.process('en', text);
      
      // Use sentiment as a feature
      if (result.sentiment) {
        features[0] = result.sentiment.score || 0;
        features[1] = result.sentiment.comparative || 0;
      }
      
      // Use entities as features
      if (result.entities && result.entities.length > 0) {
        result.entities.forEach((entity, index) => {
          if (index < 10) { // Use first 10 entities
            const hash = this.hashString(entity.entity);
            const featureIndex = 2 + (Math.abs(hash) % (dimensions - 2));
            features[featureIndex] += entity.accuracy || 0.5;
          }
        });
      }
      
      // Add text length and word count features
      const words = text.split(/\s+/);
      features[dimensions - 2] = Math.min(text.length / 1000, 1); // Normalized text length
      features[dimensions - 1] = Math.min(words.length / 100, 1); // Normalized word count
      
    } catch (error) {
      logger.warn('Error creating semantic features, using fallback:', error.message);
      // Fallback: use simple text statistics
      const words = text.split(/\s+/);
      features[0] = Math.min(text.length / 1000, 1);
      features[1] = Math.min(words.length / 100, 1);
    }
    
    return features;
  }

  /**
   * Create a fallback embedding based on text hash
   * @param {string} text - Input text
   * @returns {Array<number>} - Fallback embedding vector
   */
  createFallbackEmbedding(text) {
    logger.warn('Using fallback embedding generation');
    
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const embedding = [];
    
    // Convert hash to numbers
    for (let i = 0; i < this.dimensions; i++) {
      const byteIndex = (i * 2) % 64; // SHA256 produces 64 hex chars
      const byte = parseInt(hash.substring(byteIndex, byteIndex + 2), 16);
      const value = (byte / 255) * 2 - 1; // Convert to range [-1, 1]
      embedding.push(value);
    }
    
    return this.normalizeVector(embedding);
  }

  /**
   * Normalize a vector to unit length
   * @param {Array<number>} vector - Input vector
   * @returns {Array<number>} - Normalized vector
   */
  normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  /**
   * Simple string hash function
   * @param {string} str - Input string
   * @returns {number} - Hash value
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array<number>} a - First vector
   * @param {Array<number>} b - Second vector
   * @returns {number} - Similarity score between -1 and 1
   */
  calculateSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }

  /**
   * Generate embeddings for multiple texts
   * @param {Array<string>} texts - Array of texts to embed
   * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    if (!Array.isArray(texts)) {
      throw new Error('Texts must be an array');
    }
    
    logger.info(`Generating local embeddings for ${texts.length} texts`);
    
    const embeddings = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    
    logger.info(`Generated ${embeddings.length} local embeddings`);
    return embeddings;
  }

  /**
   * Get embedding dimensions
   * @returns {number} - Number of dimensions
   */
  getDimensions() {
    return this.dimensions;
  }

  /**
   * Clear the embedding cache
   */
  clearCache() {
    this.embeddingCache.clear();
    logger.info('Local embedding cache cleared');
  }
}

// Create singleton instance
const localEmbeddingService = new LocalEmbeddingService();

module.exports = {
  localEmbeddingService,
  LocalEmbeddingService
}; 