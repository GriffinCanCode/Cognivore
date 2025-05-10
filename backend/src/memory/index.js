/**
 * Memory Management Module
 * Provides utilities for memory monitoring, optimization, and efficient resource usage
 */

const { memoryManager, MemoryManager, ...memoryManagerFunctions } = require('./memoryManager');
const { heapAnalyzer, HeapAnalyzer, ...heapAnalyzerFunctions } = require('./heapAnalyzer');
const { batchOptimizer, BatchOptimizer, ...batchOptimizerFunctions } = require('./batchOptimizer');

/**
 * Create a custom memory management configuration with specific settings
 * 
 * @param {Object} options Configuration options
 * @param {Object} [options.memoryManager] MemoryManager configuration
 * @param {Object} [options.heapAnalyzer] HeapAnalyzer configuration
 * @param {Object} [options.batchOptimizer] BatchOptimizer configuration
 * @returns {Object} Configured memory management utilities
 */
function createMemoryManager(options = {}) {
  const customMemoryManager = options.memoryManager ? 
    new MemoryManager(options.memoryManager) : memoryManager;
  
  const customHeapAnalyzer = options.heapAnalyzer ? 
    new HeapAnalyzer(options.heapAnalyzer) : heapAnalyzer;
  
  const customBatchOptimizer = options.batchOptimizer ? 
    new BatchOptimizer(options.batchOptimizer) : batchOptimizer;
  
  return {
    memoryManager: customMemoryManager,
    heapAnalyzer: customHeapAnalyzer,
    batchOptimizer: customBatchOptimizer,
    
    // Memory manager functions
    calculateOptimalBatchSize: (items, opts) => 
      customMemoryManager.calculateOptimalBatchSize(items, opts),
    getCurrentMemoryUsage: () => 
      customMemoryManager.getCurrentMemoryUsage(),
    tryForceGC: () => 
      customMemoryManager.tryForceGC(),
    monitorMemory: (opts) => 
      customMemoryManager.monitorMemory(opts),
    
    // Heap analyzer functions
    analyzeHeap: () => 
      customHeapAnalyzer.analyzeHeap(),
    getMemoryStats: () => 
      customHeapAnalyzer.getMemoryStats(),
    
    // Batch optimizer functions
    optimizeProcessFunction: (fn, opts) => 
      customBatchOptimizer.optimizeProcessFunction(fn, opts),
    getBatchStatistics: () => 
      customBatchOptimizer.getBatchStatistics()
  };
}

// Export all memory management utilities
module.exports = {
  // Singleton instances for common use
  memoryManager,
  heapAnalyzer,
  batchOptimizer,
  
  // Classes for custom instances
  MemoryManager,
  HeapAnalyzer,
  BatchOptimizer,
  
  // Factory function
  createMemoryManager,
  
  // Direct function exports for convenience
  ...memoryManagerFunctions,
  ...heapAnalyzerFunctions,
  ...batchOptimizerFunctions
}; 