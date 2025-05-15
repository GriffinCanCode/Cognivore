/**
 * Settings Component - Manages application settings and API keys
 */
import logger from '../../utils/logger.js';
import '../../services/SettingsService.js';

// Create context-specific logger
const settingsLogger = logger.scope('Settings');

class Settings {
  /**
   * Constructor for Settings component
   * @param {Object} notificationService - Service for showing notifications
   */
  constructor(notificationService) {
    this.notificationService = notificationService;
    this.container = null;
    this.settingsService = window.backend.settingsService;
    this.settings = {};
    this.activeTab = 'general';
    
    // Bind methods
    this.handleTabClick = this.handleTabClick.bind(this);
    this.handleSaveSettings = this.handleSaveSettings.bind(this);
    this.handleApiKeyChange = this.handleApiKeyChange.bind(this);
    this.handleSettingChange = this.handleSettingChange.bind(this);
    this.handleClearSettings = this.handleClearSettings.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    
    // Log initial creation
    settingsLogger.info('Settings component created');
    console.log('Settings component created');
  }

  /**
   * Initialize the settings component
   */
  async initialize() {
    settingsLogger.info('Initializing Settings component');
    console.log('Initializing Settings component');
    try {
      // Load settings from backend
      const settings = await this.settingsService.getSettings();
      settingsLogger.info('Settings loaded from backend', { settingsReceived: !!settings });
      console.log('Settings loaded from backend:', settings ? 'Success' : 'No settings found');
      
      this.settings = settings || {
        apiKeys: {
          google: '',
          openai: '',
          anthropic: '',
          openrouter: ''
        },
        models: {
          defaultChatModel: 'gemini-2.0-flash',
          defaultEmbeddingModel: 'text-embedding-3-small'
        },
        interface: {
          darkMode: true,
          fontSize: 'medium',
          codeHighlighting: true
        },
        advanced: {
          debugMode: false,
          maxTokens: 2048,
          temperature: 0.7
        }
      };
      
      // Log API keys state (with redaction)
      const apiKeyStatus = {};
      Object.keys(this.settings.apiKeys || {}).forEach(service => {
        const key = this.settings.apiKeys[service];
        apiKeyStatus[service] = key ? 'Set (' + (key.length > 8 ? key.substring(0, 4) + '...' + key.slice(-4) : '***') + ')' : 'Not set';
      });
      
      settingsLogger.debug('API Key Status:', apiKeyStatus);
      console.log('API Key Status:', apiKeyStatus);
      
      this.updateUI();

      // Set up scroll event handler for creative scrollbar
      if (this.container) {
        this.container.addEventListener('scroll', this.handleScroll);
        settingsLogger.debug('Scroll event handler attached');
      }
    } catch (error) {
      settingsLogger.error('Error initializing settings:', error);
      console.error('Error initializing settings:', error);
      this.notificationService?.error('Failed to load settings');
    }
  }

  /**
   * Handle scroll events to add animation class to scrollbar
   * @param {Event} event - Scroll event
   */
  handleScroll(event) {
    if (!this.container) return;
    
    // Add the scrolling class
    this.container.classList.add('scrolling');
    
    // Clear any existing timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    // Remove the class after scrolling stops (after 1 second)
    this.scrollTimeout = setTimeout(() => {
      this.container.classList.remove('scrolling');
    }, 1000);
  }

  /**
   * Handle tab click events
   * @param {string} tabId - ID of the clicked tab
   */
  handleTabClick(tabId) {
    this.activeTab = tabId;
    this.updateUI();
  }

  /**
   * Handle API key input changes
   * @param {Event} event - Input change event
   */
  handleApiKeyChange(event) {
    const { id, value } = event.target;
    const serviceId = id.replace('-api-key', '');
    
    settingsLogger.info(`API key for ${serviceId} changed`);
    console.log(`API key for ${serviceId} changed`);
    
    this.settings.apiKeys[serviceId] = value;
  }

