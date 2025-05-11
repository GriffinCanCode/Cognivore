/**
 * Main App Component - Coordinates the Knowledge Store application
 */
import Sidebar from './Sidebar.js';
import ChatHeader from './ChatHeader.js';
import ChatUI from './ChatUI.js';

class App {
  constructor() {
    this.container = null;
    this.sidebar = null;
    this.chatHeader = null;
    this.chatUI = null;
    this.sidebarOverlay = null;
    this.isMobile = window.innerWidth < 768;
  }

  /**
   * Initialize the app
   */
  init() {
    console.log('App.init called');
    
    // Create notification service (can be null for now)
    const notificationService = null;
    
    // Create components
    this.sidebar = new Sidebar(this.handleNavigation.bind(this));
    this.chatHeader = new ChatHeader('Knowledge Store');
    
    // Create ChatUI with notification service
    this.chatUI = new ChatUI(notificationService);
    
    // Pass app reference to ChatUI
    this.chatUI.app = this;
    
    // Ensure handleSubmit is bound to the ChatUI instance
    this.chatUI.handleSubmit = this.chatUI.handleSubmit.bind(this.chatUI);
    
    // Set mobile menu toggle callback
    this.chatHeader.setMenuToggleCallback(this.toggleMobileMenu.bind(this));
    
    // Initialize chat UI
    console.log('Initializing ChatUI...');
    this.chatUI.initialize();
    
    // Render the app
    this.render();
    
    // Add resize listener
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  /**
   * Handle sidebar navigation item clicks
   * @param {string} itemId - The ID of the clicked item
   */
  handleNavigation(itemId) {
    // Set active navigation item
    this.sidebar.setActiveItem(itemId);
    
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
    
    console.log(`Navigation: ${itemId}`);
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
    console.log('App.render called');
    
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
    
    // Create main content
    const mainContent = document.createElement('div');
    mainContent.className = 'main-content';
    
    // Render chat header
    const headerElement = this.chatHeader.render();
    mainContent.appendChild(headerElement);
    
    // Render chat UI
    console.log('Rendering ChatUI component');
    const chatElement = this.chatUI.render();
    mainContent.appendChild(chatElement);
    
    // Get the chat input element from ChatUI
    const inputElement = this.chatUI.getInputElement();
    mainContent.appendChild(inputElement);
    
    this.container.appendChild(mainContent);
    
    // Mount to DOM
    document.getElementById('app').appendChild(this.container);
    
    // Focus the input field
    setTimeout(() => {
      // Delay focus to ensure DOM is fully rendered
      this.chatUI.focusInput();
    }, 100);
    
    console.log('App rendering complete');
  }

  /**
   * Clean up app resources
   */
  cleanup() {
    window.removeEventListener('resize', this.handleResize.bind(this));
    
    // Clean up components
    if (this.sidebar) this.sidebar.cleanup();
    if (this.chatHeader) this.chatHeader.cleanup();
    if (this.chatUI) this.chatUI.cleanup();
    
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
  }
}

export default App; 