/**
 * TabManagerPanel.js - UI panel for the tab manager
 * 
 * This component provides a user interface for managing tabs, viewing groups,
 * and interacting with the tab visualization as a vertical side panel.
 */

import React, { useState, useEffect } from 'react';
import TabGraph from './TabGraph';

// Simple modal dialog component for text input
const InputModal = ({ isOpen, title, placeholder, defaultValue, onConfirm, onCancel }) => {
  const [value, setValue] = useState(defaultValue || '');
  
  useEffect(() => {
    setValue(defaultValue || '');
  }, [defaultValue, isOpen]);
  
  if (!isOpen) return null;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={!value.trim()}>OK</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TabManagerPanel = ({ tabManager, onTabClick, onClose }) => {
  const [tabs, setTabs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'graph' or 'list'
  const [clusteringMethod, setClusteringMethod] = useState('dbscan');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sortBy, setSortBy] = useState('lastAccessed'); // 'title', 'lastAccessed', 'url'
  
  // Modal state
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    placeholder: '',
    defaultValue: '',
    onConfirm: null
  });
  
  // Listen for tab manager updates
  useEffect(() => {
    if (!tabManager) return;
    
    // Initial data load
    setTabs(tabManager.getTabs());
    setGroups(tabManager.getGroups());
    setActiveTabId(tabManager.getActiveTabId());
    
    // Subscribe to tab manager events
    const handleUpdate = () => {
      setTabs(tabManager.getTabs());
      setGroups(tabManager.getGroups());
      setActiveTabId(tabManager.getActiveTabId());
    };
    
    tabManager.addListener(handleUpdate);
    
    return () => {
      tabManager.removeListener(handleUpdate);
    };
  }, [tabManager]);
  
  // Handle tab click
  const handleTabClick = (tabId) => {
    if (onTabClick) {
      onTabClick(tabId);
    }
  };

  // Handle tab close
  const handleTabClose = (e, tabId) => {
    e.stopPropagation(); // Prevent triggering tab click
    if (tabManager) {
      tabManager.closeTab(tabId);
    }
  };
  
  // Handle group click
  const handleGroupClick = (groupId) => {
    // This could expand/collapse the group in list view
    console.log('Group clicked:', groupId);
  };
  
  // Run clustering analysis
  const handleAnalyzeTabs = async () => {
    if (!tabManager || isAnalyzing) return;
    
    setIsAnalyzing(true);
    
    try {
      // Run clustering with selected method
      await tabManager.analyzeTabs(clusteringMethod);
    } catch (error) {
      console.error('Error analyzing tabs:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Create a new group
  const handleCreateGroup = () => {
    setModalState({
      isOpen: true,
      title: 'Create New Group',
      placeholder: 'Enter group name...',
      defaultValue: '',
      onConfirm: (name) => {
        if (tabManager) {
          tabManager.createGroup(name);
        }
        setModalState({ ...modalState, isOpen: false });
      }
    });
  };
  
  // Rename a group
  const handleRenameGroup = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    
    setModalState({
      isOpen: true,
      title: 'Rename Group',
      placeholder: 'Enter new group name...',
      defaultValue: group.name,
      onConfirm: (newName) => {
        if (tabManager) {
          tabManager.renameGroup(groupId, newName);
        }
        setModalState({ ...modalState, isOpen: false });
      }
    });
  };
  
  // Close modal
  const handleCloseModal = () => {
    setModalState({ ...modalState, isOpen: false });
  };
  
  // Delete a group
  const handleDeleteGroup = (groupId) => {
    if (window.confirm('Are you sure you want to delete this group?') && tabManager) {
      tabManager.deleteGroup(groupId);
    }
  };
  
  // Move a tab to a different group
  const handleMoveTabToGroup = (tabId, groupId) => {
    if (tabManager) {
      tabManager.moveTabToGroup(tabId, groupId);
    }
  };

  // Sort tabs based on criteria
  const sortTabs = (tabs, sortBy) => {
    if (!tabs) return [];
    
    return [...tabs].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'url':
          return (a.url || '').localeCompare(b.url || '');
        case 'lastAccessed':
          // Most recently accessed first
          const dateA = a.lastAccessed ? new Date(a.lastAccessed) : new Date(0);
          const dateB = b.lastAccessed ? new Date(b.lastAccessed) : new Date(0);
          return dateB - dateA;
        default:
          return 0;
      }
    });
  };
  
  // Render tab list view
  const renderTabList = () => {
    return (
      <div className="tab-list-container">
        {groups.map(group => {
          // Get tabs for this group
          const groupTabs = tabs.filter(tab => tab.groupId === group.id);
          const sortedTabs = sortTabs(groupTabs, sortBy);
          
          if (sortedTabs.length === 0) return null;
          
          return (
            <div key={group.id} className="tab-group">
              <div 
                className="tab-group-header" 
                style={{ backgroundColor: group.color }}
              >
                <h3>{group.name} ({sortedTabs.length})</h3>
                <div className="tab-group-actions">
                  <button onClick={() => handleRenameGroup(group.id)}>
                    Rename
                  </button>
                  {group.id !== 'default' && (
                    <button onClick={() => handleDeleteGroup(group.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <ul className="tab-list">
                {sortedTabs.map(tab => (
                  <li 
                    key={tab.id}
                    className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
                    onClick={() => handleTabClick(tab.id)}
                  >
                    {tab.favicon ? (
                      <img 
                        src={tab.favicon} 
                        alt=""
                        className="tab-favicon"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    ) : (
                      <div className="tab-favicon"></div>
                    )}
                    <span className="tab-title" title={tab.title || tab.url}>
                      {tab.title || tab.url}
                    </span>
                    <div className="tab-actions">
                      <button 
                        className="tab-close-btn"
                        onClick={(e) => handleTabClose(e, tab.id)}
                        title="Close tab"
                      >
                        ×
                      </button>
                      <select 
                        onChange={(e) => handleMoveTabToGroup(tab.id, e.target.value)}
                        value={tab.groupId || ''}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="" disabled>Move to...</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <>
      <div className="tab-manager-overlay" onClick={onClose}></div>
      <div className="tab-manager-panel">
        <div className="tab-manager-header">
          <h2>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
              <rect x="9" y="9" width="6" height="6"></rect>
              <line x1="9" y1="1" x2="9" y2="4"></line>
              <line x1="15" y1="1" x2="15" y2="4"></line>
              <line x1="9" y1="20" x2="9" y2="23"></line>
              <line x1="15" y1="20" x2="15" y2="23"></line>
              <line x1="20" y1="9" x2="23" y2="9"></line>
              <line x1="20" y1="14" x2="23" y2="14"></line>
              <line x1="1" y1="9" x2="4" y2="9"></line>
              <line x1="1" y1="14" x2="4" y2="14"></line>
            </svg>
            Tab Manager
          </h2>
          <div className="tab-manager-controls">
            <button className="tab-manager-close-btn" onClick={onClose} title="Close">
              ×
            </button>
          </div>
        </div>
        
        <div className="tab-manager-content">
          <div className="view-mode-toggle">
            <button 
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              List View
            </button>
            <button 
              className={viewMode === 'graph' ? 'active' : ''}
              onClick={() => setViewMode('graph')}
            >
              Graph View
            </button>
          </div>
          
          {viewMode === 'list' && (
            <div className="sorting-controls">
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                title="Sort tabs by"
              >
                <option value="lastAccessed">Sort by Recent</option>
                <option value="title">Sort by Title</option>
                <option value="url">Sort by URL</option>
              </select>
            </div>
          )}
          
          <div className="clustering-controls">
            <select 
              value={clusteringMethod}
              onChange={(e) => setClusteringMethod(e.target.value)}
            >
              <option value="dbscan">DBSCAN Clustering</option>
              <option value="kmeans">K-Means Clustering</option>
            </select>
            <button 
              onClick={handleAnalyzeTabs}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Tabs'}
            </button>
            <button onClick={handleCreateGroup}>
              Create Group
            </button>
          </div>
          
          {viewMode === 'graph' ? (
            <TabGraph 
              tabs={tabs}
              groups={groups}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
              onGroupClick={handleGroupClick}
            />
          ) : (
            renderTabList()
          )}
        </div>
      </div>
      
      {/* Input Modal */}
      <InputModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        placeholder={modalState.placeholder}
        defaultValue={modalState.defaultValue}
        onConfirm={modalState.onConfirm}
        onCancel={handleCloseModal}
      />
    </>
  );
};

export default TabManagerPanel; 