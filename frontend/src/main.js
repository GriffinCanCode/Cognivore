const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    if (mainWindow === null) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
// Process PDF
ipcMain.handle('process-pdf', async (event, filePath) => {
  try {
    const result = await processPDF(filePath);
    return { success: true, result };
  } catch (error) {
    console.error('Error processing PDF:', error);
    return { success: false, error: error.message };
  }
});

// Process URL
ipcMain.handle('process-url', async (event, url) => {
  try {
    const result = await processURL(url);
    return { success: true, result };
  } catch (error) {
    console.error('Error processing URL:', error);
    return { success: false, error: error.message };
  }
});

// Process YouTube
ipcMain.handle('process-youtube', async (event, url) => {
  try {
    const result = await processYouTube(url);
    return { success: true, result };
  } catch (error) {
    console.error('Error processing YouTube:', error);
    return { success: false, error: error.message };
  }
});

// Delete item
ipcMain.handle('delete-item', async (event, id) => {
  try {
    const result = await deleteItem(id);
    return { success: true, result };
  } catch (error) {
    console.error('Error deleting item:', error);
    return { success: false, error: error.message };
  }
});

// List items
ipcMain.handle('list-items', async (event) => {
  try {
    const items = await listItems();
    return { success: true, items };
  } catch (error) {
    console.error('Error listing items:', error);
    return { success: false, error: error.message };
  }
}); 