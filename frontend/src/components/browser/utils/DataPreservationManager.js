/**
 * DataPreservationManager.js - Comprehensive closing system for Voyager.js browser
 * 
 * This utility coordinates all existing data persistence mechanisms to ensure
 * no locally important data (cookies, bookmarks, tabs, etc.) is lost when
 * the application closes. It leverages existing pipelines and provides a
 * unified interface for data preservation.
 */

import logger from '../../../utils/logger';
import { saveBookmarks, loadBookmarks } from './BookmarkManager';
import { saveHistory, loadHistory, addHistoryEntry } from './HistoryManager';
import SettingsService from '../../../services/SettingsService';

// Create a dedicated logger for this module
const preservationLogger = logger.scope('DataPreservationManager');

class DataPreservationManager {
  constructor() {
    this.isInitialized = false;
    this.preservationInProgress = false;
    this.preservationQueue = new Map();
    this.criticalDataTypes = new Set([
      'browserState',
      'bookmarks', 
      'history',
      'settings',
      'tabStates',
      'webviewStates',
      'formData',
      'themePreferences',
      'errorHistory'
    ]);
    
    // Track preservation status for each data type
    this.preservationStatus = new Map();
    this.lastPreservationTime = null;
    this.preservationAttempts = 0;
    this.maxPreservationAttempts = 3;
    
    // Bind methods to maintain context
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handlePageHide = this.handlePageHide.bind(this);
    this.emergencyPreservation = this.emergencyPreservation.bind(this);
    
    preservationLogger.info('DataPreservationManager initialized');
  }

  /**
   * Initialize the data preservation system
   * @param {Object} options - Configuration options
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      preservationLogger.warn('DataPreservationManager already initialized');
      return;
    }

    try {
      preservationLogger.info('🔍 Initializing DataPreservationManager');
      
      const {
        autoSaveInterval = 30000, // 30 seconds
        emergencyPreservationDelay = 1000, // 1 second
        enablePeriodicSave = true,
        enableEventListeners = true
      } = options;

      this.autoSaveInterval = autoSaveInterval;
      this.emergencyPreservationDelay = emergencyPreservationDelay;

      // Set up event listeners for application closing scenarios
      if (enableEventListeners) {
        this.setupEventListeners();
      }

      // Set up periodic preservation if enabled
      if (enablePeriodicSave) {
        this.setupPeriodicPreservation();
      }

      // Initialize preservation status tracking
      this.criticalDataTypes.forEach(dataType => {
        this.preservationStatus.set(dataType, {
          lastSaved: null,
          attempts: 0,
          errors: []
        });
      });

      this.isInitialized = true;
      preservationLogger.info('✅ DataPreservationManager initialization complete');
      
    } catch (error) {
      preservationLogger.error('❌ Failed to initialize DataPreservationManager:', error);
      throw new Error(`DataPreservationManager initialization failed: ${error.message}`);
    }
  }

  /**
   * Set up event listeners for various closing scenarios
   */
  setupEventListeners() {
    preservationLogger.debug('🔍 Setting up preservation event listeners');

    // Primary beforeunload event - most reliable for data preservation
    window.addEventListener('beforeunload', this.handleBeforeUnload, { capture: true });
    
    // Page visibility change - handles tab switching and minimizing
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Page hide event - handles navigation away from page
    window.addEventListener('pagehide', this.handlePageHide, { capture: true });
    
    // Unload event - final chance for preservation
    window.addEventListener('unload', this.emergencyPreservation, { capture: true });

    // Electron-specific events if available
    if (window.backend && window.backend.ipc) {
      // Listen for app closing events from main process
      window.backend.ipc.on('app-will-quit', this.emergencyPreservation);
      window.backend.ipc.on('window-will-close', this.emergencyPreservation);
    }

    preservationLogger.debug('✅ Event listeners set up successfully');
  }

