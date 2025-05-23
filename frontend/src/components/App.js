/**
 * Main App Component - Coordinates the Cognivore application
 */
import Sidebar from './ui/Sidebar.js';
import ChatHeader from './chat/ChatHeader.js';
import ChatUI from './ChatUI.js';
import ThemeSwitcher from './renderers/ThemeSwitcher.js';
import Footer from './ui/Footer.js';
import ContentViewer from './chat/ContentViewer.js';
import SearchSection from './chat/SearchSection.js';
import Header from './ui/Header.js';
import Mnemosyne from './mnemosyne/Mnemosyne.js';
import Sieve from './Sieve.js';
import DocProcessor from '../services/DocProcessorService.js';
import logger from '../utils/logger.js';
import Anthology from './Anthology.js';
import Settings from './ui/Settings.js';
import ToolRenderer from './tools/ToolRenderer.js';
import Browser from './browser/Voyager.js';
import React, { Component } from 'react';
import * as ReactDOM from 'react-dom/client';

// Create context-specific logger
const appLogger = logger.scope('App');

// Initialize the ToolRenderer singleton
const toolRenderer = new ToolRenderer();

class App extends Component {
  constructor() {
    super();
    this.container = null;
    this.sidebar = null;
    this.chatHeader = null;
    this.chatUI = null;
    this.sidebarOverlay = null;
    this.isMobile = window.innerWidth < 768;
    this.themeSwitcher = null;
    this.footer = null;
    this.contentViewer = null;
    this.searchSection = null;
    this.header = null;
    this.currentSection = 'ai-assistant'; // Default section
    this.documentManager = null; // Document processor
    this.mnemosyne = null; // Mnemosyne component
    this.sieve = null; // Sieve component
    this.anthology = null; // Anthology component
    this.settings = null; // Settings component
    this.browser = null; // Browser component
    this.browserRef = React.createRef(); // Create ref for Browser component
    
    // Bind methods
    this.handleNavigation = this.handleNavigation.bind(this);
    this.handleContentSelected = this.handleContentSelected.bind(this);
    this.handleContentUpdated = this.handleContentUpdated.bind(this);
    this.handleContentCapture = this.handleContentCapture.bind(this);
  }

  /**
   * Initialize the app
   */
  init() {
    appLogger.info('App.init called');
    
    // Load required CSS files
    this.loadStylesheets();
    
    // Load required external scripts
    this.loadExternalScripts();
    
    // Create notification service (can be null for now)
    const notificationService = null;
    
    // Create components
    this.sidebar = new Sidebar(this.handleNavigation.bind(this));
    this.chatHeader = new ChatHeader('Cognivore');
    
    // Create ChatUI with notification service
    this.chatUI = new ChatUI(notificationService);
    
    // Connect ChatUI to ChatHeader
    this.chatUI.setHeaderComponent(this.chatHeader);
    
    // Initialize the tool rendering system
    this.initializeToolSystem();
    
    // Create document manager (DocProcessor)
    this.documentManager = new DocProcessor(notificationService);
    
    // Create theme switcher
    this.themeSwitcher = new ThemeSwitcher();
    
    // Create footer
    this.footer = new Footer();
    
    // Create Mnemosyne component
    this.mnemosyne = new Mnemosyne(notificationService);
    
    // Create Sieve component
    this.sieve = new Sieve(notificationService, this.documentManager);
    
    // Create content viewer
    this.contentViewer = new ContentViewer();
    
    // Create Anthology component
    this.anthology = new Anthology(notificationService);
    
    // Create Settings component
    this.settings = new Settings(notificationService);
    
    // Create Browser component
    this.browser = new Browser(notificationService);
    
    // Create search section
    this.searchSection = new SearchSection(notificationService);
    
    // Create header
    this.header = new Header();
    
    // Pass app reference to ChatUI
    this.chatUI.app = this;
    
    // Ensure handleSubmit is bound to the ChatUI instance
    this.chatUI.handleSubmit = this.chatUI.handleSubmit.bind(this.chatUI);
    
    // Set mobile menu toggle callback
    this.chatHeader.setMenuToggleCallback(this.toggleMobileMenu.bind(this));
    
    // Initialize chat UI
    appLogger.info('Initializing ChatUI...');
    this.chatUI.initialize();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Register document event listeners
    this.documentManager.addDocumentListener(this.handleDocumentEvent.bind(this));
    
    // Render the app
    this.render();
    
    // Add resize listener
    window.addEventListener('resize', this.handleResize.bind(this));
    
    appLogger.info('App initialization complete');
  }

