const { app, BrowserWindow } = require('electron');
const path = require('path');
const { logger, createContextLogger } = require('./utils/logger');

// Create a context logger for the main process
const mainLogger = createContextLogger('Main');

// Import backend services for initialization
require('../../backend/src/index');

// Import IPC handlers
const { initializeIpcHandlers } = require('../../backend/src/ipcHandlers');

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
  
  // Initialize IPC handlers
  initializeIpcHandlers();
  
  // Create the main window
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