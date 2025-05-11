/**
 * Shared Tool Definitions
 * Centralized definitions for tools used in both frontend and backend
 * This ensures consistency between client and server implementations
 */

/**
 * Get standardized tool definitions
 * @returns {Object} - Object containing all tool definitions
 */
const getToolDefinitions = () => {
  return {
    // RAG (Retrieval Augmented Generation) Tools
    searchKnowledgeBase: {
      name: 'searchKnowledgeBase',
      description: 'Search the knowledge base for relevant information',
      version: '1.0.0',
      location: 'backend', // Where this tool is primarily implemented
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
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results to return (default: 5)'
          }
        },
        required: ['query']
      }
    },
    
    getItemContent: {
      name: 'getItemContent',
      description: 'Get the full content of a specific item in the knowledge base',
      version: '1.0.0',
      location: 'backend',
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
    
    summarizeContent: {
      name: 'summarizeContent',
      description: 'Generate a concise summary of the provided content',
      version: '1.0.0',
      location: 'both', // Available in both frontend and backend
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
    },
    
    recommendRelatedContent: {
      name: 'recommendRelatedContent',
      description: 'Recommend related content based on a query or item ID',
      version: '1.0.0',
      location: 'backend',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to base recommendations on (optional if itemId provided)'
          },
          itemId: {
            type: 'string',
            description: 'ID of the item to base recommendations on (optional if query provided)'
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of recommendations to return (default: 3)'
          }
        }
      }
    }
  };
};

/**
 * Get an array of all tool definitions
 * @returns {Array} - Array of all tool definitions
 */
const getAllToolDefinitions = () => {
  return Object.values(getToolDefinitions());
};

/**
 * Get a specific tool definition by name
 * @param {string} toolName - Name of the tool to get
 * @returns {Object|null} - Tool definition or null if not found
 */
const getToolDefinition = (toolName) => {
  const definitions = getToolDefinitions();
  return definitions[toolName] || null;
};

/**
 * Get tool definitions for LLM function calling
 * @returns {Array} - Array of tool definitions formatted for LLM function calling
 */
const getLlmToolDefinitions = () => {
  return getAllToolDefinitions().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
};

/**
 * Get tool definitions filtered by location
 * @param {string} location - Location to filter by ('frontend', 'backend', 'both')
 * @returns {Array} - Array of filtered tool definitions
 */
const getToolDefinitionsByLocation = (location) => {
  return getAllToolDefinitions().filter(tool => 
    tool.location === location || tool.location === 'both'
  );
};

// Create a module object with all exports
const toolDefinitionsModule = {
  getToolDefinitions,
  getAllToolDefinitions,
  getToolDefinition,
  getLlmToolDefinitions,
  getToolDefinitionsByLocation
};

// Handle different module systems
// CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = toolDefinitionsModule;
} 
// ES modules
else if (typeof exports !== 'undefined') {
  Object.assign(exports, toolDefinitionsModule);
} 
// Browser globals
else {
  window.toolDefinitions = toolDefinitionsModule;
} 