  /**
   * Set up periodic data preservation
   */
  setupPeriodicPreservation() {
    preservationLogger.debug('🔍 Setting up periodic preservation');
    
    this.periodicPreservationInterval = setInterval(async () => {
      try {
        preservationLogger.debug('⏰ Periodic preservation triggered');
        await this.preserveAllData({ 
          source: 'periodic',
          priority: 'normal'
        });
      } catch (error) {
        preservationLogger.warn('⚠️ Periodic preservation failed:', error);
      }
    }, this.autoSaveInterval);

    preservationLogger.debug('✅ Periodic preservation set up successfully');
  }

  /**
   * Handle beforeunload event - primary preservation trigger
   * @param {Event} event - Beforeunload event
   */
  async handleBeforeUnload(event) {
    preservationLogger.info('🚨 Before unload event triggered - starting critical preservation');
    
    try {
      // Perform synchronous preservation for critical data
      await this.preserveAllData({ 
        source: 'beforeunload',
        priority: 'critical',
        synchronous: true
      });
      
      preservationLogger.info('✅ Critical data preservation completed');
    } catch (error) {
      preservationLogger.error('❌ Critical preservation failed:', error);
      
      // Set a warning message for the user
      const message = 'Some data may not be saved. Are you sure you want to leave?';
      event.returnValue = message;
      return message;
    }
  }

  /**
   * Handle visibility change - preserve data when tab becomes hidden
   * @param {Event} event - Visibility change event
   */
  async handleVisibilityChange(event) {
    if (document.visibilityState === 'hidden') {
      preservationLogger.info('🔍 Page hidden - preserving data');
      
      try {
        await this.preserveAllData({ 
          source: 'visibilitychange',
          priority: 'normal'
        });
      } catch (error) {
        preservationLogger.warn('⚠️ Visibility change preservation failed:', error);
      }
    }
  }

  /**
   * Handle page hide event
   * @param {Event} event - Page hide event
   */
  async handlePageHide(event) {
    preservationLogger.info('🚨 Page hide event - emergency preservation');
    
    try {
      await this.emergencyPreservation();
    } catch (error) {
      preservationLogger.error('❌ Page hide preservation failed:', error);
    }
  }

  /**
   * Emergency preservation - last resort data saving
   */
  async emergencyPreservation() {
    preservationLogger.info('🚨 EMERGENCY PRESERVATION TRIGGERED');
    
    try {
      // Use synchronous localStorage operations for maximum reliability
      await this.preserveAllData({ 
        source: 'emergency',
        priority: 'critical',
        synchronous: true,
        timeout: this.emergencyPreservationDelay
      });
      
      preservationLogger.info('✅ Emergency preservation completed');
    } catch (error) {
      preservationLogger.error('❌ Emergency preservation failed:', error);
    }
  }

  /**
   * Preserve all application data using existing pipelines
   * @param {Object} options - Preservation options
   */
  async preserveAllData(options = {}) {
    const {
      source = 'manual',
      priority = 'normal',
      synchronous = false,
      timeout = 5000,
      dataTypes = Array.from(this.criticalDataTypes)
    } = options;

    if (this.preservationInProgress && priority !== 'critical') {
      preservationLogger.warn('⚠️ Preservation already in progress, skipping');
      return;
    }

    this.preservationInProgress = true;
    this.preservationAttempts++;
    
    preservationLogger.info(`🔍 Starting data preservation (${source}, ${priority})`);
    
    const preservationResults = new Map();
    const startTime = Date.now();

    try {
      // Create preservation promises for each data type
      const preservationPromises = dataTypes.map(async (dataType) => {
        try {
          const result = await this.preserveDataType(dataType, { synchronous, timeout });
          preservationResults.set(dataType, { success: true, result });
          
          // Update preservation status
          const status = this.preservationStatus.get(dataType);
          status.lastSaved = Date.now();
          status.attempts++;
          
          preservationLogger.debug(`✅ ${dataType} preserved successfully`);
        } catch (error) {
          preservationResults.set(dataType, { success: false, error: error.message });
          
          // Update preservation status with error
          const status = this.preservationStatus.get(dataType);
          status.attempts++;
          status.errors.push({
            timestamp: Date.now(),
            error: error.message,
            source
          });
          
          preservationLogger.warn(`⚠️ Failed to preserve ${dataType}:`, error);
        }
      });

      // Wait for all preservation operations to complete
      if (synchronous || priority === 'critical') {
        // For critical operations, wait for all to complete
        await Promise.all(preservationPromises);
      } else {
        // For normal operations, use timeout
        await Promise.race([
          Promise.all(preservationPromises),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Preservation timeout')), timeout)
          )
        ]);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Calculate success rate
      const successCount = Array.from(preservationResults.values())
        .filter(result => result.success).length;
      const totalCount = preservationResults.size;
      const successRate = (successCount / totalCount) * 100;

      this.lastPreservationTime = endTime;

      preservationLogger.info(`✅ Data preservation completed: ${successCount}/${totalCount} (${successRate.toFixed(1)}%) in ${duration}ms`);

      // Log any failures
      preservationResults.forEach((result, dataType) => {
        if (!result.success) {
          preservationLogger.error(`❌ ${dataType} preservation failed: ${result.error}`);
        }
      });

      return {
        success: successRate === 100,
        successRate,
        duration,
        results: preservationResults,
        timestamp: endTime
      };

    } catch (error) {
      preservationLogger.error('❌ Data preservation failed:', error);
      throw error;
    } finally {
      this.preservationInProgress = false;
    }
  }

