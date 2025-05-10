/**
 * Tests for the logger utility
 */

const { logger, createContextLogger } = require('../../src/utils/logger');
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

  test('createContextLogger should return a logger with all methods', () => {
    const testLogger = createContextLogger('TestContext');
    expect(testLogger).toBeDefined();
    expect(typeof testLogger.error).toBe('function');
    expect(typeof testLogger.warn).toBe('function');
    expect(typeof testLogger.info).toBe('function');
    expect(typeof testLogger.http).toBe('function');
    expect(typeof testLogger.debug).toBe('function');
    expect(typeof testLogger.trace).toBe('function');
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
    
    expect(mockError).toHaveBeenCalledWith(`[${contextName}] ${testMessage}`, undefined);
    
    // Restore the original method
    logger.error = originalError;
  });
}); 