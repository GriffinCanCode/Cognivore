/**
 * Tools Service
 * Manages tools execution and registration for document processing
 */
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const database = require('./database');
const llmService = require('./llm');
const toolDefinitionsAdapter = require('../utils/toolDefinitionsAdapter');

class ToolsService {
  constructor() {
    this.tools = {};
    this.logger = logger.scope('ToolsService');
    this.logger.info('Initializing ToolsService');
  }

  /**
   * Initialize the tools service
   */
  async initialize() {
    this.logger.info('Loading available tools');
    try {
      // Register built-in tools
      this.registerTool('summary', this.generateSummary.bind(this));
      
      // Register RAG tools
      this.registerTool('searchKnowledgeBase', this.searchKnowledgeBase.bind(this));
      this.registerTool('getItemContent', this.getItemContent.bind(this));
      this.registerTool('recommendRelatedContent', this.recommendRelatedContent.bind(this));
      this.registerTool('summarizeContent', this.summarizeContent.bind(this));
      
      // Check if our tool implementations match the shared definitions
      this.validateToolImplementations();
      
      this.logger.info('Tools loaded successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize tools service', { error: error.message });
      return false;
    }
  }

  /**
   * Validate that all registered tools match shared definitions
   */
  validateToolImplementations() {
    // Get tool names defined in the shared definitions for backend
    const definedToolNames = toolDefinitionsAdapter.getBackendToolNames();
    // Get actually implemented tools
    const implementedTools = Object.keys(this.tools);
    
    // Check for tools in definitions but not implemented
    const missingImplementations = definedToolNames.filter(name => !implementedTools.includes(name));
    if (missingImplementations.length > 0) {
      this.logger.warn('Some tools defined in shared definitions are not implemented in backend', {
        missingTools: missingImplementations
      });
    }
    
    // Check for tools implemented but not in definitions
    const undefinedImplementations = implementedTools.filter(name => !definedToolNames.includes(name));
    if (undefinedImplementations.length > 0) {
      this.logger.warn('Some implemented tools are not defined in shared definitions', {
        undefinedTools: undefinedImplementations
      });
    }
    
    this.logger.info('Tool implementation validation complete', {
      definedCount: definedToolNames.length,
      implementedCount: implementedTools.length,
      missingCount: missingImplementations.length,
      undefinedCount: undefinedImplementations.length
    });
  }

  /**
   * Register a new tool
   * @param {string} name - Tool name
   * @param {Function} handler - Tool handler function
   */
  registerTool(name, handler) {
    if (typeof handler !== 'function') {
      this.logger.error('Tool handler must be a function', { name });
      return false;
    }
    
    this.tools[name] = handler;
    this.logger.info(`Registered tool: ${name}`);
    return true;
  }

  /**
   * Get list of available tools
   * @returns {Array} - List of available tool names
   */
  getAvailableTools() {
    const toolDefinitions = toolDefinitionsAdapter.getBackendToolDefinitions();
    
    // Filter to only include tools that are actually implemented
    return toolDefinitions.filter(tool => this.tools[tool.name] !== undefined);
  }

  /**
   * Get description for a tool
   * @param {string} name - Tool name
   * @returns {string} - Tool description
   */
  getToolDescription(name) {
    const toolDefinition = toolDefinitionsAdapter.getToolDefinition(name);
    if (toolDefinition) {
      return toolDefinition.description;
    }
    
    // Fallback descriptions if shared definitions couldn't be loaded
    const fallbackDescriptions = {
      'summary': 'Generate a concise summary of document content',
      'searchKnowledgeBase': 'Search the knowledge base for relevant information using semantic search',
      'getItemContent': 'Get the full content of a specific item in the knowledge base',
      'recommendRelatedContent': 'Recommend related content based on a query or item ID',
      'summarizeContent': 'Generate a concise summary of provided content with key points'
    };
    
    return fallbackDescriptions[name] || 'No description available';
  }

