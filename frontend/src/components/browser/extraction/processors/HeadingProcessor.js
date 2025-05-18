/**
 * HeadingProcessor - Process and structure heading elements
 * 
 * This processor handles cleaning, formatting, and structuring heading elements
 * extracted from web pages to create document outlines.
 */

import logger from '../../../../utils/logger';

// Create a logger instance for this module
const headingLogger = logger.scope('HeadingProcessor');

/**
 * Process headings from a webpage
 * @param {Array} headings - Raw headings array with level and text
 * @returns {Array} Processed headings with hierarchy information
 */
function process(headings) {
  if (!headings || !Array.isArray(headings) || headings.length === 0) {
    return [];
  }
  
  try {
    headingLogger.info(`Processing ${headings.length} headings`);
    
    // First, clean and normalize the headings
    const cleanedHeadings = headings
      .filter(heading => 
        heading && 
        typeof heading.text === 'string' && 
        heading.text.trim() && 
        typeof heading.level === 'number' &&
        heading.level >= 1 && 
        heading.level <= 6
      )
      .map(heading => ({
        level: heading.level,
        text: cleanHeadingText(heading.text),
        id: generateIdFromHeading(heading.text)
      }));
    
    // If no valid headings after cleaning, return empty array
    if (cleanedHeadings.length === 0) {
      return [];
    }
    
    // Add hierarchy information (parent-child relationships)
    addHierarchyInfo(cleanedHeadings);
    
    return cleanedHeadings;
  } catch (error) {
    headingLogger.error(`Error processing headings: ${error.message}`, error);
    return headings;
  }
}

/**
 * Clean heading text by removing unwanted characters
 * @param {string} text - Raw heading text
 * @returns {string} Cleaned heading text
 */
function cleanHeadingText(text) {
  if (!text) return '';
  
  return text
    .trim()
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove HTML tags (simple version)
    .replace(/<\/?[^>]+(>|$)/g, '')
    // Remove emoji (optional based on your needs)
    // .replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '')
    // Limit length
    .slice(0, 100);
}

/**
 * Generate ID from heading text (for anchors)
 * @param {string} text - Heading text
 * @returns {string} ID suitable for HTML anchors
 */
function generateIdFromHeading(text) {
  if (!text) return '';
  
  return text
    .trim()
    .toLowerCase()
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Replace special characters
    .replace(/[^\w-]/g, '')
    // Avoid consecutive hyphens
    .replace(/-+/g, '-')
    // Ensure it starts with a letter
    .replace(/^[^a-z]+/, '')
    // Handle empty results or purely numeric headings
    .replace(/^$/, 'heading');
}

/**
 * Add hierarchy information to headings
 * @param {Array} headings - Array of heading objects
 */
function addHierarchyInfo(headings) {
  if (!headings || headings.length === 0) return;
  
  // Stack to track parent headings
  const stack = [];
  
  headings.forEach((heading, index) => {
    const level = heading.level;
    
    // Remove headings from stack that are same or lower level than current
    while (stack.length > 0 && headings[stack[stack.length - 1]].level >= level) {
      stack.pop();
    }
    
    // Set parent index if exists
    if (stack.length > 0) {
      heading.parentIndex = stack[stack.length - 1];
    }
    
    // Add current heading index to stack
    stack.push(index);
    
    // Add depth information (for indentation in UI)
    heading.depth = stack.length - 1;
    
    // Check if this heading has a next sibling at same level
    const nextHeading = headings[index + 1];
    heading.hasNextSibling = nextHeading && nextHeading.level === level;
  });
  
  // Add children indices to each heading
  headings.forEach((heading, index) => {
    heading.children = headings
      .filter(h => h.parentIndex === index)
      .map((_, childIndex) => headingIndexByParent(headings, index, childIndex));
  });
}

/**
 * Find index of a child heading by parent and child position
 * @param {Array} headings - Full headings array
 * @param {number} parentIndex - Index of parent heading
 * @param {number} childPosition - Position of child within parent's children
 * @returns {number} Index of the child heading in the full array
 */
function headingIndexByParent(headings, parentIndex, childPosition) {
  let currentPosition = -1;
  
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].parentIndex === parentIndex) {
      currentPosition++;
      if (currentPosition === childPosition) {
        return i;
      }
    }
  }
  
  return -1;
}

/**
 * Create an outline from headings (for display purposes)
 * @param {Array} headings - Processed headings
 * @returns {Object} Hierarchical outline object
 */
function createOutline(headings) {
  if (!headings || headings.length === 0) {
    return { title: '', sections: [] };
  }
  
  // Find top-level headings
  const topLevelHeadings = headings.filter(h => !h.parentIndex);
  
  // Create outline sections
  const sections = topLevelHeadings.map(heading => {
    return buildOutlineSection(heading, headings);
  });
  
  // Use first heading as title, or empty string if none
  const title = headings.length > 0 ? headings[0].text : '';
  
  return {
    title,
    sections
  };
}

/**
 * Build a section for the outline recursively
 * @param {Object} heading - Current heading
 * @param {Array} allHeadings - All headings
 * @returns {Object} Section object
 */
function buildOutlineSection(heading, allHeadings) {
  const section = {
    title: heading.text,
    id: heading.id,
    level: heading.level
  };
  
  // If heading has children, add subsections
  if (heading.children && heading.children.length > 0) {
    section.subsections = heading.children.map(childIndex => {
      return buildOutlineSection(allHeadings[childIndex], allHeadings);
    });
  }
  
  return section;
}

// Export methods
const HeadingProcessor = {
  process,
  createOutline,
  cleanHeadingText,
  generateIdFromHeading
};

export default HeadingProcessor;