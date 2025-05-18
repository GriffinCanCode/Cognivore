// Import Buffer polyfill properly
import * as BufferModule from 'buffer/';

// Polyfill for global which is needed by some dependencies
if (typeof global === 'undefined') {
  window.global = window;
}

// Also polyfill process.env if needed
if (typeof process === 'undefined' || !process.env) {
  window.process = window.process || {};
  window.process.env = window.process.env || {};
}

// Polyfill for Buffer to ensure it's available in the renderer process
if (typeof Buffer === 'undefined') {
  window.Buffer = BufferModule.Buffer;
}

// Make sure commonjs-compatible utilities are available
if (typeof module === 'undefined') {
  window.module = window.module || {};
  window.module.exports = window.module.exports || {};
}

// Node.js globals needed in browser context
window.__dirname = '/';
window.__filename = '/index.js';

// Avoid require() errors by providing a no-op implementation
if (typeof require === 'undefined') {
  window.require = function(moduleName) {
    console.warn(`Module '${moduleName}' requested via require() which is not available in the browser context`);
    return {}; // Return empty object as a fallback
  };
}

export default {}; 