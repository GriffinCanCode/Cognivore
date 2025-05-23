/**
 * IpcExtractor - Extract content using IPC communication with main process
 * 
 * This extractor uses Electron's IPC to communicate with the main process
 * to extract content, which can be useful when webview access is restricted.
 */

import logger from '../../../../utils/logger';

// Create a logger instance for this module
const extractorLogger = logger.scope('IpcExtractor');

/**
 * Extract content using IPC communication with main process
 * @param {string} url - URL to extract content from
 * @returns {Promise<Object>} Promise resolving to extracted content
 */
async function extract(url) {
  if (!url) {
    return Promise.reject(new Error('No URL provided for IPC extraction'));
  }
  
  if (!window.electron || !window.electron.ipcRenderer) {
    extractorLogger.error('IPC renderer not available for extraction');
    return Promise.reject(new Error('IPC renderer not available for extraction'));
  }
  
  try {
    extractorLogger.info(`Extracting content via IPC from ${url}`);
    
    // First try using extract-content for semantic extraction
    try {
      // Wrap the IPC call in a try/catch because of possible serialization issues
      let result;
      try {
        result = await window.electron.ipcRenderer.invoke('extract-content', { 
          url,
          options: {
            bypassCSP: true,
            timeout: 30000,
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
          }
        });
      } catch (ipcError) {
        // Check specifically for object clone errors
        if (ipcError.message && ipcError.message.includes('object could not be cloned')) {
          extractorLogger.error('IPC serialization error: Object could not be cloned during extract-content. This is likely due to complex DOM elements being passed.');
          throw new Error('IPC serialization error: Failed to transfer data through IPC due to non-serializable objects');
        }
        throw ipcError;
      }
      
      if (!result) {
        throw new Error('Empty response from extract-content');
      }
      
      if (result.error) {
        throw new Error(`Extract content error: ${result.error}`);
      }
      
      // Ensure all returned data is serializable for IPC communication
      const ensureSerializable = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        
        // Handle arrays
        if (Array.isArray(obj)) {
          return obj.map(item => ensureSerializable(item));
        }
        
        // Handle objects
        const safeObj = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== null && typeof value === 'object') {
            safeObj[key] = ensureSerializable(value);
          } else if (typeof value === 'function') {
            // Skip functions as they're not serializable
            continue;
          } else {
            safeObj[key] = value;
          }
        }
        return safeObj;
      };
      
      // Ultra-minimal response handling - for our string-only IPC responses
      // We need to adapt to our ultra-minimal backend responses
      return {
        title: result.title || url,
        text: result.text || '',
        html: '', // HTML is no longer included in minimal response
        url: result.url || url,
        headings: [], // No longer included in minimal response
        links: [], // No longer included in minimal response
        metadata: {},
        extractionMethod: 'ipc-extract',
        timestamp: new Date().toISOString(),
        extractionSuccess: result.success === "true" || !!result.text // Check both formats
      };
    } catch (extractError) {
      extractorLogger.warn(`IPC extract-content failed: ${extractError.message}, falling back to server-fetch`);
      
      // Fall back to server-fetch directly if extract-content fails
      let result;
      try {
        result = await window.electron.ipcRenderer.invoke('server-fetch', { 
          url,
          options: {
            bypassCSP: true,
            timeout: 30000,
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
          }
        });
      } catch (ipcError) {
        // Check specifically for object clone errors
        if (ipcError.message && ipcError.message.includes('object could not be cloned')) {
          extractorLogger.error('IPC serialization error: Object could not be cloned. This is likely due to complex DOM elements being passed.');
          throw new Error('IPC serialization error: Failed to transfer data through IPC due to non-serializable objects');
        }
        throw ipcError;
      }
      
      if (!result) {
        throw new Error('Empty response from server-fetch');
      }
      
      if (result.error) {
        throw new Error(`Server fetch error: ${result.error}`);
      }
      
      // Use the same serialization function to ensure safe results
      // Define it locally since we can't access the other instance directly
      const ensureSerializable = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        
        // Handle arrays
        if (Array.isArray(obj)) {
          return obj.map(item => ensureSerializable(item));
        }
        
        // Handle objects
        const safeObj = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== null && typeof value === 'object') {
            safeObj[key] = ensureSerializable(value);
          } else if (typeof value === 'function') {
            // Skip functions as they're not serializable
            continue;
          } else {
            safeObj[key] = value;
          }
        }
        return safeObj;
      };
      
      // Ultra-minimal response handling for server-fetch
      // Adapting to our string-only backend responses
      return {
        title: url,
        text: typeof result.data === 'string' ? result.data : '',
        html: '', // No longer included in minimal response
        url: url,
        headers: {}, // No longer included in minimal response
        contentType: 'text/plain',
        extractionMethod: 'ipc-fetch',
        timestamp: new Date().toISOString(),
        extractionSuccess: result.success === "true" || !!result.data // Check both formats
      };
    }
  } catch (error) {
    extractorLogger.error(`IPC extraction error: ${error.message}`);
    throw new Error(`IPC extraction failed: ${error.message}`);
  }
}

// Export the module
const IpcExtractor = {
  extract
};

export default IpcExtractor; 