/**
 * Memory Manager Utility
 * Provides memory monitoring and adaptive batch sizing for efficient resource usage
 */

const { createContextLogger } = require('../utils/logger');
const logger = createContextLogger('MemoryManager');

/**
 * Memory Manager class that handles memory monitoring and optimization
 */
class MemoryManager {
  /**
   * Create a new MemoryManager instance
   * @param {Object} options Configuration options
   * @param {boolean} [options.debug=false] Enable debug logging
   * @param {boolean} [options.autoGC=false] Attempt automatic garbage collection when threshold is reached
   * @param {number} [options.gcThresholdPct=80] Percentage of heap usage that triggers GC (if autoGC enabled)
   * @param {number} [options.embeddingBatchLimit=20] Maximum number of embeddings to process in a single batch
   * @param {number} [options.largeDocThresholdKB=500] Size in KB above which a document is considered large
   */
  constructor(options = {}) {
    this.options = {
      debug: options.debug || false,
      autoGC: options.autoGC || false,
      gcThresholdPct: options.gcThresholdPct || 80,
      embeddingBatchLimit: options.embeddingBatchLimit || 20,
      largeDocThresholdKB: options.largeDocThresholdKB || 500
    };
    
    this.logger = createContextLogger('MemoryManager');
    this._memorySnapshots = [];
    this._initialized = true;
    this._activeBatches = 0;
    this._lastGCTime = 0;
    
    if (this.options.debug) {
      this.logger.info('Memory manager initialized with options:', this.options);
    }
  }
  
  /**
   * Calculate the optimal batch size based on document size
   * 
   * @param {Array<any>} items - Items to process (documents, chunks, etc.)
   * @param {Object} options - Configuration options
   * @param {number} [options.maxBatchSize=50] - Maximum batch size to use
   * @param {number} [options.minBatchSize=1] - Minimum batch size to use
   * @param {number} [options.targetBatchSizeMB=10] - Target batch size in MB
   * @param {Function} [options.sizeCalculator] - Function to calculate size of an item
   * @param {boolean} [options.isEmbedding=false] - Whether the batch is for embedding operations
   * @returns {number} - Calculated optimal batch size
   */
  calculateOptimalBatchSize(items, options = {}) {
    const {
      maxBatchSize = 50,
      minBatchSize = 1,
      targetBatchSizeMB = 10,
      sizeCalculator = this.calculateItemSize,
      isEmbedding = false
    } = options;

    if (!items || !Array.isArray(items) || items.length === 0) {
      this.logger.warn('Invalid or empty items array provided for batch size calculation');
      return maxBatchSize; // Default to max when no data available
    }

    // If this is for embeddings, apply stricter limits based on current memory state
    if (isEmbedding) {
      const memUsage = this.getCurrentMemoryUsage();
      const heapUtilizationPct = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      // If already under memory pressure, use smallest batch size for embeddings
      if (heapUtilizationPct > this.options.gcThresholdPct) {
        this.logger.warn('Memory pressure detected, using minimal batch size for embeddings');
        return minBatchSize;
      }
      
      // For embeddings, cap at embeddingBatchLimit regardless of calculated size
      const embeddingMax = Math.min(maxBatchSize, this.options.embeddingBatchLimit);
      
      // Reduce batch size if we have multiple active batches
      if (this._activeBatches > 1) {
        return Math.max(minBatchSize, Math.floor(embeddingMax / this._activeBatches));
      }
      
      // Check if items contain large documents
      const sampleSize = Math.min(items.length, 5);
      const sampled = items.length <= 5 ? items : this.sampleItems(items, sampleSize);
      
      for (const item of sampled) {
        const itemSize = sizeCalculator(item);
        const itemSizeKB = itemSize / 1024;
        
        // If any sampled item is large, reduce batch size
        if (itemSizeKB > this.options.largeDocThresholdKB) {
          this.logger.info(`Large document detected (${itemSizeKB.toFixed(1)}KB), reducing batch size`);
          return Math.max(minBatchSize, Math.floor(embeddingMax / 2));
        }
      }
      
      return embeddingMax;
    }

    // Sample the items (all items if < 10, otherwise up to 10)
    const sampleSize = Math.min(items.length, 10);
    const sampled = items.length <= 10 ? items : this.sampleItems(items, sampleSize);
    
    // Calculate average size in bytes
    let totalSize = 0;
    for (const item of sampled) {
      totalSize += sizeCalculator(item);
    }
    
    const avgItemSizeBytes = totalSize / sampled.length;
    const targetBatchSizeBytes = targetBatchSizeMB * 1024 * 1024;
    
    // Calculate batch size to stay under target memory usage
    let calculatedBatchSize = Math.floor(targetBatchSizeBytes / avgItemSizeBytes);
    
    // Ensure batch size is within limits
    calculatedBatchSize = Math.max(minBatchSize, Math.min(maxBatchSize, calculatedBatchSize));
    
    // Ensure that calculated batch size is never the same as maxBatchSize for large items
    // This ensures that small items get a larger batch size and large items get a smaller batch size
    if (avgItemSizeBytes > 50000 && calculatedBatchSize === maxBatchSize) {
      calculatedBatchSize = Math.max(minBatchSize, Math.floor(maxBatchSize / 2));
    }
    
    if (this.options.debug) {
      this.logger.debug(`Calculated optimal batch size: ${calculatedBatchSize}`, {
        avgItemSizeKB: (avgItemSizeBytes / 1024).toFixed(2),
        targetBatchSizeMB,
        items: items.length
      });
    }
    
    return calculatedBatchSize;
  }

