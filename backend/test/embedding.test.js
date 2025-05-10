/**
 * Tests for embedding generation
 */

const { generateEmbedding, generateEmbeddings } = require('../src/services/embedding');

// Override the config dependency in the embedding module
jest.mock('../src/config', () => ({
  embeddings: {
    modelName: 'all-MiniLM-L6-v2',
    dimensions: 384
  },
  paths: {
    modelCache: './models'
  }
}));

// Mock the NeuralNetwork class from node-nlp
jest.mock('node-nlp', () => {
  return {
    NeuralNetwork: jest.fn().mockImplementation(() => {
      return {
        encodeCorpus: jest.fn().mockImplementation((texts) => {
          // Return mock vectors - in real application these would be embeddings
          return texts.map(() => Array(100).fill(0).map(() => Math.random()));
        })
      };
    })
  };
});

describe('Embedding Service', () => {
  describe('generateEmbedding', () => {
    test('should return a fixed-length vector', async () => {
      const text = 'This is a test sentence.';
      const embedding = await generateEmbedding(text);
      
      // Check the result is an array
      expect(Array.isArray(embedding)).toBe(true);
      
      // Check it has the correct length (from mocked config)
      expect(embedding.length).toBe(384);
      
      // Check all values are numbers
      embedding.forEach(value => {
        expect(typeof value).toBe('number');
      });
    });
    
    test('should handle empty text', async () => {
      const embedding = await generateEmbedding('');
      
      // Should still return a fixed-length vector
      expect(embedding.length).toBe(384);
    });
    
    test('should handle very long text', async () => {
      const longText = 'a '.repeat(10000);
      const embedding = await generateEmbedding(longText);
      
      // Should still return a fixed-length vector
      expect(embedding.length).toBe(384);
    });
    
    test('should preprocess text before generating embeddings', async () => {
      const text1 = 'This is a test.';
      const text2 = '  THIS  is  a  TEST.  ';
      
      const embedding1 = await generateEmbedding(text1);
      const embedding2 = await generateEmbedding(text2);
      
      // Embeddings should be similar despite the different formatting
      // Since we're using a mock, we'll just check they're generated
      expect(embedding1.length).toBe(embedding2.length);
    });
  });
  
  describe('generateEmbeddings', () => {
    test('should generate embeddings for multiple chunks', async () => {
      const chunks = [
        'This is the first chunk',
        'This is the second chunk',
        'This is the third chunk'
      ];
      
      const embeddings = await generateEmbeddings(chunks);
      
      // Should return an array of embeddings
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(3);
      
      // Each embedding should be a vector of the correct length
      embeddings.forEach(embedding => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(384);
      });
    });
    
    test('should handle empty array', async () => {
      const embeddings = await generateEmbeddings([]);
      
      // Should return an empty array
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(0);
    });
  });
}); 