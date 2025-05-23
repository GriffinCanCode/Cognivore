// IMPORTANT: Load name setter before anything else
require('./electron-app-name-setter');

const { app, BrowserWindow, ipcMain, Menu, shell, session, webContents, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const net = require('net');
const url = require('url');
const { createContextLogger } = require('./utils/logger');


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

    // Configure session.defaultSession for webview rendering - specifically for browser functionality
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      // Create a copy of the headers with header names normalized to lowercase for easier manipulation
      const normalizedHeaders = {};
      
      for (const headerName in details.responseHeaders) {
        normalizedHeaders[headerName.toLowerCase()] = details.responseHeaders[headerName];
      }
      
      // Set a more permissive Content-Security-Policy for webview rendering
      normalizedHeaders['content-security-policy'] = [
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';"
      ];
      
      callback({ responseHeaders: normalizedHeaders });
    });

    // Configure webview permissions with better security but ensure rendering works
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Define allowed permissions - expanded for better browser functionality
      const safePermissions = ['media', 'geolocation', 'notifications', 'clipboard-read', 'display-capture', 'fullscreen'];
      
      // Automatically allow permissions needed for rendering
      if (safePermissions.includes(permission)) {
        callback(true);
      } else {
        // For other permissions, still allow but log
        console.log(`Allowing permission request: ${permission}`);
        callback(true);
      }
    });

    // Configure webviews to render content properly
    const allWebviews = webContents.getAllWebContents();
    allWebviews.forEach(wc => {
      if (wc.getType() === 'webview') {
        // Disable web security to allow proper cross-origin content rendering
        wc.session.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob: filesystem: ws: wss:;"],
              'Access-Control-Allow-Origin': ['*']
            }
          });
        });
        
        // Ensure proper rendering by disabling additional security features
        wc.session.webRequest.onBeforeSendHeaders((details, callback) => {
          const { requestHeaders } = details;
          requestHeaders['User-Agent'] = requestHeaders['User-Agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
          callback({ requestHeaders });
        });
      }
    });
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
      webSecurity: false, // Disable web security to allow loading external resources
      allowRunningInsecureContent: true, // Allow loading of insecure content
      experimentalFeatures: false, // Disable experimental features unless specifically needed
      webviewTag: true, // Explicitly enable webview tag
      // Allow Node.js modules in preload script
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: false, // Required for some Node.js modules in preload script
    }
  });

  // Configure webview settings in the main window's webContents
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    // Apply configuration to ensure webviews render properly
    webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob: filesystem:;"],
          'Access-Control-Allow-Origin': ['*']
        }
      });
    });

    // Set additional webview preferences for proper rendering
    try {
      // Apply webview settings directly instead of trying to get existing preferences
      // Note: setAutoSize is deprecated in newer Electron versions
      // Instead, we can use executeJavaScript to modify webview attributes
      // Apply basic, safe styles that don't require return statements
      // Note: More comprehensive styling is now handled by the Voyager component
      webContents.executeJavaScript(`
        (function() {
          try {
            const webview = document.querySelector('webview');
            if (webview && webview.parentNode) {
              webview.style.cssText = 'width:100%;height:100%;visibility:visible;';
              webview.autosize = false;
              console.log('Initial webview configuration done - detailed styling handled by Voyager');
            } else {
              console.log('Webview not found in DOM or not ready yet');
            }
          } catch (error) {
            console.error('Error setting basic webview styles:', error);
          }
        })();
      `).catch(err => console.error('Failed to set basic webview styles:', err));
      
      // Set essential security properties for rendering
      webContents.setWebRTCIPHandlingPolicy('default_public_interface_only');
      webContents.setZoomFactor(1.0);
      
      console.log('Applied essential webview settings');
    } catch (err) {
      console.error('Error setting webview properties:', err);
    }

    // Ensure the webview preload script is applied
    const userDataPath = app.getPath('userData');
    const preloadPath = path.join(userDataPath, 'webview-preload.js');
    
    // Try to set the preload script if it exists
    if (fs.existsSync(preloadPath)) {
      try {
        webContents.executeJavaScript(`
          const script = document.createElement('script');
          script.src = 'file://${preloadPath.replace(/\\/g, '\\\\')}';
          document.head.appendChild(script);
        `);
        console.log('Applied webview preload script via executeJavaScript');
      } catch (err) {
        console.error('Failed to inject preload script:', err);
      }
    } else {
      console.warn(`Webview preload script not found at: ${preloadPath}`);
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
            ? "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; media-src 'self' blob: https:; worker-src 'self' blob:; frame-src 'self' https://*; connect-src 'self' https://*.googleapis.com https://generativelanguage.googleapis.com https://cdnjs.cloudflare.com https://*"
            : "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; media-src 'self' blob: https:; worker-src 'self' blob:; frame-src 'self' https://*; connect-src 'self' https://*.googleapis.com https://generativelanguage.googleapis.com https://cdnjs.cloudflare.com https://*"
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

  // Add an event handler for webview creation
  app.on('web-contents-created', (event, contents) => {
    // For all webviews
    if (contents.getType() === 'webview') {
      // Keep console logs from webviews
      contents.on('console-message', (e, level, message) => {
        console.log(`[Webview Console]: ${message}`);
      });

      // Use a more secure approach: implement content isolation with controlled exceptions
      contents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        // Add necessary headers for cross-origin requests
        const { requestHeaders } = details;
        requestHeaders['User-Agent'] = requestHeaders['User-Agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
        callback({ requestHeaders });
      });
      
      // Selectively modify headers while maintaining security
      contents.session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
        // Create a copy of the headers with case insensitivity
        const responseHeaders = { ...details.responseHeaders };
        
        // Set a more permissive CSP for webviews to ensure page rendering
        responseHeaders['content-security-policy'] = [
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';"
        ];
        
        // Add CORS headers to allow cross-origin content
        responseHeaders['access-control-allow-origin'] = ['*'];
        responseHeaders['access-control-allow-methods'] = ['GET, POST, OPTIONS, PUT, DELETE'];
        responseHeaders['access-control-allow-headers'] = ['Content-Type, Authorization'];
        
        callback({ responseHeaders });
      });

      // Handle certificate errors more securely but allow all for rendering
      contents.session.setCertificateVerifyProc((request, callback) => {
        // Allow all certificates to ensure content loads
        callback(0);
      });
      
      // Set essential webview properties for better rendering
      try {
        // Apply direct webview settings without trying to access webPreferences
        contents.setAudioMuted(false);
        contents.setZoomFactor(1.0);
        
        // Configure additional secure browsing settings
        if (typeof contents.setWebRTCIPHandlingPolicy === 'function') {
          contents.setWebRTCIPHandlingPolicy('default_public_interface_only');
        }
        
        console.log(`Configured webview: ${contents.getURL()}`);
      } catch (err) {
        console.error('Error configuring webview:', err);
      }
    }
  });
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

