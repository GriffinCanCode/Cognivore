/**
 * LocalEmbeddingHandler.js - Handles local embedding generation for tab content
 * 
 * This handler interfaces with the backend's local embedding service to generate
 * semantic embeddings that can be used for meaningful tab categorization.
 */

class LocalEmbeddingHandler {
  constructor() {
    this.embeddingCache = new Map();
    this.isInitialized = false;
    this.initPromise = this.initialize();
    
    // Predefined semantic categories for better grouping
    this.semanticCategories = {
      'news': {
        keywords: ['news', 'breaking', 'latest', 'headlines', 'report', 'article', 'journalism', 'press', 'media', 'cnn', 'bbc', 'reuters', 'associated press'],
        description: 'News and current events'
      },
      'search': {
        keywords: ['search', 'google', 'bing', 'yahoo', 'query', 'results', 'find', 'lookup'],
        description: 'Search engines and queries'
      },
      'reference': {
        keywords: ['wikipedia', 'encyclopedia', 'reference', 'definition', 'wiki', 'knowledge', 'information', 'facts'],
        description: 'Reference and educational content'
      },
      'social': {
        keywords: ['facebook', 'twitter', 'instagram', 'linkedin', 'social', 'network', 'post', 'share', 'follow'],
        description: 'Social media and networking'
      },
      'shopping': {
        keywords: ['amazon', 'shop', 'buy', 'purchase', 'store', 'cart', 'price', 'product', 'retail', 'ecommerce'],
        description: 'Shopping and e-commerce'
      },
      'entertainment': {
        keywords: ['youtube', 'video', 'movie', 'music', 'game', 'entertainment', 'stream', 'watch', 'play'],
        description: 'Entertainment and media'
      },
      'technology': {
        keywords: ['tech', 'software', 'hardware', 'computer', 'programming', 'code', 'development', 'github', 'stack overflow'],
        description: 'Technology and development'
      },
      'finance': {
        keywords: ['bank', 'finance', 'money', 'investment', 'stock', 'trading', 'crypto', 'bitcoin', 'economy'],
        description: 'Finance and economics'
      },
      'education': {
        keywords: ['learn', 'course', 'tutorial', 'education', 'university', 'school', 'study', 'research', 'academic'],
        description: 'Education and learning'
      },
      'work': {
        keywords: ['work', 'job', 'career', 'office', 'business', 'professional', 'company', 'corporate', 'email'],
        description: 'Work and professional'
      }
    };
  }

  /**
   * Initialize the local embedding handler
   */
  async initialize() {
    try {
      console.log('🔧 Initializing LocalEmbeddingHandler...');
      
      // Check if electronAPI is available
      if (!window.electronAPI) {
        throw new Error('ElectronAPI not available');
      }
      
      // Test connection to backend
      await window.electronAPI.invoke('check-health');
      
      this.isInitialized = true;
      console.log('✅ LocalEmbeddingHandler initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize LocalEmbeddingHandler:', error);
      throw error;
    }
  }

  /**
   * Ensure the handler is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initPromise;
    }
  }

  /**
   * Generate local embedding for tab content
   * @param {Object} tab - Tab object with url, title, and extractedContent
   * @returns {Promise<Array>} - Embedding vector
   */
  async generateEmbedding(tab) {
    await this.ensureInitialized();
    
    console.log(`🧠 Generating local embedding for tab: ${tab.title} (${tab.url})`);
    
    // Check cache first
    const cacheKey = this.getCacheKey(tab);
    if (this.embeddingCache.has(cacheKey)) {
      console.log(`💾 Using cached local embedding for: ${tab.url}`);
      return this.embeddingCache.get(cacheKey);
    }

    try {
      // Prepare enhanced content for embedding
      const content = this.prepareEnhancedContent(tab);
      console.log(`📝 Prepared enhanced content for embedding (${content.length} chars)`);
      
      // Use backend's local embedding service
      const response = await window.electronAPI.invoke('generate-local-embedding', { text: content });
      
      if (!response || !response.embedding) {
        throw new Error('Invalid response from local embedding service');
      }
      
      const embedding = response.embedding;
      console.log(`✅ Generated local embedding for ${tab.title}:`, {
        embeddingLength: embedding?.length || 0,
        embeddingType: typeof embedding,
        firstFewValues: embedding?.slice(0, 3)
      });
      
      // Cache the embedding
      this.embeddingCache.set(cacheKey, embedding);
      
      return embedding;
      
    } catch (error) {
      console.error(`❌ Error generating local embedding for ${tab.title}:`, error);
      
      // Fallback to category-based embedding
      return this.generateCategoryBasedEmbedding(tab);
    }
  }

