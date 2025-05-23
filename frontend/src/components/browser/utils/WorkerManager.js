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
const INITIALIZATION_TIMEOUT = 10000; // Increased from 5000 to 10000 ms (10 seconds)

class WorkerManager {
  constructor() {
    this.workers = [];
    this.taskQueue = [];
    this.taskMap = new Map(); // Maps task IDs to their callbacks and timeouts
    this.isInitialized = false;
    this.initializationAttempted = false; // Track if we've attempted initialization
    this.isAvailable = false; // Whether the worker system is actually available
    this.taskCounter = 0;
    this.initializationPromise = null; // Track the current initialization promise
    
    // Task priority queues
    this.highPriorityQueue = [];
    this.normalPriorityQueue = [];
    this.lowPriorityQueue = [];
  }

  /**
   * Check if the worker system is initialized
   * @returns {boolean} True if initialized
   */
  get isInitialized() {
    return this._isInitialized === true;
  }
  
  set isInitialized(value) {
    this._isInitialized = value;
  }

  /**
   * Initialize the worker system
   * @returns {Promise<boolean>} Promise resolving to initialization success
   */
  async initialize() {
    // If we're already initialized, return true immediately
    if (this.isInitialized && this.isAvailable) {
      workerLogger.info('Worker already initialized and available');
      return true;
    }
    
    // If initialization is already in progress, return the existing promise
    if (this.initializationPromise) {
      workerLogger.info('Worker initialization already in progress, returning existing promise');
      return this.initializationPromise;
    }
    
    // Track that we've attempted initialization
    this.initializationAttempted = true;
    
    // Create a new initialization promise
    this.initializationPromise = new Promise(async (resolve) => {
      try {
        workerLogger.info('Initializing worker system');
        
        // Create worker
        const worker = new Worker(new URL('../workers/BrowserWorker.js', import.meta.url));
        let initializationTimeout = null;
        let readyReceived = false;
        
        // Set up one-time ready listener
        const onReady = (event) => {
          if (event.data?.type === 'ready') {
            workerLogger.info('Received ready message from worker');
            readyReceived = true;
            this.isInitialized = true;
            this.isAvailable = true;
            
            // Set up standard message handler after ready is received
            worker.removeEventListener('message', onReady);
            worker.addEventListener('message', this._handleWorkerMessage.bind(this));
            
            // Clear timeout and resolve
            if (initializationTimeout) {
              clearTimeout(initializationTimeout);
              initializationTimeout = null;
            }
            resolve(true);
          }
        };
        
        // Add event listener for ready message
        worker.addEventListener('message', onReady);
        
        // Register extract-content handler to ensure it's available
        if (window.electron && window.electron.ipcRenderer) {
          try {
            workerLogger.info('Registering extract-content handler');
            const result = await window.electron.ipcRenderer.invoke('register-extract-content');
            if (result && result.success) {
              workerLogger.info('Successfully registered extract-content handler');
            } else {
              workerLogger.warn('Failed to register extract-content handler:', result);
            }
          } catch (error) {
            workerLogger.error('Error registering extract-content handler:', error);
            // Continue initialization even if this fails
          }
        }
        
        // Set up error handler
        const onError = (error) => {
          workerLogger.error(`Worker error during initialization: ${error.message || 'Unknown error'}`);
          
          // Clear timeout and resolve as failed
          if (initializationTimeout) {
            clearTimeout(initializationTimeout);
            initializationTimeout = null;
          }
          
          // Even if there's an error, keep the worker alive in case it recovers
          if (!readyReceived) {
            this.isInitialized = false;
            this.isAvailable = false;
            resolve(false);
          }
        };
        
        worker.addEventListener('error', onError);
        
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
        workerLogger.info(`Created worker #${workerInfo.id}`);
        
        // Set up idle timeout
        this._setupIdleTimeout(workerInfo);
        
        // Send initialization message
        workerLogger.info('Sending init message to worker');
        worker.postMessage({ type: 'init' });
        
        // Set timeout for initialization
        initializationTimeout = setTimeout(() => {
          if (!readyReceived) {
            workerLogger.error('Worker initialization timed out - no ready message received');
            this.isInitialized = false;
            this.isAvailable = false;
            resolve(false);
            
            // Clean up event listeners
            worker.removeEventListener('message', onReady);
            worker.removeEventListener('error', onError);
          }
        }, INITIALIZATION_TIMEOUT);
      } catch (error) {
        workerLogger.error(`Worker initialization error: ${error.message}`);
        this.isInitialized = false;
        this.isAvailable = false;
        resolve(false);
      } finally {
        // Reset initialization promise when we complete (success or failure)
        // This allows future calls to try again
        setTimeout(() => {
          this.initializationPromise = null;
        }, 0);
      }
    });
    
    return this.initializationPromise;
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
      this.isAvailable = false; // Mark worker system as unavailable on error
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
      
      // If we terminate all workers, we're no longer initialized or available
      if (this.workers.length === 0) {
        this.isInitialized = false;
        this.isAvailable = false;
      }
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
    
    // Log worker messages
    if (type === 'log') {
      const { level, message } = event.data;
      if (level === 'error') {
        workerLogger.error(`[Worker] ${message}`);
      } else if (level === 'warn') {
        workerLogger.warn(`[Worker] ${message}`);
      } else {
        workerLogger.info(`[Worker] ${message}`);
      }
      return;
    }
    
    // Handle ready message separately
    if (type === 'ready') {
      workerLogger.info('Worker sent ready message');
      this.isInitialized = true;
      this.isAvailable = true;
      return;
    }
    
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
    
    // Process next task in queue
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
      try {
        this._createWorker();
      } catch (e) {
        workerLogger.error(`Failed to recreate worker after error: ${e.message}`);
        this.isAvailable = false;
      }
    }
    
