/**
 * Summary Generator Models
 * Type-safe models for summary generation
 */
import Model, { Field } from '../validation/Model';

/**
 * Summary generation parameters model
 */
export class SummaryParams extends Model {
  static modelFields = {
    documentId: Field.string({
      description: 'ID of the document to summarize (optional if content provided)',
      nullable: true
    }),
    
    content: Field.string({
      description: 'Text content to summarize (optional if documentId provided)',
      nullable: true,
      minLength: 1
    }),
    
    title: Field.string({
      description: 'Document title (optional)',
      nullable: true,
      default: 'Untitled Document'
    })
  };
  
  /**
   * Validate that either documentId or content is provided
   */
  validate() {
    if (!this.documentId && !this.content) {
      throw new Error('Either documentId or content must be provided');
    }
  }
}

/**
 * Summary result model
 */
export class SummaryResult extends Model {
  static modelFields = {
    summary: Field.string({
      description: 'Concise summary of the document content',
      required: true,
      minLength: 1
    }),
    
    keyPoints: Field.array(
      Field.string({
        description: 'Individual key point from the document',
        minLength: 1
      }),
      {
        description: 'List of key points extracted from the document',
        required: true,
        minItems: 1
      }
    ),
    
    title: Field.string({
      description: 'Document title',
      required: true,
      default: 'Document Summary'
    })
  };
}

/**
 * Summary generation error model
 */
export class SummaryError extends Model {
  static modelFields = {
    error: Field.string({
      description: 'Error message',
      required: true
    }),
    
    code: Field.string({
      description: 'Error code',
      default: 'SUMMARY_ERROR'
    }),
    
    details: Field.object(
      {},
      {
        description: 'Additional error details',
        additionalProperties: true,
        nullable: true
      }
    )
  };
} 