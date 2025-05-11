/**
 * Tool Definitions Adapter
 * Provides access to tool definitions for backend services
 * 
 * NOTE: This is a simplified version that embeds tool definitions directly
 * to avoid cross-environment module loading issues.
 */
const logger = require('./logger').scope('ToolDefinitionsAdapter');

// Tool definitions embedded directly in the backend
// This ensures the backend can run independently without frontend module loading issues
const toolDefinitions = {
  // RAG (Retrieval Augmented Generation) Tools
  searchKnowledgeBase: {
    name: 'searchKnowledgeBase',
    description: 'Search the knowledge base for relevant information',
    version: '1.0.0',
    location: 'backend',
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
    location: 'both',
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

/**
 * Initialize the tool definitions
 * @returns {boolean} - Success status
 */
function initialize() {
  try {
    logger.info('Using embedded tool definitions');
    return true;
  } catch (error) {
    logger.error('Failed to initialize tool definitions adapter', { error: error.message });
    return false;
  }
}

/**
 * Get all tool definitions
 * @returns {Object} - Object containing all tool definitions
 */
function getToolDefinitions() {
  return toolDefinitions;
}

/**
 * Get an array of all tool definitions
 * @returns {Array} - Array of all tool definitions
 */
function getAllToolDefinitions() {
  return Object.values(toolDefinitions);
}

/**
 * Get a specific tool definition by name
 * @param {string} toolName - Name of the tool to get
 * @returns {Object|null} - Tool definition or null if not found
 */
function getToolDefinition(toolName) {
  return toolDefinitions[toolName] || null;
}

/**
 * Get tool definitions for LLM function calling
 * @returns {Array} - Array of tool definitions formatted for LLM function calling
 */
function getLlmToolDefinitions() {
  return getAllToolDefinitions().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
}

/**
 * Get tool definitions filtered by location
 * @param {string} location - Location to filter by ('frontend', 'backend', 'both')
 * @returns {Array} - Array of filtered tool definitions
 */
function getToolDefinitionsByLocation(location) {
  return getAllToolDefinitions().filter(tool => 
    tool.location === location || tool.location === 'both'
  );
}

/**
 * Get all tool definitions available to the backend
 * @returns {Array} - Array of backend tool definitions
 */
function getBackendToolDefinitions() {
  return getToolDefinitionsByLocation('backend')
    .concat(getToolDefinitionsByLocation('both'));
}

/**
 * Get all available tool names for the backend
 * @returns {Array<string>} - Array of tool names
 */
function getBackendToolNames() {
  const definitions = getBackendToolDefinitions();
  return definitions.map(tool => tool.name);
}

// Initialize on module load
initialize();

module.exports = {
  initialize,
  getToolDefinitions,
  getAllToolDefinitions,
  getToolDefinition,
  getLlmToolDefinitions,
  getToolDefinitionsByLocation,
  getBackendToolDefinitions,
  getBackendToolNames
}; 