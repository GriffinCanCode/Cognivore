/**
 * Embedding Service
 * Responsible for generating vector embeddings from text
 */

// Load environment variables
require('dotenv').config();
const config = require('../config');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { createContextLogger } = require('../utils/logger');
const { localEmbeddingService } = require('./localEmbedding');
const logger = createContextLogger('Embedding');

// Ensure model cache directory exists
if (!fs.existsSync(config.paths.modelCache)) {
  fs.mkdirSync(config.paths.modelCache, { recursive: true });
  logger.info(`Created model cache directory: ${config.paths.modelCache}`);
}

// Rate limiting configuration
const rateLimits = {
  maxRequestsPerMinute: 300, // Adjust based on your quota
  backoffInitialDelay: 1000, // Start with 1s delay
  backoffMaxDelay: 60000, // Max 60s delay
  backoffFactor: 2, // Exponential factor
  requestWindow: 60000, // 1 minute in ms
};

// Track API requests for rate limiting
const requestTimestamps = [];

/**
 * Check if we should proceed with the API request or wait due to rate limits
 * @returns {Promise<void>} Resolves when it's safe to proceed
 */
async function enforceRateLimit() {
  const now = Date.now();
  
  // Remove timestamps older than the tracking window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - rateLimits.requestWindow) {
    requestTimestamps.shift();
  }
  
  // Check if we're over the limit
  if (requestTimestamps.length >= rateLimits.maxRequestsPerMinute) {
    const oldestAllowed = now - rateLimits.requestWindow;
    const oldestRequest = requestTimestamps[0];
    const waitTime = Math.max(0, rateLimits.requestWindow - (now - oldestRequest));
    
    logger.warn(`Rate limit reached. Waiting ${waitTime}ms before next request.`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return enforceRateLimit(); // Recursive check after waiting
  }
  
  // Record this request
  requestTimestamps.push(now);
}

/**
 * Generate an embedding vector for a text chunk
 * @param {string} text The text to generate an embedding for
 * @param {Object} options Options for embedding generation
 * @param {boolean} options.preferLocal Whether to prefer local embeddings over API
 * @param {string} options.modelName Model name to use for API embeddings
 * @returns {Promise<Array<number>>} The embedding vector
 */
async function generateEmbedding(text, options = {}) {
  try {
    const { preferLocal = false, modelName = null } = options;
    
    // Get the model name from environment or config
    const embeddingModel = modelName || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    logger.debug(`Using embedding model: ${embeddingModel}`);
    
    // Preprocess text
    const processedText = text
      .replace(/\s+/g, ' ')    // Replace multiple spaces with a single space
      .trim();
    
    // Check for cached embedding to avoid redundant API calls
    const cacheKey = crypto.createHash('md5').update(processedText + (preferLocal ? '_local' : '_api')).digest('hex');
    const cachePath = path.join(config.paths.modelCache, `${cacheKey}.json`);
    
    // Try to use cached embedding first
    if (fs.existsSync(cachePath)) {
      try {
        const cachedVector = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        logger.debug(`Retrieved cached embedding for text of length ${text.length}`);
        return cachedVector;
      } catch (cacheError) {
        logger.warn(`Failed to use cached embedding: ${cacheError.message}`);
      }
    }

    // If preferLocal is true or if this is for tab clustering, use local embeddings
    if (preferLocal || processedText.includes('Title:') || processedText.includes('URL:')) {
      try {
        logger.debug('Using local embedding service for tab clustering');
        const vector = await localEmbeddingService.generateEmbedding(processedText);
        
        // Cache the result
        fs.writeFileSync(cachePath, JSON.stringify(vector));
        
        logger.debug(`Generated local embedding for text of length ${text.length}`, { 
          textLength: text.length, 
          vectorDimensions: vector.length 
        });
        
        return vector;
      } catch (localError) {
        logger.warn('Local embedding failed, falling back to API:', localError.message);
      }
    }
    
    // Try API embedding if local is not preferred or failed
    try {
      // Use OpenAI embedding API
      const vector = await executeWithRetry(() => getOpenAIEmbedding(processedText, embeddingModel));
      
      // Cache the result
      fs.writeFileSync(cachePath, JSON.stringify(vector));
      
      logger.debug(`Generated API embedding for text of length ${text.length}`, { 
        textLength: text.length, 
        vectorDimensions: vector.length 
      });
      
      return vector;
    } catch (apiError) {
      logger.error('Error calling embedding API', { 
        error: apiError.message, 
        status: apiError.response?.status,
        data: apiError.response?.data
      });
      
      // Fall back to local embedding if API fails
      logger.warn('API embedding failed, falling back to local embedding method');
      try {
        const vector = await localEmbeddingService.generateEmbedding(processedText);
        
        // Cache the result
        fs.writeFileSync(cachePath, JSON.stringify(vector));
        
        return vector;
      } catch (localFallbackError) {
        logger.error('Local embedding fallback also failed:', localFallbackError.message);
        // Final fallback to simple embedding
        return fallbackEmbedding(processedText);
      }
    }
  } catch (error) {
    logger.error('Error generating embedding', { error: error.message, stack: error.stack });
    // Return a zero vector as fallback
    return new Array(config.embeddings.dimensions).fill(0);
  }
}

