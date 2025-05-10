/**
 * Database Memory Manager
 * Provides memory optimization and monitoring for database operations
 */

const { createContextLogger } = require('../utils/logger');
const { memoryManager } = require('./memoryManager');
const { heapAnalyzer } = require('./heapAnalyzer');
const logger = createContextLogger('DbMemoryManager');

/**
 * Database connection states
 * @enum {string}
 */
const ConnectionState = {
  IDLE: 'idle',
  ACTIVE: 'active',
  BUSY: 'busy',
  CLOSED: 'closed'
};

/**
 * Database Memory Manager class that handles database-specific memory optimizations
 */
class DbMemoryManager {
  /**
   * Create a new DbMemoryManager instance
   * @param {Object} options Configuration options
   * @param {number} [options.maxConnections=10] Maximum number of database connections to maintain
   * @param {number} [options.idleTimeoutMs=30000] Time in ms to keep idle connections open
   * @param {number} [options.maxQueryCacheSize=100] Maximum number of query results to cache
   * @param {number} [options.maxQueryCacheSizeMB=50] Maximum memory size for query cache in MB
   * @param {boolean} [options.enableResultCache=true] Whether to cache query results
   * @param {boolean} [options.monitorQueries=true] Whether to monitor query execution for memory impact
   * @param {boolean} [options.debug=false] Enable debug logging
   */
  constructor(options = {}) {
    this.options = {
      maxConnections: options.maxConnections || 10,
      idleTimeoutMs: options.idleTimeoutMs || 30000,
      maxQueryCacheSize: options.maxQueryCacheSize || 100,
      maxQueryCacheSizeMB: options.maxQueryCacheSizeMB || 50,
      enableResultCache: options.enableResultCache !== undefined ? options.enableResultCache : true,
      monitorQueries: options.monitorQueries !== undefined ? options.monitorQueries : true,
      debug: options.debug || false
    };

    this.logger = createContextLogger('DbMemoryManager');
    this._connections = new Map();
    this._queryCache = new Map();
    this._querySizeEstimates = new Map();
    this._queryTimestamps = new Map();
    this._statistics = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalQueryTime: 0,
      largeResults: 0
    };

    if (this.options.debug) {
      this.logger.info('Database memory manager initialized with options:', this.options);
    }