  /**
   * Initialize the tool rendering system
   */
  initializeToolSystem() {
    appLogger.info('Initializing tool rendering system');
    
    // Register event handlers for tool rendering
    document.addEventListener('tool:rendered', (e) => {
      appLogger.debug('Tool rendered:', e.detail.toolName);
    });
    
    document.addEventListener('tool:error', (e) => {
      appLogger.error('Tool rendering error:', e.detail.error);
    });
    
    document.addEventListener('tool:execute', (e) => {
      appLogger.info('Tool execution requested:', e.detail.toolCall);
      if (this.chatUI) {
        this.chatUI.executeToolCall(e.detail.toolCall);
      }
    });
    
    // Initialize the tool renderer (already done at the top level)
    toolRenderer.initialize();
  }

  /**
   * Load required stylesheets for the application
   */
  loadStylesheets() {
    // Define all required stylesheets
    const stylesheets = [
      './styles/components/browser.css',
      './styles/components/ResearchPanel.css'
    ];
    
    // Load each stylesheet with error handling
    stylesheets.forEach(href => {
      this.loadStylesheet(href);
    });
  }

  /**
   * Load a stylesheet if it hasn't been loaded already
   * @param {string} href - Path to the stylesheet
   */
  loadStylesheet(href) {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      
      // Add error handling
      link.onerror = () => {
        appLogger.warn(`Failed to load stylesheet: ${href}`);
        // Continue without the stylesheet - application should still function
      };
      
      document.head.appendChild(link);
      appLogger.debug(`Loading stylesheet: ${href}`);
    }
  }

  /**
   * Load external script dependencies with error handling
   */
  loadExternalScripts() {
    const scripts = [
      { 
        src: 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js',
        id: 'three-js-core'
      }
    ];
    
    scripts.forEach(script => {
      this.loadScript(script.src, script.id, script.optional);
    });
  }

  /**
   * Load a script if it hasn't been loaded already
   * @param {string} src - Path to the script
   * @param {string} id - Identifier for the script element
   * @param {boolean} optional - Whether the script is optional (default: false)
   */
  loadScript(src, id, optional = false) {
    if (!document.getElementById(id)) {
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      
      // Add error handling
      script.onerror = () => {
        const severity = optional ? 'warn' : 'error';
        appLogger[severity](`Failed to load script: ${src}`);
        
        // If script is optional, application should continue
        if (!optional) {
          // Display error in UI for required scripts
          const errorEvent = new CustomEvent('application:error', {
            detail: {
              message: `Failed to load required script: ${src}`,
              type: 'script-load-error'
            }
          });
          document.dispatchEvent(errorEvent);
        }
      };
      
      script.onload = () => {
        appLogger.debug(`Loaded script: ${src}`);
      };
      
      document.head.appendChild(script);
      appLogger.debug(`Loading script: ${src}`);
    }
  }

  /**
   * Set up event listeners for component communication
   */
  setupEventListeners() {
    // Listen for content selection
    document.addEventListener('content:selected', (e) => {
      this.handleContentSelected(e.detail.itemId, e.detail.itemData);
    });
    
    // Listen for content update
    document.addEventListener('content:updated', this.handleContentUpdated);
    
    // Listen for navigation change from Header
    document.addEventListener('navigation:change', (e) => {
      this.handleNavigation(e.detail.section);
    });
    
    // Listen for theme changes
    document.addEventListener('theme:changed', (e) => {
      appLogger.info(`Theme changed to ${e.detail.isDark ? 'dark' : 'light'}`);
    });
    
    // Listen for settings changes
    document.addEventListener('settings:changed', (e) => {
      appLogger.info('Settings changed, updating application');
      // You could add logic here to handle settings changes
    });
    
    // Listen for application errors
    document.addEventListener('application:error', (e) => {
      appLogger.error(`Application error: ${e.detail.message}`, e.detail);
      // Could display this in the UI if needed
    });
    
    // Listen for service registration errors
    document.addEventListener('service:registration:error', (e) => {
      appLogger.warn(`Service registration error: ${e.detail.service}`, e.detail.error);
      // Continue with application initialization despite service errors
    });
  }

  /**
   * Handle document manager events
   * @param {string} eventType - Type of document event
   * @param {Object} data - Event data
   */
  handleDocumentEvent(eventType, data) {
    appLogger.info(`Document event: ${eventType}`, data);
    
    // Handle specific event types
    switch (eventType) {
      case 'document:deleted':
      case 'pdf:processed':
      case 'url:processed':
      case 'youtube:processed':
        // Refresh content list on any document changes
        if (this.mnemosyne) {
          this.mnemosyne.refreshItems();
        }
        if (this.sieve) {
          this.sieve.refreshItems();
        }
        break;
        
      default:
        // No specific handling for other event types
        break;
    }
  }

  /**
   * Handle content selection
   * @param {string} itemId - ID of the selected item
   * @param {Object} itemData - Data of the selected item
   */
  handleContentSelected(itemId, itemData) {
    appLogger.info(`Content selected: ${itemId}`);
    this.contentViewer.viewItem(itemId, itemData);
  }

  /**
   * Handle content updated event
   */
  handleContentUpdated() {
    appLogger.info('Content updated, refreshing content list');
    if (this.mnemosyne) {
      this.mnemosyne.refreshItems();
    }
    if (this.sieve) {
      this.sieve.refreshItems();
    }
  }

  /**
   * Handle navigation item clicks
   * @param {string} itemId - The ID of the clicked item
   */
  handleNavigation(itemId) {
    appLogger.info(`Navigation: ${itemId}`);
    
    // If this is the same section as current, do nothing
    if (this.currentSection === itemId) {
      return;
    }
    
    // Check if we're navigating away from browser section
    const wasInBrowser = ['browser', 'voyager'].includes(this.currentSection);
    
    // Set active navigation item
    this.sidebar.setActiveItem(itemId);
    
    // Save current section
    this.currentSection = itemId;
    
    // If we were in browser mode and now switching to something else,
    // make sure to restore the main app container visibility and clean up browser
    if (wasInBrowser && !['browser', 'voyager'].includes(itemId)) {
      // Show the main app container
      const appContainer = document.getElementById('app');
      if (appContainer) {
        appContainer.style.display = 'block';
      }
      
      // Clean up the browser component
      if (this.browser) {
        this.browser.cleanup();
      }
      
      // Remove any browser containers that might be directly in the body
      const browserContainers = document.querySelectorAll('body > .browser-container');
      browserContainers.forEach(container => {
        container.parentNode.removeChild(container);
      });
    }
    
    // Handle specific navigation actions
    if (itemId === 'ai-assistant' && this.chatUI) {
      // For AI Assistant, just make sure it's visible and has focus
      this.chatUI.focusInput();
    } else if (itemId === 'new-chat' && this.chatUI) {
      // For new chat, clear the messages and start fresh
      this.chatUI.handleNewChat();
      this.chatUI.focusInput();
    } else if (itemId === 'api-settings' && this.settings) {
      // For API settings, initialize the settings component
      this.settings.initialize();
    } else if (itemId === 'preferences' && this.settings) {
      // For preferences, initialize the settings component with general tab
      this.settings.activeTab = 'general';
      this.settings.initialize();
    } else if ((itemId === 'browser' || itemId === 'voyager') && this.browser) {
      // For browser/voyager, initialize it
      this.browser.initialize();
    }
    
    // If on mobile, close the sidebar
    if (this.isMobile) {
      this.closeMobileMenu();
    }
    
    // Re-render to show the correct section
    this.render();
  }

  /**
   * Toggle the mobile menu
   */
  toggleMobileMenu() {
    document.body.classList.toggle('sidebar-visible');
    
    if (document.body.classList.contains('sidebar-visible')) {
      // Create overlay if it doesn't exist
      if (!this.sidebarOverlay) {
        this.sidebarOverlay = this.sidebar.createOverlay();
        document.body.appendChild(this.sidebarOverlay);
      }
      this.sidebarOverlay.style.display = 'block';
    } else {
      if (this.sidebarOverlay) {
        this.sidebarOverlay.style.display = 'none';
      }
    }
  }

  /**
   * Close the mobile menu
   */
  closeMobileMenu() {
    document.body.classList.remove('sidebar-visible');
    if (this.sidebarOverlay) {
      this.sidebarOverlay.style.display = 'none';
    }
  }

  /**
   * Handle window resize events
   */
  handleResize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768;
    
    // If transitioning from mobile to desktop
    if (wasMobile && !this.isMobile) {
      this.closeMobileMenu();
    }
  }

  /**
   * Handle content captured from browser
   * @param {Object} content - Captured content data
   */
  handleContentCapture(content) {
    appLogger.info('Content captured from browser');
    // Process captured content if needed
    if (this.documentManager && content) {
      // You can add code here to process the captured content
      // For example, adding it to the document manager
    }
  }

  /**
   * Render the app
   */
  render() {
    appLogger.info('App.render called');
    
    let appElement = document.getElementById('app');
    
    // Create the app element if it doesn't exist
    if (!appElement) {
      appLogger.warn('No #app element found in DOM, creating one');
      try {
        const newAppElement = document.createElement('div');
        newAppElement.id = 'app';
        document.body.appendChild(newAppElement);
        appElement = newAppElement;
        appLogger.info('Created new #app element');
      } catch (err) {
        appLogger.error('Failed to create #app element:', err);
      }
    }
    
    // Clear any existing app container
    if (appElement) {
      try {
        while (appElement.firstChild) {
          appElement.removeChild(appElement.firstChild);
        }
      } catch (err) {
        appLogger.error('Error clearing #app element:', err);
      }
    } else {
      appLogger.error('Fatal error: Unable to find or create #app element');
      return; // Exit early if we can't render
    }

    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'chat-container-wrapper';
    
    // Add body classes
    document.body.classList.add('chat-layout');
    if (this.isMobile) {
      document.body.classList.add('mobile-view');
    }
    
    // Render sidebar
    const sidebarElement = this.sidebar.render();
    this.container.appendChild(sidebarElement);
    
    // Ensure sidebar shows the correct active state (only if needed)
    if (this.sidebar && this.currentSection) {
      this.sidebar.setActiveItem(this.currentSection);
    }
    
    // Create main content
    const mainContent = document.createElement('div');
    mainContent.className = 'main-content';
    
    // Render content based on current section
    switch (this.currentSection) {
      case 'ai-assistant':
      case 'new-chat':
        // Render chat header
        const headerElement = this.chatHeader.render();
        mainContent.appendChild(headerElement);
        
        // Render chat UI
        appLogger.info('Rendering ChatUI component');
        const chatElement = this.chatUI.render();
        mainContent.appendChild(chatElement);
        
        // Get the chat input element from ChatUI
        const inputElement = this.chatUI.getInputElement();
        mainContent.appendChild(inputElement);
        break;
        
      case 'documents':
        // Render Mnemosyne component
        appLogger.info('Rendering Mnemosyne component');
        const mnemosyneElement = this.mnemosyne.render();
        mainContent.appendChild(mnemosyneElement);
        
        // Initialize Mnemosyne
        setTimeout(() => {
          this.mnemosyne.initialize();
        }, 100);
        
        // Add content viewer (initially hidden)
        mainContent.appendChild(this.contentViewer.render());
        break;
        
      case 'sieve':
        // Render Sieve component
        appLogger.info('Rendering Sieve component');
        const sieveElement = this.sieve.render();
        mainContent.appendChild(sieveElement);
        
        // Initialize Sieve
        setTimeout(() => {
          this.sieve.initialize();
        }, 100);
        
        // Add content viewer for viewing selected items
        mainContent.appendChild(this.contentViewer.render());
        break;
        
      case 'browser':
      case 'voyager':
        // Don't create a separate mount point - use the main content container
        appLogger.info('Rendering browser in main content container');
        
        // Create browser component directly in main content
        const browserElement = document.createElement('div');
        browserElement.id = 'browser-container';
        browserElement.className = 'voyager-browser-container'; // Add class for proper styling
        browserElement.style.cssText = `
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          position: relative !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        `;
        mainContent.appendChild(browserElement);
        
        // Make sure browser element is properly in the DOM before initialization
        // Force a layout recalculation to ensure the element is attached
        void browserElement.offsetHeight;
        
        // Store reference to container for browser component initialization
        this.browserContainer = browserElement;
        
        // Clean up any existing browser-mount to prevent duplicates
        const oldBrowserMount = document.getElementById('browser-mount');
        if (oldBrowserMount && oldBrowserMount.parentNode) {
          try {
            // In React 18, we just remove the element directly
            oldBrowserMount.parentNode.removeChild(oldBrowserMount);
          } catch (err) {
            console.warn('Error removing old browser mount:', err);
          }
        }
        
        // Use React to render the Voyager component for proper browser features
        if (!this._browserRoot) {
          try {
            const ReactDOM = require('react-dom/client');
            this._browserRoot = ReactDOM.createRoot(browserElement);
          } catch (err) {
            console.error('Error creating React root for browser:', err);
          }
        }
        
        if (this._browserRoot) {
          try {
            // Import React for JSX
            const React = require('react');
            // Render the full browser component with React
            this._browserRoot.render(
              React.createElement(this.browser.constructor, {
                ref: this.browserRef,
                initialUrl: 'https://www.google.com',
                notificationService: null,
                enableResearch: true
              })
            );
            console.log('Rendered Voyager browser component using React for full functionality');
            
            // Set up the container reference after React render
            setTimeout(() => {
              if (this.browserRef && this.browserRef.current) {
                // Set the container reference to point to our created container
                this.browserRef.current.containerRef = { current: this.browserContainer };
                console.log('Set containerRef for React-rendered Voyager component');
                
                // Don't call initialize() here - it's already called in componentDidMount
                // The component will initialize itself when it's ready
              }
            }, 100); // Short delay to ensure React render is complete
            
          } catch (err) {
            console.error('Error rendering browser with React:', err);
            
            // Fallback to ensure container reference is set (don't reinitialize)
            setTimeout(() => {
              if (this.browser) {
                // Check if container is properly in the DOM
                if (this.browserContainer && this.browserContainer.isConnected) {
                  // Set the container reference for the browser
                  this.browser.containerRef = { current: this.browserContainer };
                  console.log('Set browser container reference (fallback):', this.browserContainer);
                  // Don't call initialize() - it should already be called by componentDidMount
                } else {
                  console.warn('Browser container not connected to DOM');
                }
              } else if (this.browserRef && this.browserRef.current) {
                // Check if container is properly in the DOM
                if (this.browserContainer && this.browserContainer.isConnected) {
                  // Set the container reference for the browser
                  this.browserRef.current.containerRef = { current: this.browserContainer };
                  console.log('Set browser container reference (fallback):', this.browserContainer);
                  // Don't call initialize() - it should already be called by componentDidMount
                } else {
                  console.warn('Browser container not connected to DOM');
                }
              } else {
                console.warn('Browser reference not available');
              }
            }, 300);
          }
        }
        break;
        
      case 'anthology':
        // Render Anthology component
        appLogger.info('Rendering Anthology component');
        const anthologyElement = this.anthology.render();
        mainContent.appendChild(anthologyElement);
        
        // Initialize Anthology
        setTimeout(() => {
          this.anthology.initialize();
        }, 100);
        break;
        
      case 'search':
        // Render search view
        mainContent.appendChild(this.searchSection.render());
        break;
        
      case 'api-settings':
      case 'preferences':
        // Render Settings component
        appLogger.info('Rendering Settings component');
        const settingsElement = this.settings.render();
        mainContent.appendChild(settingsElement);
        
        // Initialize Settings
        setTimeout(() => {
          this.settings.initialize();
        }, 100);
        break;
        
      default:
        // Default view - under construction message
        const defaultHeader = document.createElement('h2');
        defaultHeader.textContent = `${this.currentSection.charAt(0).toUpperCase() + this.currentSection.slice(1)} View`;
        mainContent.appendChild(defaultHeader);
        
        const underConstruction = document.createElement('p');
        underConstruction.textContent = 'This section is under construction.';
        mainContent.appendChild(underConstruction);
    }
    
    this.container.appendChild(mainContent);
    
    // Mount to DOM with robust error handling
    try {
      appElement.appendChild(this.container);
    } catch (error) {
      appLogger.error('Error appending to app container:', error);
      // Emergency fallback - append directly to body
      try {
        document.body.appendChild(this.container);
      } catch (bodyError) {
        appLogger.error('Critical error: Failed to append to document body:', bodyError);
      }
    }
    
    // Focus the input field for chat views
    if (['ai-assistant', 'new-chat'].includes(this.currentSection)) {
      setTimeout(() => {
        // Delay focus to ensure DOM is fully rendered
        if (this.chatUI) {
          this.chatUI.focusInput();
        }
      }, 100);
    }
    
    appLogger.info('App rendering complete');
  }

  /**
   * Clean up app resources
   */
  cleanup() {
    window.removeEventListener('resize', this.handleResize.bind(this));
    
    // Remove event listeners
    document.removeEventListener('content:selected', this.handleContentSelected);
    document.removeEventListener('content:updated', this.handleContentUpdated);
    document.removeEventListener('settings:changed', null);
    
    // Clean up components
    if (this.sidebar) this.sidebar.cleanup();
    if (this.chatHeader) this.chatHeader.cleanup();
    if (this.chatUI) this.chatUI.cleanup();
    if (this.themeSwitcher) { /* no cleanup needed */ }
    if (this.footer) { /* no cleanup needed */ }
    if (this.mnemosyne) { /* no cleanup needed */ }
    if (this.sieve) this.sieve.cleanup();
    if (this.contentViewer) { /* no cleanup needed */ }
    if (this.anthology) this.anthology.cleanup();
    if (this.searchSection) { /* no cleanup needed */ }
    if (this.header) { /* no cleanup needed */ }
    if (this.settings) this.settings.cleanup();
    if (this.browser) this.browser.cleanup();
    
    // Remove document listeners from DocProcessor
    if (this.documentManager) {
      this.documentManager.removeDocumentListener(this.handleDocumentEvent.bind(this));
    }
    
    // Remove overlay if exists
    if (this.sidebarOverlay && this.sidebarOverlay.parentNode) {
      this.sidebarOverlay.parentNode.removeChild(this.sidebarOverlay);
    }
    
    // Remove any chat input containers that might be left in the DOM
    const inputContainers = document.querySelectorAll('.chat-input-container');
    inputContainers.forEach(container => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });
    
    // Remove container
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    // Remove body classes
    document.body.classList.remove('chat-layout', 'mobile-view', 'sidebar-visible');
    
    this.container = null;
    this.sidebar = null;
    this.chatHeader = null;
    this.chatUI = null;
    this.sidebarOverlay = null;
    this.themeSwitcher = null;
    this.footer = null;
    this.mnemosyne = null;
    this.sieve = null;
    this.contentViewer = null;
    this.searchSection = null;
    this.header = null;
    this.documentManager = null;
    this.anthology = null;
    this.settings = null;
    this.browser = null;
    
    appLogger.info('App cleanup complete');
  }

  // Add cleanup method to properly unmount component when navigating away
  componentDidUpdate(prevProps, prevState) {
    if (prevState.navigationItem === 'voyager' || prevState.navigationItem === 'browser') {
      if (this.state.navigationItem !== 'voyager' && this.state.navigationItem !== 'browser') {
        // Clean up browser component when navigating away
        this.cleanupBrowser();
      }
    }
  }

  cleanupBrowser() {
    // In React 18, we don't use unmountComponentAtNode anymore
    const browserMount = document.getElementById('browser-mount');
    if (browserMount && browserMount.parentNode) {
      try {
        console.log('[App] Removing browser mount from DOM');
        browserMount.parentNode.removeChild(browserMount);
      } catch (error) {
        console.error('[App] Error removing browser mount:', error);
      }
    }
    
    // Call cleanup on component if available
    if (this.browserRef.current && typeof this.browserRef.current.cleanup === 'function') {
      this.browserRef.current.cleanup();
    }
  }

  componentWillUnmount() {
    // Clean up browser when component unmounts
    this.cleanupBrowser();
    
    // ... existing cleanup code ...
  }
}

export default App; 