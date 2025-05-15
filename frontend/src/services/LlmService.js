// LlmService for Gemini 2.5 Flash integration
import systemPrompt from './systemPrompt';
import messageFormatter from '../utils/messageFormatter.js';

class LlmService {
  constructor() {
    this.defaultModel = 'gemini-2.0-flash'; // Update to supported model
    this.defaultEmbeddingModel = 'text-embedding-005'; // Fallback embedding model
    this.config = null;
    this.configPromise = this.loadConfig();
    this.apiKeyMissing = false;
    this.debugMode = process.env.NODE_ENV !== 'production'; // Enable debug mode in development
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
   * Send a message to the LLM for processing
   * @param {string} message - Message to send
   * @param {Array} chatHistory - Previous chat history
   * @param {Object} options - Additional options for the LLM
   * @returns {Promise<Object>} - Response from the LLM
   */
  async sendMessage(message, chatHistory = [], options = {}) {
    try {
      // Check for backend connection first
      if (!await this.checkBackendStatus()) {
        return {
          error: true,
          text: "⚠️ Error: Backend server is not available. Please make sure the backend service is running.",
          suggestedActions: [
            { label: "Restart Application", action: "restart" },
            { label: "Check Server Logs", action: "check_logs" }
          ]
        };
      }

      // Prepare chat history with system prompt
      const formattedHistory = this.formatChatHistoryWithSystemPrompt(chatHistory, options.systemPrompt);
      
      // Log memory usage before API call (if debug enabled)
      if (this.debugMode) {
        try {
          console.debug('[LlmService] Memory before API call:', this.getMemoryUsage());
        } catch (error) {
          console.debug('[LlmService] Unable to get memory usage:', error.message);
        }
      }
      
      console.log('[LlmService] Sending chat request to backend server');
      const response = await window.server.chat({
        message,
        chatHistory: formattedHistory,
        model: options.model || this.defaultModel,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        tools: options.tools || this.getDefaultTools()
      });
      
      console.log('[LlmService] Received response from backend server:', response);
      
      // Check for apiKeyMissing flag directly from preload.js response
      if (response.apiKeyMissing) {
        console.warn('[LlmService] API key missing detected, showing guidance');
        return {
          error: true,
          text: "⚠️ Google API Key Missing",
          details: [
            "The Google API key is missing or couldn't be found. Please follow these steps:",
            "1. Create a file named .env in the backend directory",
            "2. Add your Google API key: GOOGLE_API_KEY=your_api_key_here",
            "3. Restart the application",
            "",
            "You can get your Google API key from: https://ai.google.dev/"
          ],
          suggestedActions: [
            { label: "Get API Key", action: "open_url", url: "https://ai.google.dev/" },
            { label: "View Setup Guide", action: "view_docs", file: "API_SETUP.md" }
          ],
          apiKeyMissing: true
        };
      }
      
      // Check for error response from the IPC bridge
      if (response.error === true) {
        let errorMessage = response.message || "Unknown error occurred";
        let errorDetails = [];
        
        // Provide helpful guidance for API key issues
        if (errorMessage.includes("API key") || 
            errorMessage.includes("unregistered callers") || 
            errorMessage.includes("authentication") ||
            errorMessage.includes("403 Forbidden")) {
          
          errorMessage = "⚠️ Google API Key Issue: The application cannot connect to Gemini AI.";
          errorDetails = [
            "The Google API key is missing or invalid, or doesn't have proper permissions. Please follow these steps:",
            "1. Get an API key from https://ai.google.dev/",
            "2. Make sure your project is enabled for Gemini API including function calling",
            "3. Add your key to backend/.env file: GOOGLE_API_KEY=YOUR_API_KEY",
            "4. Restart the application",
            "",
            "For detailed instructions, see backend/API_SETUP.md"
          ];
          
          return {
            error: true,
            text: errorMessage,
            details: errorDetails,
            suggestedActions: [
              { label: "Get API Key", action: "open_url", url: "https://ai.google.dev/" },
              { label: "View Setup Guide", action: "view_docs", file: "API_SETUP.md" },
              { label: "Check API Status", action: "check_api_status" }
            ]
          };
        }
        
        // Handle quota/rate limit errors
        if (errorMessage.includes("rate limit") || errorMessage.includes("quota")) {
          errorMessage = "⚠️ API Quota Exceeded: You've reached your Google AI API usage limits.";
          errorDetails = [
            "You've reached your Google AI API quota or rate limits. Please try:",
            "1. Wait a few minutes and try again",
            "2. Check your Google AI Studio quota and usage limits",
            "3. Consider upgrading your Google AI plan for higher limits"
          ];
          
          return {
            error: true,
            text: errorMessage,
            details: errorDetails,
            suggestedActions: [
              { label: "Check Quota", action: "open_url", url: "https://console.cloud.google.com/apis/dashboard" }
            ]
          };
        }
        
        // Generic error handling
        return {
          error: true,
          text: errorMessage,
          details: errorDetails
        };
      }
      
      // Process successful response using message formatter
      if (!response) {
        throw new Error('Empty response received from backend');
      }

      // Log raw response for debugging
      console.log('[LlmService] Processing raw response:', JSON.stringify(response).substring(0, 200) + '...');
      
      // Handle character-by-character indexed response format
      if (response && typeof response === 'object' && response['0'] !== undefined) {
        console.log('[LlmService] Detected character-by-character response format, reconstructing');
        // Reconstruct the string from indexed characters
        let reconstructedText = '';
        const keys = Object.keys(response)
                          .filter(key => !isNaN(parseInt(key)))
                          .sort((a, b) => parseInt(a) - parseInt(b));
        
        for (const key of keys) {
          reconstructedText += response[key];
        }
        
        console.log('[LlmService] Reconstructed text length:', reconstructedText.length);
        
        // Try to parse it as JSON
        try {
          const parsed = JSON.parse(reconstructedText);
          console.log('[LlmService] Successfully parsed reconstructed text as JSON');
          
          // Extract the actual text from the candidates structure
          if (parsed.candidates && parsed.candidates.length > 0) {
            const candidate = parsed.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
              // Collect all text parts and check for tool calls
              let textContent = '';
              let toolCalls = [];
              
              // Process all parts of the candidate
              candidate.content.parts.forEach((part, idx) => {
                if (part.text) {
                  textContent += part.text;
                } else if (part.functionCall || part.toolCall) {
                  const call = part.functionCall || part.toolCall;
                  toolCalls.push({
                    name: call.name,
                    toolCallId: call.id || `call-${Date.now()}-${idx}`,
                    args: call.args || call.arguments || {}
                  });
                }
              });
              
              // Create a properly formatted message object
              const message = {
                role: 'assistant',
                content: textContent,
                timestamp: new Date().toISOString()
              };
              
              // Add tool calls if any were found
              if (toolCalls.length > 0) {
                message.toolCalls = toolCalls;
                console.log('[LlmService] Found tool calls in candidates response:', toolCalls);
              }
              
              return message;
            }
          }
          
          // If we couldn't extract text in the expected format, use the entire response
          return {
            role: 'assistant',
            content: JSON.stringify(parsed),
            timestamp: new Date().toISOString()
          };
        } catch (e) {
          console.error('[LlmService] Failed to parse reconstructed text:', e);
          // Return reconstructed text directly if not parseable
          return {
            role: 'assistant',
            content: reconstructedText,
            timestamp: new Date().toISOString()
          };
        }
      }

      // Use the messageFormatter for other cases
      let formattedResponse = messageFormatter.processResponse(response);
      
      // Ensure the response has all required fields for ChatMessages
      // ChatMessages expects 'content', but messageFormatter returns 'text'
      if (formattedResponse.text && !formattedResponse.content) {
        formattedResponse.content = formattedResponse.text;
      }
      
      // Always ensure there's a non-null content field
      if (!formattedResponse.content) {
        formattedResponse.content = '';
      }
      
      // Enhanced check for tool calls in formatted text (as fallback)
      if ((!formattedResponse.toolCalls || formattedResponse.toolCalls.length === 0) && 
          formattedResponse.text && 
          (formattedResponse.text.includes('```tool_code') || 
           formattedResponse.text.includes('listFiles'))) {
        
        console.log('[LlmService] Detected potential tool calls in text, attempting to process');
        
        // Check for tool calls in text content as a fallback
        // This is a safety net in case the backend processing didn't catch the tool call
        this.extractToolCallsFromText(formattedResponse);
      }
      
      return formattedResponse;
      
    } catch (error) {
      console.error('[LlmService] Error sending message:', error);
      
      return {
        error: true,
        text: `⚠️ Error: ${error.message}`,
        details: [error.stack]
      };
    }
  }

