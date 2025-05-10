/**
 * Tests for database operations
 * Using mocks since we don't want to actually interact with the database during tests
 */

// Mock the vectordb module
jest.mock('vectordb', () => {
  // Create mock collection
  const mockCollection = {
    add: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
    query: jest.fn().mockReturnValue({
      execute: jest.fn().mockResolvedValue([
        { id: 'item1', title: 'Item 1', source_type: 'pdf' },
        { id: 'item2', title: 'Item 2', source_type: 'url' }
      ])
    }),
    search: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue([
        { id: 'item1', title: 'Item 1', source_type: 'pdf', _distance: 0.1 },
        { id: 'item2', title: 'Item 2', source_type: 'url', _distance: 0.3 }
      ])
    })
  };

  // Create a mock for connect function
  const connectMock = jest.fn();
  
  // Mock db object with methods
  const mockDb = {
    openTable: jest.fn(),
    createTable: jest.fn()
  };
  
  // Set up connect to return the mockDb
  connectMock.mockReturnValue(mockDb);
  
  // Set up handling for both success and failure cases
  mockDb.openTable.mockImplementation((tableName) => {
    if (tableName === 'not_existing_table') {
      throw new Error('Table does not exist');
    }
    return mockCollection;
  });
  
  mockDb.createTable.mockReturnValue(mockCollection);
  
  return {
    connect: connectMock
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
const { initializeDatabase, addItem, deleteItem, listItems, vectorSearch } = require('../src/services/database');
const vectordb = require('vectordb');

describe('Database Service', () => {
  beforeEach(() => {
    // Clear all mock implementation calls before each test
    jest.clearAllMocks();
  });
  
  describe('initializeDatabase', () => {
    test('should initialize database and return the collection', async () => {
      const result = await initializeDatabase();
      
      expect(result).toBeDefined();
      expect(result.db).toBeDefined();
      expect(result.collection).toBeDefined();
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
        query: jest.fn().mockReturnValue({
          execute: jest.fn().mockResolvedValue([])
        }),
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
    });
    
    test('should respect the limit parameter', async () => {
      const searchMock = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([])
      });
      
      // Set up the search mock for our collection
      const collectionMock = {
        search: searchMock
      };
      
      // Make sure we use this mock
      vectordb.connect().openTable.mockReturnValueOnce(collectionMock);
      
      // Re-initialize to get our new mock
      await initializeDatabase();
      
      const mockVector = new Array(384).fill(0.1);
      await vectorSearch(mockVector, 5);
      
      // Check that search was called with the vector
      expect(searchMock).toHaveBeenCalledWith(mockVector);
      
      // Check that limit was called with 5
      expect(searchMock().limit).toHaveBeenCalledWith(5);
    });
  });
}); 