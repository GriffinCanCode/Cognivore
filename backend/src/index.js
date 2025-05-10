/**
 * Knowledge Store Backend
 * Entry point for the backend services
 */

const config = require('./config');
const { initializeDatabase } = require('./services/database');
const { logger } = require('./utils/logger');

async function main() {
  logger.info('Starting Knowledge Store Backend...');
  
  try {
    // Initialize vector database
    logger.info('Initializing database...');
    const db = await initializeDatabase();
    logger.info(`Database initialized at ${config.database.path}`);
    
    // Database is ready for use by the content processing pipelines
    logger.info('Knowledge Store Backend is ready!');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      process.exit(0);
    });

    // Global error handlers
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', { reason, promise });
    });
  } catch (error) {
    logger.error('Error initializing backend:', error);
    process.exit(1);
  }
}

// Start the backend
main(); 