/**
 * clusteringUtils.js - Utilities for clustering tabs based on content similarity
 * 
 * This module provides implementations of clustering algorithms and similarity metrics
 * for grouping tabs based on their content embeddings.
 */

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {Array} vector1 - First embedding vector
 * @param {Array} vector2 - Second embedding vector
 * @returns {number} - Cosine similarity (0-1 where 1 is identical)
 */
export function calculateCosineSimilarity(vector1, vector2) {
  if (!vector1 || !vector2 || vector1.length !== vector2.length) {
    return 0;
  }
  
  // Calculate dot product
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  // Prevent division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  // Calculate cosine similarity
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate distance matrix between all vectors
 * @param {Array} vectors - Array of embedding vectors
 * @param {Function} distanceFunction - Function to calculate distance between vectors
 * @returns {Array} - 2D distance matrix
 */
function calculateDistanceMatrix(vectors, distanceFunction) {
  const n = vectors.length;
  const distanceMatrix = Array(n).fill().map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // For cosine similarity, distance is 1 - similarity
      const similarity = distanceFunction(vectors[i], vectors[j]);
      const distance = 1 - similarity;
      
      distanceMatrix[i][j] = distance;
      distanceMatrix[j][i] = distance; // Matrix is symmetric
    }
  }
  
  return distanceMatrix;
}

/**
 * DBSCAN clustering algorithm implementation
 * @param {Array} vectors - Array of embedding vectors
 * @param {Function} similarityFunction - Function to calculate similarity
 * @param {number} epsilon - Maximum distance between points in same cluster
 * @param {number} minPoints - Minimum points to form a cluster
 * @returns {Array} - Array of cluster assignments (one per vector)
 */
export function dbscanClustering(vectors, similarityFunction, epsilon = 0.3, minPoints = 2) {
  if (!vectors || vectors.length === 0) {
    return [];
  }
  
  const n = vectors.length;
  const distanceMatrix = calculateDistanceMatrix(vectors, similarityFunction);
  
  // Initialize state
  const visited = Array(n).fill(false);
  const clusterAssignments = Array(n).fill(-1); // -1 means noise
  let currentCluster = 0;
  
  /**
   * Expand cluster from a core point
   * @param {number} pointIndex - Index of core point
   * @param {number} clusterIndex - Current cluster index
   */
  function expandCluster(pointIndex, clusterIndex) {
    clusterAssignments[pointIndex] = clusterIndex;
    
    // Find neighbors
    const neighbors = [];
    for (let i = 0; i < n; i++) {
      if (distanceMatrix[pointIndex][i] <= epsilon) {
        neighbors.push(i);
      }
    }
    
    // Process neighbors
    for (let i = 0; i < neighbors.length; i++) {
      const neighborIndex = neighbors[i];
      
      if (!visited[neighborIndex]) {
        visited[neighborIndex] = true;
        
        // Find neighbor's neighbors
        const neighborNeighbors = [];
        for (let j = 0; j < n; j++) {
          if (distanceMatrix[neighborIndex][j] <= epsilon) {
            neighborNeighbors.push(j);
          }
        }
        
        // If neighbor is a core point, add its neighbors
        if (neighborNeighbors.length >= minPoints) {
          neighborNeighbors.forEach(nn => {
            if (!neighbors.includes(nn)) {
              neighbors.push(nn);
            }
          });
        }
      }
      
      // Add neighbor to cluster if not already assigned
      if (clusterAssignments[neighborIndex] === -1) {
        clusterAssignments[neighborIndex] = clusterIndex;
      }
    }
  }
  
  // Main DBSCAN algorithm
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    
    visited[i] = true;
    
    // Find neighbors
    const neighbors = [];
    for (let j = 0; j < n; j++) {
      if (distanceMatrix[i][j] <= epsilon) {
        neighbors.push(j);
      }
    }
    
    // Check if core point
    if (neighbors.length >= minPoints) {
      expandCluster(i, currentCluster);
      currentCluster++;
    }
  }
  
  return clusterAssignments;
}

/**
 * K-means clustering algorithm implementation
 * @param {Array} vectors - Array of embedding vectors
 * @param {number} k - Number of clusters
 * @param {Function} similarityFunction - Function to calculate similarity
 * @returns {Array} - Array of cluster assignments (one per vector)
 */
export function kMeansClustering(vectors, k, similarityFunction) {
  if (!vectors || vectors.length === 0) {
    return [];
  }
  
  const n = vectors.length;
  
  // If fewer vectors than k, assign each to own cluster
  if (n <= k) {
    return vectors.map((_, i) => i);
  }
  
  // Initialize centroids by selecting k random vectors
  const centroidIndices = [];
  while (centroidIndices.length < k) {
    const randomIndex = Math.floor(Math.random() * n);
    if (!centroidIndices.includes(randomIndex)) {
      centroidIndices.push(randomIndex);
    }
  }
  
  let centroids = centroidIndices.map(i => vectors[i]);
  let clusterAssignments = Array(n).fill(-1);
  let previousAssignments = Array(n).fill(-2); // Different from initial assignments
  let iterations = 0;
  const maxIterations = 100;
  
  // Keep iterating until convergence or max iterations
  while (!arraysEqual(clusterAssignments, previousAssignments) && iterations < maxIterations) {
    // Save previous assignments
    previousAssignments = [...clusterAssignments];
    
    // Assign each vector to nearest centroid
    for (let i = 0; i < n; i++) {
      let maxSimilarity = -1;
      let bestCluster = -1;
      
      for (let j = 0; j < k; j++) {
        const similarity = similarityFunction(vectors[i], centroids[j]);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestCluster = j;
        }
      }
      
      clusterAssignments[i] = bestCluster;
    }
    
    // Recalculate centroids
    centroids = Array(k).fill().map(() => []);
    const counts = Array(k).fill(0);
    
    // Initialize empty centroids with correct dimensions
    for (let j = 0; j < k; j++) {
      centroids[j] = Array(vectors[0].length).fill(0);
    }
    
    // Sum vectors for each cluster
    for (let i = 0; i < n; i++) {
      const cluster = clusterAssignments[i];
      if (cluster !== -1) {
        for (let d = 0; d < vectors[i].length; d++) {
          centroids[cluster][d] += vectors[i][d];
        }
        counts[cluster]++;
      }
    }
    
    // Normalize sums to get mean (centroid)
    for (let j = 0; j < k; j++) {
      // If no vectors assigned to this cluster
      if (counts[j] === 0) {
        // Assign a random vector as centroid
        const randomIndex = Math.floor(Math.random() * n);
        centroids[j] = vectors[randomIndex];
      } else {
        // Calculate mean
        for (let d = 0; d < centroids[j].length; d++) {
          centroids[j][d] /= counts[j];
        }
      }
    }
    
    iterations++;
  }
  
  return clusterAssignments;
}

/**
 * Helper function to check if two arrays are equal
 * @param {Array} arr1 - First array
 * @param {Array} arr2 - Second array
 * @returns {boolean} - Whether arrays are equal
 */
function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  
  return true;
}

/**
 * Simple normalization for embedding vectors
 * @param {Array} vector - Vector to normalize
 * @returns {Array} - Normalized vector
 */
export function normalizeVector(vector) {
  if (!vector || vector.length === 0) return vector;
  
  // Calculate magnitude
  let magnitude = 0;
  for (let i = 0; i < vector.length; i++) {
    magnitude += vector[i] * vector[i];
  }
  magnitude = Math.sqrt(magnitude);
  
  // Prevent division by zero
  if (magnitude === 0) return vector;
  
  // Normalize
  return vector.map(v => v / magnitude);
} 