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
  styleOperationQueue: [] // Queue of pending style operations
};

/**
 * Apply core webview styling immediately after creation
 * @param {HTMLElement} webview - Webview element to style
 */
function applyInitialStyles(webview) {
  if (!webview) {
    styleLogger.error('Cannot apply initial styles - webview is null');
    return;
  }

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
  
  // Rate limiting - don't apply styles too frequently unless forced
  const now = Date.now();
  const lastApplied = styleState.applicationTimes.get(webviewId) || 0;
  if (!force && (now - lastApplied < 500)) {
    styleLogger.debug(`Skipping style application for ${webviewId} - too soon (${now - lastApplied}ms)`);
    return;
  }
  
  // Check if we're already applying styles to this webview
  if (styleState.styleApplicationLocks.get(webviewId)) {
    styleLogger.debug(`Style application already in progress for ${webviewId} - queueing`);
    styleState.styleOperationQueue.push({ browser, webview, force });
    return;
  }
  
  // Set lock
  styleState.styleApplicationLocks.set(webviewId, true);
  
  try {
    styleLogger.info(`Applying full webview styles to ${webviewId}`);
    
    // Update tracking
    styleState.applicationTimes.set(webviewId, now);
    const count = styleState.styleApplicationCounts.get(webviewId) || 0;
    styleState.styleApplicationCounts.set(webviewId, count + 1);
    
    // Log current style state for debugging
    if (count === 0 || count % 5 === 0) {
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
        applicationCount: count + 1
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
    
    styleLogger.debug(`Styles applied to ${webviewId} - application count: ${count + 1}`);
  } catch (error) {
    styleLogger.error(`Error applying styles to ${webviewId}:`, error);
  } finally {
    // Release lock
    styleState.styleApplicationLocks.set(webviewId, false);
    
    // Process any queued operations
    if (styleState.styleOperationQueue.length > 0) {
      const nextOperation = styleState.styleOperationQueue.shift();
      styleLogger.debug(`Processing queued style operation for ${nextOperation.webview.id || 'unknown'}`);
      setTimeout(() => {
        applyWebviewStyles(nextOperation.browser, nextOperation.webview, nextOperation.force);
      }, 50);
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
  
  // Schedule checks at various intervals for robustness
  const checkTimes = [100, 250, 500, 1000, 2000, 5000];
  
  checkTimes.forEach(time => {
    const timeoutId = setTimeout(() => {
      styleLogger.debug(`Running scheduled style check at ${time}ms for ${webviewId}`);
      
      try {
        // Check if styles need to be reapplied
        const computedStyle = window.getComputedStyle(webview);
        
        if (computedStyle.visibility !== 'visible' || 
            computedStyle.opacity !== '1' || 
            computedStyle.display === 'none') {
          
          styleLogger.warn(`Style check at ${time}ms found issues:`, {
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            display: computedStyle.display
          });
          
          // Fix the styling issues
          applyWebviewStyles(browser, webview, true);
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
    // Create mutation observer to watch for style changes
    const observer = new MutationObserver((mutations) => {
      const styleChanges = mutations.filter(mutation => 
        mutation.attributeName === 'style' || 
        mutation.attributeName === 'class'
      );
      
      if (styleChanges.length > 0) {
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
          
          // Fix visibility without changing everything
          webview.style.visibility = 'visible';
          webview.style.opacity = '1';
          
          if (computedStyle.display === 'none') {
            webview.style.display = 'flex';
          }
        }
      }
    });
    
    // Start observing
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

// Export functions
export default {
  applyInitialStyles,
  applyEssentialStyles,
  applyLoadCompleteStyling,
  applyWebviewStyles,
  scheduleStyleChecks,
  startStyleMonitoring,
  stopStyleMonitoring
}; 