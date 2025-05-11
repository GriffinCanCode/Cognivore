/**
 * This script fixes the macOS dock name by modifying the Electron executable
 * This is a more aggressive approach that modifies the actual binary
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find Electron.app
const electronDir = path.dirname(require.resolve('electron'));
console.log('Electron dir:', electronDir);

if (process.platform === 'darwin') {
  console.log('Fixing macOS dock name...');
  
  // Try to find Electron.app within the electron package
  let electronAppPath;
  try {
    // First check common locations
    const possiblePaths = [
      path.join(electronDir, 'dist', 'Electron.app'),
      path.join(electronDir, 'Electron.app'),
      path.join(electronDir, '..', 'Electron.app')
    ];
    
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        electronAppPath = testPath;
        break;
      }
    }
    
    // If not found in common places, search for it
    if (!electronAppPath) {
      try {
        // Use find command to locate Electron.app
        const findCmd = `find "${electronDir}" -name "Electron.app" -type d -depth 2`;
        const result = execSync(findCmd).toString().trim();
        if (result) {
          electronAppPath = result.split('\n')[0];
        }
      } catch (err) {
        console.warn('Find command failed:', err.message);
      }
    }
    
    if (!electronAppPath) {
      console.error('Could not find Electron.app');
      process.exit(1);
    }
    
    console.log(`Found Electron.app at: ${electronAppPath}`);
    
    // Modify Info.plist
    const infoPlistPath = path.join(electronAppPath, 'Contents', 'Info.plist');
    console.log(`Info.plist path: ${infoPlistPath}`);
    
    if (fs.existsSync(infoPlistPath)) {
      // Use defaults command to directly modify the plist
      try {
        console.log('Modifying Info.plist...');
        const commands = [
          `defaults write "${infoPlistPath}" CFBundleName "Cognivore"`,
          `defaults write "${infoPlistPath}" CFBundleDisplayName "Cognivore"`,
          `defaults write "${infoPlistPath}" CFBundleIdentifier "com.cognivore.app"`
        ];
        
        commands.forEach(cmd => {
          console.log(`Running: ${cmd}`);
          execSync(cmd);
        });
        
        // Additional plist fixes for dock name
        try {
          // Delete LSUIElement if it exists (could prevent dock icon)
          execSync(`defaults delete "${infoPlistPath}" LSUIElement 2>/dev/null || true`);
          console.log('Removed LSUIElement if it existed');
          
          // Make sure dock-related keys are properly set
          execSync(`defaults write "${infoPlistPath}" NSHighResolutionCapable -bool true`);
          console.log('Set NSHighResolutionCapable to true');
        } catch (err) {
          console.warn('Error setting additional plist values:', err.message);
        }
        
        console.log('Info.plist modified successfully');
      } catch (err) {
        console.error('Error modifying Info.plist:', err.message);
      }
    } else {
      console.error(`Info.plist not found at ${infoPlistPath}`);
    }
    
    // Try renaming the actual Electron binary
    try {
      const macOSDir = path.join(electronAppPath, 'Contents', 'MacOS');
      const electronBinary = path.join(macOSDir, 'Electron');
      const cognitoreBinary = path.join(macOSDir, 'Cognivore');
      
      if (fs.existsSync(electronBinary)) {
        console.log('Creating a copy of the Electron binary as Cognivore...');
        
        // Create a copy rather than renaming to avoid breaking anything
        fs.copyFileSync(electronBinary, cognitoreBinary);
        console.log(`Created Cognivore binary at: ${cognitoreBinary}`);
        
        // Update the executable name in Info.plist
        try {
          execSync(`defaults write "${infoPlistPath}" CFBundleExecutable "Cognivore"`);
          console.log('Updated CFBundleExecutable in Info.plist');
          
          // Create a symbolic link from Electron to Cognivore
          try {
            // Creating symlink for additional compatibility
            execSync(`cd "${macOSDir}" && ln -sf Cognivore Electron 2>/dev/null || true`);
            console.log('Created symbolic link from Electron to Cognivore');
          } catch (err) {
            console.warn('Error creating symlink:', err.message);
          }
        } catch (err) {
          console.error('Error updating CFBundleExecutable:', err.message);
        }
      } else {
        console.error(`Electron binary not found at ${electronBinary}`);
      }
    } catch (err) {
      console.error('Error handling binary:', err.message);
    }
    
    // Touch the app to make macOS recognize changes
    try {
      execSync(`touch "${electronAppPath}"`);
      console.log('Touched app bundle to refresh macOS cache');
    } catch (err) {
      console.warn('Error touching app bundle:', err.message);
    }
    
    // Fix dock label using a different approach - modifying app dock settings
    try {
      // This creates a defaults entry that can help with dock name
      const userDefaults = path.join(process.env.HOME, 'Library/Preferences/com.apple.dock.plist');
      console.log('Setting dock label in user preferences...');
      
      // Try to set a persistent app name in dock
      execSync(`defaults write com.cognivore.app CFBundleName "Cognivore"`);
      execSync(`defaults write com.cognivore.app CFBundleDisplayName "Cognivore"`);
      
      console.log('Updated default preferences for app');
    } catch (err) {
      console.warn('Error setting dock label in user preferences:', err.message);
    }
    
    console.log('Dock name fix completed. Please restart Electron for changes to take effect.');
    
  } catch (error) {
    console.error('Error fixing dock name:', error.message);
  }
} else {
  console.log('This script is only needed on macOS. Skipping...');
} 