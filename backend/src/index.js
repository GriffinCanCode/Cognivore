/**
 * Knowledge Store Backend
 * Entry point for the backend services
 */

const config = require('./config');
const { initializeDatabase } = require('./services/database');

async function main() {
  console.log('Starting Knowledge Store Backend...');
  
  try {
    // Initialize vector database
    console.log('Initializing database...');
    const db = await initializeDatabase();
    console.log(`Database initialized at ${config.database.path}`);
    
    // Database is ready for use by the content processing pipelines
    console.log('Knowledge Store Backend is ready!');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error initializing backend:', error);
    process.exit(1);
  }
}

// Start the backend
main(); 