/**
 * Generate a local embedding specifically for tab clustering
 * @param {string} text The text to generate an embedding for
 * @returns {Promise<Array<number>>} The embedding vector
 */
async function generateLocalEmbedding(text) {
  try {
    logger.debug('Generating local embedding for tab clustering');
    return await localEmbeddingService.generateEmbedding(text);
  } catch (error) {
    logger.error('Error generating local embedding:', error);
    // Fallback to hash-based embedding
    return fallbackEmbedding(text);
  }
}

/**
 * Execute a function with exponential backoff retry logic
 * @param {Function} fn Function to execute
 * @param {Number} maxRetries Maximum number of retries
 * @returns {Promise<any>} Result of the function
 */
async function executeWithRetry(fn, maxRetries = 5) {
  let retries = 0;
  let delay = rateLimits.backoffInitialDelay;
  
  while (true) {
    try {
      // Enforce rate limits before making the request
      await enforceRateLimit();
      
      // Execute the function
      return await fn();
    } catch (error) {
      retries++;
      
      // Check if we should retry (rate limit or server error)
      const isRateLimitError = error.response?.status === 429 || 
                              error.message?.includes('rate limit') ||
                              error.message?.includes('quota');
                              
      const isServerError = error.response?.status >= 500 && error.response?.status < 600;
      
      if ((isRateLimitError || isServerError) && retries < maxRetries) {
        // Calculate backoff delay with jitter
        const jitter = Math.random() * 0.3 + 0.85; // Random between 0.85-1.15
        delay = Math.min(delay * rateLimits.backoffFactor * jitter, rateLimits.backoffMaxDelay);
        
        logger.warn(`API request failed with ${error.message}. Retrying in ${Math.round(delay/1000)}s (retry ${retries}/${maxRetries})`, {
          status: error.response?.status,
          retryCount: retries
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Either not retryable or max retries reached
        throw error;
      }
    }
  }
}

/**
 * Get embedding from OpenAI
 * @param {string} text The text to embed
 * @param {string} modelName The model name to use (text-embedding-3-small or text-embedding-3-large)
 * @returns {Promise<Array<number>>} The embedding vector
 */
async function getOpenAIEmbedding(text, modelName) {
  logger.debug('Using OpenAI for embeddings');
  
  // Use API endpoint for embedding generation
  const apiUrl = config.embeddings.apiUrl || 'https://api.openai.com/v1/embeddings';
  
  // Get API key from environment variable first
  let apiKey = process.env.OPENAI_API_KEY;
  
  // If API key isn't in environment variables, check for a .env file in various locations
  if (!apiKey) {
    const possibleEnvLocations = [
      './.env',
      '../.env',
      './backend/.env',
      path.join(__dirname, '../../../.env'),
      path.join(__dirname, '../../.env')
    ];
    
    for (const envPath of possibleEnvLocations) {
      try {
        if (fs.existsSync(envPath)) {
          logger.debug(`Found .env file at ${envPath}`);
          // Parse .env file manually
          const envContent = fs.readFileSync(envPath, 'utf8');
          const apiKeyMatch = envContent.match(/OPENAI_API_KEY=(.+)/);
          if (apiKeyMatch && apiKeyMatch[1]) {
            apiKey = apiKeyMatch[1].trim();
            logger.debug('Loaded OPENAI_API_KEY from .env file');
            break;
          }
        }
      } catch (error) {
        logger.warn(`Error checking .env at ${envPath}:`, error.message);
      }
    }
  }
  
  if (!apiKey) {
    logger.error('OPENAI_API_KEY is undefined or empty. Check your .env file or environment variables.');
    throw new Error('OPENAI_API_KEY is not set. Check .env file or environment variables.');
  } else {
    logger.debug('OPENAI_API_KEY is properly set.');
  }
  
  const payload = {
    input: text,
    model: modelName,
  };
  
  // Add dimensions parameter for text-embedding-3 models
  if (modelName.includes('text-embedding-3')) {
    // Default dimensions based on model
    const dimensions = config.embeddings.dimensions || 
                      (modelName === 'text-embedding-3-large' ? 3072 : 1536);
    
    payload.dimensions = dimensions;
  }
  
  const response = await axios.post(
    apiUrl,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  // Extract embedding vector from response
  return response.data.data[0].embedding;
}

/**
 * Fallback embedding function for when the API is unavailable
 * @param {string} text The text to generate an embedding for
 * @returns {Array<number>} The embedding vector
 */
function fallbackEmbedding(text) {
  logger.warn('Using fallback embedding method - NOT FOR PRODUCTION USE');
  
  // For demonstration purposes, create a deterministic but unique vector
  // based on the hash of the text. This ensures consistent vectors for the same text.
  const hash = crypto.createHash('md5').update(text).digest('hex');
  
  // Convert the hash to a series of numbers to create a vector of the required dimension
  const vector = [];
  for (let i = 0; i < config.embeddings.dimensions; i++) {
    // Use the hash to generate numbers between -1 and 1
    const bytePosition = i % 16; // md5 hash is 16 bytes
    const byte = parseInt(hash.substring(bytePosition * 2, bytePosition * 2 + 2), 16);
    const value = (byte / 255) * 2 - 1; // Convert to range -1 to 1
    vector.push(value);
  }
  
  return vector;
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
 * @param {Array<string>|string} textChunks Array of text chunks or a single text chunk
 * @param {Object} options Batch processing options
 * @param {number} [options.batchSize=10] Number of chunks to process in each batch
 * @param {number} [options.concurrency=2] Number of batches to process concurrently
 * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
 */
async function generateEmbeddingsBatch(textChunks, options = {}) {
  // Handle case where a single string is passed instead of an array
  if (typeof textChunks === 'string') {
    logger.debug('Single text chunk provided to batch function, converting to array');
    const vector = await generateEmbedding(textChunks);
    return [vector];
  }
  
  // Ensure textChunks is an array
  if (!Array.isArray(textChunks)) {
    logger.error('Invalid input to generateEmbeddingsBatch: expected array or string');
    throw new Error('generateEmbeddingsBatch requires an array of text chunks or a single string');
  }
  
  // Auto-calculate optimal batch size based on text length to avoid rate limits
  let batchSize = options.batchSize || 10;
  let concurrency = options.concurrency || 2;
  
  // Adjust batch size and concurrency based on text length
  if (textChunks.length > 0) {
    const avgChunkLength = textChunks.reduce((sum, chunk) => sum + chunk.length, 0) / textChunks.length;
    
    // Reduce batch size for longer text chunks to prevent rate limits
    if (avgChunkLength > 5000) {
      batchSize = Math.min(batchSize, 5);
      concurrency = Math.min(concurrency, 1);
      logger.debug(`Adjusted batch parameters for long chunks: batchSize=${batchSize}, concurrency=${concurrency}`);
    } else if (avgChunkLength < 1000) {
      // Can process more smaller chunks simultaneously
      batchSize = Math.min(20, batchSize);
    }
  }
  
  logger.info(`Generating embeddings for ${textChunks.length} chunks with batch processing`, {
    batchSize,
    concurrency,
    totalChunks: textChunks.length
  });
  
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
    
    // Add a small delay between batch groups to avoid rate limits
    if (i + concurrency < batches.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
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
  generateLocalEmbedding,
  generateEmbeddings,
  generateEmbeddingsBatch,
  calculateSimilarity
}; 