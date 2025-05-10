const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { logger, createContextLogger } = require('./utils/logger');

// Create a context logger for the main process
const mainLogger = createContextLogger('Main');

// Import backend services
const { processPDF } = require('../../backend/src/services/pdfProcessor');
const { processURL } = require('../../backend/src/services/urlProcessor');
const { processYouTube } = require('../../backend/src/services/youtubeProcessor');
const { deleteItem, listItems } = require('../../backend/src/services/database');

// Ensure the database is initialized
require('../../backend/src/index');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  mainLogger.info('Creating main window');
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  // Open the DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
    mainLogger.debug('DevTools opened in development mode');
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainLogger.info('Main window closed');
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  mainLogger.info('Application ready, creating window');
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    if (mainWindow === null) {
      mainLogger.info('Activating application, creating window');
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    mainLogger.info('All windows closed, quitting app');
    app.quit();
  }
});

// Global error handler
app.on('render-process-gone', (event, webContents, details) => {
  mainLogger.error('Renderer process crashed', { reason: details.reason, exitCode: details.exitCode });
});

// IPC handlers
// Process PDF
ipcMain.handle('process-pdf', async (event, filePath) => {
  try {
    mainLogger.info(`Processing PDF: ${filePath}`);
    const result = await processPDF(filePath);
    mainLogger.debug('PDF processing completed successfully');
    return { success: true, result };
  } catch (error) {
    mainLogger.error('Error processing PDF:', error);
    return { success: false, error: error.message };
  }
});

// Process URL
ipcMain.handle('process-url', async (event, url) => {
  try {
    mainLogger.info(`Processing URL: ${url}`);
    const result = await processURL(url);
    mainLogger.debug('URL processing completed successfully');
    return { success: true, result };
  } catch (error) {
    mainLogger.error('Error processing URL:', error);
    return { success: false, error: error.message };
  }
});

// Process YouTube
ipcMain.handle('process-youtube', async (event, url) => {
  try {
    mainLogger.info(`Processing YouTube: ${url}`);
    const result = await processYouTube(url);
    mainLogger.debug('YouTube processing completed successfully');
    return { success: true, result };
  } catch (error) {
    mainLogger.error('Error processing YouTube:', error);
    return { success: false, error: error.message };
  }
});

// Delete item
ipcMain.handle('delete-item', async (event, id) => {
  try {
    mainLogger.info(`Deleting item: ${id}`);
    const result = await deleteItem(id);
    mainLogger.debug('Item deleted successfully');
    return { success: true, result };
  } catch (error) {
    mainLogger.error('Error deleting item:', error);
    return { success: false, error: error.message };
  }
});

// List items
ipcMain.handle('list-items', async (event) => {
  try {
    mainLogger.info('Listing items');
    const items = await listItems();
    mainLogger.debug(`Listed ${items.length} items successfully`);
    return { success: true, items };
  } catch (error) {
    mainLogger.error('Error listing items:', error);
    return { success: false, error: error.message };
  }
}); 