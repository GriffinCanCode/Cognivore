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
    
    // Bind all methods to prevent context loss
    this.handleSubmit = this.handleSubmit.bind(this);
    this.submitMessage = this.submitMessage.bind(this);
    this.setDisabled = this.setDisabled.bind(this);
    this.focus = this.focus.bind(this);
    this.render = this.render.bind(this);
    this.cleanup = this.cleanup.bind(this);
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
    if (!this.container) {
      console.error('Cannot submit message: container is null');
      return;
    }
    
    // Get a fresh reference to the input element
    const inputField = this.container.querySelector('.chat-input');
    if (!inputField) {
      console.error('Cannot submit message: input field not found');
      return;
    }
    
    const message = inputField.value.trim();
    if (!message) {
      console.log('Empty message, not submitting');
      return;
    }
    
    if (this.isDisabled) {
      console.log('Input is disabled, not submitting');
      return;
    }
    
    console.log('ChatInput submitting message:', message);
    
    // Disable the input immediately to prevent double submissions
    this.setDisabled(true, 'Sending message...');
    
    // Clear input field before calling onSubmit to prevent double submissions
    inputField.value = '';
    
    // Safely call the onSubmit callback
    try {
      if (typeof this.onSubmit === 'function') {
        console.log('Calling onSubmit callback with message:', message);
        // Add a try-catch around the actual callback invocation
        try {
          this.onSubmit(message);
          console.log('onSubmit completed successfully');
        } catch (callbackError) {
          console.error('Error occurred while executing onSubmit callback:', callbackError);
          this.setDisabled(false);
        }
      } else {
        console.error('onSubmit is not a function:', typeof this.onSubmit);
        this.setDisabled(false);
      }
    } catch (error) {
      console.error('Error in submitMessage method:', error);
      // Re-enable input if an error occurs
      this.setDisabled(false);
    }
  }

  /**
   * Handle form submission
   * @param {Event} e - The form submission event
   */
  handleSubmit(e) {
    if (e) {
      e.preventDefault();
      console.log('Form submission event received');
    }
    
    // Use try-catch to prevent freezing on error
    try {
      this.submitMessage();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      // Re-enable input if an error occurs
      this.setDisabled(false);
    }
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
    
    // Log the onSubmit callback to verify it's valid
    console.log('onSubmit callback type:', typeof this.onSubmit);
    
    // Use the bound handleSubmit to ensure proper 'this' context
    const boundHandleSubmit = this.handleSubmit.bind(this);
    inputForm.addEventListener('submit', (e) => {
      console.log('Form submit event triggered');
      boundHandleSubmit(e);
    });
    
    // Add keydown handler for better control
    const keydownHandler = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log('Enter key pressed in input field');
        e.preventDefault(); // Prevent default form submission
        
        // Prevent handling if disabled
        if (this.isDisabled) {
          console.log('Input is disabled, not handling Enter key');
          return;
        }
        
        // Only submit if we have a non-empty message
        if (input.value.trim()) {
          console.log('Have input value, calling handleSubmit from Enter key handler');
          boundHandleSubmit();
        } else {
          console.log('Empty input, not submitting');
        }
      }
    };
    
    input.addEventListener('keydown', keydownHandler);
    
    // Direct click handler on the button for better mobile support
    sendButton.addEventListener('click', (e) => {
      console.log('Send button clicked');
      e.preventDefault();
      
      if (this.isDisabled) {
        console.log('Input is disabled, not handling button click');
        return;
      }
      
      if (!input.value.trim()) {
        console.log('Empty input, not submitting from button click');
        return;
      }
      
      console.log('Have input value, calling handleSubmit from button click handler');
      boundHandleSubmit();
    });
    
    inputForm.appendChild(input);
    inputForm.appendChild(sendButton);
    inputContainer.appendChild(inputForm);
    
    this.container = inputContainer;
    this.inputField = input;
    this.submitButton = sendButton;
    
    return inputContainer;
  }

  /**
   * Clean up component resources
   */
  cleanup() {
    if (this.container && this.container.parentNode) {
      // Remove all event listeners by cloning and replacing
      const oldContainer = this.container;
      const newContainer = oldContainer.cloneNode(true);
      if (oldContainer.parentNode) {
        oldContainer.parentNode.replaceChild(newContainer, oldContainer);
      }
      this.container = null;
    }
    this.inputField = null;
    this.submitButton = null;
  }
}

export default ChatInput; 