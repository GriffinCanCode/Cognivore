/**
 * ChatMessages Component - Displays chat message history with an enhanced visual design
 */
import ThinkingVisualization from '../renderers/ThinkingVisualization.js';
import messageFormatter from '../../utils/messageFormatter.js';
import logger from '../../utils/logger.js';
import ToolRenderer from '../tools/ToolRenderer.js';

// Create context-specific logger
const messagesLogger = logger.scope('ChatMessages');

// Create an instance of the ToolRenderer
const toolRenderer = new ToolRenderer();
// Initialize the tool renderer
toolRenderer.initialize();

class ChatMessages {
  /**
   * Constructor for ChatMessages component
   * @param {Array} messages - Array of message objects
   * @param {boolean} isLoading - Whether the component is in loading state
   */
  constructor(messages = [], isLoading = false) {
    this.container = null;
    this.messages = this.sanitizeMessages(messages);
    this.isLoading = isLoading;
    this.observer = null;
    this.thinkingVisualization = null;
    this.setupIntersectionObserver();
    
    // Track if a rebuild is needed
    this.needsRebuild = false;
  }

  /**
   * Sanitize messages to ensure all are valid and have required fields
   * @param {Array} messages - Raw messages array
   * @returns {Array} - Sanitized messages array
   */
  sanitizeMessages(messages) {
    if (!Array.isArray(messages)) {
      messagesLogger.error('Messages is not an array:', messages);
      return [];
    }

    return messages.filter((message, index) => {
      // Check if message is null or undefined
      if (!message) {
        messagesLogger.error(`Message at index ${index} is null or undefined`);
        return false;
      }

      // Ensure message has valid role
      if (!message.role) {
        messagesLogger.warn(`Message at index ${index} has no role, defaulting to 'system'`);
        message.role = 'system';
      }

      // Ensure message has content, setting default if missing
      if (message.content === undefined || message.content === null) {
        messagesLogger.warn(`Message at index ${index} has no content, setting empty string`);
        message.content = '';
      }

      // Convert content to string if it's not already
      if (typeof message.content !== 'string') {
        messagesLogger.warn(`Message at index ${index} has non-string content, converting to string`);
        message.content = String(message.content || '');
      }

      // Ensure message has timestamp
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }

      return true;
    });
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
    
    // Sanitize incoming messages
    this.messages = this.sanitizeMessages(messages);
    this.isLoading = isLoading;
    
