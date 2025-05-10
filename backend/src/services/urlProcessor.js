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
const { createContextLogger } = require('../utils/logger');
const logger = createContextLogger('URLProcessor');

/**
 * Process a web URL
 * @param {string} url URL of the web page to process
 * @returns {Promise<Object>} The processed item with ID
 */
async function processURL(url) {
  try {
    logger.info(`Processing URL: ${url}`);
    
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      logger.error(`Invalid URL format: ${url}`, { error: error.message });
      throw new Error(`Invalid URL: ${url}`);
    }
    
    // Fetch the webpage
    const response = await fetch(url);
    if (!response.ok) {
      logger.error(`Failed to fetch URL`, { 
        url, 
        status: response.status, 
        statusText: response.statusText 
      });
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    // Get the HTML content
    const html = await response.text();
    logger.debug(`Fetched HTML content`, { 
      url, 
      contentLength: html.length 
    });
    
    // Create a DOM from the HTML
    const dom = new JSDOM(html, { url });
    
    // Extract the main content using Readability
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    
    if (!article) {
      logger.error(`Failed to extract content from URL`, { url });
      throw new Error(`Failed to extract content from URL: ${url}`);
    }
    
    logger.debug(`Content extracted successfully`, { 
      title: article.title,
      contentLength: article.textContent.length,
      hasExcerpt: !!article.excerpt,
      hasAuthor: !!article.byline
    });
    
    // Extract basic info
    const extractedText = article.textContent;
    const title = article.title || new URL(url).hostname;
    
    // Generate a unique ID
    const id = uuidv4();
    logger.debug(`Generated ID for document: ${id}`);
    
    // Chunk the text
    const textChunks = chunkByParagraphs(extractedText);
    logger.info(`Split into ${textChunks.length} chunks`);
    
    // Generate embeddings for each chunk
    const chunkEmbeddings = await generateEmbeddings(textChunks);
    logger.info(`Generated ${chunkEmbeddings.length} embeddings`);
    
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
    logger.info(`URL processed and stored with ID: ${id}`);
    
    return item;
  } catch (error) {
    logger.error('Error processing URL', { 
      url,
      error: error.message, 
      stack: error.stack 
    });
    throw error;
  }
}

module.exports = {
  processURL
}; 