/**
 * Tests for BrowserUtilities.js - Backward compatibility layer
 * Tests that all functions are properly re-exported from BrowserEnv.js
 */

import {
  detectEnvironment,
  formatUrl,
  applySiteSpecificSettings,
  applySandboxSettings,
  getIconForUrl,
  formatBytes,
  showToastNotification,
  updatePageTitle
} from '../../../../src/components/browser/utils/BrowserUtilities.js';

// Mock DOM and window globals for testing
global.window = {
  process: undefined,
  electron: undefined,
  ipcRenderer: undefined,
  isElectron: undefined,
  location: { href: 'http://localhost:3000' }
};

global.navigator = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
};

global.document = {
  title: 'Test Document',
  createElement: jest.fn(() => ({
    constructor: { name: 'HTMLElement' },
    style: {},
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    addEventListener: jest.fn(),
    getBoundingClientRect: jest.fn(() => ({})),
    tagName: 'DIV',
    isConnected: true
  })),
  documentElement: {
    setAttribute: jest.fn()
  },
  querySelectorAll: jest.fn(() => []),
  body: {
    appendChild: jest.fn()
  },
  getElementById: jest.fn(() => null)
};

describe('BrowserUtilities (Backward Compatibility)', () => {
  beforeEach(() => {
    // Reset window state before each test
    window.isElectron = undefined;
    window.process = undefined;
    window.electron = undefined;
    window.ipcRenderer = undefined;
    document.title = 'Test Document';
  });

  test('should re-export detectEnvironment function', () => {
    expect(typeof detectEnvironment).toBe('function');
    
    const result = detectEnvironment();
    expect(result).toHaveProperty('isElectron');
    expect(result).toHaveProperty('renderingMode');
    expect(result).toHaveProperty('webviewImplementation');
  });

  test('should re-export formatUrl function', () => {
    expect(typeof formatUrl).toBe('function');
    
    expect(formatUrl('example.com')).toBe('https://example.com');
    expect(formatUrl('hello world')).toBe('https://www.google.com/search?q=hello%20world');
  });

  test('should re-export applySiteSpecificSettings function', () => {
    expect(typeof applySiteSpecificSettings).toBe('function');
    
    const mockWebview = {
      tagName: 'WEBVIEW',
      isConnected: true,
      setAttribute: jest.fn(),
      setUserAgent: jest.fn(),
      getWebContentsId: jest.fn(() => 1)
    };
    
    expect(() => applySiteSpecificSettings('https://google.com', mockWebview)).not.toThrow();
  });

  test('should re-export applySandboxSettings function', () => {
    expect(typeof applySandboxSettings).toBe('function');
    
    const mockElement = {
      tagName: 'IFRAME',
      setAttribute: jest.fn()
    };
    
    expect(() => applySandboxSettings(mockElement, 'standard')).not.toThrow();
  });

  test('should re-export getIconForUrl function', () => {
    expect(typeof getIconForUrl).toBe('function');
    
    const icon = getIconForUrl('https://example.com');
    expect(icon).toContain('data:image/svg+xml;base64,');
  });

  test('should re-export formatBytes function', () => {
    expect(typeof formatBytes).toBe('function');
    
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  test('should re-export showToastNotification function', () => {
    expect(typeof showToastNotification).toBe('function');
    
    expect(() => showToastNotification('Test message')).not.toThrow();
  });

  test('should re-export updatePageTitle function', () => {
    expect(typeof updatePageTitle).toBe('function');
    
    const mockBrowser = {
      setState: jest.fn()
    };
    
    expect(() => updatePageTitle(mockBrowser, 'Test Title')).not.toThrow();
  });

  test('all functions should be identical to BrowserEnv exports', async () => {
    // Import from BrowserEnv directly for comparison
    const BrowserEnv = await import('../../../../src/components/browser/utils/BrowserEnv.js');
    
    // Test that the re-exported functions are the same as the originals
    expect(detectEnvironment).toBe(BrowserEnv.detectEnvironment);
    expect(formatUrl).toBe(BrowserEnv.formatUrl);
    expect(applySiteSpecificSettings).toBe(BrowserEnv.applySiteSpecificSettings);
    expect(applySandboxSettings).toBe(BrowserEnv.applySandboxSettings);
    expect(getIconForUrl).toBe(BrowserEnv.getIconForUrl);
    expect(formatBytes).toBe(BrowserEnv.formatBytes);
    expect(showToastNotification).toBe(BrowserEnv.showToastNotification);
    expect(updatePageTitle).toBe(BrowserEnv.updatePageTitle);
  });
}); 