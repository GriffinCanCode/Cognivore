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
  
  if (!window.ipcRenderer || typeof window.ipcRenderer.invoke !== 'function') {
    return Promise.reject(new Error('IPC renderer not available for extraction'));
  }
  
  extractorLogger.info(`Extracting content via IPC from ${url}`);
  
  try {
    // Invoke the content extraction handler in the main process
    const result = await window.ipcRenderer.invoke('extract-content', { url });
    
    if (!result) {
      throw new Error('No result returned from IPC extraction');
    }
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Format the result to match our extraction API
    return {
      title: result.title || '',
      text: result.text || '',
      html: result.html || '',
      url: url,
      headings: result.headings || [],
      links: result.links || [],
      metadata: result.metadata || {},
      extractionMethod: 'ipc',
      timestamp: new Date().toISOString(),
      extractionSuccess: true
    };
  } catch (error) {
    extractorLogger.error(`IpcExtractor error: ${error.message}`);
    throw new Error(`IpcExtractor failed: ${error.message}`);
  }
}

// Export methods
const IpcExtractor = {
  extract
};

export default IpcExtractor; 