/**
 * ToolRenderer Component - Factory for rendering tool calls with appropriate UI
 * Dynamically selects the appropriate tool renderer based on the tool name
 */
import logger from '../../utils/logger.js';
import SearchResultsRenderer from './SearchResultsRenderer.js';
import FileListRenderer from './FileListRenderer.js';
import DatabaseQueryRenderer from './DatabaseQueryRenderer.js';
import ContentRenderer from './ContentRenderer.js';
import DefaultToolRenderer from './DefaultToolRenderer.js';

// Create a logger instance for this component
const toolLogger = logger.scope('ToolRenderer');

class ToolRenderer {
  /**
   * Constructor for ToolRenderer
   */
  constructor() {
    this.renderers = {
      // Search related tools
      searchKnowledgeBase: new SearchResultsRenderer(),
      searchDocuments: new SearchResultsRenderer(),
      semanticSearch: new SearchResultsRenderer(),
      
      // File listing tools
      listAllFiles: new FileListRenderer(),
      listFilesByType: new FileListRenderer(),
      listFilesWithContent: new FileListRenderer(),
      listRecentFiles: new FileListRenderer(),
      
      // Database query tools
      queryDatabase: new DatabaseQueryRenderer(),
      runQuery: new DatabaseQueryRenderer(),
      executeQuery: new DatabaseQueryRenderer(),
      
      // Content tools
      getItemContent: new ContentRenderer(),
      summarizeContent: new ContentRenderer(),
      extractContent: new ContentRenderer(),
      
      // Default renderer for any other tools
      default: new DefaultToolRenderer()
    };
    
    // Bound methods
    this.handleToolAction = this.handleToolAction.bind(this);
  }
  
  /**
   * Initialize the ToolRenderer
   * Set up any necessary event handlers or resources
   */
  initialize() {
    // Prevent double initialization
    if (this._initialized) {
      toolLogger.debug('ToolRenderer already initialized, skipping');
      return;
    }
    
    toolLogger.info('Initializing ToolRenderer');
    
    // Add event listener for tool actions
    document.addEventListener('tool:action', this.handleToolAction);
    
    // Register CSS
    this.loadToolStyles();
    
    // Mark as initialized
    this._initialized = true;
    
    toolLogger.info('ToolRenderer initialized');
  }
  
  /**
   * Load tool renderer styles
   */
  loadToolStyles() {
    // Skip if already loaded
    if (document.querySelector('link[href="/styles/components/tool-renderers.css"]')) {
      return;
    }
    
    // Create and append the stylesheet link
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/styles/components/tool-renderers.css';
    document.head.appendChild(link);
    
    toolLogger.debug('Tool renderer styles loaded');
  }
  
  /**
   * Handle tool action events
   * @param {CustomEvent} event - Tool action event
   */
  handleToolAction(event) {
    const { action, toolName, toolId, data } = event.detail;
    
    toolLogger.debug(`Tool action: ${action} for ${toolName}`, event.detail);
    
    // Dispatch to appropriate handler
    switch (action) {
      case 'copy':
        this.handleCopyAction(data);
        break;
      case 'view':
        this.handleViewAction(toolName, data);
        break;
      case 'execute':
        this.handleExecuteAction(toolName, data);
        break;
      default:
        toolLogger.warn(`Unknown tool action: ${action}`);
    }
  }
  
