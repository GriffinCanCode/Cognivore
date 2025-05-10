# Memory Management Module

This module provides comprehensive memory management utilities for optimizing memory usage in Node.js applications, particularly for batch processing and large data operations.

## Key Components

### MemoryManager

Core memory monitoring and management functionality:

- Memory usage tracking and statistics
- Garbage collection control
- Batch size optimization based on memory constraints
- Memory trend analysis

```javascript
const { memoryManager } = require('./memory');

// Get current memory usage
const usage = memoryManager.getCurrentMemoryUsage();
console.log(`Current heap usage: ${usage.heapUsedMB}MB (${usage.utilization})`);

// Monitor memory and trigger GC if needed
memoryManager.monitorMemory({ forceGC: true });

// Calculate optimal batch size for memory-efficient processing
const batchSize = memoryManager.calculateOptimalBatchSize(items);
```

### HeapAnalyzer

Advanced heap analysis and memory issue detection:

- Detects potential memory leaks
- Identifies high memory utilization
- Provides detailed memory statistics
- Recommends optimization actions

```javascript
const { heapAnalyzer } = require('./memory');

// Analyze heap for potential issues
const analysis = heapAnalyzer.analyzeHeap();
if (analysis.issues.length > 0) {
  console.warn('Memory issues detected:', analysis.issues);
  console.log('Recommendations:', analysis.recommends);
}

// Get detailed memory statistics
const stats = heapAnalyzer.getMemoryStats();
console.log(`Available heap: ${stats.availableHeapSize}`);
```

### BatchOptimizer

Memory-optimized batch processing:

- Adaptive batch sizing based on memory conditions
- Process function optimization and monitoring
- Memory usage tracking per operation
- Batch processing recommendations

```javascript
const { batchOptimizer } = require('./memory');

// Calculate optimal batch size with operation context
const batchSize = batchOptimizer.calculateOptimalBatchSize(items, { 
  operation: 'document_embedding' 
});

// Optimize a process function with memory monitoring
const optimizedFn = batchOptimizer.optimizeProcessFunction(processFn, {
  operation: 'image_processing',
  monitored: true
});

// Get statistics and recommendations
const stats = batchOptimizer.getBatchStatistics();
console.log('Recommendations:', stats.recommendations);
```

## Integration with BatchProcessor

The memory management module is designed to integrate seamlessly with the BatchProcessor utility:

```javascript
const BatchProcessor = require('../utils/batchers/batchProcessor');
const processor = new BatchProcessor({ 
  batchSize: 10,
  autoOptimize: true,         // Use BatchOptimizer for advanced memory optimization
  memoryMonitoring: true,     // Track memory usage during processing
  detectMemoryIssues: true,   // Use HeapAnalyzer to detect potential memory issues
  processName: 'document_processing'  // Name for tracking this specific process
});

const results = await processor.process(items, processFn);
```

## Custom Configuration

You can create a custom memory management configuration:

```javascript
const { createMemoryManager } = require('./memory');

const customMemory = createMemoryManager({
  memoryManager: {
    debug: true,
    autoGC: true,
    gcThresholdPct: 75
  },
  heapAnalyzer: {
    leakThresholdRate: 10,
    highUtilizationThreshold: 80
  },
  batchOptimizer: {
    maxBatchSize: 50,
    targetUtilizationPct: 60,
    preProcessGC: true
  }
});

// Use custom configuration
customMemory.monitorMemory();
```

## Best Practices

1. Enable `autoOptimize` for large batch operations
2. Use `detectMemoryIssues` during development and testing
3. Set `memoryMonitoring: true` for memory-intensive operations
4. Consider using `forceGCOnCompletion` after very large operations
5. Use the `processName` parameter to track memory usage by operation type 