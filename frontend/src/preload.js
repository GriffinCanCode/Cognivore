const { contextBridge, ipcRenderer, net } = require('electron');
const http = require('http');
const https = require('https');
const url = require('url');

// Inline logger to avoid module issues in the preload context
const log = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, error) => console.error(`[ERROR] ${message}`, error)
};

// Define API methods to expose to renderer process
const api = {
  // PDF processing
  processPDF: async (filePath) => {
    try {
      return await ipcRenderer.invoke('process-pdf', filePath);
    } catch (error) {
      log.error('Error processing PDF:', error);
      throw error;
    }
  },
  
  // URL processing
  processURL: async (url) => {
    try {
      return await ipcRenderer.invoke('process-url', url);
    } catch (error) {
      log.error('Error processing URL:', error);
      throw error;
    }
  },
  
  // YouTube URL processing
  processYouTube: async (url) => {
    try {
      return await ipcRenderer.invoke('process-youtube', url);
    } catch (error) {
      log.error('Error processing YouTube URL:', error);
      throw error;
    }
  },
  
  // List all items in the database
  listItems: async () => {
    try {
      return await ipcRenderer.invoke('list-items');
    } catch (error) {
      log.error('Error listing items:', error);
      throw error;
    }
  },
  
  // Delete an item from the database
  deleteItem: async (itemId) => {
    try {
      return await ipcRenderer.invoke('delete-item', itemId);
    } catch (error) {
      log.error('Error deleting item:', error);
      throw error;
    }
  },
  
  // Search items in the database
  search: async (query, limit = 10) => {
    try {
      return await ipcRenderer.invoke('search', { query, limit });
    } catch (error) {
      log.error('Error searching:', error);
      throw error;
    }
  }
};

// Server proxy to handle HTTP requests to backend using electron.net
const serverProxy = {
  // Base URL for the backend API
  baseUrl: 'http://localhost:3001',
  
  // Net request wrapper with standard error handling
  async request(url, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // Make sure we're using the right port (3001, not 3000)
        const correctUrl = url.replace('localhost:3000', 'localhost:3001');
        
        // Check if net module is available
        if (!net || typeof net.request !== 'function') {
          log.error('Electron net module is not available, using Node.js http/https fallback');
          return this.nodeFetchRequest(correctUrl, options, resolve, reject);
        }

        const fullUrl = correctUrl.startsWith('http') ? correctUrl : `${this.baseUrl}${correctUrl}`;
        log.info(`Making request to: ${fullUrl}`);
        
        const request = net.request({
          method: options.method || 'GET',
          url: fullUrl,
          ...(options.protocol && { protocol: options.protocol }),
          ...(options.session && { session: options.session })
        });
        
        // Add headers
        const headers = {
          'Content-Type': 'application/json',
          ...options.headers
        };
        
        Object.entries(headers).forEach(([key, value]) => {
          request.setHeader(key, value);
        });
        
        // Handle response
        let responseData = '';
        
        request.on('response', (response) => {
          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });
          
          response.on('end', () => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
              try {
                // Check if response is empty
                if (!responseData.trim()) {
                  resolve({});
                  return;
                }
                
                // Parse JSON response
                const data = JSON.parse(responseData);
                resolve(data);
              } catch (error) {
                log.error('Error parsing response:', error);
                reject(new Error(`Error parsing response: ${error.message}`));
              }
            } else {
              log.error(`HTTP Error ${response.statusCode}:`, responseData);
              reject(new Error(`HTTP Error ${response.statusCode}: ${responseData}`));
            }
          });
        });
        
        request.on('error', (error) => {
          log.error(`Request error for ${fullUrl}:`, error);
          reject(error);
        });
        
        // Write request body if provided
        if (options.body) {
          const bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
          request.write(bodyData);
        }
        
        request.end();
      } catch (error) {
        log.error(`Failed to create request for ${url}:`, error);
        reject(error);
      }
    });
  },
  
  // Fallback HTTP implementation using Node.js http/https modules
  nodeFetchRequest(url, options = {}, resolve, reject) {
    try {
      const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
      log.info(`Making fallback request to: ${fullUrl}`);
      
      // Parse URL
      const parsedUrl = new URL(fullUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const requestModule = isHttps ? https : http;
      
      // Prepare request options
      const requestOptions = {
        method: options.method || 'GET',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        timeout: 10000 // Add 10 second timeout for requests
      };
      
      // Create request
      const req = requestModule.request(requestOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk.toString();
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              // Check if response is empty
              if (!responseData.trim()) {
                resolve({});
                return;
              }
              
              // Parse JSON response
              const data = JSON.parse(responseData);
              resolve(data);
            } catch (error) {
              log.error('Error parsing response:', error);
              reject(new Error(`Error parsing response: ${error.message}`));
            }
          } else {
            log.error(`HTTP Error ${res.statusCode}:`, responseData);
            reject(new Error(`HTTP Error ${res.statusCode}: ${responseData}`));
          }
        });
      });
      
      req.on('error', (error) => {
        // Check specifically for connection refused error which indicates server not running
        if (error.code === 'ECONNREFUSED') {
          log.error(`Backend server connection refused at ${fullUrl}. Please ensure the server is running on port 3001.`);
          reject(new Error('Backend server is not available. Please start the backend server.'));
        } else {
          log.error(`Request error for ${fullUrl}:`, error);
          reject(error);
        }
      });
      
      // Add timeout handler
      req.on('timeout', () => {
        req.abort();
        log.error(`Request timeout for ${fullUrl}`);
        reject(new Error(`Request timeout for ${fullUrl}`));
      });
      
      // Write request body if provided
      if (options.body) {
        const bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        req.write(bodyData);
      }
      
      req.end();
    } catch (error) {
      log.error(`Failed to create fallback request for ${url}:`, error);
      reject(error);
    }
  },
  
  // Check health endpoint to verify backend is running
  async checkHealth() {
    log.info('Checking backend health status at /api/health');
    try {
      const result = await this.request('/api/health');
      log.info('Backend health status:', result);
      return result;
    } catch (error) {
      log.error('Backend health check failed:', error);
      throw error;
    }
  },
  
  // Get config
  async getConfig() {
    return this.request('/api/llm/config');
  },
  
  // Chat with LLM
  async chat(data) {
    return this.request('/api/llm/chat', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  
  // Execute tool call
  async executeToolCall(data) {
    return this.request('/api/llm/execute-tool', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  
  // Generate embeddings
  async generateEmbeddings(data) {
    return this.request('/api/llm/embeddings', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};

// Expose the APIs to the renderer process
try {
  contextBridge.exposeInMainWorld('api', api);
  contextBridge.exposeInMainWorld('server', serverProxy);
  log.info('API exposed to renderer process');
} catch (error) {
  log.error('Failed to expose API:', error);
} 