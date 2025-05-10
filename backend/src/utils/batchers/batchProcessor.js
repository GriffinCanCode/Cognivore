/**
 * Batch Processor Utility
 * Generic utility for processing items in batches with configurable concurrency
 */

const EventEmitter = require('events');
const { createContextLogger } = require('../../utils/logger');
const logger = createContextLogger('BatchProcessor');

class BatchProcessor extends EventEmitter {
  /**
   * Create a new batch processor
   * @param {Object} options Configuration options
   * @param {number} [options.batchSize=10] Number of items to process in each batch
   * @param {number} [options.concurrency=2] Number of batches to process concurrently
   * @param {number} [options.delayBetweenBatches=0] Delay in ms between batches
   * @param {boolean} [options.failFast=false] Whether to stop on first error
   */
  constructor(options = {}) {
    super();
    this.batchSize = options.batchSize || 10;
    this.concurrency = options.concurrency || 2;
    this.delayBetweenBatches = options.delayBetweenBatches || 0;
    this.failFast = options.failFast || false;
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

    this.logger.info(`Starting batch processing of ${items.length} items`, {
      batchSize: this.batchSize,
      concurrency: this.concurrency,
      totalItems: items.length
    });

    // Create batches
    const batches = [];
    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize));
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
            
            const batchResults = await processFn(batch);
            
            completedBatches++;
            this.emit('batchComplete', { 
              batchIndex: actualBatchIndex, 
              totalBatches: batches.length, 
              progress: completedBatches / batches.length 
            });
            
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