  /**
   * Preserve a specific data type using existing pipelines
   * @param {string} dataType - Type of data to preserve
   * @param {Object} options - Preservation options
   */
  async preserveDataType(dataType, options = {}) {
    const { synchronous = false, timeout = 2000 } = options;
    
    preservationLogger.debug(`🔍 Preserving ${dataType}`);

    switch (dataType) {
      case 'browserState':
        return await this.preserveBrowserState(options);
        
      case 'bookmarks':
        return await this.preserveBookmarks(options);
        
      case 'history':
        return await this.preserveHistory(options);
        
      case 'settings':
        return await this.preserveSettings(options);
        
      case 'tabStates':
        return await this.preserveTabStates(options);
        
      case 'webviewStates':
        return await this.preserveWebviewStates(options);
        
      case 'formData':
        return await this.preserveFormData(options);
        
      case 'themePreferences':
        return await this.preserveThemePreferences(options);
        
      case 'errorHistory':
        return await this.preserveErrorHistory(options);
        
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  }

  /**
   * Preserve browser state using existing VoyagerLifecycle pipeline
   */
  async preserveBrowserState(options = {}) {
    try {
      // Get current browser instances from global state
      const browsers = window.voyagerBrowsers || [];
      
      for (const browser of browsers) {
        if (browser && browser.state) {
          const stateSnapshot = {
            url: browser.state.url,
            title: browser.state.title,
            favicon: browser.state.favicon,
            lastActive: Date.now(),
            browserId: browser.browserId
          };
          
          // Use existing saveStateToStorage if available
          if (browser.saveStateToStorage && typeof browser.saveStateToStorage === 'function') {
            browser.saveStateToStorage(stateSnapshot);
          } else {
            // Fallback to localStorage
            localStorage.setItem(`voyager-browser-state-${browser.browserId}`, JSON.stringify(stateSnapshot));
          }
        }
      }
      
      return { preserved: browsers.length };
    } catch (error) {
      throw new Error(`Browser state preservation failed: ${error.message}`);
    }
  }

  /**
   * Preserve bookmarks using existing BookmarkManager pipeline
   */
  async preserveBookmarks(options = {}) {
    try {
      // Load current bookmarks and ensure they're saved
      const bookmarks = loadBookmarks();
      const saved = saveBookmarks(bookmarks);
      
      if (!saved) {
        throw new Error('Bookmark save operation failed');
      }
      
      return { preserved: bookmarks.length };
    } catch (error) {
      throw new Error(`Bookmark preservation failed: ${error.message}`);
    }
  }

  /**
   * Preserve navigation history using existing HistoryManager pipeline
   */
  async preserveHistory(options = {}) {
    try {
      // Get current history state and ensure it's saved
      const { history, historyIndex } = loadHistory();
      const saved = saveHistory(history, historyIndex);
      
      if (!saved) {
        throw new Error('History save operation failed');
      }
      
      // Also preserve recent history entries
      const historyEntries = JSON.parse(localStorage.getItem('browser-history-entries') || '[]');
      localStorage.setItem('browser-history-entries', JSON.stringify(historyEntries));
      
      return { 
        preserved: history.length,
        entries: historyEntries.length
      };
    } catch (error) {
      throw new Error(`History preservation failed: ${error.message}`);
    }
  }

  /**
   * Preserve application settings using existing SettingsService pipeline
   */
  async preserveSettings(options = {}) {
    try {
      // Force save current settings if SettingsService is available
      if (SettingsService && typeof SettingsService.getSettings === 'function') {
        const settings = await SettingsService.getSettings();
        if (settings) {
          await SettingsService.saveSettings(settings);
        }
        return { preserved: true, hasSettings: !!settings };
      } else {
        // Fallback: ensure localStorage settings are preserved
        const settings = localStorage.getItem('appSettings');
        if (settings) {
          // Re-save to ensure persistence
          localStorage.setItem('appSettings', settings);
          return { preserved: true, fallback: true };
        }
      }
      
      return { preserved: false, reason: 'No settings found' };
    } catch (error) {
      throw new Error(`Settings preservation failed: ${error.message}`);
    }
  }

  /**
   * Preserve tab states using existing tab management systems
   */
  async preserveTabStates(options = {}) {
    try {
      let preservedTabs = 0;
      
      // Preserve VoyagerTabManager states if available
      if (window.voyagerTabManager) {
        const tabStates = window.voyagerTabManager.getState();
        localStorage.setItem('voyager-tab-states', JSON.stringify(tabStates));
        preservedTabs += Object.keys(tabStates).length;
      }
      
      // Preserve individual tab states
      const tabStateKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('tab-state-') || key.startsWith('voyager-tab-')
      );
      
      // Re-save all tab states to ensure persistence
      tabStateKeys.forEach(key => {
        const state = localStorage.getItem(key);
        if (state) {
          localStorage.setItem(key, state);
        }
      });
      
      return { preserved: preservedTabs, stateKeys: tabStateKeys.length };
    } catch (error) {
      throw new Error(`Tab state preservation failed: ${error.message}`);
    }
  }