  /**
   * Track the start of a batch processing operation
   * 
   * @param {Object} options Options for batch tracking
   * @param {string} [options.type='default'] Type of batch operation (e.g., 'embedding', 'processing')
   * @param {number} [options.size=0] Number of items in the batch
   * @returns {Object} Batch tracker object with release method
   */
  trackBatch(options = {}) {
    const { type = 'default', size = 0 } = options;
    
    this._activeBatches++;
    
    if (this.options.debug) {
      this.logger.debug(`Starting batch operation (${type}), active batches: ${this._activeBatches}`);
    }
    
    // Return a tracker object with release method
    return {
      type,
      size,
      startTime: Date.now(),
      release: () => {
        this._activeBatches = Math.max(0, this._activeBatches - 1);
        
        if (this.options.debug) {
          this.logger.debug(`Released batch operation (${type}), active batches: ${this._activeBatches}`);
        }
        
        // Try to reclaim memory after a batch completes
        if (type === 'embedding' && size > 5) {
          this.tryForceGC();
        }
      }
    };
  }

  /**
   * Calculate the approximate memory size of an item in bytes
   * 
   * @param {any} item - Item to calculate size for
   * @returns {number} - Approximate size in bytes
   */
  calculateItemSize(item) {
    if (!item) return 0;
    
    // Handle strings (most common case for documents/text)
    if (typeof item === 'string') {
      // Rough approximation: each character is ~2 bytes in UTF-16
      return item.length * 2;
    }
    
    // Handle document objects with text property
    if (item && typeof item === 'object') {
      if (item.text && typeof item.text === 'string') {
        return item.text.length * 2;
      }
      
      // For embeddings or chunks
      if (item.content && typeof item.content === 'string') {
        return item.content.length * 2;
      }
      
      if (item.chunks && Array.isArray(item.chunks)) {
        return item.chunks.reduce((sum, chunk) => {
          return sum + (typeof chunk === 'string' ? chunk.length * 2 : 0);
        }, 0);
      }
      
      // Handle embedding vectors directly
      if (item.vector && Array.isArray(item.vector)) {
        // Each embedding value is a float (4 bytes) plus some overhead
        return item.vector.length * 4 + 100;
      }
      
      // Fallback for general objects: use JSON size as estimate
      try {
        return JSON.stringify(item).length * 2;
      } catch (e) {
        return 1000; // Fallback default if can't stringify
      }
    }
    
    // Numeric types
    if (typeof item === 'number') return 8;
    
    // Boolean
    if (typeof item === 'boolean') return 4;
    
    // Default fallback
    return 1000; // Assume 1KB for unknown types
  }

  /**
   * Sample items from an array
   * 
   * @param {Array<any>} items - Items to sample from
   * @param {number} count - Number of samples to take
   * @returns {Array<any>} - Sampled items
   */
  sampleItems(items, count) {
    if (items.length <= count) return items;
    
    const result = [];
    const interval = Math.floor(items.length / count);
    
    // Take evenly distributed samples
    for (let i = 0; i < count; i++) {
      const index = Math.min(i * interval, items.length - 1);
      result.push(items[index]);
    }
    
    return result;
  }

