/**
 * Test file for database.js RAG functions
 */

const { describe, it, beforeEach, afterEach, expect, jest: _jest } = require('@jest/globals');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Database RAG Functions', () => {
  let sandbox;
  let dbModule;
  let mockCollection;
  let mockDbMemoryManager;
  let mockMemoryManager;
  let mockConfig;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock the collection with search function
    mockCollection = {
      search: sandbox.stub().returnsThis(),
      limit: sandbox.stub().returnsThis(),
      execute: sandbox.stub().resolves([
        {
          id: 'doc1',
          title: 'Test Document 1',
          source_type: 'pdf',
          source_identifier: 'test1.pdf',
          score: 0.95,
          text_chunks: ['This is the content of test document 1.'],
          metadata: JSON.stringify({ author: 'Test Author', date: '2023-01-01' }),
          vector: [0.1, 0.2, 0.3]
        },
        {
          id: 'doc2',
          title: 'Test Document 2',
          source_type: 'url',
          source_identifier: 'https://example.com',
          score: 0.85,
          text_chunks: ['This is the content of test document 2.'],
          metadata: JSON.stringify({ source: 'Web', date: '2023-02-01' }),
          vector: [0.2, 0.3, 0.4]
        }
      ])
    };
    
    // Mock memory management
    mockMemoryManager = {
      monitorMemory: sandbox.stub().returns({ heapUsedMB: 100, heapUsedRatio: 0.5 })
    };
    
    mockDbMemoryManager = {
      executeWithMemoryCheck: sandbox.stub().callsFake(async (fn) => fn())
    };
    
    // Mock config
    mockConfig = {
      embeddings: {
        dimensions: 768
      }
    };
    
    // Mock logger
    const mockLogger = {
      debug: sandbox.stub(),
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub()
    };
    
    // Proxy the module to use our mocks
    dbModule = proxyquire('../../src/services/database', {
      '../memory': {
        memoryManager: mockMemoryManager,
        dbMemoryManager: mockDbMemoryManager,
        optimizeQuery: (fn, options) => fn, // Just return the function
        getStatistics: sandbox.stub().returns({ connections: [], queries: [], cache: {} }),
        analyzeQueryPerformance: sandbox.stub().returns({})
      },
      '../utils/logger': {
        createContextLogger: () => mockLogger
      },
      '../config': mockConfig
    });
    
    // Set the collection directly (usually done by initializeDatabase)
    dbModule.collection = mockCollection;
    global.testCollection = mockCollection;
  });

  afterEach(() => {
    sandbox.restore();
    delete global.testCollection;
  });

  describe('semanticSearch', () => {
    it('should perform a semantic search with default options', async () => {
      const query = 'test query';
      const queryVector = [0.1, 0.2, 0.3];
      
      const results = await dbModule.semanticSearch(query, queryVector);
      
      expect(mockCollection.search.calledOnce).toBe(true);
      expect(mockCollection.search.calledWith(queryVector)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0].id).toBe('doc1');
      expect(results[0].title).toBe('Test Document 1');
      expect(results[0].content).toBeDefined();
      expect(results[0].metadata).toBeDefined();
    });
    
    it('should filter results based on minimum relevance score', async () => {
      const query = 'test query';
      const queryVector = [0.1, 0.2, 0.3];
      
      // Set one result to have a low score
      mockCollection.execute.resolves([
        {
          id: 'doc1',
          title: 'Test Document 1',
          source_type: 'pdf',
          score: 0.95,
          text_chunks: ['Content 1'],
          metadata: '{}'
        },
        {
          id: 'doc2',
          title: 'Test Document 2',
          source_type: 'url',
          score: 0.45, // Below threshold
          text_chunks: ['Content 2'],
          metadata: '{}'
        }
      ]);
      
      const results = await dbModule.semanticSearch(query, queryVector, { 
        minRelevanceScore: 0.6
      });
      
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('doc1');
    });
    
    it('should respect the maxTotalTokens limit', async () => {
      const query = 'test query';
      const queryVector = [0.1, 0.2, 0.3];
      
      // Set up long content that will exceed token limit
      mockCollection.execute.resolves([
        {
          id: 'doc1',
          title: 'Test Document 1',
          source_type: 'pdf',
          score: 0.95,
          text_chunks: ['A'.repeat(8000)], // ~2000 tokens
          metadata: '{}'
        },
        {
          id: 'doc2',
          title: 'Test Document 2',
          source_type: 'url',
          score: 0.85,
          text_chunks: ['B'.repeat(8000)], // ~2000 tokens
          metadata: '{}'
        }
      ]);
      
      const results = await dbModule.semanticSearch(query, queryVector, { 
        maxTotalTokens: 2500 // Only enough for one document
      });
      
      expect(results.length).toBe(1);
    });
  });

  describe('getItemById', () => {
    it('should retrieve an item by ID', async () => {
      const id = 'doc1';
      
      const item = await dbModule.getItemById(id);
      
      expect(mockCollection.search.calledOnce).toBe(true);
      expect(item.id).toBe('doc1');
      expect(item.title).toBe('Test Document 1');
      expect(item.content).toBeDefined();
    });
    
    it('should handle missing items', async () => {
      const id = 'nonexistent';
      
      // Mock the collection to return empty results
      mockCollection.execute.resolves([]);
      
      await expect(dbModule.getItemById(id)).rejects.toThrow(/Item with ID nonexistent not found/);
    });
    
    it('should respect the includeVector option', async () => {
      const id = 'doc1';
      
      // Test with includeVector=true
      const itemWithVector = await dbModule.getItemById(id, { includeVector: true });
      expect(itemWithVector.vector).toBeDefined();
      
      // Test with includeVector=false
      const itemWithoutVector = await dbModule.getItemById(id, { includeVector: false });
      expect(itemWithoutVector.vector).toBeUndefined();
    });
  });
}); 