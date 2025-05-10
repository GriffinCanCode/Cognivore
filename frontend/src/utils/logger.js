/**
 * Logger utility for Knowledge Store Frontend
 * Provides unified logging capabilities using electron-log
 */

const electronLog = require('electron-log');

// Electron's app module might not be available in all contexts (e.g., preload)
let app;
try {
  app = require('electron').app;
} catch (e) {
  // In preload scripts the app module might not be accessible
  app = null;
}

// Configure electron-log
const configureLogger = () => {
  // Set log levels (changing from object to array for compatibility)
  electronLog.levels = [
    'error',
    'warn',
    'info',
    'http',
    'verbose',
    'debug',
    'silly'
  ];

  // Configure transports
  // 1. File transport - disable in preload context
  if (process.type === 'renderer' || !app) {
    // Disable file transport in preload or if app not available
    electronLog.transports.file.level = false;
  } else {
    // Only set up file transport in main process
    electronLog.transports.file.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
    electronLog.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    electronLog.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
    electronLog.transports.file.archiveLogFn = (oldLogPath) => {
      const date = new Date().toISOString().split('T')[0];
      const basePath = typeof oldLogPath === 'string' ? oldLogPath.replace(/\.log$/, '') : 'archived_log';
      const newLogPath = `${basePath}-${date}.log`;
      return newLogPath;
    };
  }

  // 2. Console transport with colors
  electronLog.transports.console.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  electronLog.transports.console.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}';

  return electronLog;
};

// Create logger instance
const logger = configureLogger();

// Add additional methods for consistency with backend
logger.http = logger.info; // electron-log doesn't have http level

// Create context-aware logger
const createContextLogger = (context) => {
  return {
    error: (message, ...args) => logger.error(`[${context}] ${message}`, ...args),
    warn: (message, ...args) => logger.warn(`[${context}] ${message}`, ...args),
    info: (message, ...args) => logger.info(`[${context}] ${message}`, ...args),
    http: (message, ...args) => logger.http(`[${context}] ${message}`, ...args),
    verbose: (message, ...args) => logger.verbose(`[${context}] ${message}`, ...args),
    debug: (message, ...args) => logger.debug(`[${context}] ${message}`, ...args),
    silly: (message, ...args) => logger.silly(`[${context}] ${message}`, ...args)
  };
};

module.exports = {
  logger,
  createContextLogger
}; 