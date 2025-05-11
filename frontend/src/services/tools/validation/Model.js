/**
 * Model
 * A base class for creating type-safe data models similar to Pydantic
 */
import SchemaValidator from './SchemaValidator';
import logger from '../../../utils/logger';

// Create scope-specific logger
const modelLogger = logger.scope('Model');

/**
 * Field definition for model properties
 */
export class Field {
  /**
   * Create a new field definition
   * @param {Object} options - Field options
   */
  constructor(options = {}) {
    this.type = options.type || 'string';
    this.description = options.description || '';
    this.required = options.required || false;
    this.default = options.default;
    this.nullable = options.nullable || false;
    
    // String-specific options
    this.minLength = options.minLength;
    this.maxLength = options.maxLength;
    this.pattern = options.pattern;
    this.format = options.format;
    this.enum = options.enum;
    
    // Number-specific options
    this.minimum = options.minimum;
    this.maximum = options.maximum;
    this.exclusiveMinimum = options.exclusiveMinimum;
    this.exclusiveMaximum = options.exclusiveMaximum;
    this.multipleOf = options.multipleOf;
    
    // Array-specific options
    this.minItems = options.minItems;
    this.maxItems = options.maxItems;
    this.items = options.items;
    
    // Object-specific options
    this.properties = options.properties;
    this.additionalProperties = options.additionalProperties;
    
    // Define any custom validation function
    this.validator = options.validator;
  }
  
  /**
   * Convert field to JSON Schema
   * @returns {Object} - JSON Schema representation
   */
  toSchema() {
    const schema = {
      type: this.type,
      description: this.description
    };
    
    // Add other properties based on type
    if (this.default !== undefined) schema.default = this.default;
    if (this.nullable) schema.nullable = true;
    
    // String type properties
    if (this.type === 'string') {
      if (this.minLength !== undefined) schema.minLength = this.minLength;
      if (this.maxLength !== undefined) schema.maxLength = this.maxLength;
      if (this.pattern) schema.pattern = this.pattern;
      if (this.format) schema.format = this.format;
      if (this.enum) schema.enum = this.enum;
    }
    
    // Number/integer type properties
    if (this.type === 'number' || this.type === 'integer') {
      if (this.minimum !== undefined) schema.minimum = this.minimum;
      if (this.maximum !== undefined) schema.maximum = this.maximum;
      if (this.exclusiveMinimum !== undefined) schema.exclusiveMinimum = this.exclusiveMinimum;
      if (this.exclusiveMaximum !== undefined) schema.exclusiveMaximum = this.exclusiveMaximum;
      if (this.multipleOf !== undefined) schema.multipleOf = this.multipleOf;
    }
    
    // Array type properties
    if (this.type === 'array') {
      if (this.minItems !== undefined) schema.minItems = this.minItems;
      if (this.maxItems !== undefined) schema.maxItems = this.maxItems;
      if (this.items) {
        schema.items = this.items instanceof Field 
          ? this.items.toSchema() 
          : this.items;
      }
    }
    
    // Object type properties
    if (this.type === 'object' && this.properties) {
      schema.properties = {};
      const objectRequired = [];
      
      // Convert property fields to schema
      for (const [key, field] of Object.entries(this.properties)) {
        if (field instanceof Field) {
          schema.properties[key] = field.toSchema();
          if (field.required) objectRequired.push(key);
        } else {
          schema.properties[key] = field;
        }
      }
      
      if (objectRequired.length > 0) {
        schema.required = objectRequired;
      }
      
      if (this.additionalProperties !== undefined) {
        schema.additionalProperties = this.additionalProperties;
      }
    }
    
    return schema;
  }
  
  /**
   * Create a string field
   * @param {Object} options - Field options
   * @returns {Field} - String field
   */
  static string(options = {}) {
    return new Field({
      type: 'string',
      ...options
    });
  }
  
  /**
   * Create a number field
   * @param {Object} options - Field options
   * @returns {Field} - Number field
   */
  static number(options = {}) {
    return new Field({
      type: 'number',
      ...options
    });
  }
  
