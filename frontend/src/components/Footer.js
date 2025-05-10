// Footer component
class Footer {
  constructor() {
    this.currentYear = new Date().getFullYear();
    this.version = '0.1.0';
    this.links = [
      { label: 'Documentation', url: '#documentation' },
      { label: 'GitHub', url: '#github' },
      { label: 'Report Issue', url: '#issues' },
      { label: 'Privacy Policy', url: '#privacy' }
    ];
  }
  
  render() {
    const footer = document.createElement('footer');
    footer.classList.add('fade-in');
    
    // Create version element
    const versionEl = document.createElement('p');
    versionEl.className = 'footer-version';
    versionEl.textContent = `Knowledge Store v${this.version}`;
    
    // Create links
    const linksContainer = document.createElement('div');
    linksContainer.className = 'footer-links';
    
    this.links.forEach(link => {
      const linkEl = document.createElement('a');
      linkEl.className = 'footer-link';
      linkEl.href = link.url;
      linkEl.textContent = link.label;
      
      linksContainer.appendChild(linkEl);
    });
    
    // Create copyright info
    const copyrightEl = document.createElement('p');
    copyrightEl.className = 'footer-copyright';
    copyrightEl.textContent = `© ${this.currentYear} Knowledge Store. All rights reserved.`;
    
    // Add all elements to footer
    footer.appendChild(versionEl);
    footer.appendChild(linksContainer);
    footer.appendChild(copyrightEl);
    
    return footer;
  }
}

export default Footer;