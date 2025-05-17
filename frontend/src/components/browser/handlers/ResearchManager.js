/**
 * ResearchManager.js - Handles research mode functionality
 * 
 * This module provides methods for toggling and managing research mode
 * in the Voyager browser component.
 */

import { capturePageContent } from './ContentExtractor';

// Import path for Researcher corrected to use absolute import
import Researcher from '../researcher/Researcher';

/**
 * Toggle research mode on/off
 * 
 * @param {Object} browser - Browser instance
 * @returns {boolean} The new research mode state
 */
export function toggleResearchMode(browser) {
  console.log('Toggle research mode called');
  
  // Calculate the new state (prior to setting it)
  const newResearchMode = !browser.state.researchMode;
  
  // Initialize researcher if needed
  if (newResearchMode && !browser.researcher) {
    if (!initializeResearcher(browser)) {
      console.error('Failed to initialize researcher component');
      return false;
    }
  }
  
  // Use the researcher component instance if available
  if (browser.researcher && typeof browser.researcher.toggleActive === 'function') {
    console.log('Delegating research mode toggle to Researcher component');
    
    // Prepare current page info for the researcher
    if (newResearchMode && browser.webview) {
      try {
        // Capture the current page content for research context
        capturePageContent(browser).then(content => {
          if (browser.researcher && typeof browser.researcher.processPage === 'function') {
            // Process the current page in the research panel
            browser.researcher.processPage(browser.state.url, browser.state.title, content);
          }
        }).catch(err => {
          console.warn('Error capturing page content for research:', err);
        });
      } catch (err) {
        console.warn('Error preparing research content:', err);
      }
    }
    
    // Add body class for proper layout BEFORE toggling
    if (newResearchMode) {
      document.body.classList.add('research-panel-active');
      
      // Adjust the webview container width to make room for the panel
      const webviewContainer = browser.containerRef.current?.querySelector('.voyager-browser-container');
      if (webviewContainer) {
        webviewContainer.style.width = 'calc(100% - 340px)';
        webviewContainer.style.transition = 'width 0.3s ease';
      }
    } else {
      document.body.classList.remove('research-panel-active');
      
      // Restore webview container width
      const webviewContainer = browser.containerRef.current?.querySelector('.voyager-browser-container');
      if (webviewContainer) {
        webviewContainer.style.width = '100%';
      }
    }
    
    // Call the researcher's toggleActive method which will handle the UI
    const result = browser.researcher.toggleActive();
    
    // Update our own state based on the result
    browser.setState({ researchMode: result }, () => {
      console.log(`Research mode ${browser.state.researchMode ? 'activated' : 'deactivated'}`);
      
      // Update the research button active state
      const researchBtn = browser.containerRef.current?.querySelector('.browser-research-btn');
      if (researchBtn) {
        if (browser.state.researchMode) {
          researchBtn.classList.add('active');
          researchBtn.title = 'Research mode active';
        } else {
          researchBtn.classList.remove('active');
          researchBtn.title = 'Toggle research mode';
        }
      }
    });
    
    return result;
  } else {
    console.error('Researcher component not available or missing toggleActive method');
    return false;
  }
}

/**
 * Initialize the Researcher component separately
 * 
 * @param {Object} browser - Browser instance
 * @returns {boolean} True if initialization was successful
 */
export function initializeResearcher(browser) {
  if (browser.researcher) {
    console.log('Researcher component already initialized');
    return true;
  }
  
  console.log('Initializing Researcher component');
  
  try {
    // Create a new instance with proper configuration
    browser.researcher = new Researcher({
      browser: browser,
      currentUrl: browser.state?.url,
      currentTitle: browser.state?.title,
      onToggle: (isActive) => {
        console.log(`Researcher component ${isActive ? 'activated' : 'deactivated'}`);
        browser.setState({ researchMode: isActive });
      },
      onResearchItemClick: (item) => {
        if (item && item.url) {
          browser.navigate(item.url);
        }
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Researcher component:', error);
    return false;
  }
}

/**
 * Check if research mode is active
 * 
 * @param {Object} browser - Browser instance
 * @returns {boolean} True if research mode is active
 */
export function isResearchModeActive(browser) {
  return browser.state && browser.state.researchMode === true;
}

/**
 * Process current page in research panel
 * 
 * @param {Object} browser - Browser instance
 * @returns {Promise<Object>} Promise resolving to the processed page data
 */
export function processPageInResearch(browser) {
  if (!browser.researcher || !browser.state.researchMode) {
    console.error('Research mode not active or researcher not initialized');
    return Promise.reject(new Error('Research mode not active'));
  }
  
  return capturePageContent(browser)
    .then(content => {
      if (browser.researcher && typeof browser.researcher.processPage === 'function') {
        return browser.researcher.processPage(
          browser.state.url, 
          browser.state.title, 
          content
        );
      } else {
        throw new Error('Researcher component does not support processPage method');
      }
    });
}

export default {
  toggleResearchMode,
  initializeResearcher,
  isResearchModeActive,
  processPageInResearch
}; 