  /**
   * Get current memory usage
   * 
   * @returns {Object} Memory usage stats
   */
  getCurrentMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
      rssMB: (memoryUsage.rss / 1024 / 1024).toFixed(2),
      utilization: (memoryUsage.heapUsed / memoryUsage.heapTotal * 100).toFixed(1) + '%',
      activeBatches: this._activeBatches
    };
  }

  /**
   * Try to force garbage collection if available
   * 
   * Note: This requires running Node with --expose-gc flag
   * e.g. node --expose-gc your-script.js
   * 
   * @param {Object} options Options for garbage collection
   * @param {boolean} [options.force=false] Force GC even if cooldown period hasn't elapsed
   * @returns {boolean} Whether garbage collection was triggered
   */
  tryForceGC(options = {}) {
    const now = Date.now();
    const cooldownPeriod = 2000; // 2 seconds between GC attempts
    
    // Skip GC if we've recently tried unless forced
    if (!options.force && now - this._lastGCTime < cooldownPeriod) {
      return false;
    }
    
    if (global.gc) {
      if (this.options.debug) {
        this.logger.debug('Triggering manual garbage collection');
      }
      
      this._lastGCTime = now;
      global.gc();
      
      // For higher memory pressure, try a second GC pass after a short delay
      const memUsage = this.getCurrentMemoryUsage();
      const heapUtilization = parseFloat(memUsage.utilization);
      
      if (heapUtilization > 75) {
        setTimeout(() => {
          if (global.gc) {
            global.gc();
            if (this.options.debug) {
              this.logger.debug('Running second garbage collection pass');
            }
          }
        }, 500);
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Monitor memory usage and take action if necessary
   * 
   * @param {Object} options Monitoring options
   * @param {boolean} [options.forceGC=false] Force garbage collection regardless of threshold
   * @returns {Object} Memory usage information
   */
  monitorMemory(options = {}) {
    const memUsage = this.getCurrentMemoryUsage();
    
    // Take a snapshot for tracking
    this._memorySnapshots.push({
      timestamp: Date.now(),
      usage: memUsage
    });
    
    // Keep only the most recent 100 snapshots
    if (this._memorySnapshots.length > 100) {
      this._memorySnapshots.shift();
    }
    
    // Check if we need to trigger GC
    const heapUtilizationPct = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const shouldTriggerGC = options.forceGC || 
      (this.options.autoGC && heapUtilizationPct >= this.options.gcThresholdPct);
    
    if (shouldTriggerGC) {
      const gcTriggered = this.tryForceGC({force: options.forceGC});
      
      if (gcTriggered) {
        // Get updated memory usage after GC
        const afterGC = this.getCurrentMemoryUsage();
        const memoryFreed = memUsage.heapUsed - afterGC.heapUsed;
        
        if (this.options.debug && memoryFreed > 0) {
          this.logger.info(`GC freed ${(memoryFreed / (1024 * 1024)).toFixed(2)}MB of memory`, {
            before: memUsage.heapUsedMB + 'MB',
            after: afterGC.heapUsedMB + 'MB'
          });
        }
        
        return afterGC;
      }
    }
    
    return memUsage;
  }

  /**
   * Get memory usage trend over time
   * 
   * @param {Object} options Options for trend calculation
   * @param {number} [options.timeWindowMs=60000] Time window in milliseconds (default: 1 minute)
   * @returns {Object} Memory usage trend statistics
   */
  getMemoryTrend(options = {}) {
    const { timeWindowMs = 60000 } = options;
    const now = Date.now();
    
    // Filter snapshots within time window
    const relevantSnapshots = this._memorySnapshots.filter(
      snapshot => now - snapshot.timestamp <= timeWindowMs
    );
    
    if (relevantSnapshots.length < 2) {
      return { trend: 'stable', rate: 0, samples: relevantSnapshots.length };
    }
    
    // Calculate trend as MB change per minute
    const first = relevantSnapshots[0].usage;
    const last = relevantSnapshots[relevantSnapshots.length - 1].usage;
    const elapsedMinutes = (last.timestamp - first.timestamp) / 60000;
    
    if (elapsedMinutes === 0) {
      return { trend: 'stable', rate: 0, samples: relevantSnapshots.length };
    }
    
    // Calculate rate of change in MB per minute
    const heapUsedDiff = last.heapUsed - first.heapUsed;
    const rate = (heapUsedDiff / (1024 * 1024)) / elapsedMinutes;
    
    // Determine trend direction
    let trend = 'stable';
    if (rate > 1) trend = 'increasing';
    else if (rate < -1) trend = 'decreasing';
    
    return {
      trend,
      rate: rate.toFixed(2),
      samples: relevantSnapshots.length,
      timeWindowMs
    };
  }
  
  /**
   * Check if system is currently under memory pressure
   * 
   * @returns {boolean} True if system is under memory pressure
   */
  isUnderMemoryPressure() {
    const memUsage = this.getCurrentMemoryUsage();
    const heapUtilizationPct = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    return heapUtilizationPct > this.options.gcThresholdPct;
  }
  
  /**
   * Get the number of active batch operations
   * 
   * @returns {number} Number of active batches
   */
  getActiveBatchCount() {
    return this._activeBatches;
  }
}

// Create and export a singleton instance
const memoryManager = new MemoryManager();

// For backward compatibility, export the functions directly
module.exports = {
  // Instance export
  memoryManager,
  
  // Class export
  MemoryManager,
  
  // Direct function exports for backward compatibility
  calculateOptimalBatchSize: (items, options) => memoryManager.calculateOptimalBatchSize(items, options),
  calculateItemSize: (item) => memoryManager.calculateItemSize(item),
  getCurrentMemoryUsage: () => memoryManager.getCurrentMemoryUsage(),
  tryForceGC: (options) => memoryManager.tryForceGC(options),
  monitorMemory: (options) => memoryManager.monitorMemory(options),
  getMemoryTrend: (options) => memoryManager.getMemoryTrend(options),
  trackBatch: (options) => memoryManager.trackBatch(options),
  isUnderMemoryPressure: () => memoryManager.isUnderMemoryPressure(),
  getActiveBatchCount: () => memoryManager.getActiveBatchCount()
}; 