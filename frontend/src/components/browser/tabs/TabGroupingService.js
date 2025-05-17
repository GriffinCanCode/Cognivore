/**
 * TabGroupingService.js - Handles tab content embedding generation and clustering
 * 
 * This service uses embeddings to analyze tab content similarity and create
 * meaningful clusters of related tabs. It interfaces with the LlmService to
 * generate embeddings and uses clustering algorithms to group similar tabs.
 */

import LlmService from '../../../services/LlmService';

// Import clustering algorithms
import { 
  calculateCosineSimilarity, 
  dbscanClustering,
  kMeansClustering,
  normalizeVector
} from './clusteringUtils';

class TabGroupingService {
  constructor() {
    this.llmService = new LlmService();
    this.similarityThreshold = 0.7; // Minimum similarity to consider tabs related
    this.embeddingCache = new Map(); // Cache embeddings by URL to avoid redundant generation
    this.colorPalette = [
      '#3498db', // Blue
      '#e74c3c', // Red
      '#2ecc71', // Green
      '#9b59b6', // Purple
      '#f1c40f', // Yellow
      '#1abc9c', // Turquoise
      '#e67e22', // Orange
      '#34495e', // Navy
      '#7f8c8d', // Gray
      '#d35400', // Dark Orange
      '#27ae60', // Dark Green
      '#8e44ad', // Dark Purple
    ];
  }

