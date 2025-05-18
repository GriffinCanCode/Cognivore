/**
 * Extraction System - Index
 * 
 * Centralized export point for all extraction-related functionality
 */

// Main ExtractorManager
import ExtractorManager from './ExtractorManager';

// Extractors
import WebviewExtractor from './extractors/WebviewExtractor';
import ReadabilityExtractor from './extractors/ReadabilityExtractor';
import IpcExtractor from './extractors/IpcExtractor';
import DomProxyExtractor from './extractors/DomProxyExtractor';
import FetchExtractor from './extractors/FetchExtractor';
import FallbackExtractor from './extractors/FallbackExtractor';

// Processors
import ContentProcessor from './processors/ContentProcessor';
import TextProcessor from './processors/TextProcessor';
import HeadingProcessor from './processors/HeadingProcessor';
import LinksProcessor from './processors/LinksProcessor';
import MetadataProcessor from './processors/MetadataProcessor';

// Utils
import ContentValidator from './utils/ContentValidator';
import ContentEnhancer from './utils/ContentEnhancer';
import DomUtils from './utils/DomUtils';
import ReadabilityAdapter from './utils/ReadabilityAdapter';
import UrlUtils from './utils/UrlUtils';

// Legacy adapters
import * as LegacyContentExtractor from './adapters/LegacyContentExtractor';
import * as LegacyExtractionSystem from './adapters/LegacyExtractionSystem';

// Main extraction function for backward compatibility
export const extractContent = ExtractorManager.extract;

// Export all components
export {
  // Main manager
  ExtractorManager,
  
  // Extractors
  WebviewExtractor,
  ReadabilityExtractor,
  IpcExtractor,
  DomProxyExtractor,
  FetchExtractor,
  FallbackExtractor,
  
  // Processors
  ContentProcessor,
  TextProcessor,
  HeadingProcessor,
  LinksProcessor,
  MetadataProcessor,
  
  // Utils
  ContentValidator,
  ContentEnhancer,
  DomUtils,
  ReadabilityAdapter,
  UrlUtils,
  
  // Legacy adapters
  LegacyContentExtractor,
  LegacyExtractionSystem
};

export default ExtractorManager; 