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
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let metaStr = '';
  if (Object.keys(metadata).length > 0 && metadata.stack) {
    metaStr = `\n${metadata.stack}`;
  } else if (Object.keys(metadata).length > 0) {
    metaStr = `\n${JSON.stringify(metadata, null, 2)}`;
  }
  
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
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
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
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
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  )
});

// Create the logger
const logger = createLogger({
  levels: logLevels.levels,
  level: getLogLevel(),
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console transport with colors
    new transports.Console({
      format: combine(
        colorize({ all: config.logging.colorize }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
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
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
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

// Shorthand methods with contextual information
const createContextLogger = (context) => {
  return {
    error: (message, meta) => logger.error(`[${context}] ${message}`, meta),
    warn: (message, meta) => logger.warn(`[${context}] ${message}`, meta),
    info: (message, meta) => logger.info(`[${context}] ${message}`, meta),
    http: (message, meta) => logger.http(`[${context}] ${message}`, meta),
    debug: (message, meta) => logger.debug(`[${context}] ${message}`, meta),
    trace: (message, meta) => logger.trace(`[${context}] ${message}`, meta)
  };
};

module.exports = {
  logger,
  createContextLogger
}; 