  /**
   * Handle setting changes
   * @param {Event} event - Input change event
   */
  handleSettingChange(event) {
    const { id, value, type, checked } = event.target;
    const [section, setting] = id.split('-');
    
    if (type === 'checkbox') {
      this.settings[section][setting] = checked;
    } else if (type === 'number') {
      this.settings[section][setting] = parseFloat(value);
    } else {
      this.settings[section][setting] = value;
    }
  }

  /**
   * Handle save settings button click
   * @param {Event} event - Button click event
   */
  async handleSaveSettings(event) {
    console.log('Save button clicked, saving settings...');
    
    // Get all settings values from form
    const googleApiKey = document.getElementById('google-api-key').value;
    // ... other settings ...
    
    console.log('API Key to save:', googleApiKey ? (googleApiKey.substring(0, 4) + '...' + googleApiKey.substring(googleApiKey.length - 4)) : 'Not provided');
    
    // Create settings object
    const settings = {
      apiKeys: {
        google: googleApiKey,
        // ... other API keys ...
      },
      // ... other settings ...
    };
    
    // Log if backend.settingsService exists
    console.log('window.backend exists:', !!window.backend);
    console.log('window.backend.settingsService exists:', !!(window.backend && window.backend.settingsService));
    console.log('window.backend.ipc exists:', !!(window.backend && window.backend.ipc));
    
    // Save settings
    try {
      // Check if backend services are available and use appropriate method
      if (window.backend && window.backend.settingsService) {
        console.log('Using window.backend.settingsService.saveSettings()');
        window.backend.settingsService.saveSettings(settings)
          .then(result => {
            console.log('Settings saved successfully:', result);
            this.notificationService?.success('Settings saved successfully');
          })
          .catch(error => {
            console.error('Error saving settings:', error);
            this.notificationService?.error('Failed to save settings');
          });
      } 
      else if (window.backend && window.backend.ipc) {
        console.log('Using window.backend.ipc.invoke()');
        window.backend.ipc.invoke('settings:save', settings)
          .then(result => {
            console.log('Settings saved successfully via IPC:', result);
            this.notificationService?.success('Settings saved successfully');
          })
          .catch(error => {
            console.error('Error saving settings via IPC:', error);
            this.notificationService?.error('Failed to save settings');
          });
      }
      else {
        console.error('No backend services available for saving settings');
        this.notificationService?.error('Unable to save settings: Backend services not available.');
      }
    } catch (error) {
      console.error('Error during settings save attempt:', error);
      this.notificationService?.error('Failed to save settings');
    }
  }

