/**
 * TabManagerButton.js - Button for opening and managing the tab manager
 * 
 * This component provides a button to open the tab management interface
 * and handles the integration with the Voyager browser.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import TabManagerPanel from './TabManagerPanel';

const TabManagerButton = ({ voyager, tabManager }) => {
  // Use reference to store initial state rather than useState to prevent mount warning
  const isOpenRef = useRef(false);
  // Declare state after ref is initialized 
  const [isOpen, setIsOpen] = useState(false);
  const isMountedRef = useRef(false);
  
  // Set mounted flag on mount
  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    // Log when component mounts
    console.log('TabManagerButton mounted, tabManager:', !!tabManager);
    
    // Handle escape key to close panel
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && isMountedRef.current) {
        if (isOpenRef.current) {
          isOpenRef.current = false;
          setIsOpen(false);
        }
      }
    };
    
    // Add event listener
    document.addEventListener('keydown', handleEscapeKey);
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [tabManager, isOpen]);
  
  // Update isOpenRef whenever isOpen changes
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  
  // Toggle panel visibility
  const togglePanel = () => {
    if (isMountedRef.current) {
      const newState = !isOpen;
      isOpenRef.current = newState;
      setIsOpen(newState);
    }
  };
  
  // Handle click outside panel to close it
  const handleClickOutside = (e) => {
    // Only process if panel is open and component is mounted
    if (isOpenRef.current && isMountedRef.current) {
      const panelButton = document.querySelector('.tab-manager-button');
      const panelElement = document.querySelector('.tab-manager-panel');
      
      // Check if click was outside both button and panel
      if (panelButton && !panelButton.contains(e.target) && 
          panelElement && !panelElement.contains(e.target)) {
        isOpenRef.current = false;
        setIsOpen(false);
      }
    }
  };
  
  // Add click listener when panel is open
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);
  
  // Handle tab click from tab manager
  const handleTabClick = (tabId) => {
    if (voyager && tabManager) {
      tabManager.setActiveTab(tabId);
      
      // Get tab data
      const tab = tabManager.getTabById(tabId);
      if (tab && tab.url) {
        // Navigate to tab URL using Voyager
        voyager.navigate(tab.url);
      }
    }
    
    // Keep panel open - don't close on tab click
  };
  
  // Add debugging log for render
  console.log('Rendering TabManagerButton, isOpen:', isOpen);
  
  // Create inline styles to force visibility
  const buttonInlineStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isOpen ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)',
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    cursor: 'pointer',
    boxShadow: isOpen ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : 'none',
    margin: '2px',
    outline: '1px solid white',
    transition: 'all 0.2s ease'
  };
  
  const iconInlineStyle = {
    width: '20px',
    height: '20px',
    fill: isOpen ? '#3b82f6' : '#e2e8f0'
  };
  
  // Render tab manager button and panel
  return (
    <div className="tab-manager-container">
      <button 
        className={`tab-manager-button ${isOpen ? 'active' : ''}`}
        onClick={togglePanel}
        title="Manage tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          margin: '0 4px',
          padding: '0',
          background: 'transparent',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          color: isOpen ? '#ffffff' : '#cccccc',
          outline: isOpen ? '1px solid #4d90fe' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="18" 
          height="18" 
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transition: 'color 0.2s ease'
          }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
      </button>
      
      {/* Render panel conditionally when open */}
      {isOpen && tabManager && createPortal(
        <TabManagerPanel 
          tabManager={tabManager} 
          voyager={voyager}
          onClose={() => {
            if (isMountedRef.current) {
              isOpenRef.current = false;
              setIsOpen(false);
            }
          }}
        />,
        document.body
      )}
    </div>
  );
};

export default TabManagerButton; 