const { contextBridge, ipcRenderer, net } = require('electron');
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { app } = require('electron').remote || { app: null };

// Create backend object immediately for global use
let backend = {
  isElectron: true
};

// Inline logger to avoid module issues in the preload context
const log = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, error) => console.error(`[ERROR] ${message}`, error)
};

// Define API methods to expose to renderer process
const api = {
  // File system utilities
  checkFileExists: (filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      log.error(`Error checking if file exists (${filePath}):`, error);
      return false;
    }
  },
  
  getAppPath: () => {
    try {
      // Try to use remote if available
      if (app) {
        return app.getAppPath();
      }
      // Fallback to a reasonable guess
      return path.resolve(path.join(__dirname, '..'));
    } catch (error) {
      log.error('Error getting app path:', error);
      return '';
    }
  },
  
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
  },
  
  // List all files tool
  listAllFiles: async (params = {}) => {
    try {
      log.info('Listing all files', params);
      return await ipcRenderer.invoke('list-all-files', params);
    } catch (error) {
      log.error('Error listing all files:', error);
      throw error;
    }
  },
  
  // List files by type tool
  listFilesByType: async (params) => {
    try {
      log.info(`Listing files by type: ${params.fileType}`);
      return await ipcRenderer.invoke('list-files-by-type', params);
    } catch (error) {
      log.error('Error listing files by type:', error);
      throw error;
    }
  },
  
  // List files with content tool
  listFilesWithContent: async (params) => {
    try {
      log.info(`Listing files with content: ${params.contentQuery}`);
      return await ipcRenderer.invoke('list-files-with-content', params);
    } catch (error) {
      log.error('Error listing files with content:', error);
      throw error;
    }
  },
  
  // List recent files tool
  listRecentFiles: async (params = {}) => {
    try {
      log.info(`Listing recent files: ${params.days} days`);
      return await ipcRenderer.invoke('list-recent-files', params);
    } catch (error) {
      log.error('Error listing recent files:', error);
      throw error;
    }
  },
  
  // Chat with LLM
  async chat(data) {
    log.info('Sending chat request via IPC');
    try {
      try {
        // Add request info for debugging
        log.info(`Chat request details: message length: ${data.message?.length || 0}, history items: ${data.chatHistory?.length || 0}`);
        
        // Add timeout for IPC call
        const result = await Promise.race([
          ipcRenderer.invoke('chat', data),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('IPC chat request timed out after 20 seconds')), 20000)
          )
        ]);
        
        // Log successful response
        log.info('Received chat response via IPC');
        return result;
      } catch (ipcError) {
        // Special handling for API key errors
        if (ipcError && ipcError.message && ipcError.message.includes('Google API key is not configured')) {
          // Use warning level instead of error since this is a handled condition
          log.info('IPC chat not available due to missing API key - this is expected and being handled');
          log.info('API key not configured, showing guidance');
          return {
            content: `⚠️ Google API Key Not Configured

You need to set up your Google API key to use the chat functionality. Please follow these steps:

1. Create a file named \`.env\` in the \`backend\` directory 
2. Add this line to the file:
   \`\`\`
   GOOGLE_API_KEY=your_actual_api_key_here
   \`\`\`
3. Restart the application

You can get your Google API key from: https://ai.google.dev/`,
            apiKeyMissing: true
          };
        }
        
        // This is for other errors that we need to handle differently
        log.error('IPC chat failed, error details:', ipcError);
        
        // Check if this is a timeout error
        if (ipcError.message?.includes('timed out')) {
          log.error('IPC request timed out, falling back to HTTP');
        }
        
        // Fall back to HTTP request with detailed error handling
        log.info('Falling back to HTTP chat request');
        try {
          const httpResult = await serverProxy.request('/api/llm/chat', {
            method: 'POST',
            body: JSON.stringify(data)
          });
          log.info('HTTP fallback chat request succeeded');
          return httpResult;
        } catch (httpError) {
          log.error('HTTP fallback also failed:', httpError.message);
          throw new Error(`Chat request failed on both IPC and HTTP: ${httpError.message}`);
        }
      }
    } catch (error) {
      log.error('Chat request failed completely:', error.message);
      throw error;
    }
  }
};

