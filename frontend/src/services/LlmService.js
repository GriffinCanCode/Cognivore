// LlmService for Gemini 2.5 Flash integration
class LlmService {
  constructor() {
    this.defaultModel = 'gemini-2.5-flash'; // Fallback model
    this.defaultEmbeddingModel = 'embedding-001'; // Fallback embedding model
    this.config = null;
    this.configPromise = this.loadConfig();
  }

  /**
   * Load configuration from backend server
   * @returns {Promise<Object>} - The configuration
   */
  async loadConfig() {
    try {
      console.log('Attempting to load LLM configuration from backend...');
      
      // Check if backend is available first
      const isBackendAvailable = await this.checkBackendStatus();
      if (!isBackendAvailable) {
        console.warn('Backend server is not available for config loading, using default values');
        return {
          llmModel: this.defaultModel,
          embeddingModel: this.defaultEmbeddingModel,
          backendAvailable: false
        };
      }

      // Use the server proxy exposed by the preload script
      if (window.server) {
        this.config = await window.server.getConfig();
        // Add backendAvailable flag to config
        this.config.backendAvailable = true;
      } else {
        throw new Error('Server proxy not available');
      }
      
      console.log('Loaded LLM configuration:', this.config);
      return this.config;
    } catch (error) {
      console.error('Error loading config:', error);
      return {
        llmModel: this.defaultModel,
        embeddingModel: this.defaultEmbeddingModel,
        backendAvailable: false,
        error: error.message
      };
    }
  }

  /**
   * Get the current model from backend config or use default
   * @returns {Promise<string>} - The model name
   */
  async getModel() {
    if (!this.config) {
      await this.configPromise;
    }
    return this.config?.llmModel || this.defaultModel;
  }

  /**
   * Get the current embedding model from backend config or use default
   * @returns {Promise<string>} - The embedding model name
   */
  async getEmbeddingModel() {
    if (!this.config) {
      await this.configPromise;
    }
    return this.config?.embeddingModel || this.defaultEmbeddingModel;
  }

  /**
   * Send a message to the LLM and get a response
   * @param {string} message - The user's message
   * @param {Array} chatHistory - Previous messages in the conversation
   * @param {Object} options - Additional options for the LLM call
   * @returns {Promise<Object>} - The assistant's response
   */
  async sendMessage(message, chatHistory = [], options = {}) {
    try {
      console.log('Attempting to send message to LLM backend...');
      
      // Check if backend is available first
      const isBackendAvailable = await this.checkBackendStatus();
      if (!isBackendAvailable) {
        throw new Error('Backend server is not available. Please start the backend server by running "npm run server" in the backend directory.');
      }

      // Ensure config is loaded
      await this.configPromise;
      
      // Use model from options, or from config, or fallback to default
      const modelToUse = options.model || (this.config?.llmModel) || this.defaultModel;
      
      console.log(`Using model: ${modelToUse} for message`);

      // Use the server proxy exposed by the preload script
      if (!window.server) {
        throw new Error('Server proxy not available in the renderer process. This could indicate a problem with Electron preload script.');
      }
      
      console.log('Sending chat request to backend...');
      const response = await window.server.chat({
        message,
        chatHistory: this.formatChatHistory(chatHistory),
        model: modelToUse,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 1024,
        tools: options.tools || this.getDefaultTools()
      });
      
      console.log('Received response from backend');
      return response;
    } catch (error) {
      console.error('Error in LlmService.sendMessage:', error);
      
      // Enhance error message with more helpful information
      if (error.message.includes('ECONNREFUSED') || error.message.includes('Backend server is not available')) {
        throw new Error('Backend server is not available. Please start the backend server by running "npm run server" in the backend directory.');
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Network error. Please check your internet connection and ensure the backend server is running.');
      }
      
      throw error;
    }
  }

  /**
   * Check if the backend server is available
   * @returns {Promise<boolean>} - True if the backend is available, false otherwise
   */
  async checkBackendStatus() {
    try {
      // Use the server proxy exposed by the preload script
      if (!window.server) {
        console.error('Server proxy not available');
        return false;
      }
      
      console.log('Checking backend health status...');
      
      try {
        await window.server.checkHealth();
        console.log('Backend health check successful');
        return true;
      } catch (error) {
        // Check if this is a connection refused error (server not running)
        if (error.message && (
            error.message.includes('ECONNREFUSED') || 
            error.message.includes('Backend server is not available')
          )) {
          console.error('Backend server is not running. Please start the backend server.');
          // Wait a bit and try once more
          return await this.retryBackendConnection();
        }
        
        console.error('Backend health check failed:', error);
        return false;
      }
    } catch (error) {
      console.error('Error in checkBackendStatus:', error);
      return false;
    }
  }
  
