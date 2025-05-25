/**
 * StyleManager.js - Centralized style management for browser components
 * 
 * This module handles style maintenance for browser elements after initial creation,
 * primarily focusing on webview styling updates during browser lifecycle.
 */

import logger from '../../../utils/logger';

// Create a logger instance for this module
const styleLogger = logger.scope('StyleManager');

// Style application state tracking
const styleState = {
  applicationTimes: new Map(), // Track last style application time by webview id
  styleApplicationCounts: new Map(), // Count style applications by webview id
  initialStylesAppliedTimes: new Map(), // Track when initial styles were applied
  styleApplicationLocks: new Map(), // Locks to prevent concurrent style operations
  styleOperationQueue: [], // Queue of pending style operations
  
  // CIRCUIT BREAKER: Add throttling and rate limiting
  maxApplicationsPerMinute: 20, // Maximum 20 style applications per minute per webview
  cooldownPeriod: 3000, // 3 second cooldown between style applications
  emergencyThrottlePeriod: 10000, // 10 second emergency throttle when overloaded
  applicationHistory: new Map(), // Track application history for rate limiting
  isEmergencyMode: new Map() // Track if a webview is in emergency throttle mode
};

/**
 * Safe wrapper for applying styles to a webview
 * Handles null checks and error handling
 * @param {HTMLElement} webview - The webview element
 * @param {boolean} show - Whether to show or hide the webview
 * @returns {boolean} Success state
 */
function safeApplyStyles(webview, show = true) {
  if (!webview) return false;
  
  try {
    if (show) {
      // First ensure the webview container has proper dimensions
      const container = webview.parentElement;
      if (container) {
        container.style.cssText = `
          position: relative !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 500px !important;
          display: flex !important;
          flex: 1 !important;
          overflow: hidden !important;
        `;
      }
      
      // Apply comprehensive webview styles
      webview.style.cssText = `
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 500px !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 1 !important;
        background-color: white !important;
        flex: 1 !important;
        pointer-events: auto !important;
      `;
      
      // Force layout recalculation
      void webview.offsetHeight;
      
      console.log('Applied critical visibility styles to webview and container');
    } else {
      webview.style.visibility = 'hidden';
      webview.style.opacity = '0';
    }
    
    return true;
  } catch (err) {
    console.error('Error in safeApplyStyles:', err);
    return false;
  }
}

/**
 * Ensure the webview has the applyAllCriticalStyles method
 * @param {HTMLElement} webview - Webview element to enhance
 * @returns {boolean} - Whether the method was added
 */
function ensureApplyAllCriticalStylesMethod(webview) {
  if (!webview) {
    styleLogger.error('Cannot add applyAllCriticalStyles - webview is null');
    return false;
  }

  // Already has the method
  if (typeof webview.applyAllCriticalStyles === 'function') {
    return true;
  }

  try {
    // Add the method directly to the webview instance
    webview.applyAllCriticalStyles = function(show = true) {
      styleLogger.debug(`applyAllCriticalStyles called with show=${show}`);
      
      // Check if the webview is still valid
      if (!this || !this.isConnected) {
        styleLogger.warn('applyAllCriticalStyles called on disconnected webview');
        return false;
      }
      
      try {
        if (show) {
          // Apply comprehensive styling using StyleManager
          applyWebviewStyles(null, this, true);
        } else {
          // Hide the webview
          this.style.visibility = 'hidden';
          this.style.opacity = '0';
        }
        
        return show;
      } catch (error) {
        styleLogger.error('Error in applyAllCriticalStyles execution:', error);
        
        // Direct fallback for critical properties
        try {
          if (show) {
            this.style.visibility = 'visible';
            this.style.opacity = '1';
            this.style.display = 'flex';
          } else {
            this.style.visibility = 'hidden';
            this.style.opacity = '0';
          }
          return show;
        } catch (finalError) {
          styleLogger.error('Final fallback failed in applyAllCriticalStyles:', finalError);
          return false;
        }
      }
    };
    
    styleLogger.info(`Added applyAllCriticalStyles method to webview (${webview.id || 'unknown'})`);
    return true;
  } catch (error) {
    styleLogger.error('Error adding applyAllCriticalStyles method:', error);
    return false;
  }
}

