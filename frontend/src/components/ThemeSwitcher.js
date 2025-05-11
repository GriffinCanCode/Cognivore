// ThemeSwitcher component
class ThemeSwitcher {
  constructor() {
    this.isDarkTheme = true; // Default to dark theme
    this.container = null;
    this.toggle = null;
    
    // Apply dark theme immediately
    this.applyTheme();
    
    // Attempt to load saved theme preference from localStorage
    this.loadThemePreference();
  }
  
  loadThemePreference() {
    try {
      const savedTheme = localStorage.getItem('theme-preference');
      // Only use light theme if explicitly set
      if (savedTheme === 'light') {
        this.isDarkTheme = false;
        this.applyTheme();
      } else {
        // If no preference or 'dark', ensure dark theme
        this.isDarkTheme = true;
        this.applyTheme();
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
      // Default to dark theme on error
      this.isDarkTheme = true;
      this.applyTheme();
    }
  }
  
  saveThemePreference() {
    try {
      localStorage.setItem('theme-preference', this.isDarkTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }
  
  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    
    // Save preference
    this.saveThemePreference();
    
    // Apply theme
    this.applyTheme();
    
    // Update toggle appearance
    this.updateToggle();
    
    // Dispatch event for other components
    document.dispatchEvent(new CustomEvent('theme:changed', { detail: { isDark: this.isDarkTheme } }));
  }
  
  applyTheme() {
    if (this.isDarkTheme) {
      document.body.classList.remove('light-theme');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.body.classList.add('light-theme');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }
  
  updateToggle() {
    if (!this.toggle) return;
    
    const thumb = this.toggle.querySelector('.toggle-thumb');
    if (!thumb) return;
    
    // Reset animation classes
    thumb.classList.remove('animate-toggle-on', 'animate-toggle-off');
    
    // Update position explicitly
    if (this.isDarkTheme) {
      thumb.style.left = '3px';
    } else {
      thumb.style.left = 'calc(100% - 19px - 3px)';
    }
    
    // Add animation class based on current state
    if (this.isDarkTheme) {
      thumb.classList.add('animate-toggle-off');
      thumb.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
          <path d="M12 3a2.5 2.5 0 002.5 2.5c0-1.38 1.12-2.5 2.5-2.5-1.38 0-2.5-1.12-2.5-2.5C14.5 1.12 13.38 0 12 0c1.38 0 2.5 1.12 2.5 2.5 0 .17-.01.33-.05.5-.05-.17-.13-.33-.2-.5-.35.17-.64.46-.81.81a2.7 2.7 0 01-.74.74c.47.28.84.65 1.12 1.12.41.65.63 1.4.63 2.33 0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4z"/>
        </svg>
      `;
    } else {
      thumb.classList.add('animate-toggle-on');
      thumb.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
          <circle cx="12" cy="12" r="5"></circle>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
        </svg>
      `;
    }
    
    // Update aria attribute
    this.toggle.setAttribute('aria-checked', this.isDarkTheme ? 'true' : 'false');
    
    // Update theme text
    const themeText = this.container.querySelector('.theme-text');
    if (themeText) {
      themeText.textContent = this.isDarkTheme ? 'Dark Mode' : 'Light Mode';
    }
  }
  
  render() {
    const container = document.createElement('div');
    container.className = 'theme-switcher fade-in';
    
    // Create theme text
    const themeText = document.createElement('span');
    themeText.className = 'theme-text';
    themeText.textContent = this.isDarkTheme ? 'Dark Mode' : 'Light Mode';
    
    // Create toggle switch
    const toggle = document.createElement('div');
    toggle.className = 'theme-toggle';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', this.isDarkTheme ? 'true' : 'false');
    toggle.setAttribute('tabindex', '0');
    
    // Create toggle thumb
    const toggleThumb = document.createElement('div');
    toggleThumb.className = 'toggle-thumb';
    
    // Set position based on current theme
    if (this.isDarkTheme) {
      toggleThumb.style.left = '3px';
    } else {
      toggleThumb.style.left = 'calc(100% - 19px - 3px)';
    }
    
    // Add icon based on current theme
    toggleThumb.innerHTML = this.isDarkTheme 
      ? `<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
          <path d="M12 3a2.5 2.5 0 002.5 2.5c0-1.38 1.12-2.5 2.5-2.5-1.38 0-2.5-1.12-2.5-2.5C14.5 1.12 13.38 0 12 0c1.38 0 2.5 1.12 2.5 2.5 0 .17-.01.33-.05.5-.05-.17-.13-.33-.2-.5-.35.17-.64.46-.81.81a2.7 2.7 0 01-.74.74c.47.28.84.65 1.12 1.12.41.65.63 1.4.63 2.33 0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4z"/>
         </svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
          <circle cx="12" cy="12" r="5"></circle>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
         </svg>`;
    
    // Add to toggle
    toggle.appendChild(toggleThumb);
    
    // Add click handler
    toggle.addEventListener('click', () => this.toggleTheme());
    
    // Add keyboard support
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleTheme();
      }
    });
    
    // Add to container
    container.appendChild(themeText);
    container.appendChild(toggle);
    
    // Store references
    this.container = container;
    this.toggle = toggle;
    
    return container;
  }
  
  // Force theme to dark regardless of saved preferences
  forceDarkTheme() {
    this.isDarkTheme = true;
    this.applyTheme();
    this.saveThemePreference();
    if (this.toggle) {
      this.updateToggle();
    }
  }
}

export default ThemeSwitcher; 