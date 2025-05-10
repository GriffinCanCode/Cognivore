/**
 * Logger utility for Knowledge Store Frontend
 * Provides unified logging capabilities using electron-log
 */

const electronLog = require('electron-log');
const path = require('path');
const { app } = require('electron');

// Get the logs directory based on Electron's userData path
const getLogsDirectory = () => {
  // app might not be ready in preload scripts
  if (app && app.getPath) {
    return path.join(app.getPath('userData'), 'logs');
  }
  return path.join(process.cwd(), 'logs');
};

// Configure electron-log
const configureLogger = () => {
  // Set log levels
  electronLog.levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
  };

  // Define log file path with date rotation
  const logFilePath = path.join(
    getLogsDirectory(),
    'frontend.log'
  );

  // Configure transports

  // 1. File transport
  electronLog.transports.file.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  electronLog.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  electronLog.transports.file.resolvePathFn = () => logFilePath;
  electronLog.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
  electronLog.transports.file.archiveLog = (oldLogPath) => {
    const date = new Date().toISOString().split('T')[0];
    const newLogPath = `${oldLogPath.replace(/\.log$/, '')}-${date}.log`;
    return newLogPath;
  };

  // 2. Console transport with colors
  electronLog.transports.console.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  electronLog.transports.console.format = (message) => {
    const text = message.data.join(' ');
    const colorized = getColorizedMessage(message.level, text);
    return `[${message.date.toISOString()}] [${message.level}] ${colorized}`;
  };

  return electronLog;
};

// Helper to colorize console output
const getColorizedMessage = (level, text) => {
  const colors = {
    error: '\x1b[31m', // red
    warn: '\x1b[33m',  // yellow
    info: '\x1b[32m',  // green
    http: '\x1b[35m',  // magenta
    verbose: '\x1b[36m', // cyan
    debug: '\x1b[34m', // blue
    silly: '\x1b[90m', // gray
    reset: '\x1b[0m'   // reset
  };

  return `${colors[level]}${text}${colors.reset}`;
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