  /**
   * Create an integer field
   * @param {Object} options - Field options
   * @returns {Field} - Integer field
   */
  static integer(options = {}) {
    return new Field({
      type: 'integer',
      ...options
    });
  }
  
  /**
   * Create a boolean field
   * @param {Object} options - Field options
   * @returns {Field} - Boolean field
   */
  static boolean(options = {}) {
    return new Field({
      type: 'boolean',
      ...options
    });
  }
  
  /**
   * Create an array field
   * @param {Field|Object} items - Schema for array items
   * @param {Object} options - Field options
   * @returns {Field} - Array field
   */
  static array(items, options = {}) {
    return new Field({
      type: 'array',
      items,
      ...options
    });
  }
  
  /**
   * Create an object field
   * @param {Object} properties - Object properties schema
   * @param {Object} options - Field options
   * @returns {Field} - Object field
   */
  static object(properties, options = {}) {
    return new Field({
      type: 'object',
      properties,
      ...options
    });
  }
  
  /**
   * Create an enum field
   * @param {Array} values - Enum values
   * @param {Object} options - Field options
   * @returns {Field} - Enum field
   */
  static enum(values, options = {}) {
    return new Field({
      type: 'string',
      enum: values,
      ...options
    });
  }
  
  /**
   * Create an email field
   * @param {Object} options - Field options
   * @returns {Field} - Email field
   */
  static email(options = {}) {
    return new Field({
      type: 'string',
      format: 'email',
      ...options
    });
  }
  
  /**
   * Create a date-time field
   * @param {Object} options - Field options
   * @returns {Field} - Date-time field
   */
  static dateTime(options = {}) {
    return new Field({
      type: 'string',
      format: 'date-time',
      ...options
    });
  }
}

/**
 * Base Model class for creating validated data models
 */
class Model {
  /**
   * Create a new model instance
   * @param {Object} data - Initial data
   */
  constructor(data = {}) {
    // Get the schema for this model class
    const schema = this.constructor.getSchema();
    
    // Create validator for the schema
    const validator = new SchemaValidator(schema);
    
    // Validate and assign data
    const result = validator.validate(data);
    
    if (!result.valid) {
      const errorMessage = `Validation error in ${this.constructor.name}: ${result.errors.join('; ')}`;
      modelLogger.error(errorMessage, { data });
      const error = new Error(errorMessage);
      error.validationErrors = result.errors;
      throw error;
    }
    
    // Copy the validated data to this instance
    Object.assign(this, result.parsed);
    
    // Add custom validations
    if (typeof this.validate === 'function') {
      this.validate();
    }
  }
  
  /**
   * Get model schema
   * @returns {Object} - JSON Schema
   * @static
   */
  static getSchema() {
    if (!this._schema) {
      // Create schema from field definitions
      const schema = {
        type: 'object',
        properties: {},
        required: []
      };
      
      // Get field definitions from class
      const fieldsDefinition = this.modelFields || {};
      
      for (const [key, field] of Object.entries(fieldsDefinition)) {
        if (field instanceof Field) {
          schema.properties[key] = field.toSchema();
          if (field.required) {
            schema.required.push(key);
          }
        } else {
          // Handle direct schema definitions
          schema.properties[key] = field;
        }
      }
      
      // Cache the schema
      this._schema = schema;
    }
    
    return this._schema;
  }
  
  /**
   * Convert model to JSON
   * @returns {Object} - Plain object representation
   */
  toJSON() {
    const result = {};
    
    // Only include defined properties from the schema
    const schema = this.constructor.getSchema();
    const properties = Object.keys(schema.properties || {});
    
    for (const key of properties) {
      if (this[key] !== undefined) {
        // Handle nested models
        if (this[key] instanceof Model) {
          result[key] = this[key].toJSON();
        } else if (Array.isArray(this[key]) && this[key].length > 0 && this[key][0] instanceof Model) {
          // Handle arrays of models
          result[key] = this[key].map(item => item.toJSON());
        } else {
          result[key] = this[key];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Static helper to create a model
   * @param {Object} data - Model data
   * @returns {Model} - Model instance
   */
  static create(data) {
    return new this(data);
  }
}

export default Model; 