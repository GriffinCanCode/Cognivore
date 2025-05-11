/**
 * This script patches the Electron.app Info.plist file to fix the app name in macOS menu bar.
 * This is used for development mode, as the production build will have the correct name through electron-builder.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// First, find the Electron app location in node_modules
const electronPath = require('electron');
const electronDir = path.dirname(require.resolve('electron'));
let infoPlistPath;

if (process.platform === 'darwin') {
  console.log('Fixing macOS menu bar app name...');
  
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
    const backupPath = `${infoPlistPath}.backup`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(infoPlistPath, backupPath);
      console.log(`Created backup at ${backupPath}`);
    }
    
    // Read the Info.plist file
    let plistContent = fs.readFileSync(infoPlistPath, 'utf8');
    
    // Replace CFBundleName with Cognivore
    const bundleNamePattern = /<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/;
    const newBundleName = '<key>CFBundleName</key>\n\t<string>Cognivore</string>';
    
    if (bundleNamePattern.test(plistContent)) {
      plistContent = plistContent.replace(bundleNamePattern, newBundleName);
      fs.writeFileSync(infoPlistPath, plistContent);
      console.log('Successfully updated CFBundleName to "Cognivore" in Info.plist');
    } else {
      console.error('Could not find CFBundleName in Info.plist');
    }
    
    // Also replace CFBundleDisplayName if it exists
    const displayNamePattern = /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/;
    const newDisplayName = '<key>CFBundleDisplayName</key>\n\t<string>Cognivore</string>';
    
    if (displayNamePattern.test(plistContent)) {
      plistContent = plistContent.replace(displayNamePattern, newDisplayName);
      fs.writeFileSync(infoPlistPath, plistContent);
      console.log('Successfully updated CFBundleDisplayName to "Cognivore" in Info.plist');
    }
    
    console.log('macOS menu bar app name has been fixed. Please restart Electron for changes to take effect.');
    
  } catch (error) {
    console.error('Error fixing macOS menu bar name:', error.message);
    console.error('Please try running the app with: ELECTRON_APP_NAME=Cognivore npm run dev');
  }
} else {
  console.log('This script is only needed on macOS. Skipping...');
} 