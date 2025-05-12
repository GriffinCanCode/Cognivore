/**
 * Database Service
 * Handles LanceDB initialization and operations
 */

const lancedb = require('vectordb');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const util = require('util');
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

// Promisify zlib functions
const gzipAsync = util.promisify(zlib.gzip);
const gunzipAsync = util.promisify(zlib.gunzip);

const logger = createContextLogger('Database');

let db;
let collection;
let monitoredDb;

// Ensure storage directories exist
const ensureStorageDirectories = () => {
  const storagePaths = [
    config.storage.pdfPath,
    config.storage.webPath,
    config.storage.videoPath,
    config.storage.transcriptPath
  ];
  
  storagePaths.forEach(dirPath => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`Created storage directory: ${dirPath}`);
    }
  });
};

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
    
    // Ensure file storage directories exist
    ensureStorageDirectories();

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
        summary: 'Sample summary',
        file_path: '',
        file_size: 0,
        transcript: '',
        compressed: false,
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
 * Compress text data using gzip
 * @param {string} text - The text to compress
 * @returns {Promise<Buffer>} - Compressed data
 */
async function compressText(text) {
  try {
    return await gzipAsync(Buffer.from(text, 'utf8'));
  } catch (error) {
    logger.error('Error compressing text:', error);
    return Buffer.from(text, 'utf8'); // Return uncompressed as fallback
  }
}

/**
 * Decompress text data
 * @param {Buffer} compressed - The compressed data
 * @returns {Promise<string>} - Decompressed text
 */
async function decompressText(compressed) {
  try {
    const buffer = await gunzipAsync(compressed);
    return buffer.toString('utf8');
  } catch (error) {
    logger.error('Error decompressing text:', error);
    return compressed.toString('utf8'); // Return as-is as fallback
  }
}

/**
 * Store a file in the appropriate storage directory
 * @param {string} sourcePath - Original file path
 * @param {string} sourceType - Type of content (pdf, url, youtube)
 * @param {string} identifier - Unique identifier for the file
 * @returns {Promise<Object>} - File storage information
 */
async function storeFile(sourcePath, sourceType, identifier) {
  try {
    // Determine target storage directory based on source type
    let targetDir;
    switch (sourceType) {
      case 'pdf':
        targetDir = config.storage.pdfPath;
        break;
      case 'url':
        targetDir = config.storage.webPath;
        break;
      case 'youtube':
        targetDir = config.storage.videoPath;
        break;
      default:
        targetDir = path.join(config.database.path, 'misc_storage');
    }
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Generate target filename
    const fileExt = path.extname(sourcePath) || '.bin';
    const filename = `${identifier}${fileExt}`;
    const targetPath = path.join(targetDir, filename);
    
    // Check if file already exists
    if (fs.existsSync(targetPath)) {
      logger.debug(`File already exists at ${targetPath}, skipping copy`);
      const stats = fs.statSync(targetPath);
      return {
        path: targetPath,
        size: stats.size,
        exists: true
      };
    }
    
    // Copy file to storage location
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      const stats = fs.statSync(targetPath);
      logger.info(`Stored file: ${targetPath} (${stats.size} bytes)`);
      return {
        path: targetPath,
        size: stats.size,
        exists: false
      };
    } else {
      throw new Error(`Source file not found: ${sourcePath}`);
    }
  } catch (error) {
    logger.error(`Error storing file: ${error.message}`, { sourcePath, sourceType });
    return {
      path: sourcePath,
      size: 0,
      error: error.message
    };
  }
}

/**
 * Store YouTube thumbnail for a video
 * @param {string} thumbnailUrl - URL of the YouTube thumbnail
 * @param {string} identifier - Unique identifier 
 * @returns {Promise<Object>} - Thumbnail storage information
 */
