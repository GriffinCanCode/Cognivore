module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/*.test.js',
    '**/*.spec.js'
  ],
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(nanoid|@mozilla/readability|metascraper|dompurify|d3|d3-*)/)'
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/test/mocks/styleMock.js',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp)$': '<rootDir>/test/mocks/fileMock.js',
    '^nanoid$': '<rootDir>/test/mocks/nanoidMock.js',
    '^d3$': '<rootDir>/test/mocks/d3Mock.js'
  },
  moduleDirectories: ['node_modules', 'src'],
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.js',
    '!src/preload.js',
    '!**/*.d.js',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  globals: {
    'NODE_ENV': 'test'
  },
  verbose: true
}; 