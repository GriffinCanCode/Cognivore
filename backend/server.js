// Backend server for Knowledge Store with Gemini 2.5 Flash integration
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const { app: electronApp, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { logger, createContextLogger } = require('./src/utils/logger');

// Load environment variables
dotenv.config();

// Services
const toolsService = require('./src/services/tools');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Define API_UNAVAILABLE flag at the top with other variables
let GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
let API_UNAVAILABLE = false; // Initialize as false, will set to true if there are issues

// Check for API key at startup
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('\x1b[31m%s\x1b[0m', '⚠️ ERROR: GOOGLE_API_KEY environment variable not set!');
  console.error('\x1b[31m%s\x1b[0m', 'You must set a valid Google AI API key to use Gemini features.');
  console.error('\x1b[33m%s\x1b[0m', 'Add the key to your .env file: GOOGLE_API_KEY=your_api_key');
  console.error('\x1b[33m%s\x1b[0m', 'Get an API key from: https://ai.google.dev/\n');
} else {
  // Basic validation of API key format (AIza... format for Google API keys)
  if (!apiKey.startsWith('AIza')) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️ WARNING: Your API key does not start with "AIza".');
    console.warn('\x1b[33m%s\x1b[0m', 'This may not be a valid Google AI API key. Check the key format.');
  } else {
    console.log('Google API key found (' + apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4) + ')');
  }
}

// Environment variables
// Use gemini-2.0-flash
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-2.0-flash';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-005';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Log the model being used and API key status
console.log(`Using LLM model: ${LLM_MODEL}`);
console.log(`API key ${GOOGLE_API_KEY ? 'is' : 'is NOT'} set`);

