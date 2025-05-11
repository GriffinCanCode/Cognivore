const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Define paths
const projectRoot = path.resolve(__dirname, '..');
const rootDir = path.resolve(projectRoot, '..');
const distDir = path.join(projectRoot, 'dist');
const publicDir = path.join(projectRoot, 'public');
const resourcesDir = path.join(projectRoot, 'resources');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Ensure resources directory exists for electron-builder
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
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
  
  // Copy app icon and logo
  fs.copyFileSync(
    path.join(rootDir, 'app-icon.png'),
    path.join(distDir, 'app-icon.png')
  );
  
  fs.copyFileSync(
    path.join(rootDir, 'logo-png.png'),
    path.join(distDir, 'logo-png.png')
  );
  
  fs.copyFileSync(
    path.join(rootDir, 'logo-transparent.png'),
    path.join(distDir, 'logo-transparent.png')
  );
  
  // Copy icon to resources folder for electron-builder
  fs.copyFileSync(
    path.join(rootDir, 'app-icon.png'),
    path.join(resourcesDir, 'icon.png')
  );
  
  // Also place app-icon.png in the root of dist for development ease
  fs.copyFileSync(
    path.join(rootDir, 'app-icon.png'),
    path.join(projectRoot, 'app-icon.png')
  );
  
  // Copy the main.js file to the dist directory
  fs.copyFileSync(
    path.join(projectRoot, 'main.js'),
    path.join(distDir, 'main.js')
  );
  
  // Create a simpler package.json for the dist directory
  const packageJson = require('../package.json');
  
  const distPackageJson = { 
    name: packageJson.name,
    productName: "Cognivore",
    version: packageJson.version,
    description: packageJson.description,
    main: 'main.js',
    author: packageJson.author,
    license: packageJson.license,
    dependencies: packageJson.dependencies
  };
  
  fs.writeFileSync(
    path.join(distDir, 'package.json'),
    JSON.stringify(distPackageJson, null, 2)
  );
  
  // Create a development mode Info.plist
  // This helps correct the app name in the menu bar during development
  if (process.platform === 'darwin') {
    const devInfoPlistPath = path.join(projectRoot, 'Info.plist');
    const infoPlistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Cognivore</string>
  <key>CFBundleExecutable</key>
  <string>Electron</string>
  <key>CFBundleIconFile</key>
  <string>electron.icns</string>
  <key>CFBundleIdentifier</key>
  <string>com.cognivore.app</string>
  <key>CFBundleName</key>
  <string>Cognivore</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
</dict>
</plist>`;
    
    fs.writeFileSync(devInfoPlistPath, infoPlistContent);
    console.log('Created development Info.plist for macOS menu bar name fixing');
    
    // Set environment variable for Electron to use this Info.plist
    process.env.ELECTRON_BUNDLE_INFO_PLIST = devInfoPlistPath;
  }
  
  // For macOS, create a template Info.plist file for electron-builder
  if (process.platform === 'darwin') {
    const infoPlistTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Cognivore</string>
  <key>CFBundleExecutable</key>
  <string>Cognivore</string>
  <key>CFBundleIconFile</key>
  <string>icon.icns</string>
  <key>CFBundleIdentifier</key>
  <string>com.cognivore.app</string>
  <key>CFBundleName</key>
  <string>Cognivore</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.productivity</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>`;
    
    fs.writeFileSync(
      path.join(resourcesDir, 'Info.plist'),
      infoPlistTemplate
    );
  }
  
  // Create electron-builder.json config file
  const electronBuilderConfig = {
    appId: "com.cognivore.app",
    productName: "Cognivore",
    files: [
      "dist/**/*",
      "src/**/*",
      "node_modules/**/*",
      "package.json",
      "main.js"
    ],
    directories: {
      buildResources: "resources",
      output: "dist/electron-build"
    },
    mac: {
      category: "public.app-category.productivity",
      icon: "resources/icon.png",
      hardenedRuntime: true,
      gatekeeperAssess: false,
      darkModeSupport: true,
      target: ["dir"],
      extraFiles: ["resources/Info.plist"]
    }
  };
  
  fs.writeFileSync(
    path.join(projectRoot, 'electron-builder.json'),
    JSON.stringify(electronBuilderConfig, null, 2)
  );
  
  // Skip electron-builder for now as it's problematic
  console.log('Build completed successfully! Skipping electron-builder.');
  console.log('The app can be run using: cd dist && electron .');
  console.log('To build with electron-builder, run: npx electron-builder build --config=electron-builder.json');
}

// Run the build
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
}); 