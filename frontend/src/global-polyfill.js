// Polyfill for global which is needed by some dependencies
if (typeof global === 'undefined') {
  window.global = window;
}

// Also polyfill process.env if needed
if (typeof process === 'undefined' || !process.env) {
  window.process = window.process || {};
  window.process.env = window.process.env || {};
}

export default {}; 