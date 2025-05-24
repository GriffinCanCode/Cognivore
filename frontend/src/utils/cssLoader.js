/**
 * CSS Loader Utility - Ensures critical browser styling is loaded correctly
 */

class CSSLoader {
  constructor() {
    this.loadedFiles = new Set();
    this.loadingPromises = new Map();
  }

  /**
   * Load a CSS file and ensure it's applied before other browser styles
   * @param {string} href - The CSS file path
   * @param {number} priority - Priority level (lower numbers load first)
   * @returns {Promise} Promise that resolves when CSS is loaded
   */
  loadCSS(href, priority = 100) {
    // Return existing promise if already loading
    if (this.loadingPromises.has(href)) {
      return this.loadingPromises.get(href);
    }

    // Return resolved promise if already loaded
    if (this.loadedFiles.has(href)) {
      return Promise.resolve();
    }

    const promise = new Promise((resolve, reject) => {
      // Check if CSS is already in document
      const existingLink = document.querySelector(`link[href="${href}"]`);
      if (existingLink) {
        this.loadedFiles.add(href);
        resolve();
        return;
      }

      // Create new link element
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = href;
      link.media = 'all';

      // Set priority using data attribute for CSS specificity
      link.setAttribute('data-priority', priority);

      // Handle load events
      link.onload = () => {
        console.log(`CSS loaded successfully: ${href}`);
        this.loadedFiles.add(href);
        resolve();
      };

      link.onerror = () => {
        console.error(`Failed to load CSS: ${href}`);
        reject(new Error(`Failed to load CSS: ${href}`));
      };

      // Insert based on priority
      this.insertWithPriority(link, priority);
    });

    this.loadingPromises.set(href, promise);
    return promise;
  }

  /**
   * Insert link element based on priority
   * @param {HTMLLinkElement} link - The link element to insert
   * @param {number} priority - Priority level
   */
  insertWithPriority(link, priority) {
    const head = document.head;
    const existingLinks = Array.from(head.querySelectorAll('link[rel="stylesheet"]'));
    
    // Find insertion point based on priority
    let insertBefore = null;
    for (const existingLink of existingLinks) {
      const existingPriority = parseInt(existingLink.getAttribute('data-priority') || '100');
      if (priority < existingPriority) {
        insertBefore = existingLink;
        break;
      }
    }

    if (insertBefore) {
      head.insertBefore(link, insertBefore);
    } else {
      head.appendChild(link);
    }
  }

  /**
   * Load browser critical CSS files in correct order
   * @returns {Promise} Promise that resolves when all critical CSS is loaded
   */
  async loadBrowserCSS() {
    try {
      // Load in order of priority (lower numbers first)
      await this.loadCSS('./styles/main.css', 1);
      await this.loadCSS('./styles/components/browser.css', 10);
      await this.loadCSS('./styles/components/action-toolbar.css', 15);
      await this.loadCSS('./styles/components/tabs/TabBar.css', 20);
      await this.loadCSS('./styles/components/tabs/TabManagerPanel.css', 30);
      
      console.log('All browser CSS files loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load browser CSS:', error);
      return false;
    }
  }

  /**
   * Apply emergency CSS styles directly to document
   * Used as fallback when CSS files fail to load
   */
  applyEmergencyStyles() {
    console.log('Applying emergency browser styles...');
    
    const emergencyStyles = `
      /* Emergency Browser Styles - Applied directly to DOM */
      .browser-container, .voyager-browser {
        position: relative !important;
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        width: 100% !important;
        background-color: #0c1122 !important;
        overflow: hidden !important;
      }
      
      .voyager-tab-bar-wrapper {
        display: flex !important;
        align-items: center !important;
        height: 36px !important;
        background-color: rgba(15, 23, 42, 0.85) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
        padding: 0 4px !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      .tab-item {
        display: flex !important;
        align-items: center !important;
        height: 32px !important;
        padding: 0 10px !important;
        background-color: rgba(37, 99, 235, 0.25) !important;
        border-radius: 8px 8px 0 0 !important;
        margin: 4px 1px 0 !important;
        color: white !important;
        font-size: 12px !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      .browser-webview-container {
        flex: 1 !important;
        position: relative !important;
        background-color: white !important;
        overflow: hidden !important;
      }
      
      .browser-webview-container webview,
      .browser-webview-container iframe {
        width: 100% !important;
        height: 100% !important;
        border: none !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      .voyager-address-container {
        display: flex !important;
        align-items: center !important;
        padding: 6px !important;
        background-color: rgba(15, 23, 42, 0.85) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
        height: 42px !important;
      }
      
      .voyager-address-bar {
        flex: 1 !important;
        height: 34px !important;
        padding: 0 8px !important;
        border-radius: 16px !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        background-color: rgba(15, 23, 42, 0.5) !important;
        color: #f8fafc !important;
        font-size: 14px !important;
        outline: none !important;
      }
    `;

    // Remove existing emergency styles
    const existingEmergencyStyle = document.getElementById('emergency-browser-styles');
    if (existingEmergencyStyle) {
      existingEmergencyStyle.remove();
    }

    // Create and inject emergency styles
    const styleElement = document.createElement('style');
    styleElement.id = 'emergency-browser-styles';
    styleElement.textContent = emergencyStyles;
    
    // Insert at the beginning of head for high priority
    const head = document.head;
    if (head.firstChild) {
      head.insertBefore(styleElement, head.firstChild);
    } else {
      head.appendChild(styleElement);
    }

    console.log('Emergency browser styles applied');
  }

  /**
   * Initialize browser CSS loading with fallback
   * @returns {Promise} Promise that resolves when CSS is ready
   */
  async initializeBrowserStyles() {
    console.log('Initializing browser styles...');
    
    try {
      const success = await this.loadBrowserCSS();
      if (!success) {
        console.warn('Standard CSS loading failed, applying emergency styles');
        this.applyEmergencyStyles();
      }
      return true;
    } catch (error) {
      console.error('Critical error loading browser styles:', error);
      this.applyEmergencyStyles();
      return false;
    }
  }

  /**
   * Force refresh of browser styles
   */
  refreshBrowserStyles() {
    console.log('Refreshing browser styles...');
    
    // Clear loaded files cache
    this.loadedFiles.clear();
    this.loadingPromises.clear();
    
    // Reload critical styles
    return this.initializeBrowserStyles();
  }
}

// Create global instance
const cssLoader = new CSSLoader();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    cssLoader.initializeBrowserStyles();
  });
} else {
  // DOM already loaded
  cssLoader.initializeBrowserStyles();
}

export default cssLoader; 