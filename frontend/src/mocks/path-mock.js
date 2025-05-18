/**
 * Mock implementation of Node.js path module for browser environment
 * 
 * This provides basic path-related functionality to allow Node.js path
 * module usage in the browser context.
 */

// Basic path parsing and manipulating functions
function basename(path, ext) {
  if (typeof path !== 'string') return '';
  
  // First, normalize to forward slashes for consistent handling
  const normalizedPath = path.replace(/\\/g, '/');
  
  // Get the part after the last slash
  let base = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
  
  // Remove extension if specified and matches
  if (ext !== undefined && base.endsWith(ext)) {
    base = base.substring(0, base.length - ext.length);
  }
  
  return base;
}

function dirname(path) {
  if (typeof path !== 'string') return '.';
  
  // Normalize to forward slashes
  const normalizedPath = path.replace(/\\/g, '/');
  
  // Find the last slash
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  
  if (lastSlashIndex === -1) {
    // No slashes found, return '.'
    return '.';
  }
  
  // Special case for root
  if (lastSlashIndex === 0) {
    return '/';
  }
  
  // Return everything before the last slash
  return normalizedPath.substring(0, lastSlashIndex);
}

function extname(path) {
  if (typeof path !== 'string') return '';
  
  // Find the last dot after the last slash
  const lastSlashIndex = path.lastIndexOf('/');
  const lastDotIndex = path.lastIndexOf('.');
  
  // If there's no dot or the dot is before the last slash, return empty string
  if (lastDotIndex <= lastSlashIndex || lastDotIndex === -1) {
    return '';
  }
  
  // Return the extension including the dot
  return path.substring(lastDotIndex);
}

function join(...parts) {
  // Filter out empty parts
  const filtered = parts.filter(part => part !== '');
  
  // Join with forward slashes
  return filtered.join('/').replace(/\/+/g, '/');
}

// Simple resolve implementation for browser
function resolve(...parts) {
  // In browser context, we'll do a simplified version
  console.warn('path.resolve() has limited functionality in browser context');
  
  // Start with empty path
  let resolvedPath = '';
  
  // Process each part
  for (const part of parts) {
    // If it's an absolute path, reset the result
    if (part.startsWith('/')) {
      resolvedPath = part;
    } else {
      // Otherwise, join it to the current result
      resolvedPath = join(resolvedPath, part);
    }
  }
  
  return resolvedPath;
}

// Export the mock path functions
module.exports = {
  basename,
  dirname,
  extname,
  join,
  resolve,
  sep: '/',
  delimiter: ':',
  parse: (path) => {
    const dir = dirname(path);
    const base = basename(path);
    const ext = extname(path);
    const name = ext ? base.slice(0, -ext.length) : base;
    
    return {
      root: path.startsWith('/') ? '/' : '',
      dir,
      base,
      ext,
      name
    };
  },
  format: (pathObject) => {
    // Simple implementation
    const { dir, root, base } = pathObject;
    
    if (dir) {
      return join(dir, base);
    } else if (root) {
      return join(root, base);
    }
    
    return base;
  },
  isAbsolute: (path) => {
    return typeof path === 'string' && path.startsWith('/');
  },
  normalize: (path) => {
    // Simple normalization to remove duplicate slashes
    return path.replace(/\/+/g, '/');
  },
  relative: (from, to) => {
    console.warn('path.relative() has limited functionality in browser context');
    return to; // Simplified implementation
  }
}; 