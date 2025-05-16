/**
 * Researcher - Advanced content extraction and analysis component
 * 
 * Provides capabilities for:
 * - Extracting and processing web page content
 * - Analyzing content with LLM models
 * - Tracking research across multiple sources
 * - Integration with knowledge base
 */

import React, { Component } from 'react';
import { nanoid } from 'nanoid';
import DOMPurify from 'dompurify';
import LlmService from '../../../services/LlmService';

// Import extraction utilities
import { 
  extractPageContent,
  extractMainContent,
  extractHeadingStructure,
  extractFullPageContent
} from '../handlers/ContentExtractor';

class Researcher extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      isActive: false,
      isProcessing: false,
      currentUrl: null,
      currentTitle: null,
      researchEntries: [],
      autoExtract: true,
      error: null,
      llmConnected: false,
      analysisInProgress: false
    };
    
    // Create a unique ID for this researcher instance
    this.researcherId = nanoid();
    
    // Initialize LLM service
    this.llmService = new LlmService();
    
    // Bind methods
    this.toggleActive = this.toggleActive.bind(this);
    this.processPage = this.processPage.bind(this);
    this.analyzeContent = this.analyzeContent.bind(this);
    this.saveToKnowledgeBase = this.saveToKnowledgeBase.bind(this);
    this.clearResearch = this.clearResearch.bind(this);
    this.exportResearch = this.exportResearch.bind(this);
    this.getResearchSummary = this.getResearchSummary.bind(this);
  }
  
  componentDidMount() {
    // Check if LLM service is available
    this.llmService.checkBackendStatus()
      .then(isAvailable => {
        this.setState({ llmConnected: isAvailable });
        console.log(`LLM service ${isAvailable ? 'is' : 'is not'} available for research`);
      })
      .catch(error => {
        console.error('Error checking LLM service:', error);
        this.setState({ llmConnected: false });
      });
  }
  
  /**
   * Toggle the active state of the researcher
   * @returns {boolean} The new active state
   */
  toggleActive() {
    this.setState(prevState => ({
      isActive: !prevState.isActive
    }), () => {
      console.log(`Researcher toggled to ${this.state.isActive ? 'active' : 'inactive'} state`);
      
      // Update the research panel visibility based on active state
      let researchPanel = this.props?.containerRef?.current || this.props?.browser?.researchPanel;
      
      // If not found through props, try DOM query
      if (!researchPanel || !researchPanel.isConnected) {
        researchPanel = document.querySelector('.browser-research-panel');
      }
      
      if (researchPanel && researchPanel.isConnected) {
        if (this.state.isActive) {
          // Make the panel visible with comprehensive styling
          researchPanel.style.cssText = `
            display: flex !important;
            z-index: 1000 !important;
            opacity: 1 !important;
            visibility: visible !important;
            position: fixed !important;
            right: 0 !important;
            top: 0 !important;
            height: 100% !important;
            width: 350px !important;
            background-color: var(--glass-bg, rgba(15, 23, 42, 0.85)) !important;
            backdrop-filter: blur(12px) saturate(180%) !important;
            -webkit-backdrop-filter: blur(12px) saturate(180%) !important;
            box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2) !important;
            transition: all 0.3s cubic-bezier(0.215, 0.61, 0.355, 1) !important;
            pointer-events: auto !important;
          `;
        } else {
          // Hide the panel
          researchPanel.style.cssText = `
            display: none !important;
            pointer-events: none !important;
          `;
        }
      } else {
        console.warn('Research panel not found for visibility update');
      }
      
      // If becoming active and we have a URL, process the current page
      if (this.state.isActive && this.props.currentUrl && this.state.autoExtract) {
        this.processPage(this.props.currentUrl, this.props.currentTitle);
      }
      
      // Call parent callback if provided
      if (this.props.onToggle) {
        this.props.onToggle(this.state.isActive);
      }
    });
    
    return this.state.isActive;
  }
  
  /**
   * Process a web page for research
   * @param {string} url - The URL of the page
   * @param {string} title - The title of the page
   * @returns {Promise<Object>} Promise that resolves to the processed content
   */
  processPage(url, title) {
    if (!url) {
      console.warn('Cannot process page: URL is missing');
      return Promise.reject(new Error('URL is missing'));
    }
    
    // Set processing state
    this.setState({
      isProcessing: true,
      currentUrl: url,
      currentTitle: title || 'Untitled Page',
      error: null
    });
    
    // Get browser instance from props
    const browser = this.props.browser;
    
    if (!browser || !browser.webview) {
      this.setState({
        isProcessing: false,
        error: 'Browser or webview not available'
      });
      return Promise.reject(new Error('Browser or webview not available'));
    }
    
    // Use extractFullPageContent to get content
    return extractFullPageContent(browser)
      .then(content => {
        if (!content) {
          throw new Error('No content extracted');
        }
        
        // Create a research entry
        const entry = {
          id: nanoid(),
          url: url,
          title: title || content.title || 'Untitled Page',
          timestamp: new Date().toISOString(),
          content: content,
          analysis: null
        };
        
        // Add to research entries
        this.setState(prevState => ({
          researchEntries: [entry, ...prevState.researchEntries],
          isProcessing: false
        }));
        
        // Update the research panel UI
        this.updateResearchPanel(entry);
        
        // If LLM is connected and auto-analysis is enabled, analyze the content
        if (this.state.llmConnected && this.props.autoAnalyze) {
          this.analyzeContent(entry.id);
        }
        
        // Notify parent if callback provided
        if (this.props.onContentProcessed) {
          this.props.onContentProcessed(entry);
        }
        
        return entry;
      })
      .catch(error => {
        console.error('Error processing page:', error);
        this.setState({
          isProcessing: false,
          error: error.message || 'Error processing page'
        });
        
        return Promise.reject(error);
      });
  }
  
  /**
   * Analyze content using the LLM service
   * @param {string} entryId - The ID of the research entry to analyze
   * @returns {Promise<Object>} Promise that resolves to the analysis result
   */
  analyzeContent(entryId) {
    // Find the entry by ID
    const entry = this.state.researchEntries.find(e => e.id === entryId);
    
    if (!entry) {
      return Promise.reject(new Error('Research entry not found'));
    }
    
    // Set analysis in progress
    this.setState({ analysisInProgress: true });
    
    // Prepare the content for analysis
    const textContent = entry.content.text || 
                       (entry.content.mainContent && entry.content.mainContent.replace(/<[^>]*>/g, ' ').trim()) || 
                       '';
    
    // Create a prompt for the LLM
    const prompt = `Analyze the following web content from ${entry.url}:
    
    TITLE: ${entry.title}
    
    CONTENT:
    ${textContent.substring(0, 8000)}
    
    Please provide:
    1. A concise summary (2-3 sentences)
    2. Key points or takeaways (up to 5)
    3. Any notable entities, facts, or figures
    4. How this content might connect to previous research (if applicable)
    `;
    
    // Send to LLM service
    return this.llmService.sendMessage(prompt, [], {
      temperature: 0.3,
      maxTokens: 1000
    })
      .then(response => {
        // Update the entry with analysis
        const updatedEntries = this.state.researchEntries.map(e => {
          if (e.id === entryId) {
            return {
              ...e,
              analysis: {
                text: response.content || response.text,
                timestamp: new Date().toISOString()
              }
            };
          }
          return e;
        });
        
        // Update state
        this.setState({
          researchEntries: updatedEntries,
          analysisInProgress: false
        });
        
        // Update the research panel UI
        this.updateResearchPanel(updatedEntries.find(e => e.id === entryId));
        
        // Notify parent if callback provided
        if (this.props.onContentAnalyzed) {
          this.props.onContentAnalyzed(updatedEntries.find(e => e.id === entryId));
        }
        
        return response;
      })
      .catch(error => {
        console.error('Error analyzing content:', error);
        this.setState({
          analysisInProgress: false,
          error: error.message || 'Error analyzing content'
        });
        
        return Promise.reject(error);
      });
  }
  
  /**
   * Save research to knowledge base
   * @param {string} entryId - The ID of the research entry to save
   * @returns {Promise<Object>} Promise that resolves to the save result
   */
  saveToKnowledgeBase(entryId) {
    // Find the entry by ID
    const entry = this.state.researchEntries.find(e => e.id === entryId);
    
    if (!entry) {
      return Promise.reject(new Error('Research entry not found'));
    }
    
    // Use IPC to save to knowledge base
    if (window.server && window.server.savePageToKnowledgeBase) {
      const pageData = {
        url: entry.url,
        title: entry.title,
        content: entry.content.mainContent,
        text: entry.content.text,
        analysis: entry.analysis?.text,
        headings: entry.content.headings || [],
        savedAt: new Date().toISOString()
      };
      
      return window.server.savePageToKnowledgeBase(pageData)
        .then(result => {
          // Mark entry as saved
          const updatedEntries = this.state.researchEntries.map(e => {
            if (e.id === entryId) {
              return {
                ...e,
                savedToKB: true,
                saveTimestamp: new Date().toISOString()
              };
            }
            return e;
          });
          
          // Update state
          this.setState({
            researchEntries: updatedEntries
          });
          
          // Update the research panel UI
          this.updateResearchPanel(updatedEntries.find(e => e.id === entryId));
          
          // Notify parent if callback provided
          if (this.props.onEntrySaved) {
            this.props.onEntrySaved(updatedEntries.find(e => e.id === entryId));
          }
          
          return result;
        })
        .catch(error => {
          console.error('Error saving to knowledge base:', error);
          return Promise.reject(error);
        });
    } else {
      return Promise.reject(new Error('Knowledge base service not available'));
    }
  }
  
  /**
   * Clear all research entries
   */
  clearResearch() {
    this.setState({
      researchEntries: []
    });
    
    // Clear the research panel UI
    const researchPanel = document.querySelector('.browser-research-panel');
    const researchContent = researchPanel?.querySelector('.research-panel-content');
    
    if (researchContent) {
      researchContent.innerHTML = `
        <div class="research-empty-state">
          <p>No research data available yet.</p>
          <p>Enable research mode to automatically save pages as you browse.</p>
        </div>
      `;
    }
    
    // Notify parent if callback provided
    if (this.props.onResearchCleared) {
      this.props.onResearchCleared();
    }
  }
  
  /**
   * Export research as a document
   * @param {string} format - The format to export as ('markdown', 'json', or 'html')
   * @returns {Promise<string>} Promise that resolves to the exported content
   */
  exportResearch(format = 'markdown') {
    return new Promise((resolve, reject) => {
      try {
        const { researchEntries } = this.state;
        
        if (researchEntries.length === 0) {
          reject(new Error('No research entries to export'));
          return;
        }
        
        let exportContent = '';
        
        if (format === 'markdown') {
          exportContent = `# Research Export\n\nGenerated on ${new Date().toLocaleString()}\n\n`;
          
          researchEntries.forEach(entry => {
            exportContent += `## ${entry.title}\n\n`;
            exportContent += `URL: ${entry.url}\n`;
            exportContent += `Captured: ${new Date(entry.timestamp).toLocaleString()}\n\n`;
            
            if (entry.analysis?.text) {
              exportContent += `### Analysis\n\n${entry.analysis.text}\n\n`;
            }
            
            exportContent += `### Content\n\n`;
            
            // Add cleaned text content
            const textContent = entry.content.text || 
                              (entry.content.mainContent && entry.content.mainContent.replace(/<[^>]*>/g, ' ').trim());
            
            exportContent += textContent ? textContent.substring(0, 1000) + '...\n\n' : 'No content available\n\n';
            
            exportContent += `---\n\n`;
          });
        } else if (format === 'json') {
          exportContent = JSON.stringify({
            metadata: {
              generated: new Date().toISOString(),
              entryCount: researchEntries.length
            },
            entries: researchEntries
          }, null, 2);
        } else if (format === 'html') {
          exportContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Research Export</title>
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
                h1 { border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                .entry { margin-bottom: 40px; border: 1px solid #ddd; border-radius: 5px; padding: 20px; }
                .entry-title { margin-top: 0; }
                .entry-meta { color: #666; font-size: 0.9em; margin-bottom: 15px; }
                .entry-analysis { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 15px; }
                .entry-content { max-height: 300px; overflow-y: auto; border: 1px solid #eee; padding: 15px; }
              </style>
            </head>
            <body>
              <h1>Research Export</h1>
              <p>Generated on ${new Date().toLocaleString()}</p>
          `;
          
          researchEntries.forEach(entry => {
            exportContent += `
              <div class="entry">
                <h2 class="entry-title">${DOMPurify.sanitize(entry.title)}</h2>
                <div class="entry-meta">
                  <div>URL: <a href="${DOMPurify.sanitize(entry.url)}" target="_blank">${DOMPurify.sanitize(entry.url)}</a></div>
                  <div>Captured: ${new Date(entry.timestamp).toLocaleString()}</div>
                </div>
            `;
            
            if (entry.analysis?.text) {
              exportContent += `
                <div class="entry-analysis">
                  <h3>Analysis</h3>
                  <div>${DOMPurify.sanitize(entry.analysis.text).replace(/\n/g, '<br>')}</div>
                </div>
              `;
            }
            
            exportContent += `
                <h3>Content</h3>
                <div class="entry-content">
                  ${DOMPurify.sanitize(entry.content.mainContent || '<p>No content available</p>')}
                </div>
              </div>
            `;
          });
          
          exportContent += `
            </body>
            </html>
          `;
        } else {
          reject(new Error(`Unsupported export format: ${format}`));
          return;
        }
        
        resolve(exportContent);
        
        // Notify parent if callback provided
        if (this.props.onResearchExported) {
          this.props.onResearchExported(exportContent, format);
        }
      } catch (error) {
        console.error('Error exporting research:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Get a research summary from the LLM
   * @returns {Promise<string>} Promise that resolves to the summary
   */
  getResearchSummary() {
    const { researchEntries } = this.state;
    
    if (researchEntries.length === 0) {
      return Promise.reject(new Error('No research entries to summarize'));
    }
    
    if (!this.state.llmConnected) {
      return Promise.reject(new Error('LLM service not available'));
    }
    
    // Set analysis in progress
    this.setState({ analysisInProgress: true });
    
    // Prepare research data for the LLM
    let researchData = '';
    
    researchEntries.forEach((entry, index) => {
      researchData += `ENTRY ${index + 1}: ${entry.title}\n`;
      researchData += `URL: ${entry.url}\n`;
      
      if (entry.analysis?.text) {
        researchData += `ANALYSIS: ${entry.analysis.text.substring(0, 500)}\n\n`;
      } else {
        // If no analysis, use a snippet of content
        const textContent = entry.content.text || 
                           (entry.content.mainContent && entry.content.mainContent.replace(/<[^>]*>/g, ' ').trim()) || 
                           '';
        
        researchData += `CONTENT SNIPPET: ${textContent.substring(0, 300)}\n\n`;
      }
    });
    
    // Create a prompt for the LLM
    const prompt = `I've been researching a topic and have gathered information from ${researchEntries.length} sources.
    
    Please provide:
    1. A comprehensive summary of the research
    2. Key insights or patterns across the sources
    3. Potential questions for further research
    4. Any notable connections between the sources
    
    Here are the research entries:
    
    ${researchData}
    `;
    
    // Send to LLM service
    return this.llmService.sendMessage(prompt, [], {
      temperature: 0.3,
      maxTokens: 1500
    })
      .then(response => {
        this.setState({ analysisInProgress: false });
        
        // Notify parent if callback provided
        if (this.props.onResearchSummarized) {
          this.props.onResearchSummarized(response.content || response.text);
        }
        
        return response.content || response.text;
      })
      .catch(error => {
        console.error('Error generating research summary:', error);
        this.setState({
          analysisInProgress: false,
          error: error.message || 'Error generating research summary'
        });
        
        return Promise.reject(error);
      });
  }
  
  /**
   * Update the research panel UI with entry content
   * @param {Object} entry - The research entry to display
   */
  updateResearchPanel(entry) {
    if (!entry) return;
    
    // First look for the panel using props/context if available
    let researchPanel = this.props?.containerRef?.current || this.props?.browser?.researchPanel;
    
    // If not found through props, try DOM query
    if (!researchPanel || !researchPanel.isConnected) {
      researchPanel = document.querySelector('.browser-research-panel');
    }
    
    if (!researchPanel || !researchPanel.isConnected) {
      console.warn('Research panel not found or not connected to DOM');
      return;
    }
    
    const researchContent = researchPanel.querySelector('.research-panel-content');
    
    if (!researchContent) {
      console.warn('Research panel content container not found');
      return;
    }
    
    // Make sure the panel is fully visible with comprehensive styling
    researchPanel.style.cssText = `
      display: flex !important;
      z-index: 1000 !important;
      opacity: 1 !important;
      visibility: visible !important;
      position: fixed !important;
      right: 0 !important;
      top: 0 !important;
      height: 100% !important;
      width: 350px !important;
      background-color: var(--glass-bg, rgba(15, 23, 42, 0.85)) !important;
      backdrop-filter: blur(12px) saturate(180%) !important;
      -webkit-backdrop-filter: blur(12px) saturate(180%) !important;
      box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2) !important;
      transition: all 0.3s cubic-bezier(0.215, 0.61, 0.355, 1) !important;
      pointer-events: auto !important;
    `;
    
    // Remove empty state if present
    const emptyState = researchContent.querySelector('.research-empty-state');
    if (emptyState) {
      emptyState.remove();
    }
    
    // Check if entry already exists in panel
    const existingEntry = researchContent.querySelector(`[data-entry-id="${entry.id}"]`);
    
    if (existingEntry) {
      // Update existing entry
      const analysisSection = existingEntry.querySelector('.research-entry-analysis');
      
      if (entry.analysis?.text && analysisSection) {
        analysisSection.innerHTML = `
          <h4>Analysis</h4>
          <div>${DOMPurify.sanitize(entry.analysis.text).replace(/\n/g, '<br>')}</div>
        `;
        analysisSection.style.display = 'block';
      }
      
      // Update saved status if applicable
      if (entry.savedToKB) {
        existingEntry.classList.add('saved-to-kb');
        const saveIndicator = existingEntry.querySelector('.research-save-indicator');
        if (saveIndicator) {
          saveIndicator.textContent = 'Saved to Knowledge Base';
        }
      }
    } else {
      // Create new entry element
      const entryElement = document.createElement('div');
      entryElement.className = 'research-entry';
      entryElement.dataset.entryId = entry.id;
      
      if (entry.savedToKB) {
        entryElement.classList.add('saved-to-kb');
      }
      
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      
      // Build entry HTML
      let entryHTML = `
        <div class="research-entry-header">
          <h4>${DOMPurify.sanitize(entry.title)}</h4>
          <span class="research-timestamp">${timestamp}</span>
        </div>
        <div class="research-entry-url">${DOMPurify.sanitize(entry.url)}</div>
      `;
      
      // Add analysis section if available
      if (entry.analysis?.text) {
        entryHTML += `
          <div class="research-entry-analysis">
            <h4>Analysis</h4>
            <div>${DOMPurify.sanitize(entry.analysis.text).replace(/\n/g, '<br>')}</div>
          </div>
        `;
      } else {
        entryHTML += `
          <div class="research-entry-analysis" style="display: none;"></div>
        `;
      }
      
      // Add content preview
      const textContent = entry.content.text || 
                         (entry.content.mainContent && entry.content.mainContent.replace(/<[^>]*>/g, ' ').trim()) || 
                         '';
      
      entryHTML += `
        <div class="research-entry-preview">${textContent.substring(0, 200)}...</div>
        <div class="research-entry-actions">
          <button class="research-analyze-btn" data-entry-id="${entry.id}">Analyze</button>
          <button class="research-save-btn" data-entry-id="${entry.id}">Save to KB</button>
          <span class="research-save-indicator">${entry.savedToKB ? 'Saved to Knowledge Base' : ''}</span>
        </div>
      `;
      
      entryElement.innerHTML = entryHTML;
      
      // Add event listeners to buttons
      const analyzeBtn = entryElement.querySelector('.research-analyze-btn');
      const saveBtn = entryElement.querySelector('.research-save-btn');
      
      if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
          this.analyzeContent(entry.id);
        });
      }
      
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          this.saveToKnowledgeBase(entry.id);
        });
      }
      
      // Add to panel
      researchContent.prepend(entryElement);
    }
  }
  
  render() {
    // This component doesn't render its own UI
    // It manipulates the DOM directly via the research panel
    return null;
  }
}

export default Researcher; 