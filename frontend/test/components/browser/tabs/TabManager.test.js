/**
 * TabManager.test.js - Tests for the enhanced TabManager functionality
 */

import TabManager from '../../../../src/components/browser/tabs/TabManager.js';

describe('TabManager Enhanced Functionality', () => {
  let tabManager;

  beforeEach(() => {
    tabManager = new TabManager();
  });

  afterEach(() => {
    if (tabManager && typeof tabManager.cleanup === 'function') {
      tabManager.cleanup();
    }
  });

  describe('Basic Tab Operations', () => {
    test('should create and manage tabs correctly', () => {
      const tab1 = tabManager.addTab({
        url: 'https://example.com',
        title: 'Example'
      });

      expect(tab1).toBeDefined();
      expect(tab1.url).toBe('https://example.com');
      expect(tab1.title).toBe('Example');
      expect(tabManager.getTabs()).toHaveLength(1);
    });

    test('should get active tab correctly', () => {
      const tab = tabManager.addTab({
        url: 'https://example.com',
        title: 'Example'
      });

      const activeTab = tabManager.getActiveTab();
      expect(activeTab).toBeDefined();
      expect(activeTab.id).toBe(tab.id);
    });

    test('should update tab content safely', async () => {
      const tab = tabManager.addTab({
        url: 'https://example.com',
        title: 'Example'
      });

      const extractedContent = {
        title: 'Updated Title',
        text: 'Sample content',
        summary: 'Brief summary'
      };

      const updatedTab = await tabManager.updateTabContent(tab.id, extractedContent);
      expect(updatedTab).toBeDefined();
      expect(updatedTab.extractedContent).toEqual(extractedContent);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid tab operations gracefully', async () => {
      // Test updating non-existent tab
      await expect(tabManager.updateTabContent('invalid-id', {}))
        .rejects.toThrow('Tab not found: invalid-id');
    });

    test('should handle safeExecute wrapper correctly', () => {
      const result = tabManager.safeExecute('testOperation', () => {
        throw new Error('Test error');
      });

      expect(result).toBeNull();
    });

    test('should handle valid operations with safeExecute', () => {
      const result = tabManager.safeExecute('testOperation', (a, b) => a + b, 5, 3);
      expect(result).toBe(8);
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should clean up resources properly', () => {
      // Add some tabs and listeners
      tabManager.addTab({ url: 'https://example1.com', title: 'Example 1' });
      tabManager.addTab({ url: 'https://example2.com', title: 'Example 2' });
      
      const mockListener = jest.fn();
      tabManager.addListener(mockListener);

      expect(tabManager.getTabs()).toHaveLength(2);
      expect(tabManager.listeners).toHaveLength(1);

      // Cleanup
      tabManager.cleanup();

      expect(tabManager.getTabs()).toHaveLength(0);
      expect(tabManager.listeners).toHaveLength(0);
      expect(tabManager.getActiveTab()).toBeNull();
    });

    test('should handle cleanup errors gracefully', () => {
      // Mock tabGroupingService with error-throwing cleanup
      tabManager.tabGroupingService = {
        cleanup: () => {
          throw new Error('Cleanup error');
        }
      };

      // Should not throw
      expect(() => tabManager.cleanup()).not.toThrow();
    });
  });

  describe('State Management', () => {
    test('should notify listeners on tab changes', () => {
      const mockListener = jest.fn();
      tabManager.addListener(mockListener);

      tabManager.addTab({ url: 'https://example.com', title: 'Example' });

      expect(mockListener).toHaveBeenCalled();
    });

    test('should maintain state consistency', () => {
      const tab1 = tabManager.addTab({ url: 'https://example1.com', title: 'Example 1' });
      const tab2 = tabManager.addTab({ url: 'https://example2.com', title: 'Example 2' });

      // tab2 should be active (last added)
      expect(tabManager.getActiveTab().id).toBe(tab2.id);

      // Switch to tab1
      tabManager.setActiveTab(tab1.id);
      expect(tabManager.getActiveTab().id).toBe(tab1.id);

      // Close tab1, tab2 should become active
      tabManager.closeTab(tab1.id);
      expect(tabManager.getActiveTab().id).toBe(tab2.id);
    });
  });

  describe('Tab Grouping', () => {
    test('should handle default group correctly', () => {
      const tab = tabManager.addTab({ url: 'https://example.com', title: 'Example' });
      
      expect(tab.groupId).toBe('default');
      expect(tabManager.defaultGroup.tabIds).toContain(tab.id);
    });

    test('should create and manage groups', () => {
      const group = tabManager.createGroup('Test Group', '#ff0000');
      
      expect(group).toBeDefined();
      expect(group.name).toBe('Test Group');
      expect(group.color).toBe('#ff0000');
      expect(tabManager.getGroups()).toContain(group);
    });
  });
}); 