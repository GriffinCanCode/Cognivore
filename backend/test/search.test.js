/**
 * Tests for search service
 */

const sinon = require('sinon');
const { semanticSearch } = require('../src/services/search');
const embeddingService = require('../src/services/embedding');
const databaseService = require('../src/services/database');

describe('Search Service', () => {
  // Set up global test collection for simulating database connection
  beforeAll(function() {
    // Create a mock collection object with the search method
    global.testCollection = {
      search: function() {
        return {
          limit: function() {
            return {
              execute: async function() {
                return [];
              }
            };
          }
        };
      }
    };
  });

  // Clean up after tests
  afterAll(function() {
    delete global.testCollection;
  });

  // Restore all stubs after each test
  afterEach(() => {
    sinon.restore();
  });
  
  describe('semanticSearch', () => {
    it('should generate embeddings for search query', async () => {
      // Setup stubs
      const generateEmbeddingStub = sinon.stub(embeddingService, 'generateEmbedding')
        .resolves(new Array(384).fill(0.1));
      
      // Replace the database vectorSearch method with our stub
      // Use callsFake to ensure the stub actually replaces the function call
      const vectorSearchStub = sinon.stub(databaseService, 'vectorSearch')
        .callsFake(async () => []);
      
      // Call the function
      await semanticSearch('test query');
      
      // Verify stubs were called with correct arguments
      expect(generateEmbeddingStub.calledOnce).toBe(true);
      expect(generateEmbeddingStub.firstCall.args[0]).toBe('test query');
    });
    
    it('should perform vector search with the generated embedding', async () => {
      // Mock embedding
      const mockEmbedding = new Array(384).fill(0.2);
      
      // Setup stubs
      sinon.stub(embeddingService, 'generateEmbedding').resolves(mockEmbedding);
      
      // Create a stub that runs the actual function wrapped with a spy
      const vectorSearchStub = sinon.stub(databaseService, 'vectorSearch');
      vectorSearchStub.callsFake(async (vector, limit) => {
        // Return empty results for testing
        return [];
      });
      
      // Call the function
      await semanticSearch('test query', 10);
      
      // Verify stubs were called with correct arguments
      expect(vectorSearchStub.called).toBe(true);
      
      // Check the arguments the stub was called with
      const callArgs = vectorSearchStub.firstCall.args;
      expect(callArgs[0]).toEqual(mockEmbedding);
      expect(callArgs[1]).toBe(10);
    });
    
    it('should format search results correctly', async () => {
      // Mock database results
      const mockResults = [
        {
          id: 'test-id-1',
          title: 'Test Document 1',
          source_type: 'pdf',
          source_identifier: 'test.pdf',
          text_chunks: ['This is a test chunk 1.'],
          _distance: 0.95,
          metadata: '{"author":"Test Author","date":"2023-01-01"}'
        },
        {
          id: 'test-id-2',
          title: 'Test Document 2',
          source_type: 'url',
          source_identifier: 'https://example.com',
          text_chunks: ['This is a test chunk 2.'],
          _distance: 0.85,
          metadata: '{"url":"https://example.com","date":"2023-01-02"}'
        }
      ];
      
      // Setup stubs
      sinon.stub(embeddingService, 'generateEmbedding')
        .resolves(new Array(384).fill(0.3));
      
      // Make sure to use callsFake to override the function behavior
      sinon.stub(databaseService, 'vectorSearch').callsFake(async () => mockResults);
      
      // Call the function
      const results = await semanticSearch('test query');
      
      // Verify results format
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(2);
      
      // Check first result
      expect(results[0]).toHaveProperty('id', 'test-id-1');
      expect(results[0]).toHaveProperty('title', 'Test Document 1');
      expect(results[0]).toHaveProperty('sourceType', 'pdf');
      expect(results[0]).toHaveProperty('sourceIdentifier', 'test.pdf');
      expect(results[0]).toHaveProperty('textChunk', 'This is a test chunk 1.');
      expect(results[0]).toHaveProperty('similarity', 0.95);
      expect(results[0]).toHaveProperty('metadata');
      expect(results[0].metadata).toEqual({
        author: 'Test Author',
        date: '2023-01-01'
      });
      
      // Check second result
      expect(results[1]).toHaveProperty('id', 'test-id-2');
      expect(results[1]).toHaveProperty('sourceType', 'url');
      expect(results[1]).toHaveProperty('similarity', 0.85);
    });
    
    it('should handle errors gracefully', async () => {
      // Setup stubs to throw an error
      sinon.stub(embeddingService, 'generateEmbedding')
        .rejects(new Error('Database not initialized'));
      
      // Call the function and verify error is thrown
      await expect(semanticSearch('test query')).rejects.toThrow('Database not initialized');
    });
    
    it('should handle metadata parsing errors', async () => {
      // Mock database results with invalid JSON
      const mockResults = [
        {
          id: 'test-id-1',
          title: 'Test Document 1',
          source_type: 'pdf',
          source_identifier: 'test.pdf',
          text_chunks: ['This is a test chunk 1.'],
          _distance: 0.95,
          metadata: '{invalid json'
        }
      ];
      
      // Setup stubs
      sinon.stub(embeddingService, 'generateEmbedding')
        .resolves(new Array(384).fill(0.3));
      
      // Make sure to use callsFake to override the function
      sinon.stub(databaseService, 'vectorSearch').callsFake(async () => mockResults);
      
      // Call the function
      const results = await semanticSearch('test query');
      
      // Verify results - should have an empty metadata object
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('metadata');
      expect(results[0].metadata).toEqual({});
    });
  });
}); 