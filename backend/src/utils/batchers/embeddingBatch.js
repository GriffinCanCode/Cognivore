/**
 * Embedding Batch Processor
 * Efficiently generates embeddings for multiple text chunks in batches
 */

const { createContextLogger } = require('../../utils/logger');
const BatchProcessor = require('./batchProcessor');
const embeddingService = require('../../services/embedding');
const config = require('../../config');
const { memoryManager } = require('../../memory');

const logger = createContextLogger('EmbeddingBatch');

/**
 * A text chunk with its associated metadata
 * @typedef {Object} TextChunk
 * @property {string} [documentId] - ID of the source document
 * @property {number} [chunkIndex] - Index of the chunk in the document
 * @property {string} content - The text content to embed
 * @property {Object} [metadata] - Associated metadata
 */

/**
 * An embedded chunk with its vector and metadata
 * @typedef {Object} EmbeddedChunk
 * @property {string} [documentId] - ID of the source document
 * @property {number} [chunkIndex] - Index of the chunk in the document
 * @property {string} content - The original text content
 * @property {Array<number>} embedding - The vector embedding
 * @property {Object} [metadata] - Associated metadata
 */

/**
 * Generate embeddings for multiple chunks in batches
 * @param {Array<TextChunk|string>} chunks - Array of text chunks or strings
 * @param {Object} options - Embedding options
 * @param {boolean} [options.includeContent=true] - Whether to include original content in result
 * @param {boolean} [options.includeMetadata=true] - Whether to include metadata in result 
 * @param {Object} batchOptions - Batch processing options
 * @returns {Promise<Array<EmbeddedChunk>>} - Chunks with embeddings
 */
async function batchGenerateEmbeddings(chunks, options = {}, batchOptions = {}) {
  if (!chunks || !Array.isArray(chunks)) {
    logger.error('Invalid chunks provided', { chunks });
    throw new Error('Chunks must be an array');
  }

  const {
    includeContent = true,
    includeMetadata = true
  } = options;

  logger.info(`Starting batch embedding of ${chunks.length} chunks`, {
    batchSize: batchOptions.batchSize || 10,
    includeContent,
    includeMetadata
  });

  // Normalize chunks to objects if they are strings
  const normalizedChunks = chunks.map((chunk, index) => {
    if (typeof chunk === 'string') {
      return {
        chunkIndex: index,
        content: chunk
      };
    }
    return chunk;
  });

  const processor = new BatchProcessor({
    batchSize: batchOptions.batchSize || 10,
    concurrency: batchOptions.concurrency || 2,
    delayBetweenBatches: batchOptions.delayBetweenBatches || 0,
    failFast: batchOptions.failFast || false,
    dynamicBatchSize: batchOptions.dynamicBatchSize || false,
    memoryMonitoring: batchOptions.memoryMonitoring || false,
    targetBatchSizeMB: batchOptions.targetBatchSizeMB || 10,
    maxBatchSize: batchOptions.maxBatchSize || 50,
    minBatchSize: batchOptions.minBatchSize || 1
  });

  // Set up event listeners for monitoring
  processor.on('batchStart', (data) => {
    logger.debug(`Starting embedding batch ${data.batchIndex + 1}/${data.totalBatches}`, {
      chunks: data.items.length
    });
  });

  processor.on('batchComplete', (data) => {
    logger.debug(`Completed embedding batch ${data.batchIndex + 1}/${data.totalBatches}`, {
      progress: Math.round(data.progress * 100) + '%'
    });
  });

  // Process each batch of chunks
  const embeddedChunks = await processor.process(normalizedChunks, async (chunkBatch) => {
    return Promise.all(chunkBatch.map(chunk => processChunk(chunk, { includeContent, includeMetadata })));
  });

  logger.info(`Completed embedding for ${embeddedChunks.length} chunks`);
  return embeddedChunks;
}

/**
 * Process a single chunk to generate its embedding
 * @param {TextChunk} chunk - The chunk to process
 * @param {Object} options - Processing options
 * @returns {Promise<EmbeddedChunk>} - The chunk with its embedding
 */
