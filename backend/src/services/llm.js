/**
 * LLM Service for backend
 * Handles Google Generative AI model interactions
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { createContextLogger } = require('../utils/logger');
const config = require('../config');
const { memoryManager } = require('../memory');

const logger = createContextLogger('LLMService');

// Default fallback models
const DEFAULT_LLM_MODEL = 'gemini-2.0-flash';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-005';

// Helper to get the latest API key
function getApiKey() {
  return process.env.GOOGLE_API_KEY || '';
}

// Helper to get a fresh GoogleGenerativeAI instance
function getGenAI() {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.error('No Google API key found. Please set GOOGLE_API_KEY in your environment.');
    throw new Error('Google API key is not configured. Please set GOOGLE_API_KEY in your environment variables.');
  }
  return new GoogleGenerativeAI(apiKey);
}

// Cache for model instances to avoid recreating them (per API key)
const modelCache = new Map();
let lastApiKey = null;

/**
 * Get a model instance with caching
 * @param {string} modelName - The model name
 * @returns {Object} - The model instance
 */
function getModel(modelName) {
  const apiKey = getApiKey();
  // If API key changed, clear cache
  if (lastApiKey !== apiKey) {
    modelCache.clear();
    lastApiKey = apiKey;
  }
  if (!modelCache.has(modelName) || modelCache.get(modelName)._apiKeyInvalid) {
    try {
      const genAI = getGenAI();
      if (modelName.includes('embedding')) {
        modelCache.set(modelName, genAI.getGenerativeModel({ model: modelName }));
      } else {
        // For content generation models
        modelCache.set(modelName, genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
          },
        }));
      }
      // Clear any invalid key flag
      if (modelCache.get(modelName)) {
        modelCache.get(modelName)._apiKeyInvalid = false;
      }
    } catch (error) {
      logger.error(`Error creating model instance for ${modelName}:`, error);
      throw error;
    }
  }
  return modelCache.get(modelName);
}

/**
 * Generate embeddings for text
 * @param {string} text - The text to embed
 * @param {string} modelName - Optional embedding model name
 * @returns {Promise<Object>} - The embedding result
 */
async function generateEmbeddings(text, modelName = null) {
  try {
    // Validate inputs
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a non-empty string');
    }
    
    // Ensure text doesn't exceed reasonable limits
    const truncatedText = text.length > 25000 ? text.substring(0, 25000) : text;
    if (text.length > 25000) {
      logger.warn(`Text truncated from ${text.length} to 25000 characters for embedding`);
    }
    
    // Monitor memory before embedding
    const memBefore = memoryManager.monitorMemory();
    logger.debug(`Memory before embedding generation: ${memBefore.heapUsedMB}MB`);
    
    // Use the specified model or default
    const embeddingModel = modelName || process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
    logger.debug(`Generating embeddings using model: ${embeddingModel}`);
    
    const model = getModel(embeddingModel);
    
    // Generate embeddings
    const result = await model.embedContent(truncatedText);
    const embedding = result.embedding.values;
    
    // Monitor memory after embedding
    const memAfter = memoryManager.monitorMemory();
    logger.debug(`Memory after embedding generation: ${memAfter.heapUsedMB}MB`);
    
    return {
      embedding,
      dimensions: embedding.length,
      model: embeddingModel
    };
  } catch (error) {
    logger.error('Error generating embeddings:', error);
    throw error;
  }
}

/**
 * Format chat history for the Gemini API
 * @param {Array} chatHistory - Array of chat messages 
 * @returns {Array} - Formatted chat history for Gemini API
 */
function formatChatHistory(chatHistory) {
  if (!chatHistory || !Array.isArray(chatHistory)) return [];
  
  return chatHistory.map(msg => {
    // Gemini only supports 'user' and 'model' roles
    // If 'system' role is encountered, convert to 'user'
    let role = msg.role;
    if (role === 'system') {
      logger.warn('System role detected in chat history - Gemini does not support system roles. Converting to user role.');
      role = 'user';
    }
    
    // Ensure content is a string
    let content = msg.content || '';
    if (typeof content !== 'string') {
      content = String(content);
    }
    
    // Create a properly formatted message part
    return {
      role: role === 'user' ? 'user' : 'model',
      parts: [{ text: content }],
      ...(msg.toolCalls && msg.toolCalls.length > 0 && {
        toolCalls: msg.toolCalls
      })
    };
  });
}

/**
 * Format tool for the Gemini API
 * @param {Object} tool - Tool definition
 * @returns {Object} - Formatted tool for Gemini API
 */
