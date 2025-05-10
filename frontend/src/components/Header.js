// Header component
class Header {
  constructor() {
    this.navItems = [
      { label: 'Dashboard', action: () => this.navigateTo('dashboard') },
      { label: 'Knowledge Base', action: () => this.navigateTo('knowledge') },
      { label: 'Upload', action: () => this.navigateTo('upload') },
      { label: 'Settings', action: () => this.navigateTo('settings') }
    ];
  }
  
  navigateTo(section) {
    // Dispatch a custom event that other components can listen for
    const event = new CustomEvent('navigation:change', { 
      detail: { section }
    });
    document.dispatchEvent(event);
    
    // Update active button
    this.updateActiveButton(section);
  }
  
  updateActiveButton(activeSection) {
    // Remove active class from all buttons
    const buttons = document.querySelectorAll('.nav-button');
    buttons.forEach(button => button.classList.remove('active'));
    
    // Add active class to clicked button
    const activeButton = document.querySelector(`[data-section="${activeSection}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }
  }
  
  render() {
    const header = document.createElement('header');
    header.classList.add('fade-in');
    
    const title = document.createElement('h1');
    title.textContent = 'Knowledge Store';
    
    const subtitle = document.createElement('p');
    subtitle.textContent = "Your Personal Knowledge Management System";
    
    const navContainer = document.createElement('div');
    navContainer.className = 'nav-container';
    
    // Create navigation buttons
    this.navItems.forEach(item => {
      const button = document.createElement('button');
      button.className = 'nav-button';
      button.textContent = item.label;
      button.dataset.section = item.label.toLowerCase().replace(' ', '-');
      button.addEventListener('click', item.action);
      
      navContainer.appendChild(button);
    });
    
    header.appendChild(title);
    header.appendChild(subtitle);
    header.appendChild(navContainer);
    
    // Set dashboard as active by default
    setTimeout(() => this.updateActiveButton('dashboard'), 0);
    
    return header;
  }
}

export default Header; 