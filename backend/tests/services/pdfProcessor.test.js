/**
 * Tests for PDF processor service
 */

const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { processPDF, processPDFBatch, extractPDFData } = require('../../src/services/pdfProcessor');
const { addItem } = require('../../src/services/database');

// Mock dependencies
jest.mock('pdf-parse');
jest.mock('../../src/services/database');

describe('PDF Processor Service', () => {
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock file system
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'readFileSync').returns(Buffer.from('test pdf content'));
    
    // Mock PDF extraction
    pdfParse.mockResolvedValue({
      text: 'This is sample text from a PDF document for testing purposes.',
      numpages: 2
    });
    
    // Mock database
    addItem.mockResolvedValue({ success: true });
  });
  
  afterEach(() => {
    sandbox.restore();
    jest.clearAllMocks();
  });
  
  describe('extractPDFData', () => {
    it('should extract data from a PDF file', async () => {
      const filePath = '/test/sample.pdf';
      
      const result = await extractPDFData(filePath);
      
      expect(result).to.have.property('id').that.is.a('string');
      expect(result).to.have.property('source_type', 'pdf');
      expect(result).to.have.property('title', 'sample');
      expect(result).to.have.property('extractedText', 'This is sample text from a PDF document for testing purposes.');
      expect(result.metadata).to.have.property('page_count', 2);
      expect(result.metadata).to.have.property('file_name', 'sample.pdf');
    });
  });
  
  describe('processPDF', () => {
    it('should process a single PDF file', async () => {
      const filePath = '/test/document.pdf';
      
      const result = await processPDF(filePath);
      
      expect(result).to.have.property('id').that.is.a('string');
      expect(result).to.have.property('source_type', 'pdf');
      expect(result).to.have.property('title', 'document');
      expect(result).to.have.property('vector').that.is.an('array');
      expect(addItem).to.have.been.calledOnce;
    });
    
    it('should throw an error if the file does not exist', async () => {
      fs.existsSync.returns(false);
      const filePath = '/test/nonexistent.pdf';
      
      try {
        await processPDF(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('File not found');
      }
    });
  });
  
  describe('processPDFBatch', () => {
    it('should process multiple PDF files in batch', async () => {
      const filePaths = [
        '/test/doc1.pdf',
        '/test/doc2.pdf',
        '/test/doc3.pdf'
      ];
      
      const results = await processPDFBatch(filePaths);
      
      expect(results).to.be.an('array').with.lengthOf(3);
      expect(results[0]).to.have.property('id').that.is.a('string');
      expect(results[1]).to.have.property('title', 'doc2');
      expect(results[2]).to.have.property('title', 'doc3');
      expect(addItem).to.have.been.calledThrice;
    });
    
    it('should handle errors in PDF extraction', async () => {
      const filePaths = [
        '/test/doc1.pdf',
        '/test/error.pdf',
        '/test/doc3.pdf'
      ];
      
      // Make the second file cause an error during extraction
      const fsReadStub = fs.readFileSync;
      fsReadStub.withArgs('/test/error.pdf').throws(new Error('Error reading file'));
      
      const results = await processPDFBatch(filePaths);
      
      expect(results).to.be.an('array').with.lengthOf(2);
      expect(results[0]).to.have.property('title', 'doc1');
      expect(results[1]).to.have.property('title', 'doc3');
      expect(addItem).to.have.been.calledTwice;
    });
    
    it('should apply custom options to processing', async () => {
      const filePaths = ['/test/doc1.pdf', '/test/doc2.pdf'];
      
      // Set options
      const options = {
        chunking: { strategy: 'paragraphs' },
        batch: { extractBatchSize: 1 }
      };
      
      const results = await processPDFBatch(filePaths, options);
      
      expect(results).to.be.an('array').with.lengthOf(2);
      expect(addItem).to.have.been.calledTwice;
    });
  });
}); 