function formatToolForGemini(tool) {
  try {
    return {
      functionDeclarations: [{
        name: tool.name,
        description: tool.description || `Execute the ${tool.name} function`,
        parameters: {
          type: "OBJECT",
          properties: Object.entries(tool.parameters || {}).reduce((acc, [key, value]) => {
            acc[key] = {
              type: value.type?.toUpperCase() || "STRING",
              description: value.description || `Parameter ${key} for ${tool.name}`,
            };
            return acc;
          }, {})
        }
      }]
    };
  } catch (error) {
    logger.error(`Error formatting tool ${tool.name}:`, error);
    throw new Error(`Failed to format tool ${tool.name}: ${error.message}`);
  }
}

/**
 * Extract text from Gemini response
 * @param {Object} response - Response from Gemini API
 * @returns {string} - Extracted text content
 */
function extractTextFromResponse(response) {
  // Check if response is null or undefined
  if (!response) {
    logger.error('Response is null or undefined');
    return "";
  }
  
  // Case 1: Direct text property is a string (ideal case)
  if (response.text && typeof response.text === 'string') {
    return response.text.trim();
  }
  
  // Case 2: Response comes as parts with text
  if (response.parts && Array.isArray(response.parts) && response.parts.length > 0) {
    const part = response.parts[0];
    if (part && typeof part.text === 'string') {
      return part.text.trim();
    }
  }
  
  // Case 3: Character array response (indexed object) - seen in recent logs
  if (typeof response === 'object' && Object.keys(response).length > 10) {
    // Check if keys are sequential numbers (0, 1, 2...)
    const keys = Object.keys(response).filter(k => !isNaN(parseInt(k)));
    if (keys.length > 10) {
      try {
        // Sort keys as numbers and join the characters
        const chars = keys.sort((a, b) => parseInt(a) - parseInt(b))
                          .map(k => response[k])
                          .join('');
        
        if (chars.length > 0) {
          logger.info(`Extracted ${chars.length} characters from indexed response`);
          
          // Try to parse as JSON first (in case it's a JSON string)
          try {
            const parsed = JSON.parse(chars);
            if (parsed.candidates && parsed.candidates.length > 0) {
              const candidate = parsed.candidates[0];
              if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                const part = candidate.content.parts[0];
                if (part && part.text) {
                  logger.info('Successfully extracted text from parsed JSON candidates structure');
                  return part.text;
                }
              }
            }
          } catch (jsonErr) {
            // Not valid JSON or not in the expected format, just use the raw text
            logger.debug('Extracted text is not valid JSON or doesn\'t contain candidates structure');
          }
          
          // Return the raw extracted text if we couldn't parse as JSON
          return chars;
        }
      } catch (err) {
        logger.error('Error extracting characters from indexed response:', err);
      }
    }
  }
  
  // Case 4: Get text from any available field
  if (response.content && typeof response.content === 'string') {
    return response.content.trim();
  }
  
  // Last resort - try to convert whole response to string
  try {
    const responseStr = JSON.stringify(response);
    // Only use this if it's not too long
    if (responseStr.length > 20 && responseStr.length < 10000) {
      logger.warn('Using stringified response as fallback');
      return responseStr;
    }
  } catch (e) {
    logger.error('Error stringifying response:', e);
  }
  
  logger.error('Failed to extract text from response');
  return "";
}

/**
 * Process a function call response
 * @param {Object} response - Raw response from Gemini API
 * @returns {Object} - Formatted response with tool calls
 */
