/**
 * Database Service
 * Handles LanceDB initialization and operations
 */

const lancedb = require('@lancedb/lancedb');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db;
let collection;

/**
 * Initialize the vector database
 * @returns {Promise<Object>} The database instance
 */
async function initializeDatabase() {
  try {
    // Ensure database directory exists
    const dbPath = config.database.path;
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
      console.log(`Created database directory: ${dbPath}`);
    }

    // Connect to LanceDB
    db = await lancedb.connect(dbPath);
    console.log('Connected to LanceDB');

    // Check if collection exists, if not create it
    const tables = await db.tableNames();
    
    if (!tables.includes(config.database.collection)) {
      console.log(`Creating collection: ${config.database.collection}`);
      
      // Define schema for the collection
      const schema = {
        id: 'string',
        source_type: 'string',
        source_identifier: 'string',
        title: 'string',
        original_content_path: 'string',
        extracted_text: 'string',
        text_chunks: 'list[string]',
        // Vector type will be determined by LanceDB at insertion time
        metadata: 'json'
      };
      
      // Sample data for initialization (will be replaced when actual data is added)
      const sampleData = [{
        id: 'sample',
        source_type: 'sample',
        source_identifier: 'sample',
        title: 'Sample Item',
        original_content_path: '',
        extracted_text: 'This is a sample item to initialize the database.',
        text_chunks: ['This is a sample item to initialize the database.'],
        vector: new Array(config.embeddings.dimensions).fill(0),
        metadata: {}
      }];
      
      // Create collection
      collection = await db.createTable(config.database.collection, sampleData);
      console.log(`Created collection: ${config.database.collection}`);
    } else {
      console.log(`Collection already exists: ${config.database.collection}`);
      collection = await db.openTable(config.database.collection);
    }
    
    return { db, collection };
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Add a new item to the database
 * @param {Object} item The item to add
 * @returns {Promise<Object>} The added item
 */
async function addItem(item) {
  if (!collection) {
    throw new Error('Database not initialized');
  }
  
  try {
    await collection.add([item]);
    return item;
  } catch (error) {
    console.error('Error adding item to database:', error);
    throw error;
  }
}

/**
 * Delete an item from the database
 * @param {string} id The ID of the item to delete
 * @returns {Promise<boolean>} Whether the deletion was successful
 */
async function deleteItem(id) {
  if (!collection) {
    throw new Error('Database not initialized');
  }
  
  try {
    // LanceDB uses a SQL-like query language
    await collection.delete(`id='${id}'`);
    return true;
  } catch (error) {
    console.error(`Error deleting item with ID ${id}:`, error);
    throw error;
  }
}

/**
 * List all items in the database
 * @returns {Promise<Array>} Array of items
 */
async function listItems() {
  if (!collection) {
    throw new Error('Database not initialized');
  }
  
  try {
    const results = await collection.select(['id', 'title', 'source_type']).execute();
    return results;
  } catch (error) {
    console.error('Error listing items from database:', error);
    throw error;
  }
}

/**
 * Perform a vector search
 * @param {Array} queryVector The query vector
 * @param {number} limit The maximum number of results
 * @returns {Promise<Array>} Array of matching items
 */
async function vectorSearch(queryVector, limit = 5) {
  if (!collection) {
    throw new Error('Database not initialized');
  }
  
  try {
    const results = await collection
      .search(queryVector)
      .limit(limit)
      .execute();
    
    return results;
  } catch (error) {
    console.error('Error performing vector search:', error);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  addItem,
  deleteItem,
  listItems,
  vectorSearch
}; 