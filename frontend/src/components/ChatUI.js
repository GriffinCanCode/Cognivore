// ChatUI Component - Modern chat interface for knowledge assistant
import LlmService from '../services/LlmService.js';
import ChatMessages from './ChatMessages.js';
import ChatInput from './ChatInput.js';
import logger from '../utils/logger.js';

// Create context-specific logger
const chatLogger = logger.scope('ChatUI');

class ChatUI {
  /**
   * Constructor for ChatUI component
   * @param {Object} notificationService - Service for showing notifications
   */
  constructor(notificationService) {
    // Services
    this.notificationService = notificationService;
    this.llmService = new LlmService();
    
    // Child Components
    this.chatMessages = null;
    this.chatInput = null;
    
    // State
    this.container = null;
    this.messages = [];
    this.isLoading = false;
    this.error = null;
    this.modelInfo = null;
    this.backendUnavailable = false;
    
    // App reference
    this.app = null;
    
    // Bind methods to this instance
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleNewChat = this.handleNewChat.bind(this);
    this.updateUI = this.updateUI.bind(this);
    this.handleErrorResponse = this.handleErrorResponse.bind(this);
  }

  /**
   * Initialize the chat component
   */
  async initialize() {
    try {
      // Check if backend is available first
      chatLogger.info('Initializing ChatUI...');
      try {
        const isBackendAvailable = await this.llmService.checkBackendStatus();
        if (!isBackendAvailable) {
          chatLogger.error('Backend server is not available during initialization');
          this.showBackendUnavailableMessage();
          return; // Stop initialization if backend is not available
        }
      } catch (err) {
        chatLogger.error('Error checking backend status during initialization:', err);
        this.showBackendUnavailableMessage();
        return; // Stop initialization if error occurs
      }
      
      // Load model information only if backend is available
      await this.loadModelInfo();
      
      // Initialize child components
      this.chatMessages = new ChatMessages(this.messages, this.isLoading);
      
      // Initialize ChatInput component
      if (!this.chatInput) {
        this.chatInput = new ChatInput(this.handleSubmit);
      }
      
      // Ensure container is properly connected to DOM before updating UI
      if (this.container) {
        if (!this.container.isConnected) {
          // Try to find our container in the DOM
          const domContainer = document.getElementById('main-chat-container');
          if (domContainer) {
            chatLogger.debug('Found container in DOM, updating reference');
            this.container = domContainer;
          } else {
            chatLogger.error('Container not found in DOM during initialization, skipping UI update');
            // Don't try to update UI yet
            chatLogger.info('ChatUI initialization complete');
            return;
          }
        }
        this.updateUI();
      }
      
      chatLogger.info('ChatUI initialization complete');
    } catch (error) {
      chatLogger.error('Error initializing ChatUI:', error);
      this.notificationService?.error('Failed to initialize chat');
      this.showBackendUnavailableMessage();
    }
  }
  
  /**
   * Load model information from the backend
   */
  async loadModelInfo() {
    try {
      const model = await this.llmService.getModel();
      this.modelInfo = model;
    } catch (error) {
      chatLogger.error('Error loading model info:', error);
      this.modelInfo = 'Unknown model';
    }
  }

  /**
   * Handle new chat button click - can be called from parent
   */
  handleNewChat() {
    this.messages = [];
    this.updateUI();
  }

