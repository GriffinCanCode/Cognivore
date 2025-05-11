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
    
    // Header with title and close button
    const header = document.createElement('div');
    header.className = 'content-viewer-header';
    
    const title = document.createElement('h2');
    title.className = 'content-viewer-title';
    title.textContent = 'Content Details';
    
    this.closeButton = document.createElement('button');
    this.closeButton.className = 'content-viewer-close';
    this.closeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    this.closeButton.addEventListener('click', () => {
      section.classList.add('content-viewer-hidden');
      setTimeout(() => {
        section.style.display = 'none';
      }, 300);
    });
    
    header.appendChild(title);
    header.appendChild(this.closeButton);
    
    // Inner content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-viewer-wrapper';
    
    // Metadata section
    this.metadataContainer = document.createElement('div');
    this.metadataContainer.className = 'content-metadata';
    
    // Text content section with hidden scrollbars
    this.textContainer = document.createElement('div');
    this.textContainer.className = 'content-text-wrapper';
    
    const textInner = document.createElement('div');
    textInner.className = 'content-text';
    this.textContainer.appendChild(textInner);
    
    // Create actions container with modern styling
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'content-actions';
    
    // Add action buttons with improved styling
    const copyButton = this.createActionButton('Copy Text', this.copyText.bind(this), `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `, 'copy-button');
    
    const exportButton = this.createActionButton('Export', this.exportContent.bind(this), `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `, 'export-button');
    
    actionsContainer.appendChild(copyButton);
    actionsContainer.appendChild(exportButton);
    
    // Assemble the content sections
    contentWrapper.appendChild(this.metadataContainer);
    contentWrapper.appendChild(this.textContainer);
    contentWrapper.appendChild(actionsContainer);
    
    // Add all elements to main container
    section.appendChild(header);
    section.appendChild(contentWrapper);
    
    this.container = section;
    return section;
  }
  
  createActionButton(text, clickHandler, iconSvg, className = '') {
    const button = document.createElement('button');
    button.className = `content-action-button ${className}`;
    button.innerHTML = iconSvg + `<span>${text}</span>`;
    button.addEventListener('click', clickHandler);
    return button;
  }
  
  copyText() {
    if (!this.currentItemData) return;
    
    const text = this.currentItemData.textChunk || '';
    navigator.clipboard.writeText(text)
      .then(() => {
        // Show brief confirmation
        const copyButton = this.container.querySelector('.copy-button');
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"></path>
          </svg>
          <span>Copied!</span>
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
    
    // Prepare source type badge with color
    const typeBadge = this.getSourceTypeBadge(itemData.sourceType);
    
    // Populate metadata section with enhanced design
    this.metadataContainer.innerHTML = `
      <div class="metadata-header">
        <div class="metadata-title-row">
          ${typeBadge}
          <h3>${itemData.title || 'Untitled Content'}</h3>
        </div>
        <div class="metadata-date">${this.formatDate(itemData.dateAdded || new Date())}</div>
      </div>
      <div class="metadata-details">
        <div class="metadata-item">
          <div class="metadata-label">Source</div>
          <div class="metadata-value source-value">${sourceDisplay}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Content ID</div>
          <div class="metadata-value id-value">${itemId}</div>
        </div>
      </div>
    `;
    
    // Format and populate text section
    const formattedText = this.formatTextContent(itemData.textChunk || 'No content available');
    this.textContainer.querySelector('.content-text').innerHTML = formattedText;
    
    // Scroll to content viewer with smooth animation
    this.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  
  getSourceTypeBadge(sourceType) {
    let badgeColor = '#95a5a6';
    let badgeIcon = '';
    
    if (sourceType) {
      switch (sourceType.toLowerCase()) {
        case 'pdf':
          badgeColor = '#e74c3c';
          badgeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>`;
          break;
        case 'url':
          badgeColor = '#3498db';
          badgeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>`;
          break;
        case 'youtube':
          badgeColor = '#e67e22';
          badgeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      </svg>`;
          break;
      }
    }
    
    return `<div class="metadata-type-badge" style="background-color: ${badgeColor}">
              ${badgeIcon}
              <span>${sourceType || 'Unknown'}</span>
            </div>`;
  }
  
  formatSourceForDisplay(itemData) {
    const source = itemData.sourceIdentifier || '';
    
    if (itemData.sourceType && itemData.sourceType.toLowerCase() === 'url' && source.startsWith('http')) {
      return `<a href="${source}" class="metadata-source-link" target="_blank">${source}</a>`;
    } else if (itemData.sourceType && itemData.sourceType.toLowerCase() === 'youtube' && source.includes('youtube.com')) {
      return `<a href="${source}" class="metadata-source-link" target="_blank">${source}</a>`;
    }
    
    return source;
  }
  
  formatTextContent(text) {
    // Enhanced formatting with proper paragraph handling and link detection
    let formatted = text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .trim();
    
    // Convert URLs to clickable links
    formatted = formatted.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" class="content-text-link">$1</a>'
    );
    
    return `<p>${formatted}</p>`;
  }
  
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Unknown date';
    }
  }
}

export default ContentViewer; 