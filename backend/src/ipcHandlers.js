/**
 * IPC Handlers
 * Module to centralize all IPC channel handlers for the main process
 */

const { ipcMain } = require('electron');
const { createContextLogger } = require('./utils/logger');
const logger = createContextLogger('IPC');
const fs = require('fs');
const path = require('path');

// Import services
const { processPDF } = require('./services/pdfProcessor');
const { processURL } = require('./services/urlProcessor');
const { processYouTube } = require('./services/youtubeProcessor');
const { deleteItem, listItems, semanticSearch: dbSemanticSearch } = require('./services/database');
const { semanticSearch } = require('./services/search');
const llmService = require('./services/llm');
const toolsService = require('./services/tools');
const config = require('./config');

// Function to find the story directory
function findStoryDirectory() {
  // Get the app path for packaged applications
  const app = require('electron').app;
  const appPath = app ? app.getAppPath() : null;
  const appResourcesPath = app ? app.getPath('exe').replace(/[^\/]*$/, '') : null;
  const userDataPath = app ? app.getPath('userData') : null;

  logger.info(`Looking for story directory with appPath: ${appPath}`);
  logger.info(`Looking for story directory with resources path: ${appResourcesPath}`);
  logger.info(`Looking for story directory with userData path: ${userDataPath}`);

  const possiblePaths = [
    // User data path (prioritized as it contains the copied files)
    userDataPath ? path.join(userDataPath, '@story') : null,
    
    // Development paths
    path.join(__dirname, '..', '@story'),
    path.join(__dirname, '@story'),
    path.join(process.cwd(), '@story'),
    path.join(process.cwd(), 'backend', '@story'),
    path.join(process.cwd(), 'dist', '@story'),
    path.join(process.cwd(), 'dist', 'backend', '@story'),
    
    // Packaged application paths
    appPath ? path.join(appPath, '@story') : null,
    appPath ? path.join(appPath, 'backend', '@story') : null, 
    appPath ? path.join(appPath, 'dist', '@story') : null,
    appPath ? path.join(appPath, 'dist', 'backend', '@story') : null,
    appPath ? path.join(appPath, 'resources', '@story') : null,
    
    // Resource paths in macOS app bundle
    appResourcesPath ? path.join(appResourcesPath, '@story') : null,
    appResourcesPath ? path.join(appResourcesPath, 'backend', '@story') : null,
    appResourcesPath ? path.join(appResourcesPath, 'resources', '@story') : null,
    appResourcesPath ? path.join(appResourcesPath, 'app.asar', '@story') : null,
    appResourcesPath ? path.join(appResourcesPath, 'app.asar.unpacked', '@story') : null,
    
    // Additional paths for resources in packaged app
    process.resourcesPath ? path.join(process.resourcesPath, '@story') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', '@story') : null
  ].filter(Boolean); // Filter out null paths

  // Log the paths we're checking
  logger.info(`Checking ${possiblePaths.length} possible story directory paths`);

  for (const dirPath of possiblePaths) {
    // Log individual path check
    logger.debug(`Checking story directory path: ${dirPath}`);
    
    try {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        if (jsonFiles.length > 0) {
          logger.info(`Found story directory at: ${dirPath} with ${jsonFiles.length} JSON files`);
          return dirPath;
        } else {
          logger.debug(`Directory exists but contains no JSON files: ${dirPath}`);
        }
      }
    } catch (err) {
      logger.debug(`Error checking path ${dirPath}: ${err.message}`);
    }
  }

  logger.error('Story directory not found in any of the expected locations');
  return null;
}

/**
 * Initialize all IPC handlers
 * This function sets up all the IPC channels between the main and renderer processes
 */
