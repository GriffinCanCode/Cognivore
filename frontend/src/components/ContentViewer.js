// ContentViewer component
class ContentViewer {
  constructor() {
    this.container = null;
    this.metadataContainer = null;
    this.textContainer = null;
    this.closeButton = null;
    this.currentItemData = null;
  }
  
  render() {
    const section = document.createElement('section');
    section.id = 'content-viewer';
    section.classList.add('content-viewer-hidden');
    section.style.display = 'none';
    
    const header = document.createElement('div');
    header.className = 'content-viewer-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Content Details';
    
    this.closeButton = document.createElement('button');
    this.closeButton.className = 'close-button';
    this.closeButton.textContent = 'Close';
    this.closeButton.addEventListener('click', () => {
      section.classList.add('content-viewer-hidden');
      setTimeout(() => {
        section.style.display = 'none';
      }, 300);
    });
    
    header.appendChild(title);
    header.appendChild(this.closeButton);
    
    this.metadataContainer = document.createElement('div');
    this.metadataContainer.className = 'content-metadata';
    
    this.textContainer = document.createElement('div');
    this.textContainer.className = 'content-text';
    
    // Create actions container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'content-actions';
    
    // Add action buttons
    const copyButton = this.createActionButton('Copy Text', this.copyText.bind(this), `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `);
    
    const exportButton = this.createActionButton('Export', this.exportContent.bind(this), `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `);
    
    actionsContainer.appendChild(copyButton);
    actionsContainer.appendChild(exportButton);
    
    section.appendChild(header);
    section.appendChild(this.metadataContainer);
    section.appendChild(this.textContainer);
    section.appendChild(actionsContainer);
    
    this.container = section;
    return section;
  }
  
  createActionButton(text, clickHandler, iconSvg) {
    const button = document.createElement('button');
    button.className = 'content-action-button';
    button.innerHTML = iconSvg + text;
    button.addEventListener('click', clickHandler);
    return button;
  }
  
  copyText() {
    if (!this.currentItemData) return;
    
    const text = this.currentItemData.textChunk || '';
    navigator.clipboard.writeText(text)
      .then(() => {
        // Show brief confirmation
        const copyButton = this.container.querySelector('.content-actions button:first-child');
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"></path>
          </svg>
          Copied!
        `;
        
        setTimeout(() => {
          copyButton.innerHTML = originalText;
        }, 2000);
      })
      .catch(err => console.error('Error copying text:', err));
  }
  
  exportContent() {
    if (!this.currentItemData) return;
    
    const fileName = `knowledge-content-${Date.now()}.txt`;
    const content = this.currentItemData.textChunk || '';
    
    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  viewItem(itemId, itemData) {
    if (!itemData) {
      console.error('No item data provided for viewing');
      return;
    }
    
    this.currentItemData = itemData;
    
    // Display the container
    this.container.style.display = 'block';
    
    // Remove hidden class after a small delay to trigger animation
    setTimeout(() => {
      this.container.classList.remove('content-viewer-hidden');
    }, 10);
    
    // Prepare source display
    const sourceDisplay = this.formatSourceForDisplay(itemData);
    
    // Populate metadata section
    this.metadataContainer.innerHTML = `
      <h3>${itemData.title || 'Untitled Content'}</h3>
      <div class="metadata-details">
        <p><strong>Source Type:</strong> ${itemData.sourceType}</p>
        <p><strong>Source:</strong> ${sourceDisplay}</p>
        <p><strong>Added:</strong> ${this.formatDate(itemData.dateAdded || new Date())}</p>
        <p><strong>ID:</strong> ${itemId}</p>
      </div>
    `;
    
    // Format and populate text section
    const formattedText = this.formatTextContent(itemData.textChunk || 'No content available');
    this.textContainer.innerHTML = formattedText;
    
    // Scroll to content viewer
    this.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  
  formatSourceForDisplay(itemData) {
    const source = itemData.sourceIdentifier || '';
    
    if (itemData.sourceType.toLowerCase() === 'url' && source.startsWith('http')) {
      return `<a href="${source}" class="metadata-source-link" target="_blank">${source}</a>`;
    } else if (itemData.sourceType.toLowerCase() === 'youtube' && source.includes('youtube.com')) {
      return `<a href="${source}" class="metadata-source-link" target="_blank">${source}</a>`;
    }
    
    return source;
  }
  
  formatTextContent(text) {
    // Basic formatting for better readability
    let formatted = text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .trim();
    
    return `<p>${formatted}</p>`;
  }
  
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return 'Unknown date';
    }
  }
}

export default ContentViewer; 