/**
 * Apply core webview styling immediately after creation
 * @param {HTMLElement} webview - Webview element to style
 */
function applyInitialStyles(webview) {
  if (!webview) {
    styleLogger.error('Cannot apply initial styles - webview is null');
    return;
  }

  // Ensure the webview has the applyAllCriticalStyles method
  ensureApplyAllCriticalStylesMethod(webview);

  const webviewId = webview.id || 'unknown-webview';
  styleLogger.info(`Applying initial styles to webview (${webviewId})`);

  // Track application time
  styleState.initialStylesAppliedTimes.set(webviewId, Date.now());
  styleState.applicationTimes.set(webviewId, Date.now());
  
  // Increment application count
  const count = styleState.styleApplicationCounts.get(webviewId) || 0;
  styleState.styleApplicationCounts.set(webviewId, count + 1);
  
  try {
    // Get element dimensions before styling for comparison
    const initialDimensions = {
      width: webview.clientWidth,
      height: webview.clientHeight
    };
    
    styleLogger.debug(`Initial webview dimensions: ${initialDimensions.width}x${initialDimensions.height}`);
    
    // Apply core CSS inline
    const cssText = `
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 1 !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
      max-height: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      background-color: white !important;
      transform: none !important;
      overflow: hidden !important;
      flex: 1 1 auto !important;
    `;
    
    webview.style.cssText = cssText;
    styleLogger.debug('Applied inline CSS styles directly');
    
    // Check if dimensions changed
    const newDimensions = {
      width: webview.clientWidth,
      height: webview.clientHeight
    };
    
    styleLogger.debug(`New webview dimensions: ${newDimensions.width}x${newDimensions.height}, ` +
      `delta: ${newDimensions.width - initialDimensions.width}x${newDimensions.height - initialDimensions.height}`);
    
    // Apply other essential properties
    webview.style.visibility = 'visible';
    webview.style.opacity = '1';
    
    // Ensure the display property is set correctly
    if (window.getComputedStyle(webview).display === 'none') {
      styleLogger.warn('Webview display is none after style application, forcing to flex');
      webview.style.display = 'flex !important';
    }
    
    styleLogger.info(`Initial styles applied to webview (${webviewId}) successfully`);
  } catch (error) {
    styleLogger.error(`Error applying initial styles to webview (${webviewId}):`, error);
  }
}

/**
 * Apply essential styles to ensure webview display
 * @param {HTMLElement} webview - Webview element to style
 */
function applyEssentialStyles(webview) {
  if (!webview) {
    styleLogger.error('Cannot apply essential styles - webview is null');
    return;
  }
  
  const webviewId = webview.id || 'unknown-webview';
  styleLogger.info(`Applying essential styles to webview (${webviewId})`);
  
  try {
    // Get current computed styles
    const computedStyle = window.getComputedStyle(webview);
    styleLogger.debug('Current computed styles:', {
      visibility: computedStyle.visibility,
      opacity: computedStyle.opacity,
      display: computedStyle.display,
      position: computedStyle.position,
      zIndex: computedStyle.zIndex
    });
    
    // Focus on critical visibility properties
    webview.style.visibility = 'visible';
    webview.style.opacity = '1';
    webview.style.display = computedStyle.display === 'none' ? 'flex' : computedStyle.display;
    
    // Ensure proper dimensions
    webview.style.width = '100%';
    webview.style.height = '100%';
    webview.style.minHeight = '100%';
    webview.style.maxHeight = '100%';
    
    // Check parent container dimensions
    const parent = webview.parentElement;
    if (parent) {
      styleLogger.debug('Parent container dimensions:', {
        width: parent.clientWidth,
        height: parent.clientHeight,
        display: window.getComputedStyle(parent).display,
        position: window.getComputedStyle(parent).position
      });
    } else {
      styleLogger.warn('Webview has no parent element - might not be in DOM');
    }
    
    // Verify DOM attachment
    if (!document.body.contains(webview)) {
      styleLogger.error('Webview is not in DOM - styles may not apply correctly');
    }
    
    styleLogger.info(`Essential styles applied to webview (${webviewId})`);
  } catch (error) {
    styleLogger.error(`Error applying essential styles to webview (${webviewId}):`, error);
  }
}

