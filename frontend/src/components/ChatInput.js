/**
 * ChatInput Component - Input field for chat messages
 */
class ChatInput {
  /**
   * Constructor for ChatInput component
   * @param {Function} onSubmit - Callback for message submission
   */
  constructor(onSubmit) {
    this.container = null;
    this.onSubmit = onSubmit || (() => {});
    this.isDisabled = false;
    this.placeholder = 'Type your message here...';
  }

  /**
   * Set the input field's disabled state
   * @param {boolean} isDisabled - Whether the input should be disabled
   * @param {string} placeholder - Optional placeholder text for disabled state
   */
  setDisabled(isDisabled, placeholder = null) {
    this.isDisabled = isDisabled;
    
    if (placeholder) {
      this.placeholder = placeholder;
    } else {
      this.placeholder = isDisabled ? 
        'Waiting for response...' : 
        'Type your message here...';
    }
    
    // Update UI if container exists
    if (this.container) {
      const inputField = this.container.querySelector('.chat-input');
      const sendButton = this.container.querySelector('.send-button');
      
      if (inputField) {
        inputField.disabled = this.isDisabled;
        inputField.placeholder = this.placeholder;
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
   * Handle form submission
   * @param {Event} e - The form submission event
   */
  handleSubmit(e) {
    e.preventDefault();
    
    const inputField = this.container.querySelector('.chat-input');
    if (!inputField || !inputField.value.trim() || this.isDisabled) return;
    
    const message = inputField.value;
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
    input.placeholder = this.placeholder;
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
    
    // Enhanced submit handler with better debouncing
    const submitHandler = (e) => {
      e.preventDefault();
      if (this.isDisabled) return;
      
      // Temporarily disable to prevent double submissions
      this.setDisabled(true);
      
      // Call handleSubmit
      this.handleSubmit(e);
      
      // Re-enable after a short delay if not programmatically kept disabled
      setTimeout(() => {
        if (!this.isDisabled) {
          this.setDisabled(false);
        }
      }, 50);
    };
    
    inputForm.addEventListener('submit', submitHandler);
    
    // Add keydown handler for better control
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        submitHandler(e);
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