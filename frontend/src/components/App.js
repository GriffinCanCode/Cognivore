/**
 * Main App Component - Coordinates the Cognivore application
 */
import Sidebar from './Sidebar.js';
import ChatHeader from './ChatHeader.js';
import ChatUI from './ChatUI.js';
import ThemeSwitcher from './ThemeSwitcher.js';
import Footer from './Footer.js';
import ContentViewer from './ContentViewer.js';
import SearchSection from './SearchSection.js';
import Header from './Header.js';
import Mnemosyne from './Mnemosyne.js';
import Sieve from './Sieve.js';
import DocProcessor from '../services/DocProcessorService.js';
import logger from '../utils/logger.js';
import Anthology from './Anthology.js';

// Create context-specific logger
const appLogger = logger.scope('App');

class App {
  constructor() {
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
    
    // Bind methods
    this.handleNavigation = this.handleNavigation.bind(this);
    this.handleContentSelected = this.handleContentSelected.bind(this);
    this.handleContentUpdated = this.handleContentUpdated.bind(this);
  }

  /**
   * Initialize the app
   */
  init() {
    appLogger.info('App.init called');
    
    // Create notification service (can be null for now)
    const notificationService = null;
    
    // Create components
    this.sidebar = new Sidebar(this.handleNavigation.bind(this));
    this.chatHeader = new ChatHeader('Cognivore');
    
    // Create ChatUI with notification service
    this.chatUI = new ChatUI(notificationService);
    
    // Connect ChatUI to ChatHeader
    this.chatUI.setHeaderComponent(this.chatHeader);
    
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
    
    // Set active navigation item
    this.sidebar.setActiveItem(itemId);
    
    // Save current section
    this.currentSection = itemId;
    
    // Handle specific navigation actions
    if (itemId === 'ai-assistant' && this.chatUI) {
      // For AI Assistant, just make sure it's visible and has focus
      this.chatUI.focusInput();
    } else if (itemId === 'new-chat' && this.chatUI) {
      // For new chat, clear the messages and start fresh
      this.chatUI.handleNewChat();
      this.chatUI.focusInput();
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
   * Render the app
   */
  render() {
    appLogger.info('App.render called');
    
    // Clear any existing app container
    const existingApp = document.getElementById('app');
    if (existingApp) {
      while (existingApp.firstChild) {
        existingApp.removeChild(existingApp.firstChild);
      }
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
    
    // Mount to DOM
    document.getElementById('app').appendChild(this.container);
    
    // Focus the input field for chat views
    if (['ai-assistant', 'new-chat'].includes(this.currentSection)) {
      setTimeout(() => {
        // Delay focus to ensure DOM is fully rendered
        this.chatUI.focusInput();
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
    
    appLogger.info('App cleanup complete');
  }
}

export default App; 