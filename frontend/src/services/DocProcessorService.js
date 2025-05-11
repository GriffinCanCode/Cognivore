/**
 * Mnemosyne - Document Management Service
 * Named after the Greek goddess of memory and mother of the Muses
 * 
 * Centralizes document processing logic across the application.
 * Handles interactions with backend services for document processing.
 */
import ApiService from './ApiService.js';
import logger from '../utils/logger.js';

// Create scope-specific logger
const docProcessorLogger = logger.scope('DocProcessor');

class DocProcessor {
  constructor(notificationService = null) {
    this.notificationService = notificationService;
    this.apiService = new ApiService();
    this.documentListeners = [];
    
    docProcessorLogger.info('Initializing DocProcessor document management service');
  }

  /**
   * Register a listener for document events
   * @param {Function} listener - Callback function for document events
   */
  addDocumentListener(listener) {
    if (typeof listener === 'function') {
      this.documentListeners.push(listener);
    }
  }

  /**
   * Remove a document listener
   * @param {Function} listener - Listener to remove
   */
  removeDocumentListener(listener) {
    this.documentListeners = this.documentListeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners about document changes
   * @param {string} eventType - Type of document event
   * @param {Object} data - Event data
   */
  notifyListeners(eventType, data = {}) {
    this.documentListeners.forEach(listener => {
      try {
        listener(eventType, data);
      } catch (error) {
        docProcessorLogger.error('Error in document listener', { error: error.message });
      }
    });

    // Also dispatch an event for components not directly connected
    document.dispatchEvent(new CustomEvent('content:updated', { detail: data }));
  }

  /**
   * Process a PDF document
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<Object>} - Processing result with summary
   */
  async processPDF(filePath) {
    if (!filePath) {
      const message = 'No PDF file selected';
      this.notify('warning', message);
      docProcessorLogger.warn(message);
      return null;
    }
    
    try {
      this.notify('info', 'Processing PDF file...');
      docProcessorLogger.info(`Processing PDF: ${filePath}`);
      
      const result = await this.apiService.processPDF(filePath);
      
      // Generate summary from the processed content
      const summary = await this.generateDocumentSummary(result);
      
      this.notify('success', `Successfully processed PDF: ${result.title || 'Unnamed document'}`);
      this.notifyListeners('pdf:processed', { id: result.id, filePath, summary });
      
      return { ...result, summary };
    } catch (error) {
      const errorMessage = `Failed to process PDF: ${error.message}`;
      this.notify('error', errorMessage);
      docProcessorLogger.error(errorMessage, { filePath, error });
      throw error;
    }
  }

  /**
   * Process a Web URL
   * @param {string} url - URL to process
   * @returns {Promise<Object>} - Processing result with summary
   */
  async processURL(url) {
    if (!url) {
      const message = 'Please enter a URL';
      this.notify('warning', message);
      docProcessorLogger.warn(message);
      return null;
    }
    
    try {
      this.notify('info', 'Processing Web URL...');
      docProcessorLogger.info(`Processing URL: ${url}`);
      
      const result = await this.apiService.processURL(url);
      
      // Generate summary from the processed content
      const summary = await this.generateDocumentSummary(result);
      
      this.notify('success', `Successfully processed URL: ${result.title || url}`);
      this.notifyListeners('url:processed', { id: result.id, url, summary });
      
      return { ...result, summary };
    } catch (error) {
      const errorMessage = `Failed to process URL: ${error.message}`;
      this.notify('error', errorMessage);
      docProcessorLogger.error(errorMessage, { url, error });
      throw error;
    }
  }

  /**
   * Process a YouTube URL
   * @param {string} url - YouTube URL to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processing result with summary
   */
  async processYouTube(url, options = {}) {
    if (!url) {
      const message = 'Please enter a YouTube URL';
      this.notify('warning', message);
      docProcessorLogger.warn(message);
      return null;
    }
    
    try {
      this.notify('info', 'Processing YouTube URL...');
      docProcessorLogger.info(`Processing YouTube URL: ${url}`);
      
      // Extract video ID for thumbnail generation
      let videoId = '';
      try {
        const urlObj = new URL(url);
        if (url.includes('youtube.com/watch')) {
          videoId = urlObj.searchParams.get('v');
        } else if (url.includes('youtu.be/')) {
          videoId = urlObj.pathname.split('/')[1];
        }
      } catch (parseError) {
        docProcessorLogger.warn(`Could not parse YouTube URL: ${parseError.message}`);
      }
      
      // Generate thumbnail URL if we have a video ID
      let thumbnailUrl = null;
      if (videoId) {
        // Use high quality thumbnail
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        docProcessorLogger.info(`Generated thumbnail URL: ${thumbnailUrl}`);
      }
      
      // Merge options with defaults and add thumbnail URL
      const processOptions = {
        ...options,
        youtubeUrl: url,
        thumbnailUrl
      };
      
      // Pass options to the API service
      const result = await this.apiService.processYouTube(url, processOptions);
      
      // Generate summary from the processed content
      const summary = await this.generateDocumentSummary(result);
      
      this.notify('success', `Successfully processed YouTube video: ${result.title || 'Unnamed video'}`);
      this.notifyListeners('youtube:processed', { 
        id: result.id, 
        url, 
        summary,
        thumbnailUrl
      });
      
      return { ...result, summary, thumbnailUrl };
    } catch (error) {
      const errorMessage = `Failed to process YouTube URL: ${error.message}`;
      this.notify('error', errorMessage);
      docProcessorLogger.error(errorMessage, { url, error });
      throw error;
    }
  }

  /**
   * Generate a summary for a document
   * @param {Object} document - Document data
   * @returns {Promise<Object>} - Summary data
   */
  async generateDocumentSummary(document) {
    try {
      docProcessorLogger.info(`Generating summary for document: ${document.id}`);
      
      // Try to get summary from the backend API
      try {
        const apiSummary = await this.apiService.generateSummary(document.id);
        if (apiSummary && apiSummary.summary) {
          return apiSummary;
        }
      } catch (apiError) {
        docProcessorLogger.warn(`Backend summary generation failed: ${apiError.message}`, { documentId: document.id });
        // Continue with client-side fallback if API fails
      }
      
      // Client-side fallback summary generation
      const text = document.text_content || document.preview || '';
      const title = document.title || 'Untitled Document';
      
      if (!text || text.length < 50) {
        return {
          summary: 'Content too short to generate meaningful summary.',
          keyPoints: ['Could not generate key points from this content.'],
          title
        };
      }
      
      // Extract first 2-3 sentences for summary
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const summaryText = sentences.slice(0, 3).join('. ') + '.';
      
      // Extract key points
      const keyPoints = this.extractKeyPoints(text);
      
      return {
        summary: summaryText,
        keyPoints,
        title
      };
    } catch (error) {
      docProcessorLogger.error(`Failed to generate summary: ${error.message}`, { documentId: document.id });
      
      // Return a basic fallback
      return {
        summary: 'This document has been processed and stored in your knowledge base.',
        keyPoints: ['The content is now available for reference and searching.'],
        title: document.title || 'Processed Document'
      };
    }
  }
  
  /**
   * Extract key points from text content
   * @param {string} text - Document text
   * @returns {Array} - List of key points
   */
  extractKeyPoints(text) {
    // Simple key point extraction based on common patterns
    const keyPointIndicators = [
      'important', 'key', 'critical', 'essential', 'crucial', 'significant',
      'note that', 'remember', 'consider', 'take away', 'highlight'
    ];
    
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
    let keyPoints = [];
    
    // Look for sentences with key point indicators
    paragraphs.forEach(paragraph => {
      const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      sentences.forEach(sentence => {
        const sentenceLower = sentence.toLowerCase();
        if (keyPointIndicators.some(indicator => sentenceLower.includes(indicator))) {
          keyPoints.push(sentence.trim());
        }
      });
    });
    
    // If no key points found with indicators, use first sentence of paragraphs
    if (keyPoints.length === 0 && paragraphs.length > 0) {
      keyPoints = paragraphs.slice(0, Math.min(3, paragraphs.length))
        .map(paragraph => {
          const firstSentence = paragraph.split(/[.!?]+/)[0].trim();
          return firstSentence.length > 10 ? firstSentence : paragraph.substring(0, 100).trim();
        });
    }
    
    // Limit to 5 key points and make sure they end with periods
    return keyPoints
      .slice(0, 5)
      .map(point => point.trim().endsWith('.') ? point.trim() : `${point.trim()}.`);
  }

  /**
   * Get a list of all stored documents
   * @returns {Promise<Array>} - List of documents
   */
  async getDocumentList() {
    try {
      docProcessorLogger.info('Fetching document list');
      const documents = await this.apiService.listItems();
      return documents;
    } catch (error) {
      const errorMessage = `Failed to fetch document list: ${error.message}`;
      this.notify('error', errorMessage);
      docProcessorLogger.error(errorMessage, { error });
      return [];
    }
  }

  /**
   * Get a specific document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object>} - Document data
   */
  async getDocument(id) {
    try {
      docProcessorLogger.info(`Fetching document with ID: ${id}`);
      const document = await this.apiService.getItem(id);
      return document;
    } catch (error) {
      const errorMessage = `Failed to fetch document: ${error.message}`;
      this.notify('error', errorMessage);
      docProcessorLogger.error(errorMessage, { id, error });
      return null;
    }
  }

  /**
   * Delete a document
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteDocument(id) {
    try {
      docProcessorLogger.info(`Deleting document with ID: ${id}`);
      await this.apiService.deleteItem(id);
      
      this.notify('success', 'Document deleted successfully');
      this.notifyListeners('document:deleted', { id });
      
      return true;
    } catch (error) {
      const errorMessage = `Failed to delete document: ${error.message}`;
      this.notify('error', errorMessage);
      docProcessorLogger.error(errorMessage, { id, error });
      return false;
    }
  }

  /**
   * Save document with summary data
   * @param {Object} documentData - Document data with summary
   * @returns {Promise<Object>} - Saved document
   */
  async saveDocumentWithSummary(documentData) {
    try {
      docProcessorLogger.info(`Saving document with summary: ${documentData.id || 'new document'}`);
      
      const result = await this.apiService.saveItem({
        ...documentData,
        summary_data: JSON.stringify({
          summary: documentData.summary,
          keyPoints: documentData.keyPoints
        })
      });
      
      this.notify('success', `Document saved: ${documentData.title || 'Unnamed document'}`);
      this.notifyListeners('document:saved', { id: result.id });
      
      return result;
    } catch (error) {
      const errorMessage = `Failed to save document: ${error.message}`;
      this.notify('error', errorMessage);
      docProcessorLogger.error(errorMessage, { documentData, error });
      throw error;
    }
  }

  /**
   * Send a notification if notification service is available
   * @param {string} type - Notification type
   * @param {string} message - Notification message
   */
  notify(type, message) {
    if (this.notificationService && typeof this.notificationService[type] === 'function') {
      this.notificationService[type](message);
    }
  }
}

export default DocProcessor;