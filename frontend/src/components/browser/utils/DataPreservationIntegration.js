/**
 * DataPreservationIntegration.js - Integration example for DataPreservationManager
 * 
 * This file demonstrates how to properly integrate the DataPreservationManager
 * into the Voyager browser system to ensure comprehensive data preservation.
 */

import dataPreservationManager from './DataPreservationManager';
import logger from '../../../utils/logger';

// Create a dedicated logger for integration
const integrationLogger = logger.scope('DataPreservationIntegration');

/**
 * Initialize data preservation for the Voyager browser system
 * Call this during application startup
 */
export async function initializeDataPreservation() {
  try {
    integrationLogger.info('🔍 Initializing data preservation system');
    
    // Initialize with production-ready configuration
    await dataPreservationManager.initialize({
      autoSaveInterval: 30000, // Save every 30 seconds
      emergencyPreservationDelay: 1000, // 1 second for emergency saves
      enablePeriodicSave: true,
      enableEventListeners: true
    });
    
    // Set up global reference for other components to access
    window.dataPreservationManager = dataPreservationManager;
    
    integrationLogger.info('✅ Data preservation system initialized successfully');
    
    // Log initial status
    const status = dataPreservationManager.getPreservationStatus();
    integrationLogger.debug('Initial preservation status:', status);
    
    return true;
  } catch (error) {
    integrationLogger.error('❌ Failed to initialize data preservation:', error);
    throw error;
  }
}

/**
 * Integrate with VoyagerLifecycle to enhance existing state saving
 * Call this when initializing browser instances
 */
export function enhanceVoyagerLifecycle(browser) {
  if (!browser || !dataPreservationManager.isInitialized) {
    integrationLogger.warn('Cannot enhance VoyagerLifecycle - missing browser or uninitialized preservation manager');
    return;
  }
  
  integrationLogger.debug(`🔍 Enhancing VoyagerLifecycle for browser ${browser.browserId}`);
  
  // Store original saveStateToStorage method if it exists
  const originalSaveStateToStorage = browser.saveStateToStorage;
  
  // Enhance the saveStateToStorage method
  browser.saveStateToStorage = async (stateSnapshot) => {
    try {
      // Call original method first
      if (originalSaveStateToStorage && typeof originalSaveStateToStorage === 'function') {
        originalSaveStateToStorage.call(browser, stateSnapshot);
      }
      
      // Trigger comprehensive preservation
      await dataPreservationManager.preserveAllData({
        source: 'voyager-lifecycle',
        priority: 'normal'
      });
      
      integrationLogger.debug(`✅ Enhanced state save completed for browser ${browser.browserId}`);
    } catch (error) {
      integrationLogger.warn(`⚠️ Enhanced state save failed for browser ${browser.browserId}:`, error);
      
      // Fallback to original method only
      if (originalSaveStateToStorage && typeof originalSaveStateToStorage === 'function') {
        originalSaveStateToStorage.call(browser, stateSnapshot);
      }
    }
  };
  
  // Add browser to global tracking
  if (!window.voyagerBrowsers) {
    window.voyagerBrowsers = [];
  }
  
  if (!window.voyagerBrowsers.find(b => b.browserId === browser.browserId)) {
    window.voyagerBrowsers.push(browser);
    integrationLogger.debug(`Browser ${browser.browserId} added to global tracking`);
  }
}

/**
 * Integrate with tab management systems
 * Call this when initializing tab managers
 */
export function enhanceTabManagement(tabManager) {
  if (!tabManager || !dataPreservationManager.isInitialized) {
    integrationLogger.warn('Cannot enhance tab management - missing tabManager or uninitialized preservation manager');
    return;
  }
  
  integrationLogger.debug('🔍 Enhancing tab management with data preservation');
  
  // Store original methods
  const originalCaptureState = tabManager.captureState;
  const originalRestoreState = tabManager.restoreState;
  
  // Enhance captureState method
  if (originalCaptureState && typeof originalCaptureState === 'function') {
    tabManager.captureState = async (...args) => {
      try {
        // Call original method
        const result = await originalCaptureState.apply(tabManager, args);
        
        // Trigger preservation of tab states
        await dataPreservationManager.preserveDataType('tabStates');
        
        integrationLogger.debug('✅ Enhanced tab state capture completed');
        return result;
      } catch (error) {
        integrationLogger.warn('⚠️ Enhanced tab state capture failed:', error);
        // Fallback to original method
        return await originalCaptureState.apply(tabManager, args);
      }
    };
  }
  
  // Set up global reference
  window.voyagerTabManager = tabManager;
  
  integrationLogger.debug('✅ Tab management enhancement completed');
}

/**
 * Integrate with webview state management
 * Call this when initializing webview state managers
 */
export function enhanceWebviewStateManagement(webviewStateManager) {
  if (!webviewStateManager || !dataPreservationManager.isInitialized) {
    integrationLogger.warn('Cannot enhance webview state management - missing manager or uninitialized preservation manager');
    return;
  }
  
  integrationLogger.debug('🔍 Enhancing webview state management with data preservation');
  
  // Store original methods
  const originalCaptureState = webviewStateManager.captureState;
  
  // Enhance captureState method
  if (originalCaptureState && typeof originalCaptureState === 'function') {
    webviewStateManager.captureState = async (...args) => {
      try {
        // Call original method
        const result = await originalCaptureState.apply(webviewStateManager, args);
        
        // Trigger preservation of webview states
        await dataPreservationManager.preserveDataType('webviewStates');
        
        integrationLogger.debug('✅ Enhanced webview state capture completed');
        return result;
      } catch (error) {
        integrationLogger.warn('⚠️ Enhanced webview state capture failed:', error);
        // Fallback to original method
        return await originalCaptureState.apply(webviewStateManager, args);
      }
    };
  }
  
  // Set up global reference
  window.webviewStateManager = webviewStateManager;
  
  integrationLogger.debug('✅ Webview state management enhancement completed');
}

