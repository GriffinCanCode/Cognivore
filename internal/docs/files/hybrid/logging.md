# Knowledge Store Logging System

This document describes the unified logging system used in both the backend and frontend components of the Knowledge Store application.

## Overview

The Knowledge Store logging system provides:

- **Unified API**: Consistent logging interface for both backend and frontend
- **Multiple Log Levels**: Different severity levels (error, warn, info, debug, etc.)
- **Colorized Output**: Color-coded console output for better visibility
- **Log Rotation**: Automatic log file rotation based on size and time
- **Contextual Logging**: Ability to tag logs with context (service/component name)
- **Production-Ready**: Configurable based on environment (development/production)
- **HTTP Request Logging**: Special middleware for HTTP request logging

## Backend Logging

Backend logging is built on [Winston](https://github.com/winstonjs/winston) with the following features:

### Log Levels

From highest to lowest severity:

1. `error`: Critical errors that need immediate attention
2. `warn`: Warning conditions that should be monitored
3. `info`: Informational messages about normal operation
4. `http`: HTTP request/response logs
5. `debug`: Detailed debugging information
6. `trace`: Highly detailed tracing information

### Usage

```javascript
// Direct logger usage
const { logger } = require('./utils/logger');

logger.info('Application started');
logger.error('Failed to connect to database', error);

// Context-specific logger (recommended)
const { createContextLogger } = require('./utils/logger');
const logger = createContextLogger('ServiceName');

logger.info('Processing started');
logger.debug('Processing detail', { item: itemId });
```

### Configuration

Logging configuration is defined in `backend/src/config/index.js` under the `logging` key:

```javascript
logging: {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  maxFiles: process.env.LOG_MAX_FILES || '14d', // Keep logs for 14 days
  maxSize: process.env.LOG_MAX_SIZE || '20m', // 20MB per file
  colorize: true, // Colorize console output
  errorLogsMaxFiles: '30d', // Keep error logs longer
}
```

### Log Files

Backend log files are stored in the `logs` directory with the following naming convention:

- `YYYY-MM-DD-backend.log`: General application logs
- `YYYY-MM-DD-error.log`: Error-level logs only
- `exceptions.log`: Uncaught exceptions

## Frontend Logging

Frontend logging is built on [electron-log](https://github.com/megahertz/electron-log) with similar capabilities to the backend.

### Log Levels

From highest to lowest severity:

1. `error`: Critical errors
2. `warn`: Warning conditions
3. `info`: Informational messages
4. `http`: HTTP request/response logs (maps to info)
5. `verbose`: More detailed information
6. `debug`: Debugging information
7. `silly`: Extremely detailed information

### Usage in Main Process

```javascript
// Direct logger usage
const { logger } = require('./utils/logger');

logger.info('Application started');
logger.error('Failed to process file', error);

// Context-specific logger (recommended)
const { createContextLogger } = require('./utils/logger');
const logger = createContextLogger('MainProcess');

logger.info('Processing started');
```

### Usage in Renderer Process

```javascript
// Access through the preload API
const logger = window.api.logger;
logger.info('Component initialized');

// Context-specific logger
const componentLogger = window.api.logger.createContextLogger('ComponentName');
componentLogger.debug('Component detail', { prop: value });
```

### Log Files

Frontend log files are stored in the Electron app's user data directory under `logs/frontend.log`. 
When the log file reaches 10MB, it is archived with a timestamp.

## HTTP Request Logging

For HTTP API endpoints, the application uses Morgan for request logging:

```javascript
const httpLogger = require('./utils/httpLogger');

// Use in Express app
app.use(httpLogger);
```

The HTTP logger automatically redacts sensitive information such as passwords and tokens.

## Best Practices

1. **Use contextual loggers**: Always create a context-specific logger for each module/component
2. **Choose appropriate log levels**:
   - `error`: Only for exceptional conditions that require immediate attention
   - `warn`: For concerning but non-critical issues
   - `info`: For normal operational information
   - `debug`: For development-time debugging
   - `trace/verbose/silly`: For very detailed diagnostics

3. **Include relevant metadata**: When logging objects or errors, include them as a second parameter
4. **Be concise but descriptive**: Log messages should be clear and informative
5. **Don't log sensitive data**: Never log passwords, tokens, or personal information

## Testing

The logging system includes comprehensive test coverage in:
- `backend/test/utils/logger.test.js`
- `frontend/test/utils/logger.test.js` 