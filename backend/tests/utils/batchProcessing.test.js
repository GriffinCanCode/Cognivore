/**
 * Tests for batch processing utilities
 */

const { expect } = require('chai');
const sinon = require('sinon');
const BatchProcessor = require('../../src/utils/batchers/batchProcessor');
const { batchChunkDocuments } = require('../../src/utils/batchers/chunkerBatch');
const { batchGenerateEmbeddings } = require('../../src/utils/batchers/embeddingBatch');
const { processDocuments } = require('../../src/utils/processors/documentProcessor');
const { createDocumentProcessor, createPDFProcessor } = require('../../src/utils/processors/processorFactory');

describe('Batch Processing Utilities', () => {
  
  describe('BatchProcessor', () => {
    it('should process items in batches', async () => {
      const processor = new BatchProcessor({ batchSize: 2 });
      const items = [1, 2, 3, 4, 5];
      const processFn = sinon.stub().callsFake(batch => {
        return batch.map(item => item * 2);
      });
      
      const results = await processor.process(items, processFn);
      
      expect(results).to.deep.equal([2, 4, 6, 8, 10]);
      expect(processFn.callCount).to.equal(3); // 3 batches of size 2 (with last batch having 1 item)
    });
    
    it('should handle errors with failFast=false', async () => {
      const processor = new BatchProcessor({ batchSize: 2, failFast: false });
      const items = [1, 2, 3, 4, 5];
      const processFn = sinon.stub();
      
      // First batch succeeds, second fails, third succeeds
      processFn.onFirstCall().returns([2, 4]);
      processFn.onSecondCall().throws(new Error('Test error'));
      processFn.onThirdCall().returns([10]);
      
      const results = await processor.process(items, processFn);
      
      expect(results).to.deep.equal([2, 4, 10]);
      expect(processFn.callCount).to.equal(3);
    });
    
    it('should emit events during processing', async () => {
      const processor = new BatchProcessor({ batchSize: 2 });
      const items = [1, 2, 3, 4];
      const processFn = batch => batch.map(item => item * 2);
      
      const batchStartSpy = sinon.spy();
      const batchCompleteSpy = sinon.spy();
      const processingCompleteSpy = sinon.spy();
      
      processor.on('batchStart', batchStartSpy);
      processor.on('batchComplete', batchCompleteSpy);
      processor.on('processingComplete', processingCompleteSpy);
      
      await processor.process(items, processFn);
      
      expect(batchStartSpy.callCount).to.equal(2);
      expect(batchCompleteSpy.callCount).to.equal(2);
      expect(processingCompleteSpy.callCount).to.equal(1);
    });
  });
  
  describe('TextChunkerBatch', () => {
    it('should chunk multiple documents in batches', async () => {
      const documents = [
        { id: 'doc1', text: 'This is the first document with some text for testing.' },
        { id: 'doc2', text: 'This is the second document.\n\nIt has multiple paragraphs.\n\nThree paragraphs to be exact.' }
      ];
      
      const results = await batchChunkDocuments(documents, { strategy: 'paragraphs' });
      
      expect(results).to.have.lengthOf(2);
      expect(results[0].id).to.equal('doc1');
      expect(results[1].id).to.equal('doc2');
      expect(results[0].chunks).to.be.an('array');
      expect(results[1].chunks).to.be.an('array');
      expect(results[1].chunks.length).to.be.greaterThan(1); // Should have multiple chunks for doc2
    });
  });
  
  describe('EmbeddingBatch', () => {
    it('should generate embeddings for text chunks in batches', async () => {
      const chunks = [
        'This is the first chunk',
        'This is the second chunk',
        'This is the third chunk'
      ];
      
      const results = await batchGenerateEmbeddings(chunks);
      
      expect(results).to.have.lengthOf(3);
      expect(results[0].embedding).to.be.an('array');
      expect(results[0].content).to.equal(chunks[0]);
    });
    
    it('should handle text chunks with metadata', async () => {
      const chunks = [
        { documentId: 'doc1', chunkIndex: 0, content: 'Chunk 1', metadata: { source: 'test' } },
        { documentId: 'doc1', chunkIndex: 1, content: 'Chunk 2', metadata: { source: 'test' } }
      ];
      
      const results = await batchGenerateEmbeddings(chunks, { includeMetadata: true });
      
      expect(results).to.have.lengthOf(2);
      expect(results[0].embedding).to.be.an('array');
      expect(results[0].documentId).to.equal('doc1');
      expect(results[0].metadata).to.deep.equal({ source: 'test' });
    });
  });
  
  describe('DocumentProcessor', () => {
    it('should process documents through the full pipeline', async () => {
      // Sample documents
      const documents = [
        {
          id: 'doc1',
          text: 'This is a sample document for testing the document processor.',
          metadata: { source: 'test', author: 'AI' }
        },
        {
          id: 'doc2',
          text: 'This is another document.\n\nIt has multiple paragraphs.\n\nThree paragraphs in total.',
          metadata: { source: 'test', author: 'Human' }
        }
      ];
      
      // Mock store function
      const storeFn = sinon.stub().resolves(['stored1', 'stored2']);
      
      const results = await processDocuments(documents, {
        chunking: { strategy: 'paragraphs' },
        embedding: { includeContent: true, includeMetadata: true },
        batch: { documentBatchSize: 2, chunkBatchSize: 5 }
      }, storeFn);
      
      expect(results).to.have.property('documentCount', 2);
      expect(results).to.have.property('chunkCount').that.is.greaterThan(1);
      expect(results).to.have.property('embeddingCount').that.is.greaterThan(1);
      expect(storeFn.called).to.be.true;
    });
    
    it('should process documents without storing', async () => {
      // Sample documents
      const documents = [
        { id: 'doc1', text: 'Sample document for testing.' },
        { id: 'doc2', text: 'Another document for testing.' }
      ];
      
      const results = await processDocuments(documents, {
        chunking: { strategy: 'characters', chunkSize: 20 }
      });
      
      expect(results).to.have.property('documentCount', 2);
      expect(results).to.have.property('embeddings').that.is.an('array');
    });
  });
  
  describe('ProcessorFactory', () => {
    it('should create a document processor with options', () => {
      const options = {
        chunking: { strategy: 'markdown' },
        batch: { concurrency: 4 }
      };
      
      const processor = createDocumentProcessor(options);
      expect(processor.options.chunking.strategy).to.equal('markdown');
      expect(processor.options.batch.concurrency).to.equal(4);
    });
    
    it('should create a PDF processor with options', () => {
      const options = {
        chunking: { strategy: 'paragraphs' },
        embedding: { includeContent: false }
      };
      
      const processor = createPDFProcessor(options);
      expect(processor.options.chunking.strategy).to.equal('paragraphs');
      expect(processor.options.embedding.includeContent).to.be.false;
    });
    
    it('should apply default options when not specified', () => {
      const processor = createDocumentProcessor();
      expect(processor.options.chunking.strategy).to.equal('characters');
      expect(processor.options.batch.documentBatchSize).to.equal(5);
      expect(processor.options.embedding.includeContent).to.be.true;
    });
  });
}); 