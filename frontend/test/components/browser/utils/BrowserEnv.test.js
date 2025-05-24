/**
 * Tests for BrowserEnv.js - Centralized browser environment detection and configuration
 */

import { 
  detectEnvironment, 
  forceElectronMode, 
  formatUrl, 
  applySiteSpecificSettings, 
  applySandboxSettings,
  getIconForUrl,
  formatBytes,
  showToastNotification,
  updatePageTitle,
  setupWebviewEnvironment
} from '../../../../src/components/browser/utils/BrowserEnv.js';

// Mock DOM and window globals for testing
Object.defineProperty(global, 'window', {
  writable: true,
  value: {
    process: undefined,
    electron: undefined,
    ipcRenderer: undefined,
    isElectron: undefined,
    location: { href: 'http://localhost:3000' },
    postMessage: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }
});

Object.defineProperty(global, 'navigator', {
  writable: true,
  value: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
});

Object.defineProperty(global, 'document', {
  writable: true,
  value: {
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
      setAttribute: jest.fn(),
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 800
    },
    querySelectorAll: jest.fn(() => []),
    querySelector: jest.fn(),
    body: {
      appendChild: jest.fn(),
      innerText: 'Test content'
    },
    head: {
      appendChild: jest.fn()
    },
    getElementById: jest.fn(() => null)
  }
});

