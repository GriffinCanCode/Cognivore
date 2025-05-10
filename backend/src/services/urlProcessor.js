/**
 * URL Processing Service
 * Responsible for extracting text from web pages and processing it for storage
 */

const { v4: uuidv4 } = require('uuid');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { chunkByParagraphs } = require('../utils/textChunker');
const { generateEmbeddings } = require('./embedding');
const { addItem } = require('./database');

/**
 * Process a web URL
 * @param {string} url URL of the web page to process
 * @returns {Promise<Object>} The processed item with ID
 */
async function processURL(url) {
  try {
    console.log(`Processing URL: ${url}`);
    
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }
    
    // Fetch the webpage
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    // Get the HTML content
    const html = await response.text();
    
    // Create a DOM from the HTML
    const dom = new JSDOM(html, { url });
    
    // Extract the main content using Readability
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    
    if (!article) {
      throw new Error(`Failed to extract content from URL: ${url}`);
    }
    
    // Extract basic info
    const extractedText = article.textContent;
    const title = article.title || new URL(url).hostname;
    
    // Generate a unique ID
    const id = uuidv4();
    
    // Chunk the text
    const textChunks = chunkByParagraphs(extractedText);
    console.log(`Split into ${textChunks.length} chunks`);
    
    // Generate embeddings for each chunk
    const chunkEmbeddings = await generateEmbeddings(textChunks);
    console.log(`Generated ${chunkEmbeddings.length} embeddings`);
    
    // Create the database item
    const item = {
      id,
      source_type: 'url',
      source_identifier: url,
      title,
      original_content_path: url,
      extracted_text: extractedText,
      text_chunks: textChunks,
      // Use first chunk's embedding as the primary vector for the document
      vector: chunkEmbeddings[0] || [],
      metadata: {
        url,
        hostname: new URL(url).hostname,
        extraction_date: new Date().toISOString(),
        chunk_count: textChunks.length,
        excerpt: article.excerpt || '',
        author: article.byline || '',
        site_name: article.siteName || ''
      }
    };
    
    // Store in database
    await addItem(item);
    console.log(`URL processed and stored with ID: ${id}`);
    
    return item;
  } catch (error) {
    console.error('Error processing URL:', error);
    throw error;
  }
}

module.exports = {
  processURL
}; 