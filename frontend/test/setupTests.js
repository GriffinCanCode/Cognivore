// Jest setup file
require('@testing-library/jest-dom');

// Mock electron for tests
global.require = jest.fn((module) => {
  if (module === 'electron') {
    return {
      ipcRenderer: {
        send: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
        invoke: jest.fn()
      },
      remote: {
        app: {
          getPath: jest.fn(() => '/mock/path')
        }
      }
    };
  }
  return jest.requireActual(module);
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Suppress console errors during tests unless explicitly testing them
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
}); 