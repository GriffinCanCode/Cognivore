/**
 * TabBarRenderer - Handles rendering and management of the browser tab bar
 * Delegates to existing TabBar component and TabManager instead of duplicating functionality
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import TabBar from '../tabs/TabBar.js';

/**
 * Create tab bar container and render TabBar component
 * @param {Object} browser - Browser instance
 * @param {Object} tabManager - Tab manager instance
 * @returns {HTMLElement} Tab bar container element
 */
export function createTabBarContainer(browser, tabManager) {
  // Create tab bar wrapper container - React will mount directly here
  const tabBarContainer = document.createElement('div');
  tabBarContainer.className = 'voyager-tab-bar-wrapper';
  
  // Minimal styling - let CSS handle the rest
  // Remove redundant inline styles that might conflict with CSS
  
  // Store references - no need for separate React container
  browser.tabBarContainer = tabBarContainer;
  browser.tabBarReactContainer = tabBarContainer; // Same container for compatibility
  
  // Set up tab bar rendering directly in wrapper
  setupTabBarRendering(browser, tabManager, tabBarContainer);
  
  return tabBarContainer;
}

/**
 * Set up React rendering for the TabBar component
 * CRITICAL FIX: Defer React root creation to prevent DOM insertion conflicts
 * @param {Object} browser - Browser instance
 * @param {Object} tabManager - Tab manager instance
 * @param {HTMLElement} container - React container element
 */
function setupTabBarRendering(browser, tabManager, container) {
  // Store rendering setup for later execution
  const setupReactRendering = () => {
    // Create React root for the tab bar
    let reactRoot = null;
    
    try {
      // Use createRoot for React 18 compatibility
      reactRoot = ReactDOM.createRoot(container);
      container._reactRoot = reactRoot;
      console.log('TabBar React root created successfully');
    } catch (error) {
      console.error('Error creating TabBar React root:', error);
      createFallbackTabBar(browser, container);
      return;
    }
    
    // Render function that properly delegates to TabBar component
    const renderTabBar = () => {
      if (!reactRoot || !tabManager) return;
      
      try {
        // Get the internal TabManager if we have a VoyagerTabManager
        const internalTabManager = (typeof tabManager.getTabManager === 'function') 
          ? tabManager.getTabManager() 
          : tabManager;
        
        // Create handlers that delegate to browser methods
        const handleTabClick = async (tabId) => {
          try {
            // First try VoyagerTabManager's switchToTab if available
            if (tabManager && typeof tabManager.switchToTab === 'function') {
              await tabManager.switchToTab(tabId);
            } else if (internalTabManager && typeof internalTabManager.setActiveTab === 'function') {
              internalTabManager.setActiveTab(tabId);
              
              // Get tab data for navigation if VoyagerTabManager not available
              const tab = internalTabManager.getTabById(tabId);
              if (tab && tab.url && browser.navigate) {
                browser.navigate(tab.url);
              }
            }
          } catch (err) {
            console.warn('Error in tab click handler:', err);
          }
        };
        
        const handleTabClose = (tabId) => {
          try {
            if (tabManager && typeof tabManager.closeTab === 'function') {
              tabManager.closeTab(tabId);
            } else if (internalTabManager && typeof internalTabManager.closeTab === 'function') {
              internalTabManager.closeTab(tabId);
            }
          } catch (err) {
            console.warn('Error in tab close handler:', err);
          }
        };
        
        const handleNewTab = () => {
          try {
            if (tabManager && typeof tabManager.createTab === 'function') {
              tabManager.createTab();
            } else if (internalTabManager && typeof internalTabManager.createTab === 'function') {
              internalTabManager.createTab({
                url: 'https://www.google.com',
                title: 'New Tab',
                active: true
              });
            }
          } catch (err) {
            console.warn('Error in new tab handler:', err);
          }
        };
        
        // Get current active tab ID
        const activeTabId = browser?.activeTabId || internalTabManager?.getActiveTabId() || null;
        
        // Render TabBar component with proper delegation
        reactRoot.render(
          React.createElement(TabBar, {
            tabManager: internalTabManager,
            activeTabId: activeTabId,
            onTabClick: handleTabClick,
            onTabClose: handleTabClose,
            onNewTab: handleNewTab
          })
        );
        
        console.log('TabBar component rendered successfully via delegation');
        
      } catch (error) {
        console.error('Error rendering TabBar component:', error);
        createFallbackTabBar(browser, container);
      }
    };
    
    // Set up tab manager event listener for updates
    // Support both VoyagerTabManager and direct TabManager
    const internalTabManager = (typeof tabManager.getTabManager === 'function') 
      ? tabManager.getTabManager() 
      : tabManager;
      
    if (internalTabManager && typeof internalTabManager.addListener === 'function') {
      internalTabManager.addListener(() => {
        renderTabBar();
      });
    }
    
    // Store render function for manual updates
    browser._renderTabBar = renderTabBar;
    
    // CRITICAL FIX: Only render immediately if React rendering is not deferred
    if (!browser._deferReactRendering) {
      // Initial render (only if not deferred)
      renderTabBar();
    } else {
      console.log('TabBar rendering deferred until main browser setup completes');
    }
  };
  
  // CRITICAL FIX: Check if React rendering should be deferred
  if (browser._deferReactRendering) {
    // Store the setup function for later execution
    browser._setupTabBarReactRendering = setupReactRendering;
    console.log('TabBar React rendering setup stored for later execution');
    
    // Create placeholder content
    createTabBarPlaceholder(container);
  } else {
    // Execute immediately if not deferred
    setupReactRendering();
  }
}

