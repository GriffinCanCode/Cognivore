/**
 * PDF Processing Service
 * Responsible for extracting text from PDF files and processing it for storage
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const { createContextLogger } = require('../utils/logger');
const { createPDFProcessor } = require('../utils/processors/processorFactory');
const { addItem } = require('./database');
const BatchProcessor = require('../utils/batchers/batchProcessor');

const logger = createContextLogger('PDFProcessor');

/**
 * Process a single PDF file
 * @param {string} filePath Path to the PDF file
 * @returns {Promise<Object>} The processed item with ID
 */
async function processPDF(filePath) {
  try {
    logger.info(`Processing PDF: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.error(`File not found: ${filePath}`);
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Load and extract PDF data
    const pdfData = await extractPDFData(filePath);
    
    // Create PDF processor with default options
    const processor = createPDFProcessor();
    
    // Process the PDF data
    const processingResult = await processor.processPDFData([pdfData], async (embeddedChunks) => {
      // For compatibility with existing implementation
      // Use the first chunk's embedding as the primary vector for the document
      pdfData.vector = embeddedChunks[0]?.embedding || [];
      
      // Store in database
      await addItem(pdfData);
      logger.info(`PDF processed and stored with ID: ${pdfData.id}`);
      
      return [pdfData.id];
    });
    
    return pdfData;
  } catch (error) {
    logger.error('Error processing PDF', { 
      error: error.message, 
      stack: error.stack,
      filePath 
    });
    throw error;
  }
}

/**
 * Extract data from a PDF file
 * @param {string} filePath Path to the PDF file
 * @returns {Promise<Object>} Extracted PDF data
 */
async function extractPDFData(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  
  // Parse the PDF
  const data = await pdfParse(dataBuffer);
  logger.debug(`PDF parsed successfully`, { pages: data.numpages });
  
  // Extract basic info
  const extractedText = data.text;
  const fileName = path.basename(filePath);
  const title = fileName.replace('.pdf', '');
  
  // Generate a unique ID
  const id = uuidv4();
  logger.debug(`Generated ID for document: ${id}`);
  
  return {
    id,
    source_type: 'pdf',
    source_identifier: filePath,
    title,
    original_content_path: filePath,
    extractedText,
    filePath,
    metadata: {
      page_count: data.numpages,
      file_name: fileName,
      extraction_date: new Date().toISOString()
    }
  };
}

/**
 * Process multiple PDF files in batches
 * @param {Array<string>} filePaths Paths to PDF files
 * @param {Object} options Processing options
 * @returns {Promise<Array<Object>>} Array of processed items
 */
async function processPDFBatch(filePaths, options = {}) {
  if (!Array.isArray(filePaths)) {
    logger.error('Invalid file paths provided', { filePaths });
    throw new Error('File paths must be an array');
  }
  
  logger.info(`Batch processing ${filePaths.length} PDF files`);
  
  // Create batch processor for PDF extraction
  const batchProcessor = new BatchProcessor({
    batchSize: options.extractBatchSize || 5,
    concurrency: options.extractConcurrency || 2,
    failFast: false
  });
  
  // Extract data from all PDFs
  const extractedPDFs = await batchProcessor.process(filePaths, async (batch) => {
    return Promise.all(batch.map(async (filePath) => {
      try {
        return await extractPDFData(filePath);
      } catch (error) {
        logger.error(`Error extracting PDF data from ${filePath}`, {
          error: error.message,
          stack: error.stack
        });
        return null;
      }
    }));
  });
  
  // Filter out any failed extractions
  const validPDFs = extractedPDFs.filter(pdf => pdf !== null);
  logger.info(`Successfully extracted data from ${validPDFs.length} of ${filePaths.length} PDFs`);
  
  if (validPDFs.length === 0) {
    logger.warn('No valid PDFs extracted, stopping processing');
    return [];
  }
  
  // Create PDF processor
  const processor = createPDFProcessor(options);
  
  // Process all extracted PDFs
  const processingResult = await processor.processPDFData(validPDFs, async (embeddedChunks) => {
    // Group embeddings by document ID
    const embeddingsByDoc = embeddedChunks.reduce((acc, chunk) => {
      if (!acc[chunk.documentId]) {
        acc[chunk.documentId] = [];
      }
      acc[chunk.documentId].push(chunk);
      return acc;
    }, {});
    
    // Process and store each document
    const results = [];
    for (const pdf of validPDFs) {
      try {
        const docEmbeddings = embeddingsByDoc[pdf.id] || [];
        
        // Use the first chunk's embedding as the primary vector for the document
        pdf.vector = docEmbeddings[0]?.embedding || [];
        
        // Store in database
        await addItem(pdf);
        logger.info(`PDF processed and stored with ID: ${pdf.id}`);
        
        results.push(pdf);
      } catch (error) {
        logger.error(`Error storing PDF ${pdf.id}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    return results.map(pdf => pdf.id);
  });
  
  logger.info(`Completed batch processing of ${filePaths.length} PDFs`);
  
  // Prepare result objects from the stored PDFs
  return validPDFs;
}

module.exports = {
  processPDF,
  processPDFBatch,
  extractPDFData
}; 