// Server proxy to handle communication with backend
const serverProxy = {
  // Base URL for the backend API (fallback only)
  baseUrl: 'http://localhost:3001',
  
  // HTTP request helper for fallback
  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    log.info(`Making fallback request to: ${url}`);
    
    try {
      // Try to use Electron's net module first if available
      if (typeof electron !== 'undefined' && electron.net) {
        return new Promise((resolve, reject) => {
          const request = electron.net.request({
            url,
            method: options.method || 'GET'
          });
          
          request.on('response', (response) => {
            let body = '';
            response.on('data', (chunk) => {
              body += chunk.toString();
            });
            
            response.on('end', () => {
              try {
                resolve(JSON.parse(body));
              } catch (e) {
                resolve(body);
              }
            });
          });
          
          request.on('error', (error) => {
            reject(error);
          });
          
          if (options.body) {
            request.write(options.body);
          }
          
          request.end();
        });
      } else {
        // Fallback to Node.js http/https when Electron net is not available
        log.error('Electron net module is not available, using Node.js http/https fallback', electron);
        
        // Use global fetch API if available
        if (typeof fetch === 'function') {
          const response = await fetch(url, {
            method: options.method || 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...options.headers
            },
            body: options.body
          });
          
          return await response.json();
        } else {
          // Ultimate fallback using XHR if nothing else works
          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(options.method || 'GET', url);
            xhr.setRequestHeader('Content-Type', 'application/json');
            
            for (const header in options.headers || {}) {
              xhr.setRequestHeader(header, options.headers[header]);
            }
            
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                  resolve(xhr.responseText);
                }
              } else {
                reject(new Error(`HTTP request failed with status ${xhr.status}`));
              }
            };
            
            xhr.onerror = () => {
              reject(new Error('Network request failed'));
            };
            
            xhr.send(options.body);
          });
        }
      }
    } catch (error) {
      log.error('Error making HTTP request:', error);
      throw error;
    }
  },
  
  // Chat with LLM - add this to match what LlmService expects
  async chat(data) {
    log.info('Server proxy: Delegating chat request to API');
    return api.chat(data);
  },
  
  // Check health endpoint to verify backend is running
  async checkHealth() {
    log.info('Checking backend health status via IPC');
    try {
      // First try IPC
      try {
        const result = await ipcRenderer.invoke('check-health');
        log.info('Backend health status via IPC:', result);
        return result;
      } catch (ipcError) {
        log.error('IPC health check failed, falling back to HTTP:', ipcError);
        
        // Fall back to HTTP request
        return this.request('/api/health');
      }
    } catch (error) {
      log.error('Backend health check failed:', error);
      throw error;
    }
  },
  
  // Get config 
  async getConfig() {
    log.info('Getting LLM config via IPC');
    try {
      try {
        return await ipcRenderer.invoke('get-config');
      } catch (ipcError) {
        log.error('IPC getConfig failed, falling back to HTTP:', ipcError);
        return this.request('/api/llm/config');
      }
    } catch (error) {
      log.error('Failed to get config:', error);
      throw error;
    }
  },
  
  // Execute tool call
  async executeToolCall(data) {
    log.info('Executing tool call via IPC');
    try {
      try {
        return await ipcRenderer.invoke('execute-tool-call', data);
      } catch (ipcError) {
        log.error('IPC executeToolCall failed, falling back to HTTP:', ipcError);
        return this.request('/api/llm/execute-tool', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
    } catch (error) {
      log.error('Execute tool call failed:', error);
      throw error;
    }
  },
  
  // Generate embeddings
  async generateEmbeddings(data) {
    log.info('Generating embeddings via IPC');
    try {
      try {
        return await ipcRenderer.invoke('generate-embeddings', data);
      } catch (ipcError) {
        log.error('IPC generateEmbeddings failed, falling back to HTTP:', ipcError);
        return this.request('/api/llm/embeddings', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
    } catch (error) {
      log.error('Generate embeddings failed:', error);
      throw error;
    }
  },
  
  // Net request wrapper with standard error handling (keeping as fallback)
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
  }
};

// Add IPC methods to server proxy to bridge missing functionality
serverProxy.ipc = {
  // Other methods might be added here as needed
  invoke: async (channel, ...args) => {
    log.info(`Server proxy: Invoking IPC method: ${channel}`);
    if (channel === 'settings:save') {
      try {
        log.info('Server proxy: Saving settings via IPC');
        return await ipcRenderer.invoke(channel, ...args);
      } catch (error) {
        log.error('Error saving settings via IPC:', error);
        throw error;
      }
    } else if (channel === 'settings:get') {
      try {
        log.info('Server proxy: Getting settings via IPC');
        return await ipcRenderer.invoke(channel, ...args);
      } catch (error) {
        log.error('Error getting settings via IPC:', error);
        throw error;
      }
    } else {
      // For other channels, pass through to ipcRenderer
      return await ipcRenderer.invoke(channel, ...args);
    }
  }
};

// Expose backend object to allow renderer to know it's running in Electron
contextBridge.exposeInMainWorld('backend', {
  isElectron: true
});

// Expose specific API functions to renderer
contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('server', serverProxy);

// Expose electron-specific helpers that combine functionality
contextBridge.exposeInMainWorld('electron', {
  // Pass session for webRequest
  session: (process.versions.electron ? { defaultSession: null } : null),
  
  // File system helpers
  checkFileExists: api.checkFileExists,
  getAppPath: api.getAppPath,
  
  // Existing methods
  ipcRenderer: {
    invoke: (channel, ...args) => {
      const validChannels = [
        'check-health', 'get-config', 'process-pdf', 'process-url', 'process-youtube',
        'delete-item', 'list-items', 'save-browser-content', 'search',
        'list-all-files', 'list-files-by-type', 'list-files-with-content', 'list-recent-files',
        'get-available-tools', 'execute-tool', 'generate-summary', 'chat',
        'generate-embeddings', 'execute-tool-call', 'semantic-search',
        'get-story-chapters', 'get-story-chapter-content', 'setup-header-bypass',
        'settings:get', 'settings:save', 'settings:clear', 'settings:testApiKey'
      ];
      
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      
      throw new Error(`Channel "${channel}" is not allowed for security reasons.`);
    },
    
    send: (channel, ...args) => {
      const validChannels = [
        'app-ready', 'setup-header-bypass'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    }
  }
});

// Expose the APIs to the renderer process
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Example: send: (channel, data) => ipcRenderer.send(channel, data),
    // Example: invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    // Example: on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),

    // Add new methods for anthology
    getStoryChapters: () => ipcRenderer.invoke('get-story-chapters'),
    getStoryChapterContent: (fileName) => ipcRenderer.invoke('get-story-chapter-content', fileName),

    // Make sure to list any other existing exposed functionalities if this file is being appended to.
    // For example, if there was a getConfig method:
    // getConfig: () => ipcRenderer.invoke('get-config'),

    // If there was a chat function:
    // sendChatMessage: (message) => ipcRenderer.invoke('chat-message', message),
    // onChatMessageResponse: (callback) => ipcRenderer.on('chat-message-response', (_event, ...args) => callback(...args)),
    
    // Placeholder for other pre-existing API calls, ensure they are preserved
    // listItems: (filter) => ipcRenderer.invoke('list-items', filter),
    // getItem: (id) => ipcRenderer.invoke('get-item', id),
    // processPdf: (filePath) => ipcRenderer.invoke('process-pdf', filePath),
    // processUrl: (url) => ipcRenderer.invoke('process-url', url),
    // processYoutubeUrl: (youtubeUrl) => ipcRenderer.invoke('process-youtube-url', youtubeUrl),
    // deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
    // executeTool: (toolName, params) => ipcRenderer.invoke('execute-tool', toolName, params)
  });

  console.log('Preload script loaded and electronAPI exposed.');
} catch (error) {
  log.error('Failed to expose API:', error);
}

