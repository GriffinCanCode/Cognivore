/**
 * Database Service
 * Handles LanceDB initialization and operations
 */

const lancedb = require('vectordb');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { createContextLogger } = require('../utils/logger');
const { 
  memoryManager, 
  batchOptimizer, 
  dbMemoryManager, 
  registerConnection, 
  optimizeQuery, 
  getStatistics, 
  analyzeQueryPerformance
} = require('../memory');

const logger = createContextLogger('Database');

let db;
let collection;
let monitoredDb;

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
      logger.info(`Created database directory: ${dbPath}`);
    }

    // Monitor memory before connecting
    const memBefore = memoryManager.monitorMemory();
    logger.debug(`Memory before DB connection: ${memBefore.heapUsedMB}MB`);

    // Connect to LanceDB
    db = await lancedb.connect(dbPath);
    
    // Register connection with memory manager
    monitoredDb = registerConnection('lancedb-main', db, {
      type: 'vectordb',
      isPrimary: true
    });
    
    logger.info('Connected to LanceDB');

    try {
      // Try to open the existing collection
      collection = await monitoredDb.openTable(config.database.collection);
      logger.info(`Opened existing collection: ${config.database.collection}`);
    } catch (error) {
      // Collection doesn't exist, create it
      logger.info(`Creating new collection: ${config.database.collection}`);
      
      // Create a simple consistent vector for initialization
      const sampleVector = new Array(config.embeddings.dimensions).fill(0);
      
      // Sample data for initialization
      const sampleData = [{
        id: 'sample',
        source_type: 'sample',
        source_identifier: 'sample',
        title: 'Sample Item',
        original_content_path: '',
        extracted_text: 'This is a sample item to initialize the database.',
        text_chunks: ['This is a sample item to initialize the database.'],
        vector: sampleVector,
        metadata: JSON.stringify({
          sample: true,
          creation_date: new Date().toISOString()
        })
      }];
      
      // Create collection - use either monitoredDb if it has createTable or fallback to raw db
      if (typeof monitoredDb.createTable === 'function') {
        collection = await monitoredDb.createTable(config.database.collection, sampleData);
      } else {
        // Fallback to the original db object if the monitored version doesn't have createTable
        logger.debug('Using raw db connection for table creation');
        collection = await db.createTable(config.database.collection, sampleData);
      }
      logger.info(`Created collection: ${config.database.collection}`);
    }
    
    // Monitor memory after initialization
    const memAfter = memoryManager.monitorMemory();
    logger.debug(`Memory after DB initialization: ${memAfter.heapUsedMB}MB`);
    
    return { db: monitoredDb, collection };
  } catch (error) {
    logger.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Add a new item to the database
 * @param {Object} item The item to add
 * @returns {Promise<Object>} The added item
 */
const addItem = optimizeQuery(
  async (item) => {
    if (!collection) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Ensure metadata is properly stringified if it's an object
      if (typeof item.metadata === 'object') {
        item.metadata = JSON.stringify(item.metadata);
      }
      
      await collection.add([item]);
      return item;
    } catch (error) {
      logger.error('Error adding item to database:', error);
      throw error;
    }
  },
  {
    queryName: 'addItem',
    enableCache: false, // No caching for write operations
  }
);

/**
 * Delete an item from the database
 * @param {string} id The ID of the item to delete
 * @returns {Promise<boolean>} Whether the deletion was successful
 */
const deleteItem = optimizeQuery(
  async (id) => {
    if (!collection) {
      throw new Error('Database not initialized');
    }
    
    try {
      // LanceDB uses a SQL-like query language
      await collection.delete(`id='${id}'`);
      return true;
    } catch (error) {
      logger.error(`Error deleting item with ID ${id}:`, error);
      throw error;
    }
  },
  {
    queryName: 'deleteItem',
    enableCache: false, // No caching for write operations
  }
);

/**
 * List all items in the database
 * @returns {Promise<Array>} Array of items
 */
const listItems = optimizeQuery(
  async () => {
    if (!collection) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Since neither query() nor scan() is available, use search with a dummy vector
      // This should return all items when no specific vector search is performed
      const sampleVector = new Array(config.embeddings.dimensions).fill(0);
      const results = await collection.search(sampleVector).limit(1000).execute();
      
      // Process results to extract just the needed fields
      return results.map(item => ({
        id: item.id,
        title: item.title,
        source_type: item.source_type
      }));
    } catch (error) {
      logger.error('Error listing items from database:', error);
      throw error;
    }
  },
  {
    queryName: 'listItems',
    enableCache: true,
    cacheTTLMs: 60000, // 1 minute cache
  }
);

/**
 * Perform a vector search
 * @param {Array} queryVector The query vector
 * @param {number} limit The maximum number of results
 * @returns {Promise<Array>} Array of matching items
 */
const vectorSearch = optimizeQuery(
  async (queryVector, limit = 5) => {
    if (!collection) {
      // In test environments, we might have mocked the database initialization
      // but not set the collection variable directly.
      // This gets global.testCollection if it exists (set by tests)
      if (global.testCollection) {
        collection = global.testCollection;
      } else {
        throw new Error('Database not initialized');
      }
    }
    
    try {
      // Monitor memory before search operation as it can be intensive
      const memBefore = memoryManager.monitorMemory();
      
      // Trigger garbage collection if memory usage is high
      if (memBefore.heapUsedRatio > 0.7) {
        logger.debug('High memory usage detected before vector search, requesting GC');
        if (global.gc) global.gc();
      }
      
      const results = await collection
        .search(queryVector)
        .limit(limit)
        .execute();
      
      return results;
    } catch (error) {
      logger.error('Error performing vector search:', error);
      throw error;
    }
  },
  {
    queryName: 'vectorSearch',
    enableCache: true,
    cacheTTLMs: 300000, // 5 minutes cache
    // Custom key function to create cache keys from the vector (using first 5 values)
    cacheKeyFn: (vector, limit) => {
      if (!Array.isArray(vector)) return `search:invalid:${limit}`;
      const vectorSignature = vector.slice(0, 5).map(v => v.toFixed(3)).join(':');
      return `search:${vectorSignature}:${limit}`;
    }
  }
);

/**
 * Get database memory statistics
 * @returns {Object} Memory statistics for the database
 */
function getDatabaseStats() {
  const stats = getStatistics();
  const memoryUsage = memoryManager.monitorMemory();
  
  return {
    memory: memoryUsage,
    connections: stats.connections,
    queries: stats.queries,
    cache: stats.cache
  };
}

/**
 * Analyze database performance and recommend optimizations
 * @returns {Object} Analysis results
 */
function analyzeDatabasePerformance() {
  return analyzeQueryPerformance();
}

module.exports = {
  initializeDatabase,
  addItem,
  deleteItem,
  listItems,
  vectorSearch,
  getDatabaseStats,
  analyzeDatabasePerformance
}; 