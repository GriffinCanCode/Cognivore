/**
 * ChatHeader Component - Header for the chat interface
 */
class ChatHeader {
  /**
   * Constructor for ChatHeader component
   * @param {string} title - The title to display in the header
   */
  constructor(title = 'Cognivore') {
    this.title = title;
    this.container = null;
    this.onMenuToggle = null;
    this.onNewChat = null;
  }

  /**
   * Set the menu toggle callback
   * @param {Function} callback - Function to call when menu button is clicked
   */
  setMenuToggleCallback(callback) {
    this.onMenuToggle = callback;
    
    // Add handler to existing button if already rendered
    if (this.container) {
      const menuButton = this.container.querySelector('.mobile-menu-toggle');
      if (menuButton) {
        menuButton.addEventListener('click', this.onMenuToggle);
      }
    }
  }

  /**
   * Set the new chat callback
   * @param {Function} callback - Function to call when new chat button is clicked
   */
  setNewChatCallback(callback) {
    this.onNewChat = callback;
    
    // Add handler to existing button if already rendered
    if (this.container) {
      const newChatButton = this.container.querySelector('.new-chat-button');
      if (newChatButton) {
        newChatButton.addEventListener('click', this.onNewChat);
      }
    }
  }

  /**
   * Render the header component
   * @returns {HTMLElement} - The rendered header
   */
  render() {
    const header = document.createElement('div');
    header.className = 'chat-header';
    
    // Left side - Title with menu toggle for mobile
    const titleContainer = document.createElement('div');
    titleContainer.className = 'app-title';
    
    // Add mobile menu toggle button
    const menuToggle = document.createElement('button');
    menuToggle.className = 'mobile-menu-toggle';
    menuToggle.setAttribute('aria-label', 'Toggle navigation menu');
    menuToggle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;
    
    // Add click handler if callback exists
    if (this.onMenuToggle) {
      menuToggle.addEventListener('click', this.onMenuToggle);
    }
    
    // App title
    const titleText = document.createElement('span');
    titleText.textContent = this.title;
    
    // Add app icon
    const appIcon = document.createElement('div');
    appIcon.className = 'app-icon';
    appIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
      </svg>
    `;
    
    titleContainer.appendChild(menuToggle);
    titleContainer.appendChild(appIcon);
    titleContainer.appendChild(titleText);
    
    // Right side - Action buttons
    const actions = document.createElement('div');
    actions.className = 'header-actions';
    
    // New Chat button
    const newChatButton = document.createElement('button');
    newChatButton.className = 'header-button new-chat-button';
    newChatButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      <span>New Chat</span>
    `;
    
    // Add click handler for new chat button if callback exists
    if (this.onNewChat) {
      newChatButton.addEventListener('click', this.onNewChat);
    }
    
    actions.appendChild(newChatButton);
    
    // User menu (simplified)
    const userMenu = document.createElement('div');
    userMenu.className = 'user-menu';
    userMenu.innerHTML = `
      <div class="user-avatar">U</div>
    `;
    
    actions.appendChild(userMenu);
    
    header.appendChild(titleContainer);
    header.appendChild(actions);
    
    this.container = header;
    return header;
  }
  
  /**
   * Clean up component resources
   */
  cleanup() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

export default ChatHeader; 