async function storeYouTubeThumbnail(thumbnailUrl, identifier) {
  try {
    const targetDir = config.storage.videoPath;
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Generate target filename
    const targetPath = path.join(targetDir, `${identifier}_thumbnail.jpg`);
    
    // Store the thumbnail URL in a JSON file for retrieval
    const thumbnailData = {
      url: thumbnailUrl,
      id: identifier,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(targetPath + '.json', JSON.stringify(thumbnailData, null, 2));
    
    logger.info(`Stored YouTube thumbnail reference: ${targetPath}.json`);
    return {
      path: targetPath + '.json',
      url: thumbnailUrl
    };
  } catch (error) {
    logger.error(`Error storing YouTube thumbnail: ${error.message}`);
    return {
      error: error.message
    };
  }
}

/**
 * Store transcript data for video content
 * @param {string} transcript - The transcript text
 * @param {string} identifier - Unique identifier 
 * @returns {Promise<Object>} - Transcript storage information
 */
async function storeTranscript(transcript, identifier) {
  try {
    const targetDir = config.storage.transcriptPath;
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Generate target filename
    const targetPath = path.join(targetDir, `${identifier}.txt`);
    
    // Compress transcript
    const compressed = await compressText(transcript);
    
    // Write compressed transcript to file
    fs.writeFileSync(targetPath + '.gz', compressed);
    
    logger.info(`Stored compressed transcript: ${targetPath}.gz (${compressed.length} bytes)`);
    return {
      path: targetPath + '.gz',
      size: compressed.length,
      compressed: true
    };
  } catch (error) {
    logger.error(`Error storing transcript: ${error.message}`);
    return {
      error: error.message
    };
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
      // Handle camelCase to snake_case conversion for database fields
      const dbItem = { ...item };
      
      // Convert extractedText to extracted_text if present
      if (dbItem.extractedText !== undefined) {
        dbItem.extracted_text = dbItem.extractedText;
        delete dbItem.extractedText;
        logger.debug('Converted extractedText to extracted_text for database compatibility');
      }
      
      // Ensure text_chunks field exists, it's required by the vectordb schema
      if (!dbItem.text_chunks) {
        // Create text_chunks from extracted_text if available
        if (dbItem.extracted_text) {
          if (typeof dbItem.extracted_text === 'string') {
            // Create a single chunk if it's just a string
            dbItem.text_chunks = [dbItem.extracted_text];
            logger.debug('Created text_chunks from extracted_text');
          }
        } else if (item.extractedText) {
          // Use the original extractedText if available
          dbItem.text_chunks = [item.extractedText];
          logger.debug('Created text_chunks from original extractedText');
        } else {
          // Create an empty array as fallback
          dbItem.text_chunks = ['No text content available'];
          logger.warn('No text content found, using placeholder for text_chunks');
        }
      } else if (typeof dbItem.text_chunks === 'string') {
        // If text_chunks is a string, convert it to an array
        try {
          // Try parsing it first in case it's a stringified JSON array
          dbItem.text_chunks = JSON.parse(dbItem.text_chunks);
        } catch (e) {
          // If parsing fails, treat it as a single string chunk
          dbItem.text_chunks = [dbItem.text_chunks];
        }
        logger.debug('Ensured text_chunks is an array');
      }
      
      // Ensure summary field exists, it's required by the vectordb schema
      if (!dbItem.summary) {
        // Generate a simple summary based on title or other fields
        if (dbItem.title) {
          dbItem.summary = `Summary of ${dbItem.title}`;
          logger.debug('Created placeholder summary from title');
        } else if (dbItem.source_type && dbItem.source_identifier) {
          dbItem.summary = `Content from ${dbItem.source_type}: ${dbItem.source_identifier}`;
          logger.debug('Created placeholder summary from source info');
        } else {
          // Default summary
          dbItem.summary = 'No summary available';
          logger.debug('Created default placeholder summary');
        }
      }
      
      // Ensure transcript field exists, it's required by the vectordb schema
      if (dbItem.transcript === undefined) {
        // Only add transcript field if not present to avoid overwriting existing data
        if (dbItem.source_type === 'youtube') {
          // For YouTube, we might get a transcript later, so use a pending message
          dbItem.transcript = '[Transcript pending]';
          logger.debug('Created placeholder transcript for YouTube content');
        } else {
          // For non-video content, set a default value
          dbItem.transcript = '';
          logger.debug('Set empty transcript for non-video content');
        }
      }

      // Ensure compressed field exists, it's required by the vectordb schema
      if (dbItem.compressed === undefined) {
        dbItem.compressed = false;
        logger.debug('Set default compressed flag to false');
      }
      
      // Ensure metadata is properly stringified if it's an object
      if (typeof dbItem.metadata === 'object') {
        dbItem.metadata = JSON.stringify(dbItem.metadata);
      }
      
      // Handle file storage if needed
      if (dbItem.source_type && dbItem.original_content_path) {
        const fileInfo = await storeFile(
          dbItem.original_content_path,
          dbItem.source_type,
          dbItem.id || crypto.randomUUID()
        );
        
        if (!dbItem.id) {
          dbItem.id = path.basename(fileInfo.path, path.extname(fileInfo.path));
        }
        
        // Update item with file information
        dbItem.file_path = fileInfo.path;
        dbItem.file_size = fileInfo.size;
      }
      
      // Handle YouTube specific metadata
      if (dbItem.source_type === 'youtube') {
        // Ensure source_identifier has the YouTube URL
        if (!dbItem.source_identifier && dbItem.youtubeUrl) {
          dbItem.source_identifier = dbItem.youtubeUrl;
        }
        
        // Store the thumbnail URL reference if available
        if (dbItem.thumbnailUrl) {
          const thumbnailInfo = await storeYouTubeThumbnail(
            dbItem.thumbnailUrl,
            dbItem.id || crypto.randomUUID()
          );
          
          if (thumbnailInfo.url) {
            dbItem.thumbnail_url = thumbnailInfo.url;
          }
        }
        
        // Make sure source_identifier is a full YouTube link
        if (dbItem.source_identifier && !dbItem.source_identifier.startsWith('http')) {
          // Convert video ID to full URL if needed
          if (dbItem.source_identifier.length === 11) { // Standard YouTube video ID length
            dbItem.source_identifier = `https://www.youtube.com/watch?v=${dbItem.source_identifier}`;
          }
        }
      }
      
      // Handle transcript storage for YouTube videos
      if (dbItem.source_type === 'youtube' && dbItem.transcript) {
        const transcriptInfo = await storeTranscript(
          dbItem.transcript,
          dbItem.id || crypto.randomUUID()
        );
        
        if (transcriptInfo.path) {
          dbItem.transcript_path = transcriptInfo.path;
          dbItem.transcript_compressed = true;
          
          // Replace original transcript with path to avoid duplicate storage
          if (dbItem.transcript && dbItem.transcript.length > 100) {
            dbItem.transcript = `[Stored at ${transcriptInfo.path}]`;
          }
        }
      }
      
      // Add timestamp if not present
      if (!dbItem.created_at) {
        dbItem.created_at = new Date().toISOString();
      }
      
      await collection.add([dbItem]);
      return item; // Return the original item for consistency with the rest of the code
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
    
    if (!id) {
      throw new Error('Item ID is required for deletion');
    }
    
    logger.info(`Attempting to delete item with ID: ${id}`);
    
    try {
      // Get item to retrieve file path before deletion
      const sampleVector = new Array(config.embeddings.dimensions).fill(0);
      logger.debug(`Searching for item with ID: ${id} before deletion`);
      
      const results = await collection.search(sampleVector).limit(1000).execute();
      const item = results.find(result => result.id === id);
      
      if (!item) {
        logger.warn(`Item with ID ${id} not found for deletion`);
        // Return true as the end result is the same - item doesn't exist
        return true;
      }
      
      logger.debug(`Found item for deletion: ${id}, title: ${item.title || 'Untitled'}`);
      
      // Delete associated files if they exist
      if (item.file_path) {
        try {
          if (fs.existsSync(item.file_path)) {
            fs.unlinkSync(item.file_path);
            logger.info(`Deleted file: ${item.file_path}`);
          } else {
            logger.warn(`File does not exist: ${item.file_path}`);
          }
        } catch (fileError) {
          // Log but don't fail the whole operation if file deletion fails
          logger.error(`Error deleting file ${item.file_path}:`, fileError);
        }
      }
      
      if (item.transcript_path) {
        try {
          if (fs.existsSync(item.transcript_path)) {
            fs.unlinkSync(item.transcript_path);
            logger.info(`Deleted transcript: ${item.transcript_path}`);
          } else {
            logger.warn(`Transcript file does not exist: ${item.transcript_path}`);
          }
        } catch (transcriptError) {
          // Log but don't fail the whole operation if transcript deletion fails
          logger.error(`Error deleting transcript ${item.transcript_path}:`, transcriptError);
        }
      }
      
      // LanceDB uses a SQL-like query language
      logger.debug(`Executing database delete for item: ${id}`);
      await collection.delete(`id='${id}'`);
      logger.info(`Successfully deleted item with ID: ${id} from database`);
      
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
      return results.map(item => {
        // Generate preview from available text
        let preview = '';
        if (item.text_chunks && Array.isArray(item.text_chunks) && item.text_chunks.length > 0) {
          // Join first few chunks for a longer preview
          preview = item.text_chunks.slice(0, 3).join(' ');
          // Limit preview length
          if (preview.length > 500) {
            preview = preview.substring(0, 497) + '...';
          }
        } else if (item.extracted_text) {
          preview = item.extracted_text;
          // Limit preview length
          if (preview.length > 500) {
            preview = preview.substring(0, 497) + '...';
          }
        }
        
        return {
          id: item.id,
          title: item.title || 'Untitled',
          source_type: item.source_type,
          source_identifier: item.source_identifier,
          thumbnail_url: item.thumbnail_url || null,
          preview: preview,
          created_at: item.created_at
        };
      });
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
        includeContent = true,
        includeTranscript = false,
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
        originalPath: item.original_content_path,
        filePath: item.file_path,
        fileSize: item.file_size,
        summary: item.summary || null,
        createdAt: item.created_at
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
      
      // Include transcript if requested and available
      if (includeTranscript && item.source_type === 'youtube') {
        if (item.transcript_path && fs.existsSync(item.transcript_path)) {
          // Load and decompress transcript
          const compressed = fs.readFileSync(item.transcript_path);
          try {
            response.transcript = await decompressText(compressed);
          } catch (e) {
            logger.warn(`Failed to decompress transcript for item ${id}: ${e.message}`);
            response.transcript = '[Transcript decompression failed]';
          }
        } else if (item.transcript) {
          response.transcript = item.transcript;
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
  analyzeDatabasePerformance,
  storeFile,
  storeTranscript,
  storeYouTubeThumbnail,
  compressText,
  decompressText
}; 