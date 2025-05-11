/**
 * GeminiFunctionCaller
 * Utility class for handling Gemini function calling with best practices
 */
import logger from '../../utils/logger';
import { SchemaValidator } from './validation';

// Create scope-specific logger
const geminiFunctionLogger = logger.scope('GeminiFunctionCaller');

/**
 * Function call result with type validation
 */
class FunctionCallResult {
  /**
   * Create a new function call result
   * @param {boolean} success - Whether the call was successful
   * @param {Object} result - Result data (if successful)
   * @param {string} error - Error message (if unsuccessful)
   * @param {Object} validationErrors - Validation errors (if any)
   */
  constructor(success, result = null, error = null, validationErrors = null) {
    this.success = success;
    this.result = result;
    this.error = error;
    this.validationErrors = validationErrors;
  }

  /**
   * Create a successful result
   * @param {Object} result - Result data
   * @returns {FunctionCallResult} - Successful result
   */
  static success(result) {
    return new FunctionCallResult(true, result);
  }

  /**
   * Create an error result
   * @param {string} error - Error message
   * @param {Object} validationErrors - Validation errors (if any)
   * @returns {FunctionCallResult} - Error result
   */
  static error(error, validationErrors = null) {
    return new FunctionCallResult(false, null, error, validationErrors);
  }

  /**
   * Convert to JSON
   * @returns {Object} - JSON representation
   */
  toJSON() {
    const result = {
      success: this.success
    };

    if (this.result !== null) {
      result.result = this.result;
    }

    if (this.error !== null) {
      result.error = this.error;
    }

    if (this.validationErrors !== null) {
      result.validationErrors = this.validationErrors;
    }

    return result;
  }
}

class GeminiFunctionCaller {
  /**
   * Create a new GeminiFunctionCaller
   * @param {ToolRegistry} toolRegistry - The tool registry instance
   */
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
    geminiFunctionLogger.info('Initializing GeminiFunctionCaller');
  }

  /**
   * Generate function declarations for Gemini API
   * @returns {Array} - Array of function declarations compatible with Gemini
   */
  getFunctionDeclarations() {
    return this.toolRegistry.getFunctionDeclarations();
  }

  /**
   * Execute a function call from Gemini with type validation
   * @param {Object} functionCall - The function call object from Gemini
   * @returns {Promise<FunctionCallResult>} - Function call execution result
   */
  async executeFunction(functionCall) {
    try {
      if (!functionCall || !functionCall.name) {
        return FunctionCallResult.error('Invalid function call object');
      }

      const { name, arguments: args } = functionCall;
      
      geminiFunctionLogger.info(`Executing function call: ${name}`, { args });
      
      // Get tool from registry
      const tool = this.toolRegistry.tools[name];
      
      // Validate parameters with the tool's validator if available
      if (tool && tool.paramValidator && typeof tool.paramValidator === 'function') {
        try {
          const validatedArgs = tool.paramValidator(args || {});
          
          // Execute with validated args
          const result = await this.toolRegistry.executeTool(name, validatedArgs);
          
          if (result.success) {
            return FunctionCallResult.success(result.result);
          } else {
            return FunctionCallResult.error(result.error);
          }
        } catch (validationError) {
          // Handle validation errors
          geminiFunctionLogger.error(`Parameter validation failed for tool ${name}`, {
            error: validationError.message,
            validationErrors: validationError.validationErrors
          });
          
          return FunctionCallResult.error(
            `Parameter validation failed: ${validationError.message}`,
            validationError.validationErrors
          );
        }
      } else {
        // Execute tool without validation
        const result = await this.toolRegistry.executeTool(name, args || {});
        
        if (result.success) {
          return FunctionCallResult.success(result.result);
        } else {
          return FunctionCallResult.error(result.error);
        }
      }
    } catch (error) {
      geminiFunctionLogger.error('Function execution failed', { error: error.message });
      return FunctionCallResult.error(error.message);
    }
  }

  /**
   * Process function calling response from Gemini
   * @param {Object} response - Response from Gemini containing function calls
   * @returns {Promise<Object>} - Processed response with function results
   */
  async processResponse(response) {
    try {
      // Check if the response contains function calls
      if (!response || !response.functionCalls || !response.functionCalls.length) {
        geminiFunctionLogger.info('No function calls in response');
        return {
          text: response.text || '',
          functionCalls: [],
          functionResults: []
        };
      }
      
      // Process all function calls
      const functionResults = [];
      for (const functionCall of response.functionCalls) {
        const result = await this.executeFunction(functionCall);
        functionResults.push({
          name: functionCall.name,
          result: result.result,
          success: result.success,
          error: result.error,
          validationErrors: result.validationErrors
        });
      }
      
      return {
        text: response.text || '',
        functionCalls: response.functionCalls,
        functionResults
      };
    } catch (error) {
      geminiFunctionLogger.error('Error processing Gemini response', { error: error.message });
      throw error;
    }
  }

  /**
   * Create properly formatted request config for Gemini
   * @param {string} prompt - User prompt
   * @param {Object} options - Additional request options
   * @returns {Object} - Formatted request config for Gemini API
   */
  createRequestConfig(prompt, options = {}) {
    const config = {
      // Default to low temperature for more deterministic function calls
      temperature: options.temperature !== undefined ? options.temperature : 0,
      // Include tool declarations
      tools: [
        {
          functionDeclarations: this.getFunctionDeclarations()
        }
      ],
      // Additional options
      ...options
    };
    
    return {
      model: options.model || 'gemini-2.0-flash',
      contents: prompt,
      config
    };
  }
}

export default GeminiFunctionCaller; 