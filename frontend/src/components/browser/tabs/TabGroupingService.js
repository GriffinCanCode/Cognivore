/**
 * TabGroupingService.js - Handles tab content embedding generation and clustering
 * 
 * This service uses embeddings to analyze tab content similarity and create
 * meaningful clusters of related tabs. It interfaces with the LocalEmbeddingHandler
 * to generate semantic embeddings and uses clustering algorithms to group similar tabs.
 */

import LlmService from '../../../services/LlmService';
import LocalEmbeddingHandler from '../handlers/LocalEmbeddingHandler';

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
    this.localEmbeddingHandler = new LocalEmbeddingHandler();
    this.similarityThreshold = 0.6; // Adjusted for better local embeddings
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
    
    // Semantic group names based on categories
    this.semanticGroupNames = {
      'news': 'News & Current Events',
      'search': 'Search & Research',
      'reference': 'Reference & Learning',
      'social': 'Social Media',
      'shopping': 'Shopping & Commerce',
      'entertainment': 'Entertainment & Media',
      'technology': 'Technology & Development',
      'finance': 'Finance & Economics',
      'education': 'Education & Learning',
      'work': 'Work & Professional'
    };
  }

  /**
   * Generate embedding for a tab based on its content using local embeddings
   * @param {Object} tab - Tab object with url and extractedContent
   * @returns {Promise<Array>} - Embedding vector
   */
  async generateEmbedding(tab) {
    console.log(`🧠 Generating local embedding for tab: ${tab.title} (${tab.url})`);
    
    // Check if we already have this embedding cached
    const cacheKey = `local-${tab.url}`;
    if (this.embeddingCache.has(cacheKey)) {
      console.log(`💾 Using cached local embedding for: ${tab.url}`);
      return this.embeddingCache.get(cacheKey);
    }

    try {
      // Use local embedding handler for better semantic understanding
      const embedding = await this.localEmbeddingHandler.generateEmbedding(tab);
      
      console.log(`✅ Generated local embedding for ${tab.title}:`, {
        embeddingLength: embedding?.length || 0,
        embeddingType: typeof embedding,
        firstFewValues: embedding?.slice(0, 5)
      });
      
      // Cache the embedding
      this.embeddingCache.set(cacheKey, embedding);
      
      return embedding;
    } catch (error) {
      console.error(`❌ Error generating local embedding for ${tab.title}:`, error);
      
      // Fallback to LLM service if local embedding fails
      console.log(`🔄 Falling back to LLM service for: ${tab.title}`);
      return this.generateLLMEmbedding(tab);
    }
  }

  /**
   * Generate embedding using LLM service as fallback
   * @param {Object} tab - Tab object
   * @returns {Promise<Array>} - Embedding vector
   */
  async generateLLMEmbedding(tab) {
    // Check LLM cache
    const cacheKey = `llm-${tab.url}`;
    if (this.embeddingCache.has(cacheKey)) {
      console.log(`💾 Using cached LLM embedding for: ${tab.url}`);
      return this.embeddingCache.get(cacheKey);
    }

    // Extract most relevant content for embedding
    const content = this.prepareContentForEmbedding(tab);
    console.log(`📝 Prepared content for LLM embedding (${content.length} chars):`, content.substring(0, 200) + '...');
    
    try {
      // Generate embedding using LlmService
      console.log(`🔄 Calling LlmService.getEmbedding for: ${tab.title}`);
      const embedding = await this.llmService.getEmbedding(content);
      
      // Cache the embedding
      this.embeddingCache.set(cacheKey, embedding);
      
      return embedding;
    } catch (error) {
      console.error(`❌ Error generating LLM embedding for ${tab.title}:`, error);
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
      epsilon = 0.4, // Adjusted for local embeddings
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
    
    // Process results with semantic enhancement
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
      k = Math.min(4, Math.ceil(tabEmbeddings.length / 2)) // Reduced default clusters for better grouping
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
    
    // Process results with semantic enhancement
    return this.processClusteringResults(tabs, clusterAssignments, tabEmbeddings);
  }

  /**
   * Run hybrid semantic clustering that combines category detection with embedding similarity
   * @param {Array} tabEmbeddings - Array of [tab, embedding] pairs
   * @param {Object} options - Clustering options
   * @returns {Object} - Clustering result with groups and relationships
   */
  runSemanticClustering(tabEmbeddings, options = {}) {
    console.log('🎯 Running semantic clustering with category detection...');
    
    const tabs = tabEmbeddings.map(([tab]) => tab);
    const embeddings = tabEmbeddings.map(([_, embedding]) => embedding);
    
    // Step 1: Pre-categorize tabs by semantic category
    const categoryGroups = {};
    const uncategorizedTabs = [];
    
    tabs.forEach((tab, index) => {
      const category = this.detectTabCategory(tab);
      if (category) {
        if (!categoryGroups[category]) {
          categoryGroups[category] = [];
        }
        categoryGroups[category].push({ tab, embedding: embeddings[index], index });
      } else {
        uncategorizedTabs.push({ tab, embedding: embeddings[index], index });
      }
    });
    
    console.log(`📊 Semantic pre-categorization: ${Object.keys(categoryGroups).length} categories, ${uncategorizedTabs.length} uncategorized`);
    
    // Step 2: Within each category, use similarity clustering for sub-groups
    const finalClusters = [];
    let clusterIndex = 0;
    
    Object.entries(categoryGroups).forEach(([category, categoryTabs]) => {
      if (categoryTabs.length === 1) {
        // Single tab in category
        finalClusters.push({
          id: clusterIndex++,
          category,
          tabs: categoryTabs,
          name: this.semanticGroupNames[category] || category
        });
      } else if (categoryTabs.length <= 3) {
        // Small group - keep together
        finalClusters.push({
          id: clusterIndex++,
          category,
          tabs: categoryTabs,
          name: this.semanticGroupNames[category] || category
        });
      } else {
        // Large group - sub-cluster by similarity
        const categoryEmbeddings = categoryTabs.map(item => item.embedding);
        const subClusters = this.subClusterBySimilarity(categoryTabs, categoryEmbeddings);
        
        subClusters.forEach((subCluster, subIndex) => {
          finalClusters.push({
            id: clusterIndex++,
            category,
            tabs: subCluster,
            name: subClusters.length > 1 ? 
              `${this.semanticGroupNames[category] || category} ${subIndex + 1}` :
              this.semanticGroupNames[category] || category
          });
        });
      }
    });
    
    // Step 3: Cluster uncategorized tabs by similarity
    if (uncategorizedTabs.length > 0) {
      const uncategorizedEmbeddings = uncategorizedTabs.map(item => item.embedding);
      const uncategorizedClusters = this.subClusterBySimilarity(uncategorizedTabs, uncategorizedEmbeddings);
      
      uncategorizedClusters.forEach((cluster, index) => {
        finalClusters.push({
          id: clusterIndex++,
          category: null,
          tabs: cluster,
          name: uncategorizedClusters.length > 1 ? `Mixed Content ${index + 1}` : 'Mixed Content'
        });
      });
    }
    
    // Step 4: Convert to standard format
    const clusterAssignments = new Array(tabs.length).fill(-1);
    const groups = [];
    
    finalClusters.forEach((cluster, clusterIdx) => {
      const tabIds = cluster.tabs.map(item => item.tab.id);
      
      // Assign cluster indices
      cluster.tabs.forEach(item => {
        clusterAssignments[item.index] = clusterIdx;
      });
      
      groups.push({
        id: `semantic-${cluster.id}`,
        name: cluster.name,
        category: cluster.category,
        color: this.colorPalette[clusterIdx % this.colorPalette.length],
        tabIds,
        description: cluster.category ? this.getSemanticCategoryDescription(cluster.category) : 'Related content'
      });
    });
    
    // Calculate relationships
    const relationships = this.calculateSimilarityMatrix(tabEmbeddings);
    
    console.log(`✅ Semantic clustering completed: ${groups.length} groups created`);
    return { groups, relationships };
  }

  /**
   * Detect semantic category for a single tab
   * @param {Object} tab - Tab object
   * @returns {string|null} - Detected category or null
   */
  detectTabCategory(tab) {
    try {
      return this.localEmbeddingHandler.detectSemanticCategory(tab)?.name || null;
    } catch (error) {
      console.warn(`Failed to detect category for tab ${tab.title}:`, error);
      return null;
    }
  }

  /**
   * Sub-cluster tabs within a category by similarity
   * @param {Array} categoryTabs - Tabs in the same category
   * @param {Array} embeddings - Corresponding embeddings
   * @returns {Array} - Array of sub-clusters
   */
  subClusterBySimilarity(categoryTabs, embeddings) {
    if (categoryTabs.length <= 2) {
      return [categoryTabs];
    }
    
    // Use DBSCAN with relaxed parameters for sub-clustering
    const subClusterAssignments = dbscanClustering(
      embeddings,
      calculateCosineSimilarity,
      0.3, // More relaxed epsilon for sub-clustering
      2    // Minimum 2 points for sub-cluster
    );
    
    // Group by cluster assignment
    const subClusters = {};
    const noise = [];
    
    subClusterAssignments.forEach((clusterId, index) => {
      if (clusterId === -1) {
        noise.push(categoryTabs[index]);
      } else {
        if (!subClusters[clusterId]) {
          subClusters[clusterId] = [];
        }
        subClusters[clusterId].push(categoryTabs[index]);
      }
    });
    
    // Convert to array and add noise as separate clusters if significant
    const result = Object.values(subClusters);
    
    if (noise.length > 0) {
      if (noise.length === 1 && result.length > 0) {
        // Single noise item - add to largest cluster
        const largestCluster = result.reduce((max, cluster) => 
          cluster.length > max.length ? cluster : max
        );
        largestCluster.push(noise[0]);
      } else {
        // Multiple noise items or no other clusters - create separate cluster
        result.push(noise);
      }
    }
    
    return result.length > 0 ? result : [categoryTabs];
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
    
    // Create groups from clusters with semantic names
    const groups = Object.entries(clusters).map(([clusterId, tabIds], index) => {
      // Get tabs for this cluster
      const clusterTabs = tabIds.map(tabId => tabs.find(tab => tab.id === tabId)).filter(Boolean);
      
      // Detect semantic category for this cluster
      const semanticCategory = this.detectClusterCategory(clusterTabs);
      
      // Generate group name
      let groupName = `Group ${parseInt(clusterId) + 1}`;
      if (semanticCategory) {
        groupName = this.semanticGroupNames[semanticCategory] || semanticCategory;
      }
      
      return {
        id: `cluster-${clusterId}`,
        name: groupName,
        category: semanticCategory,
        color: this.colorPalette[index % this.colorPalette.length],
        tabIds,
        description: semanticCategory ? this.getSemanticCategoryDescription(semanticCategory) : null
      };
    });
    
    // Add a "Noise" group for tabs not in any cluster
    const noiseTabIds = [];
    clusterAssignments.forEach((clusterId, i) => {
      if (clusterId === -1) {
        noiseTabIds.push(tabs[i].id);
      }
    });
    
    if (noiseTabIds.length > 0) {
      // Try to categorize noise tabs individually
      const noiseTabs = noiseTabIds.map(tabId => tabs.find(tab => tab.id === tabId)).filter(Boolean);
      const noiseCategory = this.detectClusterCategory(noiseTabs);
      
      groups.push({
        id: 'noise',
        name: noiseCategory ? this.semanticGroupNames[noiseCategory] || 'Mixed Content' : 'Ungrouped',
        category: noiseCategory,
        color: '#cccccc',
        tabIds: noiseTabIds,
        description: 'Tabs that don\'t fit into other categories'
      });
    }
    
    // Calculate relationships between tabs based on similarity
    const relationships = this.calculateSimilarityMatrix(tabEmbeddings);
    
    return { groups, relationships };
  }

  /**
   * Detect semantic category for a cluster of tabs
   * @param {Array} tabs - Array of tab objects in the cluster
   * @returns {string|null} - Detected category name or null
   */
  detectClusterCategory(tabs) {
    if (!tabs || tabs.length === 0) return null;
    
    // Get semantic categories from local embedding handler
    const semanticCategories = this.localEmbeddingHandler.getSemanticCategories();
    const categoryScores = {};
    
    // Initialize scores
    Object.keys(semanticCategories).forEach(category => {
      categoryScores[category] = 0;
    });
    
    // Analyze each tab in the cluster
    tabs.forEach(tab => {
      const textToAnalyze = [
        tab.title || '',
        tab.url || '',
        tab.extractedContent?.summary || '',
        (tab.extractedContent?.keywords || []).join(' ')
      ].join(' ').toLowerCase();
      
      // Check each category
      Object.entries(semanticCategories).forEach(([categoryName, category]) => {
        let score = 0;
        
        // Count keyword matches
        category.keywords.forEach(keyword => {
          if (textToAnalyze.includes(keyword.toLowerCase())) {
            score += 1;
          }
        });
        
        // Normalize score by number of keywords and add to category total
        const normalizedScore = score / category.keywords.length;
        categoryScores[categoryName] += normalizedScore;
      });
    });
    
    // Find the category with the highest average score
    let bestCategory = null;
    let bestScore = 0;
    
    Object.entries(categoryScores).forEach(([category, totalScore]) => {
      const averageScore = totalScore / tabs.length;
      if (averageScore > bestScore && averageScore > 0.1) { // Minimum threshold
        bestScore = averageScore;
        bestCategory = category;
      }
    });
    
    return bestCategory;
  }

  /**
   * Get description for a semantic category
   * @param {string} category - Category name
   * @returns {string} - Category description
   */
  getSemanticCategoryDescription(category) {
    const semanticCategories = this.localEmbeddingHandler.getSemanticCategories();
    return semanticCategories[category]?.description || 'Related content';
  }

  /**
   * Run clustering on tabs with specified algorithm
   * @param {Array} tabs - Array of tab objects
   * @param {string} method - Clustering method: 'dbscan' or 'kmeans'
   * @param {Object} options - Clustering options
   * @returns {Promise<Object>} - Clustering results
   */
  async clusterTabs(tabs, method = 'dbscan', options = {}) {
    console.log('🔬 TabGroupingService.clusterTabs called with:', {
      tabCount: tabs.length,
      method,
      options,
      tabTitles: tabs.map(t => t.title)
    });
    
    // Generate embeddings for tabs
    console.log('🧠 Generating embeddings for tabs...');
    const tabEmbeddings = await this.generateEmbeddings(tabs);
    console.log('✅ Generated embeddings:', {
      successfulEmbeddings: tabEmbeddings.length,
      totalTabs: tabs.length
    });
    
    if (tabEmbeddings.length === 0) {
      console.warn('❌ No embeddings generated, returning empty result');
      return { groups: [], relationships: {} };
    }
    
    // Run specified clustering algorithm
    console.log(`🎯 Running ${method} clustering algorithm...`);
    let result;
    if (method === 'dbscan') {
      result = this.runDbscanClustering(tabEmbeddings, options);
    } else if (method === 'kmeans') {
      result = this.runKmeansClustering(tabEmbeddings, options);
    } else if (method === 'semantic') {
      result = this.runSemanticClustering(tabEmbeddings, options);
    } else {
      throw new Error(`Unsupported clustering method: ${method}`);
    }
    
    console.log('🎉 Clustering algorithm completed:', {
      groupsFound: result.groups?.length || 0,
      relationshipsFound: Object.keys(result.relationships || {}).length
    });
    
    return result;
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