// Backend server for Knowledge Store with Gemini 2.5 Flash integration
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const { app: electronApp, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Check for API key in various locations
let GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// If API key isn't in environment variables, check for a .env file in various locations
if (!GOOGLE_API_KEY) {
  const possibleEnvLocations = [
    './.env',
    '../.env',
    './backend/.env',
    path.join(__dirname, '.env')
  ];
  
  for (const envPath of possibleEnvLocations) {
    try {
      if (fs.existsSync(envPath)) {
        console.log(`Found .env file at ${envPath}`);
        // Parse .env file manually if needed
        const envContent = fs.readFileSync(envPath, 'utf8');
        const apiKeyMatch = envContent.match(/GOOGLE_API_KEY=(.+)/);
        if (apiKeyMatch && apiKeyMatch[1]) {
          GOOGLE_API_KEY = apiKeyMatch[1].trim();
          console.log('Loaded API key from .env file');
          break;
        }
      }
    } catch (error) {
      console.warn(`Error checking .env at ${envPath}:`, error.message);
    }
  }
}

// If API key is still not set, look for it in config.json
if (!GOOGLE_API_KEY) {
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.googleApiKey) {
        GOOGLE_API_KEY = config.googleApiKey;
        console.log('Loaded API key from config.json');
      }
    }
  } catch (error) {
    console.warn('Error loading API key from config.json:', error.message);
  }
}

// Environment variables
// Use gemini-2.0-flash
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-2.0-flash';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'embedding-001';
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
  genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
} else {
  console.error('GOOGLE_API_KEY is not set. LLM functionality will not work!');
  console.error('Please create a .env file in the backend directory with GOOGLE_API_KEY=your_api_key');
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
      const toolCalls = response.candidates?.[0]?.content?.parts?.flatMap(part => 
        part.functionCall ? [{
          id: Date.now().toString(),
          name: part.functionCall.name,
          args: part.functionCall.args
        }] : []
      ) || [];
      
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

  // Chat - only used if not already registered
  safelyRegisterHandler('chat', async (event, args) => {
    const { message, chatHistory, model, temperature, maxTokens, tools } = args;
    
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
    const toolCalls = response.candidates?.[0]?.content?.parts?.flatMap(part => 
      part.functionCall ? [{
        id: Date.now().toString(),
        name: part.functionCall.name,
        args: part.functionCall.args
      }] : []
    ) || [];
    
    // Return the response
    return {
      text: responseText,
      toolCalls: toolCalls,
      model: modelId
    };
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

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Using LLM model: ${LLM_MODEL}`);
  
  // Set up IPC handlers if running in Electron environment
  setupIpcHandlers();
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});

// Initialize IPC handlers when running in Electron
if (module.parent) {
  // This will be true when the file is required by another module (Electron main process)
  setupIpcHandlers();
}

module.exports = app; 