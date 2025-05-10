/**
 * Tests for database operations
 * Using mocks since we don't want to actually interact with the database during tests
 */

// Mock the LanceDB module
jest.mock('@lancedb/lancedb', () => {
  // Create mock collection
  const mockCollection = {
    add: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
    select: jest.fn().mockReturnValue({
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

  // Create mock db
  const mockDb = {
    tableNames: jest.fn().mockResolvedValue(['knowledge_items']),
    createTable: jest.fn().mockResolvedValue(mockCollection),
    openTable: jest.fn().mockResolvedValue(mockCollection)
  };

  return {
    connect: jest.fn().mockResolvedValue(mockDb)
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
      // Mock that table doesn't exist yet
      const lancedb = require('@lancedb/lancedb');
      lancedb.connect().tableNames.mockResolvedValueOnce([]);
      
      await initializeDatabase();
      
      // Should call createTable
      expect(lancedb.connect().createTable).toHaveBeenCalled();
    });
    
    test('should open existing collection if it exists', async () => {
      // Mock that table already exists
      const lancedb = require('@lancedb/lancedb');
      lancedb.connect().tableNames.mockResolvedValueOnce(['knowledge_items']);
      
      await initializeDatabase();
      
      // Should call openTable, not createTable
      expect(lancedb.connect().openTable).toHaveBeenCalled();
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
      const mockVector = new Array(384).fill(0.1);
      await vectorSearch(mockVector, 5);
      
      // Check that the limit method was called with 5
      const lancedb = require('@lancedb/lancedb');
      const collection = lancedb.connect().openTable();
      expect(collection.search().limit).toHaveBeenCalledWith(5);
    });
  });
}); 