/**
 * Apply final styling after load is complete
 * @param {HTMLElement} webview - Webview element to style
 */
function applyLoadCompleteStyling(webview) {
  if (!webview) {
    styleLogger.error('Cannot apply load complete styling - webview is null');
    return;
  }
  
  const webviewId = webview.id || 'unknown-webview';
  styleLogger.info(`Applying load complete styling to webview (${webviewId})`);
  
  try {
    // Ensure visibility is set to visible with full opacity
    webview.style.visibility = 'visible';
    webview.style.opacity = '1';
    
    // Ensure scrolling works correctly
    webview.style.overflow = 'hidden';
    
    // Apply specific post-load enhancements
    setTimeout(() => {
      try {
        // Execute JavaScript in the webview to fix any potential content issues
        if (webview.executeScript) {
          styleLogger.debug('Executing styling script in webview content');
          webview.executeScript({
            code: `
              document.documentElement.style.height = '100%';
              document.body.style.height = '100%';
              document.body.style.margin = '0';
              document.body.style.padding = '0';
            `
          }).catch(err => {
            styleLogger.warn('Failed to execute style script in webview:', err);
          });
        } else {
          styleLogger.debug('No executeScript method available - skipping content styling');
        }
      } catch (error) {
        styleLogger.warn('Error applying post-load styling via script:', error);
      }
    }, 100);
    
    styleLogger.info(`Load complete styles applied to webview (${webviewId})`);
  } catch (error) {
    styleLogger.error(`Error applying load complete styles to webview (${webviewId}):`, error);
  }
}

/**
 * Check if style application should be allowed (circuit breaker)
 * @param {string} webviewId - Webview ID
 * @param {boolean} force - Force application even with limits
 * @returns {boolean} - Whether style application is allowed
 */
function isStyleApplicationAllowed(webviewId, force = false) {
  if (force) {
    styleLogger.debug(`Style application forced for ${webviewId}, bypassing circuit breaker`);
    return true;
  }
  
  const now = Date.now();
  
  // Check if webview is in emergency throttle mode
  const emergencyModeUntil = styleState.isEmergencyMode.get(webviewId);
  if (emergencyModeUntil && now < emergencyModeUntil) {
    const remainingMs = emergencyModeUntil - now;
    styleLogger.warn(`🚨 CIRCUIT BREAKER: ${webviewId} in emergency throttle mode for ${Math.round(remainingMs/1000)}s more`);
    return false;
  }
  
  // Check basic cooldown period
  const lastApplied = styleState.applicationTimes.get(webviewId) || 0;
  if (now - lastApplied < styleState.cooldownPeriod) {
    styleLogger.debug(`🔒 CIRCUIT BREAKER: ${webviewId} still in cooldown period (${now - lastApplied}ms ago)`);
    return false;
  }
  
  // Check rate limiting (applications per minute)
  const history = styleState.applicationHistory.get(webviewId) || [];
  const oneMinuteAgo = now - 60000;
  
  // Clean old entries
  const recentApplications = history.filter(time => time > oneMinuteAgo);
  styleState.applicationHistory.set(webviewId, recentApplications);
  
  if (recentApplications.length >= styleState.maxApplicationsPerMinute) {
    styleLogger.warn(`🛑 CIRCUIT BREAKER: ${webviewId} exceeded rate limit (${recentApplications.length}/${styleState.maxApplicationsPerMinute} per minute)`);
    
    // Enter emergency throttle mode
    styleState.isEmergencyMode.set(webviewId, now + styleState.emergencyThrottlePeriod);
    return false;
  }
  
  return true;
}

