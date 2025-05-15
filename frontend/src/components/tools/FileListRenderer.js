/**
 * FileListRenderer - Specialized renderer for file listing tool calls
 * Handles listAllFiles, listFilesByType, listFilesWithContent, and listRecentFiles tools
 */
import BaseToolRenderer from './BaseToolRenderer.js';

class FileListRenderer extends BaseToolRenderer {
  /**
   * Render a file listing tool call
   * @param {Object} toolCall - Tool call data to render
   * @returns {HTMLElement} - Rendered tool call element
   */
  render(toolCall) {
    // Get normalized data
    const toolName = toolCall.name || toolCall.toolName || '';
    const args = toolCall.args || toolCall.parameters || {};
    const content = toolCall.content || 'No files available';
    const status = toolCall.status || 'completed';
    
    // Create container with appropriate class
    const container = this.createContainer(toolCall);
    container.classList.add('file-list-renderer');
    
    // Add header with list icon
    container.appendChild(this.createHeader(toolCall));
    
    // Add filter information section
    const filterInfo = document.createElement('div');
    filterInfo.className = 'filter-info';
    
    // Determine filter type based on tool name
    let filterHTML = '';
    switch (toolName.toLowerCase()) {
      case 'listfilesbytype':
        filterHTML = `<div class="filter-item"><span class="filter-label">File Type:</span> ${args.fileType || 'All'}</div>`;
        break;
      case 'listfileswithcontent':
        filterHTML = `
          <div class="filter-item"><span class="filter-label">Content Query:</span> ${args.contentQuery || 'None'}</div>
          ${args.fileType ? `<div class="filter-item"><span class="filter-label">File Type:</span> ${args.fileType}</div>` : ''}
        `;
        break;
      case 'listrecentfiles':
        filterHTML = `
          <div class="filter-item"><span class="filter-label">Period:</span> Last ${args.days || 7} days</div>
          ${args.fileType ? `<div class="filter-item"><span class="filter-label">File Type:</span> ${args.fileType}</div>` : ''}
        `;
        break;
    }
    
    if (filterHTML) {
      filterInfo.innerHTML = `<div class="filters-section">${filterHTML}</div>`;
      container.appendChild(filterInfo);
    }
    
    // Add results section
    const resultsContainer = this.createResultsContainer();
    resultsContainer.classList.add('file-results');
    
    // Format results based on status
    if (status === 'running') {
      resultsContainer.innerHTML = `
        <div class="tool-results-loading">
          <div class="file-loading-spinner"></div>
          <div class="file-loading-text">Loading files...</div>
        </div>
      `;
    } else if (status === 'error') {
      resultsContainer.innerHTML = `
        <div class="tool-results-error">
          <div class="error-icon">⚠️</div>
          <div class="error-text">${content}</div>
        </div>
      `;
    } else {
      // Parse the content
      let fileData = null;
      let files = [];
      
      try {
        // Try to parse JSON
        if (typeof content === 'string') {
          fileData = JSON.parse(content);
        } else if (content && typeof content === 'object') {
          fileData = content;
        }
        
        // Extract files from parsed data
        if (fileData) {
          files = fileData.items || [];
        }
      } catch (e) {
        this.logger.error('Error parsing file listing results:', e);
        resultsContainer.innerHTML = `<div class="parse-error">Error parsing file results: ${e.message}</div>`;
        container.appendChild(resultsContainer);
        return container;
      }
      
      // Display results count
      const resultsHeader = document.createElement('div');
      resultsHeader.className = 'results-header';
      resultsHeader.innerHTML = `<span>${files.length} file${files.length !== 1 ? 's' : ''} found</span>`;
      
      if (fileData && fileData.totalItems && fileData.totalItems > files.length) {
        resultsHeader.innerHTML += ` <span class="total-count">(of ${fileData.totalItems} total)</span>`;
      }
      
      resultsContainer.appendChild(resultsHeader);
      
      // No results message
      if (files.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.innerHTML = 'No files found matching the criteria';
        resultsContainer.appendChild(noResults);
      } else {
        // Create file grid
        const fileGrid = document.createElement('div');
        fileGrid.className = 'file-grid';
        
        files.forEach(file => {
          const fileCard = this.createFileCard(file);
          fileGrid.appendChild(fileCard);
        });
        
        resultsContainer.appendChild(fileGrid);
      }
    }
    
    container.appendChild(resultsContainer);
    
    return container;
  }
  
  /**
   * Create a file card for display
   * @param {Object} file - File data
   * @returns {HTMLElement} - File card element
   */
  createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.dataset.fileId = file.id || '';
    
    // Determine icon based on file type
    let iconSvg = '';
    let cardClass = '';
    
    switch ((file.sourceType || '').toLowerCase()) {
      case 'pdf':
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        cardClass = 'pdf-file';
        break;
      case 'url':
      case 'web':
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
        cardClass = 'web-file';
        break;
      case 'youtube':
      case 'video':
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
        cardClass = 'video-file';
        break;
      default:
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
        cardClass = 'document-file';
    }
    
    if (cardClass) {
      card.classList.add(cardClass);
    }
    
    // Thumbnail or icon
    let thumbnailHTML = '';
    if (file.thumbnailUrl) {
      thumbnailHTML = `<img src="${file.thumbnailUrl}" alt="${file.title || 'File thumbnail'}" class="file-thumbnail">`;
    } else {
      thumbnailHTML = `<div class="file-icon">${iconSvg}</div>`;
    }
    
    // Date formatting
    let dateDisplay = '';
    if (file.createdAt) {
      const date = new Date(file.createdAt);
      dateDisplay = date.toLocaleDateString();
    }
    
    // Preview content
    let previewHTML = '';
    if (file.preview) {
      previewHTML = `<div class="file-preview">${file.preview.substring(0, 100)}${file.preview.length > 100 ? '...' : ''}</div>`;
    }
    
    // Assemble the card
    card.innerHTML = `
      <div class="card-header">
        ${thumbnailHTML}
        <div class="file-type-badge">${file.sourceType || 'File'}</div>
      </div>
      <div class="card-content">
        <div class="file-title">${file.title || 'Untitled'}</div>
        ${previewHTML}
        <div class="file-meta">
          ${dateDisplay ? `<div class="file-date">${dateDisplay}</div>` : ''}
          ${file.id ? `<div class="file-id">ID: ${file.id}</div>` : ''}
        </div>
      </div>
    `;
    
    // Add view button
    const actionBar = document.createElement('div');
    actionBar.className = 'card-actions';
    
    const viewButton = document.createElement('button');
    viewButton.className = 'view-file-button';
    viewButton.innerHTML = 'View';
    viewButton.onclick = () => this.handleViewFile(file);
    
    actionBar.appendChild(viewButton);
    card.appendChild(actionBar);
    
    return card;
  }
  
  /**
   * Handle view file button click
   * @param {Object} file - File data
   */
  handleViewFile(file) {
    if (!file.id) return;
    
    // Create a tool call for getItemContent
    const getItemContentTool = {
      name: 'getItemContent',
      id: `view-file-${file.id}-${Date.now()}`,
      args: {
        itemId: file.id
      }
    };
    
    // Dispatch a custom event that can be handled by the app
    const event = new CustomEvent('tool:execute', {
      bubbles: true,
      detail: {
        toolCall: getItemContentTool
      }
    });
    
    document.dispatchEvent(event);
  }
}

export default FileListRenderer; 