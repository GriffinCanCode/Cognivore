/**
 * Tool Registry
 * Manages registration and execution of document processing tools
 */
import ApiService from '../ApiService';
import logger from '../../utils/logger';

// Create scope-specific logger
const toolsLogger = logger.scope('ToolsRegistry');

class ToolRegistry {
  constructor() {
    this.apiService = new ApiService();
    this.tools = {};
    this.toolsMetadata = {};
    
    toolsLogger.info('Initializing Tool Registry');
  }

  /**
   * Register a tool with the registry
   * @param {string} name - Tool name
   * @param {Object} toolModule - Tool implementation module
   * @returns {boolean} - Success status
   */
  registerTool(name, toolModule) {
    if (!name || !toolModule) {
      toolsLogger.error('Invalid tool registration parameters', { name });
      return false;
    }
    
    this.tools[name] = toolModule;
    
    // Create metadata with JSON Schema compatible structure
    this.toolsMetadata[name] = {
      name,
      description: toolModule.description || 'No description available',
      version: toolModule.version || '1.0.0',
      parameters: this.buildParameterSchema(toolModule.parameters || {})
    };
    
    toolsLogger.info(`Registered tool: ${name}`);
    return true;
  }

  /**
   * Build a JSON Schema compatible parameter schema
   * @param {Object} params - Parameter definitions from tool
   * @returns {Object} - JSON Schema compatible parameter definition
   */
  buildParameterSchema(params) {
    // If already in JSON Schema format, return as is
    if (params.type === 'object' && params.properties) {
      return params;
    }
    
    // Convert simple parameter definitions to JSON Schema
    const properties = {};
    const required = [];
    
    Object.entries(params).forEach(([paramName, paramConfig]) => {
      // Handle string descriptions or object configurations
      if (typeof paramConfig === 'string') {
        properties[paramName] = {
          type: 'string', // Default to string
          description: paramConfig
        };
      } else if (typeof paramConfig === 'object') {
        properties[paramName] = {
          type: paramConfig.type || 'string',
          description: paramConfig.description || '',
          ...(paramConfig.enum ? { enum: paramConfig.enum } : {})
        };
        
        if (paramConfig.required) {
          required.push(paramName);
        }
      }
    });
    
    return {
      type: 'object',
      properties,
      required
    };
  }

  /**
   * Get a list of available tools
   * @returns {Promise<Array>} - List of available tools
   */
  async getAvailableTools() {
    try {
      // Try to get from backend first
      const backendTools = await this.apiService.getAvailableTools();
      
      // Merge backend tools with locally registered tools
      const allTools = [...backendTools];
      
      // Add local tools not already in the list
      Object.keys(this.toolsMetadata).forEach(name => {
        if (!allTools.find(tool => tool.name === name)) {
          allTools.push(this.toolsMetadata[name]);
        }
      });
      
      return allTools;
    } catch (error) {
      toolsLogger.warn('Failed to get backend tools', { error: error.message });
      
      // Return local tools if backend request fails
      return Object.values(this.toolsMetadata);
    }
  }

  /**
   * Get tool metadata in Gemini function declaration format
   * @returns {Array} - Tool metadata for Gemini function calling
   */
  getFunctionDeclarations() {
    return Object.values(this.toolsMetadata).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  /**
   * Validate tool parameters against schema
   * @param {string} toolName - Name of the tool
   * @param {Object} params - Parameters to validate
   * @returns {Object} - Validation result with success and errors
   */
  validateToolParams(toolName, params) {
    const tool = this.toolsMetadata[toolName];
    if (!tool || !tool.parameters) {
      return { 
        valid: false, 
        errors: ['Tool not found or has no parameter schema'] 
      };
    }
    
    const errors = [];
    const schema = tool.parameters;
    
    // Check required parameters
    if (schema.required && Array.isArray(schema.required)) {
      schema.required.forEach(requiredParam => {
        if (params[requiredParam] === undefined) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      });
    }
    
    // Validate parameter types
    if (schema.properties) {
      Object.entries(params).forEach(([paramName, paramValue]) => {
        const paramSchema = schema.properties[paramName];
        if (!paramSchema) {
          // Allow extra parameters, but log a warning
          toolsLogger.warn(`Unexpected parameter passed to tool: ${paramName}`, { toolName });
          return;
        }
        
        // Simple type validation
        if (paramSchema.type === 'string' && typeof paramValue !== 'string') {
          errors.push(`Parameter ${paramName} should be a string`);
        } else if (paramSchema.type === 'number' || paramSchema.type === 'integer') {
          if (typeof paramValue !== 'number') {
            errors.push(`Parameter ${paramName} should be a number`);
          }
        } else if (paramSchema.type === 'boolean' && typeof paramValue !== 'boolean') {
          errors.push(`Parameter ${paramName} should be a boolean`);
        } else if (paramSchema.type === 'array' && !Array.isArray(paramValue)) {
          errors.push(`Parameter ${paramName} should be an array`);
        } else if (paramSchema.type === 'object' && (typeof paramValue !== 'object' || Array.isArray(paramValue))) {
          errors.push(`Parameter ${paramName} should be an object`);
        }
        
        // Enum validation
        if (paramSchema.enum && !paramSchema.enum.includes(paramValue)) {
          errors.push(`Parameter ${paramName} should be one of: ${paramSchema.enum.join(', ')}`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute a tool
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} params - Tool parameters
   * @returns {Promise<Object>} - Tool execution result
   */
  async executeTool(toolName, params = {}) {
    try {
      // Validate parameters
      const validation = this.validateToolParams(toolName, params);
      if (!validation.valid) {
        toolsLogger.error(`Tool parameter validation failed: ${toolName}`, { 
          errors: validation.errors, 
          params 
        });
        return { 
          success: false, 
          error: `Parameter validation failed: ${validation.errors.join(', ')}` 
        };
      }
      
      // Check if tool exists locally
      const localTool = this.tools[toolName];
      
      if (localTool && typeof localTool.execute === 'function') {
        // Execute locally
        toolsLogger.info(`Executing local tool: ${toolName}`);
        const result = await localTool.execute(params, this.apiService);
        return { success: true, result };
      }
      
      // Execute on backend
      toolsLogger.info(`Executing backend tool: ${toolName}`);
      return await this.apiService.executeTool(toolName, params);
    } catch (error) {
      toolsLogger.error(`Tool execution failed: ${toolName}`, { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

export default ToolRegistry; 