/**
 * Record style application for circuit breaker tracking
 * @param {string} webviewId - Webview ID
 */
function recordStyleApplication(webviewId) {
  const now = Date.now();
  
  // Update application time
  styleState.applicationTimes.set(webviewId, now);
  
  // Add to history
  const history = styleState.applicationHistory.get(webviewId) || [];
  history.push(now);
  styleState.applicationHistory.set(webviewId, history);
  
  // Update count
  const count = styleState.styleApplicationCounts.get(webviewId) || 0;
  styleState.styleApplicationCounts.set(webviewId, count + 1);
}

/**
 * General purpose function to apply full set of styles to a webview
 * @param {Object} browser - Browser component
 * @param {HTMLElement} webview - Webview element
 * @param {boolean} force - Force style application even if recently applied
 */
function applyWebviewStyles(browser, webview, force = false) {
  if (!webview) {
    styleLogger.error('Cannot apply webview styles - webview is null');
    return;
  }
  
  const webviewId = webview.id || 'unknown-webview';
  
  // CIRCUIT BREAKER: Check if style application is allowed
  if (!isStyleApplicationAllowed(webviewId, force)) {
    return;
  }
  
  // Check if we're already applying styles to this webview
  if (styleState.styleApplicationLocks.get(webviewId)) {
    styleLogger.debug(`Style application already in progress for ${webviewId} - queueing`);
    
    // CIRCUIT BREAKER: Limit queue size to prevent memory issues
    if (styleState.styleOperationQueue.length < 5) {
      styleState.styleOperationQueue.push({ browser, webview, force });
    } else {
      styleLogger.warn(`🛑 CIRCUIT BREAKER: Style operation queue full, dropping request for ${webviewId}`);
    }
    return;
  }
  
  // Set lock
  styleState.styleApplicationLocks.set(webviewId, true);
  
  try {
    styleLogger.info(`🎨 Applying full webview styles to ${webviewId}`);
    
    // Record this application for circuit breaker
    recordStyleApplication(webviewId);
    
    const count = styleState.styleApplicationCounts.get(webviewId) || 0;
    
    // Log current style state for debugging (but less frequently)
    if (count === 0 || count % 10 === 0) { // Reduced from every 5 to every 10
      const computedStyle = window.getComputedStyle(webview);
      styleLogger.debug(`Current computed styles for ${webviewId}:`, {
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        display: computedStyle.display,
        position: computedStyle.position,
        width: computedStyle.width,
        height: computedStyle.height,
        zIndex: computedStyle.zIndex,
        inDOM: document.body.contains(webview),
        applicationCount: count + 1,
        isEmergencyMode: styleState.isEmergencyMode.has(webviewId)
      });
    }
    
    // Apply comprehensive styling
    webview.style.cssText = `
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 1 !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
      max-height: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      background-color: white !important;
      transform: none !important;
      overflow: hidden !important;
      flex: 1 1 auto !important;
    `;
    
    // Force-set critical properties individually as well
    webview.style.visibility = 'visible';
    webview.style.opacity = '1';
    webview.style.display = 'flex';
    
    styleLogger.debug(`✅ Styles applied to ${webviewId} - application count: ${count + 1}`);
  } catch (error) {
    styleLogger.error(`Error applying styles to ${webviewId}:`, error);
  } finally {
    // Release lock
    styleState.styleApplicationLocks.set(webviewId, false);
    
    // Process any queued operations (but with throttling)
    if (styleState.styleOperationQueue.length > 0) {
      const nextOperation = styleState.styleOperationQueue.shift();
      styleLogger.debug(`Processing queued style operation for ${nextOperation.webview.id || 'unknown'}`);
      setTimeout(() => {
        applyWebviewStyles(nextOperation.browser, nextOperation.webview, nextOperation.force);
      }, 100); // Increased delay from 50ms to 100ms
    }
  }
}

