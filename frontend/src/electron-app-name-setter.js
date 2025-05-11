/**
 * Application name setter - must be required at the very beginning of main.js
 * This ensures the app name is set correctly before electron initializes
 */

// This should be first to ensure it's set before any electron modules are loaded
process.env.ELECTRON_APP_NAME = 'Cognivore';

// Additional name setting for all platforms - macOS is most sensitive to when name is set
const appName = 'Cognivore';

// Export the name for consistent usage
module.exports = { appName }; 