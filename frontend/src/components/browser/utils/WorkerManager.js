/**
 * WorkerManager - Web Worker management system for browser component
 * 
 * Provides a unified interface for offloading CPU-intensive tasks to web workers
 * while handling worker lifecycle, communication, and error handling.
 */

import logger from '../../../utils/logger';

// Create a logger instance for this module
const workerLogger = logger.scope('WorkerManager');

// Worker pool configuration
const MAX_WORKERS = 3; // Maximum number of workers to create
const WORKER_TIMEOUT = 30000; // 30 seconds timeout for worker tasks
const WORKER_IDLE_TIMEOUT = 60000; // 1 minute idle timeout before terminating worker

class WorkerManager {
  constructor() {
    this.workers = [];
    this.taskQueue = [];
    this.taskMap = new Map(); // Maps task IDs to their callbacks and timeouts
    this.isInitialized = false;
    this.taskCounter = 0;
  }

  /**
   * Initialize the worker system
   * @returns {Promise<boolean>} Promise resolving to initialization success
   */
  initialize() {
    if (this.isInitialized) {
      return Promise.resolve(true);
    }

    workerLogger.info('Initializing worker system');
    
    try {
      // Check if Web Workers are supported
      if (typeof Worker === 'undefined') {
        workerLogger.error('Web Workers are not supported in this environment');
        return Promise.resolve(false);
      }

      this.isInitialized = true;
      return Promise.resolve(true);
    } catch (error) {
      workerLogger.error(`Failed to initialize worker system: ${error.message}`);
      return Promise.reject(error);
    }
  }