  /**
   * Retry backend connection with a delay
   * @returns {Promise<boolean>} - True if the backend is available, false otherwise
   */
  async retryBackendConnection() {
    console.log('Retrying backend connection...');
    
    // Wait 1 second before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      if (!window.server) {
        return false;
      }
      
      await window.server.checkHealth();
      console.log('Backend connection retry successful');
      return true;
    } catch (error) {
      console.error('Backend connection retry failed');
      return false;
    }
  }

  /**
   * Execute a specific tool call
   * @param {string} toolCallId - The ID of the tool call to execute
   * @param {string} toolName - The name of the tool to execute
   * @param {Object} parameters - The parameters for the tool
   * @returns {Promise<Object>} - The result of the tool execution
   */
  async executeToolCall(toolCallId, toolName, parameters) {
    try {
      // Check if backend is available first
      const isBackendAvailable = await this.checkBackendStatus();
      if (!isBackendAvailable) {
        throw new Error('Backend server is not available. Please start the backend server first.');
      }

      // Use the server proxy exposed by the preload script
      if (window.server) {
        return await window.server.executeToolCall({
          toolCallId,
          toolName,
          parameters
        });
      } else {
        throw new Error('Server proxy not available');
      }
    } catch (error) {
      console.error('Error in LlmService.executeToolCall:', error);
      throw error;
    }
  }

  /**
   * Format chat history for the API request
   * @param {Array} chatHistory - Raw chat history from the UI
   * @returns {Array} - Formatted chat history for the API
   */
  formatChatHistory(chatHistory) {
    return chatHistory.map(message => ({
      role: message.role,
      content: message.content,
      // Include tool calls if they exist
      ...(message.toolCalls && message.toolCalls.length > 0 && {
        toolCalls: message.toolCalls
      })
    }));
  }

  /**
   * Get the default set of tools for the LLM
   * @returns {Array} - Default tool definitions
   */
  getDefaultTools() {
    return [
      {
        name: 'searchKnowledgeBase',
        description: 'Search the knowledge base for relevant information',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query'
            },
            filters: {
              type: 'object',
              description: 'Optional filters for the search',
              properties: {
                sourceType: {
                  type: 'string',
                  description: 'Filter by source type (pdf, url, youtube, etc.)'
                },
                dateAdded: {
                  type: 'string',
                  description: 'Filter by date added (ISO string)'
                }
              }
            }
          },
          required: ['query']
        }
      },
      {
        name: 'getItemContent',
        description: 'Get the full content of a specific item in the knowledge base',
        parameters: {
          type: 'object',
          properties: {
            itemId: {
              type: 'string',
              description: 'The ID of the item to retrieve'
            }
          },
          required: ['itemId']
        }
      },
      {
        name: 'summarizeContent',
        description: 'Generate a summary of the provided content',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The content to summarize'
            },
            length: {
              type: 'string',
              description: 'The desired length of the summary (short, medium, long)',
              enum: ['short', 'medium', 'long']
            }
          },
          required: ['content']
        }
      }
    ];
  }

  /**
   * Generate embeddings for text using the LLM
   * @param {string} text - The text to generate embeddings for
   * @returns {Promise<Object>} - The embeddings
   */
  async generateEmbeddings(text) {
    try {
      // Check if backend is available first
      const isBackendAvailable = await this.checkBackendStatus();
      if (!isBackendAvailable) {
        throw new Error('Backend server is not available. Please start the backend server first.');
      }

      // Ensure config is loaded
      await this.configPromise;
      
      // Use embedding model from config or fallback
      const embeddingModel = this.config?.embeddingModel || this.defaultEmbeddingModel;

      // Use the server proxy exposed by the preload script
      if (window.server) {
        return await window.server.generateEmbeddings({
          text,
          model: embeddingModel
        });
      } else {
        throw new Error('Server proxy not available');
      }
    } catch (error) {
      console.error('Error in LlmService.generateEmbeddings:', error);
      throw error;
    }
  }
}

export default LlmService; 