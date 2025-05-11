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
    footer.classList.add('app-footer');
    
    // Create compact footer content
    const footerContent = document.createElement('div');
    footerContent.className = 'footer-content';
    
    // Version and copyright in one line
    const infoContainer = document.createElement('div');
    infoContainer.className = 'footer-info';
    
    const versionEl = document.createElement('span');
    versionEl.className = 'footer-version';
    versionEl.textContent = `Cognivore v${this.version}`;
    
    const copyrightEl = document.createElement('span');
    copyrightEl.className = 'footer-copyright';
    copyrightEl.textContent = `© ${this.currentYear} Cognivore`;
    
    infoContainer.appendChild(versionEl);
    infoContainer.appendChild(document.createTextNode(' • '));
    infoContainer.appendChild(copyrightEl);
    
    // Create links in one row
    const linksContainer = document.createElement('div');
    linksContainer.className = 'footer-links';
    
    this.links.forEach((link, index) => {
      const linkEl = document.createElement('a');
      linkEl.className = 'footer-link';
      linkEl.href = link.url;
      linkEl.textContent = link.label;
      
      linksContainer.appendChild(linkEl);
      
      // Add separator between links except the last one
      if (index < this.links.length - 1) {
        const separator = document.createElement('span');
        separator.className = 'footer-separator';
        separator.textContent = '•';
        linksContainer.appendChild(separator);
      }
    });
    
    // Add all elements to footer
    footerContent.appendChild(infoContainer);
    footerContent.appendChild(linksContainer);
    footer.appendChild(footerContent);
    
    return footer;
  }
}

export default Footer;