async function processChunk(chunk, options = {}) {
  const { includeContent = true, includeMetadata = true } = options;
  
  try {
    // Use generateEmbedding for single chunks instead of generateEmbeddingsBatch
    const embedding = await embeddingService.generateEmbedding(chunk.content);
    
    const result = {
      embedding
    };
    
    // Include original content if requested
    if (includeContent) {
      result.content = chunk.content;
    }
    
    // Include metadata fields if available and requested
    if (includeMetadata) {
      if (chunk.documentId) result.documentId = chunk.documentId;
      if (chunk.chunkIndex !== undefined) result.chunkIndex = chunk.chunkIndex;
      if (chunk.metadata) result.metadata = { ...chunk.metadata };
    }
    
    return result;
  } catch (error) {
    logger.error('Error generating embedding for chunk', {
      error: error.message,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex
    });
    throw error;
  }
}

/**
 * Generate embeddings for chunks and batch store them
 * @param {Array<TextChunk|string>} chunks - Text chunks to process
 * @param {Function} storeFn - Function to store embeddings (takes array of embeddings)
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Results of the store operation
 */
async function batchEmbedAndStore(chunks, storeFn, options = {}) {
  if (typeof storeFn !== 'function') {
    throw new Error('Store function must be a function');
  }

  const embeddingOptions = {
    includeContent: options.includeContent !== false,
    includeMetadata: options.includeMetadata !== false
  };

  const batchOptions = {
    batchSize: options.batchSize || 10,
    concurrency: options.concurrency || 2,
    delayBetweenBatches: options.delayBetweenBatches || 0,
    failFast: options.failFast || false
  };

  logger.info(`Starting batch embed and store for ${chunks.length} chunks`);

  // Create batch processor for storage operations
  const storeProcessor = new BatchProcessor({
    batchSize: options.storeBatchSize || 50,
    concurrency: options.storeConcurrency || 1,
    failFast: options.failFast || false
  });

  // Generate all embeddings first
  const embeddedChunks = await batchGenerateEmbeddings(
    chunks, 
    embeddingOptions, 
    batchOptions
  );

  // Then batch store them
  logger.info(`Storing ${embeddedChunks.length} embeddings in batches`);
  
  const results = await storeProcessor.process(embeddedChunks, async (batch) => {
    return await storeFn(batch);
  });

  logger.info(`Completed storing ${embeddedChunks.length} embeddings`);
  return results;
}

/**
 * Process text chunks in batches for embedding generation
 * 
 * @param {Array<string>} chunks Array of text chunks to process
 * @param {Object} options Batch processing options
 * @param {number} [options.batchSize=5] Maximum number of chunks to process in each batch
 * @param {number} [options.concurrency=1] Number of batches to process in parallel
 * @param {number} [options.maxRetries=3] Maximum number of retries for failed requests
 * @param {number} [options.maxQueueSize=100] Maximum number of pending batches
 * @param {boolean} [options.skipCache=false] Whether to skip the embedding cache
 * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
 */
