/**
 * Logger utility for Knowledge Store Backend
 * Provides unified logging capabilities with multiple transport options,
 * log rotation, and different log levels.
 */

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure logs directory exists
const logsDir = config.paths.logsDir;
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels and corresponding colors
const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    trace: 5
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
    trace: 'gray'
  }
};

// Add colors to winston
require('winston').addColors(logLevels.colors);

// Custom log format
const logFormat = printf(({ level, message, timestamp, context, ...metadata }) => {
  let metaStr = '';
  
  // Handle stack traces for errors
  if (Object.keys(metadata).length > 0 && metadata.stack) {
    metaStr = `\n${metadata.stack}`;
  } 
  // Handle general metadata
  else if (Object.keys(metadata).length > 0) {
    // Remove circular references and format properly
    try {
      metaStr = `\n${JSON.stringify(metadata, null, 2)}`;
    } catch (e) {
      metaStr = `\n[Object with circular reference]`;
    }
  }
  
  // Include context if provided
  const contextStr = context ? `[${context}] ` : '';
  
  return `[${timestamp}] [${level.toUpperCase()}] ${contextStr}${message}${metaStr}`;
});

// Determine log level based on environment or config
const getLogLevel = () => {
  return config.logging.level;
};

// Create file rotation transport
const fileRotateTransport = new transports.DailyRotateFile({
  filename: path.join(logsDir, '%DATE%-backend.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  level: getLogLevel(),
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  )
});

// Create error file rotation transport
const errorFileRotateTransport = new transports.DailyRotateFile({
  filename: path.join(logsDir, '%DATE%-error.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.errorLogsMaxFiles,
  level: 'error',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  )
});

// Create the logger
const logger = createLogger({
  levels: logLevels.levels,
  level: getLogLevel(),
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  ),
  transports: [
    // Console transport with colors
    new transports.Console({
      format: combine(
        colorize({ all: config.logging.colorize }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        logFormat
      )
    }),
    fileRotateTransport,
    errorFileRotateTransport
  ],
  exceptionHandlers: [
    new transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        logFormat
      )
    })
  ],
  exitOnError: false
});

// Stream for Morgan HTTP logger middleware
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

/**
 * Creates a context-specific logger
 * @param {string} context - The context name (service/component)
 * @returns {Object} - A logger with context-specific methods
 */
const createContextLogger = (context) => {
  return {
    error: (message, meta = {}) => logger.error(message, { context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { context, ...meta }),
    http: (message, meta = {}) => logger.http(message, { context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { context, ...meta }),
    trace: (message, meta = {}) => logger.trace(message, { context, ...meta }),
    
    // Add log method for compatibility with common interfaces
    log: (level, message, meta = {}) => {
      if (logger.levels[level] !== undefined) {
        logger.log(level, message, { context, ...meta });
      } else {
        logger.info(message, { context, ...meta });
      }
    }
  };
};

module.exports = {
  logger,
  createContextLogger,
  getLogLevel,
  // Add scope method as alias for createContextLogger for compatibility
  scope: createContextLogger,
  // Export log levels for reference elsewhere in the application
  logLevels
}; 