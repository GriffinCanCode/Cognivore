/**
 * Simplified tests for database operations
 * Using minimal mocks to avoid memory issues
 */

// Simple mocks to prevent memory issues
jest.mock('vectordb', () => {
  // Create basic mock functions
  const mockExecute = jest.fn().mockResolvedValue([
    { id: 'item1', title: 'Item 1', source_type: 'pdf' }
  ]);
  
  const mockLimit = jest.fn().mockReturnValue({ execute: mockExecute });
  const mockSearch = jest.fn().mockReturnValue({ limit: mockLimit });
  
  const mockCollection = {
    add: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
    search: mockSearch
  };

  return {
    connect: jest.fn().mockResolvedValue({
      openTable: jest.fn().mockResolvedValue(mockCollection),
      createTable: jest.fn().mockResolvedValue(mockCollection)
    })
  };
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// Mock config
jest.mock('../src/config', () => ({
  database: { path: './test-db', collection: 'test-items' },
  embeddings: { dimensions: 384 }
}));

// Import database module
const database = require('../src/services/database');

describe('Database Service (Simplified)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetModules();
  });

  test('should initialize database successfully', async () => {
    const result = await database.initializeDatabase();
    expect(result).toBeDefined();
  });

  test('should list items using search as workaround', async () => {
    await database.initializeDatabase();
    const items = await database.listItems();
    
    expect(Array.isArray(items)).toBe(true);
    
    // Check that we're using the search method with a zero vector
    const vectordb = require('vectordb');
    const searchMock = vectordb.connect().openTable().search;
    
    expect(searchMock).toHaveBeenCalled();
    
    // Check that the limit method was called
    expect(searchMock().limit).toHaveBeenCalled();
  });
}); 