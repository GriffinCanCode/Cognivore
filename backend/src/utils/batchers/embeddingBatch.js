/**
 * Embedding Batch Processor
 * Efficiently generates embeddings for multiple text chunks in batches
 */

const { createContextLogger } = require('../../utils/logger');
const BatchProcessor = require('./batchProcessor');
const { generateEmbedding } = require('../../services/embedding');
const config = require('../../config');

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
    const embedding = await generateEmbedding(chunk.content);
    
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

module.exports = {
  batchGenerateEmbeddings,
  processChunk,
  batchEmbedAndStore
}; 