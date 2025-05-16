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

import DOMPurify from 'dompurify';
import { nanoid } from 'nanoid';
import LlmService from '../../../services/LlmService';
import logger from '../../../utils/logger';
import { extractFullPageContent } from '../handlers/ContentExtractor';
import extractionSystem from '../handlers/ContentExtractionSystem';

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @return {Function} - Debounced function
 */
function debounce(func, wait = 300) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * Researcher class for managing research-related functionality
 * This is a class component that manages state and DOM manipulation directly
 */
class Researcher {
  constructor(props) {
    // Initialize component logger
    this.logger = logger.scope('Researcher');
    this.logger.info(`Researcher constructor called with ID: ${nanoid().substring(0, 6)}`);
    
    // Store props
    this.props = props || {};
    
    // Initialize state
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
      isInitialized: false,
      lastRenderedState: null, // Track last rendered state for memoization
      toggleInProgress: false, // Add a flag to track toggle in progress
      inputHandlersRegistered: false, // Track if input handlers are registered
      memoization: {
        lastInputValue: '',
        lastActiveState: false,
        lastSendingState: false,
        lastInterfaceUpdateHash: '',
        lastMessageUpdateHash: ''
      }
    };
    
    // Create a unique ID for this researcher instance
    this.researcherId = nanoid();
    
    // Initialize LLM service
    this.llmService = new LlmService();
    
    // Setup memoization cache
    this.memoCache = {
      researchContext: {
        entries: null,
        result: null
      },
      chatHistory: {
        messages: null,
        result: null
      },
      messageElements: new Map(),
      lastInputValue: ''
    };

    // Define core methods first with debouncing for input handling
    this.handleStateChange = (newState) => {
      const prevState = {...this.state};
      this.state = { ...this.state, ...newState };
      
      // Check if we need to update the UI based on what changed
      const shouldUpdateUI = this.shouldUpdateUI(prevState, this.state);
      
      // Trigger any necessary UI updates
      if (this.updateUI && shouldUpdateUI) {
        this.updateUI();
      }
    };

    // Replace existing handleChatSubmit with this optimized version
    this.handleChatSubmit = (message) => {
      if (!message || this.state.isSendingMessage) {
        return;
      }
      this.sendChatMessage(message);
    };
    
    // Add debounced method for handling input changes
    this.handleInputChange = debounce((value) => {
      if (this.state.chatInput !== value) {
        this.setState({ chatInput: value });
      }
    }, 100);

    // Improve toggleActive to be more reliable
    this.toggleActive = () => {
      // Prevent rapid toggle clicks
      if (this.state.toggleInProgress) {
        this.logger.info('Toggle already in progress, ignoring request');
        return this.state.isActive;
      }
      
      // Set toggle in progress to prevent multiple clicks
      this.setState({ toggleInProgress: true });
      
      const newIsActive = !this.state.isActive;
      this.logger.info(`Toggling research panel ${newIsActive ? 'ON' : 'OFF'}`);
      
      // Get research panel element first
      const researchPanel = this.getResearchPanel();
      
      if (!researchPanel) {
        this.logger.error('Research panel element not found');
        this.setState({ toggleInProgress: false });
        return false;
      }
      
      if (newIsActive) {
        // Make visible but with 0 opacity first
        researchPanel.style.visibility = 'visible';
        researchPanel.style.display = 'flex';
        
        // Add animation class after a small delay to ensure the display property is applied
        setTimeout(() => {
          researchPanel.classList.remove('hidden');
          researchPanel.classList.add('panel-appear');
          researchPanel.classList.remove('panel-disappear');
          
          // Remove animation class when done and set final state
          const onAnimationEnd = () => {
            researchPanel.classList.remove('panel-appear');
            researchPanel.removeEventListener('animationend', onAnimationEnd);
            this.setState({ toggleInProgress: false });
          };
          
          researchPanel.addEventListener('animationend', onAnimationEnd);
        }, 10);
      } else {
        // Add animation class
        researchPanel.classList.add('panel-disappear');
        researchPanel.classList.remove('panel-appear');
        
        // When animation ends, hide the panel
        const onAnimationEnd = () => {
          researchPanel.classList.add('hidden');
          researchPanel.classList.remove('panel-disappear');
          researchPanel.style.visibility = 'hidden';
          researchPanel.style.display = 'none';
          researchPanel.removeEventListener('animationend', onAnimationEnd);
          this.setState({ toggleInProgress: false });
        };
        
        researchPanel.addEventListener('animationend', onAnimationEnd);
      }
      
      // Update state with the new active status
      this.setState({ isActive: newIsActive });
      
      return newIsActive;
    };

    // Optimize updateUI to check what specifically needs updating
    this.updateUI = () => {
      // Prevent recursive calls
      if (this._updatingUI) {
        console.warn('Preventing recursive updateUI call');
        return;
      }
      
      // Track update depth to detect potential recursive patterns even if not direct recursion
      if (!this._updateDepth) {
        this._updateDepth = 0;
      }
      
      // If we're too deep in update calls, abort to prevent stack issues
      if (this._updateDepth > 3) {
        console.error('Update depth exceeded, aborting to prevent potential issues');
        this._updateDepth = 0;
        return;
      }
      
      // Set update in progress flag
      this._updatingUI = true;
      this._updateDepth++;
      
      try {
        // Update panel if it exists
        if (this.panel) {
          // Only update messages if they've changed
          if (this.state.chatMessages !== this.memoCache.lastUpdatedMessages) {
            this.memoCache.lastUpdatedMessages = this.state.chatMessages;
            this.panel.updateMessages?.(this.state.chatMessages, this.state.isSendingMessage);
          }
          
          // Only update input state if it changed
          if (this.state.isSendingMessage !== this.memoCache.lastSendingState) {
            this.memoCache.lastSendingState = this.state.isSendingMessage;
            this.panel.setInputDisabled?.(this.state.isSendingMessage, 
              this.state.isSendingMessage ? 'Sending message...' : null);
          }
          
          // Handle active state only when it changes
          if (this.state.isActive !== this.memoCache.lastActiveState) {
            this.memoCache.lastActiveState = this.state.isActive;
            // Schedule initialization outside of updateUI to prevent recursion
            if (this.state.isActive && !this._scheduledInterfaceInit) {
              this._scheduledInterfaceInit = true;
              setTimeout(() => {
                this._scheduledInterfaceInit = false;
                if (this.state.isActive) {
                  this._ensureChatInterface();
                }
              }, 0);
            }
          }
        } else if (this.state.isActive && this.state.llmConnected && !this._scheduledInterfaceInit) {
          // If panel doesn't exist but we should be active, schedule initialization
          this._scheduledInterfaceInit = true;
          setTimeout(() => {
            this._scheduledInterfaceInit = false;
            if (this.state.isActive && this.state.llmConnected) {
              this._ensureChatInterface();
            }
          }, 0);
        }
      } finally {
        // Always clear update flag when done
        this._updatingUI = false;
        this._updateDepth--;
      }
    };
    
    // DO NOT instantiate ResearcherPanel here - it's now a React component
    // We'll create DOM elements manually as needed instead
    this.panel = null;

