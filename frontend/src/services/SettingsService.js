/**
 * SettingsService - Handles settings management and persistence
 */
import logger from '../utils/logger.js';

// Create context-specific logger
const settingsLogger = logger.scope('SettingsService');

/**
 * Initialize the settings service
 */
async function initSettingsService() {
  settingsLogger.info('Initializing SettingsService');
  console.log('Initializing SettingsService');
  
  // Determine if running in Electron or browser
  const isElectron = window.backend && window.backend.isElectron;
  settingsLogger.debug(`Running in ${isElectron ? 'Electron' : 'browser'} environment`);
  console.log(`Settings running in ${isElectron ? 'Electron' : 'browser'} environment`);
  
  /**
   * Get all application settings
   * @returns {Promise<Object>} - The application settings
   */
  async function getSettings() {
    try {
      settingsLogger.info('Getting settings');
      console.log('Getting settings from backend/storage');
      
      let settings = null;
      if (isElectron) {
        // In Electron environment, use IPC
        settingsLogger.debug('Fetching settings via IPC');
        console.log('Fetching settings via IPC');
        settings = await window.backend.ipc.invoke('settings:get');
        console.log('Received settings via IPC:', settings ? 'Success' : 'No settings found');
      } else {
        // In browser environment, use local storage
        settingsLogger.debug('Fetching settings from localStorage');
        console.log('Fetching settings from localStorage');
        const settingsJson = localStorage.getItem('appSettings');
        settings = settingsJson ? JSON.parse(settingsJson) : null;
        console.log('Loaded settings from localStorage:', settings ? 'Success' : 'No settings found');
      }
      
      // Log API key status (with redaction)
      if (settings && settings.apiKeys) {
        const apiKeyStatus = {};
        Object.keys(settings.apiKeys).forEach(service => {
          const key = settings.apiKeys[service];
          apiKeyStatus[service] = key ? 'Set (' + (key.length > 8 ? key.substring(0, 4) + '...' + key.slice(-4) : '***') + ')' : 'Not set';
        });
        settingsLogger.debug('API Key Status:', apiKeyStatus);
        console.log('API Key Status:', apiKeyStatus);
      } else {
        settingsLogger.debug('No API keys found in settings');
        console.log('No API keys found in settings');
      }
      
      return settings;
    } catch (error) {
      settingsLogger.error('Error getting settings:', error);
      console.error('Error getting settings:', error);
      throw new Error('Failed to get settings: ' + error.message);
    }
  }
  
  /**
   * Save application settings
   * @param {Object} settings - The settings to save
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async function saveSettings(settings) {
    try {
      if (!settings) {
        throw new Error('Invalid settings object');
      }
      
      settingsLogger.info('Saving settings');
      console.log('Saving settings to backend/storage');
      
      // Log API key status (with redaction)
      if (settings.apiKeys) {
        const apiKeyStatus = {};
        Object.keys(settings.apiKeys).forEach(service => {
          const key = settings.apiKeys[service];
          apiKeyStatus[service] = key ? 'Set (' + (key.length > 8 ? key.substring(0, 4) + '...' + key.slice(-4) : '***') + ')' : 'Not set';
        });
        settingsLogger.debug('Saving API Keys:', apiKeyStatus);
        console.log('Saving API Keys:', apiKeyStatus);
      }
      
      let result = false;
      if (isElectron) {
        // In Electron environment, use IPC
        settingsLogger.debug('Saving settings via IPC');
        console.log('Saving settings via IPC');
        result = await window.backend.ipc.invoke('settings:save', settings);
        console.log('Save settings via IPC result:', result);
      } else {
        // In browser environment, use local storage
        settingsLogger.debug('Saving settings to localStorage');
        console.log('Saving settings to localStorage');
        localStorage.setItem('appSettings', JSON.stringify(settings));
        result = true;
        console.log('Settings saved to localStorage');
      }
      
      settingsLogger.info('Settings saved successfully:', result);
      console.log('Settings saved successfully:', result);
      return result;
    } catch (error) {
      settingsLogger.error('Error saving settings:', error);
      console.error('Error saving settings:', error);
      throw new Error('Failed to save settings: ' + error.message);
    }
  }
  
  /**
   * Clear all application settings
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async function clearSettings() {
    try {
      settingsLogger.info('Clearing settings');
      
      if (isElectron) {
        // In Electron environment, use IPC
        return await window.backend.ipc.invoke('settings:clear');
      } else {
        // In browser environment, use local storage
        localStorage.removeItem('appSettings');
        return true;
      }
    } catch (error) {
      settingsLogger.error('Error clearing settings:', error);
      throw new Error('Failed to clear settings');
    }
  }
  
  /**
   * Get a specific API key
   * @param {string} provider - The API provider (google, openai, anthropic, openrouter)
   * @returns {Promise<string>} - The API key
   */
  async function getApiKey(provider) {
    try {
      const settings = await getSettings();
      return settings?.apiKeys?.[provider] || null;
    } catch (error) {
      settingsLogger.error(`Error getting ${provider} API key:`, error);
      throw new Error(`Failed to get ${provider} API key`);
    }
  }
  
  /**
   * Set a specific API key
   * @param {string} provider - The API provider (google, openai, anthropic, openrouter)
   * @param {string} apiKey - The API key to set
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async function setApiKey(provider, apiKey) {
    try {
      const settings = await getSettings() || { apiKeys: {} };
      
      if (!settings.apiKeys) {
        settings.apiKeys = {};
      }
      
      settings.apiKeys[provider] = apiKey;
      return await saveSettings(settings);
    } catch (error) {
      settingsLogger.error(`Error setting ${provider} API key:`, error);
      throw new Error(`Failed to set ${provider} API key`);
    }
  }
  
  /**
   * Test an API key to verify it works
   * @param {string} provider - The API provider
   * @param {string} apiKey - The API key to test
   * @returns {Promise<Object>} - The test result
   */
  async function testApiKey(provider, apiKey) {
    try {
      settingsLogger.info(`Testing ${provider} API key`);
      
      if (isElectron) {
        // In Electron environment, use IPC
        return await window.backend.ipc.invoke('settings:testApiKey', { provider, apiKey });
      } else {
        // In browser environment, use fetch to test the API key
        const response = await fetch('/api/test-api-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ provider, apiKey })
        });
        
        return await response.json();
      }
    } catch (error) {
      settingsLogger.error(`Error testing ${provider} API key:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Register the service with the backend API (Electron or HTTP)
  if (isElectron) {
    // In Electron environment, attach to window.backend
    try {
      if (!window.backend) {
        window.backend = {};
      }
      
      const serviceAPI = {
        getSettings,
        saveSettings,
        clearSettings,
        getApiKey,
        setApiKey,
        testApiKey
      };
      
      // Check if window.backend is extensible and if settingsService can be defined
      try {
        if (Object.isExtensible(window.backend)) {
          // Use Object.defineProperty to set the property
          Object.defineProperty(window.backend, 'settingsService', {
            value: serviceAPI,
            writable: true,
            configurable: true
          });
        } else {
          // If window.backend is not extensible, use the "backdoor" method - attach directly to window
          // This creates a parallel API access pattern: window.settingsService that works alongside window.backend
          window.settingsService = serviceAPI;
          
          // Log that we're using the alternate access pattern
          settingsLogger.info('SettingsService registered as window.settingsService (backend not extensible)');
          console.log('SettingsService registered as window.settingsService (backend not extensible)');
        }
      } catch (defPropError) {
        // If Object.defineProperty fails or window.backend can't be modified, use alternate method
        window.settingsService = serviceAPI;
        settingsLogger.info('SettingsService registered as window.settingsService (defineProperty failed)');
        console.log('SettingsService registered as window.settingsService (defineProperty failed)');
      }
      
      settingsLogger.info('SettingsService registered successfully');
      console.log('SettingsService registered successfully');
    } catch (error) {
      settingsLogger.error('Failed to register SettingsService:', error);
      console.error('Failed to register SettingsService:', error);
    }
  } else {
    // In browser environment, define global variable
    try {
      if (!window.backend) {
        window.backend = {};
      }
      
      const serviceAPI = {
        getSettings,
        saveSettings,
        clearSettings,
        getApiKey,
        setApiKey,
        testApiKey
      };
      
      // Check if window.backend is extensible and if settingsService can be defined
      try {
        if (Object.isExtensible(window.backend)) {
          // Use Object.defineProperty to set the property
          Object.defineProperty(window.backend, 'settingsService', {
            value: serviceAPI,
            writable: true,
            configurable: true
          });
        } else {
          // If window.backend is not extensible, use the "backdoor" method - attach directly to window
          // This creates a parallel API access pattern: window.settingsService that works alongside window.backend
          window.settingsService = serviceAPI;
          
          // Log that we're using the alternate access pattern
          settingsLogger.info('SettingsService registered as window.settingsService (browser, backend not extensible)');
          console.log('SettingsService registered as window.settingsService (browser, backend not extensible)');
        }
      } catch (defPropError) {
        // If Object.defineProperty fails or window.backend can't be modified, use alternate method
        window.settingsService = serviceAPI;
        settingsLogger.info('SettingsService registered as window.settingsService (browser, defineProperty failed)');
        console.log('SettingsService registered as window.settingsService (browser, defineProperty failed)');
      }
      
      settingsLogger.info('SettingsService registered successfully (browser)');
      console.log('SettingsService registered successfully (browser)');
    } catch (error) {
      settingsLogger.error('Failed to register SettingsService (browser):', error);
      console.error('Failed to register SettingsService (browser):', error);
    }
  }
  
  settingsLogger.info('SettingsService initialized');
  console.log('SettingsService initialized successfully');
}

// Initialize the settings service when this module is imported
initSettingsService().catch(error => {
  settingsLogger.error('Error initializing SettingsService:', error);
  console.error('Error initializing SettingsService:', error);
});

// Export the service initialization function
export default { initSettingsService }; 