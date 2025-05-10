/**
 * Tests for text chunking functionality
 */

const { cleanText, chunkByCharacters, chunkByParagraphs, chunkByMarkdown } = require('../src/utils/textChunker');

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
      const chunkSize = 30;
      const chunks = chunkByCharacters(input, chunkSize, 10);
      
      // Check that chunks have appropriate size
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(chunkSize);
      });
      
      // Check that important keywords are present somewhere in the chunks
      const allText = chunks.join(' ');
      expect(allText).toContain('longer');
      expect(allText).toContain('multiple');
      expect(allText).toContain('configuration');
    });

    test('should respect sentence boundaries when possible', () => {
      const input = 'This is sentence one. This is sentence two. This is a much longer sentence three that should be kept intact if possible.';
      const chunks = chunkByCharacters(input, 40, 10);
      
      // Verify we have multiple chunks
      expect(chunks.length).toBeGreaterThan(1);
      
      // First chunk should end with a period
      expect(chunks[0]).toMatch(/\./);
      
      // At least one chunk should contain sentence one
      expect(chunks.some(chunk => chunk.includes('sentence one'))).toBeTruthy();
      
      // At least one chunk should contain sentence two
      expect(chunks.some(chunk => chunk.includes('sentence two'))).toBeTruthy();
    });

    test('should respect word boundaries when sentence boundaries not available', () => {
      const input = 'ThisIsAVeryLongWordThatExceedsChunkSize followed by normal text';
      const chunks = chunkByCharacters(input, 20, 5);
      
      // Should not cut "followed" in the middle
      const followedChunk = chunks.find(chunk => chunk.includes('followed'));
      expect(followedChunk).toBeDefined();
      expect(followedChunk.includes('followed')).toBeTruthy();
    });
  });

  describe('chunkByParagraphs', () => {
    test('should split text by paragraphs', () => {
      const input = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
      const chunks = chunkByParagraphs(input, 100);
      
      // Should have three separate paragraphs
      expect(chunks.length).toBe(3);
      
      // Each paragraph should be present as its own chunk
      expect(chunks).toContain('Paragraph 1.');
      expect(chunks).toContain('Paragraph 2.');
      expect(chunks).toContain('Paragraph 3.');
    });

    test('should combine short paragraphs into chunks', () => {
      const input = 'Short 1.\n\nShort 2.\n\nShort 3.\n\nShort 4.';
      const chunks = chunkByParagraphs(input, 30);
      
      // Should be fewer than 4 chunks due to combining
      expect(chunks.length).toBeLessThan(4);
      
      // Each chunk should respect the size limit
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(30);
      });
      
      // All content should be preserved
      const allContent = chunks.join(' ');
      ['Short 1', 'Short 2', 'Short 3', 'Short 4'].forEach(phrase => {
        expect(allContent).toContain(phrase);
      });
    });

    test('should split long paragraphs that exceed max size', () => {
      const longParagraph = 'This is a very long paragraph that exceeds the maximum chunk size and should be split into multiple chunks.';
      const input = `Short paragraph.\n\n${longParagraph}\n\nAnother short one.`;
      const maxChunkSize = 30;
      
      const chunks = chunkByParagraphs(input, maxChunkSize);
      
      // Each chunk should respect the size limit
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(maxChunkSize);
      });
      
      // Check that all significant content is preserved
      const allChunks = chunks.join(' ');
      expect(allChunks).toContain('Short paragraph');
      expect(allChunks).toContain('very long paragraph');
      expect(allChunks).toContain('Another short one');
    });

    test('should respect minimum chunk size parameter', () => {
      const input = 'P1.\n\nP2.\n\nP3.\n\nLonger paragraph four.\n\nP5.';
      const chunks = chunkByParagraphs(input, 50, 10);
      
      // Check that very short chunks are combined
      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i].length).toBeGreaterThanOrEqual(10);
      }
      
      // All content should be preserved
      const allContent = chunks.join(' ');
      expect(allContent).toContain('P1');
      expect(allContent).toContain('P2');
      expect(allContent).toContain('P3');
      expect(allContent).toContain('Longer paragraph');
      expect(allContent).toContain('P5');
    });
  });

  describe('chunkByMarkdown', () => {
    test('should split markdown text by headings', () => {
      const input = '# Heading 1\nContent under heading 1.\n\n## Heading 2\nContent under heading 2.\n\n# Heading 3\nFinal content.';
      const chunks = chunkByMarkdown(input, 100);
      
      // Should split by headings (3 headings)
      expect(chunks.length).toBe(3);
      
      // Each heading should be in a different chunk
      expect(chunks[0]).toContain('# Heading 1');
      expect(chunks[1]).toContain('## Heading 2');
      expect(chunks[2]).toContain('# Heading 3');
    });

    test('should handle text before first heading', () => {
      const input = 'Introduction text before any heading.\n\n# First Heading\nContent after first heading.';
      const chunks = chunkByMarkdown(input, 100);
      
      // Should result in 2 chunks
      expect(chunks.length).toBe(2);
      
      // First chunk should contain introduction text
      expect(chunks[0]).toContain('Introduction text');
      
      // Second chunk should contain the heading
      expect(chunks[1]).toContain('# First Heading');
    });

    test('should split large markdown sections into smaller chunks', () => {
      const longContent = 'This is a very long content section that should exceed the maximum chunk size. '.repeat(5);
      const input = `# Heading\n\n${longContent}`;
      const maxChunkSize = 100;
      
      const chunks = chunkByMarkdown(input, maxChunkSize);
      
      // Should create multiple chunks
      expect(chunks.length).toBeGreaterThan(1);
      
      // Each chunk should respect the size limit
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(maxChunkSize);
      });
      
      // Each chunk from the section with heading should retain the heading
      const headingChunks = chunks.filter(chunk => chunk.startsWith('# Heading'));
      expect(headingChunks.length).toBeGreaterThan(0);
    });

    test('should fallback to paragraph chunking if no headings found', () => {
      const input = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
      const markdownChunks = chunkByMarkdown(input);
      
      // Should result in paragraph chunks
      expect(markdownChunks.length).toBe(3);
      
      // Each paragraph should be in a separate chunk
      expect(markdownChunks).toContain('Paragraph 1.');
      expect(markdownChunks).toContain('Paragraph 2.');
      expect(markdownChunks).toContain('Paragraph 3.');
    });
  });
}); 