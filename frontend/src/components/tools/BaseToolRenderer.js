/**
 * BaseToolRenderer - Abstract base class for all tool renderers
 * Provides common functionality and a consistent interface for tool rendering
 */
import logger from '../../utils/logger.js';

// Create a logger instance for this component
const baseLogger = logger.scope('BaseToolRenderer');

class BaseToolRenderer {
  constructor() {
    this.logger = baseLogger;
  }

  /**
   * Render a tool call (must be implemented by subclasses)
   * @param {Object} toolCall - Tool call data to render
   * @returns {HTMLElement} - Rendered tool call element
   */
  render(toolCall) {
    throw new Error('Method render() must be implemented by subclass');
  }

  /**
   * Create a container for the tool renderer
   * @param {Object} toolCall - Tool call data
   * @returns {HTMLElement} - Container element
   */
  createContainer(toolCall) {
    const container = document.createElement('div');
    container.className = 'tool-renderer';
    
    // Add data attributes
    container.dataset.toolName = toolCall.name || toolCall.toolName || 'unknown';
    if (toolCall.id || toolCall.toolCallId) {
      container.dataset.toolId = toolCall.id || toolCall.toolCallId;
    }
    
    return container;
  }
  
  /**
   * Create a header for the tool renderer
   * @param {Object} toolCall - Tool call data
   * @returns {HTMLElement} - Header element
   */
  createHeader(toolCall) {
    const header = document.createElement('div');
    header.className = 'tool-renderer-header';
    
    // Add tool icon
    const iconElement = document.createElement('div');
    iconElement.className = 'tool-icon';
    iconElement.innerHTML = this.getToolIcon(toolCall.name || toolCall.toolName);
    header.appendChild(iconElement);
    
    // Add tool name
    const nameElement = document.createElement('div');
    nameElement.className = 'tool-name';
    nameElement.textContent = this.formatToolName(toolCall.name || toolCall.toolName || 'Unknown Tool');
    header.appendChild(nameElement);
    
    return header;
  }
  
  /**
   * Create a results container for the tool
   * @returns {HTMLElement} - Results container element
   */
  createResultsContainer() {
    const container = document.createElement('div');
    container.className = 'tool-results-container';
    return container;
  }
  
  /**
   * Format a tool name for display
   * @param {string} toolName - Raw tool name
   * @returns {string} - Formatted tool name
   */
  formatToolName(toolName) {
    if (!toolName) return 'Unknown Tool';
    
    // Convert camelCase to Title Case with spaces
    return toolName
      // Insert a space before all uppercase letters
      .replace(/([A-Z])/g, ' $1')
      // Remove leading space if present
      .replace(/^./, str => str.toUpperCase())
      // Ensure first character is uppercase
      .trim();
  }
  
  /**
   * Get an icon for a tool based on its name
   * @param {string} toolName - Name of the tool
   * @returns {string} - SVG icon markup
   */
  getToolIcon(toolName) {
    if (!toolName) {
      return this.getDefaultIcon();
    }
    
    const toolNameLower = toolName.toLowerCase();
    
    // Search-related icons
    if (toolNameLower.includes('search')) {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      `;
    }
    
    // File-related icons
    if (toolNameLower.includes('file') || toolNameLower.includes('list')) {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      `;
    }
    
    // Database-related icons
    if (toolNameLower.includes('database') || toolNameLower.includes('query')) {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
      `;
    }
    
    // Content-related icons
    if (toolNameLower.includes('content') || toolNameLower.includes('summarize')) {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      `;
    }
    
    // Default icon for unknown tools
    return this.getDefaultIcon();
  }
  
  /**
   * Get the default tool icon
   * @returns {string} - SVG icon markup
   */
  getDefaultIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
      </svg>
    `;
  }
  
  /**
   * Create a tool action button
   * @param {string} label - Button label
   * @param {string} icon - SVG icon markup
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement} - Button element
   */
  createActionButton(label, icon, onClick) {
    const button = document.createElement('button');
    button.className = 'tool-action-button';
    button.setAttribute('aria-label', label);
    button.title = label;
    
    // Add icon
    if (icon) {
      button.innerHTML = icon;
    } else {
      button.textContent = label;
    }
    
    // Add click handler
    if (onClick && typeof onClick === 'function') {
      button.addEventListener('click', onClick);
    }
    
    return button;
  }
  
  /**
   * Dispatch a tool action event
   * @param {string} action - Action type (e.g., 'copy', 'view', 'execute')
   * @param {string} toolName - Name of the tool
   * @param {Object} data - Action data
   */
  dispatchToolAction(action, toolName, data = {}) {
    this.logger.debug(`Dispatching tool action: ${action}`, { toolName, data });
    
    // Create and dispatch the event
    const event = new CustomEvent('tool:action', {
      bubbles: true,
      detail: {
        action,
        toolName,
        data
      }
    });
    
    document.dispatchEvent(event);
  }
  
  /**
   * Format a timestamp for display
   * @param {string} timestamp - ISO timestamp
   * @returns {string} - Formatted timestamp
   */
  formatTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      this.logger.error('Error formatting timestamp:', e);
      return timestamp || 'Unknown time';
    }
  }
  
  /**
   * Format a label from camelCase or snake_case to Title Case
   * @param {string} label - Raw label
   * @returns {string} - Formatted label
   */
  formatLabel(label) {
    if (!label) return '';
    
    // Handle snake_case
    if (label.includes('_')) {
      return label.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    
    // Handle camelCase
    return label
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    // Default implementation does nothing
    // Subclasses can override if needed
  }
}

export default BaseToolRenderer; 