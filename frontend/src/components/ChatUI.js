// ChatUI Component - Modern chat interface for knowledge assistant
import LlmService from '../services/LlmService.js';
import ChatMessages from './ChatMessages.js';
import ChatInput from './ChatInput.js';

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
  }

  /**
   * Initialize the chat component
   */
  async initialize() {
    try {
      // Check if backend is available first
      console.log('Initializing ChatUI...');
      try {
        const isBackendAvailable = await this.llmService.checkBackendStatus();
        if (!isBackendAvailable) {
          console.error('Backend server is not available during initialization');
          this.showBackendUnavailableMessage();
          return; // Stop initialization if backend is not available
        }
      } catch (err) {
        console.error('Error checking backend status during initialization:', err);
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
      
      // Update UI if container exists
      if (this.container) {
        this.updateUI();
      }
      
      console.log('ChatUI initialization complete');
    } catch (error) {
      console.error('Error initializing ChatUI:', error);
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
      console.error('Error loading model info:', error);
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
    if (!message || !message.trim() || this.isLoading) {
      console.log('Invalid message or already loading, ignoring submission');
      return;
    }
    
    console.log('ChatUI.handleSubmit called with message:', message);
    
    // Create user message object
    const userMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    };
    
    // Add to messages array
    this.messages.push(userMessage);
    this.isLoading = true;
    this.error = null;
    
    // Update UI to show user message immediately
    console.log('Added user message, updating UI');
    this.updateUI();
    
    // Ensure messagesElement is properly connected to DOM
    const messagesContainer = document.getElementById('chat-messages-container');
    if (!messagesContainer || !messagesContainer.isConnected) {
      console.error('Messages container is not in DOM');
      // Try to fix by recreating the chat container
      if (this.container) {
        const newMessagesElement = this.chatMessages.render();
        this.container.innerHTML = '';
        this.container.appendChild(newMessagesElement);
      }
    }
    
    console.log('Added user message, messages length:', this.messages.length);
    
    try {
      // Ensure backend is available before sending
      const isBackendAvailable = await this.llmService.checkBackendStatus();
      if (!isBackendAvailable) {
        throw new Error('Backend server is not available. Please start the backend server.');
      }
      
      // Send the message to the backend
      console.log('Sending message to backend...');
      const response = await this.llmService.sendMessage(message, this.messages);
      console.log('Received response from backend:', response);
      
      // Update model info if response contains model information
      if (response.model && this.modelInfo !== response.model) {
        this.modelInfo = response.model;
      }
      
      // Create assistant message with response data
      const assistantMessage = {
        role: 'assistant',
        content: response.text || 'I received your message but had no response to provide.',
        timestamp: new Date().toISOString(),
        toolCalls: response.toolCalls || []
      };
      
      console.log('Adding assistant message to UI:', assistantMessage);
      this.messages.push(assistantMessage);
      this.notificationService?.success('Received response');
    } catch (err) {
      console.error('Error sending message:', err);
      this.handleErrorResponse(err);
    } finally {
      this.isLoading = false;
      console.log('Updating UI after receiving response, messages length:', this.messages.length);
      
      // Force a proper update with connected DOM elements
      // Get a fresh reference to the UI container
      const freshContainer = document.querySelector('.chat-container');
      if (freshContainer && freshContainer !== this.container) {
        console.log('Updating container reference to currently mounted element');
        this.container = freshContainer;
      }
      
      // Update UI with the current messages
      this.updateUI();
      
      // Double-check that messages are displayed
      const messageElements = document.querySelectorAll('.message');
      console.log(`After updateUI: ${messageElements.length} message elements in DOM`);
      
      if (messageElements.length !== this.messages.length) {
        console.warn(`Message count mismatch: ${messageElements.length} in DOM vs ${this.messages.length} in memory`);
        // Force a full re-render as last resort
        if (this.container) {
          console.log('Forcing full re-render of messages');
          this.chatMessages = new ChatMessages(this.messages, false);
          const newMessagesElement = this.chatMessages.render();
          
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
      }
      
      // Re-enable input field
      if (this.chatInput) {
        this.chatInput.setDisabled(false);
      }
    }
  }
  
  /**
   * Handle errors from API responses
   * @param {Error} err - The error object
   */
  handleErrorResponse(err) {
    // Check if error is related to backend unavailability
    if (err.message && err.message.includes('Backend server is not available')) {
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
        content: 'Failed to get a response. Please try again.',
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
    
    // Update UI if container exists
    if (this.container) {
      this.updateUI();
    }
    
    console.error('Backend unavailable message displayed to user');
  }
  
  /**
   * Update the UI with current state - guaranteed to update the DOM
   */
  updateUI() {
    console.log('ChatUI.updateUI called, messages length:', this.messages.length);
    
    if (!this.container || !this.container.isConnected) {
      console.error('Main container is not connected to DOM!');
      
      // Try to find our container in the DOM
      const domContainer = document.getElementById('main-chat-container');
      if (domContainer) {
        console.log('Found container in DOM, updating reference');
        this.container = domContainer;
      } else {
        console.error('Container not found in DOM, cannot update UI');
        return;
      }
    }
    
    // GUARANTEED APPROACH: Always recreate messages and force update
    if (this.chatMessages) {
      // Create a fresh messages element
      console.log('Recreating messages element to force update');
      const freshMessagesElement = this.chatMessages.render(null);
      
      // Get the existing element to replace
      const existingMessagesContainer = document.getElementById('chat-messages-container');
      
      if (existingMessagesContainer) {
        console.log('Replacing existing messages container');
        if (existingMessagesContainer.parentNode) {
          existingMessagesContainer.parentNode.replaceChild(freshMessagesElement, existingMessagesContainer);
        } else {
          console.error('Existing container has no parent!');
          this.container.innerHTML = '';
          this.container.appendChild(freshMessagesElement);
        }
      } else {
        console.log('No existing messages container, appending to main container');
        // Clear container first
        this.container.innerHTML = '';
        this.container.appendChild(freshMessagesElement);
      }
      
      // Verify the update
      setTimeout(() => {
        const messageElements = document.querySelectorAll('.message');
        console.log(`After DOM update: ${messageElements.length} message elements in DOM vs ${this.messages.length} in memory`);
      }, 0);
    } else {
      console.error('ChatMessages component is null in updateUI');
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
    console.log('ChatUI.render called');
    
    // Create container elements
    const container = document.createElement('div');
    container.className = 'chat-container';
    container.id = 'main-chat-container'; // Add a stable ID for easier lookup
    
    // Initialize child components if not already done
    if (!this.chatMessages) {
      console.log('Creating new ChatMessages component');
      this.chatMessages = new ChatMessages(this.messages, this.isLoading);
    }
    
    // CRITICAL FIX: Always create a fresh messages element to avoid detached DOM issues
    console.log('Forcing fresh render of ChatMessages component');
    const messagesElement = this.chatMessages.render(null);
    
    // Verify the element was created successfully
    if (messagesElement) {
      console.log('Successfully created messages element with ID:', messagesElement.id);
      container.appendChild(messagesElement);
    } else {
      console.error('Failed to create messages element!');
      
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
    
    // Save reference to the container
    this.container = container;
    
    // Set proper initial state for chat input
    this.updateInputFieldState();
    
    console.log('ChatUI render complete');
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
    // Clean up the container if it exists
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    // Clean up the chatInput if we created it
    if (this.chatInput) {
      this.chatInput.cleanup();
    }
    
    // Reset container reference
    this.container = null;
  }
}

export default ChatUI; 