/**
 * Tests for database operations
 * Using mocks since we don't want to actually interact with the database during tests
 */

// Mock the vectordb module
jest.mock('vectordb', () => {
  // Create simple mock functions that don't hold large object references
  const mockExecute = jest.fn().mockResolvedValue([
    { id: 'item1', title: 'Item 1', source_type: 'pdf', _distance: 0.1 },
    { id: 'item2', title: 'Item 2', source_type: 'url', _distance: 0.3 }
  ]);

  const mockLimit = jest.fn().mockReturnValue({ execute: mockExecute });
  
  const mockSearch = jest.fn().mockReturnValue({ limit: mockLimit });
  
  // Create mock collection with simple implementations
  const mockCollection = {
    add: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
    search: mockSearch
  };

  // Create a mock for connect function
  const mockDb = {
    openTable: jest.fn().mockImplementation((tableName) => {
      if (tableName === 'not_existing_table') {
        throw new Error('Table does not exist');
      }
      return mockCollection;
    }),
    createTable: jest.fn().mockReturnValue(mockCollection)
  };
  
  return {
    connect: jest.fn().mockReturnValue(mockDb)
  };
});

// Mock the memory module
jest.mock('../src/memory', () => {
  return {
    memoryManager: {
      monitorMemory: jest.fn().mockReturnValue({
        heapUsedMB: 100,
        heapTotalMB: 200,
        heapUsedRatio: 0.5,
        memoryUsageTrend: 'stable'
      })
    },
    batchOptimizer: {
      calculateOptimalBatchSize: jest.fn().mockReturnValue(100)
    },
    dbMemoryManager: {
      getConnectionStats: jest.fn().mockReturnValue({})
    },
    registerConnection: jest.fn().mockImplementation((name, conn) => conn),
    optimizeQuery: jest.fn().mockImplementation((fn) => fn),
    getStatistics: jest.fn().mockReturnValue({
      connections: {},
      queries: {},
      cache: { hits: 0, misses: 0 },
      memory: { heapUsedMB: 100 }
    }),
    analyzeQueryPerformance: jest.fn().mockReturnValue({
      issues: [],
      recommendations: []
    }),
    clearQueryCache: jest.fn()
  };
});

// Mock the fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// Mock the config
jest.mock('../src/config', () => ({
  database: {
    path: './data/vector_db',
    name: 'knowledge_store',
    collection: 'knowledge_items'
  },
  embeddings: {
    dimensions: 384
  },
  paths: {
    modelCache: './models',
    tempDir: './temp'
  }
}));

// Now load the database module which will use the mocks
const { 
  initializeDatabase, 
  addItem, 
  deleteItem, 
  listItems, 
  vectorSearch,
  getDatabaseStats,
  analyzeDatabasePerformance
} = require('../src/services/database');

const vectordb = require('vectordb');
const { 
  registerConnection, 
  optimizeQuery, 
  memoryManager, 
  getStatistics, 
  analyzeQueryPerformance 
} = require('../src/memory');

describe('Database Service', () => {
  beforeEach(() => {
    // Clear all mock implementation calls before each test
    jest.clearAllMocks();
  });
  
  // Run after all tests to clean up
  afterAll(() => {
    // Reset all mocks and clear memory
    jest.resetModules();
    jest.resetAllMocks();
  });
  
  describe('initializeDatabase', () => {
    test('should initialize database and return the collection', async () => {
      const result = await initializeDatabase();
      
      expect(result).toBeDefined();
      expect(result.db).toBeDefined();
      expect(result.collection).toBeDefined();
      
      // Check memory monitoring was called
      expect(memoryManager.monitorMemory).toHaveBeenCalledTimes(2);
      
      // Check connection registration
      expect(registerConnection).toHaveBeenCalledWith(
        'lancedb-main',
        expect.anything(),
        expect.objectContaining({
          type: 'vectordb',
          isPrimary: true
        })
      );
    });
    
    test('should create collection if it does not exist', async () => {
      // Set up mock to throw error when trying to open table
      vectordb.connect().openTable.mockImplementationOnce(() => {
        throw new Error('Table does not exist');
      });
      
      await initializeDatabase();
      
      // Should call createTable
      expect(vectordb.connect().createTable).toHaveBeenCalled();
    });
    
    test('should open existing collection if it exists', async () => {
      // Reset mock to return success
      vectordb.connect().openTable.mockReturnValueOnce({
        // Simple mock to prevent unhandled promise rejection
        add: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true),
        search: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue([])
        })
      });
      
      await initializeDatabase();
      
      // Should call openTable
      expect(vectordb.connect().openTable).toHaveBeenCalled();
    });
  });
  
  describe('addItem', () => {
    beforeEach(async () => {
      // Initialize database before each test
      await initializeDatabase();
    });
    
    test('should add an item to the collection', async () => {
      const mockItem = {
        id: 'test-id',
        title: 'Test Item',
        source_type: 'pdf'
      };
      
      const result = await addItem(mockItem);
      
      expect(result).toEqual(mockItem);
      // Check optimizeQuery was called during module initialization
      expect(optimizeQuery).toHaveBeenCalled();
    });
  });
  
  describe('deleteItem', () => {
    beforeEach(async () => {
      // Initialize database before each test
      await initializeDatabase();
    });
    
    test('should delete an item from the collection', async () => {
      const result = await deleteItem('test-id');
      
      expect(result).toBe(true);
    });
  });
  
  describe('listItems', () => {
    beforeEach(async () => {
      // Initialize database before each test
      await initializeDatabase();
    });
    
    test('should list items from the collection', async () => {
      const results = await listItems();
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0].id).toBe('item1');
      expect(results[1].id).toBe('item2');
    });
  });
  
  describe('vectorSearch', () => {
    beforeEach(async () => {
      // Initialize database before each test
      await initializeDatabase();
    });
    
    test('should perform a vector search and return results', async () => {
      const mockVector = new Array(384).fill(0.1);
      const results = await vectorSearch(mockVector, 2);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0].id).toBe('item1');
      expect(results[1].id).toBe('item2');
      
      // Check that memory was monitored before search
      expect(memoryManager.monitorMemory).toHaveBeenCalled();
    });
    
    test('should respect the limit parameter', async () => {
      const mockVector = new Array(384).fill(0.1);
      await vectorSearch(mockVector, 5);
      
      // Get the vectordb mock
      const searchMock = require('vectordb').connect().openTable().search;
      
      // Check that search was called with the vector
      expect(searchMock).toHaveBeenCalledWith(mockVector);
      
      // Check that limit was called with 5
      expect(searchMock().limit).toHaveBeenCalledWith(5);
    });
  });
  
  describe('Memory management functions', () => {
    test('getDatabaseStats should return statistics', () => {
      const stats = getDatabaseStats();
      
      expect(stats).toBeDefined();
      expect(stats.memory).toBeDefined();
      expect(stats.connections).toBeDefined();
      expect(stats.queries).toBeDefined();
      expect(stats.cache).toBeDefined();
      
      // Check that getStatistics was called
      expect(getStatistics).toHaveBeenCalled();
      expect(memoryManager.monitorMemory).toHaveBeenCalled();
    });
    
    test('analyzeDatabasePerformance should analyze performance', () => {
      const analysis = analyzeDatabasePerformance();
      
      expect(analysis).toBeDefined();
      expect(analysis.issues).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
      
      // Check that analyzeQueryPerformance was called
      expect(analyzeQueryPerformance).toHaveBeenCalled();
    });
  });
}); 