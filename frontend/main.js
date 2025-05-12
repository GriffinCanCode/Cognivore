// Set app name in environment before requiring any electron modules
process.env.ELECTRON_APP_NAME = 'Cognivore';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'), // Adjusted path to preload
      nodeIntegration: false, // Best practice
      contextIsolation: true, // Best practice
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html')); // Adjusted path to index.html

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the case
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// IPC handler for getting story chapters
ipcMain.handle('get-story-chapters', async () => {
  try {
    const storyPath = path.join(app.getAppPath(), 'backend', '@story');
    const files = await fs.promises.readdir(storyPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    // We can parse titles here or let the renderer do it if more detail from file needed for title
    const chapters = jsonFiles.map(fileName => {
      // Basic title from filename, renderer can refine this
      return {
        id: fileName.split('.')[0],
        fileName: fileName,
        // Example: '01_The_Primordial_Realm' -> 'Chapter 1: The Primordial Realm'
        title: `Chapter ${parseInt(fileName.substring(0,2))}: ${fileName.replace('.json', '').replace(/_/g, ' ').substring(3)}`
      };
    });
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
    const filePath = path.join(app.getAppPath(), 'backend', '@story', fileName);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to get story chapter content for ${fileName}:`, error);
    return null; // Return null or error object on error
  }
}); 