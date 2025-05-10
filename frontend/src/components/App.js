// Main App component
import Header from './Header.js';
import Footer from './Footer.js';
import SearchSection from './SearchSection.js';
import ContentInput from './ContentInput.js';
import ContentList from './ContentList.js';
import ContentViewer from './ContentViewer.js';
import Dashboard from './Dashboard.js';
import ThemeSwitcher from './ThemeSwitcher.js';
import NotificationService from '../services/NotificationService.js';

class App {
  constructor(container) {
    this.container = container;
    this.notificationService = new NotificationService();
    this.currentSection = 'dashboard'; // Default to dashboard
    
    // Initialize components
    this.header = new Header();
    this.footer = new Footer();
    this.searchSection = new SearchSection(this.notificationService);
    this.contentInput = new ContentInput(this.notificationService);
    this.contentList = new ContentList(this.notificationService);
    this.contentViewer = new ContentViewer();
    this.dashboard = new Dashboard(this.notificationService);
    this.themeSwitcher = new ThemeSwitcher();
    
    // Create main content container
    this.mainContent = document.createElement('main');
    
    // Set up event listeners for cross-component communication
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for content updates to refresh the list
    document.addEventListener('content:updated', () => {
      this.contentList.refreshItems();
      // Also refresh dashboard if it exists
      if (this.dashboard) {
        this.dashboard.initialize();
      }
    });
    
    // Listen for content selection to view details
    document.addEventListener('content:selected', (e) => {
      this.contentViewer.viewItem(e.detail.itemId, e.detail.itemData);
      
      // Ensure viewer is visible and scroll to it
      const viewerSection = document.getElementById('content-viewer');
      if (viewerSection) {
        viewerSection.style.display = 'block';
      }
    });
    
    // Listen for navigation changes
    document.addEventListener('navigation:change', (e) => {
      this.navigateToSection(e.detail.section);
    });
    
    // Listen for theme changes to update UI elements
    document.addEventListener('theme:changed', (e) => {
      // Additional theme-specific updates could be added here
    });
  }
  
  navigateToSection(section) {
    // Set current section
    this.currentSection = section;
    
    // Clear main content
    this.mainContent.innerHTML = '';
    
    // Render appropriate content based on section
    switch (section) {
      case 'dashboard':
        this.mainContent.appendChild(this.dashboard.render());
        break;
      
      case 'knowledge':
        // Create content list container
        const contentListContainer = document.createElement('section');
        contentListContainer.id = 'content-list-container';
        contentListContainer.className = 'fade-in';
        
        // Add title
        const contentListTitle = document.createElement('h2');
        contentListTitle.textContent = 'Knowledge Base';
        contentListContainer.appendChild(contentListTitle);
        
        // Add content list
        contentListContainer.appendChild(this.contentList.render());
        
        // Add viewer
        this.mainContent.appendChild(contentListContainer);
        this.mainContent.appendChild(this.contentViewer.render());
        
        // Initialize content list
        this.contentList.initialize();
        break;
      
      case 'search':
        this.mainContent.appendChild(this.searchSection.render());
        this.mainContent.appendChild(this.contentViewer.render());
        break;
      
      case 'upload':
        this.mainContent.appendChild(this.contentInput.render());
        break;
      
      case 'settings':
        this.renderSettingsSection();
        break;
        
      default:
        this.mainContent.appendChild(this.dashboard.render());
    }
  }
  
