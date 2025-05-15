/**
 * DatabaseQueryRenderer - Specialized renderer for database query tool calls
 */
import BaseToolRenderer from './BaseToolRenderer.js';

class DatabaseQueryRenderer extends BaseToolRenderer {
  /**
   * Render a database query tool call
   * @param {Object} toolCall - Tool call data to render
   * @returns {HTMLElement} - Rendered tool call element
   */
  render(toolCall) {
    // Get normalized data
    const args = toolCall.args || toolCall.parameters || {};
    const content = toolCall.content || 'No query results available';
    const status = toolCall.status || 'completed';
    
    // Create container with appropriate class
    const container = this.createContainer(toolCall);
    container.classList.add('database-query-renderer');
    
    // Add header with database icon
    container.appendChild(this.createHeader(toolCall));
    
    // Add query parameters
    const queryInfo = document.createElement('div');
    queryInfo.className = 'query-info';
    
    // Parse the query from args
    const query = args.query || args.sql || '(No query specified)';
    
    // Add query text
    const queryText = document.createElement('div');
    queryText.className = 'query-text';
    queryText.innerHTML = `
      <span class="query-label">Query:</span>
      <pre>${this.escapeHtml(query)}</pre>
    `;
    queryInfo.appendChild(queryText);
    
    // Add query filters if available
    if (args.filters || args.parameters || args.variables) {
      const filters = args.filters || args.parameters || args.variables || {};
      if (Object.keys(filters).length > 0) {
        const filtersList = document.createElement('div');
        filtersList.className = 'query-filters';
        
        for (const [key, value] of Object.entries(filters)) {
          const filterItem = document.createElement('div');
          filterItem.className = 'filter-item';
          filterItem.innerHTML = `
            <span class="filter-label">${key}:</span>
            <span class="filter-value">${typeof value === 'object' ? JSON.stringify(value) : this.escapeHtml(String(value))}</span>
          `;
          filtersList.appendChild(filterItem);
        }
        
        queryInfo.appendChild(filtersList);
      }
    }
    
    container.appendChild(queryInfo);
    
    // If still loading, show loading indicator
    if (status === 'running' || status === 'loading') {
      const loadingElement = document.createElement('div');
      loadingElement.className = 'query-results-loading';
      loadingElement.innerHTML = `
        <div class="query-loading-spinner"></div>
        <div class="query-loading-text">Executing query...</div>
      `;
      container.appendChild(loadingElement);
      return container;
    }
    
    // If error, show error message
    if (status === 'error' || toolCall.error) {
      const errorElement = document.createElement('div');
      errorElement.className = 'tool-results-error';
      errorElement.innerHTML = `
        <div class="error-icon">⚠️</div>
        <div class="error-message">${toolCall.error || 'An error occurred while executing the query'}</div>
      `;
      container.appendChild(errorElement);
      return container;
    }
    
    // Display query results
    try {
      // Try to parse content as JSON
      let results;
      if (typeof content === 'string') {
        try {
          results = JSON.parse(content);
        } catch (e) {
          results = content;
        }
      } else {
        results = content;
      }
      
      // Create results container
      const resultsContainer = document.createElement('div');
      resultsContainer.className = 'tool-results-container';
      
      // Add results header with count if available
      const resultsHeader = document.createElement('div');
      resultsHeader.className = 'results-header';
      
      let resultCount = 0;
      if (Array.isArray(results)) {
        resultCount = results.length;
      } else if (results && typeof results === 'object' && results.rows) {
        resultCount = results.rows.length;
      }
      
      resultsHeader.innerHTML = `
        <div>Results</div>
        <div class="total-count">${resultCount} ${resultCount === 1 ? 'item' : 'items'}</div>
      `;
      resultsContainer.appendChild(resultsHeader);
      
      // Handle different result formats
      if (resultCount === 0) {
        // No results
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.textContent = 'No results found for this query';
        resultsContainer.appendChild(noResults);
      } else if (Array.isArray(results)) {
        // Array of results
        const resultsList = document.createElement('div');
        resultsList.className = 'query-results-list';
        
        results.forEach((result, index) => {
          const resultItem = this.createResultItem(result, index);
          resultsList.appendChild(resultItem);
        });
        
        resultsContainer.appendChild(resultsList);
      } else if (results && typeof results === 'object' && results.rows) {
        // Database-like results with rows
        const resultsList = document.createElement('div');
        resultsList.className = 'query-results-list';
        
        results.rows.forEach((row, index) => {
          const resultItem = this.createResultItem(row, index);
          resultsList.appendChild(resultItem);
        });
        
        resultsContainer.appendChild(resultsList);
      } else {
        // Fallback for other formats
        const resultText = document.createElement('div');
        resultText.className = 'tool-results-text';
        
        if (typeof results === 'object') {
          resultText.innerHTML = `<pre class="tool-results-json">${JSON.stringify(results, null, 2)}</pre>`;
        } else {
          resultText.textContent = String(results);
        }
        
        resultsContainer.appendChild(resultText);
      }
      
      container.appendChild(resultsContainer);
      
    } catch (error) {
      // If error parsing results, show raw content
      const fallbackResult = document.createElement('div');
      fallbackResult.className = 'tool-results-text';
      fallbackResult.textContent = typeof content === 'string' ? content : JSON.stringify(content);
      container.appendChild(fallbackResult);
    }
    
    return container;
  }
  
