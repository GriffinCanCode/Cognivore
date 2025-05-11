/**
 * ChatInput Component - Input field for chat messages
 */
class ChatInput {
  /**
   * Constructor for ChatInput component
   * @param {Function} onSubmit - Callback function for message submission
   */
  constructor(onSubmit) {
    this.container = null;
    this.inputField = null;
    this.submitButton = null;
    this.onSubmit = onSubmit;
    this.isDisabled = false;
    this.placeholderText = 'Ask a question...';
    
    // Flag to track if this instance was created by ChatUI (not by App)
    this.isOwnInstance = true;
    
    // Bind methods
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  /**
   * Set the input field's disabled state
   * @param {boolean} isDisabled - Whether the input should be disabled
   * @param {string} placeholder - Optional placeholder text for disabled state
   */
  setDisabled(isDisabled, placeholder = null) {
    this.isDisabled = isDisabled;
    
    if (placeholder) {
      this.placeholderText = placeholder;
    } else {
      this.placeholderText = isDisabled ? 
        'Waiting for response...' : 
        'Type your message here...';
    }
    
    // Update UI if container exists
    if (this.container) {
      const inputField = this.container.querySelector('.chat-input');
      const sendButton = this.container.querySelector('.send-button');
      
      if (inputField) {
        inputField.disabled = this.isDisabled;
        inputField.placeholder = this.placeholderText;
      }
      
      if (sendButton) {
        sendButton.disabled = this.isDisabled;
      }
    }
  }

  /**
   * Focus the input field
   */
  focus() {
    if (this.container) {
      const inputField = this.container.querySelector('.chat-input');
      if (inputField) {
        setTimeout(() => inputField.focus(), 100);
      }
    }
  }

  /**
   * Actually submit the message to the onSubmit callback
   * Separate from handleSubmit to allow direct calling
   */
  submitMessage() {
    if (!this.container) return;
    
    const inputField = this.container.querySelector('.chat-input');
    if (!inputField || !inputField.value.trim() || this.isDisabled) return;
    
    const message = inputField.value.trim();
    console.log('ChatInput submitting message:', message);
    
    // Clear input field before calling onSubmit to prevent double submissions
    inputField.value = '';
    
    // Call the onSubmit callback with the message
    if (typeof this.onSubmit === 'function') {
      console.log('Calling onSubmit callback with message');
      this.onSubmit(message);
    } else {
      console.error('onSubmit is not a function', typeof this.onSubmit);
    }
    
    // Focus the input field again
    this.focus();
  }

  /**
   * Handle form submission
   * @param {Event} e - The form submission event
   */
  handleSubmit(e) {
    if (e) e.preventDefault();
    this.submitMessage();
  }

  /**
   * Render the component
   * @returns {HTMLElement} - The rendered component
   */
  render() {
    console.log('ChatInput.render called');
    
    // Create input container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'chat-input-container';
    
    const inputForm = document.createElement('form');
    inputForm.className = 'chat-input-form';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'chat-input';
    input.placeholder = this.placeholderText;
    input.disabled = this.isDisabled;
    input.autocomplete = 'off';
    
    const sendButton = document.createElement('button');
    sendButton.type = 'submit';
    sendButton.className = 'send-button';
    sendButton.disabled = this.isDisabled;
    sendButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="send-icon">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    `;
    
    // Use the bound handleSubmit to ensure proper 'this' context
    inputForm.addEventListener('submit', this.handleSubmit);
    
    // Add keydown handler for better control
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent default form submission
        
        // Prevent handling if disabled
        if (this.isDisabled) return;
        
        // Only submit if we have a non-empty message
        if (input.value.trim()) {
          // Temporarily disable to prevent double submissions
          this.setDisabled(true);
          
          // Call handleSubmit directly with proper context
          this.handleSubmit();
          
          // Re-enable after a short delay if not programmatically kept disabled
          setTimeout(() => {
            if (!this.isDisabled) {
              this.setDisabled(false);
            }
          }, 50);
        }
      }
    });
    
    // Direct click handler on the button for better mobile support
    sendButton.addEventListener('click', (e) => {
      if (!this.isDisabled && input.value.trim()) {
        e.preventDefault();
        this.handleSubmit();
      }
    });
    
    inputForm.appendChild(input);
    inputForm.appendChild(sendButton);
    inputContainer.appendChild(inputForm);
    
    this.container = inputContainer;
    return inputContainer;
  }

  /**
   * Clean up component resources
   */
  cleanup() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

export default ChatInput; 