  /**
   * Create a new worker instance
   * @returns {Worker} New worker instance
   * @private
   */
  _createWorker() {
    try {
      const worker = new Worker(new URL('../workers/BrowserWorker.js', import.meta.url));
      
      // Set up message handler
      worker.onmessage = this._handleWorkerMessage.bind(this);
      worker.onerror = this._handleWorkerError.bind(this);
      
      // Track worker metadata
      const workerInfo = {
        worker,
        id: this.workers.length,
        busy: false,
        currentTaskId: null,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        taskCount: 0
      };
      
      this.workers.push(workerInfo);
      workerLogger.info(`Created new worker #${workerInfo.id}`);
      
      // Set up idle timeout
      this._setupIdleTimeout(workerInfo);
      
      return workerInfo;
    } catch (error) {
      workerLogger.error(`Failed to create worker: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set up idle timeout for a worker
   * @param {Object} workerInfo - Worker info object
   * @private
   */
  _setupIdleTimeout(workerInfo) {
    if (workerInfo.idleTimeout) {
      clearTimeout(workerInfo.idleTimeout);
    }

    workerInfo.idleTimeout = setTimeout(() => {
      // Only terminate if the worker is not busy
      if (!workerInfo.busy) {
        this._terminateWorker(workerInfo);
      }
    }, WORKER_IDLE_TIMEOUT);
  }

  /**
   * Terminate a worker
   * @param {Object} workerInfo - Worker info object
   * @private
   */
  _terminateWorker(workerInfo) {
    try {
      workerInfo.worker.terminate();
      
      // Remove from workers array
      const index = this.workers.findIndex(w => w.id === workerInfo.id);
      if (index !== -1) {
        this.workers.splice(index, 1);
      }
      
      workerLogger.info(`Terminated idle worker #${workerInfo.id} after ${Math.round((Date.now() - workerInfo.lastUsedAt) / 1000)}s of inactivity`);
    } catch (error) {
      workerLogger.error(`Error terminating worker #${workerInfo.id}: ${error.message}`);
    }
  }

  /**
   * Get an available worker or create a new one if needed
   * @returns {Object} Worker info object
   * @private
   */
  _getAvailableWorker() {
    // Find an existing idle worker
    const idleWorker = this.workers.find(w => !w.busy);
    if (idleWorker) {
      return idleWorker;
    }
    
    // Create a new worker if below the maximum
    if (this.workers.length < MAX_WORKERS) {
      return this._createWorker();
    }
    
    // No available workers, return the least busy one
    return null;
  }

  /**
   * Handle messages from workers
   * @param {MessageEvent} event - Message event
   * @private
   */
  _handleWorkerMessage(event) {
    const { taskId, type, result, error } = event.data;
    
    // Find the task in the map
    const taskInfo = this.taskMap.get(taskId);
    if (!taskInfo) {
      workerLogger.warn(`Received message for unknown task ID: ${taskId}`);
      return;
    }
    
    // Find the worker by matching the event source
    const workerInfo = this.workers.find(w => w.worker === event.target);
    if (workerInfo) {
      workerInfo.busy = false;
      workerInfo.currentTaskId = null;
      workerInfo.lastUsedAt = Date.now();
      
      // Reset idle timeout
      this._setupIdleTimeout(workerInfo);
    }
    
    // Clear timeout for this task
    if (taskInfo.timeout) {
      clearTimeout(taskInfo.timeout);
    }
    
    // Handle response based on type
    if (type === 'success') {
      taskInfo.resolve(result);
    } else if (type === 'error') {
      taskInfo.reject(new Error(error || 'Unknown worker error'));
    } else {
      taskInfo.reject(new Error(`Unknown response type: ${type}`));
    }
    
    // Remove task from map
    this.taskMap.delete(taskId);
    
    // Process next task in queue if any
    this._processNextTask();
  }

  /**
   * Handle worker errors
   * @param {ErrorEvent} error - Error event
   * @private
   */
  _handleWorkerError(error) {
    workerLogger.error(`Worker error: ${error.message}`);
    
    // Find the worker that errored
    const workerInfo = this.workers.find(w => w.worker === error.target);
    if (workerInfo && workerInfo.currentTaskId) {
      // Get the current task
      const taskInfo = this.taskMap.get(workerInfo.currentTaskId);
      if (taskInfo) {
        // Clear timeout
        if (taskInfo.timeout) {
          clearTimeout(taskInfo.timeout);
        }
        
        // Reject the promise
        taskInfo.reject(new Error(`Worker error: ${error.message}`));
        
        // Remove task from map
        this.taskMap.delete(workerInfo.currentTaskId);
      }
      
      // Mark worker as not busy
      workerInfo.busy = false;
      workerInfo.currentTaskId = null;
      
      // Terminate and recreate the worker
      this._terminateWorker(workerInfo);
      this._createWorker();
    }
    
    // Process next task in queue
    this._processNextTask();
  }

  /**
   * Process the next task in the queue
   * @private
   */
  _processNextTask() {
    if (this.taskQueue.length === 0) {
      return;
    }
    
    // Get the next task
    const nextTask = this.taskQueue.shift();
    
    // Get an available worker
    const workerInfo = this._getAvailableWorker();
    
    // If no worker is available, put the task back in the queue
    if (!workerInfo) {
      this.taskQueue.unshift(nextTask);
      return;
    }
    
    // Assign the task to the worker
    workerInfo.busy = true;
    workerInfo.currentTaskId = nextTask.taskId;
    workerInfo.lastUsedAt = Date.now();
    workerInfo.taskCount++;
    
    // Send the task to the worker
    workerInfo.worker.postMessage({
      taskId: nextTask.taskId,
      type: nextTask.type,
      data: nextTask.data
    });
    
    workerLogger.debug(`Assigned task ${nextTask.taskId} (${nextTask.type}) to worker #${workerInfo.id}`);
  }

  /**
   * Execute a task in a worker
   * @param {string} type - Task type
   * @param {Object} data - Task data
   * @returns {Promise<any>} Promise resolving to the task result
   */
  executeTask(type, data) {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Worker system not initialized'));
    }
    
    return new Promise((resolve, reject) => {
      // Create task ID
      const taskId = `task_${Date.now()}_${this.taskCounter++}`;
      
      // Create timeout for this task
      const timeout = setTimeout(() => {
        workerLogger.warn(`Task ${taskId} (${type}) timed out after ${WORKER_TIMEOUT / 1000}s`);
        
        // Remove task from map
        this.taskMap.delete(taskId);
        
        // Find and reset the worker if it's still processing this task
        const workerInfo = this.workers.find(w => w.currentTaskId === taskId);
        if (workerInfo) {
          workerInfo.busy = false;
          workerInfo.currentTaskId = null;
          
          // Terminate and recreate the worker
          this._terminateWorker(workerInfo);
          this._createWorker();
        }
        
        reject(new Error(`Task ${type} timed out after ${WORKER_TIMEOUT / 1000}s`));
      }, WORKER_TIMEOUT);
      
      // Store task info
      this.taskMap.set(taskId, {
        resolve,
        reject,
        timeout,
        type,
        createdAt: Date.now()
      });
      
      // Add task to queue
      this.taskQueue.push({
        taskId,
        type,
        data
      });
      
      // Start processing the queue
      this._processNextTask();
    });
  }

  /**
   * Clean up all workers
   */
  cleanup() {
    workerLogger.info(`Cleaning up worker system (${this.workers.length} workers)`);
    
    // Terminate all workers
    this.workers.forEach(workerInfo => {
      try {
        clearTimeout(workerInfo.idleTimeout);
        workerInfo.worker.terminate();
      } catch (error) {
        workerLogger.error(`Error terminating worker #${workerInfo.id}: ${error.message}`);
      }
    });
    
    // Clear the workers array
    this.workers = [];
    
    // Reject all pending tasks
    this.taskMap.forEach((taskInfo, taskId) => {
      if (taskInfo.timeout) {
        clearTimeout(taskInfo.timeout);
      }
      taskInfo.reject(new Error('Worker system shutdown'));
    });
    
    // Clear the task map and queue
    this.taskMap.clear();
    this.taskQueue = [];
    
    // Reset initialization flag
    this.isInitialized = false;
  }
}

// Export singleton instance
const workerManager = new WorkerManager();
export default workerManager; 