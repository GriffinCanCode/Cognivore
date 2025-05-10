/**
 * Memory Manager Utility
 * Provides memory monitoring and adaptive batch sizing for efficient resource usage
 */

const { createContextLogger } = require('../utils/logger');
const logger = createContextLogger('MemoryManager');

/**
 * Calculate the optimal batch size based on document size
 * 
 * @param {Array<any>} items - Items to process (documents, chunks, etc.)
 * @param {Object} options - Configuration options
 * @param {number} [options.maxBatchSize=50] - Maximum batch size to use
 * @param {number} [options.minBatchSize=1] - Minimum batch size to use
 * @param {number} [options.targetBatchSizeMB=10] - Target batch size in MB
 * @param {Function} [options.sizeCalculator] - Function to calculate size of an item
 * @returns {number} - Calculated optimal batch size
 */
function calculateOptimalBatchSize(items, options = {}) {
  const {
    maxBatchSize = 50,
    minBatchSize = 1,
    targetBatchSizeMB = 10,
    sizeCalculator = calculateItemSize
  } = options;

  if (!items || !Array.isArray(items) || items.length === 0) {
    logger.warn('Invalid or empty items array provided for batch size calculation');
    return maxBatchSize; // Default to max when no data available
  }

  // Sample the items (all items if < 10, otherwise up to 10)
  const sampleSize = Math.min(items.length, 10);
  const sampled = items.length <= 10 ? items : sampleItems(items, sampleSize);
  
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
  
  logger.debug(`Calculated optimal batch size: ${calculatedBatchSize}`, {
    avgItemSizeKB: (avgItemSizeBytes / 1024).toFixed(2),
    targetBatchSizeMB,
    items: items.length
  });
  
  return calculatedBatchSize;
}

/**
 * Calculate the approximate memory size of an item in bytes
 * 
 * @param {any} item - Item to calculate size for
 * @returns {number} - Approximate size in bytes
 */
function calculateItemSize(item) {
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
function sampleItems(items, count) {
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
function getCurrentMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  return {
    heapUsed: memoryUsage.heapUsed,
    heapTotal: memoryUsage.heapTotal,
    rss: memoryUsage.rss,
    heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
    heapTotalMB: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
    rssMB: (memoryUsage.rss / 1024 / 1024).toFixed(2)
  };
}

/**
 * Try to force garbage collection if available
 * 
 * Note: This requires running Node with --expose-gc flag
 * e.g. node --expose-gc your-script.js
 * 
 * @returns {boolean} Whether garbage collection was triggered
 */
function tryForceGC() {
  if (global.gc) {
    logger.debug('Triggering manual garbage collection');
    global.gc();
    return true;
  }
  return false;
}

module.exports = {
  calculateOptimalBatchSize,
  calculateItemSize,
  getCurrentMemoryUsage,
  tryForceGC
}; 