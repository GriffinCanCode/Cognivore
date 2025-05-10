/**
 * Batch Processor Utility
 * Generic utility for processing items in batches with configurable concurrency
 */

const EventEmitter = require('events');
const { createContextLogger } = require('../../utils/logger');
const { calculateOptimalBatchSize, getCurrentMemoryUsage, tryForceGC } = require('../../memory/memoryManager');
const logger = createContextLogger('BatchProcessor');

class BatchProcessor extends EventEmitter {
  /**
   * Create a new batch processor
   * @param {Object} options Configuration options
   * @param {number} [options.batchSize=10] Number of items to process in each batch
   * @param {number} [options.concurrency=2] Number of batches to process concurrently
   * @param {number} [options.delayBetweenBatches=0] Delay in ms between batches
   * @param {boolean} [options.failFast=false] Whether to stop on first error
   * @param {boolean} [options.dynamicBatchSize=false] Whether to dynamically adjust batch size
   * @param {number} [options.maxBatchSize=50] Maximum batch size when using dynamic sizing
   * @param {number} [options.minBatchSize=1] Minimum batch size when using dynamic sizing
   * @param {number} [options.targetBatchSizeMB=10] Target memory footprint per batch in MB
   * @param {boolean} [options.memoryMonitoring=false] Whether to log memory usage
   */
  constructor(options = {}) {
    super();
    this.batchSize = options.batchSize || 10;
    this.concurrency = options.concurrency || 2;
    this.delayBetweenBatches = options.delayBetweenBatches || 0;
    this.failFast = options.failFast || false;
    this.dynamicBatchSize = options.dynamicBatchSize || false;
    this.maxBatchSize = options.maxBatchSize || 50;
    this.minBatchSize = options.minBatchSize || 1;
    this.targetBatchSizeMB = options.targetBatchSizeMB || 10;
    this.memoryMonitoring = options.memoryMonitoring || false;
    this.logger = createContextLogger('BatchProcessor');
  }

  /**
   * Process an array of items in batches
   * @param {Array<any>} items Items to process
   * @param {Function} processFn Processing function that takes an array of items and returns a Promise
   * @returns {Promise<Array<any>>} Processed results
   */
  async process(items, processFn) {
    if (!items || !Array.isArray(items)) {
      this.logger.error('Invalid items provided to batch processor', { items });
      throw new Error('Items must be an array');
    }

    if (!processFn || typeof processFn !== 'function') {
      this.logger.error('Invalid process function provided to batch processor');
      throw new Error('Process function must be a function');
    }

    // When using dynamic batch sizing, calculate optimal size
    let effectiveBatchSize = this.batchSize;
    if (this.dynamicBatchSize && items.length > 0) {
      effectiveBatchSize = calculateOptimalBatchSize(items, {
        maxBatchSize: this.maxBatchSize,
        minBatchSize: this.minBatchSize,
        targetBatchSizeMB: this.targetBatchSizeMB
      });
      
      this.logger.info(`Using dynamically calculated batch size: ${effectiveBatchSize}`, {
        originalBatchSize: this.batchSize,
        itemCount: items.length
      });
    }

    this.logger.info(`Starting batch processing of ${items.length} items`, {
      batchSize: effectiveBatchSize,
      concurrency: this.concurrency,
      totalItems: items.length
    });

    // Log initial memory usage if monitoring is enabled
    if (this.memoryMonitoring) {
      const memoryBefore = getCurrentMemoryUsage();
      this.logger.info('Memory usage before processing', memoryBefore);
    }

    // Create batches
    const batches = [];
    for (let i = 0; i < items.length; i += effectiveBatchSize) {
      batches.push(items.slice(i, i + effectiveBatchSize));
    }

    this.logger.debug(`Created ${batches.length} batches`);
    
    // Process batches with limited concurrency
    const results = [];
    const errors = [];
    let completedBatches = 0;

    for (let i = 0; i < batches.length; i += this.concurrency) {
      const currentBatches = batches.slice(i, i + this.concurrency);
      
      try {
        const batchPromises = currentBatches.map(async (batch, batchIndex) => {
          const actualBatchIndex = i + batchIndex;
          try {
            this.logger.debug(`Processing batch ${actualBatchIndex + 1}/${batches.length}`, {
              batchSize: batch.length
            });
            
            this.emit('batchStart', { 
              batchIndex: actualBatchIndex, 
              totalBatches: batches.length, 
              items: batch 
            });
            
            // Monitor memory before processing this batch
            let memoryBefore;
            if (this.memoryMonitoring) {
              memoryBefore = getCurrentMemoryUsage();
              this.logger.debug(`Memory before batch ${actualBatchIndex + 1}`, memoryBefore);
            }
            
            const batchResults = await processFn(batch);
            
            // Monitor memory after processing this batch
            if (this.memoryMonitoring) {
              const memoryAfter = getCurrentMemoryUsage();
              const memoryDiff = {
                heapUsedDiffMB: (memoryAfter.heapUsed - memoryBefore.heapUsed) / (1024 * 1024),
                rssDiffMB: (memoryAfter.rss - memoryBefore.rss) / (1024 * 1024)
              };
              this.logger.debug(`Memory after batch ${actualBatchIndex + 1}`, {
                ...memoryAfter,
                diff: memoryDiff
              });
            }
            
            completedBatches++;
            this.emit('batchComplete', { 
              batchIndex: actualBatchIndex, 
              totalBatches: batches.length, 
              progress: completedBatches / batches.length 
            });
            
            // Try to force garbage collection after large batches
            if (batch.length > 10) {
              tryForceGC();
            }
            
            return batchResults;
          } catch (error) {
            this.logger.error(`Error processing batch ${actualBatchIndex + 1}`, {
              error: error.message,
              stack: error.stack,
              batchIndex: actualBatchIndex
            });
            
            errors.push({
              batchIndex: actualBatchIndex,
              error
            });
            
            this.emit('batchError', { 
              batchIndex: actualBatchIndex, 
              error 
            });
            
            if (this.failFast) {
              throw error;
            }
            
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Flatten and add results, filtering out null results from errors
        batchResults.forEach(result => {
          if (result) {
            if (Array.isArray(result)) {
              results.push(...result);
            } else {
              results.push(result);
            }
          }
        });
        
        // Add delay between batches if specified
        if (this.delayBetweenBatches > 0 && i + this.concurrency < batches.length) {
          await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
        }
        
        // Try to force garbage collection between batch sets
        tryForceGC();
        
      } catch (error) {
        if (this.failFast) {
          this.logger.error('Batch processing stopped due to error (failFast=true)', {
            error: error.message,
            stack: error.stack
          });
          
          this.emit('processingAborted', { error });
          throw error;
        }
      }
    }
    
    // Log final memory usage if monitoring is enabled
    if (this.memoryMonitoring) {
      const memoryAfter = getCurrentMemoryUsage();
      this.logger.info('Memory usage after processing', memoryAfter);
    }
    
    this.logger.info(`Completed batch processing with ${errors.length} errors`, {
      processedItems: results.length,
      errors: errors.length
    });
    
    this.emit('processingComplete', { 
      results, 
      errors, 
      totalProcessed: results.length,
      totalErrors: errors.length
    });
    
    return results;
  }
}

module.exports = BatchProcessor; 