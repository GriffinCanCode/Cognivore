/**
 * HTTP Request Logger Middleware
 * Provides detailed HTTP request logging for Express applications
 */

const morgan = require('morgan');
const { logger, createContextLogger } = require('./logger');

// Create a context-specific logger for HTTP requests
const httpContextLogger = createContextLogger('HTTP');

// Custom token for request body
morgan.token('body', (req) => {
  // Don't log sensitive information
  const sensitiveFields = ['password', 'token', 'authorization', 'key', 'secret', 'apiKey', 'api_key'];
  
  if (req.body && Object.keys(req.body).length) {
    const filteredBody = { ...req.body };
    
    // Filter out sensitive information
    for (const field of sensitiveFields) {
      if (filteredBody[field]) {
        filteredBody[field] = '[REDACTED]';
      }
    }
    
    // Check nested objects for sensitive fields
    Object.keys(filteredBody).forEach(key => {
      if (typeof filteredBody[key] === 'object' && filteredBody[key] !== null) {
        sensitiveFields.forEach(field => {
          if (filteredBody[key][field]) {
            filteredBody[key][field] = '[REDACTED]';
          }
        });
      }
    });
    
    return JSON.stringify(filteredBody);
  }
  
  return '';
});

// Custom token for response time in a more readable format
morgan.token('response-time-formatted', (req, res) => {
  const time = morgan['response-time'](req, res);
  return time ? `${time}ms` : '';
});

// Custom token for user agent summary
morgan.token('user-agent-summary', (req) => {
  const ua = req.get('user-agent') || '';
  // Extract browser/OS basics to avoid long strings
  const match = ua.match(/(Chrome|Firefox|Safari|Edge|MSIE|Trident)\/[\d\.]+/);
  return match ? match[0] : ua.substring(0, 30);
});

// Different format based on environment
const getLogFormat = () => {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    // Shorter format for production to reduce log size
    return ':remote-addr :method :url :status :response-time-formatted';
  }
  
  // Detailed format for development
  return ':remote-addr :method :url :status :response-time-formatted :user-agent-summary :body';
};

// Log detail level based on status code and response time
const getStatusCodeLevel = (status, responseTime) => {
  // Errors
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  
  // Slow responses
  if (responseTime > 1000) return 'warn'; // Warn if response takes more than 1 second
  
  // Normal logs
  return 'http';
};

// Create a custom morgan stream that logs at appropriate levels
const morganStream = {
  write: (message) => {
    // Extract status code and response time if available
    const statusMatch = message.match(/ ([0-9]{3}) ([0-9]+)ms/);
    
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      const responseTime = parseInt(statusMatch[2]);
      const level = getStatusCodeLevel(status, responseTime);
      
      // Log at appropriate level
      httpContextLogger[level](message.trim());
    } else {
      // Default to http level if we can't determine status
      httpContextLogger.http(message.trim());
    }
  }
};

// Export the middleware
const httpLogger = morgan(getLogFormat(), {
  stream: morganStream
});

module.exports = httpLogger; 