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
 * Perform a semantic search with context preservation
 * @param {string} query The text query
 * @param {Array} queryVector The query vector (optional - will use query if not provided)
 * @param {Object} options Search options
 * @returns {Promise<Array>} Array of matching items with context information
 */
const semanticSearch = optimizeQuery(
  async (query, queryVector = null, options = {}) => {
    if (!collection) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Default options
      const {
        limit = 5,
        includeContent = true,
        includeSummary = true,
        contextWindowSize = 3,
        minRelevanceScore = 0.6,
        deduplicate = true,
        maxTotalTokens = 4000
      } = options;
      
      // Use provided vector or fallback to query
      const searchVector = queryVector;
      if (!searchVector) {
        logger.warn('No query vector provided for semantic search, using fallback');
        return [];
      }
      
      // Monitor memory before search operation
      const memBefore = memoryManager.monitorMemory();
      logger.debug(`Memory before semantic search: ${memBefore.heapUsedMB}MB`);
      
      // Perform vector search with higher initial limit to allow for filtering
      const searchLimit = Math.min(limit * 2, 20); // Get more results initially for better filtering
      
      // Execute search with memory optimization
      const results = await dbMemoryManager.executeWithMemoryCheck(
        async () => collection.search(searchVector).limit(searchLimit).execute(),
        'semanticSearch'
      );
      
      // Filter and process results
      const processedResults = results
        // Filter out results with low relevance score
        .filter(item => item.score >= minRelevanceScore)
        // Map to standardized format with content processing
        .map(item => {
          try {
            // Parse metadata if it's a string
            let metadata = item.metadata;
            if (typeof metadata === 'string') {
              try {
                metadata = JSON.parse(metadata);
              } catch (e) {
                logger.warn(`Failed to parse metadata for item ${item.id}, using as string`);
              }
            }
            
            // Get text chunks if available
            let textChunks = item.text_chunks || [];
            if (typeof textChunks === 'string') {
              try {
                textChunks = JSON.parse(textChunks);
              } catch (e) {
                textChunks = [textChunks];
              }
            }
            
            // Prepare content based on options
            let content = null;
            if (includeContent) {
              if (textChunks && textChunks.length > 0) {
                content = textChunks.join(' ');
              } else if (item.extracted_text) {
                content = item.extracted_text;
              }
            }
            
            // Estimate token count (rough approximation: 4 chars = 1 token)
            const estimatedTokens = content ? Math.ceil(content.length / 4) : 0;
            
            return {
              id: item.id,
              title: item.title || 'Untitled',
              sourceType: item.source_type,
              sourceId: item.source_identifier,
              score: item.score,
              content: content,
              estimatedTokens,
              metadata,
              summary: includeSummary ? item.summary || null : null,
              originalPath: item.original_content_path
            };
          } catch (err) {
            logger.warn(`Error processing search result for item ${item.id}`, err);
            return null;
          }
        })
        .filter(Boolean); // Remove null entries
      
      // Deduplicate if requested
      let finalResults = processedResults;
      if (deduplicate) {
        const seen = new Set();
        finalResults = processedResults.filter(item => {
          // Use content signature or ID for deduplication
          const signature = item.content 
            ? `${item.sourceType}-${item.content.substring(0, 100)}`
            : item.id;
          
          if (seen.has(signature)) return false;
          seen.add(signature);
          return true;
        });
      }
      
      // Limit to requested number of results
      finalResults = finalResults.slice(0, limit);
      
      // Limit total tokens if specified
      if (maxTotalTokens > 0) {
        let totalTokens = 0;
        finalResults = finalResults.filter(item => {
          totalTokens += item.estimatedTokens;
          return totalTokens <= maxTotalTokens;
        });
      }
      
      // Monitor memory after search
      const memAfter = memoryManager.monitorMemory();
      logger.debug(`Memory after semantic search: ${memAfter.heapUsedMB}MB, ${memAfter.heapUsedRatio.toFixed(2)}% used`);
      
      // Request garbage collection if memory usage is high
      if (memAfter.heapUsedRatio > 0.7 && global.gc) {
        logger.debug('High memory usage detected, requesting garbage collection');
        global.gc();
      }
      
      return finalResults;
    } catch (error) {
      logger.error('Error performing semantic search:', error);
      throw error;
    }
  },
  {
    queryName: 'semanticSearch',
    enableCache: true,
    cacheTTLMs: 300000, // 5 minutes cache
    // Custom key function based on query
    cacheKeyFn: (query, queryVector, options) => {
      if (!query && !queryVector) return 'search:invalid';
      const queryKey = query ? query.substring(0, 50) : '';
      const optionsKey = options ? JSON.stringify(Object.keys(options).sort()) : '';
      return `semantic:${queryKey}:${optionsKey}`;
    }
  }
);

/**
 * Get a specific item by ID with optimized content retrieval
 * @param {string} id The item ID
 * @param {Object} options Retrieval options
 * @returns {Promise<Object>} The item data
 */
const getItemById = optimizeQuery(
  async (id, options = {}) => {
    if (!collection) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Default options
      const {
        includeVector = false,
        includeContent = true
      } = options;
      
      // Since we can't directly query by ID with the current vectordb API,
      // we need to use search as a workaround
      const sampleVector = new Array(config.embeddings.dimensions).fill(0);
      const results = await collection.search(sampleVector).limit(1000).execute();
      
      // Find the item with matching ID
      const item = results.find(result => result.id === id);
      
      if (!item) {
        throw new Error(`Item with ID ${id} not found`);
      }
      
      // Process metadata
      let metadata = item.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          logger.warn(`Failed to parse metadata for item ${id}`);
        }
      }
      
      // Prepare response
      const response = {
        id: item.id,
        title: item.title || 'Untitled',
        sourceType: item.source_type,
        sourceId: item.source_identifier,
        metadata,
        originalPath: item.original_content_path
      };
      
      // Include content if requested
      if (includeContent) {
        if (item.text_chunks && Array.isArray(item.text_chunks)) {
          response.content = item.text_chunks.join(' ');
        } else if (typeof item.text_chunks === 'string') {
          try {
            const chunks = JSON.parse(item.text_chunks);
            response.content = Array.isArray(chunks) ? chunks.join(' ') : item.text_chunks;
          } catch (e) {
            response.content = item.text_chunks;
          }
        } else if (item.extracted_text) {
          response.content = item.extracted_text;
        }
      }
      
      // Include vector if requested
      if (includeVector && item.vector) {
        response.vector = item.vector;
      }
      
      return response;
    } catch (error) {
      logger.error(`Error retrieving item with ID ${id}:`, error);
      throw error;
    }
  },
  {
    queryName: 'getItemById',
    enableCache: true,
    cacheTTLMs: 300000, // 5 minutes cache
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
  semanticSearch,
  getItemById,
  getDatabaseStats,
  analyzeDatabasePerformance
}; 