    // Process next task in queue
    this._processNextTask();
  }

  /**
   * Process the next task in the queue, respecting priority
   * @private
   */
  _processNextTask() {
    // Check all queues in priority order
    let nextTask = null;
    
    if (this.highPriorityQueue.length > 0) {
      nextTask = this.highPriorityQueue.shift();
    } else if (this.normalPriorityQueue.length > 0) {
      nextTask = this.normalPriorityQueue.shift();
    } else if (this.lowPriorityQueue.length > 0) {
      nextTask = this.lowPriorityQueue.shift();
    } else if (this.taskQueue.length > 0) {
      // Legacy queue for backward compatibility
      nextTask = this.taskQueue.shift();
    }
    
    if (!nextTask) {
      return;
    }
    
    // Make sure we're initialized and available
    if (!this.isInitialized || !this.isAvailable) {
      // Add the task back to its queue
      if (nextTask.priority === 'high') {
        this.highPriorityQueue.unshift(nextTask);
      } else if (nextTask.priority === 'low') {
        this.lowPriorityQueue.unshift(nextTask);
      } else {
        this.normalPriorityQueue.unshift(nextTask);
      }
      
      // Resolve the task with an error
      const taskInfo = this.taskMap.get(nextTask.taskId);
      if (taskInfo) {
        taskInfo.reject(new Error('Worker system not initialized or available'));
        
        // Remove task from map
        this.taskMap.delete(nextTask.taskId);
      }
      
      return;
    }
    
    // Get an available worker
    let workerInfo;
    try {
      workerInfo = this._getAvailableWorker();
    } catch (error) {
      workerLogger.error(`Failed to get available worker: ${error.message}`);
      this.isAvailable = false;
      
      // Reject the task
      const taskInfo = this.taskMap.get(nextTask.taskId);
      if (taskInfo) {
        taskInfo.reject(new Error(`Worker error: ${error.message}`));
        this.taskMap.delete(nextTask.taskId);
      }
      
      return;
    }
    
    // If no worker is available, put the task back in the appropriate queue
    if (!workerInfo) {
      if (nextTask.priority === 'high') {
        this.highPriorityQueue.unshift(nextTask);
      } else if (nextTask.priority === 'low') {
        this.lowPriorityQueue.unshift(nextTask);
      } else {
        this.normalPriorityQueue.unshift(nextTask);
      }
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
   * @param {Object} options - Task options including priority
   * @returns {Promise<any>} Promise resolving to the task result
   */
  executeTask(type, data, options = {}) {
    // If we haven't tried to initialize yet, do it now
    if (!this.initializationAttempted) {
      return this.initialize().then(success => {
        if (!success) {
          return Promise.reject(new Error('Worker system initialization failed'));
        }
        return this.executeTask(type, data, options);
      });
    }
    
    // Check if worker system is available
    if (!this.isInitialized || !this.isAvailable) {
      return Promise.reject(new Error('Worker system not initialized or available'));
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
          try {
            this._createWorker();
          } catch (e) {
            workerLogger.error(`Failed to recreate worker after timeout: ${e.message}`);
            this.isAvailable = false;
          }
        }
        
        reject(new Error(`Task ${type} timed out after ${WORKER_TIMEOUT / 1000}s`));
      }, options.timeout || WORKER_TIMEOUT);
      
      // Store task info
      this.taskMap.set(taskId, {
        resolve,
        reject,
        timeout,
        type,
        createdAt: Date.now()
      });
      
      // Create task object with priority
      const task = {
        taskId,
        type,
        data,
        priority: options.priority || 'normal'
      };
      
      // Add task to the appropriate queue
      if (task.priority === 'high') {
        this.highPriorityQueue.push(task);
      } else if (task.priority === 'low') {
        this.lowPriorityQueue.push(task);
      } else {
        this.normalPriorityQueue.push(task);
      }
      
      // Start processing the queue
      this._processNextTask();
    });
  }
  
  /**
   * Execute multiple tasks in a batch
   * This is more efficient than calling executeTask multiple times
   * @param {Array<Object>} tasks - Array of task objects with type and data
   * @param {Object} options - Batch options
   * @returns {Promise<Array<any>>} Promise resolving to an array of results
   */
  executeBatchTasks(tasks, options = {}) {
    // If we haven't tried to initialize yet, do it now
    if (!this.initializationAttempted) {
      return this.initialize().then(success => {
        if (!success) {
          return Promise.reject(new Error('Worker system initialization failed'));
        }
        return this.executeBatchTasks(tasks, options);
      });
    }
    
    // Check if worker system is initialized
    if (!this.isInitialized || !this.isAvailable) {
      return Promise.reject(new Error('Worker system not initialized or available'));
    }
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return Promise.resolve([]);
    }
    
    // For a single task, just use regular executeTask
    if (tasks.length === 1) {
      return this.executeTask(tasks[0].type, tasks[0].data, options)
        .then(result => [result]);
    }
    
    // Prepare tasks with IDs
    const tasksWithIds = tasks.map((task, index) => ({
      type: task.type,
      data: task.data,
      taskId: `batch_${Date.now()}_${index}`
    }));
    
    // Execute the batch processing task
    return this.executeTask('batch-process', { tasks: tasksWithIds }, options)
      .then(batchResult => {
        if (!batchResult.success) {
          throw new Error(batchResult.error || 'Batch processing failed');
        }
        
        // Extract and transform results
        return batchResult.results.map(taskResult => {
          if (!taskResult.success) {
            throw new Error(taskResult.error || 'Task in batch failed');
          }
          return taskResult.result;
        });
      });
  }
  
  /**
   * Execute a task with high priority
   * @param {string} type - Task type
   * @param {Object} data - Task data
   * @param {Object} options - Additional options
   * @returns {Promise<any>} Promise resolving to the task result
   */
  executeHighPriorityTask(type, data, options = {}) {
    return this.executeTask(type, data, { ...options, priority: 'high' });
  }

  /**
   * Execute a task with low priority
   * @param {string} type - Task type
   * @param {Object} data - Task data
   * @param {Object} options - Additional options
   * @returns {Promise<any>} Promise resolving to the task result
   */
  executeLowPriorityTask(type, data, options = {}) {
    return this.executeTask(type, data, { ...options, priority: 'low' });
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
    this.highPriorityQueue = [];
    this.normalPriorityQueue = [];
    this.lowPriorityQueue = [];
    
    // Reset initialization flags
    this.isInitialized = false;
    this.isAvailable = false;
    this.initializationPromise = null;
  }
}

// Export singleton instance
const workerManager = new WorkerManager();
export default workerManager; 