  renderSettingsSection() {
    const settingsSection = document.createElement('section');
    settingsSection.id = 'settings-section';
    settingsSection.className = 'fade-in';
    
    const title = document.createElement('h2');
    title.textContent = 'Settings';
    
    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'settings-container';
    
    // Theme settings
    const themeSettings = document.createElement('div');
    themeSettings.className = 'settings-group';
    
    const themeTitle = document.createElement('h3');
    themeTitle.textContent = 'Appearance';
    
    const themeDescription = document.createElement('p');
    themeDescription.textContent = 'Customize the appearance of the application.';
    
    const themeControl = document.createElement('div');
    themeControl.className = 'settings-control';
    
    const themeLabel = document.createElement('span');
    themeLabel.className = 'settings-label';
    themeLabel.textContent = 'Theme';
    
    // Create a theme toggle specific for settings
    const settingsThemeToggle = document.createElement('div');
    settingsThemeToggle.className = 'theme-toggle';
    settingsThemeToggle.setAttribute('role', 'switch');
    settingsThemeToggle.setAttribute('aria-checked', this.themeSwitcher.isDarkTheme ? 'true' : 'false');
    settingsThemeToggle.setAttribute('tabindex', '0');
    
    const toggleThumb = document.createElement('div');
    toggleThumb.className = 'toggle-thumb';
    
    // Set initial position based on current theme
    if (!this.themeSwitcher.isDarkTheme) {
      toggleThumb.style.left = 'calc(100% - 19px - 3px)';
    }
    
    // Add icon based on current theme
    toggleThumb.innerHTML = this.themeSwitcher.isDarkTheme 
      ? `<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
          <path d="M12 3a2.5 2.5 0 002.5 2.5c0-1.38 1.12-2.5 2.5-2.5-1.38 0-2.5-1.12-2.5-2.5C14.5 1.12 13.38 0 12 0c1.38 0 2.5 1.12 2.5 2.5 0 .17-.01.33-.05.5-.05-.17-.13-.33-.2-.5-.35.17-.64.46-.81.81a2.7 2.7 0 01-.74.74c.47.28.84.65 1.12 1.12.41.65.63 1.4.63 2.33 0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4z"/>
         </svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
          <circle cx="12" cy="12" r="5"></circle>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
         </svg>`;
    
    settingsThemeToggle.appendChild(toggleThumb);
    
    // Add theme labels
    const themeLabels = document.createElement('div');
    themeLabels.className = 'theme-labels';
    
    const darkLabel = document.createElement('span');
    darkLabel.textContent = 'Dark';
    darkLabel.className = this.themeSwitcher.isDarkTheme ? 'active' : '';
    
    const lightLabel = document.createElement('span');
    lightLabel.textContent = 'Light';
    lightLabel.className = !this.themeSwitcher.isDarkTheme ? 'active' : '';
    
    themeLabels.appendChild(darkLabel);
    themeLabels.appendChild(lightLabel);
    
    // Add click handler
    settingsThemeToggle.addEventListener('click', () => {
      this.themeSwitcher.toggleTheme();
      
      // Update this toggle's appearance
      const thumb = settingsThemeToggle.querySelector('.toggle-thumb');
      if (this.themeSwitcher.isDarkTheme) {
        thumb.style.left = '3px';
        darkLabel.className = 'active';
        lightLabel.className = '';
        settingsThemeToggle.setAttribute('aria-checked', 'true');
      } else {
        thumb.style.left = 'calc(100% - 19px - 3px)';
        darkLabel.className = '';
        lightLabel.className = 'active';
        settingsThemeToggle.setAttribute('aria-checked', 'false');
      }
    });
    
    themeControl.appendChild(themeLabel);
    themeControl.appendChild(settingsThemeToggle);
    themeControl.appendChild(themeLabels);
    
    themeSettings.appendChild(themeTitle);
    themeSettings.appendChild(themeDescription);
    themeSettings.appendChild(themeControl);
    
    // About section
    const aboutSection = document.createElement('div');
    aboutSection.className = 'settings-group';
    
    const aboutTitle = document.createElement('h3');
    aboutTitle.textContent = 'About';
    
    const appInfo = document.createElement('div');
    appInfo.className = 'app-info';
    
    const appLogo = document.createElement('div');
    appLogo.className = 'app-logo';
    appLogo.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
      </svg>
    `;
    
    const appDetails = document.createElement('div');
    appDetails.className = 'app-details';
    
    const appName = document.createElement('h4');
    appName.textContent = 'Knowledge Store';
    
    const appVersion = document.createElement('p');
    appVersion.textContent = 'Version 0.3.0';
    
    const appDescription = document.createElement('p');
    appDescription.textContent = 'A personal knowledge management system built with Electron.';
    
    appDetails.appendChild(appName);
    appDetails.appendChild(appVersion);
    appDetails.appendChild(appDescription);
    
    appInfo.appendChild(appLogo);
    appInfo.appendChild(appDetails);
    
    aboutSection.appendChild(aboutTitle);
    aboutSection.appendChild(appInfo);
    
    // Add all sections to settings container
    settingsContainer.appendChild(themeSettings);
    settingsContainer.appendChild(aboutSection);
    
    // Add to settings section
    settingsSection.appendChild(title);
    settingsSection.appendChild(settingsContainer);
    
    // Add to main content
    this.mainContent.appendChild(settingsSection);
  }

  render() {
    // Clear the container
    this.container.innerHTML = '';
    
    // Create main structure
    const headerElement = this.header.render();
    const footerElement = this.footer.render();
    
    // Render theme switcher
    const themeSwitcherElement = this.themeSwitcher.render();
    
    // Navigate to default section
    this.navigateToSection(this.currentSection);
    
    // Add everything to the container
    this.container.appendChild(headerElement);
    this.container.appendChild(this.mainContent);
    this.container.appendChild(footerElement);
    this.container.appendChild(themeSwitcherElement);
    
    return this.container;
  }
}

export default App; 