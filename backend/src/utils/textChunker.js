/**
 * Text Chunker Utility
 * Responsible for splitting text into chunks for processing and embedding
 */

const config = require('../config');

/**
 * Clean text by removing extra whitespace, normalizing line breaks, etc.
 * @param {string} text The text to clean
 * @returns {string} The cleaned text
 */
function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n') // Normalize line breaks
    .replace(/\n{3,}/g, '\n\n') // Replace multiple line breaks with two
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Split text into chunks of approximately equal size with potential overlap
 * @param {string} text The text to split
 * @param {number} [chunkSize=1000] Target chunk size in characters
 * @param {number} [overlap=200] Number of characters to overlap between chunks
 * @returns {Array<string>} Array of text chunks
 */
function chunkByCharacters(text, chunkSize = config.processing.chunkSize, overlap = config.processing.chunkOverlap) {
  // Clean the text first
  const cleanedText = cleanText(text);
  
  // If the text is smaller than the chunk size, return it as a single chunk
  if (cleanedText.length <= chunkSize) {
    return [cleanedText];
  }
  
  const chunks = [];
  let startIndex = 0;
  
  while (startIndex < cleanedText.length) {
    // Calculate the potential end index
    let endIndex = startIndex + chunkSize;
    
    // Adjust the end index to avoid cutting words
    if (endIndex < cleanedText.length) {
      // Try to find the next space after endIndex
      const nextSpace = cleanedText.indexOf(' ', endIndex);
      if (nextSpace !== -1) {
        endIndex = nextSpace;
      }
    } else {
      endIndex = cleanedText.length;
    }
    
    // Extract the chunk
    chunks.push(cleanedText.substring(startIndex, endIndex).trim());
    
    // Move the start index forward, accounting for overlap
    startIndex = endIndex - overlap;
    
    // If the remaining text is less than the overlap, just break
    if (startIndex >= cleanedText.length - overlap) {
      break;
    }
  }
  
  // If there's still text remaining, add it as the final chunk
  if (startIndex < cleanedText.length) {
    chunks.push(cleanedText.substring(startIndex).trim());
  }
  
  return chunks;
}

/**
 * Alternative chunking strategy that tries to split by paragraphs when possible
 * @param {string} text The text to split
 * @param {number} [maxChunkSize=1000] Maximum chunk size in characters
 * @returns {Array<string>} Array of text chunks
 */
function chunkByParagraphs(text, maxChunkSize = config.processing.chunkSize) {
  // Clean the text first
  const cleanedText = cleanText(text);
  
  // Split into paragraphs
  const paragraphs = cleanedText.split(/\n\s*\n/);
  
  const chunks = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed max chunk size, store current chunk and start a new one
    if (currentChunk.length + paragraph.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Add the last chunk if there's anything left
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  // If any chunks are still too large, use character-based chunking as fallback
  return chunks.flatMap(chunk => 
    chunk.length > maxChunkSize ? chunkByCharacters(chunk, maxChunkSize) : [chunk]
  );
}

module.exports = {
  cleanText,
  chunkByCharacters,
  chunkByParagraphs
}; 