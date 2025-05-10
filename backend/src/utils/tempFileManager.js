/**
 * Utility for managing temporary files
 * Handles creation, cleanup, and organization of temporary files
 */

const fs = require('fs');
const path = require('path');
const { createContextLogger } = require('./logger');

const logger = createContextLogger('TempFileManager');

/**
 * Default temp directory path relative to project root
 */
const DEFAULT_TEMP_DIR = path.resolve(__dirname, '../../../temp');

/**
 * Ensures the temp directory exists
 * @param {string} tempDir - Path to temp directory
 * @returns {string} Path to the temp directory
 */
function ensureTempDir(tempDir = DEFAULT_TEMP_DIR) {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    logger.debug(`Created temp directory at: ${tempDir}`);
  }
  return tempDir;
}

/**
 * Safely deletes a file with error handling
 * @param {string} filePath - Path to file to delete
 * @returns {boolean} True if deletion was successful, false otherwise
 */
function safeDeleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug(`Deleted temporary file: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.warn(`Failed to delete file ${filePath}`, { error: error.message });
    return false;
  }
}

/**
 * Find files in directory matching a pattern
 * @param {string} directory - Directory to search
 * @param {Function} filterFn - Function to filter files (receives filename)
 * @returns {string[]} Array of matching file paths
 */
function findFiles(directory, filterFn) {
  try {
    ensureTempDir(directory);
    const files = fs.readdirSync(directory);
    return files
      .filter(filterFn)
      .map(file => path.join(directory, file));
  } catch (error) {
    logger.warn(`Error finding files in ${directory}`, { error: error.message });
    return [];
  }
}

/**
 * Checks multiple possible file paths and returns the first one that exists
 * @param {string[]} possiblePaths - Array of possible file paths
 * @returns {string|null} Path to existing file or null if none found
 */
function findExistingFile(possiblePaths) {
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Creates a properly structured path for a temporary file
 * @param {string} prefix - Prefix for the filename
 * @param {string} id - Unique identifier
 * @param {string} extension - File extension
 * @param {string} tempDir - Temp directory path
 * @returns {string} Path to temp file
 */
function getTempFilePath(prefix, id, extension, tempDir = DEFAULT_TEMP_DIR) {
  ensureTempDir(tempDir);
  return path.join(tempDir, `${prefix}_${id}${extension}`);
}

/**
 * Cleans up temporary files associated with a specific ID
 * @param {string} id - Identifier to match in filenames
 * @param {string} tempDir - Temp directory path
 * @returns {number} Number of files deleted
 */
function cleanupTempFiles(id, tempDir = DEFAULT_TEMP_DIR) {
  ensureTempDir(tempDir);
  
  let deletedCount = 0;
  
  try {
    const tempFiles = fs.readdirSync(tempDir);
    
    tempFiles.forEach(file => {
      if (file.includes(id)) {
        const filePath = path.join(tempDir, file);
        if (safeDeleteFile(filePath)) {
          deletedCount++;
        }
      }
    });
    
    if (deletedCount > 0) {
      logger.debug(`Cleaned up ${deletedCount} temporary files for ID: ${id}`);
    }
    
    return deletedCount;
  } catch (error) {
    logger.warn(`Error cleaning up temp files for ID: ${id}`, { error: error.message });
    return deletedCount;
  }
}

/**
 * Safely moves a file from one location to another
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @returns {boolean} True if successful, false otherwise
 */
function safeMoveTempFile(sourcePath, destPath) {
  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      fs.unlinkSync(sourcePath);
      logger.debug(`Moved file from ${sourcePath} to ${destPath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.warn(`Failed to move file from ${sourcePath} to ${destPath}`, { 
      error: error.message 
    });
    return false;
  }
}

/**
 * Manages multiple potential temp file configurations
 * Common with tools like youtube-dl that have inconsistent output patterns
 */
class TempFileHandler {
  /**
   * @param {string} id - Unique identifier (video ID, document hash, etc.)
   * @param {string} tempDir - Directory to store temp files
   */
  constructor(id, tempDir = DEFAULT_TEMP_DIR) {
    this.id = id;
    this.tempDir = ensureTempDir(tempDir);
    this.possiblePaths = [];
    this.fallbackPaths = [];
  }

  /**
   * Add potential paths where the file might be created
   * @param {string[]} paths - Array of possible file paths
   * @returns {TempFileHandler} This instance for chaining
   */
  addPossiblePaths(paths) {
    this.possiblePaths = [...this.possiblePaths, ...paths];
    return this;
  }

  /**
   * Add fallback paths outside the temp directory to check
   * @param {string[]} paths - Array of fallback paths to check
   * @returns {TempFileHandler} This instance for chaining
   */
  addFallbackPaths(paths) {
    this.fallbackPaths = [...this.fallbackPaths, ...paths];
    return this;
  }

  /**
   * Add paths for files with a pattern in the temp directory
   * @param {string} pattern - Substring to match in filename
   * @returns {TempFileHandler} This instance for chaining
   */
  includeFilesMatching(pattern) {
    try {
      const files = fs.readdirSync(this.tempDir);
      const matchingFiles = files
        .filter(file => file.includes(pattern))
        .map(file => path.join(this.tempDir, file));
      
      this.addPossiblePaths(matchingFiles);
    } catch (error) {
      logger.warn(`Error finding files matching pattern: ${pattern}`, { 
        error: error.message 
      });
    }
    
    return this;
  }

  /**
   * Find the first existing file from the possible paths
   * @returns {string|null} Path to existing file or null if none found
   */
  findExistingFile() {
    // Check main possible paths first
    const existingFile = findExistingFile(this.possiblePaths);
    if (existingFile) return existingFile;
    
    // Check any files in temp dir matching ID
    this.includeFilesMatching(this.id);
    const existingInTemp = findExistingFile(this.possiblePaths);
    if (existingInTemp) return existingInTemp;
    
    // Check fallback paths last
    const fallbackFile = findExistingFile(this.fallbackPaths);
    if (fallbackFile) {
      // If found in fallback location, move to temp dir for consistency
      const filename = path.basename(fallbackFile);
      const tempPath = path.join(this.tempDir, filename);
      
      if (safeMoveTempFile(fallbackFile, tempPath)) {
        return tempPath;
      }
      return fallbackFile;
    }
    
    return null;
  }

  /**
   * Clean up all temp files associated with this ID
   * @returns {number} Number of files deleted
   */
  cleanup() {
    return cleanupTempFiles(this.id, this.tempDir);
  }
}

module.exports = {
  DEFAULT_TEMP_DIR,
  ensureTempDir,
  safeDeleteFile,
  findFiles,
  findExistingFile,
  getTempFilePath,
  cleanupTempFiles,
  safeMoveTempFile,
  TempFileHandler
}; 