function processFunctionCallResponse(response) {
  // Extract function calls from response
  let functionCalls = response.functionCalls || [];
  
  // Get response text using the enhanced extraction function
  const responseText = extractTextFromResponse(response);
  
  // Check for tool calls in markdown code blocks if none are found directly
  if (functionCalls.length === 0 && responseText) {
    const toolCallMatches = responseText.match(/```(?:tool_code|tool|code)?\s*\n(listFiles.*?\(.*?\))|`{3}(?:.*?)\n(.*?listFiles.*?\(.*?\))/gs);
    
    if (toolCallMatches) {
      logger.info('Found tool calls in markdown code blocks:', toolCallMatches);
      
      // Extract tool calls from matched code blocks
      toolCallMatches.forEach(match => {
        // Extract the function name and arguments
        const toolCallMatch = match.match(/(\w+)(?:Files\w+)\((\s*\w+\s*=\s*["'].*?["']\s*)\)/);
        if (toolCallMatch) {
          const functionName = toolCallMatch[0].split('(')[0].trim();
          // Parse parameters - this is simplified; in a real implementation, you'd want more robust parsing
          const paramsStr = toolCallMatch[2] || '';
          const params = {};
          
          // Extract key-value pairs from the parameters string
          const paramMatches = paramsStr.matchAll(/(\w+)\s*=\s*["'](.*?)["']/g);
          for (const paramMatch of paramMatches) {
            params[paramMatch[1]] = paramMatch[2];
          }
          
          functionCalls.push({
            name: functionName,
            args: params,
            id: `synthetic-call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
          });
          
          logger.info(`Extracted tool call from code block: ${functionName}`, params);
        }
      });
    }
    
    // Also look for explicit tool call patterns in text
    const explicitToolCallMatch = responseText.match(/tool_code\s*\n(listFiles.*?\(.*?\))/);
    if (explicitToolCallMatch && explicitToolCallMatch[1]) {
      const functionName = explicitToolCallMatch[1].split('(')[0].trim();
      const paramsStr = explicitToolCallMatch[1].match(/\((.*?)\)/)?.[1] || '';
      
      // Extract parameters
      const params = {};
      const paramMatches = paramsStr.matchAll(/(\w+)\s*=\s*["'](.*?)["']/g);
      for (const paramMatch of paramMatches) {
        params[paramMatch[1]] = paramMatch[2];
      }
      
      functionCalls.push({
        name: functionName,
        args: params,
        id: `explicit-call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      });
      
      logger.info(`Extracted explicit tool call: ${functionName}`, params);
    }
  }
  
  // Format tool calls for consistent interface
  const toolCalls = functionCalls.map(call => ({
    toolCallId: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    toolName: call.name,
    parameters: call.args || {}
  }));
  
  // Log for debugging
  if (toolCalls.length > 0) {
    logger.info(`Processed ${toolCalls.length} tool calls from response`);
  }
  
  // Return formatted response with both content and text properties for frontend compatibility
  return {
    role: 'assistant',
    content: responseText,
    text: responseText,
    toolCalls,
    timestamp: new Date().toISOString(),
    model: "gemini-2.0-flash", // Default model
    usage: {
      promptTokens: -1, // Not available from Gemini API
      completionTokens: -1, // Not available from Gemini API
      totalTokens: -1 // Not available from Gemini API
    }
  };
}

/**
 * Send a message to the LLM and get a response
 * @param {Object} params - Parameters for the LLM call
 * @param {string} params.message - User message
 * @param {Array} params.chatHistory - Chat history
 * @param {string} params.model - Model name
 * @param {number} params.temperature - Temperature (0-1)
 * @param {number} params.maxTokens - Maximum tokens to generate
 * @param {Array} params.tools - Tool definitions
 * @returns {Promise<Object>} - The LLM response
 */
async function chat(params) {
  try {
    const {
      message,
      chatHistory = [],
      model = DEFAULT_LLM_MODEL,
      temperature = 0.7,
      maxTokens = 1024,
      tools = []
    } = params;
    
    // Validate inputs
    if (!message || typeof message !== 'string') {
      throw new Error('Invalid message: Must provide a non-empty string message');
    }
    
    // Check API key first to avoid making API calls with invalid keys
    const apiKey = getApiKey();
    if (!apiKey) {
      logger.error('No Google API key found in environment variables');
      throw new Error('Google API key is not configured. Please set GOOGLE_API_KEY in your environment variables.');
    }
    
    // Validate API key format (basic validation, not perfect but catches some issues)
    if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
      logger.error('Google API key has invalid format');
      throw new Error('Google API key appears to be invalid. The key should start with "AIza" and be at least 30 characters long.');
    }
    
    logger.info(`Sending chat request to model: ${model}`);
    
    // If tools are provided, log them
    if (tools && tools.length > 0) {
      logger.info(`Request includes ${tools.length} tools`);
    }
    
    // Create a new genAI instance with the current API key to ensure we're using the latest key
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Get the model with the current API key
    const genModel = genAI.getGenerativeModel({
      model: model,
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: maxTokens,
        topP: 0.9,
        topK: 40
      }
    });
    
    // Prepare the chat history
    const formattedHistory = formatChatHistory(chatHistory);
    
    // Log memory usage before making API call
    const memoryBefore = process.memoryUsage();
    logger.info(`Memory before LLM API call: ${(memoryBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    
    // Create a formatted tools array if tools are provided
    let toolsConfig = undefined;
    
    if (tools && tools.length > 0) {
      try {
        // Log tool names to help with debugging
        const toolNames = tools.map(tool => tool.name);
        logger.info(`Sending request with ${tools.length} tools: ${toolNames.join(', ')}`);
        
        // Convert tools to the format expected by the Gemini API
        toolsConfig = tools.map(formatToolForGemini);
      } catch (toolError) {
        logger.error('Error formatting tools for Gemini:', toolError);
        throw new Error(`Error formatting tools: ${toolError.message}`);
      }
    }
    
    try {
      // Make the API call with proper error handling
      const chatSession = genModel.startChat({
        history: formattedHistory
      });
      
      const result = await chatSession.sendMessage(message, {
        tools: toolsConfig,
      });
      
      // Log memory usage after making API call
      const memoryAfter = process.memoryUsage();
      logger.info(`Memory after LLM API call: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      
      // Check if result is valid
      if (!result || !result.response) {
        logger.error('Invalid or empty response from LLM');
        throw new Error('Received invalid or empty response from LLM');
      }
      
      // Log the raw response for debugging
      logger.debug('Raw LLM response received:', JSON.stringify(result.response, null, 2).substring(0, 500) + '...');
      
      // Parse and process the response
      if (result.response) {
        // Check for function calls
        if (result.response.functionCalls && result.response.functionCalls.length > 0) {
          return processFunctionCallResponse(result.response);
        } else {
          // Extract text using the enhanced function
          const responseText = extractTextFromResponse(result.response);
          
          // Ensure responseText is not empty
          if (!responseText) {
            logger.warn('Empty text in LLM response, using placeholder');
            return {
              role: 'assistant',
              text: "I processed your request but couldn't generate a response. Please try again.",
              content: "I processed your request but couldn't generate a response. Please try again.",
              timestamp: new Date().toISOString()
            };
          }
          
          // Format the response consistently with what the frontend expects
          return {
            role: 'assistant',
            text: responseText,
            content: responseText, // Add content property for frontend compatibility
            timestamp: new Date().toISOString()
          };
        }
      } else {
        throw new Error('Empty or invalid response from LLM');
      }
    } catch (apiError) {
      // Handle specific API errors
      if (apiError.message.includes('PERMISSION_DENIED') || 
          apiError.message.includes('UNAUTHENTICATED') || 
          apiError.message.includes('API key')) {
        logger.error('API key authentication failed. Please check your GOOGLE_API_KEY.');
        throw new Error('Google API key is invalid or has insufficient permissions. Please check your GOOGLE_API_KEY value and make sure it has access to the Gemini API, including function calling capabilities.');
      } 
      else if (apiError.message.includes('RESOURCE_EXHAUSTED')) {
        logger.error('Rate limit or quota exceeded on Google API key.');
        throw new Error('Your Google API quota has been exhausted. Please wait a while before trying again or use a different API key.');
      }
      else if (apiError.message.includes('MODEL_NOT_FOUND')) {
        logger.error(`Model "${model}" not found. Check model name or API key permissions.`);
        throw new Error(`The requested model "${model}" was not found or your API key doesn't have access to it. Try a different model or check your API key permissions.`);
      }
      else if (apiError.message.includes('safety')) {
        logger.error('Content filtered due to safety settings.');
        throw new Error('Your request was blocked by content safety systems. Please modify your prompt and try again.');
      }
      else {
        // Re-throw other errors
        logger.error('Error in LLM request:', apiError);
        throw apiError;
      }
    }
  } catch (error) {
    logger.error('Error in LLM chat:', error);
    throw error;
  }
}

/**
 * Execute a tool call
 * @param {Object} params - Tool call parameters
 * @param {string} params.toolCallId - Tool call ID
 * @param {string} params.toolName - Tool name
 * @param {Object} params.parameters - Tool parameters
 * @returns {Promise<Object>} - Tool execution result
 */
async function executeToolCall(params) {
  try {
    const { toolCallId, toolName, parameters } = params;
    
    // Validate inputs
    if (!toolName) {
      throw new Error('Tool name is required');
    }
    
    logger.info(`Executing tool call: ${toolName}`, { toolCallId });
    
    // Get the tools service
    const toolsService = require('./tools');
    
    // Execute the tool
    const result = await toolsService.executeTool(toolName, parameters);
    
    return {
      toolCallId,
      toolName,
      result
    };
  } catch (error) {
    logger.error(`Error executing tool call ${params.toolName}:`, error);
    throw error;
  }
}

/**
 * Check if the API key is valid
 * @returns {Promise<boolean>} - Whether the API key is valid
 */
async function checkApiKey() {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      logger.warn('GOOGLE_API_KEY not found in environment variables');
      return false;
    }
    
    // Try a simple embedding to verify the API key
    await generateEmbeddings('test');
    logger.info('API key validation successful');
    return true;
  } catch (error) {
    logger.error('API key validation failed:', error);
    return false;
  }
}

module.exports = {
  generateEmbeddings,
  chat,
  executeToolCall,
  checkApiKey
}; 