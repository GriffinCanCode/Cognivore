const { contextBridge, ipcRenderer } = require('electron');
const { createContextLogger } = require('./utils/logger');

// Create a renderer-specific logger
const rendererLogger = createContextLogger('Renderer');

// Expose API to the renderer process
contextBridge.exposeInMainWorld('api', {
  // Data processing methods
  processPDF: (filePath) => ipcRenderer.invoke('process-pdf', filePath),
  processURL: (url) => ipcRenderer.invoke('process-url', url),
  processYouTube: (url) => ipcRenderer.invoke('process-youtube', url),
  deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
  listItems: () => ipcRenderer.invoke('list-items'),
  
  // Logger API for renderer process
  logger: {
    error: (message, ...args) => {
      rendererLogger.error(message, ...args);
      return null; // Return null to avoid exposing complex objects to renderer
    },
    warn: (message, ...args) => {
      rendererLogger.warn(message, ...args);
      return null;
    },
    info: (message, ...args) => {
      rendererLogger.info(message, ...args);
      return null;
    },
    debug: (message, ...args) => {
      rendererLogger.debug(message, ...args);
      return null;
    },
    // Helpers for specific contexts in renderer
    createContextLogger: (context) => {
      // Return simplified logger API for the renderer
      return {
        error: (message, ...args) => {
          rendererLogger.error(`[${context}] ${message}`, ...args);
          return null;
        },
        warn: (message, ...args) => {
          rendererLogger.warn(`[${context}] ${message}`, ...args);
          return null;
        },
        info: (message, ...args) => {
          rendererLogger.info(`[${context}] ${message}`, ...args);
          return null;
        },
        debug: (message, ...args) => {
          rendererLogger.debug(`[${context}] ${message}`, ...args);
          return null;
        }
      };
    }
  }
}); 