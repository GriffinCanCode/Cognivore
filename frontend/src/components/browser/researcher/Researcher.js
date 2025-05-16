/**
 * Researcher - Advanced content extraction and analysis component
 * 
 * Provides capabilities for:
 * - Extracting and processing web page content
 * - Analyzing content with LLM models
 * - Tracking research across multiple sources
 * - Integration with knowledge base
 * - Interactive research assistant chat
 */

import React, { Component } from 'react';
import { nanoid } from 'nanoid';
import DOMPurify from 'dompurify';
import LlmService from '../../../services/LlmService';
import logger from '../../../utils/logger';
import ResearcherEventHandlers from '../handlers/ResearcherEventHandlers';

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
    
    // Initialize component logger
    this.logger = logger.scope('Researcher');
    this.logger.info(`Researcher constructor called with ID: ${nanoid().substring(0, 6)}`);
    
    // Create a global indicator to show this constructor was called
    console.log('RESEARCHER CONSTRUCTOR CALLED', Date.now());
    this.logger.debug('Researcher constructor execution timestamp:', Date.now());
    
    // Create a visible indicator in the DOM that exists outside the component
    // First check if it already exists
    let debugIndicator = document.getElementById('researcher-debug-indicator');
    if (!debugIndicator) {
      debugIndicator = document.createElement('div');
      debugIndicator.id = 'researcher-debug-indicator';
      debugIndicator.className = 'researcher-debug-indicator';
      document.body.appendChild(debugIndicator);
    }
    debugIndicator.innerHTML = 'Researcher Init: ' + new Date().toLocaleTimeString();
    
    this.state = {
      isActive: false,
      isProcessing: false,
      currentUrl: null,
      currentTitle: null,
      researchEntries: [],
      autoExtract: true,
      error: null,
      llmConnected: false,
      analysisInProgress: false,
      chatMessages: [],
      chatInput: '',
      isSendingMessage: false,
      isCollapsed: false,
      isInitialized: false
    };
    
    // Create a unique ID for this researcher instance
    this.researcherId = nanoid();
    
    // Initialize LLM service
    this.llmService = new LlmService();
    
    // CRITICAL: Initialize LLM service and check connection
    this.initializeLlmService();
    
    // CRITICAL: Bind only the methods we're defining in this class
    this.processPage = this.processPage.bind(this);
    this.analyzeContent = this.analyzeContent.bind(this);
    this.saveToKnowledgeBase = this.saveToKnowledgeBase.bind(this);
    this.updateResearchPanel = this.updateResearchPanel.bind(this);
    this.sendChatMessage = this.sendChatMessage.bind(this);
    this.updateChatInterface = this.updateChatInterface.bind(this);
    this._ensureChatInterface = this._ensureChatInterface.bind(this);
    this._handleStateChange = this._handleStateChange.bind(this);
    this.getResearchPanel = this.getResearchPanel.bind(this);
    this.setupResearchPanelHeader = this.setupResearchPanelHeader.bind(this);
    this.scrollChatToBottom = this.scrollChatToBottom.bind(this);
    this.generateResearchContext = this.generateResearchContext.bind(this);
    this.generateChatHistory = this.generateChatHistory.bind(this);
    this.cleanupInputElements = this.cleanupInputElements.bind(this);
    
    // Bind event handlers from ResearcherEventHandlers
    this.toggleActive = ResearcherEventHandlers.handlePanelToggle.bind(null, this);
    this.handleChatInputChange = ResearcherEventHandlers.handleChatInputChange.bind(null, this);
    this.handleChatInputKeyPress = ResearcherEventHandlers.handleChatInputKeyPress.bind(null, this);
    this.closeResearchPanel = ResearcherEventHandlers.handlePanelClose.bind(null, this);
    this.toggleCollapsed = ResearcherEventHandlers.handleCollapseToggle.bind(null, this);
    this.clearResearch = ResearcherEventHandlers.handleClearClick.bind(null, this);
    this.exportResearch = ResearcherEventHandlers.handleExportClick.bind(null, this);
    this.getResearchSummary = ResearcherEventHandlers.handleSummaryClick.bind(null, this);
    
    // Store our existing input elements to clean up later
    this.createdInputElements = [];
    
    // Add this to the window for direct debugging access, but check for duplicates first
    if (!window.researcherInstances) {
      window.researcherInstances = [];
    }
    
    // Remove any stale instances that are no longer in the DOM
    window.researcherInstances = window.researcherInstances.filter(instance => {
      return instance && instance.researcherId && 
        document.getElementById('researcher-debug-indicator-' + instance.researcherId);
    });
    
    window.researcherInstances.push(this);
    window.lastResearcher = this;
    
    console.log('Researcher instance created with ID:', this.researcherId);
  }
  
  /**
   * Initialize LLM service and check connection
   * @returns {Promise<boolean>} Whether the service is available
   */
  async initializeLlmService() {
    try {
        console.log('Initializing LLM service...');
        
        // First check if service is available
        const isAvailable = await this.llmService.checkBackendStatus();
        console.log('LLM service availability check:', isAvailable);
        
        if (isAvailable) {
            // Load configuration
            await this.llmService.loadConfig();
            console.log('LLM service configuration loaded');
            
            // Update state with connection status - use Promise to ensure state is updated
            await new Promise(resolve => {
                this.setState({ llmConnected: true }, resolve);
            });
            
            console.log('LLM service initialized and connected, state updated');
            
            // If we have a welcome message, add it now
            if (this.state.chatMessages.length === 0) {
                const welcomeMessage = {
                    id: nanoid(),
                    role: 'assistant',
                    content: 'I am your research assistant. I can help analyze web content and answer questions about your research. You can extract content from pages or ask me research questions directly!',
                    timestamp: new Date().toISOString()
                };
                
                await new Promise(resolve => {
                    this.setState({
                        chatMessages: [welcomeMessage]
                    }, () => {
                        if (this.state.isActive) {
                            this.updateChatInterface();
                        }
                        resolve();
                    });
                });
            }
            
            return true;
        } else {
            console.warn('LLM service is not available');
            await new Promise(resolve => {
                this.setState({ llmConnected: false }, resolve);
            });
            return false;
        }
    } catch (error) {
        console.error('Error initializing LLM service:', error);
        await new Promise(resolve => {
            this.setState({ llmConnected: false }, resolve);
        });
        return false;
    }
}
  
  /**
   * Handle state changes and trigger appropriate updates
   * @private
   */
  _handleStateChange(newState) {
    console.log('Handling state change:', newState);
    
    this.setState(prevState => {
      const nextState = { ...prevState, ...newState };
      
      // Check if we should initialize the chat interface
      const shouldInitChat = (
        // If becoming active and LLM is connected
        (newState.isActive && (nextState.llmConnected || prevState.llmConnected)) ||
        // Or if LLM becomes connected and we're active
        (newState.llmConnected && (nextState.isActive || prevState.isActive)) ||
        // Or if both are already true and we're not initialized
        (!prevState.isInitialized && nextState.isActive && nextState.llmConnected)
      );
      
      if (shouldInitChat) {
        console.log('State change triggers chat initialization');
        // Use setTimeout to ensure state is updated first
        setTimeout(() => {
          this._ensureChatInterface();
        }, 0);
      }
      
      return {
        ...nextState,
        isInitialized: nextState.isInitialized || shouldInitChat
      };
    });
  }
  
  /**
   * Ensure chat interface is properly initialized
   * @private
   */
  _ensureChatInterface() {
    console.log('Ensuring chat interface is properly initialized');
    
    // Get the research panel
    const researchPanel = this.getResearchPanel();
    if (!researchPanel) {
        console.warn('No research panel found for chat interface');
        return;
    }
    
    // Make sure panel is visible
    researchPanel.classList.remove('hidden');
    researchPanel.style.visibility = 'visible';
    researchPanel.style.display = 'flex';
    researchPanel.style.opacity = '1';
    researchPanel.style.zIndex = '9999';
    researchPanel.style.pointerEvents = 'auto';
    
    // Get or create panel content
    let panelContent = researchPanel.querySelector('.research-panel-content');
    if (!panelContent) {
        console.log('Creating missing panel content container');
        panelContent = document.createElement('div');
        panelContent.className = 'research-panel-content';
        researchPanel.appendChild(panelContent);
    }
    
    // Remove empty state if it exists
    const emptyState = panelContent.querySelector('.research-empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    // Create chat container if it doesn't exist
    let chatContainer = panelContent.querySelector('.research-chat-container');
    if (!chatContainer) {
        console.log('Creating new chat container');
        chatContainer = document.createElement('div');
        chatContainer.className = 'research-chat-container';
        panelContent.appendChild(chatContainer);
        
        // Create messages container
        const messagesContainer = document.createElement('div');
        messagesContainer.className = 'research-chat-messages';
        chatContainer.appendChild(messagesContainer);
    }
    
    // Always recreate input container to ensure fresh event listeners
    // Remove existing input container if it exists
    const existingInput = chatContainer.querySelector('.research-chat-input');
    if (existingInput) {
        existingInput.remove();
    }
    
    // Create new input container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'research-chat-input';
    inputContainer.setAttribute('data-testid', 'research-chat-input');
    const uniqueId = Date.now();
    inputContainer.id = 'research-chat-input-' + uniqueId;
    
    // Create input element with direct event binding
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = 'Ask about this content or ask research questions...';
    inputEl.value = this.state.chatInput || '';
    inputEl.id = 'research-chat-input-field-' + uniqueId;
    
    // Add input event listener
    inputEl.addEventListener('input', (e) => {
        console.log('Input changed:', e.target.value);
        this.setState({ chatInput: e.target.value });
    });
    
    // Add keypress event listener
    inputEl.addEventListener('keypress', (e) => {
        console.log('Key pressed:', e.key);
        if (e.key === 'Enter' && !e.shiftKey) {
            console.log('Enter pressed, sending message');
            e.preventDefault();
            const message = e.target.value.trim();
            if (message) {
                this.sendChatMessage(message);
            }
        }
    });
    
    // Create send button with direct click handler
    const sendButton = document.createElement('button');
    sendButton.className = 'research-send-btn';
    sendButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
    sendButton.setAttribute('title', 'Send message');
    
    // Add click event listener to send button
    sendButton.addEventListener('click', () => {
        console.log('Send button clicked');
        const message = inputEl.value.trim();
        if (message) {
            this.sendChatMessage(message);
        }
    });
    
    // Add elements to containers
    inputContainer.appendChild(inputEl);
    inputContainer.appendChild(sendButton);
    chatContainer.appendChild(inputContainer);
    
    // Track this input element for cleanup
    this.createdInputElements.push(inputContainer);
    
    // Focus the input
    setTimeout(() => {
        inputEl.focus();
    }, 100);
    
    // Force update the interface
    this.updateChatInterface();
}
  
  componentDidMount() {
    this.logger.info(`Researcher componentDidMount running for instance ${this.researcherId}`);
    console.log('▶️ Researcher componentDidMount RUNNING', this.researcherId);
    
    // Update debug indicator to show mounting
    const debugIndicator = document.getElementById('researcher-debug-indicator');
    if (debugIndicator) {
      debugIndicator.innerHTML += '<br>Mounted: ' + new Date().toLocaleTimeString();
      debugIndicator.style.backgroundColor = 'green';
      this.logger.debug('Updated debug indicator to show mounting');
    }
    
    // Initialize LLM service
    this.initializeLlmService();
    
    // Initialize panel if active
    if (this.state.isActive) {
      console.log('Research panel is active, initializing...');
      this._ensureChatInterface();
    }
    
    // Create a visible DOM element to show mount occurred
    const mountIndicator = document.createElement('div');
    mountIndicator.style.position = 'fixed';
    mountIndicator.style.top = '40px';
    mountIndicator.style.left = '10px';
    mountIndicator.style.backgroundColor = 'blue';
    mountIndicator.style.color = 'white';
    mountIndicator.style.padding = '5px 10px';
    mountIndicator.style.borderRadius = '4px';
    mountIndicator.style.zIndex = '999999';
    mountIndicator.style.fontFamily = 'sans-serif';
    mountIndicator.style.fontSize = '12px';
    mountIndicator.innerHTML = 'Component Mounted';
    document.body.appendChild(mountIndicator);
  }
  
  componentDidUpdate(prevProps, prevState) {
    // Log state changes for debugging
    console.log('Researcher componentDidUpdate', {
      prevActive: prevState.isActive,
      currentActive: this.state.isActive,
      prevLLM: prevState.llmConnected,
      currentLLM: this.state.llmConnected,
      isInitialized: this.state.isInitialized
    });
    
    // Handle state changes that might have been missed
    const stateChanges = {};
    
    if (prevState.isActive !== this.state.isActive) {
      stateChanges.isActive = this.state.isActive;
    }
    
    if (prevState.llmConnected !== this.state.llmConnected) {
      stateChanges.llmConnected = this.state.llmConnected;
    }
    
    // If we have state changes, handle them
    if (Object.keys(stateChanges).length > 0) {
      console.log('Handling missed state changes in componentDidUpdate:', stateChanges);
      this._handleStateChange(stateChanges);
    }
    
    // If panel becomes active, ensure it's properly initialized
    if (!prevState.isActive && this.state.isActive) {
      console.log('Panel became active, ensuring proper initialization');
      const researchPanel = this.getResearchPanel();
      if (researchPanel) {
        researchPanel.classList.remove('hidden');
        researchPanel.style.visibility = 'visible';
        researchPanel.style.display = 'flex';
        this.setupResearchPanelHeader(researchPanel);
      }
    }
  }
  
  /**
   * Get the research panel DOM element
   * @returns {HTMLElement|null} The research panel element or null if not found
   */
  getResearchPanel() {
    this.logger.debug('Attempting to get research panel');
    
    // First check if we already have a reference
    if (this.researchPanel && document.body.contains(this.researchPanel)) {
      return this.researchPanel;
    }
    
    // Try to find existing panel
    let panel = document.querySelector('.browser-research-panel');
    
    // If no panel exists, create one
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'browser-research-panel hidden';
      document.body.appendChild(panel);
      this.logger.debug('Created new research panel');
    }
    
    // Store reference
    this.researchPanel = panel;
    
    return panel;
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
   * Update the research panel UI with entry content
   * @param {Object} entry - The research entry to display
   */
  updateResearchPanel(entry) {
    if (!entry) {
      this.logger.warn('updateResearchPanel called without valid entry');
      return;
    }
    
    this.logger.info(`Updating research panel with entry: ${entry.id} - ${entry.title}`);
    
    // Get the research panel
    const researchPanel = this.getResearchPanel();
    
    if (!researchPanel || !researchPanel.isConnected) {
      this.logger.error('Research panel not found or not connected to DOM');
      console.warn('Research panel not found or not connected to DOM');
      return;
    }
    
    // Make sure the panel is visible
    researchPanel.classList.remove('hidden');
    
    // Setup header with controls
    this.setupResearchPanelHeader(researchPanel);
    
    const researchContent = researchPanel.querySelector('.research-panel-content');
    
    if (!researchContent) {
      console.warn('Research panel content container not found');
      return;
    }
    
    // Remove empty state if present
    const emptyState = researchContent.querySelector('.research-empty-state');
    if (emptyState) {
      emptyState.remove();
    }
    
    // Create entries container if not present
    let entriesContainer = researchContent.querySelector('.research-entries-container');
    if (!entriesContainer) {
      entriesContainer = document.createElement('div');
      entriesContainer.className = 'research-entries-container';
      researchContent.insertBefore(entriesContainer, researchContent.firstChild);
    }
    
    // Check if entry already exists in panel
    const existingEntry = entriesContainer.querySelector(`[data-entry-id="${entry.id}"]`);
    
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
      
      // Add to entries container
      entriesContainer.prepend(entryElement);
    }
    
    // Initialize or update chat interface if LLM is connected
    if (this.state.llmConnected) {
      this.updateChatInterface();
    }
  }
  
  /**
   * Clean up when component unmounts
   */
  componentWillUnmount() {
    this.logger.info(`Researcher component unmounting: ${this.researcherId}`);
    console.log(`Researcher component unmounting: ${this.researcherId}`);
    
    // Clean up all inputs we created
    this.logger.debug('Calling cleanupInputElements during unmount');
    this.cleanupInputElements();
    
    // Remove any other inputs that might be related to us
    const inputs = document.querySelectorAll('.research-chat-input, .emergency-chat-input');
    this.logger.debug(`Found ${inputs.length} additional input elements to remove during unmount`);
    inputs.forEach(input => {
      this.logger.debug(`Removing input during unmount: ${input.id || 'unnamed input'}`);
      console.log('Removing input during unmount');
      input.remove();
    });
    
    // Remove debug indicator
    const debugIndicator = document.getElementById('researcher-debug-indicator-' + this.researcherId);
    if (debugIndicator) {
      debugIndicator.remove();
    }
    
    // Remove the research panel if we created it
    if (this.researchPanel && document.body.contains(this.researchPanel)) {
      this.researchPanel.remove();
    }
    
    // Remove this instance from the global array
    if (window.researcherInstances) {
      window.researcherInstances = window.researcherInstances.filter(
        instance => instance !== this
      );
      
      // Update lastResearcher if needed
      if (window.lastResearcher === this) {
        window.lastResearcher = window.researcherInstances.length > 0 ? 
          window.researcherInstances[window.researcherInstances.length - 1] : null;
      }
    }
  }
  
  /**
   * Send a chat message to the research agent
   * @param {string} message - The message to send
   * @returns {Promise<void>}
   */
  async sendChatMessage(message = null) {
    console.log('sendChatMessage called with message:', message || this.state.chatInput);
    
    // Use provided message or get from state
    const messageText = message || this.state.chatInput;
    
    if (!messageText || messageText.trim() === '') {
        console.log('No message to send - empty input');
        return;
    }
    
    // Clear input field immediately
    const inputEl = document.querySelector('.research-chat-input input');
    if (inputEl) {
        inputEl.value = '';
    }
    
    // Create message object for history
    const userMessage = {
        id: nanoid(),
        role: 'user',
        content: messageText.trim(),
        timestamp: new Date().toISOString()
    };
    
    console.log('Created user message:', userMessage);
    
    // Add to chat history - CRITICAL: Use Promise to ensure state is updated
    await new Promise(resolve => {
        this.setState(prevState => {
            console.log('Previous state messages:', prevState.chatMessages);
            const newMessages = [...(prevState.chatMessages || []), userMessage];
            console.log('New messages array:', newMessages);
            return {
                chatMessages: newMessages,
                chatInput: '',
                isSendingMessage: true
            };
        }, () => {
            console.log('State updated, current messages:', this.state.chatMessages);
            // Update UI after state change
            this.updateChatInterface();
            this.scrollChatToBottom();
            resolve();
        });
    });
    
    try {
        // Check LLM connection and try to initialize if not connected
        if (!this.state.llmConnected) {
            console.log('LLM not connected, attempting to initialize...');
            const isAvailable = await this.initializeLlmService();
            
            if (!isAvailable) {
                throw new Error('LLM service not available. Please try again in a moment.');
            }
        }
        
        // Double check connection after initialization
        if (!this.state.llmConnected) {
            throw new Error('LLM service failed to initialize. Please try again.');
        }
        
        console.log('Preparing to send message to LLM');
        const researchContext = this.generateResearchContext();
        const systemInstructions = `You are Voyager, a research assistant helping with web browsing. 
        Your goal is to provide helpful insights based on the extracted content from web pages.
        
        ${researchContext}
        
        Please be concise, helpful and accurate in your responses.`;
        
        const chatHistory = this.generateChatHistory();
        console.log('Sending message to LLM with history:', chatHistory);
        
        const response = await this.llmService.sendMessage(messageText, chatHistory, {
            systemPrompt: systemInstructions,
            temperature: 0.3,
            maxTokens: 1000
        });
        
        console.log('Received LLM response:', response);
        
        if (response.error) {
            throw new Error(response.text || 'Error getting response from LLM');
        }
        
        const assistantMessage = {
            id: nanoid(),
            role: 'assistant',
            content: response.content || response.text,
            timestamp: new Date().toISOString()
        };
        
        // Add assistant message to chat history - use Promise to ensure state is updated
        await new Promise(resolve => {
            this.setState(prevState => {
                console.log('Previous state messages before assistant response:', prevState.chatMessages);
                const newMessages = [...prevState.chatMessages, assistantMessage];
                console.log('New messages array with assistant response:', newMessages);
                return {
                    chatMessages: newMessages,
                    isSendingMessage: false
                };
            }, () => {
                console.log('State updated with assistant response, current messages:', this.state.chatMessages);
                this.updateChatInterface();
                this.scrollChatToBottom();
                resolve();
            });
        });
    } catch (error) {
        console.error('Error sending chat message:', error);
        
        const errorMessage = {
            id: nanoid(),
            role: 'assistant',
            content: `Sorry, I encountered an error: ${error.message}. Please try again later.`,
            timestamp: new Date().toISOString(),
            isError: true
        };
        
        // Add error message to chat history - use Promise to ensure state is updated
        await new Promise(resolve => {
            this.setState(prevState => {
                console.log('Previous state messages before error:', prevState.chatMessages);
                const newMessages = [...prevState.chatMessages, errorMessage];
                console.log('New messages array with error:', newMessages);
                return {
                    chatMessages: newMessages,
                    isSendingMessage: false
                };
            }, () => {
                console.log('State updated with error, current messages:', this.state.chatMessages);
                this.updateChatInterface();
                this.scrollChatToBottom();
                resolve();
            });
        });
    }
}
  
  /**
   * Generate context from research entries for the LLM
   * @returns {string} - Context string
   */
  generateResearchContext() {
    const { researchEntries } = this.state;
    
    if (researchEntries.length === 0) {
      return 'No research entries available yet.';
    }
    
    let context = `RESEARCH CONTEXT:\nYou have access to ${researchEntries.length} research entries:\n\n`;
    
    // Include up to 3 most recent entries for context
    const recentEntries = researchEntries.slice(0, 3);
    
    recentEntries.forEach((entry, index) => {
      context += `ENTRY ${index + 1}: ${entry.title}\n`;
      context += `URL: ${entry.url}\n`;
      
      if (entry.analysis?.text) {
        context += `ANALYSIS: ${entry.analysis.text.substring(0, 300)}...\n\n`;
      } else {
        // If no analysis, use a snippet of content
        const textContent = entry.content.text || 
                          (entry.content.mainContent && entry.content.mainContent.replace(/<[^>]*>/g, ' ').trim()) || 
                          '';
        
        context += `CONTENT SNIPPET: ${textContent.substring(0, 200)}...\n\n`;
      }
    });
    
    return context;
  }
  
  /**
   * Generate chat history in format expected by LlmService
   * @returns {Array} - Formatted chat history
   */
  generateChatHistory() {
    const { chatMessages } = this.state;
    
    // Limit to last 10 messages to prevent context overflow
    const recentMessages = chatMessages.slice(-10);
    
    // Convert to format expected by LlmService
    return recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }
  
  /**
   * Auto-scroll chat to bottom
   */
  scrollChatToBottom() {
    // Get the chat messages container
    const messagesContainer = document.querySelector('.research-chat-messages');
    
    if (messagesContainer) {
      // Scroll to bottom with animation
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }
  
  /**
   * Update the chat interface in the panel
   */
  updateChatInterface() {
    console.log('Updating chat interface with messages:', this.state.chatMessages);
    
    // Get the research panel
    const researchPanel = this.getResearchPanel();
    if (!researchPanel || !researchPanel.isConnected) {
        console.warn('Research panel not found or not connected to DOM');
        return;
    }

    // CRITICAL: Force panel to be visible and properly styled
    researchPanel.classList.remove('hidden');
    researchPanel.style.visibility = 'visible';
    researchPanel.style.display = 'flex';
    researchPanel.style.opacity = '1';
    researchPanel.style.zIndex = '9999';
    researchPanel.style.pointerEvents = 'auto';

    // Create header if it doesn't exist
    this.setupResearchPanelHeader(researchPanel);

    // Get or create panel content
    let panelContent = researchPanel.querySelector('.research-panel-content');
    if (!panelContent) {
        console.log('Creating panel content container');
        panelContent = document.createElement('div');
        panelContent.className = 'research-panel-content';
        researchPanel.appendChild(panelContent);
    }

    // Get or create chat container
    let chatContainer = panelContent.querySelector('.research-chat-container');
    if (!chatContainer) {
        console.log('Creating chat container');
        chatContainer = document.createElement('div');
        chatContainer.className = 'research-chat-container';
        panelContent.appendChild(chatContainer);
    }

    // Get or create messages container
    let messagesContainer = chatContainer.querySelector('.research-chat-messages');
    if (!messagesContainer) {
        console.log('Creating messages container');
        messagesContainer = document.createElement('div');
        messagesContainer.className = 'research-chat-messages';
        chatContainer.appendChild(messagesContainer);
    }

    // Clear existing messages
    messagesContainer.innerHTML = '';

    // Add each message
    this.state.chatMessages.forEach(message => {
        console.log('Adding message to interface:', message);
        
        const messageEl = document.createElement('div');
        messageEl.className = `research-message ${message.role}`;
        if (message.isError) {
            messageEl.classList.add('error');
        }
        
        // Add message wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content';
        
        // Add role label
        const roleLabel = document.createElement('div');
        roleLabel.className = 'message-role';
        roleLabel.textContent = message.role === 'user' ? 'You' : 'Research Assistant';
        contentWrapper.appendChild(roleLabel);
        
        // Add content
        const contentEl = document.createElement('div');
        contentEl.className = 'message-text';
        contentEl.innerHTML = DOMPurify.sanitize(message.content).replace(/\n/g, '<br>');
        contentWrapper.appendChild(contentEl);
        
        // Add timestamp as tooltip
        if (message.timestamp) {
            const time = new Date(message.timestamp).toLocaleTimeString();
            messageEl.setAttribute('title', time);
        }
        
        messageEl.appendChild(contentWrapper);
        messagesContainer.appendChild(messageEl);
    });

    // Add loading indicator if sending
    if (this.state.isSendingMessage) {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'research-message assistant loading';
        loadingEl.innerHTML = `
            <div class="typing-indicator">
                <div class="message-role">Research Assistant</div>
                <div style="display: flex; align-items: center;">
                    <span>Thinking</span>
                    <span style="display: inline-block; margin-left: 4px; animation: blink 1.4s infinite both;">.</span>
                    <span style="display: inline-block; margin-left: 0; animation: blink 1.4s 0.2s infinite both;">.</span>
                    <span style="display: inline-block; margin-left: 0; animation: blink 1.4s 0.4s infinite both;">.</span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(loadingEl);
    }

    // Get or create input container if it doesn't exist
    let inputContainer = chatContainer.querySelector('.research-chat-input');
    if (!inputContainer) {
        console.log('Creating input container');
        inputContainer = document.createElement('div');
        inputContainer.className = 'research-chat-input';
        inputContainer.setAttribute('data-testid', 'research-chat-input');
        const uniqueId = Date.now();
        inputContainer.id = 'research-chat-input-' + uniqueId;

        // Create input element
        const inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.placeholder = 'Ask about this content or ask research questions...';
        inputEl.value = this.state.chatInput || '';
        inputEl.id = 'research-chat-input-field-' + uniqueId;

        // Add input event listener
        inputEl.addEventListener('input', (e) => {
            console.log('Input changed:', e.target.value);
            this.setState({ chatInput: e.target.value });
        });

        // Add keypress event listener
        inputEl.addEventListener('keypress', (e) => {
            console.log('Key pressed:', e.key);
            if (e.key === 'Enter' && !e.shiftKey) {
                console.log('Enter pressed, sending message');
                e.preventDefault();
                const message = e.target.value.trim();
                if (message) {
                    this.sendChatMessage(message);
                }
            }
        });

        // Create send button
        const sendButton = document.createElement('button');
        sendButton.className = 'research-send-btn';
        sendButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
        sendButton.setAttribute('title', 'Send message');

        // Add click event listener
        sendButton.addEventListener('click', () => {
            console.log('Send button clicked');
            const message = inputEl.value.trim();
            if (message) {
                this.sendChatMessage(message);
            }
        });

        // Add elements to container
        inputContainer.appendChild(inputEl);
        inputContainer.appendChild(sendButton);
        chatContainer.appendChild(inputContainer);

        // Track this input element for cleanup
        this.createdInputElements.push(inputContainer);
    } else {
        // Update existing input value
        const inputEl = inputContainer.querySelector('input');
        if (inputEl) {
            inputEl.value = this.state.chatInput || '';
        }
    }

    // Scroll to bottom
    this.scrollChatToBottom();

    // Focus input
    const inputEl = inputContainer.querySelector('input');
    if (inputEl) {
        setTimeout(() => inputEl.focus(), 100);
    }
}
  
  /**
   * Setup research panel header with title and controls
   * @param {HTMLElement} panel - The research panel element
   */
  setupResearchPanelHeader(panel) {
    if (!panel) return;
    
    // Get or create header
    let header = panel.querySelector('.research-panel-header');
    
    if (!header) {
      // Create header
      header = document.createElement('div');
      header.className = 'research-panel-header';
      
      const title = document.createElement('h3');
      title.className = 'research-panel-title';
      title.textContent = 'Research Assistant';
      
      // Add icon to title
      const titleIcon = document.createElement('span');
      titleIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
      titleIcon.style.display = 'flex';
      titleIcon.style.alignItems = 'center';
      titleIcon.style.justifyContent = 'center';
      titleIcon.style.color = '#38BDF8';
      
      title.insertBefore(titleIcon, title.firstChild);
      
      const controls = document.createElement('div');
      controls.className = 'research-panel-controls';
      
      // Create analyze button with icon
      const analyzeBtn = document.createElement('button');
      analyzeBtn.className = 'research-panel-btn';
      analyzeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>';
      analyzeBtn.setAttribute('title', 'Analyze current page');
      
      analyzeBtn.addEventListener('click', () => {
        if (this.props.currentUrl) {
          this.processPage(this.props.currentUrl, this.props.currentTitle);
        }
      });
      
      // Create clear button with icon
      const clearBtn = document.createElement('button');
      clearBtn.className = 'research-panel-btn';
      clearBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      clearBtn.setAttribute('title', 'Clear research data');
      
      clearBtn.addEventListener('click', () => this.clearResearch());
      
      // Create close button with proper icon
      const closeBtn = document.createElement('button');
      closeBtn.className = 'research-close-btn';
      closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      closeBtn.setAttribute('title', 'Close research panel');
      
      closeBtn.addEventListener('click', () => this.closeResearchPanel());
      
      // Add buttons to controls
      controls.appendChild(analyzeBtn);
      controls.appendChild(clearBtn);
      controls.appendChild(closeBtn);
      
      // Add title and controls to header
      header.appendChild(title);
      header.appendChild(controls);
      
      // Add header to panel
      if (panel.firstChild) {
        panel.insertBefore(header, panel.firstChild);
      } else {
        panel.appendChild(header);
      }
      
      // Create or ensure content container exists
      let content = panel.querySelector('.research-panel-content');
      if (!content) {
        content = document.createElement('div');
        content.className = 'research-panel-content';
        panel.appendChild(content);
      }
      
      // Create expand button (visible when collapsed)
      let expandBtn = panel.querySelector('.research-expand-btn');
      if (!expandBtn) {
        expandBtn = document.createElement('button');
        expandBtn.className = 'research-expand-btn';
        expandBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        expandBtn.setAttribute('title', 'Expand panel');
        expandBtn.addEventListener('click', () => this.toggleCollapsed());
        panel.appendChild(expandBtn);
      }
    } else {
      // Ensure collapse button exists in header
      let collapseBtn = header.querySelector('.research-collapse-btn');
      if (!collapseBtn) {
        collapseBtn = document.createElement('button');
        collapseBtn.className = 'research-collapse-btn';
        collapseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
        collapseBtn.setAttribute('title', 'Collapse panel');
        collapseBtn.addEventListener('click', () => this.toggleCollapsed());
        
        const controls = header.querySelector('.research-panel-controls');
        if (controls) {
          // Insert before the close button if it exists
          const closeBtn = controls.querySelector('.research-close-btn');
          if (closeBtn) {
            controls.insertBefore(collapseBtn, closeBtn);
          } else {
            controls.appendChild(collapseBtn);
          }
        }
      }
      
      // Ensure expand button exists
      let expandBtn = panel.querySelector('.research-expand-btn');
      if (!expandBtn) {
        expandBtn = document.createElement('button');
        expandBtn.className = 'research-expand-btn';
        expandBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        expandBtn.setAttribute('title', 'Expand panel');
        expandBtn.addEventListener('click', () => this.toggleCollapsed());
        panel.appendChild(expandBtn);
      }
    }
  }
  
  /**
   * Clean up any input elements this component has created
   */
  cleanupInputElements() {
    if (this.createdInputElements && this.createdInputElements.length > 0) {
      this.logger.info(`Cleaning up ${this.createdInputElements.length} input elements`);
      console.log(`Cleaning up ${this.createdInputElements.length} input elements`);
      
      this.createdInputElements.forEach((element, index) => {
        if (element && element.parentNode) {
          this.logger.debug(`Removing input element ${index} with id: ${element.id || 'unnamed'}`);
          element.parentNode.removeChild(element);
        } else if (element) {
          this.logger.warn(`Element ${index} exists but has no parentNode`);
        } else {
          this.logger.warn(`Element at index ${index} is null or undefined`);
        }
      });
      
      this.createdInputElements = [];
      this.logger.debug('Input elements tracking array reset');
    } else {
      this.logger.debug('No input elements to clean up');
    }
  }
  
  render() {
    this.logger.info(`Researcher RENDER method called for instance ${this.researcherId}`);
    console.log('👁️ Researcher RENDER method called', this.researcherId);
    
    // Update any existing debug indicator
    const debugIndicator = document.getElementById('researcher-debug-indicator');
    if (debugIndicator) {
      debugIndicator.innerHTML += '<br>Rendered: ' + new Date().toLocaleTimeString();
      this.logger.debug('Updated debug indicator with render timestamp');
    } else {
      this.logger.warn('Debug indicator element not found during render');
    }
    
    // This component doesn't render its own UI
    // It manipulates the DOM directly via the research panel
    this.logger.debug('Returning null from render method - component uses direct DOM manipulation');
    return null;
  }
}

export default Researcher; 