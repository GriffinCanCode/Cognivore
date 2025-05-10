/**
 * Tests for PDF processor service
 */

const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');

// Use an actual PDF file for testing
const TEST_PDF_PATH = path.resolve(__dirname, '../docs/I\'m automating my Job as a Google Engineer with a custom-built Deep Research System - Here\'s how to build it _ by Jakob Pörschmann _ May, 2025 _ Level Up Coding.pdf');
const TEST_PDF_FILENAME = path.basename(TEST_PDF_PATH);

// Set longer timeouts for all tests in this file
jest.setTimeout(30000);

// Mock the database service before importing any modules that use it
jest.mock('../../src/services/database', () => ({
  addItem: jest.fn().mockImplementation(async (item) => {
    return { id: item.id, success: true };
  })
}));

// Mock the pdf-parse module before importing our code
jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation(() => {
    return Promise.resolve({
      numpages: 5,
      text: 'This is mock PDF content for testing. It simulates the extracted text from a PDF file.',
      info: {
        Title: 'Test PDF',
        Author: 'Test Author',
        Creator: 'Test Creator',
        Producer: 'Test Producer',
        ModDate: 'D:20210101000000',
        CreationDate: 'D:20210101000000'
      },
      metadata: {
        'dc:title': 'Test PDF',
        'dc:creator': ['Test Author'],
        'dc:format': 'application/pdf'
      }
    });
  });
});

// Mock the processor factory to avoid real document processing
jest.mock('../../src/utils/processors/processorFactory', () => {
  return {
    createPDFProcessor: () => ({
      processPDFData: async (pdfData, callback) => {
        // Create a mock embedding
        const mockEmbedding = new Array(384).fill(0.1);
        const mockChunks = pdfData.map(pdf => ({
          documentId: pdf.id,
          embedding: mockEmbedding,
          content: pdf.extractedText,
          metadata: pdf.metadata
        }));
        
        return callback(mockChunks);
      }
    })
  };
});

// Import the module to test after mocking dependencies
const { processPDF, processPDFBatch, extractPDFData } = require('../../src/services/pdfProcessor');
const dbService = require('../../src/services/database');
const pdfParse = require('pdf-parse');

describe('PDF Processor Service', () => {
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Reset all mocks
    jest.clearAllMocks();

    // Mock fs.existsSync to control file existence
    sandbox.stub(fs, 'existsSync').callsFake((filePath) => {
      if (filePath === TEST_PDF_PATH || filePath.toString().includes(TEST_PDF_FILENAME)) {
        return true;
      }
      
      if (filePath.toString().includes('error.pdf')) {
        return true;
      }
      
      if (filePath.toString().includes('nonexistent.pdf')) {
        return false;
      }
      
      return true; // Default to true for other paths
    });

    // Mock fs.readFileSync to handle different file paths
    sandbox.stub(fs, 'readFileSync').callsFake((filePath) => {
      if (filePath === TEST_PDF_PATH || filePath.toString().includes(TEST_PDF_FILENAME)) {
        return Buffer.from('fake pdf content');
      }
      
      if (filePath.toString().includes('error.pdf')) {
        throw new Error('Error reading file');
      }
      
      if (filePath.toString().includes('nonexistent.pdf')) {
        const error = new Error('ENOENT: no such file or directory');
        error.code = 'ENOENT';
        throw error;
      }
      
      return Buffer.from('default pdf content');
    });

    // Mock fs.readFile to handle different file paths
    sandbox.stub(fs, 'readFile').callsFake((filePath, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
        options = null;
      }

      if (filePath === TEST_PDF_PATH || filePath.toString().includes(TEST_PDF_FILENAME)) {
        callback(null, Buffer.from('fake pdf content'));
        return;
      }
      
      if (filePath.toString().includes('error.pdf')) {
        callback(new Error('Error reading file'));
        return;
      }
      
      if (filePath.toString().includes('nonexistent.pdf')) {
        const error = new Error('ENOENT: no such file or directory');
        error.code = 'ENOENT';
        callback(error);
        return;
      }
      
      callback(null, Buffer.from('default pdf content'));
    });
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('extractPDFData', () => {
    it('should extract data from a PDF file', async () => {
      const result = await extractPDFData(TEST_PDF_PATH);
      expect(result).to.have.property('extractedText').that.is.a('string');
      expect(result).to.have.property('metadata').that.is.an('object');
      expect(result).to.have.property('original_content_path', TEST_PDF_PATH);
    });
  });
  
  describe('processPDF', () => {
    it('should process a single PDF file', async () => {
      const result = await processPDF(TEST_PDF_PATH);
      expect(result).to.have.property('id').that.is.a('string');
      expect(result).to.have.property('source_type', 'pdf');
      expect(result).to.have.property('title').that.is.a('string');
      // Use Jest's expect directly for mock validations
      expect(dbService.addItem.mock.calls.length).to.be.at.least(1);
    });
    
    it('should throw an error if the file does not exist', async () => {
      try {
        await processPDF('/test/nonexistent.pdf');
        // Should not reach here
        expect(true).to.be.false;
      } catch (error) {
        expect(error.message).to.include('File not found');
      }
    });
  });
  
  describe('processPDFBatch', () => {
    it('should process multiple PDF files in batch', async () => {
      const pdfPaths = [TEST_PDF_PATH];
      const results = await processPDFBatch(pdfPaths);
      expect(results).to.be.an('array');
      expect(results).to.have.length.of.at.least(1);
      // Use Jest's expect directly for mock validations
      expect(dbService.addItem.mock.calls.length).to.be.at.least(1);
    });
    
    it('should handle errors in PDF extraction', async () => {
      const pdfPaths = [TEST_PDF_PATH, '/test/error.pdf'];
      const results = await processPDFBatch(pdfPaths);
      expect(results).to.be.an('array');
      expect(results).to.have.length.of.at.least(1);
      // Use Jest's expect directly for mock validations
      expect(dbService.addItem.mock.calls.length).to.be.at.least(1);
    });
    
    it('should apply custom options to processing', async () => {
      const pdfPaths = [TEST_PDF_PATH];
      const options = {
        storeResults: false,
        batchSize: 2,
        concurrency: 1,
        customMetadata: {
          source: 'test'
        }
      };
      
      const results = await processPDFBatch(pdfPaths, options);
      expect(results).to.be.an('array');
      expect(results).to.have.length.of.at.least(1);
      // Use Jest's expect directly for mock validations
      expect(dbService.addItem.mock.calls.length).to.be.at.least(1);
    });
  });
}); 