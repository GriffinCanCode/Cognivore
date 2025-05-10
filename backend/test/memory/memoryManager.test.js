/**
 * Tests for memory management utilities
 */

const { 
  MemoryManager, 
  HeapAnalyzer, 
  BatchOptimizer,
  calculateOptimalBatchSize,
  memoryManager
} = require('../../src/memory');

describe('Memory Management Utilities', () => {
  
  describe('MemoryManager', () => {
    it('should create a memory manager instance', () => {
      const manager = new MemoryManager({ debug: true });
      expect(manager).toBeInstanceOf(MemoryManager);
      expect(manager.options.debug).toBe(true);
    });
    
    it('should calculate optimal batch size based on item size', () => {
      // Test with various item sizes
      const smallItems = Array(10).fill().map(() => ({ text: 'x'.repeat(1000) }));
      const largeItems = Array(10).fill().map(() => ({ text: 'x'.repeat(100000) }));
      
      const smallBatchSize = memoryManager.calculateOptimalBatchSize(smallItems);
      const largeBatchSize = memoryManager.calculateOptimalBatchSize(largeItems);
      
      // Larger items should result in smaller batch sizes
      expect(smallBatchSize).toBeGreaterThan(largeBatchSize);
    });
    
    it('should get current memory usage', () => {
      const usage = memoryManager.getCurrentMemoryUsage();
      
      expect(usage).toHaveProperty('heapUsed');
      expect(usage).toHaveProperty('heapTotal');
      expect(usage).toHaveProperty('rss');
      expect(usage).toHaveProperty('heapUsedMB');
      expect(usage).toHaveProperty('utilization');
    });
    
    it('should monitor memory usage', () => {
      const result = memoryManager.monitorMemory();
      
      expect(result).toHaveProperty('heapUsed');
      expect(result).toHaveProperty('heapTotal');
      expect(memoryManager._memorySnapshots.length).toBeGreaterThan(0);
    });
    
    it('should get memory trend', () => {
      // Force a few snapshots to analyze
      for (let i = 0; i < 3; i++) {
        memoryManager.monitorMemory();
      }
      
      const trend = memoryManager.getMemoryTrend();
      
      expect(trend).toHaveProperty('trend');
      expect(trend).toHaveProperty('rate');
      expect(trend).toHaveProperty('samples');
    });
  });
  
  describe('HeapAnalyzer', () => {
    it('should analyze heap usage', () => {
      const analyzer = new HeapAnalyzer();
      const analysis = analyzer.analyzeHeap();
      
      expect(analysis).toHaveProperty('currentUsage');
      expect(analysis).toHaveProperty('trend');
      expect(analysis).toHaveProperty('issues');
      expect(analysis).toHaveProperty('recommends');
    });
    
    it('should get memory statistics', () => {
      const analyzer = new HeapAnalyzer();
      const stats = analyzer.getMemoryStats();
      
      expect(stats).toHaveProperty('heapUsedMB');
      expect(stats).toHaveProperty('heapSizeLimit');
      expect(stats).toHaveProperty('physicalTotal');
    });
  });
  
  describe('BatchOptimizer', () => {
    it('should calculate optimal batch size with additional constraints', () => {
      const optimizer = new BatchOptimizer({
        defaultBatchSize: 15,
        maxBatchSize: 30,
        targetUtilizationPct: 50
      });
      
      const items = Array(100).fill().map(() => ({ text: 'test item' }));
      const size = optimizer.calculateOptimalBatchSize(items, {
        operation: 'test_operation'
      });
      
      expect(size).toBeGreaterThanOrEqual(1);
      expect(size).toBeLessThanOrEqual(30);
      expect(optimizer._lastBatchSizes.length).toBe(1);
      expect(optimizer._lastBatchSizes[0].operation).toBe('test_operation');
    });
    
    it('should optimize a process function', async () => {
      const optimizer = new BatchOptimizer();
      
      // Create a mock process function
      const processFn = jest.fn().mockImplementation(batch => {
        return batch.map(item => item * 2);
      });
      
      // Optimize the function
      const optimizedFn = optimizer.optimizeProcessFunction(processFn, {
        operation: 'test_multiply'
      });
      
      const batch = [1, 2, 3, 4, 5];
      const result = await optimizedFn(batch);
      
      expect(processFn).toHaveBeenCalledWith(batch);
      expect(result).toEqual([2, 4, 6, 8, 10]);
    });
    
    it('should get batch statistics', () => {
      const optimizer = new BatchOptimizer();
      
      // Add some test data
      optimizer.calculateOptimalBatchSize([1, 2, 3, 4, 5], { operation: 'test_op1' });
      optimizer.calculateOptimalBatchSize([1, 2, 3], { operation: 'test_op2' });
      
      const stats = optimizer.getBatchStatistics();
      
      expect(stats).toHaveProperty('batchSizes');
      expect(stats).toHaveProperty('itemSizeEstimates');
      expect(stats).toHaveProperty('recommendations');
      expect(stats.batchSizes.length).toBe(2);
    });
  });
}); 