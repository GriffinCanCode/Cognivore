/**
 * BrowserRenderer - Handles rendering of the browser UI
 */
import { applySandboxSettings } from '../utils/BrowserEnv.js';
import { createBrowserPlaceholder } from './ContentRenderer.js';
import EventHandlers from '../handlers/EventHandlers.js';

/**
 * Create the browser header with navigation controls
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Header element
 */
export function createBrowserHeader(browser) {
  const header = document.createElement('div');
  header.className = 'browser-header';
  
  // Navigation controls
  const navControls = document.createElement('div');
  navControls.className = 'browser-nav-controls';
  
  const backButton = document.createElement('button');
  backButton.className = 'browser-back-btn';
  backButton.title = 'Back';
  backButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  `;
  backButton.disabled = true;
  backButton.addEventListener('click', browser.handleBack);
  navControls.appendChild(backButton);
  
  const forwardButton = document.createElement('button');
  forwardButton.className = 'browser-forward-btn';
  forwardButton.title = 'Forward';
  forwardButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `;
  forwardButton.disabled = true;
  forwardButton.addEventListener('click', browser.handleForward);
  navControls.appendChild(forwardButton);
  
  const refreshButton = document.createElement('button');
  refreshButton.className = 'browser-refresh-btn';
  refreshButton.title = 'Refresh';
  refreshButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
  `;
  refreshButton.addEventListener('click', browser.handleRefresh);
  navControls.appendChild(refreshButton);
  
  const stopButton = document.createElement('button');
  stopButton.className = 'browser-stop-btn';
  stopButton.title = 'Stop';
  stopButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="6" width="12" height="12"></rect>
    </svg>
  `;
  stopButton.style.display = 'none';
  stopButton.addEventListener('click', browser.handleStop);
  navControls.appendChild(stopButton);
  
  header.appendChild(navControls);
  
  // URL/search input
  const searchForm = document.createElement('form');
  searchForm.className = 'browser-search-form';
  searchForm.addEventListener('submit', browser.handleSearch);
  
  browser.searchInput = document.createElement('input');
  browser.searchInput.type = 'text';
  browser.searchInput.className = 'browser-search-input';
  browser.searchInput.placeholder = 'Search or enter website name';
  browser.searchInput.spellcheck = false;
  browser.searchInput.autocomplete = 'off';
  searchForm.appendChild(browser.searchInput);
  
  const searchButton = document.createElement('button');
  searchButton.type = 'submit';
  searchButton.className = 'browser-search-btn';
  searchButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  `;
  searchForm.appendChild(searchButton);
  
  header.appendChild(searchForm);
  
  // Action buttons
  const actionButtons = document.createElement('div');
  actionButtons.className = 'browser-action-buttons';
  
  const bookmarkButton = document.createElement('button');
  bookmarkButton.className = 'browser-bookmark-btn';
  bookmarkButton.title = 'Bookmark this page';
  bookmarkButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  bookmarkButton.addEventListener('click', () => browser.addBookmark());
  actionButtons.appendChild(bookmarkButton);
  
  const saveButton = document.createElement('button');
  saveButton.className = 'browser-save-btn';
  saveButton.title = 'Save page to knowledge base';
  saveButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
  `;
  saveButton.addEventListener('click', () => browser.savePage());
  actionButtons.appendChild(saveButton);
  
  const researchButton = document.createElement('button');
  researchButton.className = 'browser-research-btn';
  researchButton.title = 'Toggle research mode';
  researchButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
  `;
  researchButton.addEventListener('click', browser.toggleResearchMode);
  actionButtons.appendChild(researchButton);
  
  header.appendChild(actionButtons);
  
  return header;
}

/**
 * Create the research panel
 * @returns {HTMLElement} Research panel element
 */
export function createResearchPanel() {
  const researchPanel = document.createElement('div');
  researchPanel.className = 'browser-research-panel';
  researchPanel.style.display = 'none';
  
  const researchHeader = document.createElement('div');
  researchHeader.className = 'research-panel-header';
  researchHeader.innerHTML = `
    <h3>Research</h3>
    <div class="research-panel-controls">
      <button class="research-panel-clear">Clear</button>
      <button class="research-panel-close">×</button>
    </div>
  `;
  
  researchHeader.querySelector('.research-panel-close').addEventListener('click', () => {
    researchPanel.style.display = 'none';
  });
  
  researchHeader.querySelector('.research-panel-clear').addEventListener('click', () => {
    const content = researchPanel.querySelector('.research-panel-content');
    if (content) {
      content.innerHTML = `
        <div class="research-empty-state">
          <p>No research data available yet.</p>
          <p>Enable research mode to automatically save pages as you browse.</p>
        </div>
      `;
    }
  });
  
  researchPanel.appendChild(researchHeader);
  
  const researchContent = document.createElement('div');
  researchContent.className = 'research-panel-content';
  researchContent.innerHTML = `
    <div class="research-empty-state">
      <p>No research data available yet.</p>
      <p>Enable research mode to automatically save pages as you browse.</p>
    </div>
  `;
  
  researchPanel.appendChild(researchContent);
  
  return researchPanel;
}

/**
 * Create webview element for Electron
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} The webview element
 */
export function createWebviewElement(browser) {
  console.log('Creating webview element for browser with enhanced scrolling settings');
  
  // First try to create <webview> tag for Electron environment
  let webview = document.createElement('webview');
  
  // Configure webview with improved initialization and error handling
  try {
    console.log('Initial webview element created:', webview.tagName);
    
    // IMPORTANT: Apply all critical styling BEFORE creating and attaching the element
    // This comprehensive initial styling ensures the webview appears correctly from the start
    const criticalStyles = `
      display: flex !important;
      visibility: visible !important; /* Initially visible but translucent for faster perception */
      opacity: 0.9 !important; /* Slightly translucent for loading state */
      z-index: 1 !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      background-color: white !important;
      transform: none !important;
      overflow: hidden !important;
      flex: 1 1 auto !important;
      transition: opacity 0.3s ease-in-out !important; /* Smooth transition for opacity changes */
      will-change: opacity !important; /* Performance hint for the browser */
      pointer-events: auto !important;
      user-select: auto !important;
      touch-action: auto !important;
      backdrop-filter: none !important; /* Ensure no filters are applied */
      filter: none !important; /* Ensure no filters are applied */
    `;
    
    // CRITICAL: Apply essential styling BEFORE any attributes are set to ensure proper display
    webview.style.cssText = criticalStyles;
    
    // Start with readyToShow=false to ensure we control visibility
    webview.readyToShow = false;
    
    // Add classes for styling before setting any attributes
    webview.classList.add('browser-webview');
    webview.classList.add('browser-content-frame');
    
    // CRITICAL: Set partition for persistence AFTER initial styling but BEFORE any attributes that might trigger navigation
    webview.setAttribute('partition', 'persist:main');
    
    // Set important webview properties for Electron
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('disablewebsecurity', 'true');
    webview.setAttribute('webpreferences', 'allowRunningInsecureContent=true, javascript=true, webSecurity=false, plugins=true, images=true, textAreasAreResizable=true, experimentalFeatures=true, allowFileAccessFromFileURLs=true, allowUniversalAccessFromFileURLs=true, devTools=false');
    
    // Add comprehensive sandbox permissions to prevent ERR_BLOCKED_BY_RESPONSE errors
    const sandbox = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation allow-top-navigation-by-user-activation';
    webview.setAttribute('sandbox', sandbox);
    
    // Additional attributes to ensure proper webview functionality
    webview.setAttribute('useragent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
    webview.setAttribute('autosize', 'true');
    webview.setAttribute('nodeintegration', 'true'); // Enable Node.js integration
    webview.setAttribute('nodeintegrationinsubframes', 'true'); // Enable Node.js integration in sub-frames
    webview.setAttribute('plugins', 'true'); // Enable plugins
    webview.setAttribute('disabledevtools', 'true'); // Disable developer tools to prevent them from taking up space
    
    // CRITICAL: Flag for preventing double style application during initialization
    webview._stylesInitialized = false;
    
    // Store readiness state on the webview object
    webview.isReady = false;
    webview.isAttached = false;
    
    // Add a safety property to avoid guest view manager issues
    webview.safeMessagingEnabled = false;
    
    // Set up header modification before any navigation
    setupHeaderBypass(webview);

    // Pre-compiled style script to apply immediately when the webview loads
    // This comprehensive style application ensures content appears correctly
    const precompiledStyleScript = `
      (function() {
        // --- PART 1: Create and apply base styles ---
        // Create style element for essential fixes with the highest priority
        let style = document.createElement('style');
        style.id = 'cognivore-essential-styles';
        style.textContent = \`
          /* Base HTML/Body fixes */
          html, body {
            width: 100% !important; 
            height: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important;
            overflow-x: hidden !important;
            min-width: 100% !important;
            min-height: 100% !important;
            position: relative !important;
          }
          
          /* Prevent horizontal overflow */
          * {
            max-width: 100vw !important;
            box-sizing: border-box !important;
          }
          
          /* Main containers */
          main, #main, [role="main"], .main, .content, #content, article,
          #page, .page, .wrapper, #wrapper, .container, #container {
            width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important;
            overflow: auto !important;
            min-width: 100% !important;
            min-height: 100% !important;
            position: relative !important;
            box-sizing: border-box !important;
          }
          
          /* Prevent fixed/absolute elements from causing overflow */
          [style*="position: fixed"], [style*="position:fixed"],
          [style*="position: absolute"], [style*="position:absolute"] {
            max-width: 100vw !important;
            max-height: 100vh !important;
          }
          
          /* DevTools prevention */
          #devtools, #inspector-toolbar-container, .devtools, 
          div[id^="devtools-"], div[class^="devtools-"],
          [class*="console"], [class*="inspector"], [class*="panel"], 
          [class*="drawer"], [id*="console"], [id*="inspector"], 
          [id*="panel"], [id*="drawer"] {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
            z-index: -9999 !important;
          }
          
          /* Google specific fixes */
          /* Main containers */
          #main, #cnt, #rcnt, #center_col, #rso, .RVEQke, .minidiv, .sfbg, .o44hBf {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }
          
          /* Logo and search centering */
          .lJ9FBc, .jGGQ5e, .jsb, .sfbg, .minidiv, .RNNXgb, .o44hBf, .a4bIc, .k1zIA {
            display: flex !important;
            justify-content: center !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 584px !important;
          }
          
          /* Search content containers */
          main, [role="main"], .main, #main, .content, #content {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
          }
          
          /* Home page elements */
          .k1zIA {
            height: auto !important;
            min-height: 140px !important; 
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
          }
          
          .L3eUgb, .o3j99 {
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            width: 100% !important;
          }
          
          /* Fix footer to prevent horizontal scrollbars */
          footer, .fbar, #footcnt {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          
          /* Additional fixes for Google Search results */
          .bRsWnc, #search {
            max-width: 652px !important;
            margin: 0 auto !important;
          }
        
          /* Fix for search box */
          .RNNXgb, form.tsf, #searchform {
            max-width: 584px !important;
            width: 100% !important;
            margin: 0 auto !important;
          }
          
          /* Fix for main content area in search results */
          #appbar, #extabar, #bottombar, .GyAeWb, .hlcw0c, .ULSxyf {
            max-width: 1100px !important;
            margin: 0 auto !important;
            width: 100% !important;
          }
          
          /* Search results themselves */
          .g, .MjjYud, .cUnQKe, .yXK7lf, .Ww4FFb {
            max-width: 652px !important;
            margin: 0 auto !important;
            width: 100% !important;
          }
        \`;
        
        // Append to head to ensure it takes effect immediately
        if (document.head) {
          document.head.appendChild(style);
        } else if (document.documentElement) {
          // Create head if it doesn't exist
          const head = document.createElement('head');
          head.appendChild(style);
          document.documentElement.appendChild(head);
        }
        
        // --- PART 2: Apply direct styles to critical elements ---
        // For essential elements apply direct inline styles
        if (document.documentElement) {
          document.documentElement.style.cssText = 
            "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; min-width: 100% !important; min-height: 100% !important;";
        }
        
        if (document.body) {
          document.body.style.cssText = 
            "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; min-width: 100% !important; min-height: 100% !important;";
        }
        
        // Apply styles to other critical elements
        const criticalSelectors = [
          'main', '#main', '[role="main"]', '.main', '.content', '#content', 'article',
          '#page', '.page', '.wrapper', '#wrapper', '.container', '#container'
        ];
        
        criticalSelectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              if (el) {
                el.style.cssText += "width: 100% !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; overflow-x: hidden !important;";
              }
            });
          } catch (e) {}
        });
        
        // --- PART 3: Remove any DevTools ---
        const devToolsElements = document.querySelectorAll('[class*="devtools-"], [id*="devtools-"], .drawer-content, .panel, .console-view');
        devToolsElements.forEach(el => {
          if (el && el.parentNode) {
            try {
              el.parentNode.removeChild(el);
            } catch(e) {}
          }
        });
        
        // --- PART 4: Google-specific fixes ---
        if (window.location.hostname.includes('google.com')) {
          // Force proper sizing for Google's main elements
          const mainElements = document.querySelectorAll('#main, #cnt, #rcnt, #center_col, #rso, .g, .MjjYud, .cUnQKe, .hlcw0c, .ULSxyf');
          mainElements.forEach(el => {
            if (el) {
              el.style.cssText += "width: 100% !important; max-width: 100% !important; margin: 0 auto !important; padding: 0 !important; box-sizing: border-box !important; overflow-x: hidden !important;";
            }
          });
          
          // Fix any search results container
          const searchContainer = document.querySelector('#center_col, #rso, #search');
          if (searchContainer) {
            searchContainer.style.cssText += "width: 100% !important; max-width: 900px !important; margin: 0 auto !important; overflow-x: hidden !important;";
          }
          
          // Fix main logo and search box positioning
          const header = document.querySelector('#searchform, .RNNXgb, .o44hBf, .a4bIc');
          if (header) {
            header.style.cssText += "max-width: 584px !important; margin: 0 auto !important; width: 100% !important;";
          }
          
          // Make sure search results have proper width
          const searchResults = document.querySelectorAll('.g, .Ww4FFb, .MjjYud, .tF2Cxc');
          searchResults.forEach(el => {
            if (el) {
              el.style.cssText += "width: 100% !important; max-width: 652px !important; margin: 0 auto !important; box-sizing: border-box !important;";
            }
          });
        }
        
        // --- PART 5: Prevent keyboard shortcuts for DevTools ---
        window.addEventListener('keydown', (e) => {
          if (e.key === 'F12' || ((e.metaKey || e.ctrlKey) && (e.shiftKey || e.altKey) && e.key === 'i')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, true);
        
        // --- PART 6: Setup mutation observer ---
        if (!window._comprehensiveStyleObserver) {
          // Create mutation observer that applies styles whenever needed
          const observer = new MutationObserver((mutations) => {
            // Only process a maximum of 10 mutations to prevent excessive CPU usage
            const mutationsToProcess = mutations.slice(0, 10);
            
            // Check if any critical elements need style fixes
            let needsBodyFix = false;
            let needsHtmlFix = false;
            let needsSearchFix = false;
            
            mutationsToProcess.forEach(mutation => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                if (mutation.target === document.documentElement) {
                  needsHtmlFix = true;
                } else if (mutation.target === document.body) {
                  needsBodyFix = true;
                } else if (window.location.hostname.includes('google.com') && 
                          (mutation.target.id === 'main' || 
                           mutation.target.id === 'rcnt' || 
                           mutation.target.id === 'center_col')) {
                  needsSearchFix = true;
                }
              }
            });
            
            // Apply fixes as needed
            if (needsHtmlFix) {
              document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
            }
            
            if (needsBodyFix) {
              document.body.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
            }
            
            if (needsSearchFix && window.location.hostname.includes('google.com')) {
              // Re-apply Google-specific fixes
              const mainElements = document.querySelectorAll('#main, #cnt, #rcnt, #center_col, #rso, .g, .MjjYud');
              mainElements.forEach(el => {
                if (el) {
                  el.style.cssText += "width: 100% !important; max-width: 100% !important; margin: 0 auto !important; box-sizing: border-box !important; overflow-x: hidden !important;";
                }
              });
              
              const searchContainer = document.querySelector('#center_col, #rso, #search');
              if (searchContainer) {
                searchContainer.style.cssText += "width: 100% !important; max-width: 900px !important; margin: 0 auto !important; overflow-x: hidden !important;";
              }
            }
          });
          
          // Observe both document and body with attributes and child changes
          observer.observe(document.documentElement, { 
            attributes: true, 
            attributeFilter: ['style', 'class'],
            subtree: false
          });
          
          if (document.body) {
            observer.observe(document.body, { 
              attributes: true, 
              attributeFilter: ['style', 'class'],
              subtree: false
            });
          }
          
          // Store observer reference
          window._comprehensiveStyleObserver = observer;
          
          // Set up a content-loaded style fix that runs once when content is fully loaded
          if (document.readyState === 'complete') {
            // Document already loaded, apply fixes immediately
            applyFinalStyleFixes();
          } else {
            // Wait for load event
            window.addEventListener('load', applyFinalStyleFixes, { once: true });
          }
          
          // Function to apply final style fixes after content is loaded
          function applyFinalStyleFixes() {
            // Re-apply all critical styles to ensure they weren't overridden
            document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
            document.body.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;";
            
            // Apply Google-specific fixes if on Google
            if (window.location.hostname.includes('google.com')) {
              const mainElements = document.querySelectorAll('#main, #cnt, #rcnt, #center_col, #rso, .g, .MjjYud, .cUnQKe, .hlcw0c');
              mainElements.forEach(el => {
                if (el) {
                  el.style.cssText += "width: 100% !important; max-width: 100% !important; margin: 0 auto !important; box-sizing: border-box !important; overflow-x: hidden !important;";
                }
              });
              
              // Fix any search results container
              const searchContainer = document.querySelector('#center_col, #rso, #search');
              if (searchContainer) {
                searchContainer.style.cssText += "width: 100% !important; max-width: 900px !important; margin: 0 auto !important; overflow-x: hidden !important;";
              }
            }
            
            console.log("Final style fixes applied after content loaded");
          }
        }
        
        // Set a flag to indicate comprehensive styling is complete
        window._initialStylesFullyApplied = true;
        console.log("Comprehensive styles fully applied");
        
        // Return true to indicate success
        return window._initialStylesFullyApplied;
      })();
    `;
    
    // Store the precompiled script on the webview for immediate execution during navigation
    webview.precompiledStyleScript = precompiledStyleScript;
    
    // Create a single comprehensive style application function that applies all styles at once
    const applyAllCriticalStyles = (forcedApply = false) => {
      // Don't reapply if already initialized and not forced
      if (!forcedApply && webview._stylesInitialized) {
        return;
      }
      
      console.log('Applying all critical webview styles at once');
      
      // Re-apply critical container styling with full visibility
      webview.style.cssText = criticalStyles;
      
      // Apply content styling if webview is ready
      if (webview.isReady && typeof webview.executeJavaScript === 'function') {
        try {
          // Execute all styles at once for maximum performance
          webview.executeJavaScript(webview.precompiledStyleScript)
            .then(() => {
              console.log('Comprehensive webview content styles successfully applied');
              
              // Mark webview as ready to show immediately
              webview.readyToShow = true;
              webview._stylesInitialized = true;
              
              // Make webview fully visible with all styles applied
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
                min-width: 100% !important;
                max-width: 100% !important;
                max-height: 100% !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                background-color: white !important;
                transform: none !important;
                flex: 1 1 auto !important;
                overflow: hidden !important;
                pointer-events: auto !important;
                user-select: auto !important;
                touch-action: auto !important;
              `;
            })
            .catch(err => {
              console.warn('Error applying content styles:', err);
              
              // Mark as ready anyway to ensure content becomes visible
              webview.readyToShow = true;
              
              // Make sure webview is visible despite script error
              webview.style.visibility = 'visible';
              webview.style.opacity = '1';
            });
        } catch (err) {
          console.warn('Exception applying content styles:', err);
          
          // Ensure webview is visible despite errors
          webview.readyToShow = true;
          webview.style.visibility = 'visible';
          webview.style.opacity = '1';
        }
      } else {
        // Force visibility even if not fully ready
        webview.style.visibility = 'visible';
        webview.style.opacity = '1';
      }
    };

    // Store function reference on webview for easy access
    webview.applyAllCriticalStyles = applyAllCriticalStyles;
    
    // Add event listeners to execute style functions at the appropriate time
    webview.addEventListener('dom-ready', () => {
      console.log('Webview DOM ready - applying critical styles');
      webview.isReady = true;
      
      // Allow a microsecond for the DOM to settle before applying styles
      setTimeout(() => {
        applyAllCriticalStyles(true);
      }, 0);
    });
    
    // Apply styles again when did-start-loading fires for immediate styling during navigation
    webview.addEventListener('did-start-loading', () => {
      console.log('Webview started loading - applying immediate styles');
      
      // Start with lower opacity for smoother transition
      webview.style.visibility = 'visible';
      webview.style.opacity = '0.4';
      
      // Immediately apply basic styles to avoid blank page
      setTimeout(() => {
        // Force reapplication of styles at navigation start
        if (typeof webview.executeJavaScript === 'function') {
          try {
            // Apply basic styles immediately at navigation start
            webview.executeJavaScript(`
              // Apply immediate styles to ensure proper display during loading
              if (document.documentElement) {
                document.documentElement.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important;";
              }
              if (document.body) {
                document.body.style.cssText = "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important;";
              }
              
              // Add a style tag with higher specificity
              if (document.head && !document.getElementById('cognivore-immediate-fix')) {
                const style = document.createElement('style');
                style.id = 'cognivore-immediate-fix';
                style.textContent = "html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow-x: hidden !important; } * { max-width: 100vw !important; }";
                document.head.appendChild(style);
              }
              
              true;
            `).catch(() => {});
          } catch (err) {
            // Ignore errors during loading - we'll retry at dom-ready
          }
        }
      }, 10);
      
      // Gradually increase opacity as content loads
      setTimeout(() => {
        if (webview && webview.isConnected) {
          webview.style.opacity = '0.6';
        }
      }, 100);
    });
    
    // Also apply styles when the page finishes loading
    webview.addEventListener('did-finish-load', () => {
      console.log('Webview finished loading - applying final styles');
      
      // Incrementally increase opacity before applying final styles
      webview.style.opacity = '0.8';
      
      // Re-apply all styles once loading completes
      setTimeout(() => {
        applyAllCriticalStyles(true);
        
        // Make fully visible with a slight delay to allow styles to take effect
        setTimeout(() => {
          webview.style.visibility = 'visible';
          webview.style.opacity = '1';
          webview.readyToShow = true;
        }, 50);
      }, 10);
    });
    
    // Finally, apply styles once more when did-stop-loading fires as a safety measure
    webview.addEventListener('did-stop-loading', () => {
      console.log('Webview stopped loading - applying final styles and marking ready');
      
      // Apply styles one final time to ensure everything is perfect
      applyAllCriticalStyles(true);
      
      // Make fully visible
      webview.style.visibility = 'visible';
      webview.style.opacity = '1';
      webview.readyToShow = true;
      
      // Set up a MutationObserver to maintain styles if they change
      if (typeof webview.executeJavaScript === 'function') {
        try {
          webview.executeJavaScript(`
            // Ensure we have a style maintenance observer
            if (!window._styleMaintainer) {
              window._styleMaintainer = new MutationObserver((mutations) => {
                // Check for style or class changes to critical elements
                const criticalChanges = mutations.filter(m => 
                  (m.target === document.documentElement || m.target === document.body) &&
                  (m.attributeName === 'style' || m.attributeName === 'class')
                );
                
                if (criticalChanges.length > 0) {
                  // Reapply critical styles
                  document.documentElement.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important;";
                  document.body.style.cssText += "width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important;";
                }
              });
              
              // Observe both document element and body
              window._styleMaintainer.observe(document.documentElement, { 
                attributes: true, attributeFilter: ['style', 'class'] 
              });
              window._styleMaintainer.observe(document.body, { 
                attributes: true, attributeFilter: ['style', 'class'] 
              });
              
              console.log("Style maintenance observer installed");
            }
          `).catch(() => {});
        } catch (err) {
          console.warn('Error setting up style maintenance observer:', err);
        }
      }
    });
    
    // Apply initial styles
    applyAllCriticalStyles(true);
    
    // Return the configured webview
    return webview;
  } catch (error) {
    console.error('Error creating webview element:', error);
    
    // Fall back to iframe if webview creation fails
    console.log('Falling back to iframe element');
    const iframe = document.createElement('iframe');
    iframe.className = 'browser-content-frame';
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    `;
    
    return iframe;
  }
}

/**
 * Safely execute JavaScript in a webview when it's ready
 * @param {HTMLElement} webview - The webview element
 * @param {Function} executeFunction - Function to execute when webview is ready
 * @param {number} maxAttempts - Maximum number of retry attempts
 * @param {number} delay - Delay between attempts in ms
 * @returns {Promise} Promise that resolves when executed or after max attempts
 */
function executeSafelyInWebview(webview, executeFunction, maxAttempts = 5, delay = 500) {
  if (!webview) return Promise.reject(new Error('No webview provided'));
  
  let attempts = 0;
  
  // Create a function to check if webview is ready and execute
  const tryExecute = () => {
    // Check if webview is ready using multiple indicators
    const isWebviewReady = 
      // Check explicit ready flag
      (webview.isReady === true || 
      // Check DOM attachment
      webview.isAttached === true ||
      // Check if it has DOM nodes (another way to detect attachment)
      (webview.parentNode !== null && webview.parentNode !== undefined) ||
      // Check if the webview element is connected to the DOM
      webview.isConnected === true) &&
      // Make sure it has the executeJavaScript method
      typeof webview.executeJavaScript === 'function';
    
    // If webview appears ready by any of our checks, try to execute
    if (isWebviewReady) {
      try {
        // Log webview state for debugging
        console.log('Executing in webview with state:', {
          isReady: webview.isReady,
          isAttached: webview.isAttached, 
          hasParent: !!webview.parentNode,
          isConnected: webview.isConnected
        });
        
        return executeFunction();
      } catch (err) {
        console.warn('Error executing in webview:', err);
        return Promise.reject(err);
      }
    } 
    
    // If we've exhausted attempts, try one last time with a direct approach
    if (attempts >= maxAttempts) {
      console.warn(`Webview not ready after ${maxAttempts} attempts, trying direct execution as last resort`);
      
      try {
        // Force execution regardless of ready state as a last resort
        if (typeof webview.executeJavaScript === 'function') {
          return executeFunction();
        }
        
        // If that still didn't work, reject with meaningful error
        return Promise.reject(new Error('Webview not ready after maximum attempts and final direct attempt failed'));
      } catch(finalErr) {
        console.error('Final direct execution attempt failed:', finalErr);
        return Promise.reject(new Error('Webview not ready after maximum attempts'));
      }
    }
    
    // Otherwise, increment attempts and try again after delay
    attempts++;
    console.log(`Webview not ready, attempt ${attempts}/${maxAttempts}. Trying again in ${delay}ms...`);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        tryExecute().then(resolve).catch(reject);
      }, delay);
    });
  };
  
  // Start the execution attempt
  return tryExecute().catch(err => {
    console.warn('ExecuteSafelyInWebview error:', err);
    return Promise.reject(err);
  });
}

/**
 * Set up safe IPC messaging for the webview to prevent object clone errors
 * @param {HTMLElement} webview - The webview element 
 */
function setupSafeIpcMessaging(webview) {
  if (!webview || webview.safeMessagingEnabled) return;
  
  try {
    // Patch the standard send method to prevent non-serializable objects
    if (typeof webview._send === 'undefined' && typeof webview.send === 'function') {
      // Store the original send method
      webview._send = webview.send;
      
      // Replace with our safe version
      webview.send = function(channel, ...args) {
        try {
          // Make safe copies of the args
          const safeChannel = String(channel);
          const safeArgs = args.map(arg => makeSafeForIpc(arg));
          
          // Call the original send with safe arguments
          return webview._send.call(this, safeChannel, ...safeArgs);
        } catch (error) {
          console.warn('Error in safe webview.send:', error);
          // Return a benign result to prevent crashes
          return null;
        }
      };
      
      console.log('Patched webview.send for safe IPC messaging');
    }
    
    // Set up custom event handlers that sanitize all incoming data
    webview.addEventListener('ipc-message', handleSafeIpcMessage);
    webview.addEventListener('console-message', handleSafeConsoleMessage);
    
    // Handle all guest-related events by intercepting and sanitizing
    // This is where GUEST_VIEW_MANAGER_CALL errors commonly occur
    const originalAddEventListener = webview.addEventListener;
    webview.addEventListener = function(event, handler, options) {
      if (event.startsWith('guest-') || 
          event === 'did-attach' || 
          event === 'did-attach-guest-view' || 
          event === 'guest-ready' ||
          event === 'guest-view-ready') {
        
        // Replace with safe handler
        const safeHandler = function(e) {
          try {
            // Create a clean event object with only what we need
            const safeEvent = {
              type: e.type,
              bubbles: e.bubbles,
              cancelable: e.cancelable,
              // Only add simple properties, omit complex objects
              timestamp: Date.now()
            };
            
            // Call original handler with safe event
            return handler(safeEvent);
          } catch (error) {
            console.warn(`Error in safe handler for ${event}:`, error);
          }
        };
        
        // Call original addEventListener with safe handler
        return originalAddEventListener.call(this, event, safeHandler, options);
      }
      
      // For other events, use original behavior
      return originalAddEventListener.call(this, event, handler, options);
    };
    
    webview.safeMessagingEnabled = true;
    console.log('Safe IPC messaging set up for webview');
  } catch (error) {
    console.error('Error setting up safe IPC messaging:', error);
  }
}

/**
 * Handle IPC messages safely
 * @param {Event} event - The IPC message event
 */
function handleSafeIpcMessage(event) {
  try {
    // Ensure we're only passing serializable data
    const safeChannel = event.channel ? String(event.channel) : 'unknown-channel';
    let safeArgs = [];
    
    if (Array.isArray(event.args)) {
      // Sanitize arguments to ensure they're safe to serialize
      safeArgs = event.args.map(arg => makeSafeForIpc(arg));
    }
    
    // Log clean version
    console.log(`Received IPC message: ${safeChannel}`, safeArgs);
  } catch (err) {
    console.warn('Error handling ipc-message event:', err);
  }
}

/**
 * Handle console messages safely
 * @param {Event} event - The console message event
 */
function handleSafeConsoleMessage(event) {
  try {
    // Create a safe copy of the event data
    const safeEvent = {
      message: event.message ? String(event.message) : '',
      line: typeof event.line === 'number' ? event.line : 0,
      sourceId: event.sourceId ? String(event.sourceId) : ''
    };
    
    if (safeEvent.message.includes('error') || safeEvent.message.includes('Exception')) {
      console.warn('[Webview Console Error]:', safeEvent.message);
    }
  } catch (err) {
    console.warn('Error handling console-message event:', err);
  }
}

/**
 * Make an object safe for IPC by removing non-serializable content
 * @param {*} obj - Object to make safe
 * @returns {*} - Serialization-safe version of the object
 */
function makeSafeForIpc(obj) {
  if (obj === null || obj === undefined) return obj;
  
  // Handle simple types directly
  if (typeof obj === 'string' || 
      typeof obj === 'number' || 
      typeof obj === 'boolean') {
    return obj;
  }
  
  // Dates become ISO strings
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // For arrays, recursively process each element
  if (Array.isArray(obj)) {
    return obj.map(item => makeSafeForIpc(item));
  }
  
  // For objects, use JSON to strip non-serializable content
  if (typeof obj === 'object') {
    try {
      // Try JSON serialization/deserialization to strip non-serializable content
      return JSON.parse(JSON.stringify(obj));
    } catch(e) {
      // If it fails, return a simplified representation
      return String(obj);
    }
  }
  
  // Default fallback - convert to string
  return String(obj);
}

/**
 * Create webview container for browser content
 * @param {Object} browser - Browser instance
 * @param {string} implementation - Webview implementation ('webview', 'iframe-proxy', 'iframe-fallback')
 * @param {string} sandboxLevel - Level of sandboxing to apply
 * @returns {Object} Webview container and element
 */
export function createWebview(browser, implementation, sandboxLevel) {
  console.log('📣 Creating webview container with proper sizing');
  
  // Force webview for reliability
  implementation = 'webview';
  
  const container = document.createElement('div');
  container.className = 'browser-webview-container';
  
  // Apply styling to fit container while preserving layout
  container.style.cssText = `
    position: fixed !important;
    top: 52px !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: calc(100vh - 52px) !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    z-index: 1 !important;
    box-sizing: border-box !important;
    border: none !important;
    display: flex !important;
    flex-direction: column !important;
    background: #fff !important;
  `;
  
  // Use our enhanced webview creation function
  let webview = createWebviewElement(browser);
  
  // Apply styling to webview for proper containment
  webview.style.cssText = `
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 1 !important;
    position: fixed !important;
    top: 52px !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: calc(100vh - 52px) !important;
    min-height: calc(100vh - 52px) !important;
    max-height: calc(100vh - 52px) !important;
    min-width: 100vw !important;
    max-width: 100vw !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    background-color: white !important;
    transform: none !important;
    flex: 1 1 auto !important;
  `;
  
  // Add to browser container
  container.appendChild(webview);
  
  // Create placeholder for browser limitations message
  const placeholder = createBrowserPlaceholder(browser);
  container.appendChild(placeholder);
  
  // Hide placeholder upfront
  placeholder.style.display = 'none';
  
  // Set reference on browser object
  browser.webview = webview;
  
  // For iframe implementation, we'll keep a separate reference to the "contentFrame"
  if (webview.tagName.toLowerCase() !== 'webview') {
    browser.contentFrame = webview;
    
    // For iframe, use same flex display pattern
    browser.contentFrame.style.display = 'flex';
  }
  
  return { container, webview };
}

/**
 * Create browser progress bar
 * @returns {HTMLElement} Progress bar element
 */
export function createProgressBar() {
  // Create container for progress bar
  const progressContainer = document.createElement('div');
  progressContainer.className = 'browser-progress-container';
  progressContainer.style.position = 'relative';
  progressContainer.style.top = '0';
  progressContainer.style.left = '0';
  progressContainer.style.right = '0';
  progressContainer.style.height = '3px';
  progressContainer.style.zIndex = '1000';
  progressContainer.style.overflow = 'hidden';
  progressContainer.style.backgroundColor = 'transparent';
  
  // Create actual progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'browser-progress-bar';
  progressBar.style.backgroundColor = '#4285f4'; // Google blue
  progressBar.style.height = '100%';
  progressBar.style.width = '0%';
  progressBar.style.transition = 'width 0.3s ease-in-out, opacity 0.3s ease-in-out';
  progressBar.style.position = 'absolute';
  progressBar.style.left = '0';
  progressBar.style.top = '0';
  progressBar.style.boxShadow = '0 0 10px rgba(66, 133, 244, 0.7)';
  progressBar.style.display = 'none';
  progressBar.style.borderRadius = '0 2px 2px 0'; // Rounded right edge for smoother appearance
  
  // Add subtle animation for indeterminate state
  const keyframes = document.createElement('style');
  keyframes.textContent = `
    @keyframes progress-pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }
  `;
  document.head.appendChild(keyframes);
  
  // Apply animation to progress bar
  progressBar.style.animation = 'progress-pulse 1.5s infinite ease-in-out';
  
  progressContainer.appendChild(progressBar);
  
  return progressContainer;
}

/**
 * Set up header bypass for a webview to remove X-Frame-Options and other restricting headers
 * @param {HTMLElement} webview - The webview element
 */
function setupHeaderBypass(webview) {
  if (!webview) return;
  
  try {
    // Fallback to direct approach
    console.log('📋 Using direct header bypass method');
    
    // Wait a short moment for webview to initialize
    setTimeout(() => {
      try {
        if (webview.getWebContents) {
          try {
            const webContents = webview.getWebContents();
            
            if (webContents && webContents.session) {
              console.log('📋 Setting up immediate header bypass via webContents');
              const { session } = webContents;
              
              // Check if webRequest API is supported before using it
              if (session.webRequest && typeof session.webRequest.onHeadersReceived === 'function') {
                try {
                  // Add a listener to remove restrictive headers
                  session.webRequest.onHeadersReceived(
                    { urls: ['*://*/*'] },
                    (details, callback) => {
                      if (!details || !details.responseHeaders) {
                        return callback({ cancel: false });
                      }
                      
                      // Clone the headers to avoid modification issues
                      const responseHeaders = {};
                      
                      // Copy headers safely without references to the original object
                      if (details.responseHeaders) {
                        Object.keys(details.responseHeaders).forEach(key => {
                          const headerValue = details.responseHeaders[key];
                          // Ensure we only include serializable values
                          if (typeof headerValue === 'string' || Array.isArray(headerValue)) {
                            responseHeaders[key] = headerValue;
                          }
                        });
                      }
                      
                      // Headers to remove to bypass frame restrictions
                      const headersToRemove = [
                        'x-frame-options', 'X-Frame-Options',
                        'content-security-policy', 'Content-Security-Policy',
                        'x-content-security-policy', 'X-Content-Security-Policy',
                        'frame-options', 'Frame-Options'
                      ];
                      
                      // Remove each header if it exists
                      headersToRemove.forEach(header => {
                        if (responseHeaders[header]) {
                          console.log(`🔄 Removing restrictive header for webview: ${header}`);
                          delete responseHeaders[header];
                        }
                      });
                      
                      // Continue with modified headers - use a plain object to avoid cloning issues
                      callback({ responseHeaders: responseHeaders, cancel: false });
                    }
                  );
                  
                  console.log('✅ Header bypass set up successfully');
                } catch (err) {
                  console.warn('WebRequest API error:', err.message);
                  // Fall back to alternative method if webRequest fails
                  useAlternativeHeaderBypass(webview);
                }
              } else {
                console.warn('Session does not support webRequest API, using alternative method');
                useAlternativeHeaderBypass(webview);
              }
            } else {
              console.warn('WebContents session not available, using alternative method');
              useAlternativeHeaderBypass(webview);
            }
          } catch (err) {
            console.warn('Error accessing webContents:', err);
            useAlternativeHeaderBypass(webview);
          }
        } else {
          console.warn('getWebContents method not available on webview, using alternative method');
          useAlternativeHeaderBypass(webview);
        }
      } catch (error) {
        console.warn('Error in header bypass setup, falling back to alternative method:', error);
        useAlternativeHeaderBypass(webview);
      }
    }, 100);
  } catch (err) {
    console.warn('Error setting up header bypass:', err);
    useAlternativeHeaderBypass(webview);
  }
}

/**
 * Attempt to bypass headers with direct DOM manipulation
 * @param {HTMLElement} webview - The webview element to bypass headers on
 */
function attemptAlternativeHeadersBypass(webview) {
  if (!webview || typeof webview.executeJavaScript !== 'function') {
    console.warn('Cannot execute alternative headers bypass - no executeJavaScript method');
    return;
  }
  
  // Throttle execution to prevent excessive calls
  // Use a timestamp stored on the webview to track last execution
  const now = Date.now();
  if (webview._lastBypassAttempt && (now - webview._lastBypassAttempt < 1000)) {
    // Skip if called within the last second
    return;
  }
  
  // Update timestamp
  webview._lastBypassAttempt = now;
  
  try {
    // Execute JavaScript to bypass Content-Security-Policy
    const bypassScript = `
      (function() {
        // Prevent duplicate logging
        if (window._headerBypassApplied) {
          return true;
        }

        // Function to remove CSP restrictions
        function removeCSP() {
          try {
            // Remove existing CSP meta tags
            const cspMetaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
            cspMetaTags.forEach(tag => tag.remove());
            
            // Create meta tag to override CSP
            const meta = document.createElement('meta');
            meta.httpEquiv = 'Content-Security-Policy';
            meta.content = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;";
            document.head.appendChild(meta);
            
            // Override frame busting scripts
            try {
              // Common frame busting variables
              if (window.top !== window.self) {
                // Prevent frame busting scripts
                window.top = window.self;
                window.parent = window.self;
                window.frameElement = null;
              }
            } catch(e) {}
            
            if (!window._headerBypassLogged) {
              console.log('Applied alternative header bypass via content script');
              window._headerBypassLogged = true;
            }
          } catch(e) {
            console.error('Error in CSP removal:', e);
          }
          
          return true;
        }
        
        // Execute immediately
        removeCSP();
        
        // Also set up an observer to handle dynamically added CSP elements
        // but with throttling to prevent excessive execution
        if (!window._bypassObserver) {
          let pendingMutations = false;
          let throttleTimer = null;
          
          const handleMutations = () => {
            if (pendingMutations) {
              removeCSP();
              pendingMutations = false;
            }
          };
          
          const observer = new MutationObserver(function(mutations) {
            // Check if any CSP elements were added
            const hasCSPElements = mutations.some(mutation => {
              if (mutation.type === 'childList' && mutation.addedNodes.length) {
                return Array.from(mutation.addedNodes).some(node => {
                  return node.nodeName === 'META' && 
                         node.getAttribute('http-equiv') === 'Content-Security-Policy';
                });
              }
              return false;
            });
            
            if (hasCSPElements) {
              pendingMutations = true;
              
              // Throttle to prevent excessive executions
              if (!throttleTimer) {
                throttleTimer = setTimeout(() => {
                  handleMutations();
                  throttleTimer = null;
                }, 500);
              }
            }
          });
          
          // Start observing the document with throttling
          observer.observe(document.documentElement, { 
            childList: true, 
            subtree: true 
          });
          
          window._bypassObserver = observer;
        }
        
        // Mark as applied to prevent duplicate execution
        window._headerBypassApplied = true;
        return true;
      })();
    `;
    
    webview.executeJavaScript(bypassScript)
      .catch(err => console.warn('Failed to execute bypass script:', err));
      
  } catch (err) {
    console.warn('Error in alternative header bypass execution:', err);
  }
}

/**
 * Alternative method to bypass headers using DOM ready event
 * @param {HTMLElement} webview - The webview element
 */
function useAlternativeHeaderBypass(webview) {
  console.log('Using alternative header bypass method via dom-ready event');
  
  // Set a flag so we only add this listener once
  if (!webview.hasAlternativeBypassListener) {
    webview.hasAlternativeBypassListener = true;
    
    // Add an immediate CSP bypass during navigation - only needed once per navigation
    if (typeof webview.addEventListener === 'function') {
      // Use just one primary event instead of multiple
      webview.addEventListener('did-start-loading', (event) => {
        // Only apply once per page load
        if (!webview._bypassAppliedForCurrentLoad) {
          console.log('Did start loading event, applying CSP bypass');
          attemptAlternativeHeadersBypass(webview);
          webview._bypassAppliedForCurrentLoad = true;
          
          // Reset flag when navigation completes
          setTimeout(() => {
            webview._bypassAppliedForCurrentLoad = false;
          }, 1000);
        }
      });
      
      // Only add dom-ready as a fallback
      webview.addEventListener('dom-ready', () => {
        // Run only if not already applied during this page load
        if (!webview._bypassAppliedForCurrentLoad) {
          console.log('DOM ready event, applying CSP bypass');
          attemptAlternativeHeadersBypass(webview);
          webview._bypassAppliedForCurrentLoad = true;
        }
      });
    }
    
    console.log('Alternative header bypass listener set up');
  }
}

export default {
  createBrowserHeader,
  createResearchPanel,
  createWebviewElement,
  createProgressBar,
  createWebview
}; 