    // Don't completely re-render, just update/append
    if (this.container && this.container.isConnected) {
      messagesLogger.debug('Container is connected, updating UI');
      
      try {
        // Check if we need to refresh the entire container
        if (this.messages.length === 0) {
          messagesLogger.debug('No messages, showing welcome message');
          this.container.innerHTML = '';
          this.container.appendChild(this.renderWelcomeMessage());
          return;
        }
        
        // Get current message elements
        const currentMessageElements = this.container.querySelectorAll('.message');
        const currentCount = currentMessageElements.length;
        
        messagesLogger.debug(`Current message count in DOM: ${currentCount}, messages in memory: ${this.messages.length}`);
        
        // Check for message count mismatch
        if (currentCount > this.messages.length) {
          messagesLogger.warn('DOM has more messages than memory, rebuilding container');
          this.rebuildMessageContainer();
          return;
        }
        
        // Clear thinking visualization if exists
        const thinkingElement = this.container.querySelector('.thinking-visualization-container');
        if (thinkingElement) {
          thinkingElement.remove();
        }
        
        // Add only new messages
        if (currentCount < this.messages.length) {
          messagesLogger.debug(`Adding ${this.messages.length - currentCount} new messages`);
          for (let i = currentCount; i < this.messages.length; i++) {
            try {
              const messageElement = this.createMessageElement(this.messages[i]);
              if (messageElement) {
                this.container.appendChild(messageElement);
                messagesLogger.debug(`Added message at index ${i}`);
              } else {
                messagesLogger.error(`Failed to create message element for index ${i}`);
              }
            } catch (err) {
              messagesLogger.error(`Error creating message element for index ${i}:`, err);
            }
          }
        }
        
        // Add thinking visualization if needed
        if (this.isLoading) {
          this.container.appendChild(this.renderThinkingVisualization());
        }
        
        // Verify the update was successful
        setTimeout(() => {
          const updatedMessageElements = this.container.querySelectorAll('.message');
          if (updatedMessageElements.length !== this.messages.length) {
            messagesLogger.warn(`Message count mismatch after update: ${updatedMessageElements.length} in DOM vs ${this.messages.length} in memory`);
            this.rebuildMessageContainer();
          }
        }, 0);
      } catch (error) {
        messagesLogger.error('Error in update:', error);
        // Fall back to a full rebuild on error
        this.rebuildMessageContainer();
      }
      
      // Scroll to bottom
      this.scrollToBottom(true);
    } else {
      messagesLogger.warn('ChatMessages.update called but container is null or not attached to DOM');
      this.needsRebuild = true;
      
      // Try to find and replace the existing messages container
      const existingContainer = document.getElementById('chat-messages-container');
      if (existingContainer && existingContainer.parentNode) {
        messagesLogger.debug('Found existing chat-messages-container, replacing it');
        const newContainer = this.render();
        existingContainer.parentNode.replaceChild(newContainer, existingContainer);
        // Scroll to bottom after replacing
        this.scrollToBottom(true);
      } else {
        messagesLogger.error('No existing chat-messages-container found in DOM, manual attachment required');
        // Set flag for later rebuild
        this.needsRebuild = true;
      }
    }
  }
  
  /**
   * Rebuild the entire message container from scratch
   */
  rebuildMessageContainer() {
    messagesLogger.info('Rebuilding message container');
    
    if (!this.container || !this.container.isConnected) {
      messagesLogger.warn('Container not connected during rebuild attempt');
      return;
    }
    
    try {
      // Create a new container
      const newContainer = document.createElement('div');
      newContainer.className = 'chat-messages';
      newContainer.id = 'chat-messages-container';
      
      // Populate with messages
      if (this.messages.length === 0) {
        newContainer.appendChild(this.renderWelcomeMessage());
      } else {
        this.messages.forEach((message, index) => {
          try {
            const messageElement = this.createMessageElement(message);
            if (messageElement) {
              newContainer.appendChild(messageElement);
            }
          } catch (error) {
            messagesLogger.error(`Error rendering message at index ${index}:`, error);
          }
        });
      }
      
      // Add thinking visualization if needed
      if (this.isLoading) {
        newContainer.appendChild(this.renderThinkingVisualization());
      }
      
      // Replace the existing container
      if (this.container.parentNode) {
        this.container.parentNode.replaceChild(newContainer, this.container);
        this.container = newContainer;
        
        // Scroll to bottom
        setTimeout(() => this.scrollToBottom(true), 0);
      } else {
        messagesLogger.error('Container has no parent, cannot replace');
      }
    } catch (error) {
      messagesLogger.error('Error in rebuildMessageContainer:', error);
    }
  }

  /**
   * Scrolls the chat container to the bottom
   * @param {boolean} smooth - Whether to use smooth scrolling
   */
  scrollToBottom(smooth = false) {
    if (this.container) {
      // Ensure scroll happens even when container is newly created
      setTimeout(() => {
        try {
          this.container.scrollTo({
            top: this.container.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
          });
          messagesLogger.debug('Scrolled container to bottom');
        } catch (error) {
          messagesLogger.error('Error scrolling to bottom:', error);
        }
      }, 10);
    }
  }

  /**
   * Create a message element from a message object
   * @param {Object} message - The message object
   * @returns {HTMLElement} - The message element
   */
  createMessageElement(message) {
    // Ensure message has required fields
    if (!message) {
      messagesLogger.error('Cannot create element for null message');
      return document.createElement('div'); // Return empty div as fallback
    }
    
    // Debug the message object in case of issues
    messagesLogger.debug(`Creating message element for role: ${message.role}`, 
      { contentLength: message.content ? message.content.length : 0, message: JSON.stringify(message) });
    
    // Ensure message has valid role and content
    const role = message.role || 'system';
    let content = '';
    
    // Safely handle content even if it's null/undefined
    if (message.content === undefined || message.content === null) {
      messagesLogger.warn(`Message with role ${role} has null/undefined content, using empty string`);
      content = '';
    } else {
      content = message.content;
      
      // Additional validation for content
      if (typeof content !== 'string') {
        messagesLogger.warn(`Message has non-string content of type ${typeof content}, converting to string`);
        content = String(content || '');
      }
    }
    
    const isUser = role === 'user';
    const isError = message.isError || role === 'error';
    const isTool = role === 'tool';
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isUser ? 'user-message' : 'assistant-message'} ${isError ? 'error-message' : ''} ${isTool ? 'tool-message' : ''}`;
    messageElement.setAttribute('data-message-role', role);
    
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
      } else if (isTool) {
        // Tool response icon
        avatarElement.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
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
    
    // Special handling for tool responses
    if (isTool) {
      const toolHeader = document.createElement('div');
      toolHeader.className = 'tool-header';
      toolHeader.innerHTML = `<span class="tool-label">Tool Response: ${message.name || message.toolName || 'Unknown Tool'}</span>`;
      messageContent.appendChild(toolHeader);
      
      // Try to prettify the JSON content for tool responses
      let formattedToolContent;
      try {
        // Check if content is a JSON string
        if (typeof content === 'string' && (content.startsWith('{') || content.startsWith('['))) {
          const jsonData = JSON.parse(content);
          formattedToolContent = `<pre class="tool-result">${messageFormatter.formatToolResult(jsonData)}</pre>`;
        } else {
          // For non-JSON content use a simple format
          formattedToolContent = `<pre class="tool-result">${messageFormatter.escapeHtml(content)}</pre>`;
        }
      } catch (error) {
        // If JSON parsing fails, just display the raw content
        messagesLogger.warn('Failed to parse tool response as JSON, falling back to plain text:', error);
        formattedToolContent = `<pre class="tool-result">${messageFormatter.escapeHtml(content)}</pre>`;
      }
      
      messageContent.innerHTML += formattedToolContent;
    } else {
      // Format message content with markdown-like syntax
      try {
        const formattedContent = messageFormatter.formatMessageContent(content);
        messageContent.innerHTML = formattedContent;
      } catch (error) {
        messagesLogger.error('Error formatting message content:', error);
        messageContent.textContent = content || "Error displaying message content";
      }
    }
    
    messageElement.appendChild(messageContent);
    
    // Add timestamp to messages with proper formatting
    const timestampElement = document.createElement('div');
    timestampElement.className = 'message-timestamp';
    
    // Format the timestamp to show date if not today, otherwise just time
    const messageTime = message.timestamp ? new Date(message.timestamp) : new Date();
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
    
          // Improved tool calls handling
      if (message.toolCalls && Array.isArray(message.toolCalls) && message.toolCalls.length > 0) {
        messagesLogger.debug(`Message has ${message.toolCalls.length} tool calls:`, message.toolCalls);
        const toolCallsContainer = document.createElement('div');
        toolCallsContainer.className = 'tool-calls';
        
        // Track successful renders
        let successfulRenders = 0;
        
        message.toolCalls.forEach((toolCall, index) => {
          try {
            // Handle different formats of tool calls
            const processedToolCall = messageFormatter.normalizeToolCall(toolCall);
            if (processedToolCall) {
              messagesLogger.debug(`Rendering tool call ${index + 1}/${message.toolCalls.length}:`, 
                { name: processedToolCall.name || processedToolCall.toolName });
              
              const toolCallElement = this.createToolCallElement(processedToolCall);
              if (toolCallElement) {
                toolCallsContainer.appendChild(toolCallElement);
                successfulRenders++;
              } else {
                messagesLogger.error(`Failed to create element for tool call ${index}`);
              }
            } else {
              messagesLogger.warn(`Failed to normalize tool call at index ${index}`);
            }
          } catch (error) {
            messagesLogger.error('Error rendering tool call:', error, toolCall);
          }
        });
        
        // Only add if we have valid tool calls
        if (toolCallsContainer.children.length > 0) {
          messagesLogger.debug(`Adding ${successfulRenders} tool calls to message`);
          messageElement.appendChild(toolCallsContainer);
        } else {
          messagesLogger.warn('No tool calls were successfully rendered');
        }
      } else if (role === 'assistant' && content) {
      // Check if the message contains text that looks like a tool call but isn't properly structured
      const toolCallRegex = /(search[kK]nowledge[bB]ase|getItem[cC]ontent|summarize[cC]ontent|list[aA]ll[fF]iles|list[fF]iles[bB]y[tT]ype)\s*\(/;
      const functionCallRegex = /```tool_code\s*\n\s*{\s*"tool_name"\s*:\s*"([^"]+)"/;
      const matches = content.match(toolCallRegex) || content.match(functionCallRegex);
      
      if (matches) {
        // Found text that looks like a tool call - extract and display it properly
        messagesLogger.debug('Message appears to contain a tool reference but no toolCalls property:', 
          content.substring(0, 100));
        
        try {
          // Create a container for the extracted tool call
          const toolCallsContainer = document.createElement('div');
          toolCallsContainer.className = 'tool-calls';
          
          // Create a replacement tool call element
          const toolCallElement = document.createElement('div');
          toolCallElement.className = 'tool-call';
          
          // Add header with warning
          const toolCallHeader = document.createElement('div');
          toolCallHeader.className = 'tool-call-header';
          toolCallHeader.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
            <span>Tool: ${matches[1]}</span>
          `;
          
          toolCallElement.appendChild(toolCallHeader);
          
          // Add note about improper tool call
          const noteElement = document.createElement('div');
          noteElement.className = 'tool-call-args';
          noteElement.innerHTML = `<div style="color: #ff9800; font-style: italic;">Tool call detected in text. Please refresh or try again to get proper tool execution.</div>`;
          toolCallElement.appendChild(noteElement);
          
          // Add to container and message
          toolCallsContainer.appendChild(toolCallElement);
          messageElement.appendChild(toolCallsContainer);
        } catch (error) {
          messagesLogger.error('Error handling text-based tool call:', error);
        }
      }
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
    if (!toolCall) {
      messagesLogger.error('Cannot create tool call element for null toolCall');
      return document.createElement('div'); // Return empty div as fallback
    }
    
    try {
      // Log the tool call for debugging
      messagesLogger.debug('Rendering tool call with ToolRenderer:', { 
        name: toolCall.name || toolCall.toolName, 
        hasArgs: !!toolCall.args 
      });
      
      // Make sure the tool renderer is initialized
      if (!toolRenderer.renderers) {
        messagesLogger.warn('ToolRenderer not fully initialized, initializing now');
        toolRenderer.initialize();
      }
      
      // Use the ToolRenderer to render the tool call
      return toolRenderer.render(toolCall);
    } catch (error) {
      messagesLogger.error('Error rendering tool call with ToolRenderer:', error);
      
      // Fallback to basic rendering if ToolRenderer fails
      const toolCallElement = document.createElement('div');
      toolCallElement.className = 'tool-call';
      
      const toolCallHeader = document.createElement('div');
      toolCallHeader.className = 'tool-call-header';
      toolCallHeader.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
        <span>Tool: ${toolCall.name || toolCall.toolName || 'Unknown Tool'}</span>
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
          argsContent.textContent = typeof toolCall.args === 'string' ? toolCall.args : JSON.stringify(toolCall.args);
        }
        
        toolCallElement.appendChild(argsContent);
      }
      
      return toolCallElement;
    }
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
      <h2>Cognivore</h2>
      <p>I am the ravenous devourer of knowledge, servant to the Goddess Mnemosyne. Present offerings of inquiry, and I might feast upon your Sieve to deliver divine wisdom.</p>
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
        try {
          const messageElement = this.createMessageElement(message);
          if (messageElement) {
            messageContainer.appendChild(messageElement);
          } else {
            throw new Error('Failed to create message element');
          }
        } catch (error) {
          messagesLogger.error(`Error rendering message at index ${index}:`, error);
          // Add a placeholder for the failed message to maintain count
          const errorElement = document.createElement('div');
          errorElement.className = 'message error-message';
          errorElement.innerHTML = `<div class="message-content">Error rendering message: ${error.message}</div>`;
          messageContainer.appendChild(errorElement);
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
    
    // Clear the rebuild flag
    this.needsRebuild = false;
    
    // Verify content
    setTimeout(() => {
      messagesLogger.debug(`Container has ${messageContainer.childNodes.length} child nodes, messages in memory: ${this.messages.length}`);
      
      // Verify that messages are correctly rendered
      const messageElements = messageContainer.querySelectorAll('.message');
      if (messageElements.length !== this.messages.length) {
        messagesLogger.warn(`Message count mismatch after render: ${messageElements.length} in DOM vs ${this.messages.length} in memory`);
      }
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
   * Clean up component resources
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