  /**
   * Format chat history with system prompt if needed
   * @param {Array} chatHistory - Raw chat history from the UI
   * @param {Object} options - Additional options 
   * @returns {Array} - Formatted chat history with system prompt
   */
  formatChatHistoryWithSystemPrompt(chatHistory, options = {}) {
    // Check if there's already a system message at the beginning
    const hasSystemMessage = chatHistory.length > 0 && 
                            chatHistory[0].role === 'system';
    
    // Clone the history to avoid modifying the original
    const formattedHistory = this.formatChatHistory([...chatHistory]);
    
    // If no system message exists, add one
    if (!hasSystemMessage) {
      // Get system prompt based on options
      const systemPromptText = options.minimalPrompt ? 
        this.getMinimalSystemPrompt() : 
        this.getSystemPrompt({
          userName: options.userName || 'User',
          toolsMetadata: options.tools || this.getDefaultTools()
        });
      
      // Gemini 2.0 Flash doesn't support system roles, so we convert it to a user message
      // with special formatting to indicate it's instructions
      formattedHistory.unshift({
        role: 'user',
        content: `[SYSTEM INSTRUCTIONS]\n${systemPromptText}\n[END SYSTEM INSTRUCTIONS]`
      });
      
      // Add a model response to maintain the conversation flow
      formattedHistory.unshift({
        role: 'model',
        content: 'I understand my instructions and will follow them.'
      });
    } else {
      // If there's already a system message, convert it to a user message for Gemini
      formattedHistory[0] = {
        role: 'user',
        content: `[SYSTEM INSTRUCTIONS]\n${formattedHistory[0].content}\n[END SYSTEM INSTRUCTIONS]`
      };
      
      // Add a model response if there isn't already one
      if (formattedHistory.length === 1 || formattedHistory[1].role !== 'model') {
        formattedHistory.splice(1, 0, {
          role: 'model',
          content: 'I understand my instructions and will follow them.'
        });
      }
    }
    
    return formattedHistory;
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
        // Add timeout to health check
        const healthStatus = await Promise.race([
          window.server.checkHealth(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 3000)
          )
        ]);
        