  /**
   * Handle message submission
   * @param {string} message - The message to send
   */
  async handleSubmit(message) {
    // Check for valid message and not already in loading state
    if (!message || !message.trim()) {
      chatLogger.debug('Invalid or empty message, ignoring submission');
      return;
    }
    
    if (this.isLoading) {
      chatLogger.debug('Already loading, ignoring submission');
      return;
    }
    
    chatLogger.info('ChatUI.handleSubmit called with message:', message.substring(0, 30) + (message.length > 30 ? '...' : ''));
    
    // Set loading state immediately
    this.isLoading = true;
    if (this.chatInput) {
      this.chatInput.setDisabled(true, 'Sending message...');
    }
    
    try {
      // Create user message object
      const userMessage = {
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString()
      };
      
      // Add to messages array
      this.messages.push(userMessage);
      this.error = null;
      
      // Update UI to show user message and thinking visualization immediately
      chatLogger.debug('Added user message, updating UI with thinking visualization');
      this.updateUI();
      
      // Ensure backend is available before sending
      let isBackendAvailable = false;
      try {
        isBackendAvailable = await this.llmService.checkBackendStatus();
        if (!isBackendAvailable) {
          throw new Error('Backend server is not available. Please start the backend server.');
        }
      } catch (error) {
        chatLogger.error('Backend availability check failed:', error);
        throw new Error('Backend server is not available. Please start the backend server.');
      }
      
      // Send the message to the backend
      chatLogger.debug('Sending message to backend...');
      
      let response;
      try {
        response = await this.llmService.sendMessage(message, this.messages);
        chatLogger.debug('Received response from backend:', response);
      } catch (error) {
        chatLogger.error('Error sending message to backend:', error);
        throw error;
      }
      
      // Update model info if response contains model information
      if (response.model && this.modelInfo !== response.model) {
        this.modelInfo = response.model;
      }
      
      // Check for validation errors in response
      if (response.validationErrors) {
        chatLogger.error('Validation errors in response:', response.validationErrors);
        throw new Error(`Validation error: ${response.validationErrors.join(', ')}`);
      }
      
      // Create assistant message with response data
      const assistantMessage = {
        role: 'assistant',
        content: response.text || 'I received your message but had no response to provide.',
        timestamp: new Date().toISOString(),
        toolCalls: response.toolCalls || []
      };
      
      chatLogger.debug('Adding assistant message to UI');
      this.messages.push(assistantMessage);
      this.notificationService?.success('Received response');
    } catch (err) {
      chatLogger.error('Error sending message:', err);
      this.handleErrorResponse(err);
    } finally {
      // Always ensure loading state is reset
      this.isLoading = false;
      chatLogger.debug('Updating UI after receiving response, messages length:', this.messages.length);
      
      // Get a fresh reference to the UI container
      const freshContainer = document.getElementById('main-chat-container');
      if (freshContainer && freshContainer !== this.container) {
        chatLogger.debug('Updating container reference to currently mounted element');
        this.container = freshContainer;
      }
      
      // Update UI with the current messages
      this.updateUI();
      
      // Double-check that messages are displayed
      const messageElements = document.querySelectorAll('.message');
      if (messageElements.length !== this.messages.length) {
        chatLogger.warn(`Message count mismatch: ${messageElements.length} in DOM vs ${this.messages.length} in memory`);
        // Force a full re-render
        this.forceFullRerender();
      }
      
      // Re-enable input field - must happen AFTER UI updates
      if (this.chatInput) {
        chatLogger.debug('Re-enabling chat input');
        this.chatInput.setDisabled(false);
      }
    }
  }
  
  /**
   * Force a full re-render of the messages component
   * This helps recover from DOM detachment issues
   */
  forceFullRerender() {
    chatLogger.info('Forcing full re-render of messages');
    if (!this.container || !this.container.isConnected) {
      this.container = document.getElementById('main-chat-container');
      if (!this.container) {
        chatLogger.error('Cannot find main chat container for rerender');
        return;
      }
    }
    
    this.chatMessages = new ChatMessages(this.messages, false);
    const newMessagesElement = this.chatMessages.render(null);
    
    // Find existing messages container and replace it
    const oldMessagesContainer = document.getElementById('chat-messages-container');
    if (oldMessagesContainer && oldMessagesContainer.parentNode) {
      oldMessagesContainer.parentNode.replaceChild(newMessagesElement, oldMessagesContainer);
    } else if (this.container) {
      // Just append to our container
      this.container.innerHTML = '';
      this.container.appendChild(newMessagesElement);
    }
  }
  
