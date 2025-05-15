// Header component
class Header {
  constructor() {
    this.navItems = [
      { label: 'Knowledge Assistant', action: () => this.navigateTo('chat') }
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
    title.textContent = 'Cognivore';
    
    const subtitle = document.createElement('p');
    subtitle.textContent = "Your Personal Knowledge Management System";
    
    header.appendChild(title);
    header.appendChild(subtitle);
    
    // Set chat as active by default
    setTimeout(() => this.updateActiveButton('chat'), 0);
    
    return header;
  }
}

export default Header; 