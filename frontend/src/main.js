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
        // Application menu
        label: 'Cognivore',
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
    
    // Ensure environment variable is set for later use
    process.env.APP_USER_DATA_PATH = app.getPath('userData');
    
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
    
    // Ensure environment variable is set for consistent data paths
    process.env.APP_USER_DATA_PATH = app.getPath('userData');
    
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
            ? "default-src 'self' file:; script-src 'self' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://*.googleapis.com https://generativelanguage.googleapis.com"
            : "default-src 'self' file:; script-src 'self' file: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://*.googleapis.com https://generativelanguage.googleapis.com"
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
    let indexPath;

    // Try multiple possible locations for the index.html file
    const possiblePaths = [
      path.join(__dirname, '../dist/index.html'),
      path.join(app.getAppPath(), 'dist/index.html'),
      path.join(app.getPath('userData'), 'index.html'),
      path.join(path.dirname(app.getAppPath()), 'app/dist/index.html'),
      path.join(app.getPath('exe'), '../Resources/app/dist/index.html'),
      path.join(app.getPath('exe'), '../Resources/app.asar/dist/index.html')
    ];

    // For macOS, add additional paths specific to the .app bundle structure
    if (process.platform === 'darwin') {
      possiblePaths.push(
        path.join(app.getPath('exe'), '../../Resources/app/dist/index.html'),
        path.join(app.getPath('exe'), '../../Resources/app.asar/dist/index.html'),
        path.join(app.getPath('exe'), '../../Resources/app/dist/index.html'),
        path.join(app.getPath('exe'), '../../Resources/app.asar.unpacked/dist/index.html')
      );
    }

    // Log all the paths we're checking
    console.log('Checking these paths for index.html:');
    possiblePaths.forEach((p, i) => console.log(`Path ${i + 1}: ${p}`));

    // Try each path until we find one that exists
    for (const candidate of possiblePaths) {
      try {
        if (fs.existsSync(candidate)) {
          indexPath = candidate;
          console.log(`Found index.html at: ${indexPath}`);
          break;
        }
      } catch (err) {
        console.log(`Error checking path ${candidate}: ${err.message}`);
      }
    }

    // If still not found, try to find it in the extraResources location
    if (!indexPath) {
      try {
        const resourcesPath = process.resourcesPath;
        const extraResourcesPath = path.join(resourcesPath, 'app_dist/index.html');
        console.log(`Trying extraResources path: ${extraResourcesPath}`);
        
        if (fs.existsSync(extraResourcesPath)) {
          indexPath = extraResourcesPath;
          console.log(`Found index.html in extraResources: ${indexPath}`);
        } else {
          console.log(`extraResources path does not exist: ${extraResourcesPath}`);
          // Last resort - use a default path
          indexPath = path.join(app.getAppPath(), 'dist/index.html');
          console.log(`Using default path: ${indexPath}`);
        }
      } catch (err) {
        console.error(`Error checking extraResources: ${err.message}`);
        indexPath = path.join(app.getAppPath(), 'dist/index.html');
      }
    }
    
    console.log('Loading index from:', indexPath);
    
    // First try to load the file directly
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Error loading index.html via loadFile:', err);
      
      // Then try using the file:// protocol
      const fileUrl = `file://${indexPath}`;
      console.log('Trying fallback file URL:', fileUrl);
      
      mainWindow.loadURL(fileUrl).catch(urlErr => {
        console.error('Error with fallback file URL:', urlErr);
        
        // If both fail, try loading from app/dist in the resources directory
        const resourcesUrl = `file://${path.join(process.resourcesPath, 'app_dist/index.html')}`;
        console.log('Trying resources URL:', resourcesUrl);
        
        mainWindow.loadURL(resourcesUrl).catch(resourcesErr => {
          console.error('Error with resources URL:', resourcesErr);
          
          // Last resort: show an error page
          mainWindow.loadURL(`data:text/html,<html><body>
            <h2>Error Loading Application</h2>
            <p>The application could not load its main page.</p>
            <p>Error: ${resourcesErr.message}</p>
            <p>Last tried path: ${resourcesUrl}</p>
            <pre>Please contact support.</pre>
          </body></html>`);
        });
      });
    });
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

  // Add IPC handlers for Anthology story chapters
  ipcMain.handle('get-story-chapters', async () => {
    try {
      // Try multiple possible paths for the @story directory
      const possiblePaths = [
        path.join(app.getAppPath(), 'backend', '@story'),
        path.join(__dirname, '..', '..', 'backend', '@story'),
        path.join(process.cwd(), 'backend', '@story'),
        path.resolve(path.join('backend', '@story'))
      ];
      
      let storyPath = null;
      let files = [];
      
      // Try each path until we find one that works
      for (const testPath of possiblePaths) {
        try {
          console.log('Trying path:', testPath);
          await fs.promises.access(testPath);
          storyPath = testPath;
          files = await fs.promises.readdir(testPath);
          console.log('Successfully found and accessed story directory at:', storyPath);
          break;
        } catch (e) {
          console.log('Path not accessible:', testPath);
          // Continue to the next path
        }
      }
      
      if (!storyPath) {
        console.error('Could not find a valid path to the @story directory');
        return [];
      }
      
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      // Parse titles from filenames
      const chapters = jsonFiles.map(fileName => {
        return {
          id: fileName.split('.')[0],
          fileName: fileName,
          // Example: '01_The_Primordial_Realm' -> 'Chapter 1: The Primordial Realm'
          title: `Chapter ${parseInt(fileName.substring(0,2))}: ${fileName.replace('.json', '').replace(/_/g, ' ').substring(3)}`
        };
      });
      console.log(`Found ${chapters.length} story chapters`);
      return chapters;
    } catch (error) {
      console.error('Failed to get story chapters:', error);
      return []; // Return empty array on error
    }
  });

  // IPC handler for getting specific story chapter content
  ipcMain.handle('get-story-chapter-content', async (event, fileName) => {
    try {
      if (!fileName || typeof fileName !== 'string' || !fileName.endsWith('.json')) {
          throw new Error('Invalid or missing fileName parameter.');
      }
      
      // Try multiple possible paths for the @story directory
      const possiblePaths = [
        path.join(app.getAppPath(), 'backend', '@story'),
        path.join(__dirname, '..', '..', 'backend', '@story'),
        path.join(process.cwd(), 'backend', '@story'),
        path.resolve(path.join('backend', '@story'))
      ];
      
      let filePath = null;
      
      // Try each path until we find one that works
      for (const basePath of possiblePaths) {
        const testPath = path.join(basePath, fileName);
        try {
          console.log('Trying path for chapter content:', testPath);
          await fs.promises.access(testPath);
          filePath = testPath;
          console.log('Successfully found chapter file at:', filePath);
          break;
        } catch (e) {
          console.log('Chapter file not accessible at:', testPath);
          // Continue to the next path
        }
      }
      
      if (!filePath) {
        console.error(`Could not find a valid path to the chapter file: ${fileName}`);
        return null;
      }
      
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to get story chapter content for ${fileName}:`, error);
      return null; // Return null or error object on error
    }
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
    // Set the user data path for consistent storage locations
    process.env.APP_USER_DATA_PATH = app.getPath('userData');
    logger.info(`Using user data path: ${process.env.APP_USER_DATA_PATH}`);
    
    // Step 1: Set up essential IPC handlers in main process first
    // These are the primary handlers that the UI depends on
    setupEssentialIpcHandlers();
    
    try {
      // Step 2: Initialize database
      logger.info('Initializing database...');
      let configPath, databasePath, config, initializeDatabase;
      
      try {
        configPath = path.join(__dirname, '../../backend/src/config');
        config = require(configPath);
      } catch (err) {
        logger.error(`Failed to load config from ${configPath}:`, err);
        // Create a minimal config object for fallback
        config = {
          database: { path: path.join(app.getPath('userData'), 'data', 'vector_db') }
        };
      }
      
      try {
        databasePath = path.join(__dirname, '../../backend/src/services/database');
        const dbModule = require(databasePath);
        initializeDatabase = dbModule.initializeDatabase;
      } catch (err) {
        logger.error(`Failed to load database module from ${databasePath}:`, err);
        // Create a dummy initialization function
        initializeDatabase = async () => {
          logger.info('Using dummy database initialization');
          return true;
        };
      }
      
      // Initialize the database with error handling
      try {
        await initializeDatabase();
        logger.info('Database initialized successfully');
      } catch (dbErr) {
        logger.error('Database initialization failed:', dbErr);
        // Continue anyway since we don't want this to prevent the UI from loading
      }
    } catch (setupErr) {
      logger.error('Error during database setup:', setupErr);
      // Continue despite database errors
    }
    
    // Step 3: Initialize the backend server with HTTP endpoints
    // The server.js will add fallback IPC handlers only if the channels aren't already registered
    try {
      backendServer = await initializeBackendServer();
    } catch (serverErr) {
      logger.error('Backend server initialization failed:', serverErr);
      // Continue anyway to show UI
    }
    
    // Step 4: Initialize domain-specific IPC handlers from ipcHandlers.js
    // These handle operations like PDF processing, listing items, etc.
    try {
      initializeIPC();
    } catch (ipcErr) {
      logger.error('IPC initialization failed:', ipcErr);
      // Continue anyway to show UI
    }
    
    // Step 5: Create the main window after all backend initialization is complete
    // This should only happen inside the whenReady promise
    createMainWindow();
  } catch (error) {
    logger.error('Error during application initialization:', error);
    // Even if initialization fails, try to create the window to show error to user
    try {
      createMainWindow();
    } catch (windowErr) {
      logger.error('Failed to create window after initialization error:', windowErr);
    }
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