  /**
   * Handle errors from API responses
   * @param {Error} err - The error object
   */
  handleErrorResponse(err) {
    // Check if error is related to validation
    if (err.message && err.message.includes('Validation error')) {
      this.error = 'Validation error occurred';
      const errorMessage = {
        role: 'system',
        content: `There was an issue with input validation: ${err.message}`,
        isError: true,
        timestamp: new Date().toISOString()
      };
      this.messages.push(errorMessage);
      this.notificationService?.error('Validation error: ' + err.message);
    }
    // Check if error is related to backend unavailability
    else if (err.message && err.message.includes('Backend server is not available')) {
      this.error = 'Backend server unavailable';
      const errorMessage = {
        role: 'system',
        content: 'The backend server is not running. Please start the backend server and try again.',
        isError: true,
        timestamp: new Date().toISOString()
      };
      this.messages.push(errorMessage);
      this.notificationService?.error('Backend server is not running');
    } else {
      this.error = 'Failed to get a response. Please try again.';
      const errorMessage = {
        role: 'system',
        content: `Failed to get a response: ${err.message || 'Unknown error'}`,
        isError: true,
        timestamp: new Date().toISOString()
      };
      this.messages.push(errorMessage);
      this.notificationService?.error('Failed to get a response');
    }
  }

  /**
   * Display backend unavailable message
   */
  showBackendUnavailableMessage() {
    const errorMessage = {
      role: 'system',
      content: 'The backend server is not running. Please start the backend server by running "npm run server" in the backend directory.',
      isError: true,
      timestamp: new Date().toISOString()
    };
    
    this.messages = [errorMessage];
    this.error = 'Backend server unavailable';
    this.notificationService?.error('Backend server is not running');
    
    // Set a flag to indicate backend is unavailable
    this.backendUnavailable = true;
    
    // Update UI if container exists and is connected to DOM
    if (this.container && this.container.isConnected) {
      this.updateUI();
    } else {
      // Try to find our container in the DOM
      const domContainer = document.getElementById('main-chat-container');
      if (domContainer) {
        chatLogger.debug('Found container in DOM, updating reference');
        this.container = domContainer;
        this.updateUI();
      } else {
        chatLogger.error('Container not found in DOM, cannot show backend unavailable message');
      }
    }
    
    chatLogger.error('Backend unavailable message displayed to user');
  }
  
  /**
   * Update the UI with current state - guaranteed to update the DOM
   */
  updateUI() {
    chatLogger.debug('ChatUI.updateUI called, messages length:', this.messages.length);
    
    if (!this.container || !this.container.isConnected) {
      chatLogger.error('Main container is not connected to DOM!');
      
      // Try to find our container in the DOM
      const domContainer = document.getElementById('main-chat-container');
      if (domContainer) {
        chatLogger.debug('Found container in DOM, updating reference');
        this.container = domContainer;
      } else {
        chatLogger.error('Container not found in DOM, cannot update UI');
        return;
      }
    }
    
    // GUARANTEED APPROACH: Always recreate messages and force update
    if (this.chatMessages) {
      // Create a fresh messages element
      chatLogger.debug('Recreating messages element to force update');
      const freshMessagesElement = this.chatMessages.render(null);
      
      // Get the existing element to replace
      const existingMessagesContainer = document.getElementById('chat-messages-container');
      
      if (existingMessagesContainer) {
        chatLogger.debug('Replacing existing messages container');
        if (existingMessagesContainer.parentNode) {
          existingMessagesContainer.parentNode.replaceChild(freshMessagesElement, existingMessagesContainer);
        } else {
          chatLogger.error('Existing container has no parent!');
          this.container.innerHTML = '';
          this.container.appendChild(freshMessagesElement);
        }
      } else {
        chatLogger.debug('No existing messages container, appending to main container');
        // Clear container first
        this.container.innerHTML = '';
        this.container.appendChild(freshMessagesElement);
      }
      
      // Verify the update
      setTimeout(() => {
        const messageElements = document.querySelectorAll('.message');
        chatLogger.debug(`After DOM update: ${messageElements.length} message elements in DOM vs ${this.messages.length} in memory`);
      }, 0);
    } else {
      chatLogger.error('ChatMessages component is null in updateUI');
      this.chatMessages = new ChatMessages(this.messages, this.isLoading);
      const messagesElement = this.chatMessages.render();
      
      // Clear container first
      this.container.innerHTML = '';
      this.container.appendChild(messagesElement);
    }
    
    // Update input field state
    this.updateInputFieldState();
  }
  