function initializeIpcHandlers() {
  logger.info('Initializing IPC handlers');

  // Initialize tools service
  toolsService.initialize();

  // Safe handler registration function to avoid conflicts
  const safelyRegisterHandler = (channel, handler) => {
    try {
      // Attempt to register the handler
      ipcMain.handle(channel, handler);
      logger.debug(`Registered IPC handler for: ${channel}`);
    } catch (error) {
      // If it fails because the handler already exists, log it but don't fail
      if (error.message && error.message.includes('Attempted to register a second handler')) {
        logger.info(`Handler for ${channel} already registered, skipping`);
      } else {
        // For other errors, log and rethrow
        logger.error(`Error registering handler for ${channel}:`, error);
        throw error;
      }
    }
  };

  // Health check handler
  safelyRegisterHandler('health-check', async () => {
    try {
      logger.debug('Health check requested');
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('Health check failed:', error);
      return { status: 'error', error: error.message };
    }
  });

  // Get config
  safelyRegisterHandler('get-config', async () => {
    try {
      logger.debug('Config requested');
      
      // Check if API key is valid
      const isApiKeyValid = await llmService.checkApiKey();
      
      return { 
        llmModel: process.env.LLM_MODEL || 'gemini-2.0-flash',
        embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-005',
        apiKeyValid: isApiKeyValid
      };
    } catch (error) {
      logger.error('Error retrieving config:', error);
      return { error: error.message };
    }
  });

  // Process PDF
  safelyRegisterHandler('process-pdf', async (event, filePath) => {
    try {
      logger.info(`Processing PDF: ${filePath}`);
      const result = await processPDF(filePath);
      logger.debug('PDF processing completed successfully');
      return { success: true, result };
    } catch (error) {
      logger.error('Error processing PDF:', error);
      return { success: false, error: error.message };
    }
  });

  // Process URL
  safelyRegisterHandler('process-url', async (event, url) => {
    try {
      logger.info(`Processing URL: ${url}`);
      const result = await processURL(url);
      logger.debug('URL processing completed successfully');
      return { success: true, result };
    } catch (error) {
      logger.error('Error processing URL:', error);
      return { success: false, error: error.message };
    }
  });

  // Process YouTube
  safelyRegisterHandler('process-youtube', async (event, url) => {
    try {
      logger.info(`Processing YouTube: ${url}`);
      const result = await processYouTube(url);
      logger.debug('YouTube processing completed successfully');
      return { success: true, result };
    } catch (error) {
      logger.error('Error processing YouTube:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete item
  safelyRegisterHandler('delete-item', async (event, id) => {
    try {
      logger.info(`Deleting item: ${id}`);
      const result = await deleteItem(id);
      logger.debug('Item deleted successfully');
      return { success: true, result };
    } catch (error) {
      logger.error('Error deleting item:', error);
      return { success: false, error: error.message };
    }
  });

  // List items
  safelyRegisterHandler('list-items', async (event) => {
    try {
      logger.info('Listing items');
      const items = await listItems();
      logger.debug(`Listed ${items.length} items successfully`);
      return { success: true, items };
    } catch (error) {
      logger.error('Error listing items:', error);
      return { success: false, error: error.message };
    }
  });

  // Semantic search
  safelyRegisterHandler('search', async (event, query, limit = 5) => {
    try {
      logger.info(`Searching for: "${query}"`);
      const results = await semanticSearch(query, limit);
      logger.debug(`Search completed with ${results.length} results`);
      return { success: true, results };
    } catch (error) {
      logger.error('Error performing search:', error);
      return { success: false, error: error.message };
    }
  });

  // List all files
  safelyRegisterHandler('list-all-files', async (event, params = {}) => {
    try {
      logger.info('List all files request received', params);
      
      // Execute the listAllFiles tool
      const result = await toolsService.listAllFiles(params);
      
      logger.debug(`List all files completed with ${result.totalItems} items`);
      return { success: true, ...result };
    } catch (error) {
      logger.error('Error listing all files:', error);
      return { success: false, error: error.message };
    }
  });
  
  // List files by type
  safelyRegisterHandler('list-files-by-type', async (event, params) => {
    try {
      logger.info(`List files by type request received: ${params.fileType}`);
      
      // Execute the listFilesByType tool
      const result = await toolsService.listFilesByType(params);
      
      logger.debug(`List files by type completed with ${result.totalItems} items`);
      return { success: true, ...result };
    } catch (error) {
      logger.error('Error listing files by type:', error);
      return { success: false, error: error.message };
    }
  });
  
  // List files with content
  safelyRegisterHandler('list-files-with-content', async (event, params) => {
    try {
      logger.info(`List files with content request received: ${params.contentQuery}`);
      
      // Execute the listFilesWithContent tool
      const result = await toolsService.listFilesWithContent(params);
      
      logger.debug(`List files with content completed with ${result.totalItems} items`);
      return { success: true, ...result };
    } catch (error) {
      logger.error('Error listing files with content:', error);
      return { success: false, error: error.message };
    }
  });
  
  // List recent files
  safelyRegisterHandler('list-recent-files', async (event, params = {}) => {
    try {
      logger.info(`List recent files request received: ${params.days} days`);
      
      // Execute the listRecentFiles tool
      const result = await toolsService.listRecentFiles(params);
      
      logger.debug(`List recent files completed with ${result.totalItems} items`);
      return { success: true, ...result };
    } catch (error) {
      logger.error('Error listing recent files:', error);
      return { success: false, error: error.message };
    }
  });

  // Get available tools
  safelyRegisterHandler('get-available-tools', async (event) => {
    try {
      logger.info('Retrieving available tools');
      const tools = toolsService.getAvailableTools();
      logger.debug(`Retrieved ${tools.length} available tools`);
      return { success: true, tools };
    } catch (error) {
      logger.error('Error retrieving available tools:', error);
      return { success: false, error: error.message };
    }
  });

  // Execute tool
  safelyRegisterHandler('execute-tool', async (event, toolName, params) => {
    try {
      logger.info(`Executing tool: ${toolName}`);
      const result = await toolsService.executeTool(toolName, params);
      logger.debug(`Tool execution completed: ${toolName}`);
      return result; // Result already has success property
    } catch (error) {
      logger.error(`Error executing tool ${toolName}:`, error);
      return { success: false, error: error.message };
    }
  });

  // Generate document summary
  safelyRegisterHandler('generate-summary', async (event, documentId, content, title) => {
    try {
      logger.info(`Generating summary for document: ${documentId}`);
      const result = await toolsService.executeTool('summary', { documentId, content, title });
      logger.debug(`Summary generation completed for document: ${documentId}`);
      return result; // Result already has success property
    } catch (error) {
      logger.error(`Error generating summary for document ${documentId}:`, error);
      return { success: false, error: error.message };
    }
  });

  // LLM chat
  safelyRegisterHandler('chat', async (event, params) => {
    try {
      logger.info(`Chat request received with model: ${params.model || 'default'}`);
      
      if (!params || !params.message) {
        throw new Error('Message is required for chat');
      }
      
      const result = await llmService.chat(params);
      logger.debug('Chat response generated successfully');
      return result;
    } catch (error) {
      logger.error('Error in chat:', error);
      throw error; // Let the frontend handle this error
    }
  });

  // Generate embeddings
  safelyRegisterHandler('generate-embeddings', async (event, params) => {
    try {
      logger.info('Embeddings generation requested');
      
      if (!params || !params.text) {
        throw new Error('Text is required for embedding generation');
      }
      
      const result = await llmService.generateEmbeddings(params.text, params.model);
      logger.debug('Embeddings generated successfully');
      return result;
    } catch (error) {
      logger.error('Error generating embeddings:', error);
      throw error; // Let the frontend handle this error
    }
  });

  // Execute tool call (from LLM)
  safelyRegisterHandler('execute-tool-call', async (event, params) => {
    try {
      logger.info(`Tool call execution requested: ${params.toolName}`);
      
      if (!params || !params.toolName) {
        throw new Error('Tool name is required for tool call execution');
      }
      
      const result = await llmService.executeToolCall(params);
      logger.debug(`Tool call executed successfully: ${params.toolName}`);
      return result;
    } catch (error) {
      logger.error(`Error executing tool call: ${params?.toolName || 'unknown'}`, error);
      throw error; // Let the frontend handle this error
    }
  });

  // Semantic RAG search (advanced with options)
  safelyRegisterHandler('semantic-search', async (event, query, queryVector, options = {}) => {
    try {
      logger.info(`Advanced semantic search for: "${query}"`);
      
      // Generate embeddings if queryVector not provided
      let vectorToUse = queryVector;
      if (!vectorToUse && query) {
        logger.debug('Generating embeddings for semantic search query');
        const embeddingResult = await llmService.generateEmbeddings(query);
        vectorToUse = embeddingResult.embedding;
      }
      
      if (!vectorToUse) {
        throw new Error('Either query or queryVector must be provided for semantic search');
      }
      
      // Perform semantic search with our advanced implementation
      const results = await dbSemanticSearch(query, vectorToUse, options);
      logger.debug(`Advanced semantic search completed with ${results.length} results`);
      return { success: true, results };
    } catch (error) {
      logger.error('Error performing advanced semantic search:', error);
      return { success: false, error: error.message };
    }
  });

  // Get story chapters
  safelyRegisterHandler('get-story-chapters', async () => {
    try {
      logger.info('Fetching story chapters');
      const storyDir = findStoryDirectory();
      
      if (!storyDir) {
        logger.error('Story directory not found');
        return [];
      }
      
      const files = fs.readdirSync(storyDir);
      const chapters = files
        .filter(file => file.endsWith('.json'))
        .map((file, index) => {
          try {
            // Try to read the file to get the title from the JSON
            const content = fs.readFileSync(path.join(storyDir, file), 'utf8');
            const chapterData = JSON.parse(content);
            
            return {
              id: chapterData.chapter || index + 1,
              fileName: file,
              title: chapterData.title || file.replace('.json', '').replace(/^\d+_/, '').replace(/_/g, ' ')
            };
          } catch (err) {
            // If reading fails, use the filename as title
            logger.error(`Error reading chapter file ${file}:`, err);
            return {
              id: index + 1,
              fileName: file,
              title: file.replace('.json', '').replace(/^\d+_/, '').replace(/_/g, ' ')
            };
          }
        })
        .sort((a, b) => {
          // Sort by chapter number first
          return a.id - b.id;
        });
      
      logger.info(`Found ${chapters.length} story chapters`);
      return chapters;
    } catch (error) {
      logger.error('Error fetching story chapters:', error);
      return [];
    }
  });

  // Get story chapter content
  safelyRegisterHandler('get-story-chapter-content', async (event, fileName) => {
    try {
      logger.info(`Fetching content for story chapter: ${fileName}`);
      const storyDir = findStoryDirectory();
      
      if (!storyDir) {
        logger.error('Story directory not found');
        return null;
      }
      
      const filePath = path.join(storyDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        logger.error(`Chapter file not found: ${filePath}`);
        return null;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      const chapterData = JSON.parse(content);
      
      logger.debug(`Successfully loaded chapter content for ${fileName}`);
      return chapterData;
    } catch (error) {
      logger.error(`Error fetching content for story chapter ${fileName}:`, error);
      return null;
    }
  });

  logger.info('IPC handlers initialized');
}

module.exports = {
  initializeIpcHandlers
}; 