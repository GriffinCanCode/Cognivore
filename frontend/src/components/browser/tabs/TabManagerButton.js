/**
 * TabManagerButton.js - Button for opening and managing the tab manager
 * 
 * This component provides a button to open the tab management interface
 * and handles the integration with the Voyager browser.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import TabManagerPanel from './TabManagerPanel';

const TabManagerButton = ({ voyager, tabManager }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    // Log when component mounts
    console.log('TabManagerButton mounted, tabManager:', !!tabManager);
    
    // Handle escape key to close panel
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      // Log when component unmounts
      console.log('TabManagerButton unmounted');
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [tabManager, isOpen]);
  
  // Toggle tab manager panel
  const toggleTabManager = () => {
    console.log('Tab manager button clicked, toggling panel');
    setIsOpen(!isOpen);
    
    // Add body class to adjust layout when panel is open
    if (!isOpen) {
      document.body.classList.add('tab-manager-active');
    } else {
      document.body.classList.remove('tab-manager-active');
    }
  };
  
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
  
  // Handle close panel
  const handleClose = () => {
    setIsOpen(false);
    document.body.classList.remove('tab-manager-active');
  };
  
  // Add debugging log for render
  console.log('Rendering TabManagerButton, isOpen:', isOpen);
  
  return (
    <>
      <button 
        className={`tab-manager-button ${isOpen ? 'active' : ''}`}
        onClick={toggleTabManager}
        title="Tab Manager"
      >
        <span className="tab-manager-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path fill="none" d="M0 0h24v24H0z"/>
            <path d="M21 3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h18zm-1 2H4v14h16V5zm-3 2v2H7V7h10zm-3 4v2H7v-2h7zm-3 4v2H7v-2h4z"/>
          </svg>
        </span>
      </button>
      
      {isOpen && createPortal(
        <TabManagerPanel 
          tabManager={tabManager}
          onTabClick={handleTabClick}
          onClose={handleClose}
        />,
        document.body // Mount directly to body for proper positioning
      )}
    </>
  );
};

export default TabManagerButton; 