/**
 * Schedule periodic style checks to ensure webview rendering
 * @param {Object} browser - Browser component
 * @param {HTMLElement} webview - Webview element
 * @returns {Array} Array of timeout IDs for cleanup
 */
function scheduleStyleChecks(browser, webview) {
  if (!webview) {
    styleLogger.error('Cannot schedule style checks - webview is null');
    return [];
  }
  
  const webviewId = webview.id || 'unknown-webview';
  styleLogger.info(`Scheduling style checks for ${webviewId}`);
  
  const timeouts = [];
  
  // CIRCUIT BREAKER: Reduced frequency and fewer checks to prevent overload
  // Only schedule critical checks at wider intervals
  const checkTimes = [1000, 5000, 15000]; // Reduced from [100, 250, 500, 1000, 2000, 5000]
  
  checkTimes.forEach(time => {
    const timeoutId = setTimeout(() => {
      styleLogger.debug(`Running scheduled style check at ${time}ms for ${webviewId}`);
      
      try {
        // CIRCUIT BREAKER: Only check if we're allowed to apply styles
        if (!isStyleApplicationAllowed(webviewId, false)) {
          styleLogger.debug(`Style check at ${time}ms skipped - circuit breaker active for ${webviewId}`);
          return;
        }
        
        // Check if styles need to be reapplied
        const computedStyle = window.getComputedStyle(webview);
        
        // Only fix critical visibility issues
        if (computedStyle.visibility !== 'visible' || 
            computedStyle.opacity !== '1' || 
            computedStyle.display === 'none') {
          
          styleLogger.warn(`Style check at ${time}ms found issues:`, {
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            display: computedStyle.display
          });
          
          // CIRCUIT BREAKER: Use minimal style fixes instead of full application
          webview.style.visibility = 'visible';
          webview.style.opacity = '1';
          if (computedStyle.display === 'none') {
            webview.style.display = 'flex';
          }
          
          // Record this as a style application for tracking
          recordStyleApplication(webviewId);
          
          styleLogger.debug(`Applied minimal style fixes for ${webviewId}`);
        } else {
          styleLogger.debug(`Style check at ${time}ms - styles OK`);
        }
      } catch (error) {
        styleLogger.error(`Error in style check at ${time}ms:`, error);
      }
    }, time);
    
    timeouts.push(timeoutId);
  });
  
  styleLogger.debug(`Scheduled ${timeouts.length} style checks for ${webviewId}`);
  return timeouts;
}

/**
 * Start monitoring for style changes in the webview
 * @param {HTMLElement} webview - Webview element
 */