  /**
   * Prepare enhanced content for embedding with semantic categorization
   * @param {Object} tab - Tab object
   * @returns {string} - Enhanced content string
   */
  prepareEnhancedContent(tab) {
    const parts = [];
    
    // Add title with emphasis
    if (tab.title) {
      parts.push(`Title: ${tab.title}`);
    }
    
    // Add URL domain for context
    try {
      const domain = new URL(tab.url).hostname.replace('www.', '');
      parts.push(`Domain: ${domain}`);
    } catch (e) {
      parts.push(`URL: ${tab.url}`);
    }
    
    // Add semantic category hints
    const detectedCategory = this.detectSemanticCategory(tab);
    if (detectedCategory) {
      parts.push(`Category: ${detectedCategory.description}`);
      parts.push(`Keywords: ${detectedCategory.keywords.slice(0, 5).join(', ')}`);
    }
    
    // Add extracted content if available
    if (tab.extractedContent) {
      // Add summary if available
      if (tab.extractedContent.summary) {
        parts.push(`Summary: ${tab.extractedContent.summary}`);
      }
      
      // Add key paragraphs (limited to first 3 for better focus)
      if (tab.extractedContent.paragraphs && tab.extractedContent.paragraphs.length > 0) {
        const keyParagraphs = tab.extractedContent.paragraphs.slice(0, 3);
        parts.push(`Content: ${keyParagraphs.join(' ')}`);
      }
      
      // Add keywords if available
      if (tab.extractedContent.keywords && tab.extractedContent.keywords.length > 0) {
        parts.push(`Content Keywords: ${tab.extractedContent.keywords.slice(0, 8).join(', ')}`);
      }
      
      // Add headings for structure
      if (tab.extractedContent.headings && tab.extractedContent.headings.length > 0) {
        const headings = tab.extractedContent.headings.slice(0, 5);
        parts.push(`Headings: ${headings.join(', ')}`);
      }
    }
    
    return parts.join('\n');
  }

  /**
   * Detect semantic category for a tab
   * @param {Object} tab - Tab object
   * @returns {Object|null} - Detected category or null
   */
  detectSemanticCategory(tab) {
    const textToAnalyze = [
      tab.title || '',
      tab.url || '',
      tab.extractedContent?.summary || '',
      (tab.extractedContent?.keywords || []).join(' ')
    ].join(' ').toLowerCase();
    
    let bestMatch = null;
    let bestScore = 0;
    
    // Check each category
    for (const [categoryName, category] of Object.entries(this.semanticCategories)) {
      let score = 0;
      
      // Count keyword matches
      for (const keyword of category.keywords) {
        if (textToAnalyze.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      
      // Normalize score by number of keywords
      const normalizedScore = score / category.keywords.length;
      
      if (normalizedScore > bestScore && normalizedScore > 0.1) { // Minimum threshold
        bestScore = normalizedScore;
        bestMatch = {
          name: categoryName,
          ...category,
          score: normalizedScore
        };
      }
    }
    
    return bestMatch;
  }

  /**
   * Generate category-based embedding as fallback
   * @param {Object} tab - Tab object
   * @returns {Array} - Fallback embedding vector
   */
  generateCategoryBasedEmbedding(tab) {
    console.log(`🔄 Generating category-based fallback embedding for: ${tab.title}`);
    
    const dimensions = 384; // Standard dimension
    const embedding = new Array(dimensions).fill(0);
    
    // Detect category
    const category = this.detectSemanticCategory(tab);
    
    if (category) {
      // Use category name to generate consistent embedding
      const categoryIndex = Object.keys(this.semanticCategories).indexOf(category.name);
      const baseValue = (categoryIndex + 1) / Object.keys(this.semanticCategories).length;
      
      // Fill embedding with category-specific pattern
      for (let i = 0; i < dimensions; i++) {
        const position = i / dimensions;
        embedding[i] = Math.sin(baseValue * Math.PI * 2 + position * Math.PI) * category.score;
      }
    } else {
      // Generic embedding based on URL hash
      const urlHash = this.hashString(tab.url || tab.title || 'unknown');
      for (let i = 0; i < dimensions; i++) {
        embedding[i] = Math.sin(urlHash + i) * 0.1;
      }
    }
    
    return this.normalizeVector(embedding);
  }

  /**
   * Generate embeddings for multiple tabs
   * @param {Array} tabs - Array of tab objects
   * @returns {Promise<Array>} - Array of [tab, embedding] pairs
   */
  async generateEmbeddings(tabs) {
    console.log(`🔄 Generating local embeddings for ${tabs.length} tabs`);
    
    const results = [];
    
    // Process tabs in smaller batches to avoid overwhelming the backend
    const batchSize = 3;
    for (let i = 0; i < tabs.length; i += batchSize) {
      const batch = tabs.slice(i, i + batchSize);
      
      // Generate embeddings in parallel for this batch
      const batchPromises = batch.map(async (tab) => {
        try {
          const embedding = await this.generateEmbedding(tab);
          if (embedding && embedding.length > 0) {
            results.push([tab, embedding]);
          }
        } catch (error) {
          console.error(`Failed to generate embedding for tab ${tab.title}:`, error);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < tabs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Generated ${results.length} local embeddings out of ${tabs.length} tabs`);
    return results;
  }

  /**
   * Get cache key for a tab
   * @param {Object} tab - Tab object
   * @returns {string} - Cache key
   */
  getCacheKey(tab) {
    const content = this.prepareEnhancedContent(tab);
    return `${tab.url}-${this.hashString(content)}`;
  }

  /**
   * Simple string hash function
   * @param {string} str - Input string
   * @returns {number} - Hash value
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Normalize a vector to unit length
   * @param {Array} vector - Input vector
   * @returns {Array} - Normalized vector
   */
  normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  /**
   * Clear the embedding cache
   */
  clearCache() {
    this.embeddingCache.clear();
    console.log('🧹 Local embedding cache cleared');
  }

  /**
   * Get semantic categories
   * @returns {Object} - Available semantic categories
   */
  getSemanticCategories() {
    return this.semanticCategories;
  }
}

export default LocalEmbeddingHandler;
