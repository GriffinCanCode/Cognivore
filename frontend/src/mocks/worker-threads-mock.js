/**
 * Mock implementation of worker_threads for browser environment
 * 
 * This provides empty/stub implementations of the worker_threads API
 * to allow the code to run in a browser context.
 */

// Mock Worker class
class Worker {
  constructor(filename, options = {}) {
    this.filename = filename;
    this.options = options;
    this.threadId = Math.floor(Math.random() * 1000);
    console.warn('Worker threads are not supported in browser context. Created mock worker for:', filename);
  }

  // Mock Worker methods
  postMessage(message) {
    console.warn('Worker.postMessage called in browser context (no-op)');
    return false;
  }

  terminate() {
    console.warn('Worker.terminate called in browser context (no-op)');
    return Promise.resolve();
  }

  ref() {
    return this;
  }

  unref() {
    return this;
  }
}

// Mock MessageChannel
class MessageChannel {
  constructor() {
    this.port1 = {
      on: () => {},
      once: () => {},
      postMessage: () => {}
    };
    this.port2 = {
      on: () => {},
      once: () => {},
      postMessage: () => {}
    };
  }
}

// Export mock implementations
module.exports = {
  Worker,
  MessageChannel,
  MessagePort: class {}, // Empty implementation
  parentPort: null,
  workerData: null,
  threadId: 0,
  resourceLimits: {},
  SHARE_ENV: Symbol('SHARE_ENV'),
  isMainThread: true,
  moveMessagePortToContext: () => null,
  receiveMessageOnPort: () => null,
  markAsUntransferable: () => null,
  workerData: {}
}; 