/**
 * Database Memory Manager Integration Example
 * 
 * This example demonstrates how to integrate the database memory manager
 * with various database systems (PostgreSQL, MongoDB, etc.)
 */

const { 
  dbMemoryManager, 
  registerConnection, 
  optimizeQuery, 
  getStatistics, 
  analyzeQueryPerformance,
  clearQueryCache 
} = require('../index');

// Example database connection factories - replace with your actual DB connections

/**
 * PostgreSQL Integration Example
 */
function integrateWithPostgres(pool) {
  // Register the connection pool with the memory manager
  const monitoredPool = registerConnection('postgres-main', pool, {
    type: 'postgres',
    isPrimary: true
  });
  
  // Example: Wrap frequently used queries with memory optimization
  const getUserById = optimizeQuery(
    async (id) => {
      const result = await monitoredPool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    },
    {
      queryName: 'getUserById',
      enableCache: true, 
      cacheTTLMs: 300000, // 5 minutes cache
      cacheKeyFn: (id) => `user:${id}` // Custom cache key
    }
  );
  
  const searchUsers = optimizeQuery(
    async (searchTerm, limit = 20) => {
      const result = await monitoredPool.query(
        'SELECT * FROM users WHERE name ILIKE $1 OR email ILIKE $1 LIMIT $2', 
        [`%${searchTerm}%`, limit]
      );
      return result.rows;
    }, 
    {
      queryName: 'searchUsers',
      // Don't cache search results as they change frequently
      enableCache: false
    }
  );

  // Example: Get all products with pagination (memory-efficient)
  const getProducts = optimizeQuery(
    async (page = 1, pageSize = 20) => {
      const offset = (page - 1) * pageSize;
      const result = await monitoredPool.query(
        'SELECT * FROM products ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [pageSize, offset]
      );
      return result.rows;
    },
    {
      queryName: 'getProducts',
      enableCache: true,
      cacheTTLMs: 60000 // 1 minute cache for product listing
    }
  );
  
  return {
    pool: monitoredPool,
    queries: {
      getUserById,
      searchUsers,
      getProducts
    }
  };
}

/**
 * MongoDB Integration Example
 */
function integrateWithMongoDB(client) {
  const db = client.db('myDatabase');
  
  // Register MongoDB connection
  const monitoredClient = registerConnection('mongodb-main', client, {
    type: 'mongodb',
    isPrimary: true
  });
  
  // Wrap collection access to apply memory monitoring to all queries
  const getCollection = (collectionName) => {
    const collection = db.collection(collectionName);
    
    // Return a proxy with monitored methods
    return {
      // Optimize common queries
      findById: optimizeQuery(
        async (id) => {
          return collection.findOne({ _id: id });
        },
        { 
          queryName: `${collectionName}.findById`,
          enableCache: true
        }
      ),
      
      findMany: optimizeQuery(
        async (query = {}, options = {}) => {
          return collection.find(query, options).toArray();
        },
        { 
          queryName: `${collectionName}.findMany`,
          // Selectively cache based on query complexity
          enableCache: (query, options) => {
            // Don't cache complex queries or queries with high limits
            if (options.limit > 100) return false;
            if (Object.keys(query).length > 3) return false;
            return true;
          }
        }
      ),
      
      // Pass through other methods
      insertOne: collection.insertOne.bind(collection),
      updateOne: collection.updateOne.bind(collection),
      deleteOne: collection.deleteOne.bind(collection)
    };
  };
  
  return {
    client: monitoredClient,
    db,
    getCollection
  };
}

/**
 * Analyze database performance and memory usage
 */
function analyzeDatabasePerformance() {
  // Get current statistics
  const stats = getStatistics();
  console.log('Database Connection Stats:', stats.connections);
  console.log('Query Performance Stats:', stats.queries);
  console.log('Query Cache Stats:', stats.cache);
  console.log('Memory Usage:', stats.memory);
  
  // Analyze query performance for issues
  const analysis = analyzeQueryPerformance();
  
  // Handle any detected issues
  if (analysis.issues.length > 0) {
    console.warn('Database performance issues detected:');
    
    analysis.issues.forEach(issue => {
      console.warn(`- ${issue.type} (${issue.severity}): ${issue.message}`);
    });
    
    console.log('Recommendations:');
    analysis.recommendations.forEach(rec => {
      console.log(`- ${rec.message}`);
    });
    
    // Take automatic action for serious issues
    const highSeverityIssues = analysis.issues.filter(i => i.severity === 'high');
    if (highSeverityIssues.length > 0) {
      // Example: Clear cache if experiencing memory pressure
      if (highSeverityIssues.some(i => i.type === 'high_utilization')) {
        console.log('Clearing query cache due to high memory utilization');
        clearQueryCache();
      }
    }
  }
  
  return analysis;
}

// Schedule regular performance analysis (e.g., every 5 minutes)
function setupDatabaseMonitoring(intervalMs = 5 * 60 * 1000) {
  // Initial analysis
  analyzeDatabasePerformance();
  
  // Schedule regular analysis
  setInterval(analyzeDatabasePerformance, intervalMs);
  
  console.log(`Database monitoring scheduled (every ${intervalMs/60000} minutes)`);
}

/**
 * Setting up the database with memory management
 */
async function setupDatabase() {
  // Example: For PostgreSQL
  const { Pool } = require('pg'); // You'd normally import this at the top
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'mydatabase',
    // Limit max connections to avoid memory issues
    max: 10
  });
  
  const postgres = integrateWithPostgres(pool);
  
  // Example: For MongoDB
  const { MongoClient } = require('mongodb'); // You'd normally import this at the top
  const mongoClient = new MongoClient(process.env.MONGO_URI || 'mongodb://localhost:27017');
  await mongoClient.connect();
  
  const mongo = integrateWithMongoDB(mongoClient);
  
  // Set up monitoring
  setupDatabaseMonitoring();
  
  return {
    postgres,
    mongo,
    analyzePerformance: analyzeDatabasePerformance
  };
}

module.exports = {
  setupDatabase,
  integrateWithPostgres,
  integrateWithMongoDB,
  analyzeDatabasePerformance,
  setupDatabaseMonitoring
}; 