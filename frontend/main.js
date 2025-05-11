// Set app name in environment before requiring any electron modules
process.env.ELECTRON_APP_NAME = 'Cognivore';

// Simple redirect to the actual main file
require('./src/main.js'); 