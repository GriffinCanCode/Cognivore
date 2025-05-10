/**
 * Document Processor Utility
 * Provides end-to-end document processing with chunking and embedding
 */

const { createDocumentProcessor } = require('./processorFactory');
const { memoryManager, heapAnalyzer } = require('../../memory');
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
 * @param {boolean} [options.batch.autoOptimize=false] Use memory-optimized batch processing
 * @param {boolean} [options.batch.memoryMonitoring=false] Monitor memory usage
 * @param {Object} [options.memory] Memory management options
 * @param {boolean} [options.memory.detectMemoryIssues=false] Detect memory issues during processing
 * @param {boolean} [options.memory.forceGCOnCompletion=false] Force garbage collection after processing
 * @param {Function} [storeFunction] Optional function to store embeddings
 * @returns {Promise<Object>} Processing results
 */
async function processDocuments(documents, options = {}, storeFunction = null) {
  // Log initial memory state
  const initialMemory = memoryManager.getCurrentMemoryUsage();
  logger.debug('Initial memory state before document processing', initialMemory);
  
  // Extract memory options or use defaults
  const memoryOptions = options.memory || {};
  const detectMemoryIssues = memoryOptions.detectMemoryIssues || false;
  const forceGCOnCompletion = memoryOptions.forceGCOnCompletion || false;
  
  // Check for potential memory issues before processing
  if (detectMemoryIssues) {
    const preAnalysis = heapAnalyzer.analyzeHeap();
    if (preAnalysis.issues.length > 0) {
      logger.warn('Memory issues detected before document processing', {
        issues: preAnalysis.issues.map(i => i.message).join('; ')
      });
      
      // If we're detecting severe memory issues, try to mitigate
      const severeIssues = preAnalysis.issues.filter(i => i.severity === 'high');
      if (severeIssues.length > 0) {
        logger.warn('Attempting to mitigate severe memory issues');
        memoryManager.tryForceGC();
        
        // Enable auto-optimization if not already enabled
        if (!options.batch) options.batch = {};
        options.batch.autoOptimize = true;
        options.batch.memoryMonitoring = true;
      }
    }
  }
  
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
    options.batch.autoOptimize = true;
    options.batch.memoryMonitoring = true;
    options.batch.processName = 'document_processing';
    
    // Add memory-specific batch processor options
    options.batch.detectMemoryIssues = detectMemoryIssues;
  }
  
  // Create a document processor with the provided options
  const processor = createDocumentProcessor(options);
  
  try {
    // Process the documents
    const result = await processor.processDocuments(documents, storeFunction);
    
    // Force garbage collection if requested
    if (forceGCOnCompletion) {
      memoryManager.tryForceGC();
    }
    
    // Log final memory state
    const finalMemory = memoryManager.getCurrentMemoryUsage();
    logger.debug('Final memory state after document processing', {
      ...finalMemory,
      diffMB: {
        heapUsed: (parseFloat(finalMemory.heapUsedMB) - parseFloat(initialMemory.heapUsedMB)).toFixed(2),
        rss: (parseFloat(finalMemory.rssMB) - parseFloat(initialMemory.rssMB)).toFixed(2)
      }
    });
    
    // Check for memory issues after processing
    if (detectMemoryIssues) {
      const postAnalysis = heapAnalyzer.analyzeHeap();
      
      // If memory usage is significantly higher after processing, might indicate a leak
      if (postAnalysis.issues.some(i => i.type === 'potential_leak')) {
        logger.warn('Potential memory leak detected after document processing', {
          recommendations: postAnalysis.recommends.map(r => r.message).join('; ')
        });
      }
    }
    
    return result;
  } catch (error) {
    logger.error('Error in document processing', {
      error: error.message,
      stack: error.stack
    });
    
    // Try to recover memory on error
    memoryManager.tryForceGC();
    
    throw error;
  }
}

module.exports = {
  processDocuments
}; 