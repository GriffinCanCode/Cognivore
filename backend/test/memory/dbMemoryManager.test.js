/**
 * Tests for database memory manager utilities
 */

const { 
  DbMemoryManager, 
  dbMemoryManager,
  registerConnection,
  optimizeQuery,
  ConnectionState
} = require('../../src/memory/dbMemoryManager');

describe('Database Memory Manager', () => {
  
  describe('DbMemoryManager Creation', () => {
    it('should create a database memory manager instance', () => {
      const manager = new DbMemoryManager({
        maxConnections: 5,
        enableResultCache: true,
        debug: true
      });
      
      expect(manager).toBeInstanceOf(DbMemoryManager);
      expect(manager.options.maxConnections).toBe(5);
      expect(manager.options.enableResultCache).toBe(true);
      expect(manager.options.debug).toBe(true);
    });
    
    it('should use default options when not specified', () => {
      const manager = new DbMemoryManager();
      
      expect(manager.options.maxConnections).toBe(10);
      expect(manager.options.enableResultCache).toBe(true);
      expect(manager.options.debug).toBe(false);
    });
  });
  
  describe('Connection Registration', () => {
    it('should register and wrap a database connection', () => {
      // Mock database connection
      const mockConnection = {
        query: jest.fn().mockResolvedValue([{ id: 1, name: 'Test' }]),
        close: jest.fn()
      };
      
      const wrappedConnection = registerConnection('conn1', mockConnection, {
        type: 'postgres',
        isPrimary: true
      });
      
      // Wrapped connection should still have the original methods
      expect(typeof wrappedConnection.query).toBe('function');
      expect(typeof wrappedConnection.close).toBe('function');
      
      // The original query function should be wrapped, not replaced
      expect(wrappedConnection.query).not.toBe(mockConnection.query);
    });
    
    it('should throw an error for invalid connection registration', () => {
      expect(() => {
        registerConnection(null, {});
      }).toThrow();
      
      expect(() => {
        registerConnection('conn2', null);
      }).toThrow();
    });
  });
  
  describe('Query Optimization', () => {
    it('should optimize a query function and maintain its behavior', async () => {
      // Mock query function
      const mockQueryFn = jest.fn().mockResolvedValue([{ id: 1, name: 'Test' }]);
      
      const optimizedFn = optimizeQuery(mockQueryFn, {
        queryName: 'findUsers',
        enableCache: true
      });
      
      // First call should execute the query
      const result1 = await optimizedFn({ userId: 1 });
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      expect(result1).toEqual([{ id: 1, name: 'Test' }]);
      
      // Second call with same args should use cache
      const result2 = await optimizedFn({ userId: 1 });
      expect(mockQueryFn).toHaveBeenCalledTimes(1); // Still only called once
      expect(result2).toEqual([{ id: 1, name: 'Test' }]);
      
      // Call with different args should execute again
      await optimizedFn({ userId: 2 });
      expect(mockQueryFn).toHaveBeenCalledTimes(2);
    });
    
    it('should not cache when caching is disabled', async () => {
      // Mock query function
      const mockQueryFn = jest.fn().mockResolvedValue([{ id: 1, name: 'Test' }]);
      
      const optimizedFn = optimizeQuery(mockQueryFn, {
        queryName: 'findUsers',
        enableCache: false // Disable caching
      });
      
      // First call
      await optimizedFn({ userId: 1 });
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      
      // Second call should still execute the query
      await optimizedFn({ userId: 1 });
      expect(mockQueryFn).toHaveBeenCalledTimes(2);
    });
    
    it('should throw an error for invalid query function', () => {
      expect(() => {
        optimizeQuery('not a function');
      }).toThrow();
    });
  });
  
  describe('Query Execution Monitoring', () => {
    it('should track and cache query execution results', async () => {
      // Create a fresh instance for this test
      const manager = new DbMemoryManager({
        maxQueryCacheSize: 5,
        enableResultCache: true
      });
      
      // Mock connection and query
      const mockConnection = {
        query: jest.fn().mockImplementation((query) => {
          // Return different results based on query
          if (query === 'SELECT * FROM users') {
            return Promise.resolve([{ id: 1, name: 'User 1' }]);
          }
          return Promise.resolve([]);
        })
      };
      
      const wrappedConnection = manager.registerConnection('test-conn', mockConnection);
      
      // Execute the query
      const result1 = await wrappedConnection.query('SELECT * FROM users');
      expect(result1).toEqual([{ id: 1, name: 'User 1' }]);
      expect(mockConnection.query).toHaveBeenCalledTimes(1);
      
      // Execute the same query again - should use cache
      const result2 = await wrappedConnection.query('SELECT * FROM users');
      expect(result2).toEqual([{ id: 1, name: 'User 1' }]);
      expect(mockConnection.query).toHaveBeenCalledTimes(1); // Still just 1 call
      
      // Get statistics to verify tracking
      const stats = manager.getStatistics();
      expect(stats.queries.total).toBe(2);
      expect(stats.queries.cacheHits).toBe(1);
      expect(stats.queries.cacheMisses).toBe(1);
      expect(stats.cache.size).toBeGreaterThan(0);
    });
  });
  
  describe('Cache Management', () => {
    it('should clear the query cache', () => {
      // Create a manager instance
      const manager = new DbMemoryManager();
      
      // Simulate some cached queries by directly accessing internal cache
      manager._queryCache.set('key1', { data: 'test1' });
      manager._queryCache.set('key2', { data: 'test2' });
      manager._queryTimestamps.set('key1', Date.now());
      manager._queryTimestamps.set('key2', Date.now());
      
      expect(manager._queryCache.size).toBe(2);
      
      // Clear cache
      manager.clearQueryCache();
      
      // Verify cache is empty
      expect(manager._queryCache.size).toBe(0);
      expect(manager._queryTimestamps.size).toBe(0);
    });
  });
  
  describe('Statistics and Analysis', () => {
    it('should provide statistics about database operations', () => {
      const manager = new DbMemoryManager();
      
      // Add some connection info for testing
      manager._connections.set('conn1', { 
        id: 'conn1', 
        state: ConnectionState.IDLE, 
        queryCount: 10 
      });
      manager._connections.set('conn2', { 
        id: 'conn2', 
        state: ConnectionState.BUSY, 
        queryCount: 5 
      });
      
      // Update statistics
      manager._statistics.totalQueries = 15;
      manager._statistics.cacheHits = 5;
      manager._statistics.cacheMisses = 10;
      manager._statistics.totalQueryTime = 1500;
      
      const stats = manager.getStatistics();
      
      expect(stats.connections.total).toBe(2);
      expect(stats.connections.busy).toBe(1);
      expect(stats.queries.total).toBe(15);
      expect(stats.queries.hitRatio).toBe('33.3%');
      expect(stats.queries.avgQueryTime).toBe('100.00ms');
    });
    
    it('should analyze query performance and provide recommendations', () => {
      const manager = new DbMemoryManager();
      
      // Simulate some statistics for analysis
      manager._statistics.totalQueries = 200;
      manager._statistics.cacheHits = 40;
      manager._statistics.cacheMisses = 160;
      manager._statistics.largeResults = 5;
      
      // Add connections
      manager._connections.set('conn1', { 
        id: 'conn1', 
        state: ConnectionState.IDLE
      });
      manager._connections.set('conn2', { 
        id: 'conn2', 
        state: ConnectionState.BUSY
      });
      
      const analysis = manager.analyzeQueryPerformance();
      
      expect(analysis).toHaveProperty('statistics');
      expect(analysis).toHaveProperty('issues');
      expect(analysis).toHaveProperty('recommendations');
      
      // Should detect low cache hit ratio
      expect(analysis.issues.some(i => i.type === 'low_cache_hit_ratio')).toBe(true);
      
      // Should recommend caching improvement
      expect(analysis.recommendations.some(r => r.type === 'improve_caching')).toBe(true);
      
      // Should detect large result sets
      expect(analysis.issues.some(i => i.type === 'large_result_sets')).toBe(true);
    });
  });
}); 