// Add special handler for webview management
contextBridge.exposeInMainWorld('webviewHelper', {
  getPreloadPath: () => {
    // Return the current preload script path if needed by webviews
    return __filename;
  },
  
  disableCSP: (webviewElement) => {
    if (webviewElement && webviewElement.getWebContents) {
      try {
        const webContents = webviewElement.getWebContents();
        webContents.session.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': ['default-src * blob: data: filesystem: ws: wss: \'unsafe-inline\' \'unsafe-eval\'']
            }
          });
        });
        return true;
      } catch (err) {
        console.error('Error disabling CSP:', err);
        return false;
      }
    }
    return false;
  },
  
  removeXFrameOptions: (webviewElement) => {
    if (webviewElement && webviewElement.getWebContents) {
      try {
        console.log('Setting up X-Frame-Options removal in preload');
        const webContents = webviewElement.getWebContents();
        
        webContents.session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
          const responseHeaders = { ...details.responseHeaders };
          
          // Headers to remove to bypass frame restrictions (case-insensitive check)
          const headersToRemove = [
            'x-frame-options',
            'content-security-policy',
            'x-content-security-policy',
            'frame-options'
          ];
          
          // Find and remove headers case-insensitively
          for (const header in responseHeaders) {
            if (headersToRemove.includes(header.toLowerCase())) {
              console.log(`Removing restrictive header: ${header}`);
              delete responseHeaders[header];
            }
          }
          
          callback({ responseHeaders });
        });
        
        console.log('X-Frame-Options removal set up successfully');
        return true;
      } catch (err) {
        console.error('Error setting up X-Frame-Options removal:', err);
        return false;
      }
    }
    return false;
  },
  
  injectHelperScript: (webviewElement, script) => {
    if (webviewElement && webviewElement.executeJavaScript) {
      try {
        webviewElement.executeJavaScript(script);
        return true;
      } catch (err) {
        console.error('Error injecting helper script:', err);
        return false;
      }
    }
    return false;
  }
});