  /**
   * Create a result item for the database query results
   * @param {Object} result - Result data
   * @param {number} index - Result index
   * @returns {HTMLElement} - Result item element
   */
  createResultItem(result, index) {
    const resultItem = document.createElement('div');
    resultItem.className = 'query-result-item';
    
    // Add result index
    const resultIndex = document.createElement('div');
    resultIndex.className = 'result-index';
    resultIndex.textContent = index + 1;
    resultItem.appendChild(resultIndex);
    
    // Add result icon based on type
    const resultIcon = document.createElement('div');
    resultIcon.className = 'result-icon';
    resultIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
      </svg>
    `;
    resultItem.appendChild(resultIcon);
    
    // Add result details
    const resultDetails = document.createElement('div');
    resultDetails.className = 'result-details';
    
    // Generate preview based on result structure
    let resultTitle = '';
    const previewContent = [];
    const metadataItems = [];
    
    for (const [key, value] of Object.entries(result)) {
      // First property with "name", "title", or "id" becomes the title
      if (!resultTitle && (key.toLowerCase().includes('name') || key.toLowerCase().includes('title') || key === 'id')) {
        resultTitle = String(value);
      }
      
      // Content for preview
      if (typeof value !== 'object' || value === null) {
        previewContent.push(`${key}: ${value}`);
      }
      
      // Add to metadata
      if (typeof value !== 'object' || value === null) {
        metadataItems.push({ key, value });
      }
    }
    
    // Add title or fallback
    const titleElement = document.createElement('div');
    titleElement.className = 'result-title';
    titleElement.textContent = resultTitle || `Result ${index + 1}`;
    resultDetails.appendChild(titleElement);
    
    // Add row preview if available
    if (previewContent.length > 0) {
      const previewElement = document.createElement('div');
      previewElement.className = 'result-preview';
      previewElement.textContent = previewContent.slice(0, 3).join('\n');
      resultDetails.appendChild(previewElement);
    }
    
    // Add metadata items
    if (metadataItems.length > 0) {
      const metadataElement = document.createElement('div');
      metadataElement.className = 'result-metadata';
      
      metadataItems.slice(0, 4).forEach(({ key, value }) => {
        const metaItem = document.createElement('div');
        metaItem.className = 'metadata-item';
        metaItem.innerHTML = `
          <span class="metadata-label">${key}</span>
          <span class="metadata-value">${this.escapeHtml(String(value))}</span>
        `;
        metadataElement.appendChild(metaItem);
      });
      
      resultDetails.appendChild(metadataElement);
    }
    
    resultItem.appendChild(resultDetails);
    
    return resultItem;
  }
  
  /**
   * Escape HTML special characters to prevent XSS
   * @param {string} html - String to escape
   * @returns {string} - Escaped string
   */
  escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
}

export default DatabaseQueryRenderer; 