  /**
   * Handle clear settings button click
   * @param {Event} event - Button click event
   */
  async handleClearSettings(event) {
    event.preventDefault();
    
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      settingsLogger.info('Resetting settings to defaults');
      try {
        await this.settingsService.clearSettings();
        await this.initialize();
        this.notificationService?.success('Settings reset to defaults');
      } catch (error) {
        settingsLogger.error('Error clearing settings:', error);
        this.notificationService?.error('Failed to reset settings');
      }
    }
  }

  /**
   * Update the UI with current settings
   */
  updateUI() {
    if (!this.container) return;
    
    // Set active sidebar item
    const sidebarItems = this.container.querySelectorAll('.settings-sidebar-item');
    sidebarItems.forEach(item => {
      if (item.dataset.tabId === this.activeTab) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    
    // Show active tab content
    const tabContents = this.container.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
      if (content.id === `${this.activeTab}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // Update form values
    Object.keys(this.settings.apiKeys || {}).forEach(service => {
      const input = this.container.querySelector(`#${service}-api-key`);
      if (input) {
        input.value = this.settings.apiKeys[service] || '';
      }
    });
    
    // Update model settings
    Object.keys(this.settings.models || {}).forEach(model => {
      const input = this.container.querySelector(`#models-${model}`);
      if (input) {
        input.value = this.settings.models[model] || '';
      }
    });
    
    // Update interface settings
    Object.keys(this.settings.interface || {}).forEach(setting => {
      const input = this.container.querySelector(`#interface-${setting}`);
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = !!this.settings.interface[setting];
        } else {
          input.value = this.settings.interface[setting] || '';
        }
      }
    });
    
    // Update advanced settings
    Object.keys(this.settings.advanced || {}).forEach(setting => {
      const input = this.container.querySelector(`#advanced-${setting}`);
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = !!this.settings.advanced[setting];
        } else {
          input.value = this.settings.advanced[setting] || '';
        }
      }
    });
  }

  /**
   * Render the settings component
   * @returns {HTMLElement} - The rendered component
   */
  render() {
    settingsLogger.info('Rendering Settings component');
    
    const container = document.createElement('div');
    container.className = 'settings-container';
    
    // Create a flex layout with sidebar and content area
    container.innerHTML = `
      <div class="settings-layout">
        <div class="settings-sidebar">
          <div class="settings-sidebar-header">
            <h2>Settings</h2>
          </div>
          <div class="settings-sidebar-items">
            <div class="settings-sidebar-item active" data-tab-id="general">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>General</span>
            </div>
            <div class="settings-sidebar-item" data-tab-id="api-keys">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
              <span>API Keys</span>
            </div>
            <div class="settings-sidebar-item" data-tab-id="models">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2c5.523 0 10 4.477 10 10 0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm0 4a1 1 0 00-1 1v5a1 1 0 00.293.707l3.5 3.5a1 1 0 001.414-1.414L12.414 11H12V7a1 1 0 00-1-1z"></path>
              </svg>
              <span>Models</span>
            </div>
            <div class="settings-sidebar-item" data-tab-id="advanced">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12.9 6.858l4.242 4.243-7.071 7.071L5.83 13.93l7.07-7.071zm6.364 6.364l1.414 1.414a1 1 0 11-1.414 1.415l-1.414-1.415a1 1 0 111.414-1.414zM3 13.93l1.414 1.414a1 1 0 11-1.414 1.414L1.586 15.34A1 1 0 113 13.928zm14.485-9.9l1.414 1.415a1 1 0 01-1.414 1.414L16.07 5.444a1 1 0 111.415-1.414zM5.444 7.929L6.858 9.343a1 1 0 11-1.415 1.414L4.03 9.343a1 1 0 111.414-1.414z"></path>
              </svg>
              <span>Advanced</span>
            </div>
          </div>
        </div>
        
        <div class="settings-content-wrapper">
          <div class="tab-content active" id="general-tab">
            <h3>General Settings</h3>
            
            <div class="settings-section">
              <h4>Interface Preferences</h4>
              
              <div class="setting-item">
                <label for="interface-darkMode">Dark Mode</label>
                <input type="checkbox" id="interface-darkMode" ${this.settings.interface?.darkMode ? 'checked' : ''}>
              </div>
              
              <div class="setting-item">
                <label for="interface-fontSize">Font Size</label>
                <select id="interface-fontSize">
                  <option value="small" ${this.settings.interface?.fontSize === 'small' ? 'selected' : ''}>Small</option>
                  <option value="medium" ${this.settings.interface?.fontSize === 'medium' ? 'selected' : ''}>Medium</option>
                  <option value="large" ${this.settings.interface?.fontSize === 'large' ? 'selected' : ''}>Large</option>
                </select>
              </div>
              
              <div class="setting-item">
                <label for="interface-codeHighlighting">Code Highlighting</label>
                <input type="checkbox" id="interface-codeHighlighting" ${this.settings.interface?.codeHighlighting ? 'checked' : ''}>
              </div>
            </div>
          </div>
          
          <div class="tab-content" id="api-keys-tab">
            <h3>API Keys</h3>
            <p class="settings-description">Your API keys are securely stored in the app's configuration and are only used to make requests to the respective services.</p>
            
            <div class="settings-section">
              <div class="api-key-item">
                <label for="google-api-key">Google Gemini API Key</label>
                <input type="password" id="google-api-key" placeholder="Enter Google Gemini API Key" value="${this.settings.apiKeys?.google || ''}">
                <a href="https://ai.google.dev/" target="_blank" class="help-link">Get a key</a>
              </div>
              
              <div class="api-key-item">
                <label for="openai-api-key">OpenAI API Key</label>
                <input type="password" id="openai-api-key" placeholder="Enter OpenAI API Key" value="${this.settings.apiKeys?.openai || ''}">
                <a href="https://platform.openai.com/api-keys" target="_blank" class="help-link">Get a key</a>
              </div>
              
              <div class="api-key-item">
                <label for="anthropic-api-key">Anthropic Claude API Key</label>
                <input type="password" id="anthropic-api-key" placeholder="Enter Anthropic API Key" value="${this.settings.apiKeys?.anthropic || ''}">
                <a href="https://console.anthropic.com/keys" target="_blank" class="help-link">Get a key</a>
              </div>
              
              <div class="api-key-item">
                <label for="openrouter-api-key">OpenRouter API Key</label>
                <input type="password" id="openrouter-api-key" placeholder="Enter OpenRouter API Key" value="${this.settings.apiKeys?.openrouter || ''}">
                <a href="https://openrouter.ai/keys" target="_blank" class="help-link">Get a key</a>
              </div>
            </div>
          </div>
          
          <div class="tab-content" id="models-tab">
            <h3>Model Settings</h3>
            
            <div class="settings-section">
              <div class="setting-item">
                <label for="models-defaultChatModel">Default Chat Model</label>
                <select id="models-defaultChatModel">
                  <option value="gemini-2.0-flash" ${this.settings.models?.defaultChatModel === 'gemini-2.0-flash' ? 'selected' : ''}>Google Gemini Flash</option>
                  <option value="gemini-2.0-pro" ${this.settings.models?.defaultChatModel === 'gemini-2.0-pro' ? 'selected' : ''}>Google Gemini Pro</option>
                  <option value="gpt-3.5-turbo" ${this.settings.models?.defaultChatModel === 'gpt-3.5-turbo' ? 'selected' : ''}>OpenAI GPT-3.5 Turbo</option>
                  <option value="gpt-4" ${this.settings.models?.defaultChatModel === 'gpt-4' ? 'selected' : ''}>OpenAI GPT-4</option>
                  <option value="claude-3-opus" ${this.settings.models?.defaultChatModel === 'claude-3-opus' ? 'selected' : ''}>Anthropic Claude 3 Opus</option>
                  <option value="claude-3-sonnet" ${this.settings.models?.defaultChatModel === 'claude-3-sonnet' ? 'selected' : ''}>Anthropic Claude 3 Sonnet</option>
                  <option value="claude-3-haiku" ${this.settings.models?.defaultChatModel === 'claude-3-haiku' ? 'selected' : ''}>Anthropic Claude 3 Haiku</option>
                </select>
              </div>
              
              <div class="setting-item">
                <label for="models-defaultEmbeddingModel">Default Embedding Model</label>
                <select id="models-defaultEmbeddingModel">
                  <option value="text-embedding-3-small" ${this.settings.models?.defaultEmbeddingModel === 'text-embedding-3-small' ? 'selected' : ''}>OpenAI text-embedding-3-small</option>
                  <option value="text-embedding-3-large" ${this.settings.models?.defaultEmbeddingModel === 'text-embedding-3-large' ? 'selected' : ''}>OpenAI text-embedding-3-large</option>
                  <option value="text-embedding-ada-002" ${this.settings.models?.defaultEmbeddingModel === 'text-embedding-ada-002' ? 'selected' : ''}>OpenAI text-embedding-ada-002</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="tab-content" id="advanced-tab">
            <h3>Advanced Settings</h3>
            <p class="settings-description">Advanced settings should only be modified if you understand their impact.</p>
            
            <div class="settings-section">
              <div class="setting-item">
                <label for="advanced-debugMode">Debug Mode</label>
                <input type="checkbox" id="advanced-debugMode" ${this.settings.advanced?.debugMode ? 'checked' : ''}>
              </div>
              
              <div class="setting-item">
                <label for="advanced-maxTokens">Max Tokens</label>
                <input type="number" id="advanced-maxTokens" min="256" max="8192" value="${this.settings.advanced?.maxTokens || 2048}">
              </div>
              
              <div class="setting-item">
                <label for="advanced-temperature">Temperature</label>
                <input type="range" id="advanced-temperature" min="0" max="1" step="0.1" value="${this.settings.advanced?.temperature || 0.7}">
                <span class="range-value">${this.settings.advanced?.temperature || 0.7}</span>
              </div>
              
              <div class="danger-zone">
                <h4>Danger Zone</h4>
                <button class="clear-settings-btn">Reset All Settings</button>
              </div>
            </div>
          </div>
          
          <!-- Settings Actions -->
          <div class="settings-actions">
            <button class="save-settings-btn">Save Settings</button>
          </div>
        </div>
      </div>
    `;
    
    // Add event listeners
    setTimeout(() => {
      // Sidebar navigation
      const sidebarItems = container.querySelectorAll('.settings-sidebar-item');
      sidebarItems.forEach(item => {
        item.addEventListener('click', () => this.handleTabClick(item.dataset.tabId));
      });
      
      // API Keys
      container.querySelectorAll('input[id$="-api-key"]').forEach(input => {
        input.addEventListener('change', this.handleApiKeyChange);
      });
      
      // Settings
      container.querySelectorAll('input:not([id$="-api-key"]), select').forEach(input => {
        input.addEventListener('change', this.handleSettingChange);
      });
      
      // Range input value display
      container.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', function() {
          const valueDisplay = this.nextElementSibling;
          if (valueDisplay.classList.contains('range-value')) {
            valueDisplay.textContent = this.value;
          }
        });
      });
      
      // Save button
      const saveButton = container.querySelector('.save-settings-btn');
      if (saveButton) {
        saveButton.addEventListener('click', this.handleSaveSettings);
      }
      
      // Clear settings button
      const clearButton = container.querySelector('.clear-settings-btn');
      if (clearButton) {
        clearButton.addEventListener('click', this.handleClearSettings);
      }
    }, 0);
    
    // After container is created, set up scroll handler
    setTimeout(() => {
      if (container) {
        container.addEventListener('scroll', this.handleScroll);
      }
    }, 0);
    
    this.container = container;
    return container;
  }

  /**
   * Clean up component resources
   */
  cleanup() {
    if (this.container) {
      // Remove event listeners
      const inputs = this.container.querySelectorAll('input, select');
      inputs.forEach(input => {
        input.removeEventListener('change', this.handleSettingChange);
        input.removeEventListener('change', this.handleApiKeyChange);
      });
      
      const clearButton = this.container.querySelector('.clear-settings-btn');
      if (clearButton) {
        clearButton.removeEventListener('click', this.handleClearSettings);
      }
      
      const saveButton = this.container.querySelector('.save-settings-btn');
      if (saveButton) {
        saveButton.removeEventListener('click', this.handleSaveSettings);
      }
      
      // Remove sidebar item event listeners
      const sidebarItems = this.container.querySelectorAll('.settings-sidebar-item');
      sidebarItems.forEach(item => {
        item.removeEventListener('click', () => this.handleTabClick(item.dataset.tabId));
      });
      
      // Remove scroll event listener
      this.container.removeEventListener('scroll', this.handleScroll);
      
      // Remove any pending scroll timeouts
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = null;
      }
      
      // Clean up DOM
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }
    
    this.container = null;
  }
}

export default Settings; 