const { contextBridge, ipcRenderer } = require('electron');

// Inline logger to avoid module issues in the preload context
const log = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, error) => console.error(`[ERROR] ${message}`, error)
};

// Define API methods to expose to renderer process
const api = {
  // PDF processing
  processPDF: async (filePath) => {
    try {
      return await ipcRenderer.invoke('process-pdf', filePath);
    } catch (error) {
      log.error('Error processing PDF:', error);
      throw error;
    }
  },
  
  // URL processing
  processURL: async (url) => {
    try {
      return await ipcRenderer.invoke('process-url', url);
    } catch (error) {
      log.error('Error processing URL:', error);
      throw error;
    }
  },
  
  // YouTube URL processing
  processYouTube: async (url) => {
    try {
      return await ipcRenderer.invoke('process-youtube', url);
    } catch (error) {
      log.error('Error processing YouTube URL:', error);
      throw error;
    }
  },
  
  // List all items in the database
  listItems: async () => {
    try {
      return await ipcRenderer.invoke('list-items');
    } catch (error) {
      log.error('Error listing items:', error);
      throw error;
    }
  },
  
  // Delete an item from the database
  deleteItem: async (itemId) => {
    try {
      return await ipcRenderer.invoke('delete-item', itemId);
    } catch (error) {
      log.error('Error deleting item:', error);
      throw error;
    }
  },
  
  // Search items in the database
  search: async (query, limit = 10) => {
    try {
      return await ipcRenderer.invoke('search', { query, limit });
    } catch (error) {
      log.error('Error searching:', error);
      throw error;
    }
  }
};

// Expose the API to the renderer process
try {
  contextBridge.exposeInMainWorld('api', api);
  log.info('API exposed to renderer process');
} catch (error) {
  log.error('Failed to expose API:', error);
} 