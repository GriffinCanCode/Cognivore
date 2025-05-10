/**
 * Jest Setup File
 * 
 * This file is used to set up the test environment before running tests.
 * It mocks common dependencies that tests rely on.
 */

// Mock Electron module for tests that use IPC
// This allows tests to run in a Node.js environment without actual Electron
const electronMock = {
  ipcMain: {
    handle: jest.fn()
  }
};
jest.mock('electron', () => electronMock, { virtual: true });

// Mock the config module to prevent dependency issues in tests
jest.mock('../src/config', () => {
  return {
    paths: {
      logsDir: '/tmp/test-logs',
      modelCache: '/tmp/test-models',
      tempDir: '/tmp/test-temp',
    },
    logging: {
      level: 'debug',
      maxFiles: '3d',
      maxSize: '10m',
      colorize: false,
      errorLogsMaxFiles: '5d',
    },
    database: {
      path: '/tmp/test-db',
      name: 'test_knowledge_store',
      collection: 'test_knowledge_items',
    },
    processing: {
      chunkSize: 100,
      chunkOverlap: 20,
    },
    embeddings: {
      modelName: 'test-model',
      dimensions: 384,
    }
  };
});

// Create required directories for tests
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

// Ensure test directories exist
[
  config.paths.logsDir,
  config.paths.modelCache,
  config.paths.tempDir,
].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Clean up function to run after tests complete
afterAll(() => {
  // Optional: Clean up test directories if needed
  // Comment out if you want to inspect logs after tests
  /*
  [
    config.paths.logsDir,
    config.paths.modelCache,
    config.paths.tempDir,
  ].forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  */
}); 