/**
 * This script directly copies our custom Info.plist to the Electron.app Contents folder
 * This is a more direct approach that doesn't rely on environment variables
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Source Info.plist
const sourcePlist = path.join(__dirname, '..', 'mac-info.plist');

if (!fs.existsSync(sourcePlist)) {
  console.error(`Error: Source Info.plist not found at ${sourcePlist}`);
  process.exit(1);
}

// Find Electron.app
const electronDir = path.dirname(require.resolve('electron'));
let infoPlistPath;

if (process.platform === 'darwin') {
  console.log('Applying custom Info.plist to Electron.app...');
  
  // Try to find Electron.app within the electron package
  let electronAppPath;
  try {
    // First, check if Electron.app exists directly in the resolved directory
    const directAppPath = path.join(electronDir, 'dist', 'Electron.app');
    if (fs.existsSync(directAppPath)) {
      electronAppPath = directAppPath;
    } else {
      // Scan the electron directory for Electron.app
      const findCommand = `find "${electronDir}" -name "Electron.app" -type d`;
      const foundPaths = execSync(findCommand).toString().trim().split('\n');
      if (foundPaths.length > 0 && foundPaths[0]) {
        electronAppPath = foundPaths[0];
      }
    }
    
    if (!electronAppPath) {
      throw new Error('Could not find Electron.app');
    }
    
    console.log(`Found Electron.app at: ${electronAppPath}`);
    infoPlistPath = path.join(electronAppPath, 'Contents', 'Info.plist');
    
    if (!fs.existsSync(infoPlistPath)) {
      throw new Error(`Info.plist not found at ${infoPlistPath}`);
    }
    
    // Backup the original file
    const backupPath = `${infoPlistPath}.original`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(infoPlistPath, backupPath);
      console.log(`Created backup at ${backupPath}`);
    }
    
    // Copy our custom Info.plist directly
    fs.copyFileSync(sourcePlist, infoPlistPath);
    console.log(`Successfully copied custom Info.plist to ${infoPlistPath}`);
    
    // Additional step: Try to set name in Electron binary
    // This is helpful for very stubborn cases
    try {
      const electronBinary = path.join(electronAppPath, 'Contents', 'MacOS', 'Electron');
      if (fs.existsSync(electronBinary)) {
        // Use macOS binary resource editor to set the app name
        const setNameCmd = `defaults write ${electronAppPath}/Contents/Info CFBundleName "Cognivore"`;
        execSync(setNameCmd);
        console.log('Set CFBundleName via defaults command');
        
        const setDisplayNameCmd = `defaults write ${electronAppPath}/Contents/Info CFBundleDisplayName "Cognivore"`;
        execSync(setDisplayNameCmd);
        console.log('Set CFBundleDisplayName via defaults command');
      }
    } catch (err) {
      console.warn('Could not set name in binary:', err.message);
    }
    
    console.log('Info.plist has been applied. Please restart Electron for changes to take effect.');
    
  } catch (error) {
    console.error('Error applying Info.plist:', error.message);
  }
} else {
  console.log('This script is only needed on macOS. Skipping...');
} 