const { contextBridge, ipcRenderer } = require('electron');

// Inline simple logger implementation
// This avoids the need for external module dependencies in preload context
const createSimpleLogger = (context) => {
  const logLevels = ['error', 'warn', 'info', 'debug'];
  
  // Return a logger object with methods for each log level
  const logger = {};
  logLevels.forEach(level => {
    logger[level] = (message, ...args) => {
      const formattedMessage = `[${context}] ${message}`;
      console[level](formattedMessage, ...args);
      return null; // Prevent object exposure to renderer
    };
  });
  
  return logger;
};

// Create a renderer-specific logger
const rendererLogger = createSimpleLogger('Renderer');

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
          console.error(`[${context}] ${message}`, ...args);
          return null;
        },
        warn: (message, ...args) => {
          console.warn(`[${context}] ${message}`, ...args);
          return null;
        },
        info: (message, ...args) => {
          console.info(`[${context}] ${message}`, ...args);
          return null;
        },
        debug: (message, ...args) => {
          console.debug(`[${context}] ${message}`, ...args);
          return null;
        }
      };
    }
  }
}); 