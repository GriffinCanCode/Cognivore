/**
 * SearchResultsRenderer - Specialized renderer for searchKnowledgeBase tool calls
 */
import BaseToolRenderer from './BaseToolRenderer.js';

class SearchResultsRenderer extends BaseToolRenderer {
  /**
   * Render a searchKnowledgeBase tool call
   * @param {Object} toolCall - Tool call data to render
   * @returns {HTMLElement} - Rendered tool call element
   */
  render(toolCall) {
    // Get normalized data
    const args = toolCall.args || toolCall.parameters || {};
    const content = toolCall.content || 'No search results available';
    const status = toolCall.status || 'completed';
    
    // Create container with appropriate class
    const container = this.createContainer(toolCall);
    container.classList.add('search-results-renderer');
    
    // Add header with search icon
    container.appendChild(this.createHeader(toolCall));
    
    // Add search query information
    const searchInfo = document.createElement('div');
    searchInfo.className = 'search-info';
    searchInfo.innerHTML = `
      <div class="search-query">
        <span class="query-label">Query:</span>
        <span class="query-text">${args.query || 'Unknown query'}</span>
      </div>
      ${args.filters ? this.formatFilters(args.filters) : ''}
    `;
    container.appendChild(searchInfo);
    
    // Add results section
    const resultsContainer = this.createResultsContainer();
    resultsContainer.classList.add('search-results');
    
    // Format results based on status
    if (status === 'running') {
      resultsContainer.innerHTML = `
        <div class="tool-results-loading">
          <div class="search-loading-spinner"></div>
          <div class="search-loading-text">Searching knowledge base...</div>
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
      let results = [];
      try {
        // Try to parse JSON
        if (typeof content === 'string') {
          const parsedContent = JSON.parse(content);
          results = parsedContent.results || [];
        } else if (content && typeof content === 'object') {
          results = content.results || [];
        }
      } catch (e) {
        this.logger.error('Error parsing search results:', e);
        resultsContainer.innerHTML = `<div class="parse-error">Error parsing search results: ${e.message}</div>`;
        container.appendChild(resultsContainer);
        return container;
      }
      
      // Display results count
      const resultsHeader = document.createElement('div');
      resultsHeader.className = 'results-header';
      resultsHeader.innerHTML = `<span>${results.length} result${results.length !== 1 ? 's' : ''} found</span>`;
      resultsContainer.appendChild(resultsHeader);
      
      // No results message
      if (results.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.innerHTML = 'No matching results found in the knowledge base';
        resultsContainer.appendChild(noResults);
      } else {
        // Create results list
        const resultsList = document.createElement('div');
        resultsList.className = 'results-list';
        
        results.forEach((result, index) => {
          const resultItem = this.createResultItem(result, index + 1);
          resultsList.appendChild(resultItem);
        });
        
        resultsContainer.appendChild(resultsList);
      }
    }
    
    container.appendChild(resultsContainer);
    
    return container;
  }
  
  /**
   * Format filters for display
   * @param {Object} filters - Search filters
   * @returns {string} - Formatted HTML
   */
  formatFilters(filters) {
    if (!filters || typeof filters !== 'object') return '';
    
    let filterHtml = '<div class="search-filters">';
    
    if (filters.sourceType) {
      filterHtml += `<div class="filter-item"><span class="filter-label">Source Type:</span> ${filters.sourceType}</div>`;
    }
    
    if (filters.dateAdded) {
      filterHtml += `<div class="filter-item"><span class="filter-label">Date Added:</span> ${this.formatDate(filters.dateAdded)}</div>`;
    }
    
    // Add any other filters
    Object.entries(filters).forEach(([key, value]) => {
      if (!['sourceType', 'dateAdded'].includes(key)) {
        filterHtml += `<div class="filter-item"><span class="filter-label">${this.formatLabel(key)}:</span> ${value}</div>`;
      }
    });
    
    filterHtml += '</div>';
    return filterHtml;
  }
  
  /**
   * Create a search result item
   * @param {Object} result - Search result item
   * @param {number} index - Result index
   * @returns {HTMLElement} - Result item element
   */
  createResultItem(result, index) {
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';
    resultItem.dataset.resultId = result.id || '';
    resultItem.dataset.resultIndex = index;
    
    // Determine icon based on sourceType
    let iconSvg = '';
    switch ((result.sourceType || '').toLowerCase()) {
      case 'pdf':
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        break;
      case 'url':
      case 'web':
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
        break;
      case 'youtube':
      case 'video':
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`;
        break;
      default:
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;
    }
    
    // Get relevance score indicator
    const scoreValue = result.score || result.relevanceScore || 0;
    const formattedScore = Math.round(scoreValue * 100);
    const scoreBarWidth = Math.max(10, Math.min(100, formattedScore));
    
    // Assemble the result item
    resultItem.innerHTML = `
      <div class="result-number">${index}</div>
      <div class="result-icon">${iconSvg}</div>
      <div class="result-content">
        <div class="result-title">${result.title || 'Untitled'}</div>
        <div class="result-type">${result.sourceType || 'Unknown type'}</div>
        <div class="result-summary">${result.summary || result.contentPreview || ''}</div>
        ${result.id ? `<div class="result-id">ID: ${result.id}</div>` : ''}
      </div>
      <div class="result-score">
        <div class="score-value">${formattedScore}%</div>
        <div class="score-bar">
          <div class="score-fill" style="width: ${scoreBarWidth}%"></div>
        </div>
      </div>
    `;
    
    // Add a view button
    const viewButton = document.createElement('button');
    viewButton.className = 'view-result-button';
    viewButton.innerHTML = 'View';
    viewButton.dataset.resultId = result.id || '';
    viewButton.onclick = () => this.handleViewResult(result);
    
    resultItem.appendChild(viewButton);
    
    return resultItem;
  }
  
  /**
   * Handle view result button click
   * @param {Object} result - Result item data
   */
  handleViewResult(result) {
    // Create a tool call for getItemContent
    const getItemContentTool = {
      name: 'getItemContent',
      id: `view-result-${result.id}-${Date.now()}`,
      args: {
        itemId: result.id
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
  
  /**
   * Format a date string for display
   * @param {string} dateString - ISO date string
   * @returns {string} - Formatted date
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  }
  
  /**
   * Format a label from camelCase to Title Case with Spaces
   * @param {string} label - camelCase label
   * @returns {string} - Formatted label
   */
  formatLabel(label) {
    if (!label) return '';
    return label
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }
}

export default SearchResultsRenderer; 