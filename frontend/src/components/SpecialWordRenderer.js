/**
 * SpecialWordRenderer Component
 * Renders special words (Mnemosyne, Cognivore) with dramatic styling
 */
import logger from '../utils/logger.js';

// Create context-specific logger
const specialWordsLogger = logger.scope('SpecialWordRenderer');

class SpecialWordRenderer {
  /**
   * Constructor for SpecialWordRenderer
   */
  constructor() {
    // Words that need special styling
    this.specialWords = {
      'mnemosyne': {
        class: 'special-word mnemosyne',
        title: 'Goddess of Memory and Mother of the Muses'
      },
      'cognivore': {
        class: 'special-word cognivore',
        title: 'Servant of Mnemosyne, Devourer of Knowledge'
      }
    };

    specialWordsLogger.info('SpecialWordRenderer initialized');
  }

  /**
   * Process text and add special styling to specific words
   * @param {string} text - Text to process
   * @returns {string} - HTML with styled special words
   */
  processText(text) {
    if (!text) return '';

    // Create a regular expression that matches whole words case-insensitively
    const specialWordsPattern = Object.keys(this.specialWords)
      .map(word => `\\b(${word})\\b`)
      .join('|');
    
    // Use case-insensitive regex to find all special words
    const regex = new RegExp(specialWordsPattern, 'gi');
    
    // Replace matches with styled versions while preserving case
    return text.replace(regex, (match) => {
      const word = match.toLowerCase();
      const config = this.specialWords[word];
      
      // Create the styled version of the word
      return `<span class="${config.class}" title="${config.title}">${match}</span>`;
    });
  }

  /**
   * Process HTML content and add special styling to specific words without breaking HTML
   * @param {string} html - HTML content to process
   * @returns {string} - HTML with styled special words
   */
  processHtml(html) {
    if (!html) return '';
    
    // Parse HTML and process text nodes only
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Process all text nodes in the DOM tree
    this.processTextNodes(tempDiv);
    
    return tempDiv.innerHTML;
  }
  
  /**
   * Process text nodes in a DOM tree
   * @param {Node} node - The DOM node to process
   */
  processTextNodes(node) {
    // Skip processing for script, style, code, and pre elements
    if (node.nodeName === 'SCRIPT' || 
        node.nodeName === 'STYLE' || 
        node.nodeName === 'CODE' ||
        node.nodeName === 'PRE') {
      return;
    }
    
    // Process text nodes
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      // Create a temporary span to hold the processed text
      const span = document.createElement('span');
      span.innerHTML = this.processText(node.textContent);
      
      // Replace the text node with the span's children
      const parent = node.parentNode;
      const nextSibling = node.nextSibling;
      
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, nextSibling);
      }
      
      // Remove the original text node
      parent.removeChild(node);
    } else {
      // Process child nodes recursively
      const children = [...node.childNodes];
      children.forEach(child => this.processTextNodes(child));
    }
  }
}

export default SpecialWordRenderer; 