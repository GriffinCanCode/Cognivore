/**
 * Sidebar Component - Main navigation sidebar for the Cognivore app
 */
class Sidebar {
  /**
   * Constructor for Sidebar component
   * @param {Function} onNavItemClick - Callback for navigation item clicks
   */
  constructor(onNavItemClick) {
    this.container = null;
    this.onNavItemClick = onNavItemClick || (() => {});
    this.isCollapsed = true;
  }

  /**
   * Toggle sidebar collapsed state
   */
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    document.body.classList.toggle('sidebar-collapsed', this.isCollapsed);
    
    // Update sidebar toggle icon rotation
    if (this.container) {
      const toggleIcon = this.container.querySelector('.sidebar-toggle svg');
      if (toggleIcon) {
        toggleIcon.style.transform = this.isCollapsed ? 'rotate(180deg)' : '';
      }
    }
  }

  /**
   * Set the active navigation item
   * @param {string} itemId - The ID of the active item
   */
  setActiveItem(itemId) {
    if (!this.container) return;
    
    // Remove active class from all items
    const items = this.container.querySelectorAll('.nav-item');
    items.forEach(item => item.classList.remove('active'));
    
    // Add active class to the specified item
    const activeItem = this.container.querySelector(`[data-nav-id="${itemId}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }
  }

  /**
   * Render the sidebar component
   * @returns {HTMLElement} - The rendered sidebar
   */
  render() {
    const sidebar = document.createElement('div');
    sidebar.className = 'app-sidebar';
    
    // Apply collapsed state on initial render
    if (this.isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    }
    
    // Sidebar Header with Logo
    const sidebarHeader = document.createElement('div');
    sidebarHeader.className = 'sidebar-header';
    
    const sidebarLogo = document.createElement('div');
    sidebarLogo.className = 'sidebar-logo';
    
    // Logo SVG
    sidebarLogo.innerHTML = `
      <img src="../../logo-transparent.png" width="36" height="36" style="margin-bottom: 2px;" alt="Cognivore Logo" />
      <span class="sidebar-logo-text">Cognivore</span>
    `;
    
    sidebarHeader.appendChild(sidebarLogo);
    sidebar.appendChild(sidebarHeader);
    
    // Sidebar Navigation
    const sidebarNav = document.createElement('div');
    sidebarNav.className = 'sidebar-nav';
    
    // Chat Section
    const chatSection = document.createElement('div');
    chatSection.className = 'nav-section';
    
    const chatSectionTitle = document.createElement('div');
    chatSectionTitle.className = 'nav-section-title';
    chatSectionTitle.textContent = 'Chat';
    chatSection.appendChild(chatSectionTitle);
    
    const chatNav = document.createElement('a');
    chatNav.className = 'nav-item active';
    chatNav.dataset.navId = 'ai-assistant';
    chatNav.innerHTML = `
      <svg class="nav-item-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="nav-item-text">Cognivore</span>
    `;
    chatNav.addEventListener('click', () => this.onNavItemClick('ai-assistant'));
    chatSection.appendChild(chatNav);
    
    sidebarNav.appendChild(chatSection);
    
    // Library Section
    const librarySection = document.createElement('div');
    librarySection.className = 'nav-section';
    
    const librarySectionTitle = document.createElement('div');
    librarySectionTitle.className = 'nav-section-title';
    librarySectionTitle.textContent = 'Library';
    librarySection.appendChild(librarySectionTitle);
    
    const navItems = [
      {
        id: 'documents',
        text: 'Mnemosyne',
        icon: `<svg class="nav-item-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
      },
      {
        id: 'sieve',
        text: 'Sieve',
        icon: `<svg class="nav-item-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>`,
      },
      {
        id: 'browser',
        text: 'Browser',
        icon: `<svg class="nav-item-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
      },
      {
        id: 'anthology',
        text: 'Anthology',
        icon: `<svg class="nav-item-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
      }
    ];
    
    navItems.forEach(item => {
      const navItem = document.createElement('a');
      navItem.className = 'nav-item';
      navItem.dataset.navId = item.id;
      navItem.innerHTML = `
        ${item.icon}
        <span class="nav-item-text">${item.text}</span>
      `;
      navItem.addEventListener('click', () => this.onNavItemClick(item.id));
      librarySection.appendChild(navItem);
    });
    
    sidebarNav.appendChild(librarySection);
    
    // Settings Section
    const settingsSection = document.createElement('div');
    settingsSection.className = 'nav-section';
    
    const settingsSectionTitle = document.createElement('div');
    settingsSectionTitle.className = 'nav-section-title';
    settingsSectionTitle.textContent = 'Settings';
    settingsSection.appendChild(settingsSectionTitle);
    
    const settingsNavItems = [
      {
        id: 'preferences',
        text: 'Preferences',
        icon: `<svg class="nav-item-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
      },
      {
        id: 'api-settings',
        text: 'API Settings',
        icon: `<svg class="nav-item-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
      }
    ];
    
    settingsNavItems.forEach(item => {
      const navItem = document.createElement('a');
      navItem.className = 'nav-item';
      navItem.dataset.navId = item.id;
      navItem.innerHTML = `
        ${item.icon}
        <span class="nav-item-text">${item.text}</span>
      `;
      navItem.addEventListener('click', () => this.onNavItemClick(item.id));
      settingsSection.appendChild(navItem);
    });
    
    sidebarNav.appendChild(settingsSection);
    sidebar.appendChild(sidebarNav);
    
    // Sidebar Footer
    const sidebarFooter = document.createElement('div');
    sidebarFooter.className = 'sidebar-footer';
    
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.innerHTML = `
      <div class="user-avatar">U</div>
      <div class="user-details">
        <div class="user-name">User</div>
        <div class="user-role">Free Account</div>
      </div>
    `;
    
    const sidebarToggle = document.createElement('button');
    sidebarToggle.className = 'sidebar-toggle';
    sidebarToggle.setAttribute('aria-label', 'Toggle sidebar');
    sidebarToggle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    `;
    
    sidebarToggle.addEventListener('click', () => this.toggleCollapse());
    
    sidebarFooter.appendChild(userInfo);
    sidebarFooter.appendChild(sidebarToggle);
    sidebar.appendChild(sidebarFooter);
    
    this.container = sidebar;
    return sidebar;
  }

  /**
   * Create the mobile sidebar overlay
   * @returns {HTMLElement} - The sidebar overlay element
   */
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', () => {
      document.body.classList.remove('sidebar-visible');
    });
    return overlay;
  }
  
  /**
   * Clean up component resources
   */
  cleanup() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    const overlays = document.querySelectorAll('.sidebar-overlay');
    overlays.forEach(overlay => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    
    this.container = null;
  }
}

export default Sidebar; 