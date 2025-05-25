/**
 * DataPreservationManager.test.js - Comprehensive tests for data preservation system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import dataPreservationManager, { DataPreservationManager } from '../../../../src/components/browser/utils/DataPreservationManager';

// Mock dependencies
vi.mock('../../../../src/utils/logger', () => ({
  default: {
    scope: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
}));

vi.mock('../../../../src/components/browser/utils/BookmarkManager', () => ({
  saveBookmarks: vi.fn(() => true),
  loadBookmarks: vi.fn(() => [
    { url: 'https://example.com', title: 'Example', date: '2024-01-01' }
  ])
}));

vi.mock('../../../../src/components/browser/utils/HistoryManager', () => ({
  saveHistory: vi.fn(() => true),
  loadHistory: vi.fn(() => ({
    history: ['https://example.com', 'https://test.com'],
    historyIndex: 1
  })),
  addHistoryEntry: vi.fn()
}));

vi.mock('../../../../src/services/SettingsService', () => ({
  default: {
    getSettings: vi.fn(() => Promise.resolve({ apiKeys: { openai: 'test-key' } })),
    saveSettings: vi.fn(() => Promise.resolve(true))
  }
}));

describe('DataPreservationManager', () => {
  let manager;
  let mockLocalStorage;

  beforeEach(() => {
    // Reset singleton state
    if (dataPreservationManager.isInitialized) {
      dataPreservationManager.cleanup();
    }

    // Create fresh instance for testing
    manager = new DataPreservationManager();

    // Mock localStorage
    mockLocalStorage = {
      data: new Map(),
      getItem: vi.fn((key) => mockLocalStorage.data.get(key) || null),
      setItem: vi.fn((key, value) => mockLocalStorage.data.set(key, value)),
      removeItem: vi.fn((key) => mockLocalStorage.data.delete(key)),
      clear: vi.fn(() => mockLocalStorage.data.clear()),
      key: vi.fn((index) => Array.from(mockLocalStorage.data.keys())[index] || null),
      get length() { return mockLocalStorage.data.size; }
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    // Mock window and document
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      voyagerBrowsers: [],
      voyagerTabManager: null,
      webviewStateManager: null,
      backend: null
    };

    global.document = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: 'visible',
      querySelectorAll: vi.fn(() => [])
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (manager && manager.isInitialized) {
      manager.cleanup();
    }
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with default options', async () => {
      await manager.initialize();
      
      expect(manager.isInitialized).toBe(true);
      expect(manager.autoSaveInterval).toBe(30000);
      expect(manager.emergencyPreservationDelay).toBe(1000);
    });

    it('should initialize with custom options', async () => {
      const options = {
        autoSaveInterval: 60000,
        emergencyPreservationDelay: 2000,
        enablePeriodicSave: false,
        enableEventListeners: false
      };

      await manager.initialize(options);
      
      expect(manager.isInitialized).toBe(true);
      expect(manager.autoSaveInterval).toBe(60000);
      expect(manager.emergencyPreservationDelay).toBe(2000);
    });

    it('should not reinitialize if already initialized', async () => {
      await manager.initialize();
      const firstInitTime = manager.lastPreservationTime;
      
      await manager.initialize();
      
      expect(manager.isInitialized).toBe(true);
      // Should not have changed
      expect(manager.lastPreservationTime).toBe(firstInitTime);
    });

    it('should set up event listeners when enabled', async () => {
      await manager.initialize({ enableEventListeners: true });
      
      expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function), { capture: true });
      expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function), { capture: true });
      expect(window.addEventListener).toHaveBeenCalledWith('unload', expect.any(Function), { capture: true });
    });

    it('should set up periodic preservation when enabled', async () => {
      vi.useFakeTimers();
      
      await manager.initialize({ enablePeriodicSave: true, autoSaveInterval: 1000 });
      
      expect(manager.periodicPreservationInterval).toBeDefined();
      
      vi.useRealTimers();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle beforeunload event', async () => {
      const mockEvent = { returnValue: null };
      const preserveAllDataSpy = vi.spyOn(manager, 'preserveAllData').mockResolvedValue({ success: true });
      
      await manager.handleBeforeUnload(mockEvent);
      
      expect(preserveAllDataSpy).toHaveBeenCalledWith({
        source: 'beforeunload',
        priority: 'critical',
        synchronous: true
      });
    });

    it('should handle beforeunload event failure', async () => {
      const mockEvent = { returnValue: null };
      const preserveAllDataSpy = vi.spyOn(manager, 'preserveAllData').mockRejectedValue(new Error('Test error'));
      
      const result = await manager.handleBeforeUnload(mockEvent);
      
      expect(preserveAllDataSpy).toHaveBeenCalled();
      expect(mockEvent.returnValue).toBe('Some data may not be saved. Are you sure you want to leave?');
      expect(result).toBe('Some data may not be saved. Are you sure you want to leave?');
    });

    it('should handle visibility change to hidden', async () => {
      document.visibilityState = 'hidden';
      const preserveAllDataSpy = vi.spyOn(manager, 'preserveAllData').mockResolvedValue({ success: true });
      
      await manager.handleVisibilityChange();
      
      expect(preserveAllDataSpy).toHaveBeenCalledWith({
        source: 'visibilitychange',
        priority: 'normal'
      });
    });

    it('should not preserve data when visibility changes to visible', async () => {
      document.visibilityState = 'visible';
      const preserveAllDataSpy = vi.spyOn(manager, 'preserveAllData');
      
      await manager.handleVisibilityChange();
      
      expect(preserveAllDataSpy).not.toHaveBeenCalled();
    });

    it('should handle emergency preservation', async () => {
      const preserveAllDataSpy = vi.spyOn(manager, 'preserveAllData').mockResolvedValue({ success: true });
      
      await manager.emergencyPreservation();
      
      expect(preserveAllDataSpy).toHaveBeenCalledWith({
        source: 'emergency',
        priority: 'critical',
        synchronous: true,
        timeout: manager.emergencyPreservationDelay
      });
    });
  });

  describe('Data Preservation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should preserve all data types successfully', async () => {
      const result = await manager.preserveAllData();
      
      expect(result.success).toBe(true);
      expect(result.successRate).toBe(100);
      expect(result.results.size).toBe(manager.criticalDataTypes.size);
    });

    it('should handle preservation timeout', async () => {
      vi.spyOn(manager, 'preserveDataType').mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );
      
      const result = await manager.preserveAllData({ timeout: 100 });
      
      expect(result).toBeUndefined(); // Should timeout
    });

    it('should skip preservation if already in progress', async () => {
      manager.preservationInProgress = true;
      
      const result = await manager.preserveAllData({ priority: 'normal' });
      
      expect(result).toBeUndefined();
    });

    it('should allow critical preservation even if in progress', async () => {
      manager.preservationInProgress = true;
      const preserveDataTypeSpy = vi.spyOn(manager, 'preserveDataType').mockResolvedValue({ preserved: 1 });
      
      const result = await manager.preserveAllData({ priority: 'critical' });
      
      expect(result).toBeDefined();
      expect(preserveDataTypeSpy).toHaveBeenCalled();
    });
  });

  describe('Individual Data Type Preservation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should preserve browser state', async () => {
      window.voyagerBrowsers = [
        {
          browserId: 'test-browser-1',
          state: {
            url: 'https://example.com',
            title: 'Example',
            favicon: 'favicon.ico'
          },
          saveStateToStorage: vi.fn()
        }
      ];

      const result = await manager.preserveBrowserState();
      
      expect(result.preserved).toBe(1);
      expect(window.voyagerBrowsers[0].saveStateToStorage).toHaveBeenCalled();
    });

    it('should preserve browser state with localStorage fallback', async () => {
      window.voyagerBrowsers = [
        {
          browserId: 'test-browser-1',
          state: {
            url: 'https://example.com',
            title: 'Example',
            favicon: 'favicon.ico'
          }
          // No saveStateToStorage method
        }
      ];

      const result = await manager.preserveBrowserState();
      
      expect(result.preserved).toBe(1);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'voyager-browser-state-test-browser-1',
        expect.stringContaining('https://example.com')
      );
    });

    it('should preserve bookmarks', async () => {
      const result = await manager.preserveBookmarks();
      
      expect(result.preserved).toBe(1);
    });

    it('should preserve history', async () => {
      const result = await manager.preserveHistory();
      
      expect(result.preserved).toBe(2);
      expect(result.entries).toBe(0);
    });

    it('should preserve settings', async () => {
      const result = await manager.preserveSettings();
      
      expect(result.preserved).toBe(true);
      expect(result.hasSettings).toBe(true);
    });

    it('should preserve tab states', async () => {
      window.voyagerTabManager = {
        getState: vi.fn(() => ({ tab1: { url: 'https://example.com' } }))
      };

      const result = await manager.preserveTabStates();
      
      expect(result.preserved).toBe(1);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'voyager-tab-states',
        expect.any(String)
      );
    });

    it('should preserve webview states', async () => {
      window.webviewStateManager = {
        getAllStates: vi.fn(() => ({ webview1: { url: 'https://example.com' } }))
      };

      const result = await manager.preserveWebviewStates();
      
      expect(result.preserved).toBe(1);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'webview-states',
        expect.any(String)
      );
    });

    it('should preserve form data', async () => {
      const mockWebview = {
        id: 'test-webview',
        executeJavaScript: vi.fn(() => Promise.resolve({
          form_0: { username: 'test', email: 'test@example.com' }
        }))
      };

      document.querySelectorAll = vi.fn(() => [mockWebview]);

      const result = await manager.preserveFormData();
      
      expect(result.preserved).toBe(1);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'form-data-test-webview',
        expect.any(String)
      );
    });

    it('should preserve theme preferences', async () => {
      mockLocalStorage.data.set('theme-preference', 'dark');
      mockLocalStorage.data.set('dark-mode-enabled', 'true');

      const result = await manager.preserveThemePreferences();
      
      expect(result.preserved).toBe(2);
      expect(result.currentTheme).toBe('dark');
    });

    it('should preserve error history', async () => {
      const result = await manager.preserveErrorHistory();
      
      expect(result.preserved).toBe(1); // error-history itself
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'error-history',
        expect.any(String)
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle unknown data type', async () => {
      await expect(manager.preserveDataType('unknown')).rejects.toThrow('Unknown data type: unknown');
    });

    it('should handle preservation errors gracefully', async () => {
      vi.spyOn(manager, 'preserveBrowserState').mockRejectedValue(new Error('Test error'));
      
      const result = await manager.preserveAllData({ dataTypes: ['browserState'] });
      
      expect(result.success).toBe(false);
      expect(result.successRate).toBe(0);
      expect(result.results.get('browserState').success).toBe(false);
    });

    it('should track preservation status with errors', async () => {
      vi.spyOn(manager, 'preserveBrowserState').mockRejectedValue(new Error('Test error'));
      
      await manager.preserveAllData({ dataTypes: ['browserState'] });
      
      const status = manager.getPreservationStatus();
      expect(status.status.browserState.errors).toHaveLength(1);
      expect(status.status.browserState.errors[0].error).toBe('Test error');
    });
  });

  describe('Status and Monitoring', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return preservation status', () => {
      const status = manager.getPreservationStatus();
      
      expect(status.isInitialized).toBe(true);
      expect(status.preservationInProgress).toBe(false);
      expect(status.preservationAttempts).toBe(0);
      expect(status.status).toBeDefined();
    });

    it('should force preservation', async () => {
      const preserveAllDataSpy = vi.spyOn(manager, 'preserveAllData').mockResolvedValue({ success: true });
      
      await manager.forcePreservation();
      
      expect(preserveAllDataSpy).toHaveBeenCalledWith({
        source: 'forced',
        priority: 'critical',
        synchronous: true
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup properly', async () => {
      await manager.initialize();
      
      manager.cleanup();
      
      expect(manager.isInitialized).toBe(false);
      expect(window.removeEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('unload', expect.any(Function));
    });

    it('should clear periodic preservation interval', async () => {
      vi.useFakeTimers();
      
      await manager.initialize({ enablePeriodicSave: true });
      const intervalId = manager.periodicPreservationInterval;
      
      manager.cleanup();
      
      expect(manager.periodicPreservationInterval).toBeNull();
      
      vi.useRealTimers();
    });

    it('should cleanup Electron event listeners', async () => {
      const mockIpc = {
        on: vi.fn(),
        removeAllListeners: vi.fn()
      };
      
      window.backend = { ipc: mockIpc };
      
      await manager.initialize();
      manager.cleanup();
      
      expect(mockIpc.removeAllListeners).toHaveBeenCalledWith('app-will-quit');
      expect(mockIpc.removeAllListeners).toHaveBeenCalledWith('window-will-close');
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle complete application shutdown scenario', async () => {
      // Set up complex application state
      window.voyagerBrowsers = [
        {
          browserId: 'browser-1',
          state: { url: 'https://example.com', title: 'Example' }
        }
      ];
      
      window.voyagerTabManager = {
        getState: () => ({ tab1: { url: 'https://test.com' } })
      };
      
      mockLocalStorage.data.set('theme-preference', 'dark');
      
      // Simulate beforeunload event
      const result = await manager.handleBeforeUnload({ returnValue: null });
      
      expect(result).toBeUndefined(); // Should complete successfully
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(expect.any(Number));
    });

    it('should handle partial preservation failure gracefully', async () => {
      // Mock one preservation method to fail
      vi.spyOn(manager, 'preserveSettings').mockRejectedValue(new Error('Settings error'));
      
      const result = await manager.preserveAllData();
      
      expect(result.success).toBe(false);
      expect(result.successRate).toBeLessThan(100);
      expect(result.results.get('settings').success).toBe(false);
      
      // Other data types should still succeed
      expect(result.results.get('bookmarks').success).toBe(true);
    });

    it('should handle rapid preservation requests', async () => {
      const promises = [
        manager.preserveAllData({ source: 'test1' }),
        manager.preserveAllData({ source: 'test2' }),
        manager.preserveAllData({ source: 'test3' })
      ];
      
      const results = await Promise.allSettled(promises);
      
      // Only one should succeed, others should be skipped
      const successfulResults = results.filter(r => r.status === 'fulfilled' && r.value);
      expect(successfulResults.length).toBe(1);
    });
  });
}); 