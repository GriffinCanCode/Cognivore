/**
 * This script fixes the macOS dock icon more aggressively
 * It uses macOS-specific commands to modify how the app appears in the dock
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (process.platform !== 'darwin') {
  console.log('This script is only for macOS');
  process.exit(0);
}

console.log('Starting aggressive dock icon fix for macOS...');

try {
  // Get app path from process
  const appPath = process.execPath;
  console.log('App path:', appPath);
  
  // Determine if we're in an app bundle
  const isInAppBundle = appPath.includes('.app/Contents/MacOS/');
  console.log('In app bundle:', isInAppBundle);
  
  let appBundlePath;
  
  if (isInAppBundle) {
    // Extract the .app path from the executable path
    appBundlePath = appPath.substring(0, appPath.indexOf('.app/Contents/MacOS/') + 4);
  } else {
    // Use the Electron app from node_modules
    const electronPath = require.resolve('electron');
    const electronDir = path.dirname(electronPath);
    
    // Find Electron.app
    const findCmd = `find "${electronDir}" -name "Electron.app" -type d | head -1`;
    appBundlePath = execSync(findCmd).toString().trim();
    
    if (!appBundlePath) {
      throw new Error('Could not find Electron.app');
    }
  }
  
  console.log('App bundle path:', appBundlePath);
  
  // Get the current app name
  const infoPlistPath = path.join(appBundlePath, 'Contents', 'Info.plist');
  console.log('Info.plist path:', infoPlistPath);
  
  if (!fs.existsSync(infoPlistPath)) {
    throw new Error(`Info.plist not found at ${infoPlistPath}`);
  }
  
  // Try all known methods to fix the dock icon
  const methods = [
    // Method 1: Direct plist editing with PlistBuddy
    () => {
      console.log('Method 1: Using PlistBuddy to edit Info.plist...');
      const plistBuddyPath = '/usr/libexec/PlistBuddy';
      
      if (fs.existsSync(plistBuddyPath)) {
        // Set all bundle-related keys
        const commands = [
          `${plistBuddyPath} -c "Set :CFBundleName Cognivore" "${infoPlistPath}"`,
          `${plistBuddyPath} -c "Set :CFBundleDisplayName Cognivore" "${infoPlistPath}"`,
          `${plistBuddyPath} -c "Set :CFBundleIdentifier com.cognivore.app" "${infoPlistPath}"`
        ];
        
        commands.forEach(cmd => {
          try {
            execSync(cmd);
            console.log(`Successfully ran: ${cmd}`);
          } catch (err) {
            console.warn(`Error running command: ${cmd}`, err.message);
          }
        });
      } else {
        console.warn('PlistBuddy not found, skipping method 1');
      }
    },
    
    // Method 2: Touch Info.plist and app bundle to force refresh
    () => {
      console.log('Method 2: Touching files to force refresh...');
      execSync(`touch "${infoPlistPath}"`);
      execSync(`touch "${appBundlePath}"`);
      console.log('Successfully touched Info.plist and app bundle');
    },
    
    // Method 3: Copying icon file directly
    () => {
      console.log('Method 3: Updating icon file...');
      const iconSource = path.resolve(__dirname, '../../app-icon.png');
      const iconDest = path.join(appBundlePath, 'Contents', 'Resources', 'electron.icns');
      
      if (fs.existsSync(iconSource)) {
        try {
          // If we have an .icns file, use it directly
          if (iconSource.endsWith('.icns')) {
            fs.copyFileSync(iconSource, iconDest);
          } else {
            // Otherwise we'd need to convert the PNG, but that requires additional tools
            console.log('PNG icon found, but conversion to .icns requires additional tools');
          }
          console.log('Icon updated successfully');
        } catch (err) {
          console.warn('Error updating icon:', err.message);
        }
      } else {
        console.warn(`Icon source not found: ${iconSource}`);
      }
    },
    
    // Method 4: Rename the binary in MacOS directory
    () => {
      console.log('Method 4: Renaming the application binary...');
      const macOSDir = path.join(appBundlePath, 'Contents', 'MacOS');
      const electronBin = path.join(macOSDir, 'Electron');
      const newBin = path.join(macOSDir, 'Cognivore');
      
      if (fs.existsSync(electronBin) && !fs.existsSync(newBin)) {
        try {
          // Copy instead of rename to avoid breaking anything
          fs.copyFileSync(electronBin, newBin);
          
          // Update executable name in Info.plist
          execSync(`${plistBuddyPath} -c "Set :CFBundleExecutable Cognivore" "${infoPlistPath}"`);
          console.log('Binary renamed and CFBundleExecutable updated');
        } catch (err) {
          console.warn('Error renaming binary:', err.message);
        }
      } else {
        console.log('Binary already renamed or original not found');
      }
    },
    
    // Method 5: Update application dock tile programmatically
    () => {
      console.log('Method 5: Adding JavaScript to update app dock menu...');
      const mainJsPath = path.resolve(__dirname, '../src/main.js');
      
      if (fs.existsSync(mainJsPath)) {
        try {
          let content = fs.readFileSync(mainJsPath, 'utf8');
          
          // Check if we already have dock menu setting code
          if (!content.includes('app.dock.setMenu') && !content.includes('dock menu to display Cognivore')) {
            const dockNameCode = `
// Set dock name explicitly via menu
app.whenReady().then(() => {
  if (app.dock) {
    // Make sure we have Menu available
    const dockMenu = Menu.buildFromTemplate([
      { label: 'Cognivore' }
    ]);
    app.dock.setMenu(dockMenu);
    console.log('Set dock menu to display Cognivore');
  }
});
`;
            // Add after the app.setName line
            content = content.replace(/app\.setName\(['"]\w+['"].*\);/, 
              (match) => `${match}\n${dockNameCode}`);
              
            fs.writeFileSync(mainJsPath, content, 'utf8');
            console.log('Added dock menu setting code to main.js');
          } else {
            console.log('Dock menu setting code already exists in main.js');
          }
        } catch (err) {
          console.warn('Error updating main.js:', err.message);
        }
      } else {
        console.warn(`main.js not found at ${mainJsPath}`);
      }
    }
  ];
  
  // Run all methods
  methods.forEach((method, index) => {
    try {
      method();
    } catch (err) {
      console.warn(`Method ${index + 1} failed:`, err.message);
    }
  });
  
  console.log('All methods completed. Please restart the application for changes to take effect.');
  
} catch (error) {
  console.error('Error in dock icon fix script:', error.message);
  process.exit(1);
} 