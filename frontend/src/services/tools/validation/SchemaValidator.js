/**
 * SchemaValidator
 * A robust schema validation utility inspired by Pydantic for JavaScript
 * Provides type safety and validation for tool parameters
 */
import logger from '../../../utils/logger';

// Create scope-specific logger
const validationLogger = logger.scope('SchemaValidator');

class SchemaValidator {
  /**
   * Create a new SchemaValidator
   * @param {Object} schema - JSON Schema to validate against
   */
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
  }

  /**
   * Validate data against the schema
   * @param {Object} data - Data to validate
   * @returns {Object} - Validation result with parsed data and errors
   */
  validate(data) {
    this.errors = [];
    const result = {
      valid: true,
      parsed: {},
      errors: []
    };

    try {
      // For object types, validate properties
      if (this.schema.type === 'object' && this.schema.properties) {
        result.parsed = this._validateObject(data);
      } else {
        // For non-object types
        result.parsed = this._validateType(data, this.schema, 'value');
      }
    } catch (error) {
      validationLogger.error('Validation error', { error: error.message });
      this.errors.push(error.message);
    }

    result.valid = this.errors.length === 0;
    result.errors = [...this.errors];
    
    return result;
  }

  /**
   * Validate an object against a schema
   * @param {Object} obj - Object to validate
   * @returns {Object} - Validated and transformed object
   * @private
   */
  _validateObject(obj) {
    const result = {};
    const properties = this.schema.properties || {};
    const required = this.schema.required || [];

    // Check for required properties
    for (const prop of required) {
      if (obj[prop] === undefined) {
        this._addError(`Missing required property: ${prop}`);
      }
    }

    // Validate each property
    for (const [key, value] of Object.entries(obj)) {
      const propSchema = properties[key];
      
      // Skip validation for properties not in schema if not using additionalProperties
      if (!propSchema) {
        if (this.schema.additionalProperties === false) {
          this._addError(`Additional property '${key}' not allowed`);
        } else {
          result[key] = value; // Pass through additional properties
        }
        continue;
      }

      try {
        result[key] = this._validateType(value, propSchema, key);
      } catch (error) {
        this._addError(`${error.message} for property '${key}'`);
      }
    }

    // Apply default values for missing properties
    for (const [key, schema] of Object.entries(properties)) {
      if (result[key] === undefined && schema.default !== undefined) {
        result[key] = schema.default;
      }
    }

    return result;
  }

  /**
   * Validate a value against a type schema
   * @param {any} value - Value to validate
   * @param {Object} schema - Schema to validate against
   * @param {string} path - Property path for error messages
   * @returns {any} - Validated and transformed value
   * @private
   */
  _validateType(value, schema, path) {
    // Handle null values
    if (value === null) {
      if (schema.nullable === true) return null;
      throw new Error(`Value cannot be null for '${path}'`);
    }

    // Handle undefined with default values
    if (value === undefined) {
      if (schema.default !== undefined) return schema.default;
      throw new Error(`Value is required for '${path}'`);
    }

    // Handle string type
    if (schema.type === 'string') {
      if (typeof value !== 'string') {
        throw new Error(`Expected string but got ${typeof value}`);
      }
      
      // String-specific validations
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        throw new Error(`String too short (min: ${schema.minLength})`);
      }
      
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        throw new Error(`String too long (max: ${schema.maxLength})`);
      }
      
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        throw new Error(`String does not match pattern: ${schema.pattern}`);
      }
      
      if (schema.format === 'email' && !this._isValidEmail(value)) {
        throw new Error('Invalid email format');
      }
      
      if (schema.format === 'date-time' && !this._isValidDateTime(value)) {
        throw new Error('Invalid date-time format');
      }

      if (schema.enum && !schema.enum.includes(value)) {
        throw new Error(`Value must be one of: ${schema.enum.join(', ')}`);
      }
      
      return value;
    }

    // Handle number type
    if (schema.type === 'number' || schema.type === 'integer') {
      // Convert string numbers to actual numbers if needed
      let numValue = value;
      if (typeof value === 'string') {
        numValue = schema.type === 'integer' ? parseInt(value, 10) : parseFloat(value);
        if (isNaN(numValue)) {
          throw new Error(`Cannot convert '${value}' to ${schema.type}`);
        }
      }
      
      if (typeof numValue !== 'number') {
        throw new Error(`Expected ${schema.type} but got ${typeof value}`);
      }
      
      if (schema.type === 'integer' && !Number.isInteger(numValue)) {
        throw new Error('Value must be an integer');
      }
      
      // Number-specific validations
      if (schema.minimum !== undefined && numValue < schema.minimum) {
        throw new Error(`Value too small (min: ${schema.minimum})`);
      }
      
      if (schema.maximum !== undefined && numValue > schema.maximum) {
        throw new Error(`Value too large (max: ${schema.maximum})`);
      }
      
      if (schema.exclusiveMinimum !== undefined && numValue <= schema.exclusiveMinimum) {
        throw new Error(`Value must be greater than ${schema.exclusiveMinimum}`);
      }
      
      if (schema.exclusiveMaximum !== undefined && numValue >= schema.exclusiveMaximum) {
        throw new Error(`Value must be less than ${schema.exclusiveMaximum}`);
      }
      
      if (schema.multipleOf !== undefined && numValue % schema.multipleOf !== 0) {
        throw new Error(`Value must be a multiple of ${schema.multipleOf}`);
      }
      
      return numValue;
    }

    // Handle boolean type
    if (schema.type === 'boolean') {
      // Convert string booleans to actual booleans if needed
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        throw new Error(`Cannot convert '${value}' to boolean`);
      }
      
      if (typeof value !== 'boolean') {
        throw new Error(`Expected boolean but got ${typeof value}`);
      }
      
      return value;
    }

    // Handle array type
    if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        throw new Error(`Expected array but got ${typeof value}`);
      }
      
      // Array-specific validations
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        throw new Error(`Array too short (min: ${schema.minItems})`);
      }
      
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        throw new Error(`Array too long (max: ${schema.maxItems})`);
      }
      
      // Validate array items if items schema is provided
      if (schema.items) {
        return value.map((item, index) => 
          this._validateType(item, schema.items, `${path}[${index}]`)
        );
      }
      
      return value;
    }

    // Handle object type for nested objects
    if (schema.type === 'object' && schema.properties) {
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        throw new Error(`Expected object but got ${Array.isArray(value) ? 'array' : typeof value}`);
      }
      
      const objectValidator = new SchemaValidator(schema);
      const result = objectValidator.validate(value);
      
      if (!result.valid) {
        // Add nested errors with prefix
        this.errors.push(...result.errors.map(err => `${path}: ${err}`));
        throw new Error(`Invalid nested object at '${path}'`);
      }
      
      return result.parsed;
    }

    // Handle unknown types
    return value;
  }

  /**
   * Add a validation error
   * @param {string} message - Error message
   * @private
   */
  _addError(message) {
    this.errors.push(message);
  }

  /**
   * Check if a string is a valid email
   * @param {string} value - String to check
   * @returns {boolean} - True if valid email
   * @private
   */
  _isValidEmail(value) {
    // Basic email regex pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value);
  }

  /**
   * Check if a string is a valid ISO date-time
   * @param {string} value - String to check
   * @returns {boolean} - True if valid date-time
   * @private
   */
  _isValidDateTime(value) {
    // Check if can be parsed as a date
    const date = new Date(value);
    return !isNaN(date.getTime()) && value.includes('T');
  }

  /**
   * Create a validator from a schema
   * @param {Object} schema - JSON Schema
   * @returns {Function} - Validation function
   * @static
   */
  static createValidator(schema) {
    const validator = new SchemaValidator(schema);
    
    return (data) => {
      const result = validator.validate(data);
      if (!result.valid) {
        const error = new Error(`Validation error: ${result.errors.join(', ')}`);
        error.validationErrors = result.errors;
        throw error;
      }
      return result.parsed;
    };
  }
}

export default SchemaValidator; 