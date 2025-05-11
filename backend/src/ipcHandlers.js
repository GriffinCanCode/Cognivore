/**
 * IPC Handlers
 * Module to centralize all IPC channel handlers for the main process
 */

const { ipcMain } = require('electron');
const { createContextLogger } = require('./utils/logger');
const logger = createContextLogger('IPC');

// Import services
const { processPDF } = require('./services/pdfProcessor');
const { processURL } = require('./services/urlProcessor');
const { processYouTube } = require('./services/youtubeProcessor');
const { deleteItem, listItems } = require('./services/database');
const { semanticSearch } = require('./services/search');
const toolsService = require('./services/tools');

/**
 * Initialize all IPC handlers
 * This function sets up all the IPC channels between the main and renderer processes
 */
function initializeIpcHandlers() {
  logger.info('Initializing IPC handlers');

  // Initialize tools service
  toolsService.initialize();

  // Process PDF
  ipcMain.handle('process-pdf', async (event, filePath) => {
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
  ipcMain.handle('process-url', async (event, url) => {
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
  ipcMain.handle('process-youtube', async (event, url) => {
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
  ipcMain.handle('delete-item', async (event, id) => {
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
  ipcMain.handle('list-items', async (event) => {
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
  ipcMain.handle('search', async (event, query, limit = 5) => {
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

  // Get available tools
  ipcMain.handle('get-available-tools', async (event) => {
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
  ipcMain.handle('execute-tool', async (event, toolName, params) => {
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
  ipcMain.handle('generate-summary', async (event, documentId, content, title) => {
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

  logger.info('IPC handlers initialized');
}

module.exports = {
  initializeIpcHandlers
}; 