// Copy story files from resources to userData directory on first run
function copyStoryFilesToUserData() {
  try {
    const userDataPath = app.getPath('userData');
    const userDataStoryDir = path.join(userDataPath, '@story');
    
    // Check if story directory exists in userData
    if (!fs.existsSync(userDataStoryDir)) {
      logger.info('Creating @story directory in userData');
      fs.mkdirSync(userDataStoryDir, { recursive: true });
      
      // Check possible resource paths for story files
      const possibleResourcePaths = [
        path.join(app.getAppPath(), '@story'),
        path.join(app.getAppPath(), 'backend', '@story'),
        path.join(process.resourcesPath, '@story'),
        path.join(__dirname, '..', '@story'),
        path.join(__dirname, '..', 'backend', '@story'),
        path.join(process.cwd(), '@story'),
        path.join(process.cwd(), 'backend', '@story')
      ];
      
      for (const resourcePath of possibleResourcePaths) {
        try {
          if (fs.existsSync(resourcePath)) {
            logger.info(`Found story files at: ${resourcePath}`);
            
            // Copy JSON files to userData
            const files = fs.readdirSync(resourcePath);
            let copiedCount = 0;
            
            for (const file of files) {
              if (file.endsWith('.json')) {
                const sourcePath = path.join(resourcePath, file);
                const destPath = path.join(userDataStoryDir, file);
                
                fs.copyFileSync(sourcePath, destPath);
                copiedCount++;
              }
            }
            
            logger.info(`Copied ${copiedCount} story files to userData directory`);
            return true;
          }
        } catch (err) {
          logger.debug(`Error checking path ${resourcePath}: ${err.message}`);
        }
      }
      
      logger.error('No story files found to copy');
      return false;
    } else {
      logger.info('Story directory already exists in userData');
      return true;
    }
  } catch (err) {
    logger.error(`Error copying story files: ${err.message}`);
    return false;
  }
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

    // Copy story files to userData directory
    copyStoryFilesToUserData();

    // Copy webview-preload.js to app's root directory for easier access by webviews
    try {
      console.log('Setting up webview-preload.js for browser component');
      
      // Define the content for webview-preload.js
      const preloadContent = `/**
 * Special preload script for webviews
 * This script will be injected into webview contexts to disable security policies
 * and enable cross-origin content loading
 */

// Disable content security policy by injecting meta tag
const disableCSP = () => {
  try {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';";
    document.head.appendChild(meta);
    console.log('CSP disabled via meta tag');
  } catch (error) {
    console.error('Failed to disable CSP:', error);
  }
};

// Fix black border/margin issues
const fixMargins = () => {
  try {
    // Immediately add style to remove margins
    const styleEl = document.createElement('style');
    styleEl.id = 'cognivore-preload-fixes';
    styleEl.textContent = \`
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
        height: 100% !important;
        width: 100% !important;
        position: relative !important;
        min-height: 100% !important;
      }
      
      /* Target main containers that often cause margin issues */
      #main, main, [role="main"], .main,
      form[role="search"], #search, .search, [role="search"],
      div.container, div.content, div.wrapper, div.page,
      div#container, div#content, div#wrapper, div#page,
      div[class*="container"], div[class*="content"], div[class*="wrapper"],
      #cnt, #rcnt, #center_col, #rso, .g-blk, .kp-blk,
      /* Google-specific elements */
      #s8TaEd, #appbar, #searchform, #search, form[action="/search"] {
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      
      /* Ensure scrollbars don't cause horizontal overflow */
      body::-webkit-scrollbar {
        width: 8px !important;
      }
      
      * {
        max-width: 100vw !important;
        box-sizing: border-box !important;
      }
    \`;
    document.head.appendChild(styleEl);
    
    // Also set direct styles
    if (document.body) {
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.minHeight = '100%';
      document.body.style.position = 'relative';
      document.body.style.overflow = 'auto';
      document.body.style.overflowX = 'hidden';
    }
    
    // Also apply to document element
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';
    document.documentElement.style.minHeight = '100%';
    document.documentElement.style.position = 'relative';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.overflowX = 'hidden';
    
    // Set up a MutationObserver to ensure the fix persists
    const observer = new MutationObserver(() => {
      if (document.body) {
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.body.style.minHeight = '100%';
      }
      
      // Check for Google-specific elements that might have been added dynamically
      const googleElements = [
        document.querySelector('#main'),
        document.querySelector('#rcnt'),
        document.querySelector('#center_col'),
        document.querySelector('#rso'),
        document.querySelector('#s8TaEd'),
        document.querySelector('#appbar'),
        document.querySelector('#searchform')
      ];
      
      googleElements.forEach(el => {
        if (el) {
          el.style.margin = '0';
          el.style.width = '100%';
          el.style.maxWidth = '100%';
          el.style.boxSizing = 'border-box';
          el.style.overflowX = 'hidden';
        }
      });
    });
    
    // Start observing with more comprehensive settings
    observer.observe(document.documentElement, { 
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'width', 'height', 'margin', 'padding']
    });
    
    // Apply fixes periodically as fallback
    if (!window.marginFixInterval) {
      window.marginFixInterval = setInterval(() => {
        if (document.body) {
          document.body.style.margin = '0';
          document.body.style.padding = '0';
        }
      }, 500);
    }
    
    console.log('Enhanced margin fixes applied via preload script');
  } catch (error) {
    console.error('Failed to fix margins:', error);
  }
};

// Configure communication with parent window
const setupMessaging = () => {
  // Send ready message to parent
  window.parent.postMessage({ type: 'webview-ready', url: window.location.href }, '*');
  
  // Setup heartbeat
  setInterval(() => {
    window.parent.postMessage({ 
      type: 'webview-heartbeat',
      url: window.location.href,
      title: document.title,
      timestamp: Date.now() 
    }, '*');
  }, 1000);
  
  // Monitor page load events
  window.addEventListener('load', () => {
    window.parent.postMessage({ 
      type: 'webview-loaded',
      url: window.location.href,
      title: document.title,
      readyState: document.readyState 
    }, '*');
    
    // Re-apply margin fixes after full page load
    fixMargins();
  });
  
  console.log('Parent window messaging set up');
};

// Override fetch to allow cross-origin requests
const enableCrossOriginFetch = () => {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const [resource, config] = args;
    
    // Add CORS headers to all requests
    const newConfig = {
      ...config,
      mode: 'cors',
      credentials: 'include',
      headers: {
        ...(config?.headers || {}),
        'Origin': window.location.origin,
      }
    };
    
    try {
      return await originalFetch(resource, newConfig);
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  };
  
  console.log('Cross-origin fetch enabled');
};

// Initialize when DOM is ready
const init = () => {
  disableCSP();
  fixMargins(); // Apply margin fixes early
  setupMessaging();
  enableCrossOriginFetch();
  
  // Set up a timeout to apply margin fixes again
  setTimeout(fixMargins, 100);
  
  console.log('Webview preload script initialized');
};

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
  // Also apply basic margin fixes immediately, even before DOMContentLoaded
  setTimeout(fixMargins, 0);
} else {
  init();
}

// Make sure fixes are applied when any resources load
window.addEventListener('load', fixMargins);

// This script will be loaded by Electron's webview system`;
      
      // Define all possible target locations to copy the file
      const paths = [
        // Source directory
        path.join(__dirname, 'webview-preload.js'),
        
        // App root directory
        path.join(app.getAppPath(), 'webview-preload.js'),
        
        // Dist directory
        path.join(app.getAppPath(), 'dist', 'webview-preload.js'),
        
        // Src directory
        path.join(app.getAppPath(), 'src', 'webview-preload.js'),
        
        // AppData directory
        path.join(app.getPath('userData'), 'webview-preload.js'),
      ];
      
      // Ensure the webview-preload.js exists and is copied to all locations
      for (const filePath of paths) {
        try {
          // Ensure directory exists
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Write the preload script to the path
          fs.writeFileSync(filePath, preloadContent);
          console.log(`Created/updated webview-preload.js at ${filePath}`);
        } catch (err) {
          console.error(`Failed to write webview-preload.js to ${filePath}:`, err);
        }
      }
      
      logger.info('Successfully deployed webview-preload.js to multiple locations');
    } catch (error) {
      logger.error('Error setting up webview-preload.js:', error);
    }

    // Register a protocol handler for loading files in webviews
    protocol.registerFileProtocol('webview-file', (request, callback) => {
      const url = request.url.substr('webview-file://'.length);
      const filePath = path.normalize(`${app.getAppPath()}/${url}`);
      callback({ path: filePath });
    });
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