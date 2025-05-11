/**
 * Simplified logger for the Knowledge Store frontend
 * Provides logging capabilities with context support
 * Compatible with browser environments without Node.js dependencies
 */

// Simple browser-compatible logger
const browserLogger = {
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => console.info(...args),
  verbose: (...args) => console.debug(...args),
  debug: (...args) => console.debug(...args),
  silly: (...args) => console.debug(...args),
  http: (...args) => console.info(...args),
  
  // Create a context-specific logger
  scope: (context) => ({
    error: (message, ...args) => console.error(`[${context}] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[${context}] ${message}`, ...args),
    info: (message, ...args) => console.info(`[${context}] ${message}`, ...args),
    http: (message, ...args) => console.info(`[${context}] ${message}`, ...args),
    verbose: (message, ...args) => console.debug(`[${context}] ${message}`, ...args),
    debug: (message, ...args) => console.debug(`[${context}] ${message}`, ...args),
    silly: (message, ...args) => console.debug(`[${context}] ${message}`, ...args)
  }),
  
  // Add transports stub for compatibility
  transports: {
    file: { level: false },
    console: { level: 'debug' }
  }
};

// Export the browser logger
module.exports = browserLogger; 