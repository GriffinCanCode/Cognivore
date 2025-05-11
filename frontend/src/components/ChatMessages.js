/**
 * ChatMessages Component - Displays chat message history with an enhanced visual design
 */
import ThinkingVisualization from './ThinkingVisualization.js';
import logger from '../utils/logger.js';

// Create context-specific logger
const messagesLogger = logger.scope('ChatMessages');

class ChatMessages {
  /**
   * Constructor for ChatMessages component
   * @param {Array} messages - Array of message objects
   * @param {boolean} isLoading - Whether the component is in loading state
   */
  constructor(messages = [], isLoading = false) {
    this.container = null;
    this.messages = messages;
    this.isLoading = isLoading;
    this.observer = null;
    this.thinkingVisualization = null;
    this.setupIntersectionObserver();
  }

  /**
   * Set up intersection observer for animation effects
   */
  setupIntersectionObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          this.observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    });
  }

  /**
   * Update component with new data
   * @param {Array} messages - New messages array
   * @param {boolean} isLoading - New loading state
   */
  update(messages = [], isLoading = false) {
    messagesLogger.debug('ChatMessages.update called with', messages.length, 'messages');
    this.messages = messages;
    this.isLoading = isLoading;
    
    // Don't completely re-render, just update/append
    if (this.container && this.container.isConnected) {
      // Check if we need to refresh the entire container
      if (this.messages.length === 0) {
        this.container.innerHTML = '';
        this.container.appendChild(this.renderWelcomeMessage());
      } else {
        // Get current message elements
        const currentMessageElements = this.container.querySelectorAll('.message');
        const currentCount = currentMessageElements.length;
        
        // Clear thinking visualization if exists
        const thinkingElement = this.container.querySelector('.thinking-visualization-container');
        if (thinkingElement) {
          thinkingElement.remove();
        }
        
        // Add only new messages
        if (currentCount < this.messages.length) {
          messagesLogger.debug(`Adding ${this.messages.length - currentCount} new messages`);
          for (let i = currentCount; i < this.messages.length; i++) {
            const messageElement = this.createMessageElement(this.messages[i]);
            this.container.appendChild(messageElement);
          }
        }
        
        // Add thinking visualization if needed
        if (this.isLoading) {
          this.container.appendChild(this.renderThinkingVisualization());
        }
      }
      
      // Scroll to bottom
      this.scrollToBottom(true);
    } else {
      messagesLogger.warn('ChatMessages.update called but container is null or not attached to DOM');
      // Create a new container and return it - caller must attach it to DOM
      const container = this.render();
      
      // Try to find and replace the existing messages container
      const existingContainer = document.getElementById('chat-messages-container');
      if (existingContainer && existingContainer.parentNode) {
        messagesLogger.debug('Found existing chat-messages-container, replacing it');
        existingContainer.parentNode.replaceChild(container, existingContainer);
        // Scroll to bottom after replacing
        this.scrollToBottom(true);
      } else {
        messagesLogger.error('No existing chat-messages-container found in DOM, manual attachment required');
        // Return the container for manual attachment
        return container;
      }
    }
  }

  /**
   * Scrolls the chat container to the bottom
   * @param {boolean} smooth - Whether to use smooth scrolling
   */
  scrollToBottom(smooth = false) {
    if (this.container) {
      this.container.scrollTo({
        top: this.container.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  /**
   * Format message content with markdown-like syntax
   * @param {string} content - The raw message content
   * @returns {string} - The formatted HTML content
   */
  formatMessageContent(content) {
    if (!content) return '';
    
    // Simple formatting for code blocks
    let formatted = content.replace(/```(\w*)\n([^`]+)```/g, (match, language, code) => {
      return `<pre class="code-block ${language ? `language-${language}` : ''}"><code>${this.escapeHtml(code)}</code></pre>`;
    });
    
    // Format inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert URLs to links
    formatted = formatted.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Convert line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  }

  /**
   * Escape HTML special characters to prevent XSS
   * @param {string} html - The string to escape
   * @returns {string} - The escaped string
   */
  escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Create a message element from a message object
   * @param {Object} message - The message object
   * @returns {HTMLElement} - The message element
   */
  createMessageElement(message) {
    const isUser = message.role === 'user';
    const isError = message.isError;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isUser ? 'user-message' : 'assistant-message'} ${isError ? 'error-message' : ''}`;
    messageElement.setAttribute('data-message-role', message.role);
    
    // Add fade-in animation
    messageElement.style.opacity = '0';
    messageElement.style.transform = 'translateY(10px)';
    
    // Add avatar for assistant (only for non-user messages)
    if (!isUser) {
      const avatarElement = document.createElement('div');
      avatarElement.className = 'message-avatar';
      
      // Enhanced SVG avatar for assistant
      if (isError) {
        // Warning icon for errors
        avatarElement.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        `;
      } else {
        // Better assistant avatar
        avatarElement.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a9 9 0 0 1 9 9c0 3.1-1.5 5.7-4 7.4L17 22H7l-.1-3.6a10.6 10.6 0 0 1-4-7.4 9 9 0 0 1 9-9Z"/>
            <path d="M9 14h.01"/>
            <path d="M15 14h.01"/>
            <path d="M9.5 8.5C10 7.7 11 7 12 7s2 .7 2.5 1.5"/>
          </svg>
        `;
      }
      messageElement.appendChild(avatarElement);
    } else {
      // Adding user avatar
      const userAvatarElement = document.createElement('div');
      userAvatarElement.className = 'message-avatar user-avatar';
      userAvatarElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      `;
      messageElement.appendChild(userAvatarElement);
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Format message content with markdown-like syntax
    const formattedContent = this.formatMessageContent(message.content);
    messageContent.innerHTML = formattedContent;
    
    messageElement.appendChild(messageContent);
    
    // Add timestamp to messages with proper formatting
    const timestampElement = document.createElement('div');
    timestampElement.className = 'message-timestamp';
    
    // Format the timestamp to show date if not today, otherwise just time
    const messageTime = new Date(message.timestamp);
    const now = new Date();
    let timeString;
    
    if (messageTime.toDateString() === now.toDateString()) {
      // Same day - just show time
      timeString = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      // Different day - show date and time
      timeString = messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
                  ' ' + messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    timestampElement.textContent = timeString;
    messageContent.appendChild(timestampElement);
    
    // Add tool calls if present with better styling
    if (message.toolCalls && message.toolCalls.length > 0) {
      const toolCallsContainer = document.createElement('div');
      toolCallsContainer.className = 'tool-calls';
      
      message.toolCalls.forEach(toolCall => {
        const toolCallElement = this.createToolCallElement(toolCall);
        toolCallsContainer.appendChild(toolCallElement);
      });
      
      messageElement.appendChild(toolCallsContainer);
    }
    
    // Use intersection observer for entrance animation
    setTimeout(() => {
      if (this.observer) {
        this.observer.observe(messageElement);
      }
      
      // Fallback animation in case IntersectionObserver isn't supported
      setTimeout(() => {
        messageElement.style.opacity = '1';
        messageElement.style.transform = 'translateY(0)';
      }, 10);
    }, 10);
    
    return messageElement;
  }

  /**
   * Create a tool call element with enhanced styling
   * @param {Object} toolCall - The tool call object
   * @returns {HTMLElement} - The tool call element
   */
  createToolCallElement(toolCall) {
    const toolCallElement = document.createElement('div');
    toolCallElement.className = 'tool-call';
    
    const toolCallHeader = document.createElement('div');
    toolCallHeader.className = 'tool-call-header';
    toolCallHeader.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
      </svg>
      <span>Tool: ${toolCall.name}</span>
    `;
    
    toolCallElement.appendChild(toolCallHeader);
    
    // Add formatted function parameters if available
    if (toolCall.args) {
      const argsContent = document.createElement('div');
      argsContent.className = 'tool-call-args';
      
      try {
        const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args;
        argsContent.innerHTML = `<pre>${JSON.stringify(args, null, 2)}</pre>`;
      } catch (e) {
        // If parsing fails, just display as string
        argsContent.textContent = toolCall.args;
      }
      
      toolCallElement.appendChild(argsContent);
    }
    
    return toolCallElement;
  }

  /**
   * Render the welcome message with sample questions
   * @returns {HTMLElement} - The welcome message element
   */
  renderWelcomeMessage() {
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'welcome-message';
    
    // Create header content with a modern design
    welcomeMessage.innerHTML = `
      <svg class="welcome-icon" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
      </svg>
      <h2>Welcome to Cognivore</h2>
      <p>Your intelligent assistant for accessing and managing knowledge. Ask any question to begin.</p>
    `;
    
    // Add event listeners to suggestion buttons
    setTimeout(() => {
      const suggestionButtons = welcomeMessage.querySelectorAll('.suggestion-item');
      suggestionButtons.forEach(button => {
        button.addEventListener('click', () => {
          // Get the chat input element
          const chatInput = document.querySelector('.chat-input');
          if (chatInput) {
            // Set the suggestion text as the input value
            chatInput.value = button.textContent.trim();
            
            // Trigger the submit button click
            const submitButton = document.querySelector('.send-button');
            if (submitButton) {
              submitButton.click();
            }
          }
        });
      });
    }, 100);
    
    return welcomeMessage;
  }
  
  /**
   * Render the thinking visualization with enhanced animation
   * @returns {HTMLElement} - The thinking visualization element
   */
  renderThinkingVisualization() {
    // Create a fresh ThinkingVisualization component
    this.thinkingVisualization = new ThinkingVisualization();
    return this.thinkingVisualization.render();
  }

  /**
   * Render the component
   * @param {HTMLElement} container - The container element to render into
   * @returns {HTMLElement} - The rendered component
   */
  render(container = null) {
    messagesLogger.debug('ChatMessages.render called with', this.messages.length, 'messages');
    
    let messageContainer;
    
    // CRITICAL FIX: Always create a fresh container when none is provided
    // This guarantees we have a valid DOM element to work with
    if (!container) {
      // Create a new container
      messageContainer = document.createElement('div');
      messageContainer.className = 'chat-messages';
      messageContainer.id = 'chat-messages-container';
      
      // Save the reference to enable future updates
      this.container = messageContainer;
    } else {
      // Use the provided container
      messageContainer = container;
      
      // Clear existing content
      messageContainer.innerHTML = '';
      
      // Save reference
      this.container = messageContainer;
    }

    // Add welcome message if no messages
    if (!this.messages || this.messages.length === 0) {
      messagesLogger.debug('Rendering welcome message');
      messageContainer.appendChild(this.renderWelcomeMessage());
    } else {
      messagesLogger.debug('Rendering', this.messages.length, 'messages');
      
      // Add messages with verification
      this.messages.forEach((message, index) => {
        if (!message || !message.content) {
          messagesLogger.error('Invalid message at index', index, message);
          return; // Skip invalid messages
        }
        
        messagesLogger.debug('Rendering message', index, message.role, message.content.substring(0, 30) + (message.content.length > 30 ? '...' : ''));
        try {
          const messageElement = this.createMessageElement(message);
          messageContainer.appendChild(messageElement);
        } catch (error) {
          messagesLogger.error('Error rendering message:', error);
        }
      });
    }

    // Add thinking visualization if needed
    if (this.isLoading) {
      messageContainer.appendChild(this.renderThinkingVisualization());
    }

    // Scroll to bottom
    setTimeout(() => this.scrollToBottom(), 0);

    // Set up scroll to bottom button if needed
    this.setupScrollToBottomButton();
    
    // Verify content
    setTimeout(() => {
      messagesLogger.debug(`Container has ${messageContainer.childNodes.length} child nodes`);
    }, 0);

    return messageContainer;
  }

  /**
   * Set up a scroll to bottom button when user scrolls up
   */
  setupScrollToBottomButton() {
    // Check if we already have one
    let scrollButton = document.querySelector('.scroll-to-bottom');
    
    if (!scrollButton) {
      scrollButton = document.createElement('button');
      scrollButton.className = 'scroll-to-bottom';
      scrollButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;
      scrollButton.addEventListener('click', () => this.scrollToBottom(true));
      document.body.appendChild(scrollButton);
    }
    
    // Handle scroll events to show/hide button
    if (this.container) {
      this.container.addEventListener('scroll', () => {
        const distanceFromBottom = this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight;
        
        if (distanceFromBottom > 300 && this.messages.length > 0) {
          scrollButton.classList.add('visible');
        } else {
          scrollButton.classList.remove('visible');
        }
      });
    }
  }

  /**
   * Clean up any resources used by the component
   */
  cleanup() {
    messagesLogger.debug('ChatMessages cleanup called');
    
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Clean up thinking visualization if exists
    if (this.thinkingVisualization) {
      this.thinkingVisualization.cleanup();
      this.thinkingVisualization = null;
    }
    
    // Remove scroll to bottom button if exists
    const scrollButton = document.querySelector('.scroll-to-bottom');
    if (scrollButton && scrollButton.parentNode) {
      scrollButton.parentNode.removeChild(scrollButton);
    }
    
    // Remove all event listeners
    if (this.container) {
      const clone = this.container.cloneNode(true);
      if (this.container.parentNode) {
        this.container.parentNode.replaceChild(clone, this.container);
      }
      this.container = clone;
    }
  }
}

export default ChatMessages; 