async function processBatches(chunks, options = {}) {
  // Default options
  const config = {
    batchSize: options.batchSize || 5,
    concurrency: options.concurrency || 1,
    maxRetries: options.maxRetries || 3,
    maxQueueSize: options.maxQueueSize || 100,
    skipCache: options.skipCache || false,
    timeout: options.timeout || 60000, // 1 minute timeout
    delayBetweenBatches: options.delayBetweenBatches || 1000 // 1 second delay between batch groups
  };
  
  // Estimate average chunk size to dynamically adjust batch parameters
  if (chunks.length > 0) {
    const avgChunkSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length;
    logger.debug(`Average chunk size: ${avgChunkSize} characters`);
    
    // Auto-adjust parameters for very large chunks
    if (avgChunkSize > 5000) {
      config.batchSize = Math.min(config.batchSize, 3);
      config.concurrency = 1;
      config.delayBetweenBatches = 2000;
      logger.info(`Adjusted batch parameters for large chunks: batchSize=${config.batchSize}, concurrency=${config.concurrency}`);
    }
  }
  
  logger.info(`Processing ${chunks.length} chunks for embedding generation`, {
    batchSize: config.batchSize,
    concurrency: config.concurrency,
    maxRetries: config.maxRetries
  });
  
  // Create batches
  const batches = [];
  for (let i = 0; i < chunks.length; i += config.batchSize) {
    batches.push(chunks.slice(i, i + config.batchSize));
  }
  
  logger.debug(`Created ${batches.length} batches for processing`);
  
  // Process batches with rate limiting
  const results = [];
  const errors = [];
  
  // Track memory usage
  const memBefore = memoryManager.monitorMemory();
  logger.debug(`Memory before batch processing: ${memBefore.heapUsedMB}MB`);
  
  // Process batches
  for (let i = 0; i < batches.length; i += config.concurrency) {
    const currentBatchGroup = batches.slice(i, i + config.concurrency);
    const batchGroupIndex = Math.floor(i / config.concurrency) + 1;
    const totalBatchGroups = Math.ceil(batches.length / config.concurrency);
    
    logger.debug(`Processing batch group ${batchGroupIndex}/${totalBatchGroups} (${currentBatchGroup.length} batches)`);
    
    try {
      // Process batches in this group concurrently, but with a timeout
      const batchPromises = currentBatchGroup.map(async (batch, batchIndex) => {
        try {
          // Use the embeddingService's batch function for multiple chunks
          const batchResults = await Promise.race([
            embeddingService.generateEmbeddingsBatch(batch),
            
            // Timeout promise
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Batch ${batchIndex} timed out after ${config.timeout}ms`)), 
              config.timeout)
            )
          ]);
          
          return batchResults;
        } catch (error) {
          logger.error(`Error processing batch ${batchIndex} in group ${batchGroupIndex}:`, {
            error: error.message,
            chunksCount: batch.length
          });
          
          errors.push({
            batchIndex: i + batchIndex,
            error: error.message,
            chunksCount: batch.length
          });
          
          // Return zero vectors for this batch as fallback
          return batch.map(() => new Array(768).fill(0));
        }
      });
      
      // Wait for all batches in this group to complete
      const batchGroupResults = await Promise.all(batchPromises);
      
      // Flatten and add to results
      batchGroupResults.forEach(batchResult => {
        results.push(...batchResult);
      });
      
      // Check memory usage after each batch group
      const memAfter = memoryManager.monitorMemory();
      
      if (memAfter.heapUsedRatio > 0.7) {
        logger.warn(`High memory usage detected: ${memAfter.heapUsedMB}MB (${Math.round(memAfter.heapUsedRatio * 100)}%)`);
        
        // Force garbage collection if available
        if (global.gc) {
          logger.debug('Requesting garbage collection');
          global.gc();
        }
      }
      
      // Add delay between batch groups to respect rate limits
      if (i + config.concurrency < batches.length) {
        logger.debug(`Waiting ${config.delayBetweenBatches}ms before next batch group`);
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenBatches));
      }
      
    } catch (groupError) {
      logger.error(`Error processing batch group ${batchGroupIndex}:`, {
        error: groupError.message
      });
      
      // Add brief delay for recovery
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Final memory check
  const memAfter = memoryManager.monitorMemory();
  logger.debug(`Memory after batch processing: ${memAfter.heapUsedMB}MB (${Math.round(memAfter.heapUsedRatio * 100)}%)`);
  
  // Log error summary if any occurred
  if (errors.length > 0) {
    logger.warn(`Completed with ${errors.length} batch errors out of ${batches.length} batches`);
  } else {
    logger.info(`Successfully processed all ${batches.length} batches`);
  }
  
  // Validate results
  if (results.length !== chunks.length) {
    logger.warn(`Result count mismatch: expected ${chunks.length}, got ${results.length}`);
    
    // Pad with zero vectors if necessary to match input
    while (results.length < chunks.length) {
      results.push(new Array(768).fill(0));
    }
    
    // Trim if somehow we got more results than expected
    if (results.length > chunks.length) {
      results.splice(chunks.length);
    }
  }
  
  return results;
}

module.exports = {
  batchGenerateEmbeddings,
  processChunk,
  batchEmbedAndStore,
  processBatches
}; 