/**
 * Jest configuration for Knowledge Store backend tests
 */

module.exports = {
  // The test environment that will be used for testing
  testEnvironment: 'node',
  
  // The paths to modules that run some code to configure the testing framework
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  
  // Memory optimizations
  maxWorkers: 1,
  maxConcurrency: 1,
  
  // Increase test timeout to handle larger test files
  testTimeout: 10000,
  
  // Disable coverage collection to save memory
  collectCoverage: false,
  
  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.js?(x)',
    '**/test/**/?(*.)+(spec|test).js?(x)',
    '**/tests/**/?(*.)+(spec|test).js?(x)'
  ],
  
  // An array of regexp pattern strings that are matched against all test paths
  // matched tests are skipped
  testPathIgnorePatterns: [
    '/node_modules/',
    'test/database.test.js'
  ],
  
  // An array of file extensions your modules use
  moduleFileExtensions: [
    'js',
    'json',
    'jsx',
    'node'
  ],
  
  // Transform logic for ESM modules in node_modules
  transformIgnorePatterns: [
    "node_modules/(?!(chai)/)"
  ],
  
  // Add transform for node_modules that use ESM syntax
  transform: {
    "node_modules/chai/.*": "babel-jest"
  }
}; 