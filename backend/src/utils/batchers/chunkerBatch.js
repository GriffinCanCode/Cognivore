/**
 * Text Chunker Batch Processor
 * Batch processes multiple documents for efficient chunking
 */

const { createContextLogger } = require('../../utils/logger');
const BatchProcessor = require('./batchProcessor');
const { cleanText, chunkByCharacters, chunkByParagraphs, chunkByMarkdown } = require('../textChunker');
const config = require('../../config');

const logger = createContextLogger('TextChunkerBatch');

/**
 * Document to chunk for processing
 * @typedef {Object} Document
 * @property {string} id - Unique identifier for the document
 * @property {string} text - Text content to chunk
 * @property {string} [format='text'] - Format of the document (text, markdown)
 * @property {Object} [metadata={}] - Additional metadata for the document
 */

/**
 * Chunked document with metadata
 * @typedef {Object} ChunkedDocument
 * @property {string} id - Original document ID
 * @property {Array<string>} chunks - Text chunks
 * @property {Object} metadata - Combined metadata
 */

/**
 * Configuration for chunking
 * @typedef {Object} ChunkingOptions
 * @property {string} [strategy='characters'] - Chunking strategy: 'characters', 'paragraphs', or 'markdown'
 * @property {number} [chunkSize] - Target chunk size (default from config)
 * @property {number} [chunkOverlap] - Overlap between chunks (default from config)
 * @property {number} [minChunkSize] - Minimum chunk size for paragraph strategy
 * @property {boolean} [keepMetadata=true] - Whether to include document metadata with chunks
 */

/**
 * Process multiple documents into chunks using batch processing
 * @param {Array<Document>} documents - Array of documents to process
 * @param {ChunkingOptions} options - Chunking configuration
 * @param {Object} batchOptions - Batch processing options
 * @returns {Promise<Array<ChunkedDocument>>} - Array of chunked documents
 */
async function batchChunkDocuments(documents, options = {}, batchOptions = {}) {
  if (!documents || !Array.isArray(documents)) {
    logger.error('Invalid documents provided', { documents });
    throw new Error('Documents must be an array');
  }

  logger.info(`Starting batch chunking of ${documents.length} documents`, {
    strategy: options.strategy || 'characters',
    batchSize: batchOptions.batchSize || 10
  });

  const processor = new BatchProcessor({
    batchSize: batchOptions.batchSize || 10,
    concurrency: batchOptions.concurrency || 2,
    delayBetweenBatches: batchOptions.delayBetweenBatches || 0,
    failFast: batchOptions.failFast || false
  });

  // Set up event listeners for monitoring
  processor.on('batchStart', (data) => {
    logger.debug(`Starting document batch ${data.batchIndex + 1}/${data.totalBatches}`, {
      documents: data.items.length
    });
  });

  processor.on('batchError', (data) => {
    logger.warn(`Error processing document batch ${data.batchIndex + 1}`, {
      error: data.error.message
    });
  });

  // Process each batch of documents
  const chunkedDocuments = await processor.process(documents, async (docBatch) => {
    return Promise.all(docBatch.map(doc => processDocument(doc, options)));
  });

  logger.info(`Completed chunking ${documents.length} documents into ${chunkedDocuments.length} result sets`);
  return chunkedDocuments;
}

/**
 * Process a single document based on options
 * @param {Document} document - Document to process
 * @param {ChunkingOptions} options - Chunking options
 * @returns {Promise<ChunkedDocument>} - Chunked document
 */
async function processDocument(document, options = {}) {
  logger.debug(`Processing document ${document.id}`, {
    format: document.format || 'text',
    textLength: document.text.length
  });

  const {
    strategy = 'characters',
    chunkSize = config.processing.chunkSize,
    chunkOverlap = config.processing.chunkOverlap,
    minChunkSize = 0,
    keepMetadata = true
  } = options;

  // Clean the text
  const cleanedText = cleanText(document.text);

  // Apply the appropriate chunking strategy
  let chunks;
  switch (strategy.toLowerCase()) {
    case 'paragraphs':
      chunks = chunkByParagraphs(cleanedText, chunkSize, minChunkSize);
      break;
    case 'markdown':
      chunks = chunkByMarkdown(cleanedText, chunkSize);
      break;
    case 'characters':
    default:
      chunks = chunkByCharacters(cleanedText, chunkSize, chunkOverlap);
      break;
  }

  logger.debug(`Created ${chunks.length} chunks for document ${document.id}`, {
    strategy,
    chunkCount: chunks.length
  });

  // Create result with metadata if requested
  const result = {
    id: document.id,
    chunks,
    chunkCount: chunks.length
  };

  if (keepMetadata && document.metadata) {
    result.metadata = { ...document.metadata };
  }

  return result;
}

/**
 * Flatten chunked documents into array of chunks with metadata
 * @param {Array<ChunkedDocument>} chunkedDocuments - Array of chunked documents
 * @param {boolean} [includeMetadata=true] - Whether to include metadata with each chunk
 * @returns {Array<Object>} - Array of chunks with metadata
 */
function flattenChunkedDocuments(chunkedDocuments, includeMetadata = true) {
  logger.debug(`Flattening ${chunkedDocuments.length} chunked documents`);

  const flattened = [];

  chunkedDocuments.forEach(doc => {
    doc.chunks.forEach((chunk, index) => {
      const flatChunk = {
        documentId: doc.id,
        chunkIndex: index,
        content: chunk
      };

      if (includeMetadata && doc.metadata) {
        flatChunk.metadata = { ...doc.metadata };
      }

      flattened.push(flatChunk);
    });
  });

  logger.debug(`Generated ${flattened.length} flattened chunks`);
  return flattened;
}

module.exports = {
  batchChunkDocuments,
  processDocument,
  flattenChunkedDocuments
}; 