/**
 * Prepare distribution assets script
 * This script prepares all required files for electron-builder packaging
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define paths
const frontendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(frontendDir, '..');
const backendDir = path.join(rootDir, 'backend');
const distDir = path.join(frontendDir, 'dist');
const resourcesDir = path.join(frontendDir, 'resources');

// Ensure all required directories exist
function ensureDirectories() {
  const dirs = [
    distDir,
    resourcesDir,
    path.join(frontendDir, 'dist', 'assets'),
    path.join(frontendDir, 'dist', 'backend'),
    path.join(frontendDir, 'dist', 'backend', '@story')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Copy backend files to dist
function copyBackendFiles() {
  // Define backend directories to copy
  const backendDirs = [
    'src',
    '@story',
    'config'
  ];

  // Copy specific files
  const backendFiles = [
    'server.js',
    'package.json'
  ];

  console.log('Copying backend files...');
  
  backendDirs.forEach(dir => {
    const sourceDir = path.join(backendDir, dir);
    const targetDir = path.join(distDir, 'backend', dir);
    
    if (fs.existsSync(sourceDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      
      // Function to recursively copy directory contents
      function copyDir(src, dest) {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        
        entries.forEach(entry => {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          
          // Skip node_modules and .git directories
          if (entry.name === 'node_modules' || entry.name === '.git') {
            return;
          }
          
          if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        });
      }
      
      copyDir(sourceDir, targetDir);
      console.log(`Copied ${dir} directory to dist/backend`);
    } else {
      console.warn(`Backend directory ${dir} not found at ${sourceDir}`);
    }
  });
  
  backendFiles.forEach(file => {
    const sourcePath = path.join(backendDir, file);
    const targetPath = path.join(distDir, 'backend', file);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copied ${file} to dist/backend`);
    } else {
      console.warn(`Backend file ${file} not found at ${sourcePath}`);
    }
  });
}

// Copy story files specifically to multiple locations for compatibility
function copyStoryFiles() {
  const storySourceDir = path.join(backendDir, '@story');
  
  if (!fs.existsSync(storySourceDir)) {
    console.warn(`Story directory not found at ${storySourceDir}`);
    return;
  }
  
  // Define target story directories
  const storyTargetDirs = [
    path.join(distDir, '@story'),
    path.join(distDir, 'backend', '@story'),
    path.join(frontendDir, '@story'),
    path.join(frontendDir, 'backend', '@story')
  ];
  
  // Ensure all target directories exist
  storyTargetDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Copy all JSON files to each target directory
  const storyFiles = fs.readdirSync(storySourceDir).filter(file => file.endsWith('.json'));
  let copiedCount = 0;
  
  storyFiles.forEach(file => {
    const sourcePath = path.join(storySourceDir, file);
    
    storyTargetDirs.forEach(targetDir => {
      const targetPath = path.join(targetDir, file);
      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
    });
  });
  
  console.log(`Copied ${storyFiles.length} story files to ${storyTargetDirs.length} locations (total: ${copiedCount} file operations)`);
}

// Copy asset files
function copyAssetFiles() {
  // Define asset files to copy
  const assetFiles = [
    { source: path.join(rootDir, 'app-icon.png'), target: path.join(distDir, 'app-icon.png') },
    { source: path.join(rootDir, 'logo-transparent.png'), target: path.join(distDir, 'logo-transparent.png') },
    { source: path.join(rootDir, 'logo-png.png'), target: path.join(distDir, 'logo-png.png') }
  ];
  
  console.log('Copying asset files...');
  
  assetFiles.forEach(({ source, target }) => {
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, target);
      console.log(`Copied ${path.basename(source)} to dist/`);
    } else {
      console.warn(`Asset file not found: ${source}`);
    }
  });
  
  // Also copy to resources directory for electron-builder
  if (!fs.existsSync(path.join(resourcesDir, 'icon.png')) && fs.existsSync(path.join(rootDir, 'app-icon.png'))) {
    fs.copyFileSync(path.join(rootDir, 'app-icon.png'), path.join(resourcesDir, 'icon.png'));
    console.log('Copied app-icon.png to resources/icon.png');
  }
}

// Main execution function
async function prepareDistribution() {
  console.log('Preparing files for distribution...');
  
  // Step 1: Ensure directories exist
  ensureDirectories();
  
  // Step 2: Copy backend files
  copyBackendFiles();
  
  // Step 3: Copy story files to multiple locations
  copyStoryFiles();
  
  // Step 4: Copy asset files
  copyAssetFiles();
  
  console.log('Distribution preparation complete!');
}

// Run the script
prepareDistribution().catch(error => {
  console.error('Error preparing distribution:', error);
  process.exit(1);
}); 