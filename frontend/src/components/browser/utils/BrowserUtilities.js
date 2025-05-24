/**
 * Browser Utilities - Helper functions for browser component
 * @deprecated - Most functionality has been moved to BrowserEnv.js for centralization
 * This file now imports from BrowserEnv.js to maintain compatibility while removing duplication
 */

// Import all centralized functions from BrowserEnv
import {
  detectEnvironment,
  formatUrl,
  applySiteSpecificSettings,
  applySandboxSettings,
  getIconForUrl,
  formatBytes,
  showToastNotification,
  updatePageTitle
} from './BrowserEnv.js';

// Re-export for backward compatibility
export {
  detectEnvironment,
  formatUrl,
  applySiteSpecificSettings,
  applySandboxSettings,
  getIconForUrl,
  formatBytes,
  showToastNotification,
  updatePageTitle
}; 