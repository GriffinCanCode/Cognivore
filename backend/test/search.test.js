/**
 * Tests for search service
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { semanticSearch } = require('../src/services/search');
const embeddingService = require('../src/services/embedding');
const databaseService = require('../src/services/database');

describe('Search Service', () => {
  // Restore all stubs after each test
  afterEach(() => {
    sinon.restore();
  });
  
  describe('semanticSearch', () => {
    it('should generate embeddings for search query', async () => {
      // Setup stubs
      const generateEmbeddingStub = sinon.stub(embeddingService, 'generateEmbedding')
        .resolves(new Array(384).fill(0.1));
      const vectorSearchStub = sinon.stub(databaseService, 'vectorSearch')
        .resolves([]);
      
      // Call the function
      await semanticSearch('test query');
      
      // Verify stubs were called with correct arguments
      expect(generateEmbeddingStub.calledOnce).to.be.true;
      expect(generateEmbeddingStub.firstCall.args[0]).to.equal('test query');
    });
    
    it('should perform vector search with the generated embedding', async () => {
      // Mock embedding
      const mockEmbedding = new Array(384).fill(0.2);
      
      // Setup stubs
      sinon.stub(embeddingService, 'generateEmbedding').resolves(mockEmbedding);
      const vectorSearchStub = sinon.stub(databaseService, 'vectorSearch')
        .resolves([]);
      
      // Call the function
      await semanticSearch('test query', 10);
      
      // Verify stubs were called with correct arguments
      expect(vectorSearchStub.calledOnce).to.be.true;
      expect(vectorSearchStub.firstCall.args[0]).to.deep.equal(mockEmbedding);
      expect(vectorSearchStub.firstCall.args[1]).to.equal(10);
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
      sinon.stub(databaseService, 'vectorSearch').resolves(mockResults);
      
      // Call the function
      const results = await semanticSearch('test query');
      
      // Verify results format
      expect(results).to.be.an('array').with.lengthOf(2);
      
      // Check first result
      expect(results[0]).to.have.property('id', 'test-id-1');
      expect(results[0]).to.have.property('title', 'Test Document 1');
      expect(results[0]).to.have.property('sourceType', 'pdf');
      expect(results[0]).to.have.property('sourceIdentifier', 'test.pdf');
      expect(results[0]).to.have.property('textChunk', 'This is a test chunk 1.');
      expect(results[0]).to.have.property('similarity', 0.95);
      expect(results[0]).to.have.property('metadata').that.deep.equals({
        author: 'Test Author',
        date: '2023-01-01'
      });
      
      // Check second result
      expect(results[1]).to.have.property('id', 'test-id-2');
      expect(results[1]).to.have.property('sourceType', 'url');
      expect(results[1]).to.have.property('similarity', 0.85);
    });
    
    it('should handle errors gracefully', async () => {
      // Setup stubs to throw an error
      sinon.stub(embeddingService, 'generateEmbedding')
        .rejects(new Error('Test error'));
      
      // Call the function and verify error is thrown
      try {
        await semanticSearch('test query');
        // If we get here, the test failed
        expect.fail('Function should have thrown an error');
      } catch (error) {
        expect(error).to.be.an('error');
        expect(error.message).to.equal('Test error');
      }
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
      sinon.stub(databaseService, 'vectorSearch').resolves(mockResults);
      
      // Call the function
      const results = await semanticSearch('test query');
      
      // Verify results - should have an empty metadata object
      expect(results[0]).to.have.property('metadata').that.deep.equals({});
    });
  });
}); 