  /**
   * Execute a tool
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} params - Tool parameters
   * @returns {Promise<Object>} - Tool execution result
   */
  async executeTool(toolName, params = {}) {
    try {
      const tool = this.tools[toolName];
      
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }
      
      this.logger.info(`Executing tool: ${toolName}`, { params });
      const result = await tool(params);
      
      return {
        success: true,
        toolName,
        result
      };
    } catch (error) {
      this.logger.error(`Tool execution failed: ${toolName}`, { 
        error: error.message, 
        params 
      });
      
      return {
        success: false,
        toolName,
        error: error.message
      };
    }
  }

  /**
   * Generate a summary from document content
   * @param {Object} params - Parameters including document content
   * @returns {Promise<Object>} - Summary data
   */
  async generateSummary(params) {
    try {
      const { documentId, content, title } = params;
      
      if (!content) {
        throw new Error('No content provided for summary generation');
      }
      
      this.logger.info(`Generating summary for document: ${documentId || 'unknown'}`);
      
      // Extract first 2-3 sentences for summary
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const summaryText = sentences.slice(0, 3).join('. ') + '.';
      
      // Extract key points - simple implementation, can be enhanced later
      const keyPoints = this.extractKeyPoints(content);
      
      return {
        summary: summaryText,
        keyPoints,
        title: title || 'Document Summary'
      };
    } catch (error) {
      this.logger.error('Summary generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract key points from text content
   * @param {string} text - Document text
   * @returns {Array} - List of key points
   */
  extractKeyPoints(text) {
    // Simple key point extraction based on common patterns
    const keyPointIndicators = [
      'important', 'key', 'critical', 'essential', 'crucial', 'significant',
      'note that', 'remember', 'consider', 'take away', 'highlight'
    ];
    
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
    let keyPoints = [];
    
    // Look for sentences with key point indicators
    paragraphs.forEach(paragraph => {
      const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      sentences.forEach(sentence => {
        const sentenceLower = sentence.toLowerCase();
        if (keyPointIndicators.some(indicator => sentenceLower.includes(indicator))) {
          keyPoints.push(sentence.trim());
        }
      });
    });
    
    // If no key points found with indicators, use first sentence of paragraphs
    if (keyPoints.length === 0 && paragraphs.length > 0) {
      keyPoints = paragraphs.slice(0, Math.min(3, paragraphs.length))
        .map(paragraph => {
          const firstSentence = paragraph.split(/[.!?]+/)[0].trim();
          return firstSentence.length > 10 ? firstSentence : paragraph.substring(0, 100).trim();
        });
    }
    
    // Limit to 5 key points and make sure they end with periods
    return keyPoints
      .slice(0, 5)
      .map(point => point.trim().endsWith('.') ? point.trim() : `${point.trim()}.`);
  }

  /**
   * Search knowledge base using semantic search
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} - Search results
   */
  async searchKnowledgeBase(params) {
    try {
      const { query, filters = {}, limit = 5, maxTokens = 4000 } = params;
      
      if (!query) {
        throw new Error('Search query is required');
      }
      
      this.logger.info(`Searching knowledge base for: ${query}`);
      
      // Generate embeddings for the query using LLM service
      const embeddingResult = await llmService.generateEmbeddings(query);
      
      if (!embeddingResult || !embeddingResult.embedding) {
        throw new Error('Failed to generate embeddings for search query');
      }
      
      // Prepare search options
      const searchOptions = {
        limit: Math.min(parseInt(limit) || 5, 10), // Cap at 10 for efficiency
        includeContent: true,
        includeSummary: true,
        maxTotalTokens: parseInt(maxTokens) || 4000,
        deduplicate: true
      };
      
      // Apply filters if provided
      if (filters.sourceType) {
        searchOptions.sourceTypeFilter = filters.sourceType;
      }
      
      if (filters.dateAdded) {
        searchOptions.dateFilter = filters.dateAdded;
      }
      
      // Perform semantic search
      const results = await database.semanticSearch(query, embeddingResult.embedding, searchOptions);
      
      // Format results for LLM consumption
      const formattedResults = results.map(item => ({
        id: item.id,
        title: item.title,
        sourceType: item.sourceType,
        score: item.score,
        summary: item.summary || this.generateQuickSummary(item.content),
        // Include truncated content to stay within token limits
        contentPreview: item.content ? this.truncateContent(item.content, 500) : null
      }));
      
      return {
        query,
        totalResults: formattedResults.length,
        results: formattedResults,
        // Include metadata for LLM to understand search context
        searchMetadata: {
          appliedFilters: Object.keys(filters).length > 0 ? filters : null,
          estimatedTokens: results.reduce((sum, item) => sum + (item.estimatedTokens || 0), 0)
        }
      };
    } catch (error) {
      this.logger.error('Knowledge base search failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get full content of a specific item
   * @param {Object} params - Parameters with item ID
   * @returns {Promise<Object>} - Item content and metadata
   */
  async getItemContent(params) {
    try {
      const { itemId } = params;
      
      if (!itemId) {
        throw new Error('Item ID is required');
      }
      
      this.logger.info(`Retrieving content for item: ${itemId}`);
      
      // Get item with content
      const item = await database.getItemById(itemId, { includeContent: true });
      
      if (!item) {
        throw new Error(`Item with ID ${itemId} not found`);
      }
      
      // Generate summary if not already available
      let summary = null;
      if (item.content) {
        summary = await this.generateSummary({ content: item.content, title: item.title });
      }
      
      return {
        id: item.id,
        title: item.title,
        sourceType: item.sourceType,
        content: item.content,
        metadata: item.metadata,
        summary: summary
      };
    } catch (error) {
      this.logger.error('Item content retrieval failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Recommend related content based on a query or item ID
   * @param {Object} params - Parameters for recommendation
   * @returns {Promise<Object>} - Recommended content
   */
  async recommendRelatedContent(params) {
    try {
      const { query, itemId, limit = 3 } = params;
      
      if (!query && !itemId) {
        throw new Error('Either query or itemId is required');
      }
      
      let searchVector;
      
      if (itemId) {
        // Get item to use as recommendation source
        this.logger.info(`Recommending content related to item: ${itemId}`);
        const item = await database.getItemById(itemId, { includeVector: true });
        
        if (!item || !item.vector) {
          throw new Error(`Item with ID ${itemId} not found or has no vector`);
        }
        
        searchVector = item.vector;
      } else {
        // Generate embeddings for the query
        this.logger.info(`Recommending content related to query: ${query}`);
        const embeddingResult = await llmService.generateEmbeddings(query);
        
        if (!embeddingResult || !embeddingResult.embedding) {
          throw new Error('Failed to generate embeddings for recommendation query');
        }
        
        searchVector = embeddingResult.embedding;
      }
      
      // Perform semantic search with specific options for recommendations
      const recommendations = await database.semanticSearch(
        query || '', 
        searchVector, 
        {
          limit: parseInt(limit) || 3,
          includeContent: false, // Don't need full content for recommendations
          includeSummary: true,
          deduplicate: true,
          minRelevanceScore: 0.65 // Higher threshold for recommendations
        }
      );
      
      // Format recommendations
      const formattedRecommendations = recommendations.map(item => ({
        id: item.id,
        title: item.title,
        sourceType: item.sourceType,
        summary: item.summary || this.generateQuickSummary(item.content),
        relevanceScore: item.score
      }));
      
      return {
        sourceType: itemId ? 'item' : 'query',
        sourceId: itemId || null,
        sourceQuery: query || null,
        recommendations: formattedRecommendations
      };
    } catch (error) {
      this.logger.error('Content recommendation failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Summarize arbitrary content
   * @param {Object} params - Parameters with content to summarize
   * @returns {Promise<Object>} - Summary data
   */
  async summarizeContent(params) {
    try {
      const { content, length = 'medium' } = params;
      
      if (!content) {
        throw new Error('Content is required for summarization');
      }
      
      this.logger.info(`Generating ${length} summary for content`);
      
      // Get sentence count based on desired length
      const sentenceCounts = {
        short: 2,
        medium: 4,
        long: 8
      };
      const sentenceCount = sentenceCounts[length] || sentenceCounts.medium;
      
      // Extract sentences for summary
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const summaryText = sentences.slice(0, sentenceCount).join('. ') + (sentences.length > 0 ? '.' : '');
      
      // Extract key points
      const keyPoints = this.extractKeyPoints(content);
      
      return {
        summary: summaryText,
        keyPoints,
        length
      };
    } catch (error) {
      this.logger.error('Content summarization failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Generate a quick summary from text content
   * @param {string} text - Text to summarize
   * @returns {string} - Quick summary
   */
  generateQuickSummary(text) {
    if (!text) return '';
    
    // Extract first sentence or first 150 characters
    const firstSentenceMatch = text.match(/^[^.!?]*[.!?]/);
    if (firstSentenceMatch && firstSentenceMatch[0]) {
      return firstSentenceMatch[0].trim();
    }
    
    // Fallback to character truncation
    return this.truncateContent(text, 150);
  }
  
  /**
   * Truncate content to specified length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} - Truncated text
   */
  truncateContent(text, maxLength = 500) {
    if (!text) return '';
    
    if (text.length <= maxLength) {
      return text;
    }
    
    // Try to truncate at sentence boundary
    const truncated = text.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > maxLength * 0.7) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }
    
    // Fallback to truncating at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.substring(0, lastSpace) + '...';
  }
}

module.exports = new ToolsService(); 