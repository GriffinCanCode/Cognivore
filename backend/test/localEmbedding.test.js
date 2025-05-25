/**
 * Tests for local embedding service
 */

const { LocalEmbeddingService } = require('../src/services/localEmbedding');

describe('LocalEmbeddingService', () => {
  let embeddingService;

  beforeAll(async () => {
    embeddingService = new LocalEmbeddingService();
    // Wait for initialization
    await embeddingService.ensureInitialized();
  });

  test('should initialize successfully', async () => {
    expect(embeddingService.isInitialized).toBe(true);
    expect(embeddingService.getDimensions()).toBe(384);
  });

  test('should generate embeddings for simple text', async () => {
    const text = 'This is a test document about technology.';
    const embedding = await embeddingService.generateEmbedding(text);
    
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);
    
    // Check that embedding is normalized (magnitude should be close to 1)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).toBeCloseTo(1, 2);
  });

  test('should generate consistent embeddings for same text', async () => {
    const text = 'Consistent text for testing.';
    const embedding1 = await embeddingService.generateEmbedding(text);
    const embedding2 = await embeddingService.generateEmbedding(text);
    
    expect(embedding1).toEqual(embedding2);
  });

  test('should generate different embeddings for different text', async () => {
    const text1 = 'This is about technology and computers.';
    const text2 = 'This is about cooking and recipes.';
    
    const embedding1 = await embeddingService.generateEmbedding(text1);
    const embedding2 = await embeddingService.generateEmbedding(text2);
    
    expect(embedding1).not.toEqual(embedding2);
    
    // Calculate similarity - should be less than 1 (not identical)
    const similarity = embeddingService.calculateSimilarity(embedding1, embedding2);
    expect(similarity).toBeLessThan(1);
    expect(similarity).toBeGreaterThan(-1);
  });

  test('should handle tab clustering content format', async () => {
    const tabContent = `Title: Example Website
URL: https://example.com
Content: This is an example website with some content about technology.
Keywords: technology, example, website`;
    
    const embedding = await embeddingService.generateEmbedding(tabContent);
    
    expect(embedding).toBeDefined();
    expect(embedding.length).toBe(384);
  });

  test('should generate embeddings for multiple texts', async () => {
    const texts = [
      'First document about science',
      'Second document about technology',
      'Third document about business'
    ];
    
    const embeddings = await embeddingService.generateEmbeddings(texts);
    
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(3);
    embeddings.forEach(embedding => {
      expect(embedding.length).toBe(384);
    });
  });

  test('should calculate similarity correctly', () => {
    const vector1 = [1, 0, 0];
    const vector2 = [0, 1, 0];
    const vector3 = [1, 0, 0];
    
    // Orthogonal vectors should have 0 similarity
    const similarity1 = embeddingService.calculateSimilarity(vector1, vector2);
    expect(similarity1).toBeCloseTo(0, 5);
    
    // Identical vectors should have 1 similarity
    const similarity2 = embeddingService.calculateSimilarity(vector1, vector3);
    expect(similarity2).toBeCloseTo(1, 5);
  });

  test('should handle empty or invalid input gracefully', async () => {
    // Empty string should still return an embedding
    const embedding1 = await embeddingService.generateEmbedding('');
    expect(embedding1).toBeDefined();
    expect(embedding1.length).toBe(384);
    
    // Very short text should work
    const embedding2 = await embeddingService.generateEmbedding('a');
    expect(embedding2).toBeDefined();
    expect(embedding2.length).toBe(384);
  });

  test('should use caching effectively', async () => {
    const text = 'Text for caching test';
    
    // Clear cache first
    embeddingService.clearCache();
    
    // First call should generate embedding
    const start1 = Date.now();
    const embedding1 = await embeddingService.generateEmbedding(text);
    const time1 = Date.now() - start1;
    
    // Second call should use cache (should be faster)
    const start2 = Date.now();
    const embedding2 = await embeddingService.generateEmbedding(text);
    const time2 = Date.now() - start2;
    
    expect(embedding1).toEqual(embedding2);
    expect(time2).toBeLessThan(time1); // Cached call should be faster
  });
}); 