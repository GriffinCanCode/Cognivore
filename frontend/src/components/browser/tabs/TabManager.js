/**
 * TabManager.js - Manages browser tabs and their groupings
 * 
 * This service maintains the state of all open tabs, provides methods for
 * creating tab groups based on content similarity, and handles tab operations
 * like creating, closing, and switching between tabs.
 */

import TabGroupingService from './TabGroupingService';
import { nanoid } from 'nanoid';

class TabManager {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.groups = [];
    this.tabGroupingService = new TabGroupingService();
    this.listeners = [];
    
    // Create default group for ungrouped tabs
    this.defaultGroup = {
      id: 'default',
      name: 'Ungrouped',
      color: '#cccccc',
      tabIds: []
    };
    this.groups.push(this.defaultGroup);
  }

  /**
   * Initialize TabManager with any existing tabs
   * @param {Array} existingTabs - Any existing tabs to initialize with
   * @returns {TabManager} - This instance for chaining
   */
  initialize(existingTabs = []) {
    if (existingTabs.length > 0) {
      this.tabs = existingTabs.map(tab => ({
        ...tab,
        id: tab.id || nanoid(),
        groupId: tab.groupId || 'default'
      }));
      
      // Update default group with any tabs that belong to it
      this.defaultGroup.tabIds = this.tabs
        .filter(tab => tab.groupId === 'default')
        .map(tab => tab.id);
      
      // Set first tab as active if none is specified
      if (!this.activeTabId && this.tabs.length > 0) {
        this.activeTabId = this.tabs[0].id;
      }
    }
    
    return this;
  }

  /**
   * Subscribe to tab manager events
   * @param {Function} listener - Callback for tab changes
   * @returns {Function} - Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all subscribers of state changes
   */
  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Get the current state of the tab manager
   * @returns {Object} - Current tab manager state
   */
  getState() {
    return {
      tabs: [...this.tabs],
      activeTabId: this.activeTabId,
      groups: [...this.groups]
    };
  }

  /**
   * Create a new tab
   * @param {Object} tabData - Tab data including url, title, etc.
   * @returns {Object} - The newly created tab
   */
  createTab(tabData) {
    const newTab = {
      id: nanoid(),
      url: tabData.url || 'about:blank',
      title: tabData.title || 'New Tab',
      favicon: tabData.favicon || null,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      groupId: tabData.groupId || 'default',
      content: tabData.content || null,
      embeddings: null, // Will be populated after content extraction
      ...tabData
    };
    
    this.tabs.push(newTab);
    
    // Add to default group if no group specified
    if (newTab.groupId === 'default') {
      this.defaultGroup.tabIds.push(newTab.id);
    } else {
      // Add to specified group
      const group = this.groups.find(g => g.id === newTab.groupId);
      if (group) {
        group.tabIds.push(newTab.id);
      }
    }
    
    // Set as active tab
    this.activeTabId = newTab.id;
    
    this.notifyListeners();
    return newTab;
  }

  /**
   * Close a tab by ID
   * @param {string} tabId - ID of tab to close
   * @returns {boolean} - Whether the tab was successfully closed
   */
  closeTab(tabId) {
    const tabIndex = this.tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return false;
    
    const closedTab = this.tabs[tabIndex];
    
    // Remove from tabs array
    this.tabs.splice(tabIndex, 1);
    
    // Remove from group
    const group = this.groups.find(g => g.id === closedTab.groupId);
    if (group) {
      group.tabIds = group.tabIds.filter(id => id !== tabId);
    }
    
    // Update active tab if necessary
    if (this.activeTabId === tabId) {
      // Set the previous tab as active, or the next one if no previous
      if (tabIndex > 0) {
        this.activeTabId = this.tabs[tabIndex - 1].id;
      } else if (this.tabs.length > 0) {
        this.activeTabId = this.tabs[0].id;
      } else {
        this.activeTabId = null;
      }
    }
    
    this.notifyListeners();
    return true;
  }

  /**
   * Set the active tab
   * @param {string} tabId - ID of tab to set as active
   * @returns {boolean} - Whether the active tab was successfully set
   */
  setActiveTab(tabId) {
    const tab = this.tabs.find(tab => tab.id === tabId);
    if (!tab) return false;
    
    this.activeTabId = tabId;
    tab.lastAccessed = new Date().toISOString();
    
    this.notifyListeners();
    return true;
  }

  /**
   * Update tab data
   * @param {string} tabId - ID of tab to update
   * @param {Object} tabData - New tab data
   * @returns {Object|null} - Updated tab or null if tab not found
   */
  updateTab(tabId, tabData) {
    const tab = this.tabs.find(tab => tab.id === tabId);
    if (!tab) return null;
    
    // Handle group changes
    if (tabData.groupId && tabData.groupId !== tab.groupId) {
      // Remove from old group
      const oldGroup = this.groups.find(g => g.id === tab.groupId);
      if (oldGroup) {
        oldGroup.tabIds = oldGroup.tabIds.filter(id => id !== tabId);
      }
      
      // Add to new group
      const newGroup = this.groups.find(g => g.id === tabData.groupId);
      if (newGroup) {
        newGroup.tabIds.push(tabId);
      }
    }
    
    // Update tab data
    Object.assign(tab, tabData);
    
    // If it's a tab content update, remove old embeddings so they'll be regenerated
    if (tabData.content) {
      tab.embeddings = null;
    }
    
    this.notifyListeners();
    return tab;
  }

  /**
   * Create a new group
   * @param {Object} groupData - Group data
   * @returns {Object} - The newly created group
   */
  createGroup(groupData) {
    const newGroup = {
      id: nanoid(),
      name: groupData.name || 'New Group',
      color: groupData.color || this.getRandomColor(),
      tabIds: groupData.tabIds || [],
      createdAt: new Date().toISOString(),
      ...groupData
    };
    
    this.groups.push(newGroup);
    
    // Update any tabs that should be in this group
    if (newGroup.tabIds.length > 0) {
      newGroup.tabIds.forEach(tabId => {
        const tab = this.tabs.find(tab => tab.id === tabId);
        if (tab) {
          // Remove from old group
          const oldGroup = this.groups.find(g => g.id === tab.groupId);
          if (oldGroup && oldGroup.id !== newGroup.id) {
            oldGroup.tabIds = oldGroup.tabIds.filter(id => id !== tabId);
          }
          
          // Update tab
          tab.groupId = newGroup.id;
        }
      });
    }
    
    this.notifyListeners();
    return newGroup;
  }

  /**
   * Get a random color for group
   * @returns {string} - Random hex color
   */
  getRandomColor() {
    const colors = [
      '#4285F4', // Blue
      '#EA4335', // Red
      '#FBBC05', // Yellow
      '#34A853', // Green
      '#8E44AD', // Purple
      '#F39C12', // Orange
      '#16A085', // Teal
      '#E74C3C', // Bright Red
      '#3498DB', // Light Blue
      '#2ECC71'  // Light Green
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Update a group
   * @param {string} groupId - ID of group to update
   * @param {Object} groupData - New group data
   * @returns {Object|null} - Updated group or null if not found
   */
  updateGroup(groupId, groupData) {
    if (groupId === 'default') {
      // Only allow updating name and color of default group
      if (groupData.name) this.defaultGroup.name = groupData.name;
      if (groupData.color) this.defaultGroup.color = groupData.color;
      this.notifyListeners();
      return this.defaultGroup;
    }
    
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return null;
    
    // Update group data
    Object.assign(group, groupData);
    
    this.notifyListeners();
    return group;
  }

  /**
   * Delete a group and move its tabs to default group
   * @param {string} groupId - ID of group to delete
   * @returns {boolean} - Whether the group was successfully deleted
   */
  deleteGroup(groupId) {
    if (groupId === 'default') return false; // Cannot delete default group
    
    const groupIndex = this.groups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) return false;
    
    const group = this.groups[groupIndex];
    
    // Move all tabs to default group
    group.tabIds.forEach(tabId => {
      const tab = this.tabs.find(tab => tab.id === tabId);
      if (tab) {
        tab.groupId = 'default';
        this.defaultGroup.tabIds.push(tabId);
      }
    });
    
    // Remove group
    this.groups.splice(groupIndex, 1);
    
    this.notifyListeners();
    return true;
  }

  /**
   * Move a tab to a different group
   * @param {string} tabId - ID of tab to move
   * @param {string} groupId - ID of target group
   * @returns {boolean} - Whether the tab was successfully moved
   */
  moveTabToGroup(tabId, groupId) {
    const tab = this.tabs.find(tab => tab.id === tabId);
    if (!tab) return false;
    
    // Skip if already in this group
    if (tab.groupId === groupId) return true;
    
    // Remove from old group
    const oldGroup = this.groups.find(g => g.id === tab.groupId);
    if (oldGroup) {
      oldGroup.tabIds = oldGroup.tabIds.filter(id => id !== tabId);
    }
    
    // Add to new group
    const newGroup = this.groups.find(g => g.id === groupId);
    if (!newGroup) return false;
    
    newGroup.tabIds.push(tabId);
    tab.groupId = groupId;
    
    this.notifyListeners();
    return true;
  }

  /**
   * Generate embeddings for all tabs without embeddings
   * @returns {Promise<void>} - Promise that resolves when embeddings are generated
   */
  async generateEmbeddings() {
    const tabsNeedingEmbeddings = this.tabs.filter(tab => !tab.embeddings && tab.content);
    
    if (tabsNeedingEmbeddings.length === 0) return;
    
    try {
      for (const tab of tabsNeedingEmbeddings) {
        const embeddings = await this.tabGroupingService.generateEmbeddings(tab.content, tab.title);
        this.updateTab(tab.id, { embeddings });
      }
    } catch (error) {
      console.error('Error generating embeddings:', error);
    }
  }

  /**
   * Automatically group tabs based on content similarity
   * @param {Object} options - Clustering options
   * @returns {Promise<Array>} - Promise resolving to created groups
   */
  async autoGroupTabs(options = {}) {
    try {
      // Generate embeddings for tabs that need them
      await this.generateEmbeddings();
      
      // Get tabs with embeddings
      const tabsWithEmbeddings = this.tabs.filter(tab => tab.embeddings);
      
      if (tabsWithEmbeddings.length < 2) {
        console.warn('Not enough tabs with embeddings for clustering');
        return [];
      }
      
      // Perform clustering
      const clusters = await this.tabGroupingService.clusterTabs(tabsWithEmbeddings, options);
      
      // Create new groups based on clusters
      const createdGroups = [];
      
      for (const [clusterIndex, tabIds] of Object.entries(clusters)) {
        // Skip single-tab clusters if option is set
        if (options.skipSingleTabClusters && tabIds.length === 1) {
          continue;
        }
        
        // Get common theme for the cluster
        const clusterTabs = tabIds.map(id => this.tabs.find(tab => tab.id === id)).filter(Boolean);
        const theme = await this.tabGroupingService.getClusterTheme(clusterTabs);
        
        // Create a new group
        const newGroup = this.createGroup({
          name: theme || `Cluster ${clusterIndex + 1}`,
          tabIds: tabIds,
          isAutogenerated: true
        });
        
        createdGroups.push(newGroup);
      }
      
      return createdGroups;
    } catch (error) {
      console.error('Error auto-grouping tabs:', error);
      return [];
    }
  }

  /**
   * Get tab graph data for visualization
   * @param {boolean} includeContent - Whether to include tab content in the graph data
   * @returns {Object} - Graph data with nodes and edges
   */
  getGraphData(includeContent = false) {
    // Create nodes for tabs
    const nodes = this.tabs.map(tab => ({
      id: tab.id,
      label: tab.title,
      group: tab.groupId,
      url: tab.url,
      favicon: tab.favicon,
      type: 'tab',
      isActive: tab.id === this.activeTabId,
      lastAccessed: tab.lastAccessed,
      ...(includeContent ? { content: tab.content } : {})
    }));
    
    // Create nodes for groups
    const groupNodes = this.groups.map(group => ({
      id: `group-${group.id}`,
      label: group.name,
      color: group.color,
      type: 'group',
      size: group.tabIds.length + 10, // Size based on number of tabs
      tabCount: group.tabIds.length
    }));
    
    // Create edges connecting tabs to their groups
    const edges = this.tabs.map(tab => ({
      from: tab.id,
      to: `group-${tab.groupId}`,
      value: 1
    }));
    
    // Create edges between similar tabs
    const similarityEdges = this.tabGroupingService.getSimilarityEdges(this.tabs);
    
    return {
      nodes: [...nodes, ...groupNodes],
      edges: [...edges, ...similarityEdges]
    };
  }

  /**
   * Add a listener for tab manager updates
   * @param {Function} listener - Callback function
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener
   * @param {Function} listener - Callback function to remove
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Get all tabs
   * @returns {Array} - Array of tab objects
   */
  getTabs() {
    return [...this.tabs];
  }

  /**
   * Get tab by ID
   * @param {string} tabId - Tab ID
   * @returns {Object|null} - Tab object or null if not found
   */
  getTabById(tabId) {
    return this.tabs.find(tab => tab.id === tabId) || null;
  }

  /**
   * Get all groups
   * @returns {Array} - Array of group objects
   */
  getGroups() {
    return [...this.groups];
  }

  /**
   * Get group by ID
   * @param {string} groupId - Group ID
   * @returns {Object|null} - Group object or null if not found
   */
  getGroupById(groupId) {
    return this.groups.find(group => group.id === groupId) || null;
  }

  /**
   * Get the active tab ID
   * @returns {string|null} - Active tab ID or null if none active
   */
  getActiveTabId() {
    return this.activeTabId;
  }

  /**
   * Set the active tab
   * @param {string} tabId - Tab ID to activate
   */
  setActiveTab(tabId) {
    const tab = this.getTabById(tabId);
    if (tab) {
      this.activeTabId = tabId;
      this.notifyListeners();
    }
  }

  /**
   * Add a new tab
   * @param {Object} tabData - Tab data (url, title, favicon, etc.)
   * @returns {Object} - New tab object
   */
  addTab(tabData) {
    const newTab = {
      id: tabData.id || nanoid(),
      url: tabData.url || '',
      title: tabData.title || '',
      favicon: tabData.favicon || null,
      extractedContent: tabData.extractedContent || null,
      groupId: 'default',
      relatedTabs: [],
      embedding: null,
      createdAt: Date.now(),
      ...tabData
    };
    
    this.tabs.push(newTab);
    this.defaultGroup.tabIds.push(newTab.id);
    
    // Set as active tab if no active tab
    if (!this.activeTabId) {
      this.activeTabId = newTab.id;
    }
    
    this.notifyListeners();
    return newTab;
  }

  /**
   * Update an existing tab
   * @param {string} tabId - Tab ID
   * @param {Object} updates - Properties to update
   * @returns {Object|null} - Updated tab or null if not found
   */
  updateTab(tabId, updates) {
    const tabIndex = this.tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return null;
    
    const updatedTab = { ...this.tabs[tabIndex], ...updates };
    this.tabs[tabIndex] = updatedTab;
    
    this.notifyListeners();
    return updatedTab;
  }

  /**
   * Create a new tab group
   * @param {string} name - Group name
   * @param {string} color - Group color (hex)
   * @returns {Object} - New group object
   */
  createGroup(name, color) {
    // Generate random color if not provided
    if (!color) {
      const colors = this.tabGroupingService.colorPalette;
      color = colors[Math.floor(Math.random() * colors.length)];
    }
    
    const newGroup = {
      id: nanoid(),
      name: name || `Group ${this.groups.length}`,
      color,
      tabIds: []
    };
    
    this.groups.push(newGroup);
    this.notifyListeners();
    return newGroup;
  }

  /**
   * Rename a tab group
   * @param {string} groupId - Group ID
   * @param {string} newName - New group name
   * @returns {Object|null} - Updated group or null if not found
   */
  renameGroup(groupId, newName) {
    const group = this.getGroupById(groupId);
    if (!group) return null;
    
    group.name = newName;
    this.notifyListeners();
    return group;
  }

  /**
   * Analyze tabs to generate clusters and update groups
   * @param {string} method - Clustering method ('dbscan' or 'kmeans')
   * @param {Object} options - Clustering options
   * @returns {Promise<Object>} - Result with groups and relationships
   */
  async analyzeTabs(method = 'dbscan', options = {}) {
    try {
      // Only analyze tabs with content
      const tabsToAnalyze = this.tabs.filter(tab => 
        tab.extractedContent && 
        (tab.extractedContent.paragraphs || tab.extractedContent.summary)
      );
      
      if (tabsToAnalyze.length < 2) {
        throw new Error('Need at least 2 tabs with content to analyze');
      }
      
      // Run clustering
      const clusteringResult = await this.tabGroupingService.clusterTabs(
        tabsToAnalyze, 
        method, 
        options
      );
      
      // Replace existing groups (except default) with new clusters
      this.groups = [this.defaultGroup];
      
      // Add new groups from clustering
      clusteringResult.groups.forEach(group => {
        if (group.id !== 'noise') {
          this.groups.push(group);
          
          // Update tabs with new group IDs
          group.tabIds.forEach(tabId => {
            const tab = this.getTabById(tabId);
            if (tab) {
              // Remove from default group if present
              this.defaultGroup.tabIds = this.defaultGroup.tabIds.filter(id => id !== tabId);
              
              // Set new group ID
              tab.groupId = group.id;
            }
          });
        }
      });
      
      // Handle "noise" tabs by moving them to default group
      const noiseGroup = clusteringResult.groups.find(g => g.id === 'noise');
      if (noiseGroup) {
        noiseGroup.tabIds.forEach(tabId => {
          const tab = this.getTabById(tabId);
          if (tab) {
            tab.groupId = 'default';
            
            // Add to default group if not already there
            if (!this.defaultGroup.tabIds.includes(tabId)) {
              this.defaultGroup.tabIds.push(tabId);
            }
          }
        });
      }
      
      // Update tab relationships
      Object.entries(clusteringResult.relationships).forEach(([tabId, relations]) => {
        const tab = this.getTabById(tabId);
        if (tab) {
          tab.relatedTabs = relations;
        }
      });
      
      this.notifyListeners();
      return clusteringResult;
    } catch (error) {
      console.error('Error analyzing tabs:', error);
      throw error;
    }
  }

  /**
   * Find tabs related to a specific tab
   * @param {string} tabId - Tab ID
   * @returns {Array} - Array of related tab objects with similarity scores
   */
  getRelatedTabs(tabId) {
    const tab = this.getTabById(tabId);
    if (!tab || !tab.relatedTabs || tab.relatedTabs.length === 0) {
      return [];
    }
    
    return tab.relatedTabs
      .map(relation => ({
        tab: this.getTabById(relation.tabId),
        similarity: relation.similarity
      }))
      .filter(item => item.tab !== null)
      .sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Get all tabs in a specific group
   * @param {string} groupId - Group ID
   * @returns {Array} - Array of tab objects in the group
   */
  getTabsInGroup(groupId) {
    const group = this.getGroupById(groupId);
    if (!group) return [];
    
    return group.tabIds
      .map(tabId => this.getTabById(tabId))
      .filter(tab => tab !== null);
  }

  /**
   * Update tab with extracted content and regenerate relationships
   * @param {string} tabId - Tab ID
   * @param {Object} extractedContent - Extracted content data
   * @returns {Promise<Object>} - Updated tab
   */
  async updateTabContent(tabId, extractedContent) {
    const tab = this.getTabById(tabId);
    if (!tab) throw new Error(`Tab not found: ${tabId}`);
    
    // Update tab with extracted content
    tab.extractedContent = extractedContent;
    
    this.notifyListeners();
    return tab;
  }
}

export default TabManager; 