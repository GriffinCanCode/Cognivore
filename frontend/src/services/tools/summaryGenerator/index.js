/**
 * Summary Generator Tool
 * Generates concise summaries from document content
 */
import logger from '../../../utils/logger';
import { SummaryParams, SummaryResult, SummaryError } from './models';
import { SchemaValidator } from '../validation';

// Create scope-specific logger
const summaryLogger = logger.scope('SummaryGenerator');

const SummaryGenerator = {
  name: 'summary',
  description: 'Generate a concise summary of document content',
  version: '1.0.0',
  
  // Define parameters in JSON Schema format for Gemini compatibility
  parameters: {
    type: 'object',
    properties: {
      documentId: {
        type: 'string',
        description: 'ID of the document to summarize (optional if content provided)'
      },
      content: {
        type: 'string',
        description: 'Text content to summarize (optional if documentId provided)'
      },
      title: {
        type: 'string',
        description: 'Document title (optional)'
      }
    },
    required: [] // Either documentId or content must be provided (validated in execute)
  },
  
  /**
   * Execute the summary generation
   * @param {Object} params - Parameters for summary generation
   * @param {ApiService} apiService - API service for backend communication
   * @returns {Promise<Object>} - Summary result
   */
  async execute(params, apiService) {
    try {
      // Validate parameters using our model
      const validParams = SummaryParams.create(params);
      
      summaryLogger.info(`Generating summary for document: ${validParams.documentId || 'unspecified'}`);
      
      // If only documentId is provided, fetch the document content
      let documentContent = validParams.content;
      let documentTitle = validParams.title;
      
      if (validParams.documentId && !documentContent) {
        try {
          const document = await apiService.getItem(validParams.documentId);
          documentContent = document.text_content || document.preview || '';
          documentTitle = document.title || 'Untitled Document';
        } catch (error) {
          summaryLogger.error(`Failed to fetch document content: ${error.message}`);
          return new SummaryError({
            error: `Failed to fetch document content: ${error.message}`,
            code: 'DOCUMENT_FETCH_ERROR'
          }).toJSON();
        }
      }
      
      // Try to use backend summary service
      try {
        const result = await apiService.generateSummary(
          validParams.documentId, 
          documentContent, 
          documentTitle
        );
        
        if (result && result.success && result.result) {
          // Validate backend result against our model
          return SummaryResult.create({
            summary: result.result.summary,
            keyPoints: result.result.keyPoints,
            title: result.result.title || documentTitle
          }).toJSON();
        }
      } catch (error) {
        summaryLogger.warn(`Backend summary generation failed: ${error.message}`);
        // Continue with client-side fallback if API fails
      }
      
      // Client-side fallback
      const localSummary = this.generateLocalSummary(documentContent, documentTitle);
      return SummaryResult.create(localSummary).toJSON();
    } catch (error) {
      summaryLogger.error('Summary generation failed', { error: error.message });
      
      if (error.validationErrors) {
        return new SummaryError({
          error: `Validation error: ${error.message}`,
          code: 'VALIDATION_ERROR',
          details: { validationErrors: error.validationErrors }
        }).toJSON();
      }
      
      return new SummaryError({
        error: error.message,
        code: 'SUMMARY_GENERATION_ERROR'
      }).toJSON();
    }
  },
  
  /**
   * Generate a summary locally as a fallback
   * @param {string} content - Document content
   * @param {string} title - Document title
   * @returns {Object} - Summary data
   */
  generateLocalSummary(content, title) {
    try {
      if (!content || content.length < 50) {
        return {
          summary: 'Content too short to generate meaningful summary.',
          keyPoints: ['Could not generate key points from this content.'],
          title: title || 'Untitled Document'
        };
      }
      
      // Extract first 2-3 sentences for summary
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const summaryText = sentences.slice(0, 3).join('. ') + '.';
      
      // Extract key points
      const keyPoints = this.extractKeyPoints(content);
      
      return {
        summary: summaryText,
        keyPoints,
        title: title || 'Document Summary'
      };
    } catch (error) {
      summaryLogger.error(`Local summary generation failed: ${error.message}`);
      
      // Return a basic fallback
      return {
        summary: 'This document has been processed and stored in your knowledge base.',
        keyPoints: ['The content is now available for reference and searching.'],
        title: title || 'Processed Document'
      };
    }
  },
  
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
};

// Create JSON Schema validator for parameters
SummaryGenerator.paramValidator = SchemaValidator.createValidator(SummaryGenerator.parameters);

export default SummaryGenerator; 