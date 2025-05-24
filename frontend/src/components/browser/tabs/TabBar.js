/**
 * TabBar.js - Horizontal tab bar for the Voyager browser
 * 
 * This component displays open tabs in a horizontal bar above the address bar,
 * allowing users to switch between tabs, close tabs, and create new tabs.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const TabBar = ({ tabManager, activeTabId, onTabClick, onTabClose, onNewTab }) => {
  const [tabs, setTabs] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [hoveredTabId, setHoveredTabId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState(null);
  const [error, setError] = useState(null);
  const [isUnmounting, setIsUnmounting] = useState(false);
  const tabBarRef = useRef(null);
  const updateTimeoutRef = useRef(null);
  const listenersRef = useRef([]);
  
  // Enhanced tab manager effect with error handling and cleanup
  useEffect(() => {
    if (!tabManager || isUnmounting) {
      setError('Tab manager not available');
      return;
    }
    
    let isSubscribed = true;
    
    const cleanup = () => {
      isSubscribed = false;
      // Clear any pending updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      // Remove all listeners
      listenersRef.current.forEach(removeListener => {
        try {
          removeListener();
        } catch (err) {
          console.warn('Error removing tab listener:', err);
        }
      });
      listenersRef.current = [];
    };
    
    try {
      // Get initial tabs safely
      const initialTabs = tabManager.getTabs();
      if (isSubscribed && !isUnmounting) {
        setTabs(initialTabs || []);
        setError(null);
      }
      
      // Listen for tab manager updates with debouncing
      const handleUpdate = () => {
        if (!isSubscribed || isUnmounting) return;
        
        // Debounce updates to prevent rapid state changes
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        
        updateTimeoutRef.current = setTimeout(() => {
          if (isSubscribed && !isUnmounting) {
            try {
              const updatedTabs = tabManager.getTabs();
              setTabs(updatedTabs || []);
              setError(null);
            } catch (err) {
              console.error('Error updating tabs:', err);
              if (isSubscribed && !isUnmounting) {
                setError('Failed to update tabs');
              }
            }
          }
        }, 50); // 50ms debounce
      };
      
      // Add listener and track for cleanup
      if (typeof tabManager.addListener === 'function') {
        tabManager.addListener(handleUpdate);
        listenersRef.current.push(() => tabManager.removeListener(handleUpdate));
      }
      
      // Subscribe if available and track for cleanup
      if (typeof tabManager.subscribe === 'function') {
        const unsubscribe = tabManager.subscribe(handleUpdate);
        if (typeof unsubscribe === 'function') {
          listenersRef.current.push(unsubscribe);
        }
      }
      
      return cleanup;
    } catch (err) {
      console.error('Error setting up tab manager:', err);
      if (isSubscribed && !isUnmounting) {
        setError('Failed to initialize tab manager');
      }
      return cleanup;
    }
  }, [tabManager, isUnmounting]);
  
  // Component unmount cleanup
  useEffect(() => {
    return () => {
      setIsUnmounting(true);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);
  
  // Calculate max scroll when tabs change with error handling
  useEffect(() => {
    if (!tabBarRef.current || isUnmounting) return;
    
    const calculateMaxScroll = () => {
      try {
        if (!tabBarRef.current || isUnmounting) return;
        
        const container = tabBarRef.current;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        setMaxScroll(Math.max(0, maxScrollLeft));
      } catch (error) {
        console.warn('Error calculating max scroll:', error);
      }
    };
    
    calculateMaxScroll();
    
    // Set up resize observer with error handling
    let resizeObserver = null;
    try {
      resizeObserver = new ResizeObserver((entries) => {
        if (!isUnmounting) {
          calculateMaxScroll();
        }
      });
      
      if (tabBarRef.current) {
        resizeObserver.observe(tabBarRef.current);
      }
    } catch (error) {
      console.warn('Error setting up resize observer:', error);
    }
    
    return () => {
      if (resizeObserver) {
        try {
          resizeObserver.disconnect();
        } catch (error) {
          console.warn('Error disconnecting resize observer:', error);
        }
      }
    };
  }, [tabs, isUnmounting]);
  
  // Memoized calculations for better performance
  const tabMetrics = useMemo(() => {
    if (isUnmounting) {
      return {
        showLeftScroll: false,
        showRightScroll: false,
        hasMultipleTabs: false
      };
    }
    
    return {
      showLeftScroll: scrollPosition > 0,
      showRightScroll: scrollPosition < maxScroll && maxScroll > 0,
      hasMultipleTabs: tabs.length > 1
    };
  }, [scrollPosition, maxScroll, tabs.length, isUnmounting]);
  
  // Enhanced scroll handlers with error handling
  const scrollLeft = useCallback(() => {
    if (isUnmounting) return;
    
    try {
      if (tabBarRef.current) {
        const newPosition = Math.max(0, scrollPosition - 200);
        tabBarRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
        setScrollPosition(newPosition);
      }
    } catch (error) {
      console.warn('Error scrolling tabs left:', error);
    }
  }, [scrollPosition, isUnmounting]);
  
  const scrollRight = useCallback(() => {
    if (isUnmounting) return;
    
    try {
      if (tabBarRef.current) {
        const newPosition = Math.min(maxScroll, scrollPosition + 200);
        tabBarRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
        setScrollPosition(newPosition);
      }
    } catch (error) {
      console.warn('Error scrolling tabs right:', error);
    }
  }, [scrollPosition, maxScroll, isUnmounting]);
  
  // Track scroll position with error handling
  const handleScroll = useCallback((e) => {
    if (isUnmounting) return;
    
    try {
      setScrollPosition(e.target.scrollLeft);
    } catch (error) {
      console.warn('Error handling scroll:', error);
    }
  }, [isUnmounting]);
  
  // Scroll to active tab when it changes with error handling
  useEffect(() => {
    if (!tabBarRef.current || !activeTabId || isUnmounting) return;
    
    try {
      const activeTab = tabBarRef.current.querySelector(`.tab-item[data-tab-id="${activeTabId}"]`);
      if (activeTab) {
        // Scroll active tab into view
        const tabBarRect = tabBarRef.current.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        
        // Check if tab is not fully visible
        if (tabRect.left < tabBarRect.left || tabRect.right > tabBarRect.right) {
          // Calculate position to center the tab
          const scrollPosition = activeTab.offsetLeft - (tabBarRect.width / 2) + (tabRect.width / 2);
          tabBarRef.current.scrollTo({
            left: Math.max(0, scrollPosition),
            behavior: 'smooth'
          });
        }
      }
    } catch (error) {
      console.warn('Error scrolling to active tab:', error);
    }
  }, [activeTabId, tabs, isUnmounting]);
  
  // Handle tab dragging with error handling
  const handleDragStart = useCallback((e, tabId) => {
    if (isUnmounting) return;
    
    try {
      setIsDragging(true);
      setDraggedTabId(tabId);
      
      // Set drag image (invisible)
      const dragImg = document.createElement('div');
      dragImg.style.opacity = '0';
      document.body.appendChild(dragImg);
      e.dataTransfer.setDragImage(dragImg, 0, 0);
      
      // Clean up
      setTimeout(() => {
        try {
          if (document.body.contains(dragImg)) {
            document.body.removeChild(dragImg);
          }
        } catch (error) {
          console.warn('Error cleaning up drag image:', error);
        }
      }, 0);
    } catch (error) {
      console.warn('Error handling drag start:', error);
    }
  }, [isUnmounting]);
  
  const handleDragOver = useCallback((e, targetId) => {
    if (isUnmounting) return;
    
    try {
      e.preventDefault();
      
      if (!isDragging || !draggedTabId || draggedTabId === targetId) return;
      
      // Calculate reordering (would need to be implemented in tab manager)
      if (tabManager && typeof tabManager.reorderTab === 'function') {
        tabManager.reorderTab(draggedTabId, targetId);
      }
    } catch (error) {
      console.warn('Error handling drag over:', error);
    }
  }, [isDragging, draggedTabId, tabManager, isUnmounting]);
  
  const handleDragEnd = useCallback(() => {
    if (isUnmounting) return;
    
    try {
      setIsDragging(false);
      setDraggedTabId(null);
    } catch (error) {
      console.warn('Error handling drag end:', error);
    }
  }, [isUnmounting]);
  
  // Enhanced event handlers with error handling
  const handleTabClick = useCallback((tabId) => {
    if (isUnmounting) return;
    
    try {
      if (onTabClick && typeof onTabClick === 'function') {
        onTabClick(tabId);
      }
    } catch (error) {
      console.error('Error handling tab click:', error);
      if (!isUnmounting) {
        setError('Failed to switch tab');
      }
    }
  }, [onTabClick, isUnmounting]);

  const handleTabClose = useCallback((tabId, event) => {
    if (isUnmounting) return;
    
    try {
      if (event) {
        event.stopPropagation();
      }
      if (onTabClose && typeof onTabClose === 'function') {
        onTabClose(tabId);
      }
    } catch (error) {
      console.error('Error handling tab close:', error);
      if (!isUnmounting) {
        setError('Failed to close tab');
      }
    }
  }, [onTabClose, isUnmounting]);

  const handleNewTab = useCallback(() => {
    if (isUnmounting) return;
    
    try {
      if (onNewTab && typeof onNewTab === 'function') {
        onNewTab();
      }
    } catch (error) {
      console.error('Error creating new tab:', error);
      if (!isUnmounting) {
        setError('Failed to create new tab');
      }
    }
  }, [onNewTab, isUnmounting]);

  // Mouse event handlers with error handling
  const handleMouseEnter = useCallback((tabId) => {
    if (!isUnmounting) {
      setHoveredTabId(tabId);
    }
  }, [isUnmounting]);

  const handleMouseLeave = useCallback(() => {
    if (!isUnmounting) {
      setHoveredTabId(null);
    }
  }, [isUnmounting]);
  
  // Early return for unmounting state
  if (isUnmounting) {
    return null;
  }
  
  // Error display component
  if (error) {
    return (
      <div className="voyager-tab-bar-container">
        <div className="tab-error-message" style={{
          padding: '8px 16px',
          color: '#ef4444',
          fontSize: '12px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)'
        }}>
          {error}
        </div>
      </div>
    );
  }

  // No tabs fallback
  if (!tabs || tabs.length === 0) {
    return (
      <div className="voyager-tab-bar-container">
        <div className="no-tabs-message">
          No tabs open
        </div>
        <div 
          className="new-tab-button" 
          onClick={handleNewTab}
          aria-label="Open new tab"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
        </div>
      </div>
    );
  }
  
  return (
    <div className="voyager-tab-bar-container">
      {/* Left scroll button - only show if needed */}
      {tabMetrics.showLeftScroll && (
        <button 
          className="tab-scroll-button tab-scroll-left" 
          onClick={scrollLeft}
          aria-label="Scroll tabs left"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"></path>
          </svg>
        </button>
      )}
      
      {/* Tab container with horizontal scrolling */}
      <div 
        className="voyager-tab-bar" 
        ref={tabBarRef} 
        onScroll={handleScroll}
      >
        {tabs.map(tab => {
          // Skip rendering if tab data is invalid
          if (!tab || !tab.id) return null;
          
          return (
            <div 
              key={tab.id} 
              className={`tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.isLoading ? 'loading' : ''} ${tab.id === draggedTabId ? 'dragging' : ''}`}
              data-tab-id={tab.id}
              draggable="true"
              onClick={() => handleTabClick(tab.id)}
              onMouseEnter={() => handleMouseEnter(tab.id)}
              onMouseLeave={handleMouseLeave}
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={(e) => handleDragOver(e, tab.id)}
              onDragEnd={handleDragEnd}
            >
              {tab.favicon ? (
                <img 
                  src={tab.favicon} 
                  alt=""
                  className="tab-favicon"
                  onError={(e) => {
                    try {
                      e.target.style.display = 'none';
                      const placeholder = e.target.nextSibling;
                      if (placeholder) {
                        placeholder.style.display = 'flex';
                      }
                    } catch (error) {
                      console.warn('Error handling favicon error:', error);
                    }
                  }}
                />
              ) : null}
              
              <div 
                className="tab-favicon-placeholder"
                style={{ display: tab.favicon ? 'none' : 'flex' }}
              >
                {tab.isLoading ? (
                  <div className="tab-loading-spinner"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 8h14M5 12h14M5 16h14"></path>
                  </svg>
                )}
              </div>
              
              <span className="tab-title">{tab.title || 'New Tab'}</span>
              
              {(tab.id === hoveredTabId || tab.id === activeTabId) && (
                <button 
                  className="tab-close-btn"
                  onClick={(e) => handleTabClose(tab.id, e)}
                  aria-label="Close tab"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </div>
          );
        })}
        
        {/* New tab button */}
        <div 
          className="new-tab-button" 
          onClick={handleNewTab}
          aria-label="Open new tab"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
        </div>
      </div>
      
      {/* Right scroll button - only show if needed */}
      {tabMetrics.showRightScroll && (
        <button 
          className="tab-scroll-button tab-scroll-right" 
          onClick={scrollRight}
          aria-label="Scroll tabs right"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6"></path>
          </svg>
        </button>
      )}
    </div>
  );
};

export default TabBar; 