  /**
   * Render the chat UI component
   * @returns {HTMLElement} - The rendered component
   */
  render() {
    chatLogger.info('ChatUI.render called');
    
    // Create container elements
    const container = document.createElement('div');
    container.className = 'chat-container';
    container.id = 'main-chat-container'; // Add a stable ID for easier lookup
    
    // Initialize child components if not already done
    if (!this.chatMessages) {
      chatLogger.debug('Creating new ChatMessages component');
      this.chatMessages = new ChatMessages(this.messages, this.isLoading);
    }
    
    // CRITICAL FIX: Always create a fresh messages element to avoid detached DOM issues
    chatLogger.debug('Forcing fresh render of ChatMessages component');
    const messagesElement = this.chatMessages.render(null);
    
    // Verify the element was created successfully
    if (messagesElement) {
      chatLogger.debug('Successfully created messages element with ID:', messagesElement.id);
      container.appendChild(messagesElement);
    } else {
      chatLogger.error('Failed to create messages element!');
      
      // Recovery attempt - create a new ChatMessages instance
      this.chatMessages = new ChatMessages(this.messages, this.isLoading);
      const recoveryElement = this.chatMessages.render(null);
      container.appendChild(recoveryElement);
    }
    
    // Create and append ChatInput if it doesn't exist yet
    if (!this.chatInput) {
      this.chatInput = new ChatInput(this.handleSubmit);
    }
    
    // Get the input element to append
    const inputElement = this.chatInput.render();
    container.appendChild(inputElement);
    
    // Save reference to the container
    this.container = container;
    
    // Set proper initial state for chat input
    this.updateInputFieldState();
    
    chatLogger.info('ChatUI render complete');
    return container;
  }
  
  /**
   * Get the chat input element
   * @returns {HTMLElement} - The chat input element
   */
  getInputElement() {
    if (!this.chatInput) {
      this.chatInput = new ChatInput(this.handleSubmit);
    }
    return this.chatInput.render();
  }
  
  /**
   * Update the input field state based on loading and errors
   */
  updateInputFieldState() {
    if (!this.chatInput) {
      return; // No input field to update
    }
    
    // Reset chatInput reference if needed
    if (this.chatInput !== this.app?.chatInput) {
      // Only update from app's chatInput if we're still using the app-provided chatInput
      if (!this.chatInput.isOwnInstance) {
        this.chatInput = this.app?.chatInput;
      }
    }
    
    if (this.chatInput) {
      const backendUnavailable = this.error === 'Backend server unavailable';
      
      if (backendUnavailable) {
        this.chatInput.setDisabled(true, 'Backend server is not running...');
      } else if (this.isLoading) {
        this.chatInput.setDisabled(true, 'Waiting for response...');
      } else {
        this.chatInput.setDisabled(false);
      }
    }
  }
  
  /**
   * Focus the chat input
   */
  focusInput() {
    if (this.chatInput) {
      this.chatInput.focus();
    }
  }

  /**
   * Clean up component resources
   */
  cleanup() {
    chatLogger.debug('ChatUI cleanup called');
    
    // Clean up the container if it exists
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    // Clean up the chatInput if we created it
    if (this.chatInput && this.chatInput.isOwnInstance) {
      this.chatInput.cleanup();
      this.chatInput = null;
    }
    
    // Clean up the messages component
    if (this.chatMessages) {
      this.chatMessages.cleanup();
      this.chatMessages = null;
    }
    
    // Reset container reference
    this.container = null;
  }
}

export default ChatUI; 