// Configuration settings for the Knowledge Store

const path = require('path');
const fs = require('fs');
const electron = require('electron');

// Get the app data directory based on environment
const getAppDataPath = () => {
  if (process.env.NODE_ENV === 'test') {
    return path.join(__dirname, '../../data'); // Use test data directory for tests
  }
  
  // If APP_USER_DATA_PATH is set (from main.js), use it
  if (process.env.APP_USER_DATA_PATH) {
    return path.join(process.env.APP_USER_DATA_PATH, 'data');
  }
  
  // For Electron environment, use proper app data directory
  if (electron.app) {
    return path.join(electron.app.getPath('userData'), 'data');
  }
  
  // Fallback to project directory for non-Electron contexts
  return path.resolve(__dirname, '../../data');
}

// Ensure we're using consistent paths by resolving them
const dataPath = getAppDataPath();
console.log(`[INFO] Using data directory: ${dataPath}`);

// Default configuration values
const defaultConfig = {
  // Database settings
  database: {
    path: path.join(dataPath, 'vector_db'),
    name: 'knowledge_store',
    // Collection settings
    collection: 'knowledge_items',
  },
  
  // Content processing settings
  processing: {
    // Chunking settings
    chunkSize: 1000, // characters per chunk
    chunkOverlap: 200, // overlap between chunks
  },
  
  // Embedding model settings
  embeddings: {
    modelName: 'all-MiniLM-L6-v2', // Default model for node-nlp
    dimensions: 384, // Dimensions of the embedding vectors
  },
  
  // Paths
  paths: {
    modelCache: path.join(__dirname, '../../models'), // Local storage for downloaded models
    tempDir: path.join(__dirname, '../../temp'), // Temporary file storage
    logsDir: path.join(__dirname, '../../logs'), // Log file storage
  },
  
  // Storage paths (explicit definition to prevent frontend duplicates)
  storage: {
    pdfPath: path.join(dataPath, 'pdf_storage'),
    webPath: path.join(dataPath, 'web_storage'),
    videoPath: path.join(dataPath, 'video_storage'),
    transcriptPath: path.join(dataPath, 'transcript_storage')
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    maxFiles: process.env.LOG_MAX_FILES || '14d', // Keep logs for 14 days
    maxSize: process.env.LOG_MAX_SIZE || '20m', // 20MB per file
    colorize: true, // Colorize console output
    errorLogsMaxFiles: '30d', // Keep error logs longer
  }
};

// Create temporary logger for bootstrapping
// This gets replaced by the real logger after it's initialized
let tempLogger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

// Create a function to load and merge configurations
function loadConfig(configPath) {
  let userConfig = {};
  
  // If config file exists, load and parse it
  if (configPath && fs.existsSync(configPath)) {
    try {
      const configStr = fs.readFileSync(configPath, 'utf8');
      userConfig = JSON.parse(configStr);
      tempLogger.info(`Loaded configuration from ${configPath}`);
    } catch (error) {
      tempLogger.error(`Error loading configuration: ${error.message}`);
    }
  }
  
  // Merge default config with user config
  return {
    ...defaultConfig,
    ...userConfig,
    // Ensure nested objects are properly merged
    database: {
      ...defaultConfig.database,
      ...(userConfig.database || {})
    },
    processing: {
      ...defaultConfig.processing,
      ...(userConfig.processing || {})
    },
    embeddings: {
      ...defaultConfig.embeddings,
      ...(userConfig.embeddings || {})
    },
    paths: {
      ...defaultConfig.paths,
      ...(userConfig.paths || {})
    },
    storage: {
      ...defaultConfig.storage,
      ...(userConfig.storage || {})
    },
    logging: {
      ...defaultConfig.logging,
      ...(userConfig.logging || {})
    }
  };
}

// Export the configuration
const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../../config.json');
const config = loadConfig(configPath);

// Create necessary directories if they don't exist
[
  config.database.path, 
  config.paths.modelCache, 
  config.paths.tempDir,
  config.paths.logsDir,
  config.storage.pdfPath,
  config.storage.webPath,
  config.storage.videoPath,
  config.storage.transcriptPath
].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    tempLogger.info(`Created directory: ${dir}`);
  }
});

module.exports = config; 