describe('BrowserEnv', () => {
  beforeEach(() => {
    // Reset window state before each test
    window.isElectron = undefined;
    window.__ELECTRON_MODE_FORCED__ = undefined;
    window.process = undefined;
    window.electron = undefined;
    window.ipcRenderer = undefined;
    document.title = 'Test Document';
    
    // Reset navigator.userAgent properly
    Object.defineProperty(global.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
  });

  describe('detectEnvironment', () => {
    test('should detect Electron environment with process.type renderer', () => {
      window.process = { type: 'renderer', versions: { electron: '1.0.0' } };
      
      const result = detectEnvironment();
      
      expect(result.isElectron).toBe(true);
      expect(result.renderingMode).toBe('full');
      expect(result.webviewImplementation).toBe('webview');
    });

    test('should detect Electron environment with electron global', () => {
      window.electron = {};
      
      const result = detectEnvironment();
      
      expect(result.isElectron).toBe(true);
      expect(result.renderingMode).toBe('full');
    });

    test('should detect Electron environment with ipcRenderer', () => {
      window.ipcRenderer = { send: jest.fn() };
      
      const result = detectEnvironment();
      
      expect(result.isElectron).toBe(true);
      expect(result.hasNodeAccess).toBe(true);
    });

    test('should detect Electron environment from user agent', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 Chrome/91.0.4472.124 Electron/13.1.7 Safari/537.36'
      });
      
      const result = detectEnvironment();
      
      expect(result.isElectron).toBe(true);
    });

    test('should detect Electron environment from global flag', () => {
      window.isElectron = true;
      
      const result = detectEnvironment();
      
      expect(result.isElectron).toBe(true);
    });

    test('should detect Electron environment from app title', () => {
      document.title = 'Cognivore';
      
      const result = detectEnvironment();
      
      expect(result.isElectron).toBe(true);
    });

    test('should return complete environment object', () => {
      const result = detectEnvironment();
      
      expect(result).toHaveProperty('isElectron');
      expect(result).toHaveProperty('isNode');
      expect(result).toHaveProperty('hasNodeAccess');
      expect(result).toHaveProperty('hasWebView');
      expect(result).toHaveProperty('renderingMode');
      expect(result).toHaveProperty('webviewImplementation');
    });
  });

  describe('forceElectronMode', () => {
    test('should force Electron mode and set global flags', () => {
      const result = forceElectronMode();
      
      expect(window.isElectron).toBe(true);
      expect(window.__ELECTRON_MODE_FORCED__).toBe(true);
      expect(result.isElectron).toBe(true);
    });

    test('should set data attribute on document element', () => {
      forceElectronMode();
      
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-electron-mode', 'true');
    });
  });

  describe('formatUrl', () => {
    test('should return empty string for empty input', () => {
      expect(formatUrl('')).toBe('');
      expect(formatUrl(null)).toBe('');
      expect(formatUrl(undefined)).toBe('');
    });

    test('should add https:// to domain names', () => {
      expect(formatUrl('example.com')).toBe('https://example.com');
      expect(formatUrl('www.google.com')).toBe('https://www.google.com');
      expect(formatUrl('subdomain.example.org')).toBe('https://subdomain.example.org');
    });

    test('should preserve existing protocol', () => {
      expect(formatUrl('http://example.com')).toBe('http://example.com');
      expect(formatUrl('https://example.com')).toBe('https://example.com');
      expect(formatUrl('ftp://files.example.com')).toBe('ftp://files.example.com');
    });

    test('should convert search queries to Google search', () => {
      expect(formatUrl('hello world')).toBe('https://www.google.com/search?q=hello%20world');
      expect(formatUrl('javascript tutorials')).toBe('https://www.google.com/search?q=javascript%20tutorials');
    });

    test('should handle single words as search if no TLD', () => {
      expect(formatUrl('javascript')).toBe('https://www.google.com/search?q=javascript');
      expect(formatUrl('test')).toBe('https://www.google.com/search?q=test');
    });

    test('should trim whitespace', () => {
      expect(formatUrl('  example.com  ')).toBe('https://example.com');
      expect(formatUrl('\n\tgoogle.com\n')).toBe('https://google.com');
    });
  });

  describe('applySiteSpecificSettings', () => {
    let mockWebview;

    beforeEach(() => {
      mockWebview = {
        tagName: 'WEBVIEW',
        isConnected: true,
        setAttribute: jest.fn(),
        setUserAgent: jest.fn(),
        getWebContentsId: jest.fn(() => 1),
        getWebContents: jest.fn(() => ({
          session: {
            webRequest: {
              onHeadersReceived: jest.fn()
            }
          }
        }))
      };
    });

    test('should handle missing parameters gracefully', () => {
      expect(() => applySiteSpecificSettings(null, mockWebview)).not.toThrow();
      expect(() => applySiteSpecificSettings('example.com', null)).not.toThrow();
    });

    test('should apply Google-specific settings', () => {
      applySiteSpecificSettings('https://www.google.com/search', mockWebview);
      
      expect(mockWebview.setUserAgent).toHaveBeenCalledWith(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      );
    });

    test('should apply YouTube-specific settings', () => {
      applySiteSpecificSettings('https://www.youtube.com/watch?v=test', mockWebview);
      
      expect(mockWebview.setUserAgent).toHaveBeenCalledWith(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      );
    });

    test('should handle webview not ready gracefully', () => {
      mockWebview.getWebContentsId = jest.fn(() => -1);
      
      expect(() => applySiteSpecificSettings('https://example.com', mockWebview)).not.toThrow();
    });
  });

  describe('applySandboxSettings', () => {
    test('should handle null element gracefully', () => {
      expect(() => applySandboxSettings(null, 'standard')).not.toThrow();
    });

    test('should configure Electron webview with proper attributes', () => {
      const mockWebview = {
        tagName: 'WEBVIEW',
        setAttribute: jest.fn(),
        style: {}
      };

      applySandboxSettings(mockWebview, 'standard');

      expect(mockWebview.setAttribute).toHaveBeenCalledWith('allowpopups', 'true');
      expect(mockWebview.setAttribute).toHaveBeenCalledWith('disablewebsecurity', 'true');
      expect(mockWebview.setAttribute).toHaveBeenCalledWith('nodeintegration', 'false');
    });

    test('should configure iframe with sandbox attributes', () => {
      const mockIframe = {
        tagName: 'IFRAME',
        setAttribute: jest.fn()
      };

      applySandboxSettings(mockIframe, 'standard');

      expect(mockIframe.setAttribute).toHaveBeenCalledWith(
        'sandbox', 
        expect.stringContaining('allow-same-origin allow-scripts')
      );
    });

    test('should handle different sandbox levels', () => {
      const mockIframe = {
        tagName: 'IFRAME',
        setAttribute: jest.fn()
      };

      applySandboxSettings(mockIframe, 'strict');
      expect(mockIframe.setAttribute).toHaveBeenCalledWith('sandbox', 'allow-same-origin allow-scripts');

      applySandboxSettings(mockIframe, 'none');
      expect(mockIframe.setAttribute).toHaveBeenCalledWith(
        'sandbox', 
        'allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-modals'
      );
    });
  });

  describe('getIconForUrl', () => {
    test('should return default icon for valid URLs', () => {
      const icon = getIconForUrl('https://example.com');
      expect(icon).toContain('data:image/svg+xml;base64,');
    });

    test('should return default icon for invalid URLs', () => {
      const icon = getIconForUrl('invalid-url');
      expect(icon).toContain('data:image/svg+xml;base64,');
    });

    test('should handle null URL gracefully', () => {
      const icon = getIconForUrl(null);
      expect(icon).toContain('data:image/svg+xml;base64,');
    });
  });

  describe('formatBytes', () => {
    test('should format zero bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    test('should format bytes correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    test('should handle decimal places', () => {
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 0)).toBe('2 KB');
    });

    test('should handle negative decimals parameter', () => {
      expect(formatBytes(1536, -1)).toBe('2 KB');
    });
  });

  describe('showToastNotification', () => {
    beforeEach(() => {
      document.getElementById = jest.fn(() => null);
      document.body.appendChild = jest.fn();
    });

    test('should create toast element if it does not exist', () => {
      showToastNotification('Test message');
      
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    test('should set appropriate background color for different types', () => {
      const mockToast = {
        style: {},
        textContent: ''
      };
      document.getElementById = jest.fn(() => mockToast);

      showToastNotification('Success', 'success');
      expect(mockToast.style.backgroundColor).toBe('#4CAF50');

      showToastNotification('Error', 'error');
      expect(mockToast.style.backgroundColor).toBe('#F44336');

      showToastNotification('Warning', 'warning');
      expect(mockToast.style.backgroundColor).toBe('#FF9800');

      showToastNotification('Info', 'info');
      expect(mockToast.style.backgroundColor).toBe('#2196F3');
    });
  });

  describe('updatePageTitle', () => {
    test('should handle missing parameters gracefully', () => {
      expect(() => updatePageTitle(null, 'Test Title')).not.toThrow();
      expect(() => updatePageTitle({}, null)).not.toThrow();
    });

    test('should update browser state if setState method exists', () => {
      const mockBrowser = {
        setState: jest.fn()
      };

      updatePageTitle(mockBrowser, 'New Title');
      
      expect(mockBrowser.setState).toHaveBeenCalledWith({ title: 'New Title' });
    });

    test('should update document title if updateDocumentTitle prop is true', () => {
      const originalTitle = document.title;
      const mockBrowser = {
        props: { updateDocumentTitle: true }
      };

      updatePageTitle(mockBrowser, 'New Document Title');
      
      expect(document.title).toBe('New Document Title');
      
      // Restore original title
      document.title = originalTitle;
    });
  });

  describe('setupWebviewEnvironment', () => {
    test('should return false for disconnected webview', async () => {
      const mockWebview = { isConnected: false };
      
      const result = await setupWebviewEnvironment(mockWebview);
      
      expect(result).toBe(false);
    });

    test('should return false for webview without executeJavaScript', async () => {
      const mockWebview = { isConnected: true };
      
      const result = await setupWebviewEnvironment(mockWebview);
      
      expect(result).toBe(false);
    });

    test('should execute setup script and return success', async () => {
      const mockWebview = {
        isConnected: true,
        executeJavaScript: jest.fn().mockResolvedValue(true)
      };
      
      const result = await setupWebviewEnvironment(mockWebview);
      
      expect(mockWebview.executeJavaScript).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('should handle script execution errors', async () => {
      const mockWebview = {
        isConnected: true,
        executeJavaScript: jest.fn().mockRejectedValue(new Error('Script error'))
      };
      
      const result = await setupWebviewEnvironment(mockWebview);
      
      expect(result).toBe(false);
    });
  });
}); 