    // Initialize method bindings
    this.getResearchPanel = this.getResearchPanel.bind(this);
    this.setupResearchPanelHeader = this.setupResearchPanelHeader.bind(this);
    this.scrollChatToBottom = this.scrollChatToBottom.bind(this);
    this.generateResearchContext = this.generateResearchContext.bind(this);
    this.generateChatHistory = this.generateChatHistory.bind(this);
    this.sendChatMessage = this.sendChatMessage.bind(this);
    this.updateChatInterface = this.updateChatInterface.bind(this);
    this.updateResearchPanel = this.updateResearchPanel.bind(this);
    this.analyzeCurrentPage = this.analyzeCurrentPage.bind(this);
    this._processAndAnalyze = this._processAndAnalyze.bind(this);
    this.toggleCollapsed = this.toggleCollapsed || function() {
      const panel = this.getResearchPanel();
      const newState = !this.state.isCollapsed;
      
      this.logger.info(`Toggling collapsed state to: ${newState}`);
      
      this.setState({ isCollapsed: newState }, () => {
        if (panel) {
          if (newState) {
            panel.classList.add('collapsed');
            // Adjust browser content when collapsed
            document.body.classList.add('research-panel-collapsed');
            document.body.classList.remove('research-panel-active');
          } else {
            panel.classList.remove('collapsed');
            // Adjust browser content when expanded
            document.body.classList.remove('research-panel-collapsed');
            document.body.classList.add('research-panel-active');
            // Re-focus input when expanded
            setTimeout(() => {
              const input = panel.querySelector('.research-chat-input input');
              if (input) input.focus();
            }, 300);
          }
          
          // Update expand/collapse buttons visibility
          const collapseBtn = panel.querySelector('.research-collapse-btn');
          const expandBtn = panel.querySelector('.research-expand-btn');
          
          if (collapseBtn) collapseBtn.style.display = newState ? 'none' : 'flex';
          if (expandBtn) expandBtn.style.display = newState ? 'flex' : 'none';
        }
      });
    }.bind(this);
    this.closeResearchPanel = this.closeResearchPanel || function() {
      this.logger.info('Closing research panel');
      
      // Get the panel first
      const panel = this.getResearchPanel();
      
      // Clean up input elements before state change
      this.cleanupInputElements();
      
      // Update state
      this.setState({ isActive: false, isCollapsed: false }, () => {
        // Hide the panel
        if (panel) {
          panel.classList.add('hidden');
          panel.style.visibility = 'hidden';
          panel.style.display = 'none';
          document.body.classList.remove('research-panel-active');
        }
        
        // Notify parent if callback provided
        if (this.props.onToggle) {
          this.props.onToggle(false);
        }
      });
    }.bind(this);
    this.clearResearch = this.clearResearch || function() {
      this.setState({
        researchEntries: [],
        chatMessages: []
      });
      // Clear memoization cache when clearing research
      this.memoCache = {
        researchContext: {
          entries: null,
          result: null
        },
        chatHistory: {
          messages: null,
          result: null
        },
        messageElements: new Map()
      };
    }.bind(this);
    
    // Store our existing input elements to clean up later
    this.createdInputElements = [];
    this.attachedEventListeners = [];
    
    // Add this to the window for direct debugging access, but check for duplicates first
    if (!window.researcherInstances) {
      window.researcherInstances = [];
    }
    
    // Remove any stale instances that are no longer in the DOM
    window.researcherInstances = window.researcherInstances.filter(instance => {
      return instance && document.body.contains(instance.getResearchPanel());
    });
    
    // Add this instance to the global registry
    window.researcherInstances.push(this);
    
    // Add a method to safely remove event listeners when cleaning up
    this.registerEventListener = (element, eventType, handler) => {
      if (element && typeof element.addEventListener === 'function') {
        element.addEventListener(eventType, handler);
        this.attachedEventListeners.push({ element, eventType, handler });
      }
    };
    
    this.removeAllEventListeners = () => {
      this.attachedEventListeners.forEach(({ element, eventType, handler }) => {
        if (element && typeof element.removeEventListener === 'function') {
          element.removeEventListener(eventType, handler);
        }
      });
      this.attachedEventListeners = [];
    };
    
