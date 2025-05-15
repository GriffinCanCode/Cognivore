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

// Create pkg scripts directory
const pkgScriptsDir = path.join(projectRoot, 'scripts', 'pkg');
if (!fs.existsSync(pkgScriptsDir)) {
  fs.mkdirSync(pkgScriptsDir, { recursive: true });
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

// Create macOS entitlements files
if (process.platform === 'darwin') {
  // Mac entitlements for hardened runtime
  const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.inherit</key>
    <true/>
  </dict>
</plist>`;

  const inheritEntitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
  </dict>
</plist>`;

  fs.writeFileSync(
    path.join(resourcesDir, 'entitlements.mac.plist'),
    entitlementsContent
  );

  fs.writeFileSync(
    path.join(resourcesDir, 'entitlements.mac.inherit.plist'),
    inheritEntitlementsContent
  );
}

// Create a PKG postinstall script
if (process.platform === 'darwin') {
  const postinstallScript = `#!/bin/sh
# Ensure the application directory exists
mkdir -p "/Applications"

# Copy the app bundle to Applications folder
cp -R "$PWD/Cognivore.app" "/Applications/"

# Set proper permissions
chmod -R a+rX "/Applications/Cognivore.app"

exit 0
`;

  fs.writeFileSync(
    path.join(pkgScriptsDir, 'postinstall'),
    postinstallScript
  );
  
  // Make the script executable
  fs.chmodSync(path.join(pkgScriptsDir, 'postinstall'), '755');
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
  fs.mkdirSync(path.join(distDir, '@story'), { recursive: true }); // Create story directory
  
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
  
  // Copy webview-preload.js to the dist directory
  try {
    // Define source and destination paths
    const webviewPreloadSourcePath = path.join(projectRoot, 'src', 'webview-preload.js');
    const distWebviewPreloadPath = path.join(distDir, 'webview-preload.js');
    
    // Check if source exists
    if (fs.existsSync(webviewPreloadSourcePath)) {
      // Copy to dist directory
      fs.copyFileSync(webviewPreloadSourcePath, distWebviewPreloadPath);
      console.log(`Copied webview-preload.js to ${distWebviewPreloadPath}`);
    } else {
      console.warn(`Warning: Could not find webview-preload.js at ${webviewPreloadSourcePath}`);
      
      // Create the file if it doesn't exist by copying from the provided content
      console.log('Creating webview-preload.js with default content...');
      const defaultPreloadContent = `/**
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
      
      // Write default content
      fs.writeFileSync(webviewPreloadSourcePath, defaultPreloadContent);
      console.log(`Created webview-preload.js at ${webviewPreloadSourcePath}`);
      
      // Now copy to dist
      fs.copyFileSync(webviewPreloadSourcePath, distWebviewPreloadPath);
      console.log(`Copied newly created webview-preload.js to ${distWebviewPreloadPath}`);
    }
    
    // Also copy to app root directory for better discovery
    const appRootPath = path.join(projectRoot, '..');
    const appRootPreloadPath = path.join(appRootPath, 'webview-preload.js');
    fs.copyFileSync(distWebviewPreloadPath, appRootPreloadPath);
    console.log(`Copied webview-preload.js to app root at ${appRootPreloadPath}`);
    
  } catch (error) {
    console.error('Error handling webview-preload.js:', error.message);
  }
  
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
  <key>LSUIElement</key>
  <false/>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeName</key>
      <string>Cognivore Document</string>
      <key>CFBundleTypeRole</key>
      <string>Editor</string>
      <key>LSHandlerRank</key>
      <string>Owner</string>
    </dict>
  </array>
</dict>
</plist>`;
    
    fs.writeFileSync(
      path.join(resourcesDir, 'Info.plist'),
      infoPlistTemplate
    );
  }
  
  // Copy story files from backend
  console.log('Copying story files...');
  // Try multiple potential story directory locations
  const storyDirPaths = [
    path.join(rootDir, 'backend', '@story'),
    path.join(rootDir, '@story'),
    path.join(projectRoot, '../backend', '@story')
  ];

  // Find the first directory that exists
  let storyDir = null;
  for (const dirPath of storyDirPaths) {
    if (fs.existsSync(dirPath)) {
      storyDir = dirPath;
      console.log(`Found story directory at: ${storyDir}`);
      break;
    }
  }

  if (storyDir) {
    // Create story directory destinations
    const distStoryDir = path.join(distDir, '@story');
    const distBackendStoryDir = path.join(distDir, 'backend', '@story');
    
    fs.mkdirSync(distStoryDir, { recursive: true });
    fs.mkdirSync(distBackendStoryDir, { recursive: true });
    
    // Also create these directories in the project root for electron-builder to find
    // This is to work around the parent directory issue in electron-builder
    const projectStoryDir = path.join(projectRoot, '@story');
    const projectBackendStoryDir = path.join(projectRoot, 'backend', '@story');
    
    fs.mkdirSync(projectStoryDir, { recursive: true });
    fs.mkdirSync(projectBackendStoryDir, { recursive: true });
    
    const storyFiles = fs.readdirSync(storyDir);
    let copiedFiles = 0;
    
    storyFiles.forEach(file => {
      if (file.endsWith('.json')) {
        // Copy to all locations for compatibility
        fs.copyFileSync(
          path.join(storyDir, file),
          path.join(distStoryDir, file)
        );
        
        fs.copyFileSync(
          path.join(storyDir, file),
          path.join(distBackendStoryDir, file)
        );
        
        fs.copyFileSync(
          path.join(storyDir, file),
          path.join(projectStoryDir, file)
        );
        
        fs.copyFileSync(
          path.join(storyDir, file),
          path.join(projectBackendStoryDir, file)
        );
        
        copiedFiles++;
      }
    });
    
    console.log(`Copied ${copiedFiles} story files to multiple locations for compatibility`);
  } else {
    console.warn('Story directory not found in any of the expected locations');
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
    extraResources: [
      { "from": "../backend/@story", "to": "app/@story" },
      { "from": "../backend/@story", "to": "app/backend/@story" }
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
      target: ["dmg", "pkg"],
      entitlements: "resources/entitlements.mac.plist",
      entitlementsInherit: "resources/entitlements.mac.inherit.plist",
      binaries: ["Cognivore.app/Contents/MacOS/Cognivore"],
      extraResources: ["resources/**/*"],
      identity: null // Set to null for development, provide identity for distribution
    },
    dmg: {
      sign: false, // Set to true when using signing identity
      contents: [
        {
          x: 130,
          y: 220
        },
        {
          x: 410,
          y: 220,
          type: "link",
          path: "/Applications"
        }
      ],
      window: {
        width: 540,
        height: 380
      }
    },
    pkg: {
      allowCurrentUserHome: true,
      allowAnywhere: true,
      installLocation: "/Applications",
      scripts: "scripts/pkg" // Optional, only needed if you have custom install scripts
    }
  };
  
  fs.writeFileSync(
    path.join(projectRoot, 'electron-builder.json'),
    JSON.stringify(electronBuilderConfig, null, 2)
  );
  
  // Skip electron-builder for now as it's problematic
  console.log('Build completed successfully!');
  console.log('\nTo run the development build:');
  console.log('  cd dist && electron .');
  console.log('\nTo create installable packages:');
  console.log('  npm run make');
  console.log('  # or');
  console.log('  npx electron-builder build --mac --config=electron-builder.json');
  console.log('\nTo create only DMG:');
  console.log('  npx electron-builder build --mac dmg --config=electron-builder.json');
  console.log('\nTo create only PKG:');
  console.log('  npx electron-builder build --mac pkg --config=electron-builder.json');
  console.log('\nNote: For proper installation to Applications folder, PKG format is recommended.');
}

// Run the build
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
}); 