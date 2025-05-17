/**
 * TabBar.js - Horizontal tab bar for the Voyager browser
 * 
 * This component displays open tabs in a horizontal bar above the address bar,
 * allowing users to switch between tabs, close tabs, and create new tabs.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

const TabBar = ({ tabManager, activeTabId, onTabClick, onTabClose, onNewTab }) => {
  const [tabs, setTabs] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [hoveredTabId, setHoveredTabId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState(null);
  const tabBarRef = useRef(null);
  
  useEffect(() => {
    if (!tabManager) return;
    
    // Get initial tabs
    setTabs(tabManager.getTabs());
    
    // Listen for tab manager updates
    const handleUpdate = () => {
      setTabs(tabManager.getTabs());
    };
    
    tabManager.addListener(handleUpdate);
    
    // Cleanup listener on unmount
    return () => {
      tabManager.removeListener(handleUpdate);
    };
  }, [tabManager]);
  
  // Calculate max scroll when tabs change
  useEffect(() => {
    if (!tabBarRef.current) return;
    
    const calculateMaxScroll = () => {
      const container = tabBarRef.current;
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      setMaxScroll(Math.max(0, maxScrollLeft));
    };
    
    calculateMaxScroll();
    
    // Also set up a resize observer to recalculate on resize
    const resizeObserver = new ResizeObserver(calculateMaxScroll);
    resizeObserver.observe(tabBarRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [tabs]);
  
  // Handle scroll buttons for tab overflow
  const scrollLeft = useCallback(() => {
    if (tabBarRef.current) {
      const newPosition = Math.max(0, scrollPosition - 200);
      tabBarRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  }, [scrollPosition]);
  
  const scrollRight = useCallback(() => {
    if (tabBarRef.current) {
      const newPosition = Math.min(maxScroll, scrollPosition + 200);
      tabBarRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  }, [scrollPosition, maxScroll]);
  
  // Track scroll position
  const handleScroll = (e) => {
    setScrollPosition(e.target.scrollLeft);
  };
  
  // Scroll to active tab when it changes
  useEffect(() => {
    if (tabBarRef.current && activeTabId) {
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
    }
  }, [activeTabId, tabs]);
  
  // Handle tab dragging
  const handleDragStart = (e, tabId) => {
    setIsDragging(true);
    setDraggedTabId(tabId);
    
    // Set drag image (invisible)
    const dragImg = document.createElement('div');
    dragImg.style.opacity = '0';
    document.body.appendChild(dragImg);
    e.dataTransfer.setDragImage(dragImg, 0, 0);
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(dragImg);
    }, 0);
  };
  
  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    
    if (!isDragging || !draggedTabId || draggedTabId === targetId) return;
    
    // Calculate reordering (would need to be implemented in tab manager)
    if (tabManager && typeof tabManager.reorderTab === 'function') {
      tabManager.reorderTab(draggedTabId, targetId);
    }
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedTabId(null);
  };
  
  // Check if tabs overflow and need scroll buttons
  const showLeftScroll = scrollPosition > 0;
  const showRightScroll = scrollPosition < maxScroll && maxScroll > 0;
  
  // Determine if a tab is loading (for animation)
  const isTabLoading = (tab) => {
    return tab.isLoading === true;
  };
  
  return (
    <div className="voyager-tab-bar-container">
      {/* Left scroll button - only show if needed */}
      {showLeftScroll && (
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
        {tabs.map(tab => (
          <div 
            key={tab.id} 
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''} ${isTabLoading(tab) ? 'loading' : ''} ${tab.id === draggedTabId ? 'dragging' : ''}`}
            data-tab-id={tab.id}
            draggable="true"
            onClick={() => onTabClick && onTabClick(tab.id)}
            onMouseEnter={() => setHoveredTabId(tab.id)}
            onMouseLeave={() => setHoveredTabId(null)}
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
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : (
              <div className="tab-favicon-placeholder">
                {isTabLoading(tab) ? (
                  <div className="tab-loading-spinner"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 8h14M5 12h14M5 16h14"></path>
                  </svg>
                )}
              </div>
            )}
            
            <span className="tab-title">{tab.title || 'New Tab'}</span>
            
            {(tab.id === hoveredTabId || tab.id === activeTabId) && (
              <button 
                className="tab-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose && onTabClose(tab.id);
                }}
                aria-label="Close tab"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        ))}
        
        {/* New tab button */}
        <div 
          className="new-tab-button" 
          onClick={onNewTab}
          aria-label="Open new tab"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
        </div>
      </div>
      
      {/* Right scroll button - only show if needed */}
      {showRightScroll && (
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