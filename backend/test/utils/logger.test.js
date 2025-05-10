/**
 * Tests for the logger utility
 */

const { logger, createContextLogger, logLevels, getLogLevel } = require('../../src/utils/logger');
const path = require('path');
const fs = require('fs');
const config = require('../../src/config');

describe('Logger Utility', () => {
  test('logger should export required methods', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.http).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.trace).toBe('function');
  });

  test('logger should export utility functions and constants', () => {
    expect(createContextLogger).toBeDefined();
    expect(logLevels).toBeDefined();
    expect(getLogLevel).toBeDefined();
    expect(logLevels.levels).toHaveProperty('error');
    expect(logLevels.levels).toHaveProperty('warn');
    expect(logLevels.levels).toHaveProperty('info');
    expect(logLevels.levels).toHaveProperty('http');
    expect(logLevels.levels).toHaveProperty('debug');
    expect(logLevels.levels).toHaveProperty('trace');
  });

  test('createContextLogger should return a logger with all methods', () => {
    const testLogger = createContextLogger('TestContext');
    expect(testLogger).toBeDefined();
    expect(typeof testLogger.error).toBe('function');
    expect(typeof testLogger.warn).toBe('function');
    expect(typeof testLogger.info).toBe('function');
    expect(typeof testLogger.http).toBe('function');
    expect(typeof testLogger.debug).toBe('function');
    expect(typeof testLogger.trace).toBe('function');
    expect(typeof testLogger.log).toBe('function'); // New log method
  });

  test('logger should write to file', () => {
    // Create a temporary test log file
    const testLogDir = path.join(config.paths.logsDir, 'test');
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true });
    }
    
    const testLogFile = path.join(testLogDir, 'test.log');
    
    // Clear any existing log file
    if (fs.existsSync(testLogFile)) {
      fs.unlinkSync(testLogFile);
    }
    
    // Create a test transport
    const { createLogger, format, transports } = require('winston');
    const testLogger = createLogger({
      format: format.simple(),
      transports: [
        new transports.File({
          filename: testLogFile
        })
      ]
    });
    
    // Write a test message
    const testMessage = 'Test message ' + Date.now();
    testLogger.info(testMessage);
    
    // Check if the message was written to the file
    setTimeout(() => {
      expect(fs.existsSync(testLogFile)).toBe(true);
      const logContent = fs.readFileSync(testLogFile, 'utf8');
      expect(logContent).toContain(testMessage);
      
      // Clean up
      if (fs.existsSync(testLogFile)) {
        fs.unlinkSync(testLogFile);
      }
    }, 100);
  });

  test('contextLogger should include context in message', () => {
    // Mock the logger methods to verify context is included
    const originalError = logger.error;
    const mockError = jest.fn();
    
    logger.error = mockError;
    
    const contextName = 'TestContext';
    const testContextLogger = createContextLogger(contextName);
    const testMessage = 'Test error message';
    
    testContextLogger.error(testMessage);
    
    // Check that the error was called with context in the metadata
    expect(mockError).toHaveBeenCalled();
    const callArgs = mockError.mock.calls[0];
    expect(callArgs[0]).toBe(testMessage);
    expect(callArgs[1]).toHaveProperty('context', contextName);
    
    // Restore the original method
    logger.error = originalError;
  });

  test('contextLogger should handle metadata properly', () => {
    // Mock the logger methods
    const originalInfo = logger.info;
    const mockInfo = jest.fn();
    
    logger.info = mockInfo;
    
    const contextName = 'TestContext';
    const testContextLogger = createContextLogger(contextName);
    const testMessage = 'Test info message';
    const testMetadata = { userId: 123, action: 'test' };
    
    testContextLogger.info(testMessage, testMetadata);
    
    // Check that context is merged with metadata
    expect(mockInfo).toHaveBeenCalled();
    const callArgs = mockInfo.mock.calls[0];
    expect(callArgs[0]).toBe(testMessage);
    expect(callArgs[1]).toHaveProperty('context', contextName);
    expect(callArgs[1]).toHaveProperty('userId', testMetadata.userId);
    expect(callArgs[1]).toHaveProperty('action', testMetadata.action);
    
    // Restore the original method
    logger.info = originalInfo;
  });

  test('contextLogger.log method should work correctly', () => {
    // Mock the logger methods
    const originalLog = logger.log;
    const mockLog = jest.fn();
    
    logger.log = mockLog;
    logger.levels = logLevels.levels;
    
    const contextName = 'TestContext';
    const testContextLogger = createContextLogger(contextName);
    const testMessage = 'Test dynamic level message';
    
    // Test with valid level
    testContextLogger.log('info', testMessage);
    
    expect(mockLog).toHaveBeenCalled();
    let callArgs = mockLog.mock.calls[0];
    expect(callArgs[0]).toBe('info');
    expect(callArgs[1]).toBe(testMessage);
    expect(callArgs[2]).toHaveProperty('context', contextName);
    
    // Restore the original method
    logger.log = originalLog;
  });
}); 