/**
 * Create placeholder content for tab bar while React is deferred
 * @param {HTMLElement} container - Container element
 */
function createTabBarPlaceholder(container) {
  // Clear container
  container.innerHTML = '';
  
  // Create placeholder tab
  const placeholderTab = document.createElement('div');
  placeholderTab.className = 'tab-item placeholder';
  placeholderTab.innerHTML = `<span>⏳ Initializing...</span>`;
  
  container.appendChild(placeholderTab);
}

/**
 * Create fallback tab bar when React rendering fails
 * @param {Object} browser - Browser instance  
 * @param {HTMLElement} container - Container element
 */
function createFallbackTabBar(browser, container) {
  console.warn('Creating fallback tab bar due to React rendering failure');
  
  // Clear container
  container.innerHTML = '';
  
  // Create fallback tab with improved styling and functionality
  const fallbackTab = document.createElement('div');
  fallbackTab.className = 'tab-item active fallback';
  fallbackTab.innerHTML = `
    <span class="tab-favicon-placeholder">🌐</span>
    <span class="tab-title">New Tab</span>
    <button class="tab-close-btn" onclick="event.stopPropagation();">×</button>
  `;
  
  // Add click handler for fallback tab
  fallbackTab.addEventListener('click', () => {
    console.log('Fallback tab clicked');
    if (browser && typeof browser.navigate === 'function') {
      browser.navigate('https://www.google.com');
    }
  });
  
  container.appendChild(fallbackTab);
  
  // Enhanced "+" button for new tab with better functionality
  const fallbackNewTab = document.createElement('button');
  fallbackNewTab.className = 'new-tab-button fallback';
  fallbackNewTab.innerHTML = '+';
  
  // Add click handler for new tab button
  fallbackNewTab.addEventListener('click', () => {
    console.log('Fallback new tab button clicked');
    if (browser && typeof browser.navigate === 'function') {
      browser.navigate('https://www.google.com');
    }
  });
  
  // Add hover effects using classes instead of inline styles
  fallbackNewTab.addEventListener('mouseenter', () => {
    fallbackNewTab.classList.add('hover');
  });
  
  fallbackNewTab.addEventListener('mouseleave', () => {
    fallbackNewTab.classList.remove('hover');
  });
  
  container.appendChild(fallbackNewTab);
}

/**
 * Update tab bar manually (for cases where automatic updates don't work)
 * @param {Object} browser - Browser instance
 */
export function updateTabBar(browser) {
  if (browser._renderTabBar && typeof browser._renderTabBar === 'function') {
    browser._renderTabBar();
  }
} 