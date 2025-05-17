/**
 * Message Formatter Utility - Handles formatting and sanitization of chat messages
 */
import logger from './logger.js';

// Create context-specific logger
const formatterLogger = logger.scope('MessageFormatter');

class MessageFormatter {
  /**
   * Constructor for MessageFormatter
   */
  constructor() {
    this.specialWords = ['Mnemosyne', 'Cognivore', 'Griffin', 'bloody', 'fucking', 'damn'];
    this.debug = process.env.NODE_ENV !== 'production';
  }

  /**
   * Parse and clean raw message content that might come in various formats
   * @param {Object|string} rawMessage - The raw message from LLM API
   * @returns {Object} - Properly formatted message object
   */
  parseRawMessage(rawMessage) {
    formatterLogger.debug('Parsing raw message:', { 
      type: typeof rawMessage, 
      length: typeof rawMessage === 'string' ? rawMessage.length : 'N/A',
      preview: typeof rawMessage === 'string' ? rawMessage.substring(0, 100) : 'Not a string'
    });

    if (!rawMessage) {
      return {
        role: 'assistant',
        content: 'Sorry, I received an empty response. Please try again.',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Handle string type response (simple case)
      if (typeof rawMessage === 'string') {
        return {
          role: 'assistant',
          content: rawMessage,
          timestamp: new Date().toISOString()
        };
      }

      // Handle normal object format with text/content
      if (rawMessage.text || rawMessage.content) {
        return {
          role: rawMessage.role || 'assistant',
          content: rawMessage.text || rawMessage.content,
          timestamp: rawMessage.timestamp || new Date().toISOString(),
          toolCalls: rawMessage.toolCalls || undefined
        };
      }

      // Handle Gemini API response format
      if (rawMessage.candidates && Array.isArray(rawMessage.candidates)) {
        const candidate = rawMessage.candidates[0];
        if (candidate && candidate.content) {
          let text = '';
          let toolCalls = [];

          // Extract text and tool calls from candidate parts
          if (Array.isArray(candidate.content.parts)) {
            for (const part of candidate.content.parts) {
              if (typeof part === 'string') {
                text += part;
              } else if (part.text) {
                text += part.text;
              } else if (part.functionCall || part.toolCall) {
                const call = part.functionCall || part.toolCall;
                toolCalls.push({
                  name: call.name,
                  toolCallId: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  args: call.args || call.arguments || {}
                });
              }
            }
          } else if (candidate.content.text) {
            text = candidate.content.text;
          }

          return {
            role: 'assistant',
            content: text,
            timestamp: new Date().toISOString(),
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined
          };
        }
      }

      // Handle indexed character array
      const keys = Object.keys(rawMessage).filter(k => !isNaN(parseInt(k)));
      if (keys.length > 10) {
        formatterLogger.debug('Detected indexed character response, extracting');
        try {
          // Reconstruct the text from indexed characters
          const reconstructedText = keys.sort((a, b) => parseInt(a) - parseInt(b))
                                        .map(k => rawMessage[k])
                                        .join('');
          
          // Try parsing it as JSON
          try {
            const parsed = JSON.parse(reconstructedText);
            return this.parseRawMessage(parsed);
          } catch (e) {
            // If not valid JSON, return as plain text
            return {
              role: 'assistant',
              content: this.cleanContent(reconstructedText),
              timestamp: new Date().toISOString()
            };
          }
        } catch (err) {
          formatterLogger.error('Error processing indexed character response:', err);
        }
      }

      // Last resort: stringify the object
      formatterLogger.warn('Unknown message format, using JSON.stringify as fallback');
      return {
        role: 'assistant',
        content: `Failed to parse response properly. Raw response: ${JSON.stringify(rawMessage)}`,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      formatterLogger.error('Error parsing raw message:', error);
      return {
        role: 'error',
        content: `Error formatting message: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clean and sanitize message content
   * @param {string} content - Raw message content
   * @returns {string} - Cleaned content
   */
  cleanContent(content) {
    if (!content) return '';
    
    // Ensure content is a string
    content = typeof content === 'string' ? content : String(content || '');
    
    // Remove raw JSON format indicators
    content = content.replace(/^\s*\{"candidates":\s*\[\s*\{\s*"content":\s*\{\s*"parts":\s*\[\s*\{\s*"text":\s*"/g, '');
    content = content.replace(/"\s*\}\s*\]\s*,\s*"role":\s*"model"\s*\}\s*,\s*.*?\s*\]\s*,.*?\s*\}\s*$/g, '');
    
    // Unescape escaped quotes and backslashes that might be in the response
    content = content.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    
    // Clean up any trailing model information or finish reason
    content = content.replace(/",\s*"role":\s*"model"[^}]*$/, '');
    
    // Remove any remaining JSON artifacts
    content = content.replace(/^[\s\n]*\{[\s\n]*"candidates"[\s\n]*:[\s\n]*\[[\s\n]*\{[\s\n]*"content"[\s\n]*:[\s\n]*\{[\s\n]*"parts"[\s\n]*:[\s\n]*\[[\s\n]*\{[\s\n]*"text"[\s\n]*:[\s\n]*"/g, '');
    content = content.replace(/\\n$/, '');
    
    // Return cleaned content
    return content;
  }

  /**
   * Format the message content with enhanced styling
   * @param {string} content - Raw message content
   * @returns {string} - Formatted HTML string
   */
  formatMessageContent(content) {
    // Handle null or undefined content
    if (!content) return '';
    
    // Convert to string if not already
    content = typeof content === 'string' ? content : String(content || '');
    
    // Pre-process the content to handle line breaks better
    // Join any words that might be broken across lines
    content = content.replace(/(\w+)(\s*[\r\n]+\s*)(\w+)/g, (match, word1, linebreak, word2) => {
      // Check if this might be part of a special word that's being broken
      const combined = word1 + word2;
      if (this.specialWords.some(word => combined.toLowerCase().includes(word.toLowerCase()))) {
        return word1 + word2; // Remove the line break for special words
      }
      return match; // Keep the original text for non-special words
    });
    
    // IMPORTANT: Track code blocks and their positions to exclude them from other formatting
    const codeBlocks = [];
    const codeBlockIds = [];
    
    // Process multiline code blocks first and store them for later reinsertion
    // Use a better regex that properly captures all types of code blocks including language
    let formatted = content.replace(/```([\w]*)\n([\s\S]*?)```/g, (match, language, code, offset) => {
      const id = `code-block-${codeBlocks.length}`;
      codeBlocks.push(`<pre class="code-block ${language ? `language-${language}` : ''}"><code>${this.escapeHtml(code)}</code></pre>`);
      codeBlockIds.push(id);
      return id; // Replace with a placeholder
    });
    
    // Process inline code and store them for later reinsertion
    formatted = formatted.replace(/`([^`]+)`/g, (match, code, offset) => {
      const id = `inline-code-${codeBlocks.length}`;
      codeBlocks.push(`<code>${this.escapeHtml(code)}</code>`);
      codeBlockIds.push(id);
      return id; // Replace with a placeholder
    });
    
    // Convert URLs to links
    formatted = formatted.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Handle bold/strong emphasis via markdown-style double asterisks first
    // Important: process this BEFORE special words to prevent interference
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<span class="emphasized-text">$1</span>');
    
    // Process special words with exact matching
    // First, ensure complete word matching for special words like Cognivore, Mnemosyne, etc.
    this.specialWords.forEach(word => {
      // Use a more precise regex to match complete words, case-insensitive
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      
      // Collect all matches first to avoid nested replacements
      const matches = [];
      let match;
      while ((match = regex.exec(formatted)) !== null) {
        matches.push({
          index: match.index,
          text: match[0],
          length: match[0].length
        });
      }
      
      // Process matches in reverse order to preserve indices
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        
        // Skip if inside a code block
        let inCodeBlock = false;
        for (let j = 0; j < codeBlockIds.length; j++) {
          const id = codeBlockIds[j];
          const idPos = formatted.substring(0, m.index).lastIndexOf(id);
          if (idPos !== -1 && idPos + id.length > m.index) {
            inCodeBlock = true;
            break;
          }
        }
        if (inCodeBlock) continue;
        
        // Apply appropriate styling based on word type
        let cssClass = 'special-word';
        const lowerMatch = m.text.toLowerCase();
        
        if (lowerMatch === 'mnemosyne') cssClass += ' mnemosyne-word';
        if (lowerMatch === 'cognivore') cssClass += ' cognivore-word';
        if (lowerMatch === 'griffin') cssClass += ' griffin-word';
        if (['bloody', 'fucking', 'damn'].includes(lowerMatch)) cssClass += ' expletive-word';
        
        // Replace with styled span
        const replacement = `<span class="${cssClass}" title="${m.text}">${m.text}</span>`;
        formatted = formatted.substring(0, m.index) + replacement + formatted.substring(m.index + m.length);
      }
    });
    
    // Convert line breaks to <br> after processing special words
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Now restore all code blocks and inline code
    codeBlockIds.forEach((id, index) => {
      formatted = formatted.replace(id, codeBlocks[index]);
    });
    
    return formatted;
  }

  /**
   * Escape HTML special characters to prevent XSS
   * @param {string} html - The string to escape
   * @returns {string} - The escaped string
   */
  escapeHtml(html) {
    if (!html) return '';
    
    // Convert to string if not already
    html = typeof html === 'string' ? html : String(html || '');
    
    // Use a more reliable method than relying on DOM
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format a tool result for better display
   * @param {Object|Array} result - The tool result to format
   * @returns {string} - Formatted HTML string
   */
  formatToolResult(result) {
    if (!result) return 'No result';
    
    // Check for specific data structures we want to format differently
    if (Array.isArray(result)) {
      // For arrays of items, use a special format
      if (result.length > 0 && result[0] && typeof result[0] === 'object') {
        return this.formatResultItems(result);
      }
    }
    
    // If it's a file listing result
    if (result.items && Array.isArray(result.items)) {
      return this.formatResultItems(result.items, result.totalItems);
    }
    
    // Default formatting with JSON syntax highlighting
    return this.syntaxHighlightJson(result);
  }
  
  /**
   * Format a list of result items
   * @param {Array} items - The items to format
   * @param {number} totalItems - Optional total count
   * @returns {string} - Formatted HTML string
   */
  formatResultItems(items, totalItems) {
    if (!items || items.length === 0) return 'No items found';
    
    let html = '';
    
    // Add header with count if provided
    if (totalItems !== undefined) {
      html += `<div class="result-header">Found ${items.length} of ${totalItems} items</div>`;
    } else {
      html += `<div class="result-header">Found ${items.length} items</div>`;
    }
    
    // Create item list
    html += '<div class="result-items">';
    
    items.forEach((item, index) => {
      html += `<div class="result-item">`;
      
      // Add item number
      html += `<div class="item-number">${index + 1}</div>`;
      
      // Add item content
      html += `<div class="item-content">`;
      
      // Add title if available
      if (item.title) {
        html += `<div class="item-title">${this.escapeHtml(item.title)}</div>`;
      } else if (item.id) {
        html += `<div class="item-title">Item ${item.id}</div>`;
      }
      
      // Add other fields in a condensed format
      html += `<div class="item-details">`;
      Object.entries(item).forEach(([key, value]) => {
        // Skip title as it's already displayed
        if (key === 'title') return;
        
        // Format value based on type
        let formattedValue;
        if (typeof value === 'object' && value !== null) {
          formattedValue = JSON.stringify(value).slice(0, 100);
          if (JSON.stringify(value).length > 100) formattedValue += '...';
        } else if (typeof value === 'string') {
          formattedValue = value.length > 100 ? value.slice(0, 100) + '...' : value;
        } else {
          formattedValue = String(value);
        }
        
        html += `<div class="item-field"><span class="field-name">${key}:</span> ${this.escapeHtml(formattedValue)}</div>`;
      });
      html += `</div>`;
      
      html += `</div>`; // Close item-content
      html += `</div>`; // Close result-item
    });
    
    html += '</div>'; // Close result-items
    return html;
  }
  
  /**
   * Syntax highlight JSON for better readability
   * @param {Object|Array} json - The JSON to highlight
   * @returns {string} - Highlighted HTML string
   */
  syntaxHighlightJson(json) {
    const jsonStr = JSON.stringify(json, null, 2);
    return this.escapeHtml(jsonStr)
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      });
  }

  /**
   * Normalize a tool call object to have consistent properties
   * @param {Object} toolCall - The tool call object
   * @returns {Object|null} - Normalized tool call or null if invalid
   */
  normalizeToolCall(toolCall) {
    if (!toolCall) return null;
    
    let name = null;
    let args = {};
    let id = null;
    
    // Extract name from different possible properties
    if (toolCall.toolName) {
      name = toolCall.toolName;
    } else if (toolCall.name) {
      name = toolCall.name;
    } else if (toolCall.functionCall && toolCall.functionCall.name) {
      name = toolCall.functionCall.name;
    } else if (toolCall.function && toolCall.function.name) {
      name = toolCall.function.name;
    }
    
    // Extract tool call ID from different possible properties
    if (toolCall.toolCallId) {
      id = toolCall.toolCallId;
    } else if (toolCall.id) {
      id = toolCall.id;
    } else {
      // Generate an ID if none exists
      id = `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }
    
    // Extract arguments from different possible properties
    if (toolCall.args) {
      args = toolCall.args;
    } else if (toolCall.parameters) {
      args = toolCall.parameters;
    } else if (toolCall.functionCall && toolCall.functionCall.arguments) {
      try {
        if (typeof toolCall.functionCall.arguments === 'string') {
          args = JSON.parse(toolCall.functionCall.arguments);
        } else {
          args = toolCall.functionCall.arguments;
        }
      } catch (e) {
        args = { rawArguments: toolCall.functionCall.arguments };
      }
    }
    
    // Return null if no name was found
    if (!name) return null;
    
    return {
      name,
      args,
      id
    };
  }

  /**
   * Process and extract text from a complex response
   * @param {*} response - Response object from API
   * @returns {Object} - Processed response with text, tool calls, etc.
   */
  processResponse(response) {
    try {
      if (!response) {
        throw new Error('Empty response received');
      }

      // Log the response for debugging
      if (this.debug) {
        console.debug('Processing LLM response:', response);
      }

      // Handle character-by-character response (indexed object format from Gemini)
      if (response && typeof response === 'object' && response['0'] !== undefined) {
        formatterLogger.debug('Detected character-by-character response format, reconstructing text');
        
        // Reconstruct the string from indexed characters
        let reconstructedText = '';
        let i = 0;
        
        // Get all numeric keys and sort them
        const keys = Object.keys(response)
                          .filter(key => !isNaN(parseInt(key)))
                          .sort((a, b) => parseInt(a) - parseInt(b));
        
        // Rebuild the text string
        for (const key of keys) {
          reconstructedText += response[key];
        }
        
        formatterLogger.debug(`Reconstructed text from ${keys.length} characters, trying to parse as JSON`);
        
        // Try to parse the reconstructed text as JSON
        try {
          const parsed = JSON.parse(reconstructedText);
          formatterLogger.debug('Successfully parsed reconstructed text as JSON');
          
          // Process the parsed JSON object recursively
          return this.processResponse(parsed);
        } catch (e) {
          // Use the reconstructed text directly if it's not parseable JSON
          formatterLogger.debug('Failed to parse reconstructed text as JSON, using as plain text');
          
          return {
            role: 'assistant',
            text: reconstructedText,
            timestamp: response.timestamp || new Date().toISOString()
          };
        }
      }

      // Ensure we have a text property
      let text = '';
      if (response.text) {
        text = response.text;
      } else if (response.content) {
        text = response.content;
      } else if (typeof response === 'string') {
        text = response;
      }

      // If text is a JSON string that contains candidates structure, extract the actual content
      if (text && typeof text === 'string' && 
          (text.trim().startsWith('{') && text.includes('"candidates"'))) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.candidates && parsed.candidates.length > 0) {
            const candidate = parsed.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
              const textParts = candidate.content.parts
                .filter(part => part.text)
                .map(part => part.text);
              
              text = textParts.join('\n');
              formatterLogger.debug('Extracted text from candidates JSON structure');
            }
          }
        } catch (e) {
          // Keep original text if parsing fails
          formatterLogger.debug('Text appears to be JSON but failed to parse', e);
        }
      }

      // Process tool calls if they exist
      const toolCalls = this.extractToolCalls(response);

      // Format the response object
      const formattedResponse = {
        role: response.role || 'assistant',
        text: text,
        content: text, // Add content field directly (critical for ChatMessages)
        ...(response.timestamp && { timestamp: response.timestamp }),
        ...(toolCalls && toolCalls.length > 0 && { toolCalls }),
        raw: this.debug ? response : undefined
      };

      // Check for tool calls embedded in markdown/code blocks
      if ((!toolCalls || toolCalls.length === 0) && text) {
        this.checkForEmbeddedToolCalls(formattedResponse);
      }

      return formattedResponse;
    } catch (error) {
      console.error('Error processing LLM response:', error);
      return {
        role: 'assistant',
        text: `Error processing response: ${error.message}`,
        error: true
      };
    }
  }

  /**
   * Extract tool calls from the response
   * @param {Object} response - LLM response
   * @returns {Array|null} - Extracted tool calls
   */
  extractToolCalls(response) {
    // Direct toolCalls from response
    if (response.toolCalls && Array.isArray(response.toolCalls) && response.toolCalls.length > 0) {
      return response.toolCalls;
    }

    // Legacy functionCalls format from some APIs
    if (response.functionCalls && Array.isArray(response.functionCalls) && response.functionCalls.length > 0) {
      return response.functionCalls.map(call => ({
        toolCallId: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        toolName: call.name,
        parameters: call.args || {}
      }));
    }

    // Check in content property
    if (response.content && typeof response.content === 'object' && response.content.toolCalls) {
      return response.content.toolCalls;
    }

    return null;
  }

  /**
   * Check for tool calls embedded in markdown or code blocks
   * @param {Object} formattedResponse - Formatted response object
   */
  checkForEmbeddedToolCalls(formattedResponse) {
    if (!formattedResponse.text) return;

    // Regex patterns to find tool calls in markdown code blocks
    const patterns = [
      // Include searchKnowledgeBase in the patterns
      /```(?:tool_code|tool|code)?\s*\n(searchKnowledgeBase.*?\(.*?\))/gs,
      /tool_code\s*\n(searchKnowledgeBase.*?\(.*?\))/g,
      /```.*?\n(searchKnowledgeBase.*?\(.*?\))\s*```/gs,
      // Keep original patterns for listFiles
      /```(?:tool_code|tool|code)?\s*\n(listFiles.*?\(.*?\))/gs,
      /tool_code\s*\n(listFiles.*?\(.*?\))/g,
      /```.*?\n(listFiles.*?\(.*?\))\s*```/gs,
      // Generic pattern to catch any tool call with parentheses
      /```(?:tool_code|tool|code)?\s*\n(\w+\(.*?\))/gs,
      /tool_code\s*\n(\w+\(.*?\))/g,
      /```.*?\n(\w+\(.*?\))\s*```/gs
    ];

    // Try each pattern
    for (const pattern of patterns) {
      const matches = [...formattedResponse.text.matchAll(pattern)];
      if (matches && matches.length > 0) {
        console.log('Found embedded tool calls:', matches);
        
        // Initialize toolCalls array if it doesn't exist
        if (!formattedResponse.toolCalls) {
          formattedResponse.toolCalls = [];
        }
        
        // Process each match
        matches.forEach((match, index) => {
          const toolCall = match[1]; // Get the captured tool call
          if (toolCall) {
            // Extract tool name and parameters
            const toolName = toolCall.split('(')[0].trim();
            let paramsStr = toolCall.match(/\((.*?)\)/)?.[1] || '';
            
            // Parse parameters
            const params = {};
            const paramMatches = [...paramsStr.matchAll(/(\w+)\s*=\s*["'](.*?)["']/g)];
            paramMatches.forEach(paramMatch => {
              params[paramMatch[1]] = paramMatch[2];
            });
            
            // Add to toolCalls array
            formattedResponse.toolCalls.push({
              toolCallId: `embedded-${Date.now()}-${index}`,
              toolName: toolName,
              parameters: params
            });
            
            console.log(`Extracted embedded tool call: ${toolName}`, params);
          }
        });
        
        // Flag that we found embedded tool calls
        formattedResponse.containsEmbeddedToolCalls = true;
        
        // Exit once we've found matches
        break;
      }
    }
  }

  /**
   * Format text content for display
   * @param {string} text - Raw text content
   * @returns {string} - Formatted text
   */
  formatTextContent(text) {
    if (!text) return '';
    
    // Replace tool calls in code blocks with a placeholder for UI rendering
    text = text.replace(
      /```(?:tool_code|tool|code)?\s*\n(listFiles.*?\(.*?\))\s*```/gs,
      '<tool-call-placeholder>$1</tool-call-placeholder>'
    );
    
    return text;
  }
}

// Export a singleton instance
const messageFormatter = new MessageFormatter();
export default messageFormatter; 