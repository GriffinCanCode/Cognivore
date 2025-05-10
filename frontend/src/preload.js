const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // PDF processing
    processPDF: (filePath) => ipcRenderer.invoke('process-pdf', filePath),
    
    // URL processing
    processURL: (url) => ipcRenderer.invoke('process-url', url),
    
    // YouTube processing
    processYouTube: (url) => ipcRenderer.invoke('process-youtube', url),
    
    // Data management
    deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
    listItems: () => ipcRenderer.invoke('list-items'),
    
    // Other utility functions can be added here
  }
); 