/**
 * Tests for the frontend logger utility
 * Note: These tests are more simplified than the backend tests
 * since electron-log is harder to mock in a test environment
 */

// Mock electron-log
jest.mock('electron-log', () => {
  return {
    transports: {
      file: {
        level: 'info',
        format: jest.fn(),
        resolvePathFn: jest.fn(),
        maxSize: 0,
        archiveLog: jest.fn()
      },
      console: {
        level: 'debug',
        format: jest.fn()
      }
    },
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn()
  };
});

// Mock electron
jest.mock('electron', () => {
  return {
    app: {
      getPath: jest.fn(() => '/mock/path')
    }
  };
});

const electronLog = require('electron-log');
const { logger, createContextLogger } = require('../../src/utils/logger');

describe('Frontend Logger Utility', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('logger should export required methods', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.verbose).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.silly).toBe('function');
    expect(typeof logger.http).toBe('function'); // Added http method for consistency
  });

  test('createContextLogger should return a logger with all methods', () => {
    const testLogger = createContextLogger('TestContext');
    expect(testLogger).toBeDefined();
    expect(typeof testLogger.error).toBe('function');
    expect(typeof testLogger.warn).toBe('function');
    expect(typeof testLogger.info).toBe('function');
    expect(typeof testLogger.http).toBe('function');
    expect(typeof testLogger.verbose).toBe('function');
    expect(typeof testLogger.debug).toBe('function');
    expect(typeof testLogger.silly).toBe('function');
  });

  test('contextLogger should include context in message', () => {
    const contextName = 'TestContext';
    const testContextLogger = createContextLogger(contextName);
    const testMessage = 'Test error message';
    
    testContextLogger.error(testMessage);
    
    // Verify the message is passed with context to electron-log
    expect(electronLog.error).toHaveBeenCalledWith(`[${contextName}] ${testMessage}`);
  });

  test('logger methods should call corresponding electron-log methods', () => {
    const testMessage = 'Test message';
    
    logger.error(testMessage);
    logger.warn(testMessage);
    logger.info(testMessage);
    logger.verbose(testMessage);
    logger.debug(testMessage);
    logger.silly(testMessage);
    logger.http(testMessage); // http should call info internally
    
    expect(electronLog.error).toHaveBeenCalledWith(testMessage);
    expect(electronLog.warn).toHaveBeenCalledWith(testMessage);
    expect(electronLog.info).toHaveBeenCalledWith(testMessage);
    expect(electronLog.verbose).toHaveBeenCalledWith(testMessage);
    expect(electronLog.debug).toHaveBeenCalledWith(testMessage);
    expect(electronLog.silly).toHaveBeenCalledWith(testMessage);
    expect(electronLog.info).toHaveBeenCalledWith(testMessage); // http should call info
  });
}); 