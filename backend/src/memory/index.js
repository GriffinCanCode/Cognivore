/**
 * Memory Management Module
 * Provides utilities for memory monitoring, optimization, and efficient resource usage
 */

const { memoryManager, MemoryManager, ...memoryManagerFunctions } = require('./memoryManager');
const { heapAnalyzer, HeapAnalyzer, ...heapAnalyzerFunctions } = require('./heapAnalyzer');
const { batchOptimizer, BatchOptimizer, ...batchOptimizerFunctions } = require('./batchOptimizer');
const { dbMemoryManager, DbMemoryManager, ...dbMemoryManagerFunctions } = require('./dbMemoryManager');

/**
 * Create a custom memory management configuration with specific settings
 * 
 * @param {Object} options Configuration options
 * @param {Object} [options.memoryManager] MemoryManager configuration
 * @param {Object} [options.heapAnalyzer] HeapAnalyzer configuration
 * @param {Object} [options.batchOptimizer] BatchOptimizer configuration
 * @param {Object} [options.dbMemoryManager] DbMemoryManager configuration
 * @returns {Object} Configured memory management utilities
 */
function createMemoryManager(options = {}) {
  const customMemoryManager = options.memoryManager ? 
    new MemoryManager(options.memoryManager) : memoryManager;
  
  const customHeapAnalyzer = options.heapAnalyzer ? 
    new HeapAnalyzer(options.heapAnalyzer) : heapAnalyzer;
  
  const customBatchOptimizer = options.batchOptimizer ? 
    new BatchOptimizer(options.batchOptimizer) : batchOptimizer;
    
  const customDbMemoryManager = options.dbMemoryManager ? 
    new DbMemoryManager(options.dbMemoryManager) : dbMemoryManager;
  
  return {
    memoryManager: customMemoryManager,
    heapAnalyzer: customHeapAnalyzer,
    batchOptimizer: customBatchOptimizer,
    dbMemoryManager: customDbMemoryManager,
    
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
      customBatchOptimizer.getBatchStatistics(),
      
    // Database memory manager functions
    registerConnection: (id, conn, opts) => 
      customDbMemoryManager.registerConnection(id, conn, opts),
    optimizeQuery: (fn, opts) => 
      customDbMemoryManager.optimizeQuery(fn, opts),
    getDbStatistics: () => 
      customDbMemoryManager.getStatistics(),
    analyzeQueryPerformance: () => 
      customDbMemoryManager.analyzeQueryPerformance(),
    clearQueryCache: () => 
      customDbMemoryManager.clearQueryCache()
  };
}

// Export all memory management utilities
module.exports = {
  // Singleton instances for common use
  memoryManager,
  heapAnalyzer,
  batchOptimizer,
  dbMemoryManager,
  
  // Classes for custom instances
  MemoryManager,
  HeapAnalyzer,
  BatchOptimizer,
  DbMemoryManager,
  
  // Factory function
  createMemoryManager,
  
  // Direct function exports for convenience
  ...memoryManagerFunctions,
  ...heapAnalyzerFunctions,
  ...batchOptimizerFunctions,
  ...dbMemoryManagerFunctions
}; 