/**
 * Set up preservation triggers for bookmark and history changes
 * Call this when initializing bookmark and history managers
 */
export function enhanceBookmarkAndHistoryManagement() {
  if (!dataPreservationManager.isInitialized) {
    integrationLogger.warn('Cannot enhance bookmark/history management - uninitialized preservation manager');
    return;
  }
  
  integrationLogger.debug('🔍 Enhancing bookmark and history management');
  
  // Create enhanced bookmark save function
  window.enhancedBookmarkSave = async (bookmarks) => {
    try {
      // Trigger bookmark preservation
      await dataPreservationManager.preserveDataType('bookmarks');
      integrationLogger.debug('✅ Enhanced bookmark save completed');
    } catch (error) {
      integrationLogger.warn('⚠️ Enhanced bookmark save failed:', error);
    }
  };
  
  // Create enhanced history save function
  window.enhancedHistorySave = async (history, historyIndex) => {
    try {
      // Trigger history preservation
      await dataPreservationManager.preserveDataType('history');
      integrationLogger.debug('✅ Enhanced history save completed');
    } catch (error) {
      integrationLogger.warn('⚠️ Enhanced history save failed:', error);
    }
  };
  
  integrationLogger.debug('✅ Bookmark and history management enhancement completed');
}

/**
 * Set up manual preservation triggers for user actions
 * Call this to set up manual preservation controls
 */
export function setupManualPreservationControls() {
  if (!dataPreservationManager.isInitialized) {
    integrationLogger.warn('Cannot setup manual controls - uninitialized preservation manager');
    return;
  }
  
  integrationLogger.debug('🔍 Setting up manual preservation controls');
  
  // Create global functions for manual preservation
  window.preserveAllData = async () => {
    try {
      integrationLogger.info('🚨 Manual preservation triggered');
      const result = await dataPreservationManager.forcePreservation();
      integrationLogger.info('✅ Manual preservation completed:', result);
      return result;
    } catch (error) {
      integrationLogger.error('❌ Manual preservation failed:', error);
      throw error;
    }
  };
  
  window.getPreservationStatus = () => {
    return dataPreservationManager.getPreservationStatus();
  };
  
  // Set up keyboard shortcut for manual preservation (Ctrl+Shift+S)
  document.addEventListener('keydown', async (event) => {
    if (event.ctrlKey && event.shiftKey && event.key === 'S') {
      event.preventDefault();
      try {
        integrationLogger.info('🔍 Keyboard shortcut preservation triggered');
        await window.preserveAllData();
        
        // Show user feedback (if notification system is available)
        if (window.showNotification) {
          window.showNotification('Data preserved successfully', 'success');
        } else {
          console.log('✅ Data preserved successfully');
        }
      } catch (error) {
        integrationLogger.error('❌ Keyboard shortcut preservation failed:', error);
        
        if (window.showNotification) {
          window.showNotification('Data preservation failed', 'error');
        } else {
          console.error('❌ Data preservation failed:', error);
        }
      }
    }
  });
  
  integrationLogger.debug('✅ Manual preservation controls set up successfully');
}

/**
 * Clean up data preservation system
 * Call this during application shutdown
 */
export async function cleanupDataPreservation() {
  try {
    integrationLogger.info('🔍 Cleaning up data preservation system');
    
    // Perform final preservation before cleanup
    if (dataPreservationManager.isInitialized) {
      await dataPreservationManager.forcePreservation();
      dataPreservationManager.cleanup();
    }
    
    // Clean up global references
    delete window.dataPreservationManager;
    delete window.voyagerBrowsers;
    delete window.voyagerTabManager;
    delete window.webviewStateManager;
    delete window.preserveAllData;
    delete window.getPreservationStatus;
    delete window.enhancedBookmarkSave;
    delete window.enhancedHistorySave;
    
    integrationLogger.info('✅ Data preservation cleanup completed');
  } catch (error) {
    integrationLogger.error('❌ Data preservation cleanup failed:', error);
    throw error;
  }
}

/**
 * Complete integration setup for Voyager browser system
 * Call this during application initialization
 */
export async function setupCompleteDataPreservation(options = {}) {
  try {
    integrationLogger.info('🚨 Setting up complete data preservation integration');
    
    // Initialize the preservation system
    await initializeDataPreservation();
    
    // Set up manual controls
    setupManualPreservationControls();
    
    // Enhance bookmark and history management
    enhanceBookmarkAndHistoryManagement();
    
    // Set up integration hooks for when components are initialized
    window.enhanceVoyagerLifecycle = enhanceVoyagerLifecycle;
    window.enhanceTabManagement = enhanceTabManagement;
    window.enhanceWebviewStateManagement = enhanceWebviewStateManagement;
    
    integrationLogger.info('✅ Complete data preservation integration setup completed');
    
    // Return status for verification
    return dataPreservationManager.getPreservationStatus();
  } catch (error) {
    integrationLogger.error('❌ Complete data preservation setup failed:', error);
    throw error;
  }
}

// Export all integration functions
export {
  dataPreservationManager
}; 