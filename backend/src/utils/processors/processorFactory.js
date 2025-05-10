/**
 * Processor Factory
 * Provides different types of document processors based on source type and requirements
 */

const { createContextLogger } = require('../../utils/logger');
const { batchChunkDocuments, flattenChunkedDocuments } = require('../batchers/chunkerBatch');
const { batchGenerateEmbeddings, batchEmbedAndStore } = require('../batchers/embeddingBatch');
const { generateEmbeddingsBatch } = require('../../services/embedding');
const config = require('../../config');

const logger = createContextLogger('ProcessorFactory');

/**
 * Base processor class with common processing methods
 */
class BaseProcessor {
  /**
   * Create a new processor
   * @param {Object} options Processing options
   */
  constructor(options = {}) {
    this.options = this._normalizeOptions(options);
    this.logger = createContextLogger(this.constructor.name);
  }

  /**
   * Normalize options with defaults
   * @param {Object} options User provided options
   * @returns {Object} Normalized options with defaults
   * @protected
   */
  _normalizeOptions(options) {
    return {
      chunking: {
        strategy: options.chunking?.strategy || 'characters',
        chunkSize: options.chunking?.chunkSize || config.processing.chunkSize,
        chunkOverlap: options.chunking?.chunkOverlap || config.processing.chunkOverlap,
        keepMetadata: options.chunking?.keepMetadata !== false
      },
      embedding: {
        includeContent: options.embedding?.includeContent !== false,
        includeMetadata: options.embedding?.includeMetadata !== false
      },
      batch: {
        documentBatchSize: options.batch?.documentBatchSize || 5,
        chunkBatchSize: options.batch?.chunkBatchSize || 10,
        concurrency: options.batch?.concurrency || 2,
        storeBatchSize: options.batch?.storeBatchSize || 50,
        dynamicBatchSize: options.batch?.dynamicBatchSize || false,
        memoryMonitoring: options.batch?.memoryMonitoring || false,
        targetBatchSizeMB: options.batch?.targetBatchSizeMB || 10,
        maxBatchSize: options.batch?.maxBatchSize || 50,
        minBatchSize: options.batch?.minBatchSize || 1
      }
    };
  }
}

/**
 * Document processor that handles chunking and embedding in a pipeline
 */
class DocumentProcessor extends BaseProcessor {
  /**
   * Process documents through the complete pipeline:
   * 1. Chunk documents
   * 2. Generate embeddings
   * 3. Optionally store in a vector database
   * 
   * @param {Array<Object>} documents Documents to process
   * @param {Function} [storeFunction] Optional function to store embeddings
   * @returns {Promise<Object>} Processing results
   */
  async processDocuments(documents, storeFunction = null) {
    if (!documents || !Array.isArray(documents)) {
      this.logger.error('Invalid documents provided', { documents });
      throw new Error('Documents must be an array');
    }

    this.logger.info(`Starting document processing pipeline for ${documents.length} documents`, {
      chunkingStrategy: this.options.chunking.strategy,
      documentBatchSize: this.options.batch.documentBatchSize
    });

    try {
      // Step 1: Chunk the documents in batches
      this.logger.debug('Starting document chunking phase');
      const chunkedDocuments = await batchChunkDocuments(
        documents,
        this.options.chunking,
        {
          batchSize: this.options.batch.documentBatchSize,
          concurrency: this.options.batch.concurrency,
          dynamicBatchSize: this.options.batch.dynamicBatchSize,
          memoryMonitoring: this.options.batch.memoryMonitoring,
          targetBatchSizeMB: this.options.batch.targetBatchSizeMB,
          maxBatchSize: this.options.batch.maxBatchSize,
          minBatchSize: this.options.batch.minBatchSize
        }
      );

      // Get total chunks across all documents
      const totalChunks = chunkedDocuments.reduce((sum, doc) => sum + doc.chunkCount, 0);
      this.logger.info(`Created ${totalChunks} chunks from ${documents.length} documents`);

      // Step 2: Flatten the chunked documents for embedding
      const flatChunks = flattenChunkedDocuments(chunkedDocuments, this.options.embedding.includeMetadata);

      // Step 3: Generate embeddings (and optionally store them)
      if (storeFunction && typeof storeFunction === 'function') {
        this.logger.debug('Starting embedding generation and storage phase');
        
        const results = await batchEmbedAndStore(
          flatChunks,
          storeFunction,
          {
            includeContent: this.options.embedding.includeContent,
            includeMetadata: this.options.embedding.includeMetadata,
            batchSize: this.options.batch.chunkBatchSize,
            concurrency: this.options.batch.concurrency,
            storeBatchSize: this.options.batch.storeBatchSize
          }
        );
        
        this.logger.info(`Completed end-to-end processing with storage for ${documents.length} documents`);
        
        return {
          documentCount: documents.length,
          chunkCount: totalChunks,
          embeddingCount: flatChunks.length,
          storeResults: results
        };
      } else {
        // Just generate embeddings without storing
        this.logger.debug('Starting embedding generation phase (without storage)');
        
        const embeddings = await batchGenerateEmbeddings(
          flatChunks,
          this.options.embedding,
          {
            batchSize: this.options.batch.chunkBatchSize,
            concurrency: this.options.batch.concurrency,
            dynamicBatchSize: this.options.batch.dynamicBatchSize,
            memoryMonitoring: this.options.batch.memoryMonitoring,
            targetBatchSizeMB: this.options.batch.targetBatchSizeMB,
            maxBatchSize: this.options.batch.maxBatchSize,
            minBatchSize: this.options.batch.minBatchSize
          }
        );
        
        this.logger.info(`Completed end-to-end processing for ${documents.length} documents`);
        
        return {
          documentCount: documents.length,
          chunkCount: totalChunks,
          embeddings
        };
      }
    } catch (error) {
      this.logger.error('Error in document processing pipeline', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

/**
 * PDF processor optimized for handling PDF documents
 */
class PDFProcessor extends BaseProcessor {
  /**
   * Process PDF extract results and generate embeddings
   * @param {Array<Object>} pdfData Array of PDF extraction results
   * @param {Function} [storeFunction] Optional function to store results
   * @returns {Promise<Object>} Processing results
   */
  async processPDFData(pdfData, storeFunction = null) {
    this.logger.info(`Processing ${pdfData.length} PDF documents`);
    
    // Convert PDF data to standard document format for processing
    const documents = pdfData.map(pdf => ({
      id: pdf.id,
      text: pdf.extractedText,
      metadata: {
        ...pdf.metadata,
        source_type: 'pdf',
        source_identifier: pdf.source_identifier || pdf.filePath
      }
    }));

    // Use document processor logic for consistent processing
    const documentProcessor = new DocumentProcessor(this.options);
    return documentProcessor.processDocuments(documents, storeFunction);
  }
}

/**
 * Create a document processor with specified options
 * @param {Object} options Processor options
 * @returns {DocumentProcessor} Configured document processor
 */
function createDocumentProcessor(options = {}) {
  return new DocumentProcessor(options);
}

/**
 * Create a PDF processor with specified options
 * @param {Object} options Processor options
 * @returns {PDFProcessor} Configured PDF processor
 */
function createPDFProcessor(options = {}) {
  return new PDFProcessor(options);
}

module.exports = {
  createDocumentProcessor,
  createPDFProcessor,
  DocumentProcessor,
  PDFProcessor,
  BaseProcessor
}; 