  /**
   * Generate embedding for a tab based on its content
   * @param {Object} tab - Tab object with url and extractedContent
   * @returns {Promise<Array>} - Embedding vector
   */
  async generateEmbedding(tab) {
    // Check if we already have this embedding cached
    if (this.embeddingCache.has(tab.url)) {
      return this.embeddingCache.get(tab.url);
    }

    // Extract most relevant content for embedding
    const content = this.prepareContentForEmbedding(tab);
    
    try {
      // Generate embedding using LlmService
      const embedding = await this.llmService.getEmbedding(content);
      
      // Cache the embedding
      this.embeddingCache.set(tab.url, embedding);
      
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  /**
   * Prepare tab content for embedding by extracting most relevant parts
   * @param {Object} tab - Tab object with url, title, and extractedContent
   * @returns {string} - Content string ready for embedding
   */
  prepareContentForEmbedding(tab) {
    const parts = [];
    
    // Always include title and URL as they're important context
    if (tab.title) parts.push(`Title: ${tab.title}`);
    parts.push(`URL: ${tab.url}`);
    
    // Add extracted content if available
    if (tab.extractedContent) {
      // If content has a summarized version, use that
      if (tab.extractedContent.summary) {
        parts.push(`Summary: ${tab.extractedContent.summary}`);
      }
      
      // Add top paragraphs (limited to first 5)
      if (tab.extractedContent.paragraphs && tab.extractedContent.paragraphs.length > 0) {
        const topParagraphs = tab.extractedContent.paragraphs.slice(0, 5);
        parts.push(`Content: ${topParagraphs.join(' ')}`);
      }
      
      // Add main keywords if available
      if (tab.extractedContent.keywords && tab.extractedContent.keywords.length > 0) {
        parts.push(`Keywords: ${tab.extractedContent.keywords.join(', ')}`);
      }
    }
    
    return parts.join('\n');
  }

  /**
   * Generate embeddings for multiple tabs
   * @param {Array} tabs - Array of tab objects
   * @returns {Promise<Array>} - Array of [tab, embedding] pairs
   */
  async generateEmbeddings(tabs) {
    const results = [];
    
    // Process tabs in batches to avoid overloading the LLM service
    const batchSize = 5;
    for (let i = 0; i < tabs.length; i += batchSize) {
      const batch = tabs.slice(i, i + batchSize);
      
      // Generate embeddings in parallel for this batch
      const batchPromises = batch.map(async (tab) => {
        const embedding = await this.generateEmbedding(tab);
        if (embedding) {
          results.push([tab, embedding]);
        }
      });
      
      await Promise.all(batchPromises);
    }
    
    return results;
  }

  /**
   * Calculate similarity matrix between tabs based on their embeddings
   * @param {Array} tabEmbeddings - Array of [tab, embedding] pairs
   * @returns {Array} - Matrix of tab relationships: [{ tabId, similarity }]
   */
  calculateSimilarityMatrix(tabEmbeddings) {
    const relationships = {};
    
    // Initialize relationships object for each tab
    tabEmbeddings.forEach(([tab]) => {
      relationships[tab.id] = [];
    });
    
    // Calculate similarities between all tab pairs
    for (let i = 0; i < tabEmbeddings.length; i++) {
      const [tabA, embeddingA] = tabEmbeddings[i];
      
      for (let j = i + 1; j < tabEmbeddings.length; j++) {
        const [tabB, embeddingB] = tabEmbeddings[j];
        
        // Calculate cosine similarity
        const similarity = calculateCosineSimilarity(embeddingA, embeddingB);
        
        // If similarity exceeds threshold, consider them related
        if (similarity >= this.similarityThreshold) {
          relationships[tabA.id].push({ tabId: tabB.id, similarity });
          relationships[tabB.id].push({ tabId: tabA.id, similarity });
        }
      }
    }
    
    return relationships;
  }

  /**
   * Run clustering on tabs using DBSCAN algorithm
   * @param {Array} tabEmbeddings - Array of [tab, embedding] pairs
   * @param {Object} options - Clustering options
   * @returns {Object} - Clustering result with groups and relationships
   */
  runDbscanClustering(tabEmbeddings, options = {}) {
    const {
      epsilon = 0.3,
      minPoints = 2
    } = options;
    
    // Extract tabs and embeddings
    const tabs = tabEmbeddings.map(([tab]) => tab);
    const embeddings = tabEmbeddings.map(([_, embedding]) => embedding);
    
    // Run DBSCAN clustering
    const clusterAssignments = dbscanClustering(
      embeddings, 
      calculateCosineSimilarity, 
      epsilon, 
      minPoints
    );
    
    // Process results
    return this.processClusteringResults(tabs, clusterAssignments, tabEmbeddings);
  }

  /**
   * Run clustering on tabs using K-means algorithm
   * @param {Array} tabEmbeddings - Array of [tab, embedding] pairs
   * @param {Object} options - Clustering options
   * @returns {Object} - Clustering result with groups and relationships
   */
  runKmeansClustering(tabEmbeddings, options = {}) {
    const {
      k = Math.min(5, Math.ceil(tabEmbeddings.length / 2)) // Default: min of 5 or half the tabs
    } = options;
    
    // Extract tabs and embeddings
    const tabs = tabEmbeddings.map(([tab]) => tab);
    const embeddings = tabEmbeddings.map(([_, embedding]) => embedding);
    
    // Run K-means clustering
    const clusterAssignments = kMeansClustering(
      embeddings,
      k,
      calculateCosineSimilarity
    );
    
    // Process results
    return this.processClusteringResults(tabs, clusterAssignments, tabEmbeddings);
  }

  /**
   * Process clustering results to generate groups and relationships
   * @param {Array} tabs - Array of tab objects
   * @param {Array} clusterAssignments - Array of cluster assignments
   * @param {Array} tabEmbeddings - Array of [tab, embedding] pairs
   * @returns {Object} - Processed results with groups and relationships
   */
  processClusteringResults(tabs, clusterAssignments, tabEmbeddings) {
    // Count tabs in each cluster
    const clusters = {};
    clusterAssignments.forEach((clusterId, i) => {
      if (clusterId === -1) return; // Skip noise points
      
      if (!clusters[clusterId]) {
        clusters[clusterId] = [];
      }
      
      clusters[clusterId].push(tabs[i].id);
    });
    
    // Create groups from clusters
    const groups = Object.entries(clusters).map(([clusterId, tabIds], index) => ({
      id: `cluster-${clusterId}`,
      name: `Group ${parseInt(clusterId) + 1}`,
      color: this.colorPalette[index % this.colorPalette.length],
      tabIds
    }));
    
    // Add a "Noise" group for tabs not in any cluster
    const noiseTabIds = [];
    clusterAssignments.forEach((clusterId, i) => {
      if (clusterId === -1) {
        noiseTabIds.push(tabs[i].id);
      }
    });
    
    if (noiseTabIds.length > 0) {
      groups.push({
        id: 'noise',
        name: 'Ungrouped',
        color: '#cccccc',
        tabIds: noiseTabIds
      });
    }
    
    // Calculate relationships between tabs based on similarity
    const relationships = this.calculateSimilarityMatrix(tabEmbeddings);
    
    return { groups, relationships };
  }

  /**
   * Run clustering on tabs with specified algorithm
   * @param {Array} tabs - Array of tab objects
   * @param {string} method - Clustering method: 'dbscan' or 'kmeans'
   * @param {Object} options - Clustering options
   * @returns {Promise<Object>} - Clustering results
   */
  async clusterTabs(tabs, method = 'dbscan', options = {}) {
    // Generate embeddings for tabs
    const tabEmbeddings = await this.generateEmbeddings(tabs);
    
    // Run specified clustering algorithm
    if (method === 'dbscan') {
      return this.runDbscanClustering(tabEmbeddings, options);
    } else if (method === 'kmeans') {
      return this.runKmeansClustering(tabEmbeddings, options);
    } else {
      throw new Error(`Unsupported clustering method: ${method}`);
    }
  }

  /**
   * Extract meaningful text from HTML content
   * @param {string} content - HTML content
   * @returns {string} - Extracted text
   */
  extractTextFromContent(content) {
    // If content is already plain text or not a string, return as is
    if (!content || typeof content !== 'string') return content || '';
    
    // Check if content is HTML by looking for HTML tags
    const isHtml = /<[a-z][\s\S]*>/i.test(content);
    
    if (!isHtml) {
      // Return plain text content
      return content;
    }
    
    try {
      // Use DOMParser to extract text from HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      
      // Remove script, style, and other non-content elements
      const elementsToRemove = doc.querySelectorAll('script, style, noscript, svg, iframe');
      elementsToRemove.forEach(el => el.remove());
      
      // Extract text from main content areas
      const mainElements = doc.querySelectorAll('main, article, .content, #content, [role="main"]');
      if (mainElements.length > 0) {
        // Use the first main content element found
        return mainElements[0].textContent.trim();
      }
      
      // If no main content area, extract from body
      const bodyText = doc.body.textContent.trim();
      
      // Truncate text to reasonable length for embedding model (2000 chars)
      return bodyText.length > 2000 ? bodyText.substring(0, 2000) : bodyText;
    } catch (error) {
      console.error('Error extracting text from HTML:', error);
      // Return a slice of the content as plain text
      return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
    }
  }

  /**
   * Find similar tabs based on content similarity
   * @param {string} tabId - ID of tab to find similar tabs for
   * @param {Array} allTabs - All tabs to compare against
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Array} - Similar tabs sorted by similarity
   */
  findSimilarTabs(tabId, allTabs, threshold = this.similarityThreshold) {
    const sourceTab = allTabs.find(tab => tab.id === tabId);
    if (!sourceTab || !sourceTab.embeddings) return [];
    
    // Get tabs with embeddings except the source tab
    const otherTabs = allTabs.filter(tab => 
      tab.id !== tabId && tab.embeddings
    );
    
    if (otherTabs.length === 0) return [];
    
    // Calculate similarity between source tab and other tabs
    const similarities = otherTabs.map(tab => {
      const similarity = calculateCosineSimilarity(sourceTab.embeddings, tab.embeddings);
      return {
        id: tab.id,
        title: tab.title,
        url: tab.url,
        similarity
      };
    });
    
    // Filter by threshold and sort by similarity (descending)
    return similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Get similarity edges for graph visualization
   * @param {Array} tabs - All tabs with embeddings
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Array} - Edges with similarity values
   */
  getSimilarityEdges(tabs, threshold = this.similarityThreshold * 0.8) {
    const edges = [];
    const tabsWithEmbeddings = tabs.filter(tab => tab.embeddings);
    
    // Need at least 2 tabs with embeddings
    if (tabsWithEmbeddings.length < 2) return edges;
    
    // Compare each tab with every other tab
    for (let i = 0; i < tabsWithEmbeddings.length; i++) {
      const tab1 = tabsWithEmbeddings[i];
      
      for (let j = i + 1; j < tabsWithEmbeddings.length; j++) {
        const tab2 = tabsWithEmbeddings[j];
        
        // Calculate similarity between tabs
        const similarity = calculateCosineSimilarity(tab1.embeddings, tab2.embeddings);
        
        // Add edge if similarity is above threshold
        if (similarity >= threshold) {
          edges.push({
            from: tab1.id,
            to: tab2.id,
            value: similarity * 5, // Scale for visualization
            title: `Similarity: ${(similarity * 100).toFixed(0)}%`
          });
        }
      }
    }
    
    return edges;
  }

  /**
   * Get a common theme/name for a cluster of tabs
   * @param {Array} tabs - Tabs in the cluster
   * @returns {Promise<string>} - Generated cluster theme
   */
  async getClusterTheme(tabs) {
    if (!tabs || tabs.length === 0) return 'Empty Cluster';
    
    // If just one tab, use its title (shortened if needed)
    if (tabs.length === 1) {
      const title = tabs[0].title;
      return title.length > 30 ? title.substring(0, 27) + '...' : title;
    }
    
    try {
      // Extract titles for LLM analysis
      const titles = tabs.map(tab => tab.title).filter(Boolean);
      
      // Prepare prompt for LLM
      const prompt = `Given these browser tab titles, provide a short, descriptive label (4 words or less) that captures their common theme or topic.
      Tab Titles:
      ${titles.map(title => `- ${title}`).join('\n')}
      
      Label: `;
      
      // Call LLM service with a minimal system prompt to save tokens
      const response = await this.llmService.sendMessage(prompt, [], { minimalPrompt: true });
      
      // Extract the cluster theme from LLM response
      let theme = response.text || response.content || '';
      
      // Clean up the response
      theme = theme.replace(/^["'\s]+|["'\s]+$/g, ''); // Remove quotes and whitespace
      theme = theme.replace(/^Label:?\s*/i, ''); // Remove "Label:" prefix
      
      // Default fallback
      if (!theme || theme.length > 30) {
        theme = `Cluster of ${tabs.length} tabs`;
      }
      
      return theme;
    } catch (error) {
      console.error('Error generating cluster theme:', error);
      // Fallback name based on number of tabs
      return `Cluster of ${tabs.length} tabs`;
    }
  }
}

export default TabGroupingService; 