/**
 * Document Processor Utility
 * Provides end-to-end document processing with chunking and embedding
 */

const { createDocumentProcessor } = require('./processorFactory');

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
 * @param {Function} [storeFunction] Optional function to store embeddings
 * @returns {Promise<Object>} Processing results
 */
async function processDocuments(documents, options = {}, storeFunction = null) {
  // Create a document processor with the provided options
  const processor = createDocumentProcessor(options);
  
  // Process the documents
  return processor.processDocuments(documents, storeFunction);
}

module.exports = {
  processDocuments
}; 