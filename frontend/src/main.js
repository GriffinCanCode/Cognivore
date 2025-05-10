const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');

// Check if we're in development mode
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Keep a global reference of the mainWindow object to prevent garbage collection
let mainWindow = null;

// Initialize backend IPC handlers
function initializeIPC() {
  try {
    // Import the backend IPC handlers - try different paths for flexibility
    let backendPath = path.join(__dirname, '../../backend/src/ipcHandlers.js');
    
    // If the direct path doesn't exist, try relative to app root
    if (!fs.existsSync(backendPath)) {
      const appRoot = path.resolve(app.getAppPath(), '..');
      backendPath = path.join(appRoot, 'backend/src/ipcHandlers.js');
      
      // If still not found, log error and return
      if (!fs.existsSync(backendPath)) {
        logger.error(`Backend IPC handlers not found at: ${backendPath}`);
        logger.error('Tried paths:', {
          direct: path.join(__dirname, '../../backend/src/ipcHandlers.js'),
          appRoot: backendPath
        });
        return;
      }
    }
    
    // Dynamically require the IPC handlers
    logger.info(`Loading IPC handlers from: ${backendPath}`);
    const handlers = require(backendPath);
    
    // Debug what's exported from the module
    logger.info('Available exports:', Object.keys(handlers));
    
    // Initialize the IPC handlers
    if (typeof handlers.initializeIpcHandlers === 'function') {
      handlers.initializeIpcHandlers();
      logger.info('IPC handlers initialized successfully');
    } else {
      logger.error('initializeIpcHandlers function not found in backend module');
    }
  } catch (error) {
    logger.error('Error initializing IPC handlers:', error);
  }
}

// Create the browser window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  // Load the app entry point
  if (isDev) {
    // In development mode, load from dist directory where webpack outputs
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    
    // Open DevTools in development mode
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the bundled version
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  logger.info('Main window created successfully');
}

// When Electron has finished initialization and is ready
app.whenReady().then(async () => {
  logger.info('Application is ready');
  
  try {
    // Initialize database first (using simpler method to avoid dbMemoryManager issues)
    logger.info('Initializing database...');
    const configPath = path.join(__dirname, '../../backend/src/config');
    const databasePath = path.join(__dirname, '../../backend/src/services/database');
    
    // Import necessary modules
    const config = require(configPath);
    const { initializeDatabase } = require(databasePath);
    
    // Initialize the database
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Initialize IPC handlers after database is ready
    initializeIPC();
    
    // Create the main window
    createMainWindow();
  } catch (error) {
    logger.error('Error during application initialization:', error);
  }

  // On macOS it's common to re-create a window when the dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS it's common to re-create a window when the dock icon is clicked
app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

// Global error handler
app.on('render-process-gone', (event, webContents, details) => {
  logger.error('Renderer process crashed', { reason: details.reason, exitCode: details.exitCode });
}); 