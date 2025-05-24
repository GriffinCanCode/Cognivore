/**
 * TabManagerButton.js - Button for opening and managing the tab manager
 * 
 * This component provides a button to open the tab management interface
 * and handles the integration with the Voyager browser.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import TabManagerPanel from './TabManagerPanel';

// Error boundary component for tab manager
class TabManagerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('TabManager Error Boundary caught an error:', error, errorInfo);
    
    // Report error to monitoring service if available
    if (window.errorTracker && typeof window.errorTracker.captureException === 'function') {
      window.errorTracker.captureException(error, {
        tags: { component: 'TabManager' },
        extra: errorInfo
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <div className="tab-manager-error" style={{
          padding: '16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '4px',
          color: '#dc2626'
        }}>
          <h3>Tab Manager Error</h3>
          <p>Something went wrong with the tab manager. Please refresh the page.</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const TabManagerButton = ({ voyager, tabManager }) => {
  // Use reference to store initial state rather than useState to prevent mount warning
  const isOpenRef = useRef(false);
  // Declare state after ref is initialized 
  const [isOpen, setIsOpen] = useState(false);
  const isMountedRef = useRef(false);
  const [portalTarget, setPortalTarget] = useState(null);
  const [hasError, setHasError] = useState(false);
  
  // Set mounted flag on mount
  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    
    // CRITICAL FIX: Wait for DOM to be stable before setting portal target
    // Add additional delay to ensure complete DOM stabilization
    const checkPortalTarget = () => {
      if (document.body && document.body.isConnected) {
        // CRITICAL FIX: Add a short delay before enabling portal to ensure DOM is completely stable
        setTimeout(() => {
          if (isMountedRef.current) {
            setPortalTarget(document.body);
            setHasError(false);
          }
        }, 100); // 100ms delay to ensure DOM stability
      } else {
        // Retry after a short delay if body is not ready
        setTimeout(checkPortalTarget, 100);
      }
    };
    
    // Start checking after a brief initial delay
    setTimeout(checkPortalTarget, 50);
    
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
  
  // Toggle panel visibility with error handling
  const togglePanel = () => {
    if (isMountedRef.current && !hasError) {
      try {
        const newState = !isOpen;
        isOpenRef.current = newState;
        setIsOpen(newState);
      } catch (error) {
        console.error('Error toggling tab manager panel:', error);
        setHasError(true);
      }
    }
  };
  
  // Handle click outside panel to close it
  const handleClickOutside = (e) => {
    // Only process if panel is open and component is mounted
    if (isOpenRef.current && isMountedRef.current && !hasError) {
      try {
        const panelButton = document.querySelector('.tab-manager-button');
        const panelElement = document.querySelector('.tab-manager-panel');
        
        // Check if click was outside both button and panel
        if (panelButton && !panelButton.contains(e.target) && 
            panelElement && !panelElement.contains(e.target)) {
          isOpenRef.current = false;
          setIsOpen(false);
        }
      } catch (error) {
        console.warn('Error in handleClickOutside:', error);
        setHasError(true);
      }
    }
  };
  
  // Add click listener when panel is open
  useEffect(() => {
    if (isOpen && !hasError) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, hasError]);
  
  // Handle tab click from tab manager with error handling
  const handleTabClick = (tabId) => {
    try {
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
    } catch (error) {
      console.error('Error handling tab click:', error);
      setHasError(true);
    }
  };
  
  // Safe close handler
  const handleClose = () => {
    try {
      if (isMountedRef.current) {
        isOpenRef.current = false;
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Error closing tab manager panel:', error);
      setHasError(true);
    }
  };
  
  // Add debugging log for render
  console.log('Rendering TabManagerButton, isOpen:', isOpen);
  
  // Don't render if not mounted, no portal target, or has error
  if (!isMountedRef.current || !portalTarget || hasError) {
    // Show error state or loading state
    if (hasError) {
      return (
        <div className="tab-manager-error" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '32px', height: '32px', color: '#ff6b6b', fontSize: '12px'
        }}>
          <button 
            onClick={() => {
              console.log('Retrying TabManagerButton after error');
              setHasError(false);
              setIsOpen(false);
              isOpenRef.current = false;
            }}
            style={{
              background: 'none', border: 'none', color: 'inherit', 
              cursor: 'pointer', padding: '2px'
            }}
            title="Click to retry"
          >
            ⚠️
          </button>
        </div>
      );
    }
    return null;
  }
  
  // Render tab manager button and panel with error boundary
  return (
    <TabManagerErrorBoundary>
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
        
        {/* Render panel conditionally when open and portal target is available */}
        {isOpen && tabManager && portalTarget && (() => {
          try {
            // CRITICAL FIX: Additional safety checks before creating portal
            if (!document.body.contains(portalTarget)) {
              console.warn('Portal target is no longer in DOM, skipping portal creation');
              return null;
            }
            
            // Check if React is ready for portal creation
            if (typeof createPortal !== 'function') {
              console.warn('createPortal is not available, cannot create portal');
              return null;
            }
            
            return createPortal(
              <TabManagerErrorBoundary>
                <TabManagerPanel 
                  tabManager={tabManager} 
                  voyager={voyager}
                  onClose={handleClose}
                />
              </TabManagerErrorBoundary>,
              portalTarget
            );
          } catch (error) {
            console.error('Error creating portal for TabManagerPanel:', error);
            
            // Set error state to prevent future attempts
            if (isMountedRef.current) {
              setHasError(true);
            }
            
            return null;
          }
        })()}
      </div>
    </TabManagerErrorBoundary>
  );
};

export default TabManagerButton; 