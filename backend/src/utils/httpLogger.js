/**
 * HTTP Request Logger Middleware
 * Provides detailed HTTP request logging for Express applications
 */

const morgan = require('morgan');
const { logger } = require('./logger');

// Custom token for request body
morgan.token('body', (req) => {
  // Don't log sensitive information
  const sensitiveFields = ['password', 'token', 'authorization', 'key'];
  
  if (req.body && Object.keys(req.body).length) {
    const filteredBody = { ...req.body };
    
    // Filter out sensitive information
    for (const field of sensitiveFields) {
      if (filteredBody[field]) {
        filteredBody[field] = '[REDACTED]';
      }
    }
    
    return JSON.stringify(filteredBody);
  }
  
  return '';
});

// Custom token for response time in a more readable format
morgan.token('response-time-formatted', (req, res) => {
  const time = morgan['response-time'](req, res);
  return time ? `${time}ms` : '';
});

// Different format based on environment
const getLogFormat = () => {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    // Shorter format for production to reduce log size
    return ':remote-addr :method :url :status :response-time-formatted';
  }
  
  // Detailed format for development
  return ':remote-addr :method :url :status :response-time-formatted :body';
};

// Export the middleware
const httpLogger = morgan(getLogFormat(), {
  stream: logger.stream
});

module.exports = httpLogger; 