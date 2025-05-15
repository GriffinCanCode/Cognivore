// ChatUI Component - Modern chat interface for knowledge assistant
import LlmService from '../services/LlmService.js';
import ChatMessages from './chat/ChatMessages.js';
import ChatInput from './chat/ChatInput.js';
import messageFormatter from '../utils/messageFormatter.js';
import logger from '../utils/logger.js';
import ChatHeader from './chat/ChatHeader.js';

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
    
    // Reference to the header (but we don't create it)
    this.chatHeader = null;
    
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
   * Set a reference to the header component
   * @param {ChatHeader} header - The header component to use
   */
  setHeaderComponent(header) {
    if (header) {
      this.chatHeader = header;
      this.chatHeader.setNewChatCallback(this.handleNewChat);
    }
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
      
      // CRITICAL: Ensure we have a valid container reference before initializing components
      if (!this.container || !this.container.isConnected) {
        // Try to find our container in the DOM
        const domContainer = document.getElementById('main-chat-container');
        if (domContainer) {
          chatLogger.debug('Found container in DOM, updating reference');
          this.container = domContainer;
        } else {
          chatLogger.warn('Container not found in DOM during initialization, UI update will be delayed');
          // Don't try to initialize components yet
          chatLogger.info('ChatUI initialization pending container attachment');
          
          // Set a flag to initialize again once container is attached
          this._needsInit = true;
          return;
        }
      }
      
      // Only initialize components if we have a valid container
      this._initializeComponents();
      
      chatLogger.info('ChatUI initialization complete');
    } catch (error) {
      chatLogger.error('Error initializing ChatUI:', error);
      this.notificationService?.error('Failed to initialize chat');
      this.showBackendUnavailableMessage();
    }
  }
  
  /**
   * Initialize the UI components after container is available
   * This is separate from initialize() to handle delayed initialization
   * @private
   */
  _initializeComponents() {
    try {
      // Initialize child components
      if (!this.chatMessages) {
        chatLogger.debug('Creating new ChatMessages component');
        this.chatMessages = new ChatMessages(this.messages, this.isLoading);
      }
      
      // Initialize ChatInput component
      if (!this.chatInput) {
        chatLogger.debug('Creating new ChatInput component');
        this.chatInput = new ChatInput(this.handleSubmit);
      }
      
      // Only update UI if container is connected
      if (this.container && this.container.isConnected) {
        chatLogger.debug('Container is connected, updating UI');
        
        // Render messages directly into container
        const messagesElement = this.chatMessages.render(null);
        
        // Check if messages container already exists
        const existingMessages = this.container.querySelector('#chat-messages-container');
        if (existingMessages) {
          chatLogger.debug('Replacing existing messages container');
          existingMessages.parentNode.replaceChild(messagesElement, existingMessages);
        } else {
          // Clear any existing content and add the messages
          chatLogger.debug('No existing messages container, adding one');
          this.container.innerHTML = '';
          this.container.appendChild(messagesElement);
          
          // Add input if needed
          const inputElement = this.chatInput.render();
          if (inputElement) {
            this.container.appendChild(inputElement);
          }
        }
        
        // Clear initialization flag
        this._needsInit = false;
      } else {
        chatLogger.warn('Container is not connected, delaying UI update');
        this._needsInit = true;
      }
    } catch (error) {
      chatLogger.error('Error initializing components:', error);
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
    chatLogger.info('Starting new chat, clearing messages');
    this.messages = [];
    this.updateUI();
    this.notificationService?.info('Started new chat');
  }

  /**
   * Handle message submission from chat input
   * @param {string} message - Message to send to LLM
   */
  async handleSubmit(message) {
    // Check for valid message and not already in loading state
    if (!message || this.isLoading) {
      chatLogger.warn('Ignoring submit: empty message or already loading');
      return;
    }
    
    chatLogger.info('Chat message submitted:', { messageLength: message.length });
    
    // Create timestamp for consistency
    const timestamp = new Date().toISOString();
    
    // Add user message to messages
    this.messages.push({
      role: 'user',
      content: message,
      timestamp
    });
    
    // Set loading state
    this.isLoading = true;
    if (this.chatInput) {
      this.chatInput.setDisabled(true);
    }
    
    // Update UI to show user message and loading indicator
    this.updateUI();
    
    // Double-check that messages are displayed properly
    setTimeout(() => {
      const messageElements = document.querySelectorAll('.message');
      if (messageElements.length !== this.messages.length) {
        chatLogger.warn(`Message display issue detected: ${messageElements.length} in DOM vs ${this.messages.length} in memory`);
        this.forceFullRerender();
      }
    }, 50);
    
    try {
      // Get assistant response
      chatLogger.debug('Sending message to LLM service');
      const response = await this.llmService.sendMessage(message, this.messages);
      
      // Check if response contains an error
      if (response.error === true) {
        chatLogger.error('Error response from LLM service:', response);
        return this.handleErrorResponse(response);
      }
      
      // Additional validation for response format
      if (!response) {
        chatLogger.error('Empty response received from LLM service');
        throw new Error('Empty response received from LLM service');
      }
      
      // Log the response for debugging
      chatLogger.debug('Response received from LLM service:', response);
      
      // Process the response using our formatter
      const processedResponse = messageFormatter.processResponse(response);
      
      // Extra validation for the response to ensure it has the necessary content field
      // This is critical for ChatMessages to render correctly
      if (!processedResponse.content && processedResponse.text) {
        chatLogger.debug('Response missing content field but has text field, copying text to content');
        processedResponse.content = processedResponse.text;
      }
      
      if (!processedResponse.content) {
        chatLogger.warn('Response lacks content field, setting default empty string');
        processedResponse.content = '';
      }
      
      // Create assistant message with processed content
      // Use direct property references to avoid undefined fields
      const assistantMessage = {
        role: processedResponse.role || 'assistant',
        content: processedResponse.content || '',
        timestamp: processedResponse.timestamp || new Date().toISOString()
      };
      
      // Add toolCalls only if they exist
      if (processedResponse.toolCalls && processedResponse.toolCalls.length > 0) {
        assistantMessage.toolCalls = processedResponse.toolCalls;
      }
      
      chatLogger.debug('Adding assistant message to chat:', assistantMessage);
      this.messages.push(assistantMessage);
      
      // Update UI to show assistant message before processing tool calls
      this.updateUI();
      
      // Process any tool calls
      if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
        for (const toolCall of assistantMessage.toolCalls) {
          // Normalize the tool call format to ensure consistent properties
          const normalizedToolCall = messageFormatter.normalizeToolCall(toolCall);
          if (!normalizedToolCall) {
            chatLogger.warn('Skipping invalid tool call:', toolCall);
            continue;
          }
          
          const { id: toolCallId, name: toolName, args } = normalizedToolCall;
          
          chatLogger.info(`Processing tool call: ${toolName} (${toolCallId})`);
          
          // Add tool call to messages
          this.messages.push({
            role: 'tool',
            toolCallId: toolCallId,
            name: toolName,
            content: `Executing tool: ${toolName}`,
            status: 'running',
            args: args,
            timestamp: new Date().toISOString()
          });
          
          // Update UI to show tool execution in progress
          this.updateUI();
          
          try {
            // Execute tool
            const toolResult = await this.llmService.executeToolCall(
              toolCallId,
              toolName,
              args
            );
            
            // Update tool message with result
            const toolIndex = this.messages.findIndex(msg => 
              msg.role === 'tool' && msg.toolCallId === toolCallId
            );
            
            if (toolIndex !== -1) {
              this.messages[toolIndex].content = typeof toolResult === 'string' 
                ? toolResult 
                : JSON.stringify(toolResult, null, 2);
              this.messages[toolIndex].status = 'completed';
            }
            
            // Update UI to show tool result
            this.updateUI();
          } catch (toolError) {
            chatLogger.error(`Error executing tool ${toolName}:`, toolError);
            
            // Update tool message with error
            const toolIndex = this.messages.findIndex(msg => 
              msg.role === 'tool' && msg.toolCallId === toolCallId
            );
            
            if (toolIndex !== -1) {
              this.messages[toolIndex].content = `Error: ${toolError.message}`;
              this.messages[toolIndex].status = 'error';
            }
            
            // Update UI to show tool error
            this.updateUI();
          }
        }
      }
    } catch (error) {
      chatLogger.error('Error in handleSubmit:', error);
      
      // Display error message to user
      this.messages.push({
        role: 'error',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString()
      });
      
      // Check for common error types
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        // Handle API key issues
        this.showApiKeySetupGuidance();
      } else if (error.message.includes('backend') || error.message.includes('connection')) {
        // Handle backend connection issues
        this.showBackendUnavailableMessage();
      }
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
      chatLogger.debug(`After message handling: ${messageElements.length} elements in DOM vs ${this.messages.length} in memory`);
      
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
      
      // Force scroll to bottom to ensure new messages are visible
      this.scrollToBottom(true);
    }
  }
  
  /**
   * Scrolls the chat container to the bottom
   * @param {boolean} smooth - Whether to use smooth scrolling
   */
  scrollToBottom(smooth = false) {
    if (this.chatMessages) {
      this.chatMessages.scrollToBottom(smooth);
    } else {
      // Fallback if chatMessages isn't available
      const container = document.getElementById('chat-messages-container');
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
    }
  }
  
  /**
   * Handle error response from LLM service
   * @param {Object} errorResponse - Error response from LLM service
   */
  handleErrorResponse(errorResponse) {
    chatLogger.error('Handling error response:', errorResponse);
    
    // Create formatted error message
    let errorContent = errorResponse.text || 'An unknown error occurred';
    
    // Add details if available
    if (errorResponse.details && Array.isArray(errorResponse.details)) {
      errorContent += '\n\n' + errorResponse.details.join('\n');
    }
    
    // Add the error message to chat
    this.messages.push({
      role: 'error',
      content: errorContent
    });
    
    // Handle API key issues specifically
    if (errorResponse.text && errorResponse.text.includes('API Key Issue')) {
      this.showApiKeySetupGuidance();
    }
    
    // Update UI to show the error
    this.updateUI();
  }

  /**
   * Show API key setup guidance
   */
  showApiKeySetupGuidance() {
    const setupMessage = {
      role: 'system',
      content: `
## API Key Setup Required

This application requires a Google API key to function. To set up your API key:

1. Visit [Google AI Studio](https://ai.google.dev/)
2. Sign in and get an API key (it's free)
3. Add the API key to \`backend/.env\` file:
   \`\`\`
   GOOGLE_API_KEY=your_api_key_here
   \`\`\`
4. Restart the application

For detailed instructions, see the \`backend/API_SETUP.md\` file.
    `
    };
    
    // Add this guidance to chat messages
    this.messages.push(setupMessage);
    this.updateUI();
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
    
    // Create a fresh ChatMessages instance to ensure clean state
    this.chatMessages = new ChatMessages(this.messages, false);
    const newMessagesElement = this.chatMessages.render(null);
    
    // Find existing messages container and replace it
    const oldMessagesContainer = document.getElementById('chat-messages-container');
    if (oldMessagesContainer && oldMessagesContainer.parentNode) {
      chatLogger.debug('Replacing existing messages container');
      oldMessagesContainer.parentNode.replaceChild(newMessagesElement, oldMessagesContainer);
    } else if (this.container) {
      // Just append to our container
      chatLogger.debug('No existing messages container found, appending new one to main container');
      this.container.innerHTML = '';
      this.container.appendChild(newMessagesElement);
    }
    
    // Verify the messages were rendered correctly
    setTimeout(() => {
      const messageElements = document.querySelectorAll('.message');
      chatLogger.debug(`After re-render: ${messageElements.length} message elements in DOM vs ${this.messages.length} in memory`);
      
      // Check if we still have a mismatch and try one more aggressive approach
      if (messageElements.length !== this.messages.length && this.messages.length > 0) {
        chatLogger.warn('Still have message count mismatch after re-render, trying direct DOM manipulation');
        
        // Try direct DOM manipulation as last resort
        try {
          const messagesContainer = document.getElementById('chat-messages-container') || 
                                   newMessagesElement;
          
          if (messagesContainer) {
            // Clear and rebuild
            messagesContainer.innerHTML = '';
            
            // Manually add each message
            this.messages.forEach(message => {
              try {
                const messageEl = this.chatMessages.createMessageElement(message);
                messagesContainer.appendChild(messageEl);
              } catch (err) {
                chatLogger.error('Error creating individual message element:', err);
              }
            });
            
            // Scroll to bottom
            this.scrollToBottom(true);
          }
        } catch (err) {
          chatLogger.error('Error in fallback rendering approach:', err);
        }
      }
    }, 50); // Small delay to ensure DOM updates have completed
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
    
    // Check for pending initialization
    if (this._needsInit) {
      chatLogger.debug('Initialization is pending, attempting to initialize components');
      this._initializeComponents();
      if (this._needsInit) {
        // Still not initialized, can't update UI yet
        chatLogger.warn('Cannot update UI, initialization still pending');
        return;
      }
    }
    
    // Make sure we have a valid container reference
    if (!this.container || !this.container.isConnected) {
      chatLogger.warn('Main container is not connected to DOM!');
      
      // Try to find our container in the DOM
      const domContainer = document.getElementById('main-chat-container');
      if (domContainer) {
        chatLogger.debug('Found container in DOM, updating reference');
        this.container = domContainer;
      } else {
        chatLogger.error('Container not found in DOM, cannot update UI');
        // Mark for initialization when container becomes available
        this._needsInit = true;
        return;
      }
    }
    
    // Ensure the ChatMessages component exists
    if (!this.chatMessages) {
      chatLogger.debug('Creating new ChatMessages component');
      this.chatMessages = new ChatMessages(this.messages, this.isLoading);
    }
    
    try {
      // Try to update existing component first - this is most efficient
      if (this.chatMessages) {
        chatLogger.debug('Updating existing ChatMessages component');
        this.chatMessages.update(this.messages, this.isLoading);
      }
      
      // Get the existing messages container
      let messagesContainer = document.getElementById('chat-messages-container');
      
      // Determine if we need to create and attach a new container
      const needsNewContainer = !messagesContainer || !messagesContainer.isConnected;
      
      if (needsNewContainer) {
        chatLogger.debug('No valid messages container found, creating new one');
        // Create a fresh container and render messages into it
        messagesContainer = this.chatMessages.render(null);
        
        // Find a valid parent to attach to
        if (this.container && this.container.isConnected) {
          // Clear any existing non-input content
          const inputElement = this.container.querySelector('.chat-input-container');
          this.container.innerHTML = '';
          
          // Add the messages container
          this.container.appendChild(messagesContainer);
          
          // Re-add the input element if it exists
          if (inputElement) {
            this.container.appendChild(inputElement);
          } else if (this.chatInput) {
            // Create a new input element
            const newInputElement = this.chatInput.render();
            this.container.appendChild(newInputElement);
          }
        } else {
          chatLogger.error('Cannot attach new messages container, no valid parent');
        }
      }
      
      // Update input field state
      this.updateInputFieldState();
      
      // Verify the update
      setTimeout(() => {
        const messageElements = document.querySelectorAll('.message');
        if (messageElements.length !== this.messages.length) {
          chatLogger.warn(`Message count mismatch: ${messageElements.length} in DOM vs ${this.messages.length} in memory`);
          // Force a full re-render
          this.forceFullRerender();
        } else {
          chatLogger.debug(`UI update successful: ${messageElements.length} messages in DOM`);
        }
      }, 50); // Small delay to ensure DOM updates have completed
    } catch (error) {
      chatLogger.error('Error updating UI:', error);
      // Try a full re-render as a last resort
      try {
        this.forceFullRerender();
      } catch (rerenderError) {
        chatLogger.error('Failed to re-render after error:', rerenderError);
      }
    }
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
    
    // Set container reference early in the process
    this.container = container;
    
    // Check if we have pending initialization
    if (this._needsInit) {
      chatLogger.debug('Initialization was pending, triggering component initialization');
      this._initializeComponents();
    } else {
      // Initialize child components if not already done
      if (!this.chatMessages) {
        chatLogger.debug('Creating new ChatMessages component');
        this.chatMessages = new ChatMessages(this.messages, this.isLoading);
      }
      
      // CRITICAL FIX: Always create a fresh messages element to avoid detached DOM issues
      chatLogger.debug('Rendering fresh ChatMessages component');
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
    }
    
    // Set proper initial state for chat input
    this.updateInputFieldState();
    
    // Check message count after rendering to verify DOM matches memory
    setTimeout(() => {
      const messageElements = container.querySelectorAll('.message');
      chatLogger.debug(`After render: ${messageElements.length} message elements in DOM vs ${this.messages.length} in memory`);
      
      if (messageElements.length !== this.messages.length && this.messages.length > 0) {
        chatLogger.warn('Message count mismatch after render, scheduling re-render');
        // Schedule a rerender
        setTimeout(() => this.forceFullRerender(), 100);
      }
    }, 50);
    
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
    
    // Reset chatHeader reference (but don't clean it up, as we don't own it)
    this.chatHeader = null;
    
    // Reset container reference
    this.container = null;
  }

  /**
   * Execute a tool call directly from a tool action
   * @param {Object} toolCall - Tool call object with name, args, etc.
   */
  async executeToolCall(toolCall) {
    if (!toolCall || !toolCall.name) {
      chatLogger.error('Invalid tool call:', toolCall);
      return;
    }
    
    chatLogger.info(`Executing tool call from action: ${toolCall.name}`);
    
    // Ensure we have an ID for the tool call
    const toolCallId = toolCall.id || `tool-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Normalize arguments
    const args = toolCall.args || toolCall.parameters || {};
    
    // Add tool call to messages
    this.messages.push({
      role: 'tool',
      toolCallId: toolCallId,
      name: toolCall.name,
      content: `Executing tool: ${toolCall.name}`,
      status: 'running',
      args: args,
      timestamp: new Date().toISOString()
    });
    
    // Update UI to show tool execution in progress
    this.updateUI();
    
    try {
      // Execute tool through LLM service
      const toolResult = await this.llmService.executeToolCall(
        toolCallId,
        toolCall.name,
        args
      );
      
      // Update tool message with result
      const toolIndex = this.messages.findIndex(msg => 
        msg.role === 'tool' && msg.toolCallId === toolCallId
      );
      
      if (toolIndex !== -1) {
        this.messages[toolIndex].content = typeof toolResult === 'string' 
          ? toolResult 
          : JSON.stringify(toolResult, null, 2);
        this.messages[toolIndex].status = 'completed';
      }
      
      // Update UI to show tool result
      this.updateUI();
      
      // Return the result
      return toolResult;
    } catch (toolError) {
      chatLogger.error(`Error executing tool ${toolCall.name}:`, toolError);
      
      // Update tool message with error
      const toolIndex = this.messages.findIndex(msg => 
        msg.role === 'tool' && msg.toolCallId === toolCallId
      );
      
      if (toolIndex !== -1) {
        this.messages[toolIndex].content = `Error: ${toolError.message}`;
        this.messages[toolIndex].status = 'error';
      }
      
      // Update UI to show tool error
      this.updateUI();
      
      // Re-throw the error for handling by the caller
      throw toolError;
    }
  }
}

export default ChatUI; 