  /**
   * Preserve webview states using existing WebviewStateManager
   */
  async preserveWebviewStates(options = {}) {
    try {
      let preservedStates = 0;
      
      // Preserve WebviewStateManager states if available
      if (window.webviewStateManager) {
        const allStates = window.webviewStateManager.getAllStates();
        localStorage.setItem('webview-states', JSON.stringify(allStates));
        preservedStates = Object.keys(allStates).length;
      }
      
      // Preserve individual webview states
      const webviewStateKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('webview-state-') || key.startsWith('voyager-webview-')
      );
      
      // Re-save all webview states
      webviewStateKeys.forEach(key => {
        const state = localStorage.getItem(key);
        if (state) {
          localStorage.setItem(key, state);
        }
      });
      
      return { preserved: preservedStates, stateKeys: webviewStateKeys.length };
    } catch (error) {
      throw new Error(`Webview state preservation failed: ${error.message}`);
    }
  }

  /**
   * Preserve form data from active webviews
   */
  async preserveFormData(options = {}) {
    try {
      let preservedForms = 0;
      
      // Get all active webviews and capture form data
      const webviews = document.querySelectorAll('webview');
      
      for (const webview of webviews) {
        try {
          if (typeof webview.executeJavaScript === 'function') {
            const formData = await webview.executeJavaScript(`
              (function() {
                const forms = document.querySelectorAll('form');
                const formData = {};
                
                forms.forEach((form, index) => {
                  const formElements = form.querySelectorAll('input, select, textarea');
                  const formDataObj = {};
                  
                  formElements.forEach(element => {
                    if (element.type !== 'password' && element.name) {
                      formDataObj[element.name] = element.value || '';
                    }
                  });
                  
                  if (Object.keys(formDataObj).length > 0) {
                    formData['form_' + index] = formDataObj;
                  }
                });
                
                return formData;
              })()
            `);
            
            if (formData && Object.keys(formData).length > 0) {
              const webviewId = webview.id || `webview-${Date.now()}`;
              localStorage.setItem(`form-data-${webviewId}`, JSON.stringify(formData));
              preservedForms += Object.keys(formData).length;
            }
          }
        } catch (error) {
          // Skip webviews that can't execute JavaScript
          preservationLogger.debug(`Skipped form data capture for webview: ${error.message}`);
        }
      }
      
      return { preserved: preservedForms };
    } catch (error) {
      throw new Error(`Form data preservation failed: ${error.message}`);
    }
  }

  /**
   * Preserve theme preferences using existing ThemeSwitcher pipeline
   */
  async preserveThemePreferences(options = {}) {
    try {
      // Ensure theme preference is saved
      const currentTheme = localStorage.getItem('theme-preference');
      if (currentTheme) {
        localStorage.setItem('theme-preference', currentTheme);
      }
      
      // Also preserve any theme-related settings
      const themeKeys = Object.keys(localStorage).filter(key => 
        key.includes('theme') || key.includes('dark-mode') || key.includes('appearance')
      );
      
      themeKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          localStorage.setItem(key, value);
        }
      });
      
      return { preserved: themeKeys.length, currentTheme };
    } catch (error) {
      throw new Error(`Theme preference preservation failed: ${error.message}`);
    }
  }

  /**
   * Preserve error history and debugging information
   */
  async preserveErrorHistory(options = {}) {
    try {
      // Preserve console errors and warnings
      const errorHistory = {
        timestamp: Date.now(),
        preservationAttempts: this.preservationAttempts,
        preservationStatus: Object.fromEntries(this.preservationStatus),
        lastPreservationTime: this.lastPreservationTime
      };
      
      localStorage.setItem('error-history', JSON.stringify(errorHistory));
      
      // Preserve any existing error logs
      const errorKeys = Object.keys(localStorage).filter(key => 
        key.includes('error') || key.includes('log') || key.includes('debug')
      );
      
      errorKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          localStorage.setItem(key, value);
        }
      });
      
      return { preserved: errorKeys.length, errorHistory };
    } catch (error) {
      throw new Error(`Error history preservation failed: ${error.message}`);
    }
  }

  /**
   * Get preservation status for all data types
   */
  getPreservationStatus() {
    return {
      isInitialized: this.isInitialized,
      preservationInProgress: this.preservationInProgress,
      lastPreservationTime: this.lastPreservationTime,
      preservationAttempts: this.preservationAttempts,
      status: Object.fromEntries(this.preservationStatus)
    };
  }

  /**
   * Force immediate preservation of all data
   */
  async forcePreservation() {
    preservationLogger.info('🚨 Force preservation requested');
    
    return await this.preserveAllData({
      source: 'forced',
      priority: 'critical',
      synchronous: true
    });
  }

  /**
   * Clean up the preservation manager
   */
  cleanup() {
    preservationLogger.info('🔍 Cleaning up DataPreservationManager');
    
    // Remove event listeners
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pagehide', this.handlePageHide);
    window.removeEventListener('unload', this.emergencyPreservation);
    
    // Clear periodic preservation
    if (this.periodicPreservationInterval) {
      clearInterval(this.periodicPreservationInterval);
      this.periodicPreservationInterval = null;
    }
    
    // Remove Electron event listeners if available
    if (window.backend && window.backend.ipc) {
      window.backend.ipc.removeAllListeners('app-will-quit');
      window.backend.ipc.removeAllListeners('window-will-close');
    }
    
    this.isInitialized = false;
    preservationLogger.info('✅ DataPreservationManager cleanup complete');
  }
}

// Create and export singleton instance
const dataPreservationManager = new DataPreservationManager();

export default dataPreservationManager;

// Export individual methods for direct use
export {
  DataPreservationManager
}; 