    // CRITICAL: Initialize LLM service and check connection
    this.initializeLlmService();
  }
  
  /**
   * Determine if UI needs updating based on state changes
   * @param {Object} prevState - Previous state
   * @param {Object} nextState - Next state
   * @return {boolean} - Whether UI should update
   */
  shouldUpdateUI(prevState, nextState) {
    // Always update if these critical states change
    if (prevState.isActive !== nextState.isActive ||
        prevState.isSendingMessage !== nextState.isSendingMessage ||
        prevState.llmConnected !== nextState.llmConnected ||
        prevState.isCollapsed !== nextState.isCollapsed ||
        prevState.inputHandlersRegistered !== nextState.inputHandlersRegistered ||
        prevState.toggleInProgress !== nextState.toggleInProgress) {
      return true;
    }
    
    // Check if chat messages array reference changed
    if (prevState.chatMessages !== nextState.chatMessages) {
      return true;
    }
    
    // Check if research entries array reference changed
    if (prevState.researchEntries !== nextState.researchEntries) {
      return true;
    }
    
    // Only update on chatInput changes when they're significant
    if (prevState.chatInput !== nextState.chatInput) {
      // Skip updates for minor input changes
      if (Math.abs(prevState.chatInput?.length || 0 - nextState.chatInput?.length || 0) > 5) {
        return true;
      }
      return false; // Don't update UI for small input changes
    }
    
    return false;
  }
  
  /**
   * Set state with memoization check
   */
  setState(newState, callback) {
    const prevState = {...this.state};
    let skipUIUpdate = false;
    
    // Extract state updates
    let stateUpdates;
    if (typeof newState === 'function') {
      stateUpdates = newState(this.state);
    } else {
      stateUpdates = newState;
    }
    
    // Check if UI update should be skipped
    if (stateUpdates._skipUIUpdate) {
      skipUIUpdate = true;
      // Create a clean copy without the internal flag
      const { _skipUIUpdate, ...cleanUpdates } = stateUpdates;
      stateUpdates = cleanUpdates;
    }
    
    // Update state
    this.state = { ...this.state, ...stateUpdates };
    
    // Check if we need to update UI
    const shouldUpdate = !skipUIUpdate && this.shouldUpdateUI(prevState, this.state);
    
    // Trigger any necessary UI updates
    if (this.updateUI && shouldUpdate) {
      this.updateUI();
    }
    
    if (callback) {
      callback();
    }
  }
  
  /**
   * Initialize LLM service and check connection
   */
  async initializeLlmService() {
    this.logger.info('Initializing LLM service...');
    
    try {
      // Check if service is available using checkBackendStatus
      const isAvailable = await this.llmService.checkBackendStatus();
      this.logger.info('LLM service availability check:', isAvailable);
      
      if (!isAvailable) {
        // Use setState directly to avoid recursion
        this.setState({
          error: 'LLM service not available',
          llmConnected: false
        });
        return false;
      }

      // Load configuration
      await this.llmService.loadConfig();
      this.logger.info('LLM service configuration loaded');
      
      // Use setState directly to avoid recursion 
      this.setState({
        llmConnected: true,
        error: null
      });
      return true;
    } catch (error) {
      this.logger.error('Error initializing LLM service:', error);
      this.setState({
        error: 'Failed to initialize LLM service',
        llmConnected: false
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
    
    // Detect potential recursion and prevent it
    if (this._handlingStateChange) {
      console.warn('Recursive state change detected and prevented');
      return;
    }
    
    // Add a guard flag to prevent recursion
    this._handlingStateChange = true;
    
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
      
      // Schedule chat interface initialization outside of setState
      if (shouldInitChat) {
        console.log('State change triggers chat initialization');
        // We'll handle this after state update completes
        this._needsChatInit = true;
      }
      
      return {
        ...nextState,
        isInitialized: nextState.isInitialized || shouldInitChat
      };
    }, () => {
      // Reset the guard flag
      this._handlingStateChange = false;
      
      // Handle scheduled chat init if needed
      if (this._needsChatInit) {
        this._needsChatInit = false;
        // Use setTimeout to ensure state is completely updated
        setTimeout(() => {
          if (this._ensureChatInterface) {
            this._ensureChatInterface();
          }
        }, 0);
      }
    });
  }
  
  /**
   * Ensure chat interface is properly initialized
   * @private
   */
  _ensureChatInterface() {
    console.log('Ensuring chat interface is properly initialized');
    
    // Prevent recursive calls
    if (this._ensuringChatInterface) {
      console.warn('Preventing recursive _ensureChatInterface call');
      return;
    }
    
    // Set flag to prevent recursion
    this._ensuringChatInterface = true;
    
    try {
      // Get the research panel
      const researchPanel = this.getResearchPanel();
      if (!researchPanel) {
          console.warn('No research panel found for chat interface');
          return;
      }
      
      // Make sure panel is visible and has proper styling
      researchPanel.classList.remove('hidden');
      document.body.classList.add('research-panel-active');
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
      
      // If we already have input handlers registered, don't recreate them
      if (this.state.inputHandlersRegistered) {
        console.log('Input handlers already registered, skipping input creation');
        
        // Just make sure the existing input is focused
        const existingInput = chatContainer.querySelector('.research-chat-input input');
        if (existingInput) {
          setTimeout(() => {
            existingInput.focus();
          }, 100);
        }
        
        return;
      }
      
      // Clean up existing input elements to prevent duplicates
      this.cleanupInputElements();
      
      // Create new input container with unique id
      const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 10000);
      const inputContainer = document.createElement('div');
      inputContainer.className = 'research-chat-input';
      inputContainer.setAttribute('data-testid', 'research-chat-input');
      inputContainer.id = 'research-chat-input-' + uniqueId;
      
      // Create input element with improved event handling
      const inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.placeholder = 'Ask about this content or ask research questions...';
      inputEl.value = this.state.chatInput || '';
      inputEl.id = 'research-chat-input-field-' + uniqueId;
      
      // Set up high-performance input handler with throttling and memoization
      let lastInputTime = 0;
      let lastInputValue = this.state.chatInput || '';
      let isProcessingInput = false;
      
      // Process input value change with state tracking
      const processInputChange = (value) => {
        if (isProcessingInput || value === lastInputValue) return;
        
        isProcessingInput = true;
        
        // Update the last seen value
        lastInputValue = value;
        
        // Use direct setState without triggering updateUI
        this.setState({ chatInput: value, _skipUIUpdate: true }, () => {
          // Reset processing flag
          setTimeout(() => {
            isProcessingInput = false;
          }, 10);
        });
      };
      
      // Throttled input handler (more responsive than debounce for text input)
      const handleInput = (e) => {
        const now = Date.now();
        const value = e.target.value;
        
        // Always process immediately if it's been more than 100ms
        if (now - lastInputTime > 100) {
          lastInputTime = now;
          processInputChange(value);
        } else {
          // Otherwise, schedule for later if the value has actually changed
          if (value !== lastInputValue) {
            lastInputTime = now;
            setTimeout(() => processInputChange(value), 50);
          }
        }
      };
      
      // Add optimized event listener
      this.registerEventListener(inputEl, 'input', handleInput);
      
      // Keypress handler for sending messages
      const handleKeypress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          console.log('Enter pressed, sending message');
          e.preventDefault();
          const message = e.target.value.trim();
          if (message) {
            // Clear input immediately for better UX
            e.target.value = '';
            lastInputValue = '';
            this.setState({ chatInput: '' });
            this.sendChatMessage(message);
          }
        }
      };
      
      // Add keypress handler
      this.registerEventListener(inputEl, 'keypress', handleKeypress);
      
      // Create send button with direct click handler
      const sendButton = document.createElement('button');
      sendButton.className = 'research-send-btn';
      sendButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
      sendButton.setAttribute('title', 'Send message');
      
      // Click handler for send button
      const handleSendClick = () => {
        console.log('Send button clicked');
        const message = inputEl.value.trim();
        if (message) {
          // Clear input immediately for better UX
          inputEl.value = '';
          lastInputValue = '';
          this.setState({ chatInput: '' });
          this.sendChatMessage(message);
        }
      };
      
      // Add send button click handler
      this.registerEventListener(sendButton, 'click', handleSendClick);
      
      // Add elements to containers
      inputContainer.appendChild(inputEl);
      inputContainer.appendChild(sendButton);
      chatContainer.appendChild(inputContainer);
      
      // Track this input element for cleanup
      this.createdInputElements.push(inputContainer);
      
      // Set state to indicate that input handlers are registered
      // Do this directly to avoid triggering updateUI again
      this.state.inputHandlersRegistered = true;
      
      // Focus the input after a small delay
      setTimeout(() => {
        inputEl.focus();
      }, 100);
      
      // Update the chat interface once after initialization
      // Schedule this to avoid recursion
      setTimeout(() => {
        if (this.updateChatInterface) {
          this.updateChatInterface();
        }
      }, 10);
    } finally {
      // Always clear flag when done
      this._ensuringChatInterface = false;
    }
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
    return document.querySelector('.researcher-panel');
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
    
    // Add a small delay to ensure the page is fully loaded
    return new Promise(resolve => setTimeout(resolve, 500))
      .then(() => {
        // Use the current URL from the browser, not the one passed to the function
        // This ensures we're analyzing the page that's actually displayed
        const currentUrl = browser.currentUrl || url;
        const currentTitle = browser.webview.getTitle?.() || title || 'Untitled Page';
        
        this.logger.info(`Processing current page: ${currentUrl} (${currentTitle})`);
        
        // Wrap extractFullPageContent in a Promise to handle both synchronous and asynchronous results
        return Promise.resolve().then(async () => {
          try {
            const result = extractFullPageContent(browser, currentUrl);
            
            // Check if result is already a Promise
            if (result instanceof Promise) {
              return await result; // Await the Promise
            }
            
            // If not a Promise, return the result directly
            return result;
          } catch (error) {
            // Log the error and reject the Promise
            console.error('Error in extractFullPageContent:', error);
            return Promise.reject(error);
          }
        });
      })
      .then(content => {
        if (!content) {
          throw new Error('No content extracted');
        }
        
        // Log successful extraction
        this.logger.info(`Content extracted successfully from ${url}, text length: ${content.text?.length || 0}`);
        
        // Create a research entry
        const entry = {
          id: nanoid(),
          url: browser.currentUrl || url, // Always use the most current URL
          title: browser.webview.getTitle?.() || title || content.title || 'Untitled Page',
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
   * Analyze content using the LLM service with tools integration
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
    
    // Safely extract text content, handling various content structures
    let textContent = '';
    
    // Handle different content structures safely
    if (entry.content) {
      if (typeof entry.content.text === 'string') {
        textContent = entry.content.text;
      } else if (typeof entry.content.mainContent === 'string') {
        textContent = entry.content.mainContent.replace(/<[^>]*>/g, ' ').trim();
      } else if (typeof entry.content === 'string') {
        textContent = entry.content;
      }
    }
    
    // Ensure we have some content to analyze
    if (!textContent || textContent.trim().length === 0) {
      this.setState({ analysisInProgress: false });
      return Promise.reject(new Error('No text content available for analysis'));
    }
    
    // Check if we can use the summarizeContent tool
    const useTools = this.llmService.supportsToolCalls && window.server && window.server.executeToolCall;
    
    if (useTools) {
      this.logger.info('Using tools for content analysis');
      
      try {
        // First create a system message to prepare the LLM
        const systemPrompt = `You are a research assistant analyzing web content. 
        First summarize the content, then identify the 3-5 most important key points or takeaways.
        Also extract any notable entities, facts, or figures that might be useful for research.`;
        
        // Create a user message with basic info about the content
        const userMessage = `Please analyze this webpage content from ${entry.url}:
        
        TITLE: ${entry.title || 'No title available'}
        
        I need you to use the summarizeContent tool to process this efficiently.`;
        
        // Send to LLM service with tool call capability
        return this.llmService.sendMessage(userMessage, [], {
          systemPrompt,
          temperature: 0.3,
          maxTokens: 1200,
          tools: [{
            name: "summarizeContent",
            description: "Generate a comprehensive analysis of provided content with key points",
            parameters: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: "The text content to analyze"
                },
                length: {
                  type: "string",
                  enum: ["short", "medium", "long"],
                  description: "The desired summary length"
                }
              },
              required: ["content"]
            }
          }]
        })
        .then(async response => {
          let analysis = "";
          
          // Check if the response has tool calls
          if (response.toolCalls && response.toolCalls.length > 0) {
            this.logger.info('Processing tool calls from analysis response');
            
            for (const toolCall of response.toolCalls) {
              if (toolCall.name === 'summarizeContent') {
                // Execute the tool call to get content summary
                try {
                  const toolArgs = typeof toolCall.args === 'string' 
                    ? JSON.parse(toolCall.args) 
                    : toolCall.args;
                  
                  // Use either provided content or our existing content
                  const contentToSummarize = toolArgs.content || textContent.substring(0, 8000);
                  
                  // Execute tool either via server or directly on frontend
                  let toolResult;
                  
                  if (window.server && window.server.executeToolCall) {
                    toolResult = await window.server.executeToolCall(
                      toolCall.name,
                      { 
                        content: contentToSummarize, 
                        length: toolArgs.length || "medium" 
                      }
                    );
                  } else {
                    // Fallback to direct llm call if tool execution isn't available
                    const summarizationPrompt = `Summarize this content and identify key points:
                      ${contentToSummarize}`;
                    
                    const summaryResponse = await this.llmService.sendMessage(summarizationPrompt, [], {
                      temperature: 0.3,
                      maxTokens: 800
                    });
                    
                    toolResult = {
                      summary: summaryResponse.content || summaryResponse.text,
                      keyPoints: []
                    };
                  }
                  
                  // Format the tool result
                  analysis = `## Summary
${toolResult.summary || "No summary available"}

## Key Points
${toolResult.keyPoints ? toolResult.keyPoints.map(point => `- ${point}`).join('\n') : "No key points available"}

## Analysis completed at ${new Date().toLocaleString()}`;
                } catch (toolError) {
                  this.logger.error('Error executing summarizeContent tool', toolError);
                  analysis = `Error analyzing content: ${toolError.message}`;
                }
              }
            }
          } else {
            // Just use the direct response if no tool calls
            analysis = response.content || response.text;
          }
          
          // Update the entry with analysis
          const updatedEntries = this.state.researchEntries.map(e => {
            if (e.id === entryId) {
              return {
                ...e,
                analysis: {
                  text: analysis,
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
          
          return { analysis, toolsUsed: !!response.toolCalls };
        });
      } catch (error) {
        this.logger.error('Error in tool-based content analysis', error);
        // Fall back to regular analysis
        return this.performBasicAnalysis(entry, textContent, entryId);
      }
    } else {
      // Use basic analysis without tools
      return this.performBasicAnalysis(entry, textContent, entryId);
    }
  }
  
  /**
   * Perform basic content analysis without using tools
   * @private
   */
  performBasicAnalysis(entry, textContent, entryId) {
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
    
    // Extract base domain from URL
    const getBaseDomain = (url) => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '');
      } catch (e) {
        return url;
      }
    };
    
    const baseDomain = getBaseDomain(entry.url);
    
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
      
      // Build entry HTML with collapsible content
      let entryHTML = `
        <div class="research-entry-header">
          <div class="research-entry-domain">
            <div class="research-favicon"></div>
            <h4>${DOMPurify.sanitize(baseDomain)}</h4>
          </div>
          <div class="research-entry-controls">
            <span class="research-timestamp">${timestamp}</span>
            <button class="research-collapse-btn" title="Toggle content">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
        </div>
        <div class="research-entry-content">
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
        </div>
      `;
      
      entryElement.innerHTML = entryHTML;
      
      // Add event listeners to buttons
      const analyzeBtn = entryElement.querySelector('.research-analyze-btn');
      const saveBtn = entryElement.querySelector('.research-save-btn');
      const collapseBtn = entryElement.querySelector('.research-collapse-btn');
      
      if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
          // Use the current page content instead of the stored entry
          this.analyzeCurrentPage();
        });
      }
      
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          this.saveToKnowledgeBase(entry.id);
        });
      }
      
      if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
          entryElement.classList.toggle('collapsed');
          
          // Rotate the collapse button icon
          if (entryElement.classList.contains('collapsed')) {
            collapseBtn.querySelector('svg').style.transform = 'rotate(180deg)';
          } else {
            collapseBtn.querySelector('svg').style.transform = 'rotate(0deg)';
          }
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
    this.logger.info(`Researcher componentWillUnmount called for instance ${this.researcherId}`);
    
    // Clean up input elements
    this.cleanupInputElements();
    
    // Remove from global researcher registry if exists
    if (window.researcherInstances) {
      window.researcherInstances = window.researcherInstances.filter(
        instance => instance !== this
      );
    }
    
    // Clean up any research panel element we created
    if (this.researchPanel && this.researchPanel.parentNode) {
      this.researchPanel.parentNode.removeChild(this.researchPanel);
      this.researchPanel = null;
    }
    
    // Clear any local state
    this.state = null;
    this.props = null;
    this.memoCache = null;
    
    // Remove all event listeners
    this.removeAllEventListeners();
  }
  
  /**
   * Send a chat message to the research agent
   * @param {string} message - The message to send
   * @returns {Promise<void>}
   */
  async sendChatMessage(message = null) {
    this.logger.info('Chat message submitted', { 
        messageLength: message?.length || this.state.chatInput?.length,
        isDirectMessage: !!message
    });
    
    // Check for valid message and not already in loading state
    if (this.state.isSendingMessage) {
        this.logger.warn('Ignoring submit: already sending a message');
        return;
    }
    
    // Use provided message or get from state
    const messageText = message || this.state.chatInput;
    
    if (!messageText || messageText.trim() === '') {
        this.logger.warn('No message to send - empty input');
        return;
    }
    
    // Create timestamp for consistency
    const timestamp = new Date().toISOString();
    
    // Create message object for history
    const userMessage = {
        id: nanoid(),
        role: 'user',
        content: messageText.trim(),
        timestamp
    };
    
    this.logger.debug('Created user message', userMessage);
    
    // Clear input field immediately
    const inputEl = document.querySelector('.research-chat-input input');
    if (inputEl) {
        inputEl.value = '';
    }
    
    // Set loading state and add user message
    await new Promise(resolve => {
        this.setState(prevState => ({
            chatMessages: [...(prevState.chatMessages || []), userMessage],
            chatInput: '',
            isSendingMessage: true
        }), () => {
            this.logger.debug('State updated with user message', {
                messageCount: this.state.chatMessages.length,
                lastMessage: userMessage.id
            });
            this.updateChatInterface();
            this.scrollChatToBottom();
            resolve();
        });
    });
    
    try {
        // Check LLM connection and try to initialize if not connected
        if (!this.state.llmConnected) {
            this.logger.info('LLM not connected, attempting to initialize...');
            const isAvailable = await this.initializeLlmService();
            
            if (!isAvailable) {
                throw new Error('LLM service not available. Please try again in a moment.');
            }
        }
        
        // Double check connection after initialization
        if (!this.state.llmConnected) {
            throw new Error('LLM service failed to initialize. Please try again.');
        }
        
        this.logger.info('Preparing to send message to LLM');
        const researchContext = this.generateResearchContext();
        const systemInstructions = `You are Voyager, a research assistant helping with web browsing and research tasks. 
        Your goal is to provide helpful insights based on the extracted content from web pages.
        
        ${researchContext}
        
        Use the available tools to search the knowledge base, analyze content, and provide better assistance.
        Only use tools when they would meaningfully help answer the user's question or perform a requested task.
        
        Please be concise, helpful and accurate in your responses.`;
        
        const chatHistory = this.generateChatHistory();
        this.logger.debug('Sending message to LLM with history', {
            historyLength: chatHistory.length,
            systemInstructions: systemInstructions.substring(0, 100) + '...'
        });
        
        // Get available tools
        const tools = this.getResearchTools();
        this.logger.debug('Using research tools:', tools.map(t => t.name));
        
        // Ensure UI shows loading state with ThinkingVisualization
        this.updateChatInterface();
        
        const response = await this.llmService.sendMessage(messageText, chatHistory, {
            systemPrompt: systemInstructions,
            temperature: 0.3,
            maxTokens: 1000,
            tools: tools // Add tools to the request
        });
        
        this.logger.debug('Received LLM response', {
            hasError: response.error,
            responseType: typeof response,
            contentLength: response.content?.length || response.text?.length
        });
        
        if (response.error) {
            throw new Error(response.text || 'Error getting response from LLM');
        }
        
        // Create assistant message with processed content
        const assistantMessage = {
            id: nanoid(),
            role: 'assistant',
            content: response.content || response.text,
            timestamp: new Date().toISOString(),
            ...(response.toolCalls && { toolCalls: response.toolCalls })
        };
        
        this.logger.debug('Created assistant message', assistantMessage);
        
        // Update state with assistant message
        await new Promise(resolve => {
            this.setState(prevState => ({
                chatMessages: [...prevState.chatMessages, assistantMessage],
                isSendingMessage: false
            }), () => {
                this.logger.debug('State updated with assistant response', {
                    messageCount: this.state.chatMessages.length,
                    lastMessage: assistantMessage.id
                });
                this.updateChatInterface();
                this.scrollChatToBottom();
                resolve();
            });
        });
        
        // Process any tool calls if present
        if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
            this.logger.info('Processing tool calls', {
                count: assistantMessage.toolCalls.length,
                tools: assistantMessage.toolCalls.map(t => t.name || 'unnamed')
            });
            
            // Prevent recursive calls
            if (this._processingToolCalls) {
                this.logger.warn('Preventing recursive tool call processing');
                return;
            }
            
            // Set processing flag
            this._processingToolCalls = true;
            
            try {
                for (const toolCall of assistantMessage.toolCalls) {
                    // Skip null or undefined tool calls
                    if (!toolCall) {
                        this.logger.error('Received null or undefined tool call');
                        continue;
                    }
                    
                    // Skip tool calls without a name
                    if (!toolCall.name) {
                        this.logger.error('Tool call missing required name property');
                        continue;
                    }
                    
                    // Handle tool call depth to prevent nested tool call chains
                    if (this._toolCallDepth && this._toolCallDepth > 2) {
                        this.logger.warn('Tool call depth exceeded, preventing potential recursion');
                        
                        const depthWarningMessage = {
                            id: nanoid(),
                            role: 'system',
                            content: 'Tool call chain depth exceeded. Some tool calls were not processed to prevent potential infinite loops.',
                            timestamp: new Date().toISOString()
                        };
                        
                        this.setState(prevState => ({
                            chatMessages: [...prevState.chatMessages, depthWarningMessage]
                        }));
                        
                        continue;
                    }
                    
                    // Increment tool call depth
                    this._toolCallDepth = (this._toolCallDepth || 0) + 1;
                    
                    // Ensure args is valid
                    let toolArgs = toolCall.args;
                    if (typeof toolArgs === 'string') {
                        try {
                            toolArgs = JSON.parse(toolArgs);
                        } catch (e) {
                            this.logger.error(`Invalid tool args JSON: ${e.message}`);
                            // Keep as string if parsing fails
                        }
                    } else if (!toolArgs) {
                        toolArgs = {}; // Default to empty object
                    }
                    
                    const toolMessage = {
                        id: nanoid(),
                        role: 'tool',
                        toolCallId: toolCall.id || toolCall.toolCallId,
                        name: toolCall.name,
                        content: `Executing tool: ${toolCall.name}`,
                        status: 'running',
                        args: toolArgs,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Add tool message to chat
                    await new Promise(resolve => {
                        this.setState(prevState => ({
                            chatMessages: [...prevState.chatMessages, toolMessage],
                            isSendingMessage: true // Set to true to show thinking state during tool execution
                        }), () => {
                            this.updateChatInterface();
                            resolve();
                        });
                    });
                    
                    try {
                        // Add validation for required tool call parameters
                        if (!toolMessage.toolCallId) {
                            throw new Error('Tool call ID is missing');
                        }
                        
                        if (!toolCall.name) {
                            throw new Error('Tool name is missing');
                        }
                        
                        const toolResult = await this.llmService.executeToolCall(
                            toolMessage.toolCallId,
                            toolCall.name,
                            toolMessage.args // Use the validated args from toolMessage
                        );
                        
                        // Update tool message with result
                        await new Promise(resolve => {
                            this.setState(prevState => {
                                const messages = [...prevState.chatMessages];
                                const toolIndex = messages.findIndex(msg => 
                                    msg.role === 'tool' && msg.toolCallId === toolMessage.toolCallId
                                );
                                
                                if (toolIndex !== -1) {
                                    messages[toolIndex] = {
                                        ...messages[toolIndex],
                                        content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2),
                                        status: 'completed'
                                    };
                                }
                                
                                return { 
                                  chatMessages: messages,
                                  isSendingMessage: false // Reset loading state after tool completion
                                };
                            }, () => {
                                this.updateChatInterface();
                                resolve();
                            });
                        });
                    } catch (toolError) {
                        this.logger.error('Error executing tool', {
                            tool: toolCall.name || 'unknown',
                            error: toolError.message,
                            toolCallId: toolMessage.toolCallId || 'missing',
                            hasArgs: !!toolCall.args
                        });
                        
                        // Update tool message with error
                        await new Promise(resolve => {
                            this.setState(prevState => {
                                const messages = [...prevState.chatMessages];
                                const toolIndex = messages.findIndex(msg => 
                                    msg.role === 'tool' && msg.toolCallId === toolMessage.toolCallId
                                );
                                
                                if (toolIndex !== -1) {
                                    messages[toolIndex] = {
                                        ...messages[toolIndex],
                                        content: `Error: ${toolError.message}`,
                                        status: 'error'
                                    };
                                }
                                
                                return { 
                                  chatMessages: messages,
                                  isSendingMessage: false // Reset loading state after error
                                };
                            }, () => {
                                this.updateChatInterface();
                                resolve();
                            });
                        });
                    } finally {
                        // Decrement tool call depth
                        this._toolCallDepth = (this._toolCallDepth || 1) - 1;
                    }
                }
            } finally {
                // Always clear processing flag when done
                this._processingToolCalls = false;
                // Reset tool call depth
                this._toolCallDepth = 0;
                // Ensure loading state is off
                this.setState({ isSendingMessage: false }, () => {
                    this.updateChatInterface();
                });
            }
        }
    } catch (error) {
        this.logger.error('Error in chat message handling', {
            error: error.message,
            stack: error.stack
        });
        
        const errorMessage = {
            id: nanoid(),
            role: 'assistant',
            content: `Sorry, I encountered an error: ${error.message}. Please try again later.`,
            timestamp: new Date().toISOString(),
            isError: true
        };
        
        // Add error message to chat history
        await new Promise(resolve => {
            this.setState(prevState => ({
                chatMessages: [...prevState.chatMessages, errorMessage],
                isSendingMessage: false
            }), () => {
                this.logger.debug('State updated with error message', {
                    messageCount: this.state.chatMessages.length,
                    lastMessage: errorMessage.id
                });
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
    
    // Return from cache if entries haven't changed
    if (this.memoCache.researchContext.entries === researchEntries &&
        this.memoCache.researchContext.result !== null) {
      return this.memoCache.researchContext.result;
    }
    
    if (researchEntries.length === 0) {
      const result = 'No research entries available yet.';
      // Cache the result
      this.memoCache.researchContext.entries = researchEntries;
      this.memoCache.researchContext.result = result;
      return result;
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
    
    // Cache the result
    this.memoCache.researchContext.entries = researchEntries;
    this.memoCache.researchContext.result = context;
    
    return context;
  }
  
  /**
   * Generate chat history in format expected by LlmService
   * @returns {Array} - Formatted chat history
   */
  generateChatHistory() {
    const { chatMessages } = this.state;
    
    // Return from cache if messages haven't changed
    if (this.memoCache.chatHistory.messages === chatMessages &&
        this.memoCache.chatHistory.result !== null) {
      return this.memoCache.chatHistory.result;
    }
    
    // Limit to last 10 messages to prevent context overflow
    const recentMessages = chatMessages.slice(-10);
    
    // Convert to format expected by LlmService
    const result = recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Cache the result
    this.memoCache.chatHistory.messages = chatMessages;
    this.memoCache.chatHistory.result = result;
    
    return result;
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
    this.logger.debug('Updating chat interface', {
        messageCount: this.state.chatMessages?.length || 0,
        isSending: this.state.isSendingMessage,
        processingType: this.state.processingType || 'default',
        inputHandlersRegistered: this.state.inputHandlersRegistered
    });
    
    // Calculate a hash of current state to check if we need to update
    const stateHash = JSON.stringify({
      messagesLength: this.state.chatMessages?.length,
      isSending: this.state.isSendingMessage,
      processingType: this.state.processingType || 'default',
      processingMessage: this.state.processingMessage,
      lastMessageId: this.state.chatMessages?.[this.state.chatMessages.length - 1]?.id,
      isActive: this.state.isActive,
      inputHandlersRegistered: this.state.inputHandlersRegistered
    });
    
    // Skip update if state hasn't changed meaningfully and handlers are registered
    if (stateHash === this.memoCache.lastInterfaceUpdateHash && this.state.inputHandlersRegistered) {
      this.logger.debug('Skipping chat interface update - no meaningful changes');
      return;
    }
    
    this.memoCache.lastInterfaceUpdateHash = stateHash;
    
    // Get the research panel
    const researchPanel = this.getResearchPanel();
    if (!researchPanel || !researchPanel.isConnected) {
        this.logger.warn('Research panel not found or not connected to DOM');
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
        this.logger.debug('Creating panel content container');
        panelContent = document.createElement('div');
        panelContent.className = 'research-panel-content';
        researchPanel.appendChild(panelContent);
    }

    // Get or create chat container
    let chatContainer = panelContent.querySelector('.research-chat-container');
    if (!chatContainer) {
        this.logger.debug('Creating chat container');
        chatContainer = document.createElement('div');
        chatContainer.className = 'research-chat-container';
        panelContent.appendChild(chatContainer);
    }

    // Get or create messages container
    let messagesContainer = chatContainer.querySelector('.research-chat-messages');
    if (!messagesContainer) {
        this.logger.debug('Creating messages container');
        messagesContainer = document.createElement('div');
        messagesContainer.className = 'research-chat-messages';
        chatContainer.appendChild(messagesContainer);
    }

    // Only rebuild messages if needed
    if (this.memoCache.lastMessageUpdateHash !== stateHash) {
        this.memoCache.lastMessageUpdateHash = stateHash;
        // Clear existing messages
        messagesContainer.innerHTML = '';

        // Add each message with memoization
        this.state.chatMessages.forEach((message, index) => {
            this.logger.debug(`Creating message element ${index + 1}/${this.state.chatMessages.length}`, {
                role: message.role,
                id: message.id
            });
            
            // Check if we have a cached message element
            let messageEl = this.memoCache.messageElements.get(message.id);
            
            // Create new element if not cached
            if (!messageEl) {
                messageEl = document.createElement('div');
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
                roleLabel.textContent = message.role === 'user' ? 'You' : 
                                    message.role === 'tool' ? `Tool: ${message.name}` : 
                                    'Research Assistant';
                contentWrapper.appendChild(roleLabel);
                
                // Add content
                const contentEl = document.createElement('div');
                contentEl.className = 'message-text';
                
                // Handle tool messages specially
                if (message.role === 'tool') {
                    // Add tool status
                    const statusEl = document.createElement('div');
                    statusEl.className = `tool-status ${message.status || 'running'}`;
                    statusEl.textContent = message.status === 'completed' ? '✓ ' : 
                                        message.status === 'error' ? '✗ ' : 
                                        '⋯ ';
                    contentEl.appendChild(statusEl);
                    
                    // Add tool content
                    try {
                        // Try to format as JSON if it's a JSON string
                        const content = typeof message.content === 'string' && 
                                    (message.content.startsWith('{') || message.content.startsWith('[')) ?
                                    JSON.stringify(JSON.parse(message.content), null, 2) :
                                    message.content;
                        contentEl.innerHTML += `<pre>${DOMPurify.sanitize(content)}</pre>`;
                    } catch (e) {
                        contentEl.innerHTML += DOMPurify.sanitize(message.content).replace(/\n/g, '<br>');
                    }
                } else {
                    contentEl.innerHTML = DOMPurify.sanitize(message.content).replace(/\n/g, '<br>');
                }
                contentWrapper.appendChild(contentEl);
                
                // Add timestamp
                if (message.timestamp) {
                    const timestampEl = document.createElement('div');
                    timestampEl.className = 'message-timestamp';
                    const time = new Date(message.timestamp).toLocaleTimeString();
                    timestampEl.textContent = time;
                    contentWrapper.appendChild(timestampEl);
                }
                
                messageEl.appendChild(contentWrapper);
                
                // Add tool calls if present
                if (message.toolCalls && Array.isArray(message.toolCalls) && message.toolCalls.length > 0) {
                    const toolCallsContainer = document.createElement('div');
                    toolCallsContainer.className = 'tool-calls';
                    
                    message.toolCalls.forEach(toolCall => {
                        const toolCallEl = document.createElement('div');
                        toolCallEl.className = 'tool-call';
                        
                        const toolHeader = document.createElement('div');
                        toolHeader.className = 'tool-call-header';
                        toolHeader.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                            </svg>
                            <span>Tool: ${toolCall.name}</span>
                        `;
                        toolCallEl.appendChild(toolHeader);
                        
                        if (toolCall.args) {
                            const argsEl = document.createElement('div');
                            argsEl.className = 'tool-call-args';
                            argsEl.innerHTML = `<pre>${JSON.stringify(toolCall.args, null, 2)}</pre>`;
                            toolCallEl.appendChild(argsEl);
                        }
                        
                        toolCallsContainer.appendChild(toolCallEl);
                    });
                    
                    messageEl.appendChild(toolCallsContainer);
                }
                
                // Cache the element for future use
                this.memoCache.messageElements.set(message.id, messageEl);
            }
            
            // Add animation
            messageEl.style.opacity = '0';
            messageEl.style.transform = 'translateY(10px)';
            
            messagesContainer.appendChild(messageEl);
            
            // Trigger animation
            setTimeout(() => {
                messageEl.style.opacity = '1';
                messageEl.style.transform = 'translateY(0)';
            }, 10);
        });

        // Add thinking visualization if message is being sent
        if (this.state.isSendingMessage) {
            // Create a unique ID for this loading indicator to prevent duplicates
            const loadingId = `loading-${Date.now()}`;
            
            // Check if a loading indicator already exists
            const existingLoading = messagesContainer.querySelector('.research-message.loading');
            if (!existingLoading) {
                const loadingEl = document.createElement('div');
                loadingEl.className = 'research-message assistant loading';
                loadingEl.id = loadingId;
                
                // Create the thinking visualization wrapper
                const thinkingWrapper = document.createElement('div');
                thinkingWrapper.className = 'thinking-visualization-wrapper';
                
                // Add role label
                const roleLabel = document.createElement('div');
                roleLabel.className = 'message-role';
                roleLabel.textContent = 'Research Assistant';
                thinkingWrapper.appendChild(roleLabel);
                
                try {
                    // Try to create the thinking visualization dynamically
                    // First, check if ResearcherThinkingVisualization is available in the global scope
                    if (window.ResearcherThinkingVisualization || 
                        window.renderers?.ResearcherThinkingVisualization || 
                        window.components?.researcher?.ResearcherThinkingVisualization) {
                        
                        const ThinkingVisComponent = window.ResearcherThinkingVisualization || 
                                                window.renderers?.ResearcherThinkingVisualization || 
                                                window.components?.researcher?.ResearcherThinkingVisualization;
                        
                        // Create a container for the thinking visualization
                        const thinkingContainer = document.createElement('div');
                        thinkingContainer.className = 'researcher-thinking-container';
                        thinkingContainer.style.minHeight = '30px';
                        thinkingContainer.style.display = 'flex';
                        thinkingContainer.style.alignItems = 'center';
                        thinkingContainer.style.justifyContent = 'center';
                        
                        // Get the processing type and message from state
                        const processingType = this.state.processingType || 'default';
                        const processingMessage = this.state.processingMessage || (
                            processingType === 'analysis' ? 'Analyzing document content' :
                            processingType === 'extraction' ? 'Extracting document content' :
                            'Thinking'
                        );
                        
                        // Render ResearcherThinkingVisualization if available (React component rendered to DOM)
                        if (window.ReactDOM && ThinkingVisComponent) {
                            window.ReactDOM.render(
                                window.React.createElement(ThinkingVisComponent, {
                                    message: processingMessage,
                                    type: processingType,
                                    size: 'medium'
                                }),
                                thinkingContainer
                            );
                        } else {
                            // Fallback to a simpler implementation if React components aren't available
                            // Create a similar-styled visualization with CSS
                            thinkingContainer.innerHTML = `
                                <div class="researcher-thinking-visualization ${processingType}">
                                    <div class="researcher-thinking-content">
                                        <div class="researcher-thinking-message">
                                            <span>${processingMessage}</span>
                                            <div class="researcher-thinking-dots">
                                                <span>.</span>
                                                <span>.</span>
                                                <span>.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                        
                        thinkingWrapper.appendChild(thinkingContainer);
                    } else {
                        // If our component isn't available, use a simple animation
                        const fallbackEl = document.createElement('div');
                        fallbackEl.style.display = 'flex';
                        fallbackEl.style.alignItems = 'center';
                        
                        // Get the processing message from state
                        const processingMessage = this.state.processingMessage || 'Thinking';
                        
                        fallbackEl.innerHTML = `
                            <span>${processingMessage}</span>
                            <span style="display: inline-block; margin-left: 4px; animation: blink 1.4s infinite both;">.</span>
                            <span style="display: inline-block; margin-left: 0; animation: blink 1.4s 0.2s infinite both;">.</span>
                            <span style="display: inline-block; margin-left: 0; animation: blink 1.4s 0.4s infinite both;">.</span>
                        `;
                        thinkingWrapper.appendChild(fallbackEl);
                    }
                } catch (e) {
                    // If any error occurs during ThinkingVisualization rendering, use fallback
                    const fallbackEl = document.createElement('div');
                    fallbackEl.style.display = 'flex';
                    fallbackEl.style.alignItems = 'center';
                    
                    // Get the processing message from state
                    const processingMessage = this.state.processingMessage || 'Thinking';
                    
                    fallbackEl.innerHTML = `
                        <span>${processingMessage}</span>
                        <span style="display: inline-block; margin-left: 4px; animation: blink 1.4s infinite both;">.</span>
                        <span style="display: inline-block; margin-left: 0; animation: blink 1.4s 0.2s infinite both;">.</span>
                        <span style="display: inline-block; margin-left: 0; animation: blink 1.4s 0.4s infinite both;">.</span>
                    `;
                    thinkingWrapper.appendChild(fallbackEl);
                    console.error('Error rendering ThinkingVisualization:', e);
                }
                
                loadingEl.appendChild(thinkingWrapper);
                messagesContainer.appendChild(loadingEl);
                
                // Add animation
                loadingEl.style.opacity = '0';
                loadingEl.style.transform = 'translateY(10px)';
                
                // Trigger animation
                setTimeout(() => {
                    if (document.getElementById(loadingId)) {
                        loadingEl.style.opacity = '1';
                        loadingEl.style.transform = 'translateY(0)';
                    }
                }, 10);
            }
        }
    }

    // Check if an input container exists and handlers are registered
    let inputContainer = chatContainer.querySelector('.research-chat-input');
    if (!inputContainer || !this.state.inputHandlersRegistered) {
        // If input handlers aren't registered, we need to ensure chat interface
        if (!this.state.inputHandlersRegistered) {
            this.logger.debug('Input handlers not registered, ensuring chat interface');
            this._ensureChatInterface();
            return; // ensureChatInterface will call updateChatInterface again
        }
    } else {
        // Update existing input value only if it doesn't match current state
        // and isn't focused (to avoid interrupting typing)
        const inputEl = inputContainer.querySelector('input');
        if (inputEl && document.activeElement !== inputEl && 
            inputEl.value !== this.state.chatInput) {
            inputEl.value = this.state.chatInput || '';
        }
        
        // Disable input while message is being sent
        if (inputEl) {
            inputEl.disabled = this.state.isSendingMessage;
            
            // Show disabled message when input is disabled
            if (this.state.isSendingMessage) {
                inputContainer.classList.add('disabled');
                
                // Add a disabled message if it doesn't exist
                let disabledMessage = inputContainer.querySelector('.research-chat-input-disabled-message');
                if (!disabledMessage) {
                    disabledMessage = document.createElement('div');
                    disabledMessage.className = 'research-chat-input-disabled-message';
                    disabledMessage.textContent = 'Please wait while I process your request...';
                    inputContainer.appendChild(disabledMessage);
                }
            } else {
                inputContainer.classList.remove('disabled');
                
                // Remove disabled message if it exists
                const disabledMessage = inputContainer.querySelector('.research-chat-input-disabled-message');
                if (disabledMessage) {
                    disabledMessage.remove();
                }
            }
        }
    }

    // Scroll to bottom
    this.scrollChatToBottom();

    // Focus input if not sending message
    if (!this.state.isSendingMessage) {
        const inputEl = inputContainer?.querySelector('input');
        if (inputEl) {
            setTimeout(() => inputEl.focus(), 100);
        }
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
          this.analyzeCurrentPage();
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
    
    // Remove any event listeners
    this.removeAllEventListeners();
    
    // Also find and remove any lingering .research-chat-input elements that might not be tracked
    const researchPanel = this.getResearchPanel();
    if (researchPanel) {
      const extraInputs = researchPanel.querySelectorAll('.research-chat-input');
      if (extraInputs.length > 0) {
        this.logger.info(`Found ${extraInputs.length} additional untracked input elements to remove`);
        extraInputs.forEach(element => {
          if (element && element.parentNode) {
            element.parentNode.removeChild(element);
          }
        });
      }
    }
    
    // Reset input handlers registered flag
    this.setState({ inputHandlersRegistered: false });
  }
  
  /**
   * Gets available tools for research assistant
   * @returns {Array} Array of tool definitions
   */
  getResearchTools() {
    // Default research tools
    const defaultTools = [
      {
        name: "searchKnowledgeBase",
        description: "Search the knowledge base for relevant information using semantic search",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to find relevant information"
            },
            filters: {
              type: "object",
              description: "Optional filters for the search",
              properties: {
                sourceType: {
                  type: "string",
                  description: "Filter by content source type (e.g., 'web', 'pdf', 'youtube')"
                },
                dateAdded: {
                  type: "string",
                  description: "Filter by date added (e.g., 'today', 'this_week', 'this_month')"
                }
              }
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 5)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "summarizeContent",
        description: "Generate a concise summary of provided content with key points",
        parameters: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The text content to summarize"
            },
            length: {
              type: "string",
              enum: ["short", "medium", "long"],
              description: "The desired summary length"
            }
          },
          required: ["content"]
        }
      },
      {
        name: "recommendRelatedContent",
        description: "Recommend related content based on a query or existing content",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The query to find related content for"
            },
            itemId: {
              type: "string",
              description: "ID of an existing item to find related content for"
            },
            limit: {
              type: "number",
              description: "Maximum number of recommendations to return (default: 3)"
            }
          }
        }
      },
      {
        name: "queryDatabase",
        description: "Query the database using natural language",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language query for the database"
            },
            filters: {
              type: "object",
              description: "Optional filters for the query"
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return"
            }
          },
          required: ["query"]
        }
      }
    ];
    
    // Check if we have access to backend tools
    if (window.server && typeof window.server.getAvailableTools === 'function') {
      try {
        // Get backend tools asynchronously, but return default tools immediately
        window.server.getAvailableTools().then(tools => {
          if (tools && Array.isArray(tools)) {
            this._cachedTools = tools;
          }
        }).catch(err => {
          this.logger.warn('Error getting available tools', err);
        });
        
        // Return cached tools if available
        if (this._cachedTools) {
          return this._cachedTools;
        }
      } catch (err) {
        this.logger.warn('Error accessing backend tools', err);
      }
    }
    
    return defaultTools;
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

  /**
   * Analyze current page with the new thinking visualization
   */
  analyzeCurrentPage() {
    if (!this.props.browser || !this.props.browser.webview) {
      this.logger.error('Cannot analyze page: browser or webview not available');
      return;
    }

    const browser = this.props.browser;
    const url = browser.currentUrl;
    const title = browser.webview.getTitle?.() || 'Untitled Page';
    
    this.logger.info(`Analyzing current page: ${url} (${title})`);
    
    // Set processing state and show thinking visualization with extraction type
    this.setState({
      isProcessing: true,
      isSendingMessage: true, // This triggers the thinking visualization
      processingType: 'extraction', // Set the processing type to extraction for the visualization
      processingMessage: 'Extracting webpage content', // Custom message for extraction phase
      currentUrl: url,
      currentTitle: title,
      error: null
    }, () => {
      // Update UI to show thinking visualization
      this.updateChatInterface();
    });
    
    // First check if the webview has finished loading
    if (browser.isLoading) {
      this.logger.warn('Page is still loading, waiting for it to complete...');
      // Show a notification in the research panel
      this.setState({
        isProcessing: true,
        error: 'Page is still loading. Please wait a moment and try again.'
      });
      
      // Wait for the page to finish loading
      setTimeout(() => {
        // Check again if the page has loaded
        if (!browser.isLoading) {
          this.logger.info('Page has finished loading, proceeding with analysis');
          this._processAndAnalyze(browser);
        } else {
          this.logger.warn('Page is still loading after delay, attempting analysis anyway');
          this._processAndAnalyze(browser);
        }
      }, 1000);
      
      return;
    }
    
    // Process and analyze the page if it's already loaded
    this._processAndAnalyze(browser);
  }
  
  /**
   * Private helper to process page content and then analyze it
   * This avoids duplicating entries and ensures analysis happens
   * @param {Object} browser - The browser instance
   * @param {Object} preExtractedContent - Optional pre-extracted content
   * @returns {Promise} - Promise that resolves when processing and analysis is complete
   */
  _processAndAnalyze(browser, preExtractedContent = null) {
    const url = browser.currentUrl;
    const title = browser.webview.getTitle?.() || 'Untitled Page';
    
    this.logger.info(`Processing current page: ${url} (${title})`);
    
    // Use pre-extracted content if provided, otherwise extract it ourselves
    let contentPromise;
    if (preExtractedContent) {
      this.logger.info('Using pre-extracted content');
      contentPromise = Promise.resolve(preExtractedContent);
    } else {
      // Add a small delay to ensure the page is fully loaded
      contentPromise = new Promise(resolve => setTimeout(resolve, 500))
        .then(() => {
          // Use the current URL from the browser
          const currentUrl = browser.currentUrl || url;
          const currentTitle = browser.webview.getTitle?.() || title || 'Untitled Page';
          
          this.logger.info(`Processing current page: ${currentUrl} (${currentTitle})`);
          
          // Use our new robust extraction system with multiple fallback methods
          return extractionSystem.extractContent(browser, currentUrl, {
            // Set extraction options if needed
            preferredMethod: 'auto'
          });
        });
    }
    
    return contentPromise
      .then(content => {
        if (!content) {
          throw new Error('No content extracted');
        }
        
        // Log successful extraction
        this.logger.info(`Content extracted successfully from ${url}, text length: ${content.text?.length || 0}`);
        
        // Check if we already have an entry for this URL in the research entries
        const existingEntryIndex = this.state.researchEntries.findIndex(entry => 
          entry.url === browser.currentUrl);
          
        if (existingEntryIndex !== -1) {
          // Use existing entry ID if we have one
          const entryId = this.state.researchEntries[existingEntryIndex].id;
          
          // Update the entry with new content
          const updatedEntries = [...this.state.researchEntries];
          updatedEntries[existingEntryIndex] = {
            ...updatedEntries[existingEntryIndex],
            content: content,
            timestamp: new Date().toISOString(),
            // Preserve any existing analysis
            analysis: updatedEntries[existingEntryIndex].analysis
          };
          
          // Update state with new content and change visualization to analysis type
          this.setState({
            researchEntries: updatedEntries,
            isProcessing: false,
            processingType: 'analysis', // Change to analysis type for visualization
            processingMessage: 'Analyzing extracted content', // Update message for analysis phase
          });
          
          // Update the research panel UI
          this.updateResearchPanel(updatedEntries[existingEntryIndex]);
          
          // Immediately analyze the content using the existing entry ID
          if (this.state.llmConnected) {
            this.analyzeContent(entryId);
          }
          
          return updatedEntries[existingEntryIndex];
        } else {
          // Create a new research entry if none exists
          const entry = {
            id: nanoid(),
            url: browser.currentUrl || url,
            title: browser.webview.getTitle?.() || title || content.title || 'Untitled Page',
            timestamp: new Date().toISOString(),
            content: content,
            analysis: null
          };
          
          // Add to research entries and change visualization to analysis type
          this.setState(prevState => ({
            researchEntries: [entry, ...prevState.researchEntries],
            isProcessing: false,
            processingType: 'analysis', // Change to analysis type for visualization
            processingMessage: 'Analyzing extracted content', // Update message for analysis phase
          }));
          
          // Update the research panel UI
          this.updateResearchPanel(entry);
          
          // Immediately analyze the content
          if (this.state.llmConnected) {
            this.analyzeContent(entry.id);
          }
          
          return entry;
        }
      })
      .catch(error => {
        console.error('Error processing page:', error);
        this.setState({
          isProcessing: false,
          isSendingMessage: false, // Turn off thinking visualization
          processingType: 'default', // Reset processing type
          processingMessage: null,  // Clear processing message
          error: error.message || 'Error processing page'
        });
        
        // If we have the notification service, show an error
        if (browser.notificationService) {
          browser.notificationService.show('Failed to extract page content: ' + error.message, 'error');
        }
        
        return null;
      });
  }
}

// Make sure to export the class directly
export default Researcher; 