        console.log('Backend health check successful');
        return true;
      } catch (error) {
        // Check if this is a connection refused error (server not running)
        if (error.message && (
            error.message.includes('ECONNREFUSED') || 
            error.message.includes('Backend server is not available') ||
            error.message.includes('timeout')
          )) {
          console.error('Backend server connection issue:', error.message);
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
    
    // Wait 1.5 seconds before retrying (increased from 1 second)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      if (!window.server) {
        return false;
      }
      
      // Add timeout to retry
      const healthStatus = await Promise.race([
        window.server.checkHealth(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check retry timeout')), 4000)
        )
      ]);
      
      console.log('Backend connection retry successful');
      return true;
    } catch (error) {
      console.error('Backend connection retry failed:', error.message);
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
    return systemPrompt.getDefaultToolDefinitions();
  }

  /**
   * Get a system prompt for the LLM
   * @param {Object} options - Options for the system prompt
   * @returns {string} - Formatted system prompt
   */
  getSystemPrompt(options = {}) {
    return systemPrompt.createSystemPrompt(options);
  }

  /**
   * Get a minimal system prompt for lightweight interactions
   * @returns {string} - Minimal system prompt
   */
  getMinimalSystemPrompt() {
    return systemPrompt.createMinimalSystemPrompt();
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

  /**
   * Get current memory usage information
   * Safe to use in browser environment
   * @returns {Object} - Memory usage stats or placeholder if not available
   */
  getMemoryUsage() {
    // In browser environment, we have limited access to memory info
    if (window.performance && window.performance.memory) {
      const memory = window.performance.memory;
      return {
        totalJSHeapSize: this.formatBytes(memory.totalJSHeapSize),
        usedJSHeapSize: this.formatBytes(memory.usedJSHeapSize),
        jsHeapSizeLimit: this.formatBytes(memory.jsHeapSizeLimit),
        percentUsed: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100) + '%'
      };
    }
    
    // Return placeholder if not available
    return { note: 'Memory usage info not available in this environment' };
  }
  
  /**
   * Format bytes to human-readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} - Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Extract tool calls from text if they're embedded in markdown or code blocks
   * @param {Object} response - The formatted response object
   * @returns {Object} - The response with extracted tool calls
   */
  extractToolCallsFromText(response) {
    if (!response) return response;
    
    // Ensure response has content fields
    const textContent = response.text || response.content || '';
    if (!textContent) return response;
    
    // Make sure both text and content fields are synchronized
    if (!response.text) response.text = textContent;
    if (!response.content) response.content = textContent;
    
    // Check for tool calls in markdown code blocks with an expanded pattern set
    const toolCallRegex = /```(?:tool_code|tool|code)?\s*\n(\w+\(.*?\))|tool_code\s*\n(\w+\(.*?\))|```.*?\n(\w+\(.*?\))\s*```/gs;
    const matches = [...textContent.matchAll(toolCallRegex)];
    
    if (matches && matches.length > 0) {
      console.log('[LlmService] Found tool calls in text content:', matches);
      
      // Initialize toolCalls array if it doesn't exist
      if (!response.toolCalls) {
        response.toolCalls = [];
      }
      
      // Process each match
      matches.forEach((match, index) => {
        // Check all capture groups, some might be undefined
        const toolCall = match[1] || match[2] || match[3]; // Get the captured tool call 
        if (toolCall) {
          // Extract tool name and parameters
          const toolName = toolCall.split('(')[0].trim();
          let paramsStr = toolCall.match(/\((.*?)\)/)?.[1] || '';
          
          // Parse parameters
          const params = {};
          const paramMatches = [...paramsStr.matchAll(/(\w+)\s*=\s*["'](.*?)["']/g)];
          paramMatches.forEach(paramMatch => {
            params[paramMatch[1]] = paramMatch[2];
          });
          
          // Add to toolCalls array
          response.toolCalls.push({
            toolCallId: `frontend-extracted-${Date.now()}-${index}`,
            toolName: toolName,
            parameters: params
          });
          
          console.log(`[LlmService] Extracted tool call from text: ${toolName}`, params);
        }
      });
      
      // Add a note about tool execution in the response
      response.containsExtractedToolCalls = true;
    }
    
    return response;
  }
}

export default LlmService; 