/**
 * Heap Analyzer Module
 * Analyzes heap usage and provides insights for memory optimization
 */

const { createContextLogger } = require('../utils/logger');
const { memoryManager } = require('./memoryManager');
const logger = createContextLogger('HeapAnalyzer');

/**
 * Analyzes heap usage patterns and provides alerts if problematic patterns are detected
 */
class HeapAnalyzer {
  /**
   * Create a new HeapAnalyzer instance
   * @param {Object} options Configuration options
   * @param {number} [options.leakThresholdRate=5] Rate of heap growth in MB/min to consider a potential leak
   * @param {number} [options.highUtilizationThreshold=85] Percentage of heap utilization to consider high
   * @param {boolean} [options.debug=false] Enable debug logging
   */
  constructor(options = {}) {
    this.options = {
      leakThresholdRate: options.leakThresholdRate || 5,
      highUtilizationThreshold: options.highUtilizationThreshold || 85,
      debug: options.debug || false
    };
    
    this.logger = createContextLogger('HeapAnalyzer');
    this._memorySnapshots = [];
  }

  /**
   * Analyze the current memory usage and detect potential issues
   * 
   * @returns {Object} Analysis results with potential issues identified
   */
  analyzeHeap() {
    // Get current memory usage and trend
    const currentUsage = memoryManager.getCurrentMemoryUsage();
    const trend = memoryManager.getMemoryTrend({ timeWindowMs: 300000 }); // 5 minutes
    
    const heapUtilizationPct = (currentUsage.heapUsed / currentUsage.heapTotal) * 100;
    
    // Initialize results
    const results = {
      currentUsage,
      trend,
      issues: [],
      recommends: []
    };
    
    // Check for potential memory leak
    if (trend.trend === 'increasing' && parseFloat(trend.rate) > this.options.leakThresholdRate) {
      results.issues.push({
        type: 'potential_leak',
        severity: 'high',
        message: `Heap usage increasing at ${trend.rate}MB/minute, which may indicate a memory leak`
      });
      
      results.recommends.push({
        action: 'investigate_leak',
        message: 'Monitor object allocations and consider heap dumps to identify sources of memory leaks'
      });
    }
    
    // Check for high utilization
    if (heapUtilizationPct > this.options.highUtilizationThreshold) {
      results.issues.push({
        type: 'high_utilization',
        severity: 'medium',
        message: `Heap utilization is ${heapUtilizationPct.toFixed(1)}%, which is approaching maximum capacity`
      });
      
      results.recommends.push({
        action: 'optimize_memory',
        message: 'Consider reducing batch sizes or increasing Node.js heap size with --max-old-space-size flag'
      });
      
      // Try to force GC if utilization is very high
      if (heapUtilizationPct > 90) {
        memoryManager.tryForceGC();
        results.recommends.push({
          action: 'forced_gc',
          message: 'Garbage collection was automatically triggered due to high heap utilization'
        });
      }
    }
    
    // Check for external memory pressure
    if (parseFloat(currentUsage.rssMB) > parseFloat(currentUsage.heapTotalMB) * 1.5) {
      results.issues.push({
        type: 'external_memory',
        severity: 'low',
        message: 'High external memory usage detected. This could be from buffers or native objects'
      });
    }
    
    // Log results if debug is enabled
    if (this.options.debug && results.issues.length > 0) {
      this.logger.warn('Memory analysis detected issues', {
        issueCount: results.issues.length,
        issues: results.issues.map(i => i.type).join(', ')
      });
    }
    
    return results;
  }

  /**
   * Get memory allocation statistics
   * 
   * @returns {Object} Memory allocation statistics
   */
  getMemoryStats() {
    const metrics = memoryManager.getCurrentMemoryUsage();
    const v8 = require('v8');
    
    // Get heap statistics
    const heapStats = v8.getHeapStatistics();
    
    return {
      ...metrics,
      heapSizeLimit: (heapStats.heap_size_limit / (1024 * 1024)).toFixed(2) + 'MB',
      physicalTotal: (heapStats.total_physical_size / (1024 * 1024)).toFixed(2) + 'MB',
      availableHeapSize: ((heapStats.heap_size_limit - metrics.heapUsed) / (1024 * 1024)).toFixed(2) + 'MB',
      mallocMem: (heapStats.malloced_memory / (1024 * 1024)).toFixed(2) + 'MB',
      peakMallocMem: (heapStats.peak_malloced_memory / (1024 * 1024)).toFixed(2) + 'MB'
    };
  }
}

// Create a singleton instance
const heapAnalyzer = new HeapAnalyzer();

module.exports = {
  HeapAnalyzer,
  heapAnalyzer,
  analyzeHeap: () => heapAnalyzer.analyzeHeap(),
  getMemoryStats: () => heapAnalyzer.getMemoryStats()
}; 