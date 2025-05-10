/**
 * Document Processor Utility
 * Provides end-to-end document processing with chunking and embedding
 */

const { createDocumentProcessor } = require('./processorFactory');
const { getCurrentMemoryUsage } = require('../../memory/memoryManager');
const { createContextLogger } = require('../logger');

const logger = createContextLogger('DocumentProcessor');

/**
 * Process documents through the complete pipeline:
 * 1. Chunk documents
 * 2. Generate embeddings
 * 3. Optionally store in a vector database
 * 
 * @param {Array<Object>} documents Documents to process
 * @param {Object} options Configuration options
 * @param {Object} [options.chunking] Chunking options
 * @param {string} [options.chunking.strategy='characters'] Chunking strategy
 * @param {number} [options.chunking.chunkSize] Size of chunks
 * @param {number} [options.chunking.chunkOverlap] Overlap between chunks
 * @param {Object} [options.embedding] Embedding options
 * @param {boolean} [options.embedding.includeContent=true] Include content in embeddings
 * @param {boolean} [options.embedding.includeMetadata=true] Include metadata
 * @param {Object} [options.batch] Batch processing options
 * @param {number} [options.batch.documentBatchSize=5] Documents per batch
 * @param {number} [options.batch.chunkBatchSize=10] Chunks per batch
 * @param {number} [options.batch.concurrency=2] Concurrent batches
 * @param {boolean} [options.batch.dynamicBatchSize=false] Use dynamic batch sizing
 * @param {boolean} [options.batch.memoryMonitoring=false] Monitor memory usage
 * @param {Function} [storeFunction] Optional function to store embeddings
 * @returns {Promise<Object>} Processing results
 */
async function processDocuments(documents, options = {}, storeFunction = null) {
  // Log initial memory state
  const initialMemory = getCurrentMemoryUsage();
  logger.debug('Initial memory state before document processing', initialMemory);
  
  // Enable memory optimization features if documents are large
  const totalDocSize = documents.reduce((sum, doc) => sum + (doc.text?.length || 0), 0);
  const avgDocSize = totalDocSize / documents.length;
  
  if (avgDocSize > 50000 || totalDocSize > 1000000) {
    logger.info('Large document set detected, enabling memory optimization features', {
      documentCount: documents.length,
      avgDocSizeKB: (avgDocSize / 1024).toFixed(2),
      totalDocSizeMB: (totalDocSize / 1024 / 1024).toFixed(2)
    });
    
    // Auto-enable memory optimization for large documents
    if (!options.batch) options.batch = {};
    options.batch.dynamicBatchSize = true;
    options.batch.memoryMonitoring = true;
  }
  
  // Create a document processor with the provided options
  const processor = createDocumentProcessor(options);
  
  try {
    // Process the documents
    const result = await processor.processDocuments(documents, storeFunction);
    
    // Log final memory state
    const finalMemory = getCurrentMemoryUsage();
    logger.debug('Final memory state after document processing', {
      ...finalMemory,
      diffMB: {
        heapUsed: ((finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024)).toFixed(2),
        rss: ((finalMemory.rss - initialMemory.rss) / (1024 * 1024)).toFixed(2)
      }
    });
    
    return result;
  } catch (error) {
    logger.error('Error in document processing', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

module.exports = {
  processDocuments
}; 