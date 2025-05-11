# Electron Builder Setup Guide

## Current Status

The current build process has been temporarily modified to skip electron-builder due to configuration issues. The build process produces a working development build in the `dist` directory that can be run with `cd dist && electron .`

## Properly Configuring Electron Builder

To properly configure electron-builder for packaging the application, follow these steps:

1. In `package.json`, ensure you have the correct main entry point:

```json
{
  "name": "cognivore",
  "version": "0.1.0",
  "description": "Frontend for Cognivore application",
  "main": "main.js",
  "build": {
    "appId": "com.cognivore.app", 
    "productName": "Cognivore",
    "files": [
      "dist/**/*",
      "src/**/*",
      "main.js",
      "package.json"
    ],
    "mac": {
      "category": "public.app-category.productivity"
    }
  }
}
```

2. Create a minimal `main.js` in the project root that redirects to the actual implementation:

```javascript
// Simple redirect to the actual main file
require('./src/main.js');
```

3. Modify the build script to create a proper electron-builder config file before building:

```javascript
// In scripts/build.js
const electronBuilderConfig = {
  appId: "com.cognivore.app",
  productName: "Cognivore",
  files: [
    "dist/**/*",
    "src/**/*",
    "main.js",
    "package.json"
  ],
  mac: {
    category: "public.app-category.productivity"
  }
};

fs.writeFileSync(
  path.join(projectRoot, 'electron-builder.json'),
  JSON.stringify(electronBuilderConfig, null, 2)
);

runCommand('npx electron-builder build --config=electron-builder.json');
```

## Common Issues

1. **Main.js not found in asar package**: This occurs when electron-builder can't find the entry point. Make sure:
   - The `main` field in package.json points to a file that exists
   - The `files` array in the build config includes the main file
   - You have a simple redirector main.js in the root if your actual main file is in a subdirectory

2. **Directories in root is deprecated**: Use the newer format with directories inside the build object:

```json
"build": {
  "directories": {
    "buildResources": "resources",
    "output": "dist/electron-build"
  }
}
```

3. **ASAR issues**: If you have trouble with asar packaging, you can disable it with `"asar": false` or use `asarUnpack` to specify files that should remain unpacked.

## References

- [Electron Builder Configuration](https://www.electron.build/configuration/configuration)
- [GitHub Issue #2955](https://github.com/electron-userland/electron-builder/issues/2955) 