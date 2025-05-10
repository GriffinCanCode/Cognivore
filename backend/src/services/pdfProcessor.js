/**
 * PDF Processing Service
 * Responsible for extracting text from PDF files and processing it for storage
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const { chunkByParagraphs } = require('../utils/textChunker');
const { generateEmbeddings } = require('./embedding');
const { addItem } = require('./database');

/**
 * Process a PDF file
 * @param {string} filePath Path to the PDF file
 * @returns {Promise<Object>} The processed item with ID
 */
async function processPDF(filePath) {
  try {
    console.log(`Processing PDF: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Load the PDF file
    const dataBuffer = fs.readFileSync(filePath);
    
    // Parse the PDF
    const data = await pdfParse(dataBuffer);
    
    // Extract basic info
    const extractedText = data.text;
    const fileName = path.basename(filePath);
    const title = fileName.replace('.pdf', '');
    
    // Generate a unique ID
    const id = uuidv4();
    
    // Chunk the text
    const textChunks = chunkByParagraphs(extractedText);
    console.log(`Split into ${textChunks.length} chunks`);
    
    // Generate embeddings for each chunk
    const chunkEmbeddings = await generateEmbeddings(textChunks);
    console.log(`Generated ${chunkEmbeddings.length} embeddings`);
    
    // Create the database item
    // For LanceDB, we use the first chunk's embedding as the primary vector
    // This is a simplification - in a more advanced implementation, we might 
    // store each chunk as a separate entry or implement a pooling strategy
    const item = {
      id,
      source_type: 'pdf',
      source_identifier: filePath,
      title,
      original_content_path: filePath,
      extracted_text: extractedText,
      text_chunks: textChunks,
      // Use first chunk's embedding as the primary vector for the document
      vector: chunkEmbeddings[0] || [],
      metadata: {
        page_count: data.numpages,
        file_name: fileName,
        extraction_date: new Date().toISOString(),
        chunk_count: textChunks.length
      }
    };
    
    // Store in database
    await addItem(item);
    console.log(`PDF processed and stored with ID: ${id}`);
    
    return item;
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
}

module.exports = {
  processPDF
}; 