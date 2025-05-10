/**
 * Batch Processor Utility
 * Generic utility for processing items in batches with configurable concurrency
 */

const EventEmitter = require('events');
const { createContextLogger } = require('../logger');
const { 
  memoryManager, 
  batchOptimizer, 
  heapAnalyzer 
} = require('../../memory');

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
   * @param {boolean} [options.autoOptimize=false] Whether to auto-optimize batch sizes based on memory
   * @param {boolean} [options.detectMemoryIssues=false] Whether to detect and report memory issues
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
    this.autoOptimize = options.autoOptimize || false;
    this.detectMemoryIssues = options.detectMemoryIssues || false;
    this.logger = createContextLogger('BatchProcessor');
    
    // Process name for tracking purposes
    this.processName = options.processName || 'batch_process';
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

    // When using auto-optimize, use the batch optimizer from memory management
    let effectiveBatchSize = this.batchSize;
    
    if (this.autoOptimize && items.length > 0) {
      // Use more sophisticated batch optimizer with memory constraints
      effectiveBatchSize = batchOptimizer.calculateOptimalBatchSize(items, {
        operation: this.processName,
        aggressiveOptimization: this.memoryMonitoring
      });
    }
    // When using dynamic batch sizing, use simpler memory manager calculation
    else if (this.dynamicBatchSize && items.length > 0) {
      effectiveBatchSize = memoryManager.calculateOptimalBatchSize(items, {
        maxBatchSize: this.maxBatchSize,
        minBatchSize: this.minBatchSize,
        targetBatchSizeMB: this.targetBatchSizeMB
      });
    }
    
    this.logger.info(`Starting batch processing of ${items.length} items`, {
      batchSize: effectiveBatchSize,
      concurrency: this.concurrency,
      totalItems: items.length
    });

    // Log initial memory usage if monitoring is enabled
    if (this.memoryMonitoring) {
      const memoryBefore = memoryManager.getCurrentMemoryUsage();
      this.logger.info('Memory usage before processing', memoryBefore);
      
      // Detect memory issues if enabled
      if (this.detectMemoryIssues) {
        const analysis = heapAnalyzer.analyzeHeap();
        if (analysis.issues.length > 0) {
          this.logger.warn('Memory issues detected before batch processing', {
            issues: analysis.issues.map(i => i.message).join('; ')
          });
          
          this.emit('memoryIssues', analysis);
        }
      }
    }

    // Create batches
    const batches = [];
    for (let i = 0; i < items.length; i += effectiveBatchSize) {
      batches.push(items.slice(i, i + effectiveBatchSize));
    }

    this.logger.debug(`Created ${batches.length} batches`);
    
    // Optimize the process function if using autoOptimize
    let optimizedProcessFn = processFn;
    if (this.autoOptimize) {
      optimizedProcessFn = batchOptimizer.optimizeProcessFunction(processFn, {
        operation: this.processName, 
        monitored: this.memoryMonitoring
      });
    }
    
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
              memoryBefore = memoryManager.getCurrentMemoryUsage();
              this.logger.debug(`Memory before batch ${actualBatchIndex + 1}`, memoryBefore);
            }
            
            const batchResults = await optimizedProcessFn(batch);
            
            // Monitor memory after processing this batch
            if (this.memoryMonitoring) {
              const memoryAfter = memoryManager.getCurrentMemoryUsage();
              const memoryDiff = {
                heapUsedDiffMB: parseFloat(memoryAfter.heapUsedMB) - parseFloat(memoryBefore.heapUsedMB),
                rssDiffMB: parseFloat(memoryAfter.rssMB) - parseFloat(memoryBefore.rssMB)
              };
              
              this.logger.debug(`Memory after batch ${actualBatchIndex + 1}`, {
                ...memoryAfter,
                diff: memoryDiff
              });
              
              // Detect potential memory issues during processing
              if (memoryDiff.heapUsedDiffMB > 50) { // More than 50MB growth in a single batch
                this.logger.warn(`High memory growth detected in batch ${actualBatchIndex + 1}`, {
                  growthMB: memoryDiff.heapUsedDiffMB.toFixed(2)
                });
                
                // Try to reclaim memory if we're seeing high growth
                memoryManager.tryForceGC();
              }
            }
            
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
        
        // Monitor memory and try GC between batches if memory is getting high
        if (this.memoryMonitoring) {
          const currentMemory = memoryManager.monitorMemory();
          const memUsagePercent = (currentMemory.heapUsed / currentMemory.heapTotal) * 100;
          
          if (memUsagePercent > 80) {
            this.logger.warn('High memory usage detected during batch processing', {
              usagePercent: memUsagePercent.toFixed(1) + '%',
              heapUsedMB: currentMemory.heapUsedMB
            });
            
            // Force GC for high memory usage
            memoryManager.tryForceGC();
          }
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
    
    // Log final memory usage if monitoring is enabled
    if (this.memoryMonitoring) {
      const memoryAfter = memoryManager.getCurrentMemoryUsage();
      this.logger.info('Memory usage after processing', memoryAfter);
      
      // Get batch statistics if autoOptimize was used
      if (this.autoOptimize) {
        const stats = batchOptimizer.getBatchStatistics();
        if (stats.recommendations.length > 0) {
          this.logger.info('Batch processing recommendations', {
            recommendations: stats.recommendations
          });
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