  /**
   * Handle copy action
   * @param {Object} data - Data to copy
   */
  handleCopyAction(data) {
    if (!data || !data.text) {
      toolLogger.warn('Copy action missing text');
      return;
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(data.text)
      .then(() => {
        // Show success message
        this.showNotification('Copied to clipboard!', 'success');
      })
      .catch(error => {
        toolLogger.error('Failed to copy to clipboard:', error);
        this.showNotification('Failed to copy to clipboard', 'error');
      });
  }
  
  /**
   * Handle view action
   * @param {string} toolName - Name of the tool
   * @param {Object} data - View data
   */
  handleViewAction(toolName, data) {
    if (!data || !data.itemId) {
      toolLogger.warn('View action missing itemId');
      return;
    }
    
    // Create and dispatch custom event for content viewing
    const event = new CustomEvent('content:selected', {
      bubbles: true,
      detail: {
        itemId: data.itemId,
        itemData: data
      }
    });
    
    document.dispatchEvent(event);
  }
  
  /**
   * Handle execute action
   * @param {string} toolName - Name of the tool
   * @param {Object} data - Execute data
   */
  handleExecuteAction(toolName, data) {
    if (!data) {
      toolLogger.warn('Execute action missing data');
      return;
    }
    
    // Create a tool call object
    const toolCall = {
      name: toolName,
      id: `tool-action-${Date.now()}`,
      args: data
    };
    
    // Create and dispatch custom event for tool execution
    const event = new CustomEvent('tool:execute', {
      bubbles: true,
      detail: {
        toolCall
      }
    });
    
    document.dispatchEvent(event);
  }
  
  /**
   * Show a notification message
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, warning, info)
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `tool-notification ${type}`;
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.add('visible');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.classList.remove('visible');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
  
  /**
   * Render a tool call using the appropriate renderer
   * @param {Object} toolCall - Tool call data to render
   * @returns {HTMLElement} - Rendered tool call element
   */
  render(toolCall) {
    if (!toolCall) {
      toolLogger.error('Cannot render null toolCall');
      return document.createElement('div');
    }
    
    // Ensure tool renderer is initialized
    if (!this._initialized) {
      toolLogger.warn('ToolRenderer not initialized during render, initializing now');
      this.initialize();
    }
    
    const toolName = toolCall.name || toolCall.toolName || 'unknown';
    
    try {
      // Get the appropriate renderer with fallback
      const renderer = this.renderers[toolName] || this.renderers.default;
      
      if (!renderer) {
        throw new Error(`No renderer found for tool: ${toolName} and default renderer missing`);
      }
      
      // Render the tool call
      const renderedElement = renderer.render(toolCall);
      
      // Dispatch rendered event
      this.dispatchToolRenderedEvent(toolName, toolCall.id);
      
      return renderedElement;
    } catch (error) {
      toolLogger.error(`Error rendering tool ${toolName}:`, error);
      
      // Dispatch error event
      this.dispatchToolErrorEvent(toolName, error);
      
      // Return error message
      const errorElement = document.createElement('div');
      errorElement.className = 'tool-renderer-error';
      errorElement.innerHTML = `
        <div class="error-icon">⚠️</div>
        <div class="error-message">Error rendering tool ${toolName}: ${error.message}</div>
      `;
      
      return errorElement;
    }
  }
  
  /**
   * Dispatch tool rendered event
   * @param {string} toolName - Name of the tool
   * @param {string} toolId - ID of the tool call
   */
  dispatchToolRenderedEvent(toolName, toolId) {
    const event = new CustomEvent('tool:rendered', {
      bubbles: true,
      detail: {
        toolName,
        toolId
      }
    });
    
    document.dispatchEvent(event);
  }
  
  /**
   * Dispatch tool error event
   * @param {string} toolName - Name of the tool
   * @param {Error} error - Error object
   */
  dispatchToolErrorEvent(toolName, error) {
    const event = new CustomEvent('tool:error', {
      bubbles: true,
      detail: {
        toolName,
        error: error.message,
        stack: error.stack
      }
    });
    
    document.dispatchEvent(event);
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    // Only clean up if initialized
    if (!this._initialized) {
      toolLogger.debug('ToolRenderer not initialized, nothing to clean up');
      return;
    }
    
    toolLogger.info('Cleaning up ToolRenderer');
    
    // Remove event listeners
    document.removeEventListener('tool:action', this.handleToolAction);
    
    // Clear renderers
    for (const key in this.renderers) {
      if (this.renderers[key] && this.renderers[key].cleanup) {
        this.renderers[key].cleanup();
      }
    }
    
    // Reset initialization state
    this._initialized = false;
    
    toolLogger.info('ToolRenderer cleanup complete');
  }
}

export default ToolRenderer; 