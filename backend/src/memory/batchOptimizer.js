/**
 * Batch Optimizer for Memory-Efficient Embedding Operations
 * Provides methods to process large embedding tasks with optimal memory usage
 */

const { createContextLogger } = require('../utils/logger');
const { memoryManager } = require('./memoryManager');
const { dbMemoryManager } = require('./dbMemoryManager');
const logger = createContextLogger('BatchOptimizer');

/**
 * Process a large collection of items in memory-efficient batches
 * with automatic handling of memory pressure
 * 
 * @param {Array<any>} items Array of items to process
 * @param {Function} processFn Async function that processes a batch of items
 * @param {Object} options Configuration options
 * @param {number} [options.maxBatchSize=50] Maximum items per batch
 * @param {number} [options.minBatchSize=1] Minimum items per batch
 * @param {number} [options.delay=0] Delay between batches in ms
 * @param {string} [options.operationType='default'] Type of operation for logging
 * @param {boolean} [options.isEmbedding=false] Whether this is an embedding operation
 * @param {Function} [options.onProgress] Progress callback function
 * @param {Function} [options.shouldContinue] Function that returns whether to continue processing
 * @returns {Promise<Array<any>>} Combined results from all batches
 */
async function processInBatches(items, processFn, options = {}) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }
  
  if (typeof processFn !== 'function') {
    throw new Error('Process function must be a function');
  }
  
  const {
    maxBatchSize = 50,
    minBatchSize = 1,
    delay = 0,
    operationType = 'default',
    isEmbedding = false,
    onProgress = null,
    shouldContinue = () => true
  } = options;
  
  logger.info(`Starting batch processing of ${items.length} items (${operationType})`);
  
  // Track the batch operation
  const batchTracker = memoryManager.trackBatch({
    type: operationType,
    size: items.length
  });
  
  try {
    const results = [];
    let processedCount = 0;
    let currentIndex = 0;
    
    while (currentIndex < items.length) {
      // Check if we should continue processing
      if (!shouldContinue()) {
        logger.info(`Batch processing stopped by continue check at ${processedCount}/${items.length} items`);
        break;
      }
      
      // Get memory-optimized batch size based on current conditions
      const batchSize = memoryManager.calculateOptimalBatchSize(
        items.slice(currentIndex),
        { 
          maxBatchSize, 
          minBatchSize,
          isEmbedding,
          targetBatchSizeMB: isEmbedding ? 5 : 10 // Use smaller target size for embeddings
        }
      );
      
      // Extract the current batch
      const endIndex = Math.min(currentIndex + batchSize, items.length);
      const batch = items.slice(currentIndex, endIndex);
      
      // Process the batch
      logger.debug(`Processing batch ${processedCount}/${items.length} with size ${batch.length}`);
      
      try {
        // Check if system is under memory pressure
        if (dbMemoryManager.isUnderMemoryPressure() || memoryManager.isUnderMemoryPressure()) {
          logger.warn(`Memory pressure detected, pausing before next batch`);
          
          // Clear any caches
          dbMemoryManager.clearQueryCache();
          
          // Force garbage collection with delay
          await new Promise(resolve => {
            memoryManager.tryForceGC({force: true});
            setTimeout(() => {
              memoryManager.tryForceGC({force: true});
              resolve();
            }, 1000);
          });
          
          // Additional delay when under memory pressure
          if (delay < 500) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Process the batch
        const batchResults = await processFn(batch, {
          batchIndex: processedCount,
          totalBatches: Math.ceil(items.length / batchSize),
          isLastBatch: endIndex >= items.length
        });
        
        // Add batch results to overall results
        if (Array.isArray(batchResults)) {
          results.push(...batchResults);
        } else if (batchResults !== undefined && batchResults !== null) {
          results.push(batchResults);
        }
        
        // Update progress
        processedCount += batch.length;
        currentIndex = endIndex;
        
        // Call progress callback if provided
        if (typeof onProgress === 'function') {
          onProgress(processedCount, items.length);
        }
        
        // Add delay between batches if specified
        if (delay > 0 && currentIndex < items.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Monitor memory after each batch
        memoryManager.monitorMemory();
        
      } catch (error) {
        logger.error(`Error processing batch at index ${currentIndex}:`, error);
        throw error; // Re-throw to be caught by the outer try/catch
      }
    }
    
    logger.info(`Completed batch processing ${processedCount}/${items.length} items`);
    return results;
    
  } finally {
    // Release the batch tracker
    batchTracker.release();
  }
}

/**
 * Optimized function specifically for embedding text documents
 * 
 * @param {Array<any>} documents Documents to embed
 * @param {Function} embedFn Function that creates embeddings for a batch
 * @param {Object} options Configuration options
 * @returns {Promise<Array<any>>} Documents with embeddings
 */
async function embedDocumentsInBatches(documents, embedFn, options = {}) {
  return processInBatches(documents, embedFn, {
    ...options,
    operationType: 'embedding',
    isEmbedding: true,
    maxBatchSize: options.maxBatchSize || 20,
    minBatchSize: options.minBatchSize || 1,
    delay: options.delay || 200 // Add small delay between embedding batches
  });
}

module.exports = {
  processInBatches,
  embedDocumentsInBatches
}; 