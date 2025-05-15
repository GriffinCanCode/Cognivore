/**
 * DefaultToolRenderer - Renders generic tool calls without specific UI requirements
 */
import BaseToolRenderer from './BaseToolRenderer.js';

class DefaultToolRenderer extends BaseToolRenderer {
  /**
   * Render a generic tool call
   * @param {Object} toolCall - Tool call data to render
   * @returns {HTMLElement} - Rendered tool call element
   */
  render(toolCall) {
    // Get normalized data
    const toolName = toolCall.name || toolCall.toolName || 'Unknown Tool';
    const args = toolCall.args || toolCall.parameters || {};
    const content = toolCall.content || 'No result available';
    const status = toolCall.status || 'completed';
    
    // Create container
    const container = this.createContainer(toolCall);
    
    // Add header
    container.appendChild(this.createHeader(toolCall));
    
    // Add parameters section
    const paramsSection = document.createElement('div');
    paramsSection.className = 'tool-parameters';
    
    // Format parameters nicely
    let paramsContent = '';
    if (typeof args === 'object' && Object.keys(args).length > 0) {
      paramsContent = '<div class="params-title">Parameters:</div><div class="params-list">';
      for (const [key, value] of Object.entries(args)) {
        const formattedValue = typeof value === 'object' 
          ? JSON.stringify(value, null, 2) 
          : String(value);
        paramsContent += `<div class="param-item"><span class="param-name">${key}:</span> <span class="param-value">${formattedValue}</span></div>`;
      }
      paramsContent += '</div>';
    } else {
      paramsContent = '<div class="params-empty">No parameters</div>';
    }
    
    paramsSection.innerHTML = paramsContent;
    container.appendChild(paramsSection);
    
    // Add results section
    const resultsContainer = this.createResultsContainer();
    
    // Format results based on status
    if (status === 'running') {
      resultsContainer.innerHTML = `
        <div class="tool-results-loading">
          <div class="tool-loading-spinner"></div>
          <div class="tool-loading-text">Running ${toolName}...</div>
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
      // Handle different result formats
      let formattedContent = '';
      
      if (typeof content === 'string') {
        // Check if content is JSON
        try {
          const jsonContent = JSON.parse(content);
          formattedContent = this.formatJsonResult(jsonContent);
        } catch (e) {
          // Not JSON, use as-is
          formattedContent = this.formatTextResult(content);
        }
      } else if (typeof content === 'object') {
        formattedContent = this.formatJsonResult(content);
      } else {
        formattedContent = `<div class="tool-results-text">${String(content)}</div>`;
      }
      
      resultsContainer.innerHTML = formattedContent;
    }
    
    container.appendChild(resultsContainer);
    
    return container;
  }
  
  /**
   * Format a JSON result for display
   * @param {Object} json - JSON object or array
   * @returns {string} - Formatted HTML
   */
  formatJsonResult(json) {
    // Format JSON with syntax highlighting
    const jsonString = JSON.stringify(json, null, 2);
    const syntaxHighlighted = this.syntaxHighlightJson(jsonString);
    
    return `<pre class="tool-results-json">${syntaxHighlighted}</pre>`;
  }
  
  /**
   * Format a text result for display
   * @param {string} text - Text content
   * @returns {string} - Formatted HTML
   */
  formatTextResult(text) {
    // Replace newlines with <br>
    const formattedText = text.replace(/\n/g, '<br>');
    return `<div class="tool-results-text">${formattedText}</div>`;
  }
  
  /**
   * Syntax highlight JSON for better readability
   * @param {string} json - JSON string
   * @returns {string} - Highlighted HTML string
   */
  syntaxHighlightJson(json) {
    if (!json) return '';
    
    return json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      });
  }
}

export default DefaultToolRenderer; 