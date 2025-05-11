/**
 * LLM Service for backend
 * Handles Google Gemini model interactions
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { createContextLogger } = require('../utils/logger');
const config = require('../config');
const { memoryManager } = require('../memory');

const logger = createContextLogger('LLMService');

// Initialize Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Default fallback models
const DEFAULT_LLM_MODEL = 'gemini-2.0-flash';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-005';

// Cache for model instances to avoid recreating them
const modelCache = new Map();

/**
 * Get a model instance with caching
 * @param {string} modelName - The model name
 * @returns {Object} - The model instance
 */
function getModel(modelName) {
  if (!modelCache.has(modelName)) {
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
      throw new Error('Invalid input: message must be a non-empty string');
    }
    
    logger.info(`Sending chat request to model: ${model}`);
    
    // Monitor memory before API call
    const memBefore = memoryManager.monitorMemory();
    logger.debug(`Memory before LLM API call: ${memBefore.heapUsedMB}MB`);
    
    // Format chat history for the API
    const formattedHistory = chatHistory.map(msg => {
      // Gemini only supports 'user' and 'model' roles
      // If 'system' role is encountered, log a warning and treat it as 'user'
      let role = msg.role;
      if (role === 'system') {
        logger.warn('System role detected in chat history - Gemini does not support system roles. Converting to user role.');
        role = 'user';
      }
      
      return {
        role: role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
        ...(msg.toolCalls && msg.toolCalls.length > 0 && {
          toolCalls: msg.toolCalls
        })
      };
    });
    
    // Prepare generation config
    const generationConfig = {
      temperature,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: maxTokens,
    };
    
    // Get the model
    const genModel = getModel(model);
    
    // Create chat session
    const chat = genModel.startChat({
      history: formattedHistory,
      generationConfig,
      tools: tools.length > 0 ? { tools } : undefined
    });
    
    // Send message and get response
    const result = await chat.sendMessage(message);
    const response = result.response;
    
    // Process response
    const responseText = response.text();
    const toolCalls = response.functionCalls || [];
    
    // Monitor memory after API call
    const memAfter = memoryManager.monitorMemory();
    logger.debug(`Memory after LLM API call: ${memAfter.heapUsedMB}MB`);
    
    // Format response
    return {
      content: responseText,
      toolCalls: toolCalls.map(call => ({
        toolCallId: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        toolName: call.name,
        parameters: call.args
      })),
      model,
      usage: {
        promptTokens: -1, // Not available from Gemini API
        completionTokens: -1, // Not available from Gemini API
        totalTokens: -1 // Not available from Gemini API
      }
    };
  } catch (error) {
    logger.error('Error in LLM chat:', error);
    
    // Enhance error message with more helpful information
    if (error.message.includes('API key not found')) {
      throw new Error('Google API key is missing. Please add GOOGLE_API_KEY to your environment variables.');
    } else if (error.message.includes('API key not valid')) {
      throw new Error('Google API key is invalid. Please check your GOOGLE_API_KEY value.');
    } else if (error.message.includes('not found for API version') || error.message.includes('not supported')) {
      throw new Error(`The model "${params.model}" is not available. Please use a supported model like "gemini-2.0-flash".`);
    } else if (error.message.includes('system role is not supported')) {
      throw new Error('The Gemini model does not support system roles. Please modify the frontend code to use only user and model roles.');
    }
    
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