function startStyleMonitoring(webview) {
  if (!webview) {
    styleLogger.error('Cannot start style monitoring - webview is null');
    return;
  }
  
  const webviewId = webview.id || 'unknown-webview';
  styleLogger.info(`Starting style monitoring for ${webviewId}`);
  
  try {
    // CIRCUIT BREAKER: Throttled mutation observer to prevent excessive operations
    let lastMutationTime = 0;
    const mutationThrottleDelay = 2000; // 2 second throttle between mutation handling
    
    // Create mutation observer to watch for style changes
    const observer = new MutationObserver((mutations) => {
      const now = Date.now();
      
      // CIRCUIT BREAKER: Throttle mutation handling
      if (now - lastMutationTime < mutationThrottleDelay) {
        styleLogger.debug(`Mutation handling throttled for ${webviewId}`);
        return;
      }
      
      // CIRCUIT BREAKER: Check if style application is allowed
      if (!isStyleApplicationAllowed(webviewId, false)) {
        styleLogger.debug(`Mutation handling skipped - circuit breaker active for ${webviewId}`);
        return;
      }
      
      const styleChanges = mutations.filter(mutation => 
        mutation.attributeName === 'style' || 
        mutation.attributeName === 'class'
      );
      
      if (styleChanges.length > 0) {
        lastMutationTime = now;
        styleLogger.debug(`Detected ${styleChanges.length} style changes on ${webviewId}`);
        
        // Check if styles need to be fixed
        const computedStyle = window.getComputedStyle(webview);
        
        if (computedStyle.visibility !== 'visible' || 
            computedStyle.opacity !== '1' || 
            computedStyle.display === 'none') {
            
          styleLogger.warn(`Style change detection found issues:`, {
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            display: computedStyle.display
          });
          
          // CIRCUIT BREAKER: Apply minimal fixes only, not full style application
          webview.style.visibility = 'visible';
          webview.style.opacity = '1';
          
          if (computedStyle.display === 'none') {
            webview.style.display = 'flex';
          }
          
          // Record this as a style application for tracking
          recordStyleApplication(webviewId);
          
          styleLogger.debug(`Applied minimal style fixes from mutation observer for ${webviewId}`);
        }
      }
    });
    
    // Start observing with reduced sensitivity
    observer.observe(webview, { 
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    // Store observer reference for cleanup
    webview._styleObserver = observer;
    
    styleLogger.debug(`Style monitoring started for ${webviewId}`);
  } catch (error) {
    styleLogger.error(`Error starting style monitoring for ${webviewId}:`, error);
  }
}

/**
 * Stop style monitoring for a webview
 * @param {HTMLElement} webview - Webview element
 */
function stopStyleMonitoring(webview) {
  if (!webview) {
    styleLogger.error('Cannot stop style monitoring - webview is null');
    return;
  }
  
  const webviewId = webview.id || 'unknown-webview';
  
  try {
    if (webview._styleObserver) {
      webview._styleObserver.disconnect();
      webview._styleObserver = null;
      styleLogger.debug(`Style monitoring stopped for ${webviewId}`);
    } else {
      styleLogger.debug(`No active style observer found for ${webviewId}`);
    }
  } catch (error) {
    styleLogger.error(`Error stopping style monitoring for ${webviewId}:`, error);
  }
}

/**
 * Clean up circuit breaker state for a specific webview
 * @param {string} webviewId - Webview ID to clean up
 */
function cleanupCircuitBreakerState(webviewId) {
  if (!webviewId) return;
  
  styleLogger.debug(`Cleaning up circuit breaker state for ${webviewId}`);
  
  try {
    styleState.applicationTimes.delete(webviewId);
    styleState.styleApplicationCounts.delete(webviewId);
    styleState.initialStylesAppliedTimes.delete(webviewId);
    styleState.styleApplicationLocks.delete(webviewId);
    styleState.applicationHistory.delete(webviewId);
    styleState.isEmergencyMode.delete(webviewId);
    
    // Remove any queued operations for this webview
    styleState.styleOperationQueue = styleState.styleOperationQueue.filter(
      op => op.webview.id !== webviewId
    );
    
    styleLogger.debug(`Circuit breaker state cleaned up for ${webviewId}`);
  } catch (error) {
    styleLogger.error(`Error cleaning up circuit breaker state for ${webviewId}:`, error);
  }
}

/**
 * Clean up all circuit breaker state (for complete reset)
 */
function cleanupAllCircuitBreakerState() {
  styleLogger.info('Cleaning up all circuit breaker state');
  
  try {
    styleState.applicationTimes.clear();
    styleState.styleApplicationCounts.clear();
    styleState.initialStylesAppliedTimes.clear();
    styleState.styleApplicationLocks.clear();
    styleState.applicationHistory.clear();
    styleState.isEmergencyMode.clear();
    styleState.styleOperationQueue = [];
    
    styleLogger.info('All circuit breaker state cleaned up');
  } catch (error) {
    styleLogger.error('Error cleaning up all circuit breaker state:', error);
  }
}

// Export functions
export default {
  applyInitialStyles,
  applyEssentialStyles,
  applyLoadCompleteStyling,
  applyWebviewStyles,
  scheduleStyleChecks,
  startStyleMonitoring,
  stopStyleMonitoring,
  ensureApplyAllCriticalStylesMethod,
  safeApplyStyles,
  cleanupCircuitBreakerState,
  cleanupAllCircuitBreakerState
}; 