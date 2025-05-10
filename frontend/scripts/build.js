const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Define paths
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const publicDir = path.join(projectRoot, 'public');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Function to run shell commands with error handling
function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: projectRoot });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error);
    process.exit(1);
  }
}

// Main build process
async function build() {
  console.log('Starting build process...');
  
  // Run webpack build
  runCommand('npx webpack --mode production');
  
  // Copy main Electron files to dist (not processed by webpack)
  console.log('Copying Electron files...');
  
  // Make sure the required directories exist in dist
  fs.mkdirSync(path.join(distDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'src', 'utils'), { recursive: true });
  
  // Copy the main.js and preload.js files
  fs.copyFileSync(
    path.join(projectRoot, 'src', 'main.js'),
    path.join(distDir, 'src', 'main.js')
  );
  
  fs.copyFileSync(
    path.join(projectRoot, 'src', 'preload.js'),
    path.join(distDir, 'src', 'preload.js')
  );
  
  // Copy the logger utility
  fs.copyFileSync(
    path.join(projectRoot, 'src', 'utils', 'logger.js'),
    path.join(distDir, 'src', 'utils', 'logger.js')
  );
  
  // Update package.json in dist to point to the correct main file
  const packageJson = require('../package.json');
  const distPackageJson = { ...packageJson, main: 'src/main.js' };
  
  fs.writeFileSync(
    path.join(distDir, 'package.json'),
    JSON.stringify(distPackageJson, null, 2)
  );
  
  console.log('Build completed successfully!');
}

// Run the build
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
}); 