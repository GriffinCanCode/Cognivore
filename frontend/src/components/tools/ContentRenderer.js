/**
 * ContentRenderer - Specialized renderer for content-related tools
 * Handles getItemContent and summarizeContent tools
 */
import BaseToolRenderer from './BaseToolRenderer.js';

class ContentRenderer extends BaseToolRenderer {
  /**
   * Render a content-related tool call
   * @param {Object} toolCall - Tool call data to render
   * @returns {HTMLElement} - Rendered tool call element
   */
  render(toolCall) {
    // Get normalized data
    const toolName = toolCall.name || toolCall.toolName || '';
    const args = toolCall.args || toolCall.parameters || {};
    const content = toolCall.content || 'No content available';
    const status = toolCall.status || 'completed';
    
    // Create container with appropriate class
    const container = this.createContainer(toolCall);
    container.classList.add('content-renderer');
    
    if (toolName.toLowerCase() === 'getitemcontent') {
      container.classList.add('item-content-renderer');
    } else if (toolName.toLowerCase() === 'summarizecontent') {
      container.classList.add('summary-renderer');
    }
    
    // Add header
    container.appendChild(this.createHeader(toolCall));
    
    // Add parameter information if available
    if (toolName.toLowerCase() === 'getitemcontent' && args.itemId) {
      const paramInfo = document.createElement('div');
      paramInfo.className = 'param-info';
      paramInfo.innerHTML = `<div class="item-id">Retrieving content for item: <span class="id-value">${args.itemId}</span></div>`;
      container.appendChild(paramInfo);
    } else if (toolName.toLowerCase() === 'summarizecontent' && args.length) {
      const paramInfo = document.createElement('div');
      paramInfo.className = 'param-info';
      paramInfo.innerHTML = `<div class="summary-length">Summary length: <span class="length-value">${args.length || 'medium'}</span></div>`;
      container.appendChild(paramInfo);
    }
    
    // Add results section
    const resultsContainer = this.createResultsContainer();
    
    // Format results based on status
    if (status === 'running') {
      resultsContainer.innerHTML = `
        <div class="tool-results-loading">
          <div class="content-loading-spinner"></div>
          <div class="content-loading-text">Loading content...</div>
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
      try {
        // Determine if content is JSON or string
        let contentData = content;
        
        if (typeof content === 'string') {
          try {
            contentData = JSON.parse(content);
          } catch (e) {
            // Content is not JSON, keep as string
          }
        }
        
        if (toolName.toLowerCase() === 'getitemcontent') {
          // Handle getItemContent response
          resultsContainer.appendChild(this.renderItemContent(contentData));
        } else if (toolName.toLowerCase() === 'summarizecontent') {
          // Handle summarizeContent response
          resultsContainer.appendChild(this.renderSummary(contentData));
        } else {
          // Fallback for unknown content format
          resultsContainer.innerHTML = `<div class="content-text">${typeof content === 'string' ? content : JSON.stringify(content, null, 2)}</div>`;
        }
      } catch (e) {
        this.logger.error('Error rendering content:', e);
        resultsContainer.innerHTML = `<div class="parse-error">Error rendering content: ${e.message}</div>`;
      }
    }
    
    container.appendChild(resultsContainer);
    
    return container;
  }
  
  /**
   * Render item content from getItemContent response
   * @param {Object} data - Item content data
   * @returns {HTMLElement} - Rendered content element
   */
  renderItemContent(data) {
    const contentElement = document.createElement('div');
    contentElement.className = 'item-content';
    
    // Check if data is an object with expected fields
    if (typeof data === 'object' && data !== null) {
      // Extract metadata
      const title = data.title || 'Untitled';
      const sourceType = data.sourceType || 'Unknown type';
      const content = data.content || '';
      const metadata = data.metadata || {};
      const id = data.id || '';
      
      // Create metadata section
      const metadataSection = document.createElement('div');
      metadataSection.className = 'content-metadata';
      metadataSection.innerHTML = `
        <div class="content-title">${title}</div>
        <div class="content-source-type">${sourceType}</div>
        ${id ? `<div class="content-id">ID: ${id}</div>` : ''}
      `;
      
      // Add other metadata if available
      if (Object.keys(metadata).length > 0) {
        const metadataList = document.createElement('div');
        metadataList.className = 'metadata-list';
        
        for (const [key, value] of Object.entries(metadata)) {
          const formattedValue = typeof value === 'object' 
            ? JSON.stringify(value) 
            : value;
          
          const metadataItem = document.createElement('div');
          metadataItem.className = 'metadata-item';
          metadataItem.innerHTML = `<span class="metadata-key">${this.formatLabel(key)}:</span> <span class="metadata-value">${formattedValue}</span>`;
          
          metadataList.appendChild(metadataItem);
        }
        
        metadataSection.appendChild(metadataList);
      }
      
      contentElement.appendChild(metadataSection);
      
      // Create content section
      const contentSection = document.createElement('div');
      contentSection.className = 'content-text';
      
      // Format content based on source type
      if (sourceType.toLowerCase() === 'youtube' || sourceType.toLowerCase() === 'video') {
        // Format as transcript with timestamps if available
        contentSection.innerHTML = this.formatTranscript(content);
      } else {
        // Format as regular text
        contentSection.innerHTML = content.replace(/\n/g, '<br>');
      }
      
      contentElement.appendChild(contentSection);
      
      // Add copy content button
      const actionBar = document.createElement('div');
      actionBar.className = 'content-actions';
      
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-content-button';
      copyButton.innerHTML = 'Copy Content';
      copyButton.onclick = () => this.copyToClipboard(content);
      
      actionBar.appendChild(copyButton);
      contentElement.appendChild(actionBar);
      
    } else {
      // Fallback for unexpected format
      contentElement.innerHTML = `<div class="content-text">${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</div>`;
    }
    
    return contentElement;
  }
  
  /**
   * Render summary from summarizeContent response
   * @param {Object} data - Summary data
   * @returns {HTMLElement} - Rendered summary element
   */
  renderSummary(data) {
    const summaryElement = document.createElement('div');
    summaryElement.className = 'content-summary';
    
    // Check if data is an object with expected fields
    if (typeof data === 'object' && data !== null) {
      // Extract summary data
      const summary = data.summary || '';
      const keyPoints = data.keyPoints || [];
      const length = data.length || 'medium';
      
      // Create summary section
      const summarySection = document.createElement('div');
      summarySection.className = 'summary-section';
      
      // Summary text
      const summaryText = document.createElement('div');
      summaryText.className = 'summary-text';
      summaryText.innerHTML = summary.replace(/\n/g, '<br>');
      summarySection.appendChild(summaryText);
      
      // Key points section
      if (keyPoints && keyPoints.length > 0) {
        const keyPointsSection = document.createElement('div');
        keyPointsSection.className = 'key-points-section';
        keyPointsSection.innerHTML = '<h4>Key Points:</h4>';
        
        const pointsList = document.createElement('ul');
        pointsList.className = 'key-points-list';
        
        keyPoints.forEach(point => {
          const pointItem = document.createElement('li');
          pointItem.className = 'key-point';
          pointItem.textContent = point;
          pointsList.appendChild(pointItem);
        });
        
        keyPointsSection.appendChild(pointsList);
        summarySection.appendChild(keyPointsSection);
      }
      
      summaryElement.appendChild(summarySection);
      
      // Add copy summary button
      const actionBar = document.createElement('div');
      actionBar.className = 'summary-actions';
      
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-summary-button';
      copyButton.innerHTML = 'Copy Summary';
      copyButton.onclick = () => this.copyToClipboard(summary);
      
      actionBar.appendChild(copyButton);
      summaryElement.appendChild(actionBar);
      
    } else {
      // Fallback for unexpected format
      summaryElement.innerHTML = `<div class="summary-text">${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</div>`;
    }
    
    return summaryElement;
  }
  
  /**
   * Format transcript content with timestamps
   * @param {string} transcript - Transcript text
   * @returns {string} - Formatted HTML
   */
  formatTranscript(transcript) {
    if (!transcript) return '';
    
    // Check if transcript contains timestamp pattern [00:00:00]
    const hasTimestamps = /\[\d{2}:\d{2}:\d{2}\]/.test(transcript);
    
    if (hasTimestamps) {
      // Format with timestamp highlighting
      return transcript
        .replace(/\[(\d{2}:\d{2}:\d{2})\]/g, '<span class="timestamp">[$1]</span>')
        .replace(/\n/g, '<br>');
    } else {
      // No timestamps, just format line breaks
      return transcript.replace(/\n/g, '<br>');
    }
  }
  
  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   */
  copyToClipboard(text) {
    if (!text) return;
    
    try {
      navigator.clipboard.writeText(text).then(
        () => {
          // Success feedback
          const event = new CustomEvent('notification', {
            bubbles: true,
            detail: {
              type: 'success',
              message: 'Content copied to clipboard'
            }
          });
          document.dispatchEvent(event);
        },
        (err) => {
          this.logger.error('Error copying to clipboard:', err);
          
          // Error feedback
          const event = new CustomEvent('notification', {
            bubbles: true,
            detail: {
              type: 'error',
              message: 'Failed to copy content'
            }
          });
          document.dispatchEvent(event);
        }
      );
    } catch (e) {
      this.logger.error('Clipboard API not available:', e);
      
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          // Success feedback
          const event = new CustomEvent('notification', {
            bubbles: true,
            detail: {
              type: 'success',
              message: 'Content copied to clipboard'
            }
          });
          document.dispatchEvent(event);
        } else {
          throw new Error('Copy command failed');
        }
      } catch (err) {
        this.logger.error('Fallback clipboard copy failed:', err);
        
        // Error feedback
        const event = new CustomEvent('notification', {
          bubbles: true,
          detail: {
            type: 'error',
            message: 'Failed to copy content'
          }
        });
        document.dispatchEvent(event);
      }
      
      document.body.removeChild(textArea);
    }
  }
}

export default ContentRenderer; 