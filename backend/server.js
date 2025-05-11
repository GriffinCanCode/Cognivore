// Backend server for Knowledge Store with Gemini 2.5 Flash integration
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Environment variables
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'embedding-001';
const NODE_ENV = process.env.NODE_ENV || 'development';

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

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

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
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});

module.exports = app; 