/**
 * Batch Optimizer Module
 * Provides adaptive batch sizing and memory optimization for batch operations
 */

const { createContextLogger } = require('../utils/logger');
const { memoryManager } = require('./memoryManager');
const { heapAnalyzer } = require('./heapAnalyzer');
const logger = createContextLogger('BatchOptimizer');

/**
 * Optimizes batch processing operations based on memory constraints
 */
class BatchOptimizer {
  /**
   * Create a new BatchOptimizer instance
   * @param {Object} options Configuration options
   * @param {number} [options.defaultBatchSize=10] Default batch size when no optimization is needed
   * @param {number} [options.maxBatchSize=100] Maximum allowed batch size
   * @param {number} [options.minBatchSize=1] Minimum allowed batch size
   * @param {number} [options.targetUtilizationPct=70] Target memory utilization percentage
   * @param {boolean} [options.autoAdjust=true] Whether to automatically adjust batch sizes
   * @param {boolean} [options.preProcessGC=false] Whether to force GC before large batch operations
   * @param {boolean} [options.debug=false] Enable debug logging
   */
  constructor(options = {}) {
    this.options = {
      defaultBatchSize: options.defaultBatchSize || 10,
      maxBatchSize: options.maxBatchSize || 100,
      minBatchSize: options.minBatchSize || 1,
      targetUtilizationPct: options.targetUtilizationPct || 70,
      autoAdjust: options.autoAdjust !== undefined ? options.autoAdjust : true,
      preProcessGC: options.preProcessGC || false,
      debug: options.debug || false
    };
    
    this.logger = createContextLogger('BatchOptimizer');
    this._lastBatchSizes = [];
    this._itemSizeCache = new Map();
  }

  /**
   * Calculate the optimal batch size based on memory constraints and item characteristics
   * 
   * @param {Array<any>} items Items to process in batches
   * @param {Object} options Additional options
   * @param {string} [options.operation] Name of operation for logging
   * @param {boolean} [options.aggressiveOptimization=false] Use more aggressive optimization for critical operations
   * @returns {number} Optimal batch size
   */
  calculateOptimalBatchSize(items, options = {}) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return this.options.defaultBatchSize;
    }
    
    // Get current memory usage
    const memUsage = memoryManager.getCurrentMemoryUsage();
    const heapUtilizationPct = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    // If memory utilization is already high, use more aggressive optimization
    const aggressive = options.aggressiveOptimization || 
      heapUtilizationPct > (this.options.targetUtilizationPct + 15);
    
    // Use memory manager's calculation as a base
    const baseSize = memoryManager.calculateOptimalBatchSize(items, {
      maxBatchSize: aggressive ? Math.floor(this.options.maxBatchSize / 2) : this.options.maxBatchSize,
      minBatchSize: this.options.minBatchSize,
      targetBatchSizeMB: aggressive ? 5 : 10
    });
    
    // Store this calculation for tracking
    this._lastBatchSizes.push({
      timestamp: Date.now(),
      size: baseSize,
      operation: options.operation || 'unknown',
      itemCount: items.length,
      memoryUsage: memUsage
    });
    
    // Keep only the most recent 20 calculations
    if (this._lastBatchSizes.length > 20) {
      this._lastBatchSizes.shift();
    }
    
    // Debug logging
    if (this.options.debug) {
      this.logger.debug(`Calculated batch size: ${baseSize}`, {
        operation: options.operation || 'unknown',
        itemCount: items.length,
        memoryUtilization: heapUtilizationPct.toFixed(1) + '%',
        aggressive
      });
    }
    
    return baseSize;
  }

  /**
   * Optimize a process function to be memory efficient
   * 
   * @param {Function} processFn The original process function that takes a batch of items
   * @param {Object} options Options for optimization
   * @param {string} [options.operation] Name of operation for logging
   * @param {boolean} [options.monitored=true] Whether to monitor memory during execution
   * @returns {Function} An optimized version of the process function
   */
  optimizeProcessFunction(processFn, options = {}) {
    if (typeof processFn !== 'function') {
      throw new Error('Process function must be a function');
    }
    
    const operation = options.operation || 'unknown';
    const monitored = options.monitored !== undefined ? options.monitored : true;
    
    // Return an optimized wrapper function
    return async (batch) => {
      if (this.options.preProcessGC && batch.length > 5) {
        // For large batches, try to reclaim memory before processing
        memoryManager.tryForceGC();
      }
      
      // Capture memory before processing
      let memBefore;
      if (monitored) {
        memBefore = memoryManager.getCurrentMemoryUsage();
      }
      
      // Execute the original function
      const results = await processFn(batch);
      
      // Analyze memory after processing
      if (monitored) {
        const memAfter = memoryManager.getCurrentMemoryUsage();
        const memPerItem = (memAfter.heapUsed - memBefore.heapUsed) / batch.length;
        
        // Cache the memory usage per item for this operation
        this._itemSizeCache.set(operation, {
          timestamp: Date.now(),
          bytesPerItem: memPerItem,
          sampleSize: batch.length
        });
        
        // If we detect high memory growth, trigger GC
        if (memAfter.heapUsed - memBefore.heapUsed > 50 * 1024 * 1024) { // 50MB growth
          memoryManager.tryForceGC();
        }
      }
      
      return results;
    };
  }

  /**
   * Get memory usage statistics for previous batch operations
   * 
   * @returns {Object} Statistics about batch operations and memory usage
   */
  getBatchStatistics() {
    return {
      batchSizes: this._lastBatchSizes,
      itemSizeEstimates: Array.from(this._itemSizeCache.entries()).map(([operation, data]) => ({
        operation,
        ...data,
        bytesPerItemKB: (data.bytesPerItem / 1024).toFixed(2)
      })),
      recommendations: this._generateRecommendations()
    };
  }

  /**
   * Generate recommendations based on observed batch processing patterns
   * @private
   * @returns {Array<Object>} List of recommendations
   */
  _generateRecommendations() {
    const recommendations = [];
    
    // Check for overly large batch sizes
    const largeBatches = this._lastBatchSizes.filter(b => b.size > 50);
    if (largeBatches.length > 5) {
      recommendations.push({
        type: 'batch_size',
        message: 'Consider reducing max batch size for more consistent memory usage',
        suggestedValue: Math.ceil(largeBatches.reduce((sum, b) => sum + b.size, 0) / largeBatches.length / 2)
      });
    }
    
    // Check for memory intensive operations
    const intensiveOps = Array.from(this._itemSizeCache.entries())
      .filter(([_, data]) => data.bytesPerItem > 1024 * 1024) // More than 1MB per item
      .map(([op, _]) => op);
    
    if (intensiveOps.length > 0) {
      recommendations.push({
        type: 'memory_intensive',
        message: `These operations consume significant memory per item: ${intensiveOps.join(', ')}`,
        operations: intensiveOps
      });
    }
    
    return recommendations;
  }
}

// Create a singleton instance
const batchOptimizer = new BatchOptimizer();

module.exports = {
  BatchOptimizer,
  batchOptimizer,
  calculateOptimalBatchSize: (items, options) => batchOptimizer.calculateOptimalBatchSize(items, options),
  optimizeProcessFunction: (fn, options) => batchOptimizer.optimizeProcessFunction(fn, options),
  getBatchStatistics: () => batchOptimizer.getBatchStatistics()
}; 