    // Start periodic cleanup
    this._setupPeriodicCleanup();
  }

  /**
   * Register a database connection to be monitored
   * 
   * @param {string} connectionId Unique identifier for the connection
   * @param {Object} connection Database connection object
   * @param {Object} options Additional options
   * @param {string} [options.type='default'] Type of connection (e.g., 'postgres', 'mongodb')
   * @param {boolean} [options.isPrimary=false] Whether this is a primary connection
   * @returns {Object} Registered connection with monitoring wrapper
   */
  registerConnection(connectionId, connection, options = {}) {
    if (!connectionId || !connection) {
      throw new Error('Connection ID and connection object are required');
    }

    const connectionInfo = {
      id: connectionId,
      connection,
      type: options.type || 'default',
      isPrimary: options.isPrimary || false,
      state: ConnectionState.IDLE,
      created: Date.now(),
      lastActive: Date.now(),
      queryCount: 0,
      totalQueryTime: 0,
      activeQueries: 0
    };

    this._connections.set(connectionId, connectionInfo);

    // Wrap common query methods to monitor performance and memory usage
    const wrappedConnection = this._wrapConnectionMethods(connection, connectionInfo);

    if (this.options.debug) {
      this.logger.debug(`Registered database connection: ${connectionId}`, {
        type: connectionInfo.type,
        isPrimary: connectionInfo.isPrimary
      });
    }

    return wrappedConnection;
  }

  /**
   * Wrap database connection methods to monitor memory and performance
   * 
   * @private
   * @param {Object} connection Original database connection
   * @param {Object} connectionInfo Connection tracking information
   * @returns {Object} Connection with monitored methods
   */
  _wrapConnectionMethods(connection, connectionInfo) {
    const wrappedConnection = { ...connection };
    const self = this;

    // Methods that should definitely be monitored with full async wrapping
    const asyncMethodsToWrap = [
      'query', 'execute', 'find', 'findOne', 'findMany', 'exec',
      'aggregate', 'update', 'delete', 'insert', 'save', 'createTable', 'openTable'
    ];
    
    // Methods that typically don't need monitoring (getters, utilities, etc.)
    const skipMethods = [
      'constructor', 'toString', 'toJSON', 'valueOf', 'hasOwnProperty', 
      'isPrototypeOf', 'propertyIsEnumerable', 'inspect'
    ];

    // First wrap the primary async methods we know should be monitored
    asyncMethodsToWrap.forEach(method => {
      if (typeof connection[method] === 'function') {
        wrappedConnection[method] = async function(...args) {
          return self._monitoredQueryExecution(
            connection[method].bind(connection),
            args,
            connectionInfo,
            method
          );
        };
      }
    });
    
    // Then get all other methods from the original connection
    // This ensures we preserve all functionality, even for database-specific methods
    Object.getOwnPropertyNames(connection).forEach(prop => {
      // Skip properties we've already wrapped, non-functions, and known skip methods
      if (asyncMethodsToWrap.includes(prop) || skipMethods.includes(prop) ||
          typeof connection[prop] !== 'function' || wrappedConnection[prop]) {
        return;
      }
      
      const originalMethod = connection[prop];
      
      // Check if the method returns a promise or looks async
      const isLikelyAsync = 
        originalMethod.constructor.name === 'AsyncFunction' || 
        prop.toLowerCase().includes('async') ||
        /^(get|find|search|query|fetch|load|save|create|open|close|connect|execute)/.test(prop);
      
      if (isLikelyAsync) {
        // Wrap as async for probable async methods
        wrappedConnection[prop] = async function(...args) {
          return self._monitoredQueryExecution(
            originalMethod.bind(connection),
            args,
            connectionInfo,
            prop
          );
        };
      } else {
        // For likely synchronous methods, use lightweight monitoring
        wrappedConnection[prop] = function(...args) {
          try {
            connectionInfo.lastActive = Date.now();
            return originalMethod.apply(connection, args);
          } catch (error) {
            self.logger.error(`Error in synchronous method ${prop}:`, error);
            throw error;
          }
        };
      }
    });
    
    // For prototypical methods that might not be enumerable
    const proto = Object.getPrototypeOf(connection);
    if (proto && proto !== Object.prototype) {
      Object.getOwnPropertyNames(proto).forEach(prop => {
        // Skip internal methods, already wrapped properties, and known skip methods
        if (prop.startsWith('_') || asyncMethodsToWrap.includes(prop) || skipMethods.includes(prop) ||
            typeof connection[prop] !== 'function' || wrappedConnection[prop]) {
          return;
        }
        
        const originalMethod = connection[prop];
        
        // Check if the method returns a promise or looks async
        const isLikelyAsync = 
          originalMethod.constructor.name === 'AsyncFunction' || 
          prop.toLowerCase().includes('async') ||
          /^(get|find|search|query|fetch|load|save|create|open|close|connect|execute)/.test(prop);
        
        if (isLikelyAsync) {
          // Wrap as async for probable async methods
          wrappedConnection[prop] = async function(...args) {
            return self._monitoredQueryExecution(
              originalMethod.bind(connection),
              args,
              connectionInfo,
              prop
            );
          };
        } else {
          // For likely synchronous methods, use lightweight monitoring
          wrappedConnection[prop] = function(...args) {
            try {
              connectionInfo.lastActive = Date.now();
              return originalMethod.apply(connection, args);
            } catch (error) {
              self.logger.error(`Error in synchronous method ${prop}:`, error);
              throw error;
            }
          };
        }
      });
    }

    return wrappedConnection;
  }

  /**
   * Execute a database query with memory and performance monitoring
   * 
   * @private
   * @param {Function} queryFn Original query function
   * @param {Array} args Arguments for the query function
   * @param {Object} connectionInfo Connection tracking information
   * @param {string} method Query method name
   * @returns {Promise<any>} Query result
   */
  async _monitoredQueryExecution(queryFn, args, connectionInfo, method) {
    // Update connection state
    connectionInfo.state = ConnectionState.ACTIVE;
    connectionInfo.lastActive = Date.now();
    connectionInfo.queryCount++;
    connectionInfo.activeQueries++;
    this._statistics.totalQueries++;

    // Generate a cache key if caching is enabled
    const cacheKey = this.options.enableResultCache ? 
      this._generateCacheKey(method, args) : null;
    
    // Check cache for existing result
    if (cacheKey && this._queryCache.has(cacheKey)) {
      this._statistics.cacheHits++;
      
      // Update access timestamp for cache item
      this._queryTimestamps.set(cacheKey, Date.now());
      
      connectionInfo.activeQueries--;
      return this._queryCache.get(cacheKey);
    }
    
    this._statistics.cacheMisses++;

    // Capture memory before query execution
    const memBefore = this.options.monitorQueries ? 
      memoryManager.getCurrentMemoryUsage() : null;
      
    const startTime = Date.now();
    
    try {
      // Execute the query
      connectionInfo.state = ConnectionState.BUSY;
      const result = await queryFn(...args);
      
      // Measure query execution time
      const executionTime = Date.now() - startTime;
      connectionInfo.totalQueryTime += executionTime;
      this._statistics.totalQueryTime += executionTime;
      
      // Analyze memory impact if monitoring is enabled
      if (this.options.monitorQueries) {
        const memAfter = memoryManager.getCurrentMemoryUsage();
        const memoryImpact = {
          heapUsedDiff: memAfter.heapUsed - memBefore.heapUsed,
          heapUsedDiffMB: parseFloat(memAfter.heapUsedMB) - parseFloat(memBefore.heapUsedMB)
        };
        
        // Estimate result size
        const resultSize = this._estimateResultSize(result);
        
        // Log large result sets that could impact memory
        if (resultSize > 1024 * 1024 * 5) { // 5MB
          this._statistics.largeResults++;
          this.logger.warn(`Large query result detected (${method})`, {
            connectionId: connectionInfo.id,
            resultSizeMB: (resultSize / (1024 * 1024)).toFixed(2),
            memoryImpactMB: memoryImpact.heapUsedDiffMB.toFixed(2)
          });
          
          // Force garbage collection for very large results
          if (resultSize > 1024 * 1024 * 20) { // 20MB
            memoryManager.tryForceGC();
          }
        }
        
        // Store query size estimate for future reference
        this._querySizeEstimates.set(cacheKey || `${method}-${Date.now()}`, {
          timestamp: Date.now(),
          resultSize,
          executionTime,
          memoryImpact
        });
      }
      
      // Cache result if enabled and result is not too large
      if (this.options.enableResultCache && cacheKey) {
        const resultSize = this._estimateResultSize(result);
        const cacheSizeLimit = this.options.maxQueryCacheSizeMB * 1024 * 1024;
        
        if (resultSize < cacheSizeLimit) {
          this._queryCache.set(cacheKey, result);
          this._queryTimestamps.set(cacheKey, Date.now());
          
          // Perform cache cleanup if we're over the limit
          if (this._queryCache.size > this.options.maxQueryCacheSize) {
            this._cleanupOldestCacheItems(1);
          }
        }
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Database query error (${method})`, {
        connectionId: connectionInfo.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      connectionInfo.state = ConnectionState.IDLE;
      connectionInfo.activeQueries--;
    }
  }

  /**
   * Generate a cache key for a query
   * 
   * @private
   * @param {string} method Query method name
   * @param {Array} args Query arguments
   * @returns {string} Cache key
   */
  _generateCacheKey(method, args) {
    try {
      // Simple serialization for cache key
      // Note: This has limitations for complex objects with circular references
      return `${method}:${JSON.stringify(args)}`;
    } catch (e) {
      // If we can't serialize the args, we can't cache the result
      return null;
    }
  }

  /**
   * Estimate the size of a query result in bytes
   * 
   * @private
   * @param {any} result Query result to measure
   * @returns {number} Estimated size in bytes
   */
  _estimateResultSize(result) {
    if (!result) return 0;
    
    try {
      if (typeof result === 'string') {
        return result.length * 2; // Rough estimate for UTF-16
      }
      
      if (Array.isArray(result)) {
        // For arrays, we'll sample items if the array is large
        const sampleSize = Math.min(result.length, 10);
        if (sampleSize === 0) return 0;
        
        let totalSampleSize = 0;
        for (let i = 0; i < sampleSize; i++) {
          totalSampleSize += this._estimateResultSize(result[i]);
        }
        
        return (totalSampleSize / sampleSize) * result.length;
      }
      
      // For objects, use JSON serialization as an estimate
      return JSON.stringify(result).length * 2;
    } catch (e) {
      // Fallback size estimate if we encounter an error
      return 10000; // 10KB default for complex objects
    }
  }

  /**
   * Set up periodic cleanup for idle connections and cache
   * 
   * @private
   */
  _setupPeriodicCleanup() {
    // Run cleanup every minute
    const CLEANUP_INTERVAL = 60000;
    
    setInterval(() => {
      this._cleanupIdleConnections();
      this._cleanupOldCacheEntries();
      this._checkMemoryPressure();
    }, CLEANUP_INTERVAL);
  }

  /**
   * Clean up idle database connections
   * 
   * @private
   */
  _cleanupIdleConnections() {
    const now = Date.now();
    
    for (const [id, info] of this._connections.entries()) {
      // Don't close primary connections
      if (info.isPrimary) continue;
      
      // Close idle connections that have exceeded the timeout
      if (info.state === ConnectionState.IDLE && 
          now - info.lastActive > this.options.idleTimeoutMs &&
          info.activeQueries === 0) {
        
        if (this.options.debug) {
          this.logger.debug(`Closing idle connection: ${id}`, {
            idleTime: (now - info.lastActive) / 1000
          });
        }
        
        // Close the connection if it has a close method
        if (typeof info.connection.close === 'function') {
          try {
            info.connection.close();
          } catch (e) {
            this.logger.error(`Error closing connection: ${id}`, { error: e.message });
          }
        } else if (typeof info.connection.end === 'function') {
          try {
            info.connection.end();
          } catch (e) {
            this.logger.error(`Error ending connection: ${id}`, { error: e.message });
          }
        }
        
        info.state = ConnectionState.CLOSED;
        this._connections.delete(id);
      }
    }
  }

  /**
   * Clean up old cache entries
   * 
   * @private
   */
  _cleanupOldCacheEntries() {
    // Remove cache entries that haven't been accessed recently
    const now = Date.now();
    const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    
    for (const [key, timestamp] of this._queryTimestamps.entries()) {
      if (now - timestamp > CACHE_TTL) {
        this._queryCache.delete(key);
        this._queryTimestamps.delete(key);
        this._querySizeEstimates.delete(key);
      }
    }
  }

  /**
   * Clean up oldest cache items when over the limit
   * 
   * @private
   * @param {number} count Number of items to remove
   */
  _cleanupOldestCacheItems(count) {
    // Sort timestamps by age and remove the oldest entries
    const entries = Array.from(this._queryTimestamps.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, count);
    
    for (const [key] of entries) {
      this._queryCache.delete(key);
      this._queryTimestamps.delete(key);
      this._querySizeEstimates.delete(key);
    }
  }

  /**
   * Check for memory pressure and take action if necessary
   * 
   * @private
   */
  _checkMemoryPressure() {
    // Check current memory usage
    const memUsage = memoryManager.getCurrentMemoryUsage();
    const heapUtilizationPct = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    // If memory utilization is high, clear the cache
    if (heapUtilizationPct > 85) {
      this.logger.warn('High memory utilization detected, clearing query cache', {
        utilization: heapUtilizationPct.toFixed(1) + '%',
        cacheSize: this._queryCache.size
      });
      
      this.clearQueryCache();
      memoryManager.tryForceGC();
    }
  }

  /**
   * Clear the query cache
   */
  clearQueryCache() {
    this._queryCache.clear();
    this._queryTimestamps.clear();
    this._querySizeEstimates.clear();
    
    if (this.options.debug) {
      this.logger.debug('Query cache cleared');
    }
  }

  /**
   * Get statistics about database operations and memory usage
   * 
   * @returns {Object} Database operation statistics
   */
  getStatistics() {
    const activeConnections = Array.from(this._connections.values())
      .filter(c => c.state !== ConnectionState.CLOSED);
    
    const busyConnections = activeConnections
      .filter(c => c.state === ConnectionState.BUSY);
    
    const totalCacheSize = Array.from(this._querySizeEstimates.values())
      .reduce((total, item) => total + item.resultSize, 0);
    
    return {
      connections: {
        total: this._connections.size,
        active: activeConnections.length,
        busy: busyConnections.length,
        idle: activeConnections.length - busyConnections.length
      },
      queries: {
        total: this._statistics.totalQueries,
        cacheHits: this._statistics.cacheHits,
        cacheMisses: this._statistics.cacheMisses,
        hitRatio: this._statistics.totalQueries > 0 ? 
          (this._statistics.cacheHits / this._statistics.totalQueries * 100).toFixed(1) + '%' : '0%',
        avgQueryTime: this._statistics.totalQueries > 0 ? 
          (this._statistics.totalQueryTime / this._statistics.totalQueries).toFixed(2) + 'ms' : '0ms',
        largeResults: this._statistics.largeResults
      },
      cache: {
        size: this._queryCache.size,
        estimatedSizeMB: (totalCacheSize / (1024 * 1024)).toFixed(2),
        maxItems: this.options.maxQueryCacheSize,
        maxSizeMB: this.options.maxQueryCacheSizeMB
      },
      memory: memoryManager.getCurrentMemoryUsage()
    };
  }

  /**
   * Analyze database operations for potential optimizations
   * 
   * @returns {Object} Analysis results with recommendations
   */
  analyzeQueryPerformance() {
    const stats = this.getStatistics();
    const results = {
      statistics: stats,
      issues: [],
      recommendations: []
    };
    
    // Check for excessive cache misses
    if (stats.queries.total > 100 && parseFloat(stats.queries.hitRatio) < 30) {
      results.issues.push({
        type: 'low_cache_hit_ratio',
        severity: 'medium',
        message: `Low cache hit ratio (${stats.queries.hitRatio}) indicates potential for query optimization`
      });
      
      results.recommendations.push({
        type: 'improve_caching',
        message: 'Review frequently executed queries for caching opportunities'
      });
    }
    
    // Check for high connection usage
    if (stats.connections.busy / this.options.maxConnections > 0.8) {
      results.issues.push({
        type: 'high_connection_usage',
        severity: 'high',
        message: `High database connection usage (${stats.connections.busy}/${this.options.maxConnections})`
      });
      
      results.recommendations.push({
        type: 'connection_pool',
        message: 'Consider increasing the maximum connection pool size or implementing query throttling'
      });
    }
    
    // Check for large result sets
    if (stats.queries.largeResults > 0) {
      results.issues.push({
        type: 'large_result_sets',
        severity: 'medium',
        message: `${stats.queries.largeResults} queries returned large result sets`
      });
      
      results.recommendations.push({
        type: 'paginate_results',
        message: 'Implement pagination for large result sets to reduce memory usage'
      });
    }
    
    // Get memory analysis from heap analyzer
    const heapAnalysis = heapAnalyzer.analyzeHeap();
    if (heapAnalysis.issues.length > 0) {
      results.issues.push(...heapAnalysis.issues);
      results.recommendations.push(...heapAnalysis.recommends);
    }
    
    return results;
  }

  /**
   * Optimize a query function with memory awareness
   * 
   * @param {Function} queryFn Original query function
   * @param {Object} options Optimization options
   * @param {string} [options.queryName='unknown'] Name of the query for tracking
   * @param {boolean} [options.enableCache=true] Whether to cache the results
   * @param {number} [options.cacheTTLMs=900000] Cache TTL in milliseconds (15 min default)
   * @param {Function} [options.cacheKeyFn] Custom function to generate cache keys
   * @returns {Function} Memory-optimized query function
   */
  optimizeQuery(queryFn, options = {}) {
    if (typeof queryFn !== 'function') {
      throw new Error('Query function must be a function');
    }
    
    const queryOptions = {
      queryName: options.queryName || 'unknown',
      enableCache: options.enableCache !== undefined ? options.enableCache : true,
      cacheTTLMs: options.cacheTTLMs || 900000, // 15 minutes
      cacheKeyFn: options.cacheKeyFn
    };
    
    // Return an optimized wrapper function
    return async (...args) => {
      // Generate cache key if caching is enabled
      let cacheKey = null;
      if (queryOptions.enableCache) {
        if (typeof queryOptions.cacheKeyFn === 'function') {
          cacheKey = queryOptions.cacheKeyFn(...args);
        } else {
          cacheKey = this._generateCacheKey(queryOptions.queryName, args);
        }
        
        // Check cache for existing result
        if (cacheKey && this._queryCache.has(cacheKey)) {
          const timestamp = this._queryTimestamps.get(cacheKey);
          if (Date.now() - timestamp <= queryOptions.cacheTTLMs) {
            this._statistics.cacheHits++;
            this._queryTimestamps.set(cacheKey, Date.now());
            return this._queryCache.get(cacheKey);
          }
        }
      }
      
      this._statistics.cacheMisses++;
      
      // Capture memory before query execution
      const memBefore = memoryManager.getCurrentMemoryUsage();
      const startTime = Date.now();
      
      try {
        // Execute the query
        const result = await queryFn(...args);
        
        // Measure execution time
        const executionTime = Date.now() - startTime;
        this._statistics.totalQueryTime += executionTime;
        
        // Analyze memory impact
        const memAfter = memoryManager.getCurrentMemoryUsage();
        const memoryImpact = {
          heapUsedDiff: memAfter.heapUsed - memBefore.heapUsed,
          heapUsedDiffMB: parseFloat(memAfter.heapUsedMB) - parseFloat(memBefore.heapUsedMB)
        };
        
        // Cache result if enabled
        if (queryOptions.enableCache && cacheKey) {
          const resultSize = this._estimateResultSize(result);
          const cacheSizeLimit = this.options.maxQueryCacheSizeMB * 1024 * 1024;
          
          if (resultSize < cacheSizeLimit) {
            this._queryCache.set(cacheKey, result);
            this._queryTimestamps.set(cacheKey, Date.now());
            
            this._querySizeEstimates.set(cacheKey, {
              timestamp: Date.now(),
              resultSize,
              executionTime,
              memoryImpact
            });
            
            // Perform cache cleanup if we're over the limit
            if (this._queryCache.size > this.options.maxQueryCacheSize) {
              this._cleanupOldestCacheItems(1);
            }
          }
        }
        
        // If this query had a large memory impact, try to reclaim memory
        if (memoryImpact.heapUsedDiffMB > 20) { // 20MB
          memoryManager.tryForceGC();
        }
        
        return result;
      } catch (error) {
        this.logger.error(`Query error: ${queryOptions.queryName}`, {
          error: error.message,
          args: JSON.stringify(args.slice(0, 2)) // Log only first two args to avoid huge logs
        });
        throw error;
      }
    };
  }
}

// Create a singleton instance
const dbMemoryManager = new DbMemoryManager();

module.exports = {
  DbMemoryManager,
  dbMemoryManager,
  ConnectionState,
  registerConnection: (id, conn, opts) => dbMemoryManager.registerConnection(id, conn, opts),
  optimizeQuery: (fn, opts) => dbMemoryManager.optimizeQuery(fn, opts),
  getStatistics: () => dbMemoryManager.getStatistics(),
  analyzeQueryPerformance: () => dbMemoryManager.analyzeQueryPerformance(),
  clearQueryCache: () => dbMemoryManager.clearQueryCache()
}; 