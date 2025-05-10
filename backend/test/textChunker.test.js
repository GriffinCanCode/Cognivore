/**
 * Tests for text chunking functionality
 */

const { cleanText, chunkByCharacters, chunkByParagraphs } = require('../src/utils/textChunker');

// Override the config dependency in the textChunker module
jest.mock('../src/config', () => ({
  processing: {
    chunkSize: 100,
    chunkOverlap: 20
  }
}));

describe('Text Chunker Utils', () => {
  describe('cleanText', () => {
    test('should normalize line breaks', () => {
      const input = 'Hello\r\nWorld';
      const expected = 'Hello\nWorld';
      expect(cleanText(input)).toBe(expected);
    });

    test('should replace multiple line breaks with two', () => {
      const input = 'Hello\n\n\n\nWorld';
      const expected = 'Hello\n\nWorld';
      expect(cleanText(input)).toBe(expected);
    });

    test('should replace multiple spaces with a single space', () => {
      const input = 'Hello    World';
      const expected = 'Hello World';
      expect(cleanText(input)).toBe(expected);
    });

    test('should trim leading and trailing whitespace', () => {
      const input = '  Hello World  ';
      const expected = 'Hello World';
      expect(cleanText(input)).toBe(expected);
    });
  });

  describe('chunkByCharacters', () => {
    test('should return the original text if smaller than chunk size', () => {
      const input = 'This is a short text';
      const expected = ['This is a short text'];
      expect(chunkByCharacters(input, 100, 20)).toEqual(expected);
    });

    test('should split text into chunks of appropriate size', () => {
      const input = 'This is a longer text that should be split into multiple chunks based on the configuration settings provided';
      const chunks = chunkByCharacters(input, 30, 10);
      
      // Check that chunks have appropriate size
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(30);
      });
      
      // Check that all content is preserved
      const reconstructed = chunks.join(' ').replace(/\s+/g, ' ').trim();
      const originalCleaned = input.replace(/\s+/g, ' ').trim();
      
      expect(reconstructed.includes(originalCleaned)).toBe(true);
    });

    test('should respect the overlap parameter', () => {
      const input = 'chunk1 chunk2 chunk3 chunk4 chunk5';
      const chunks = chunkByCharacters(input, 10, 5);
      
      // Check that chunks overlap appropriately
      for (let i = 0; i < chunks.length - 1; i++) {
        const currentChunkEnd = chunks[i].slice(-5);
        const nextChunkStart = chunks[i+1].slice(0, 5);
        
        // At least some overlap should exist
        expect(currentChunkEnd).toMatch(new RegExp(nextChunkStart.slice(0, 3)));
      }
    });
  });

  describe('chunkByParagraphs', () => {
    test('should split text by paragraphs', () => {
      const input = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
      const expected = ['Paragraph 1.', 'Paragraph 2.', 'Paragraph 3.'];
      expect(chunkByParagraphs(input, 100)).toEqual(expected);
    });

    test('should combine short paragraphs into chunks', () => {
      const input = 'Short 1.\n\nShort 2.\n\nShort 3.\n\nShort 4.';
      const chunks = chunkByParagraphs(input, 30);
      
      // Should be combined into fewer chunks
      expect(chunks.length).toBeLessThan(4);
    });

    test('should handle paragraphs that exceed max size', () => {
      const longParagraph = 'This is a very long paragraph that exceeds the maximum chunk size and should be split into multiple chunks.';
      const input = `Short paragraph.\n\n${longParagraph}\n\nAnother short one.`;
      
      const chunks = chunkByParagraphs(input, 30);
      
      // Should be more than 3 chunks due to splitting the long paragraph
      expect(chunks.length).toBeGreaterThan(3);
      
      // Each chunk should be within size limit
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(30);
      });
    });
  });
}); 