// Configure CORS to allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Set Content Security Policy headers
app.use((req, res, next) => {
  // In development, allow 'unsafe-eval' for hot reloading and dev tools
  // In production, use stricter policy
  const scriptSrc = NODE_ENV === 'development' 
    ? "'self' 'unsafe-eval'" 
    : "'self'";
  
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.googleapis.com`
  );
  next();
});

// Body parser middleware
app.use(bodyParser.json());

// Initialize Google Generative AI if API key is available
let genAI;
if (GOOGLE_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    // Verify API key works by making a simple call
    genAI.getGenerativeModel({ model: 'gemini-1.0-pro-latest' });
    console.log('Successfully initialized Google Generative AI client');
  } catch (error) {
    console.error('Error initializing Google Generative AI:', error.message);
    console.error('The API key might be invalid or there might be network issues.');
    // Set the API unavailable flag
    API_UNAVAILABLE = true;
  }
} else {
  console.error('GOOGLE_API_KEY is not set. LLM functionality will not work!');
  console.error('Please create a .env file in the backend directory with GOOGLE_API_KEY=your_api_key');
  // Set the API unavailable flag
  API_UNAVAILABLE = true;
}

// Add a helper function to check if the API is available
function isApiAvailable() {
  return !!genAI && !API_UNAVAILABLE;
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Configuration controller for exposing settings to frontend
const configController = {
  getConfig(req, res) {
    try {
      // Only expose non-sensitive configuration
      const config = {
        llmModel: LLM_MODEL,
        embeddingModel: EMBEDDING_MODEL,
        serverVersion: '1.0.0'
      };
      
      return res.json(config);
    } catch (error) {
      console.error('Error fetching config:', error);
      return res.status(500).json({ 
        message: 'Failed to fetch configuration',
        error: error.message 
      });
    }
  }
};

// LLM controller for handling Gemini API interactions
const llmController = {
  async chat(req, res) {
    try {
      const { message, chatHistory, model, temperature, maxTokens, tools } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: 'Message is required' });
      }
      
      const modelId = model || LLM_MODEL;
      const genModel = genAI.getGenerativeModel({
        model: modelId,
        tools: tools || [],
        generationConfig: {
          temperature: temperature || 0.7,
          maxOutputTokens: maxTokens || 1024,
          topP: 0.9,
          topK: 40,
        },
      });
      
      // Format the chat history for the Gemini API
      const formattedHistory = chatHistory?.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }],
        // Include tool calls if available
        ...(msg.toolCalls && {
          toolCalls: msg.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            args: tc.args
          }))
        })
      })) || [];
      
      // Create a chat session
      const chat = genModel.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: temperature || 0.7,
          maxOutputTokens: maxTokens || 1024,
          topP: 0.9,
          topK: 40,
        },
      });
      
      // Generate a response
      const result = await chat.sendMessage(message);
      const response = result.response;
      
      // Process the response
      const responseText = response.text();
      
      // Check if there are any tool calls
      let toolCalls = [];
      
      // Try to extract function calls from candidates if they exist
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          // Look through all parts for function calls
          toolCalls = candidate.content.parts.flatMap(part => {
            if (part.functionCall) {
              return [{
                id: Date.now().toString(),
                name: part.functionCall.name,
                args: part.functionCall.args
              }];
            }
            return [];
          });
        }
      }
      
      // If no tool calls found, check older response format (functionCalls)
      if (toolCalls.length === 0 && response.functionCalls && response.functionCalls.length > 0) {
        toolCalls = response.functionCalls.map(call => ({
          id: Date.now().toString(),
          name: call.name,
          args: call.args || {}
        }));
      }
      
      // Log for debugging
      if (toolCalls.length > 0) {
        console.log(`Found ${toolCalls.length} tool calls in response`, toolCalls);
      } else if (responseText.includes('searchKnowledgeBase') || responseText.includes('getItemContent')) {
        console.warn('Response text contains tool references but no tool calls were properly extracted');
      }
      
      // Return the response
      return res.json({
        text: responseText,
        toolCalls: toolCalls,
        model: modelId
      });
    } catch (error) {
      console.error('Error in chat endpoint:', error);
      return res.status(500).json({ 
        message: 'Failed to generate response',
        error: error.message 
      });
    }
  },
  
  async executeToolCall(req, res) {
    try {
      const { toolCallId, toolName, parameters } = req.body;
      
      if (!toolName) {
        return res.status(400).json({ message: 'Tool name is required' });
      }
      
      // Execute the appropriate tool based on toolName
      let toolResponse;
      
      switch (toolName) {
        case 'searchKnowledgeBase':
          toolResponse = await knowledgeController.search(parameters.query, parameters.filters);
          break;
          
        case 'getItemContent':
          toolResponse = await knowledgeController.getItemById(parameters.itemId);
          break;
          
        case 'summarizeContent':
          toolResponse = await llmController.summarize(parameters.content, parameters.length);
          break;
          
        case 'listAllFiles':
          toolResponse = await knowledgeController.listItems(parameters.limit, parameters.sortBy, parameters.sortDirection);
          break;
          
        case 'listFilesByType':
          toolResponse = await knowledgeController.listItemsByType(parameters.fileType, parameters.limit, parameters.sortBy, parameters.sortDirection);
          break;
          
        case 'listFilesWithContent':
          toolResponse = await knowledgeController.listItemsWithContent(parameters.contentQuery, parameters.fileType, parameters.limit);
          break;
          
        case 'listRecentFiles':
          toolResponse = await knowledgeController.listRecentItems(parameters.days, parameters.fileType, parameters.limit);
          break;
          
        case 'queryDatabase':
          toolResponse = await toolsService.queryDatabase(parameters);
          break;
          
        default:
          return res.status(400).json({ message: `Unknown tool: ${toolName}` });
      }
      
      return res.json({
        toolCallId,
        toolName,
        response: toolResponse
      });
    } catch (error) {
      console.error('Error executing tool call:', error);
      return res.status(500).json({ 
        message: 'Failed to execute tool call',
        error: error.message 
      });
    }
  },
  
  async generateEmbeddings(req, res) {
    try {
      const { text, model } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: 'Text is required' });
      }
      
      const embeddingModel = genAI.getGenerativeModel({
        model: model || EMBEDDING_MODEL
      });
      
      const result = await embeddingModel.embedContent(text);
      const embedding = result.embedding.values;
      
      return res.json({
        embedding
      });
    } catch (error) {
      console.error('Error generating embeddings:', error);
      return res.status(500).json({ 
        message: 'Failed to generate embeddings',
        error: error.message 
      });
    }
  },
  
  async summarize(content, length = 'medium') {
    try {
      if (!content) {
        throw new Error('Content is required for summarization');
      }
      
      const model = genAI.getGenerativeModel({
        model: LLM_MODEL,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      });
      
      const lengthInstructions = {
        short: 'Summarize this content in 2-3 sentences.',
        medium: 'Provide a concise summary of this content in a paragraph.',
        long: 'Create a detailed summary of this content with key points and insights.'
      };
      
      const prompt = `${lengthInstructions[length] || lengthInstructions.medium}\n\nContent: ${content}`;
      
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Error in summarization:', error);
      throw error;
    }
  }
};

// Knowledge controller for handling knowledge base operations
const knowledgeController = {
  async search(query, filters = {}) {
    // This would connect to your database or vector store
    // Mocked for this example
    return {
      results: [
        { id: '1', title: 'Example result 1', snippet: 'This is a snippet from result 1...' },
        { id: '2', title: 'Example result 2', snippet: 'This is a snippet from result 2...' }
      ],
      query,
      filters
    };
  },
  
  async getItemById(itemId) {
    // This would fetch the item from your database
    // Mocked for this example
    return {
      id: itemId,
      title: 'Example Item',
      content: 'This is the full content of the example item...',
      sourceType: 'text',
      dateAdded: new Date().toISOString()
    };
  },

  async listItems(limit = 20, sortBy = 'created_at', sortDirection = 'desc') {
    try {
      // Get the database service
      const database = require('./src/services/database');
      
      // List all items with the given parameters
      const items = await database.listItems(limit, sortBy, sortDirection);
      
      return {
        success: true,
        items: items || []
      };
    } catch (error) {
      console.error('Error listing items:', error);
      return {
        success: false,
        error: error.message,
        items: []
      };
    }
  },
  
  async listItemsByType(fileType, limit = 20, sortBy = 'created_at', sortDirection = 'desc') {
    try {
      // Get the database service
      const database = require('./src/services/database');
      
      // List items by type with the given parameters
      const items = await database.listItemsByType(fileType, limit, sortBy, sortDirection);
      
      return {
        success: true,
        items: items || [],
        fileType
      };
    } catch (error) {
      console.error(`Error listing items by type ${fileType}:`, error);
      return {
        success: false,
        error: error.message,
        items: []
      };
    }
  },
  
  async listItemsWithContent(contentQuery, fileType = null, limit = 10) {
    try {
      // Get the database service
      const database = require('./src/services/database');
      
      // List items containing the given content query
      const items = await database.searchItems(contentQuery, fileType, limit);
      
      return {
        success: true,
        items: items || [],
        query: contentQuery
      };
    } catch (error) {
      console.error(`Error listing items with content "${contentQuery}":`, error);
      return {
        success: false,
        error: error.message,
        items: []
      };
    }
  },
  
  async listRecentItems(days = 7, fileType = null, limit = 10) {
    try {
      // Get the database service
      const database = require('./src/services/database');
      
      // Calculate the date range (last X days)
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - days);
      
      // List items created in the last X days
      const items = await database.listItemsByDate(
        startDate.toISOString(), 
        today.toISOString(), 
        fileType, 
        limit
      );
      
      return {
        success: true,
        items: items || [],
        days
      };
    } catch (error) {
      console.error(`Error listing recent items (last ${days} days):`, error);
      return {
        success: false,
        error: error.message,
        items: []
      };
    }
  }
};

// Set up IPC handlers for Electron
function setupIpcHandlers() {
  if (!ipcMain) {
    console.warn('ipcMain is not available, skipping IPC setup');
    return;
  }

  // Check which handlers are already registered to avoid duplicates
  const safelyRegisterHandler = (channel, handler) => {
    try {
      // Attempt to register the handler
      ipcMain.handle(channel, handler);
      console.log(`Registered IPC handler for: ${channel}`);
    } catch (error) {
      // If it fails because the handler already exists, log it but don't fail
      if (error.message && error.message.includes('Attempted to register a second handler')) {
        console.log(`Handler for ${channel} already registered, skipping`);
      } else {
        // For other errors, rethrow
        throw error;
      }
    }
  };

  // Define and register handlers only if they don't exist
  // Note: These are considered secondary/fallback handlers if ipcHandlers.js hasn't registered them

  // Health check - only used if not already registered by main.js or ipcHandlers.js
  safelyRegisterHandler('check-health', async () => {
    return { status: 'ok', version: '1.0.0' };
  });

  // Config - only used if not already registered
  safelyRegisterHandler('get-config', async () => {
    return {
      llmModel: LLM_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      serverVersion: '1.0.0'
    };
  });

  // Create a context-specific logger for the chat handler
  const chatLogger = createContextLogger('ChatHandler');

  // Chat - only used if not already registered
  safelyRegisterHandler('chat', async (event, args) => {
    try {
      chatLogger.info('Chat request received', { 
        messagePreview: args.message?.substring(0, 100) + '...',
        model: args.model,
        historyLength: args.chatHistory?.length || 0
      });
      
      // First check if API is available
      if (!isApiAvailable()) {
        chatLogger.error('Google API key missing or invalid');
        throw new Error('Google API key is missing or invalid. Please add a valid API key to your .env file or config.json and restart the application.');
      }
      
      const { message, chatHistory, model, temperature, maxTokens, tools } = args;
      
      const modelId = model || LLM_MODEL;
      chatLogger.debug('Using model', { modelId, temperature, maxTokens });
      
      const genModel = genAI.getGenerativeModel({
        model: modelId,
        tools: tools || [],
        generationConfig: {
          temperature: temperature || 0.7,
          maxOutputTokens: maxTokens || 1024,
          topP: 0.9,
          topK: 40,
        },
      });
      
      // Format the chat history for the Gemini API
      const formattedHistory = chatHistory?.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }],
        // Include tool calls if available
        ...(msg.toolCalls && {
          toolCalls: msg.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            args: tc.args
          }))
        })
      })) || [];
      
      chatLogger.debug('Formatted chat history', { 
        historyLength: formattedHistory.length,
        roles: formattedHistory.map(msg => msg.role)
      });
      
      // Create a chat session
      const chat = genModel.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: temperature || 0.7,
          maxOutputTokens: maxTokens || 1024,
          topP: 0.9,
          topK: 40,
        },
      });
      
      chatLogger.info('Sending message to Gemini API');
      
      // Generate a response
      const result = await chat.sendMessage(message);
      const response = result.response;
      
      chatLogger.debug('Received raw response from Gemini', { 
        responseType: typeof response,
        hasResponse: !!response
      });
      
      // Process the response
      const responseText = await response.text();
      
      chatLogger.debug('Extracted response text', { 
        textLength: responseText?.length,
        preview: responseText?.substring(0, 100) + '...'
      });
      
      // Check if there are any tool calls
      let toolCalls = [];
      if (response.candidates && response.candidates[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        for (const part of parts) {
          if (part.functionCall || part.toolCall) {
            const call = part.functionCall || part.toolCall;
            toolCalls.push({
              name: call.name,
              toolCallId: call.id || `call-${Date.now()}-${toolCalls.length}`,
              args: call.args || call.arguments || {}
            });
          }
        }
      }
      
      if (toolCalls.length > 0) {
        chatLogger.info('Found tool calls in response', { 
          count: toolCalls.length,
          tools: toolCalls.map(t => t.name)
        });
      }
      
      // Return formatted response
      const formattedResponse = {
        role: 'assistant',
        content: responseText,
        text: responseText,
        timestamp: new Date().toISOString(),
        ...(toolCalls.length > 0 && { toolCalls })
      };
      
      chatLogger.info('Sending formatted response', {
        role: formattedResponse.role,
        contentLength: formattedResponse.content?.length,
        hasToolCalls: toolCalls.length > 0,
        timestamp: formattedResponse.timestamp
      });
      
      return formattedResponse;
    } catch (error) {
      chatLogger.error('Error in chat handler', { 
        error: error.message,
        stack: error.stack
      });
      return {
        error: true,
        message: error.message,
        stack: error.stack
      };
    }
  });

  // Execute tool call - only used if not already registered
  safelyRegisterHandler('execute-tool-call', async (event, args) => {
    const { toolCallId, toolName, parameters } = args;
    
    // Execute the appropriate tool based on toolName
    let toolResponse;
    
    switch (toolName) {
      case 'searchKnowledgeBase':
        toolResponse = await knowledgeController.search(parameters.query, parameters.filters);
        break;
        
      case 'getItemContent':
        toolResponse = await knowledgeController.getItemById(parameters.itemId);
        break;
        
      case 'summarizeContent':
        toolResponse = await llmController.summarize(parameters.content, parameters.length);
        break;
        
      case 'listAllFiles':
        toolResponse = await knowledgeController.listItems(parameters.limit, parameters.sortBy, parameters.sortDirection);
        break;
        
      case 'listFilesByType':
        toolResponse = await knowledgeController.listItemsByType(parameters.fileType, parameters.limit, parameters.sortBy, parameters.sortDirection);
        break;
        
      case 'listFilesWithContent':
        toolResponse = await knowledgeController.listItemsWithContent(parameters.contentQuery, parameters.fileType, parameters.limit);
        break;
        
      case 'listRecentFiles':
        toolResponse = await knowledgeController.listRecentItems(parameters.days, parameters.fileType, parameters.limit);
        break;
        
      case 'queryDatabase':
        toolResponse = await toolsService.queryDatabase(parameters);
        break;
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
    
    return {
      toolCallId,
      toolName,
      response: toolResponse
    };
  });

  // Generate embeddings - only used if not already registered
  safelyRegisterHandler('generate-embeddings', async (event, args) => {
    const { text, model } = args;
    
    const embeddingModel = genAI.getGenerativeModel({
      model: model || EMBEDDING_MODEL
    });
    
    const result = await embeddingModel.embedContent(text);
    const embedding = result.embedding.values;
    
    return {
      embedding
    };
  });

  console.log('IPC handlers initialized (server.js fallbacks only if needed)');
}

// API Routes
app.post('/api/llm/chat', llmController.chat);
app.post('/api/llm/execute-tool', llmController.executeToolCall);
app.post('/api/llm/embeddings', llmController.generateEmbeddings);
app.get('/api/llm/config', configController.getConfig);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Catch-all route handler for 404s
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Function to check if a port is in use
const isPortInUse = async (port) => {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    
    // Add timeout to avoid hanging
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        console.error(`Error checking port ${port}:`, err.message);
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    // Add timeout to the port check
    server.on('error', (err) => {
      console.error(`Unexpected error checking port ${port}:`, err.message);
    });
    
    try {
      server.listen(port);
      // Add timeout to avoid hanging indefinitely
      setTimeout(() => {
        try {
          server.close();
          resolve(false);
        } catch (err) {
          console.error(`Error closing test server on port ${port}:`, err.message);
          resolve(false);
        }
      }, 1000);
    } catch (err) {
      console.error(`Exception when checking port ${port}:`, err.message);
      resolve(false);
    }
  });
};

// Function to attempt to kill a process using a specific port
const killProcessOnPort = async (port) => {
  try {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      // Find the process ID using the port
      const findCmd = process.platform === 'win32' 
        ? `netstat -ano | findstr :${port} | findstr LISTENING` 
        : `lsof -i :${port} | grep LISTEN | awk '{print $2}'`;
      
      exec(findCmd, (err, stdout) => {
        if (err || !stdout) {
          console.log(`No process found on port ${port}`);
          resolve(false);
          return;
        }
        
        // Extract PID and kill process
        let pid;
        if (process.platform === 'win32') {
          // Windows netstat output parsing
          const match = stdout.match(/\s+(\d+)$/m);
          pid = match ? match[1].trim() : null;
        } else {
          // Unix lsof output parsing
          pid = stdout.trim().split('\n')[0];
        }
        
        if (!pid) {
          console.log('Failed to extract PID');
          resolve(false);
          return;
        }
        
        console.log(`Found process ${pid} using port ${port}, attempting to terminate...`);
        
        // Kill the process
        const killCmd = process.platform === 'win32' 
          ? `taskkill /F /PID ${pid}` 
          : `kill -9 ${pid}`;
          
        exec(killCmd, (killErr) => {
          if (killErr) {
            console.log(`Failed to kill process on port ${port}: ${killErr.message}`);
            resolve(false);
          } else {
            console.log(`Successfully terminated process ${pid} on port ${port}`);
            resolve(true);
          }
        });
      });
    });
  } catch (error) {
    console.error(`Error killing process on port ${port}:`, error);
    return false;
  }
};

// Start server with automatic port handling
const startServer = async () => {
  let currentPort = PORT;
  const maxRetries = 5; // Increased from 3 to 5
  let retryCount = 0;
  let server = null;
  
  while (retryCount < maxRetries) {
    console.log(`Attempting to start server on port ${currentPort} (attempt ${retryCount + 1}/${maxRetries})...`);
    
    try {
      // Check if port is in use
      const portInUse = await isPortInUse(currentPort);
      
      if (portInUse) {
        console.log(`Port ${currentPort} is already in use`);
        
        // Try to kill the process using the port
        const killed = await killProcessOnPort(currentPort);
        
        if (killed) {
          console.log(`Successfully freed port ${currentPort}, attempting to start server`);
          // Give OS a moment to release the port
          await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 1000ms to 2000ms
          
          // Double-check the port is now free
          const stillInUse = await isPortInUse(currentPort);
          if (stillInUse) {
            console.log(`Port ${currentPort} is still in use despite kill attempt, trying alternative port`);
            retryCount++;
            currentPort = PORT + retryCount;
            continue;
          }
        } else {
          // If we couldn't kill it, try another port
          retryCount++;
          currentPort = PORT + retryCount;
          console.log(`Trying alternative port: ${currentPort}`);
          continue;
        }
      }
      
      // Attempt to start the server
      server = app.listen(currentPort);
      
      // Add event handlers for server errors
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${currentPort} is in use, trying another port`);
          retryCount++;
          currentPort = PORT + retryCount;
          // Continue with the next iteration
        } else {
          console.error(`Server error on port ${currentPort}:`, err);
        }
      });
      
      // If we reach here, server started successfully
      console.log(`Server successfully started on port ${currentPort}`);
      console.log(`API available at http://localhost:${currentPort}/api`);
      console.log(`Using LLM model: ${LLM_MODEL}`);
      
      // Set up IPC handlers if running in Electron environment
      setupIpcHandlers();
      
      break; // Exit the loop if server started successfully
    } catch (error) {
      console.error(`Failed to start server on port ${currentPort}:`, error);
      retryCount++;
      currentPort = PORT + retryCount;
    }
  }
  
  if (!server) {
    console.error(`Failed to start server after ${maxRetries} attempts`);
    return null;
  }
  
  // Handle server shutdown gracefully
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('Server shut down successfully');
      process.exit(0);
    });
    
    // Force exit if server doesn't close gracefully
    setTimeout(() => {
      console.error('Server did not shut down gracefully, forcing exit');
      process.exit(1);
    }, 5000);
  });
  
  return server;
};

// Start the server with port conflict handling
const server = startServer();

// Initialize IPC handlers when running in Electron
if (module.parent) {
  // This will be true when the file is required by another module (Electron main process)
  setupIpcHandlers();
}

module.exports = app; 