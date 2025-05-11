// IMPORTANT: Load name setter before anything else
require('./electron-app-name-setter');

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const net = require('net');

// Check if we're in development mode
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// Check if we're running from an asar package
const isAsar = __dirname.includes('app.asar');

// Set application name - ensure this happens early
app.name = 'Cognivore';
app.setName('Cognivore');
app.setAppUserModelId('com.cognivore.app');

// For macOS, add this code to fix the dock name and protocol handler
if (process.platform === 'darwin') {
  // Tell macOS we are Cognivore for all protocol handlers
  app.setAsDefaultProtocolClient('cognivore');
  
  // Fix dock and menu bar appearance
  app.whenReady().then(() => {
    // We need to set the dock name explicitly
    if (app.dock) {
      // Set dock name
      app.dock.setMenu(Menu.buildFromTemplate([
        { label: 'Cognivore' }
      ]));
      
      // Set dock icon from icon file
      const iconPath = path.join(__dirname, '../../app-icon.png');
      if (fs.existsSync(iconPath)) {
        app.dock.setIcon(iconPath);
      }
    }
    
    // Create a completely new application menu
    const template = [
      // First empty item fixes the menu bar name issue on macOS
      { label: '' },
      {
        // Use HTML formatting to make the Cognivore label bold
        label: '<b>Cognivore</b>',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      { role: 'fileMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
      { role: 'help' }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  });
  
  // Set about panel info
  app.setAboutPanelOptions({
    applicationName: 'Cognivore',
    applicationVersion: app.getVersion(),
    copyright: '© 2025 Cognivore',
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Keep a global reference of the mainWindow object to prevent garbage collection
let mainWindow = null;
let backendServer = null;

// Check if a port is in use (quickly determine if backend is already running)
const isPortInUse = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is in use
      } else {
        resolve(false);
      }
      server.close();
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });
    
    // Set a timeout to avoid hanging
    setTimeout(() => {
      try {
        server.close();
        resolve(false);
      } catch (err) {
        resolve(false);
      }
    }, 1000);
    
    try {
      server.listen(port);
    } catch (err) {
      resolve(false);
    }
  });
};

// Initialize backend IPC handlers from ipcHandlers.js
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
      logger.info('IPC handlers initialized successfully from ipcHandlers.js');
    } else {
      logger.error('initializeIpcHandlers function not found in backend module');
    }
  } catch (error) {
    logger.error('Error initializing IPC handlers:', error);
  }
}

// Initialize backend server
async function initializeBackendServer() {
  try {
    // Check if backend is already running on port 3001
    const backendPort = process.env.PORT || 3001;
    const isBackendRunning = await isPortInUse(backendPort);
    
    if (isBackendRunning) {
      logger.info(`Backend server appears to be already running on port ${backendPort}, skipping server initialization`);
      return true;
    }
    
    // Load backend server
    const serverPath = path.join(__dirname, '../../backend/server.js');
    
    if (fs.existsSync(serverPath)) {
      logger.info(`Loading backend server from: ${serverPath}`);
      try {
        const serverModule = require(serverPath);
        logger.info('Backend server initialized (with safe fallback IPC handlers)');
        return true;
      } catch (err) {
        logger.error('Failed to initialize backend server:', err);
        return false;
      }
    } else {
      logger.error(`Backend server not found at ${serverPath}`);
      return false;
    }
  } catch (error) {
    logger.error('Error initializing backend server:', error);
    return false;
  }
}

// Create the browser window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Cognivore',
    icon: path.join(__dirname, '../../app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true, // Always enable web security for better protection
      // Allow Node.js modules in preload script
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: false // Required for some Node.js modules in preload script
    }
  });

  // Ensure title remains as "Cognivore" even after page loads
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle('Cognivore');
  });
  
  // Also set title on ready-to-show for extra reliability
  mainWindow.once('ready-to-show', () => {
    mainWindow.setTitle('Cognivore');
  });
  
  // Force window title again after 2 seconds
  setTimeout(() => {
    if (mainWindow) {
      mainWindow.setTitle('Cognivore');
    }
  }, 2000);

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev 
            ? "default-src 'self'; script-src 'self' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://*.googleapis.com https://generativelanguage.googleapis.com"
            : "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://*.googleapis.com https://generativelanguage.googleapis.com"
        ]
      }
    });
  });

  // Load the app entry point
  if (isDev) {
    // In development mode, load from dist directory where webpack outputs
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    
    // Open DevTools in development mode
    mainWindow.webContents.openDevTools();
  } else {
    // In production, determine the correct path based on whether we're in an asar package
    const indexPath = isAsar ? path.join(path.dirname(path.dirname(__dirname)), 'dist', 'index.html') 
                            : path.join(__dirname, '../dist/index.html');
    
    console.log('Loading index from:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  logger.info('Main window created successfully');
}

// Directly implement essential IPC handlers to ensure they are always available
// These act as the primary handlers that the UI will interact with
function setupEssentialIpcHandlers() {
  // Health check - primary handler
  ipcMain.handle('check-health', async () => {
    logger.info('IPC: Health check request received');
    return { status: 'ok', version: '1.0.0' };
  });

  // Get config - primary handler
  ipcMain.handle('get-config', async () => {
    logger.info('IPC: Get config request received');
    return {
      llmModel: process.env.LLM_MODEL || 'gemini-2.5-flash',
      embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-005',
      serverVersion: '1.0.0'
    };
  });

  logger.info('Essential IPC handlers set up directly in main process');
}

// When Electron has finished initialization and is ready
app.whenReady().then(async () => {
  // Set dock icon for macOS
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, '../../app-icon.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
    
    // Explicitly set the dock name via the menu - setName doesn't exist
    app.dock.setMenu(Menu.buildFromTemplate([
      { label: 'Cognivore' }
    ]));
    console.log('Set dock menu to display Cognivore');
  }
  
  logger.info('Application is ready');
  
  try {
    // Step 1: Set up essential IPC handlers in main process first
    // These are the primary handlers that the UI depends on
    setupEssentialIpcHandlers();
    
    // Step 2: Initialize database
    logger.info('Initializing database...');
    const configPath = path.join(__dirname, '../../backend/src/config');
    const databasePath = path.join(__dirname, '../../backend/src/services/database');
    
    // Import necessary modules
    const config = require(configPath);
    const { initializeDatabase } = require(databasePath);
    
    // Initialize the database
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Step 3: Initialize the backend server with HTTP endpoints
    // The server.js will add fallback IPC handlers only if the channels aren't already registered
    backendServer = await initializeBackendServer();
    
    // Step 4: Initialize domain-specific IPC handlers from ipcHandlers.js
    // These handle operations like PDF processing, listing items, etc.
    initializeIPC();
    
    // Step 5: Create the main window after all backend initialization is complete
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