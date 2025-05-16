/**
 * ContentUtils - Utilities for processing and sanitizing HTML content
 */

/**
 * Sanitize HTML content for security and rendering
 * @param {string} html - Raw HTML content
 * @returns {string} Sanitized HTML content
 */
export function sanitizeHTML(html) {
  // Simple sanitization for now - in a real implementation, 
  // you'd want to use a library like DOMPurify or sanitize-html
  
  // Replace potentially dangerous tags
  const sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove object tags
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '') // Remove embed tags
    .replace(/<base\b[^>]*>/gi, ''); // Remove base tag (we'll add our own)
  
  return sanitized;
}

/**
 * Apply rendering fixes to a document
 * @param {Document} doc - Document to apply fixes to
 * @param {HTMLElement} contentFrame - The content frame reference (optional)
 */
export function applyRenderingFixes(doc, contentFrame) {
  if (!doc && contentFrame) {
    doc = contentFrame.contentDocument;
  }
  
  if (!doc || !doc.body) return;
  
  try {
    // Add meta viewport tag if missing
    if (!doc.head.querySelector('meta[name="viewport"]')) {
      const meta = doc.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0';
      doc.head.appendChild(meta);
    }
    
    // Fix for tables without width - very common issue
    const tables = doc.querySelectorAll('table:not([width])');
    tables.forEach(table => {
      if (!table.style.width && !table.getAttribute('width')) {
        table.style.width = '100%';
        table.style.maxWidth = '100%';
      }
    });
    
    // Fix any absolutely positioned elements that go beyond the viewport
    const absoluteElements = doc.querySelectorAll('[style*="position: absolute"], [style*="position:absolute"]');
    absoluteElements.forEach(el => {
      // Check if element is positioned outside viewport
      const rect = el.getBoundingClientRect();
      if (rect.left < 0 || rect.top < 0) {
        el.style.position = 'relative';
        el.style.left = 'auto';
        el.style.top = 'auto';
      }
    });
    
    // Add target="_blank" to external links if allowed
    const links = doc.querySelectorAll('a[href^="http"]');
    links.forEach(link => {
      // Don't modify if it already has a target
      if (!link.getAttribute('target')) {
        try {
          const url = new URL(link.href);
          // If link is to a different domain
          if (url.hostname !== window.location.hostname) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          }
        } catch (e) {
          // Invalid URL, ignore
        }
      }
    });
    
    // Fix background colors that might be unreadable
    // Check if body or html has dark background with light text
    const body = doc.body;
    const computedStyle = window.getComputedStyle(body);
    const bgColor = computedStyle.backgroundColor;
    
    // If background is transparent or not defined, add a white background
    if (bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
      body.style.backgroundColor = '#ffffff';
    }
  } catch (error) {
    console.error('Error applying rendering fixes:', error);
  }
}

/**
 * Handle CSS in extracted content
 * @param {Document} doc - Document object to modify
 * @param {string} baseUrl - Base URL for resolving relative paths
 */
export function handleContentCSS(doc, baseUrl) {
  if (!doc || !doc.head) return;
  
  try {
    // Find all stylesheets
    const styleLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    
    // Convert relative URLs to absolute
    styleLinks.forEach(link => {
      if (link.href && !link.href.startsWith('http')) {
        // Create absolute URL
        const url = new URL(link.href, baseUrl);
        link.href = url.href;
      }
    });
    
    // Add base CSS to handle common rendering issues
    const baseStyle = doc.createElement('style');
    baseStyle.textContent = `
      /* Base rendering fixes */
      * { max-width: 100%; box-sizing: border-box; }
      img { max-width: 100%; height: auto; }
      pre { white-space: pre-wrap; word-break: break-word; overflow: auto; }
      table { max-width: 100%; overflow-x: auto; display: block; }
      
      /* Prevent out-of-bounds content */
      body { overflow-x: hidden; width: 100%; }
      
      /* Improve readability */
      p, li, td, th { line-height: 1.5; }
      
      /* Responsive adjustments */
      @media (max-width: 768px) {
        body { font-size: 16px; }
        h1 { font-size: 1.8em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.3em; }
        pre, code { font-size: 0.9em; }
      }
      
      /* Print styles */
      @media print {
        nav, header, footer, .navigation, .no-print { display: none !important; }
        body { font-size: 12pt; }
        a::after { content: " (" attr(href) ")"; font-size: 0.8em; font-style: italic; }
      }
    `;
    
    // Add it to head, but after any other styles to ensure our fixes take precedence
    doc.head.appendChild(baseStyle);
    
    // Add meta viewport if missing
    if (!doc.querySelector('meta[name="viewport"]')) {
      const viewportMeta = doc.createElement('meta');
      viewportMeta.name = 'viewport';
      viewportMeta.content = 'width=device-width, initial-scale=1.0';
      doc.head.insertBefore(viewportMeta, doc.head.firstChild);
    }
    
    // Fix charset if missing
    if (!doc.querySelector('meta[charset]')) {
      const charsetMeta = doc.createElement('meta');
      charsetMeta.setAttribute('charset', 'UTF-8');
      doc.head.insertBefore(charsetMeta, doc.head.firstChild);
    }
  } catch (error) {
    console.error('Error handling content CSS:', error);
  }
}

/**
 * Handle JavaScript in extracted content
 * @param {Document} doc - Document object to modify
 * @param {string} sandboxLevel - Sandbox security level ('none', 'standard', 'strict')
 */
export function handleContentJavaScript(doc, sandboxLevel) {
  if (!doc || !doc.head) return;
  
  try {
    // Based on security settings, handle script tags
    if (sandboxLevel === 'strict') {
      // Remove all script tags in strict mode
      const scriptTags = doc.querySelectorAll('script');
      scriptTags.forEach(script => script.remove());
      
      // Remove inline event handlers
      const allElements = doc.querySelectorAll('*');
      allElements.forEach(el => {
        // Get all attributes
        const attributes = Array.from(el.attributes);
        
        // Remove on* event attributes
        attributes.forEach(attr => {
          if (attr.name.startsWith('on')) {
            el.removeAttribute(attr.name);
          }
        });
      });
    } else {
      // In regular mode, add CSP via meta tag
      const cspMeta = doc.createElement('meta');
      cspMeta.httpEquiv = 'Content-Security-Policy';
      
      // Create a moderately restrictive CSP
      cspMeta.content = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * data:; font-src 'self' data:; connect-src 'self'";
      
      doc.head.insertBefore(cspMeta, doc.head.firstChild);
    }
    
    // Add helper script for scroll sync and other features
    if (sandboxLevel !== 'strict') {
      const helperScript = doc.createElement('script');
      helperScript.textContent = `
        // Helper script for Cognivore browser
        window.addEventListener('DOMContentLoaded', function() {
          // Report content loaded
          if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({
              type: 'cognivore-content-loaded',
              title: document.title,
              url: window.location.href
            }, '*');
          }
          
          // Handle clicks on links to capture navigation
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && link.href) {
              e.preventDefault();
              
              if (window.parent && window.parent.postMessage) {
                window.parent.postMessage({
                  type: 'cognivore-link-click',
                  href: link.href,
                  target: link.target,
                  text: link.textContent.trim()
                }, '*');
              }
            }
          });
        });
      `;
      
      doc.head.appendChild(helperScript);
    }
  } catch (error) {
    console.error('Error handling content JavaScript:', error);
  }
}

/**
 * Clean HTML content for memory storage
 * Removes heavy and unnecessary elements
 * @param {string} html - Raw HTML content
 * @returns {string} Cleaned HTML
 */
export function cleanupHtmlForMemory(html) {
  if (!html) return '';
  
  // Create a DOM parser to work with the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  try {
    // Remove scripts
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Remove styles
    const styles = doc.querySelectorAll('style');
    styles.forEach(style => style.remove());
    
    // Remove hidden elements
    const hiddenElements = doc.querySelectorAll('[style*="display: none"], [style*="display:none"], [style*="visibility: hidden"], [style*="visibility:hidden"], [hidden]');
    hiddenElements.forEach(el => el.remove());
    
    // Remove large images and other media
    const images = doc.querySelectorAll('img, video, audio, iframe, canvas, svg');
    images.forEach(img => {
      // Keep small logos and icons
      const width = parseInt(img.getAttribute('width') || '0');
      const height = parseInt(img.getAttribute('height') || '0');
      if (width > 100 || height > 100 || (!width && !height)) {
        img.remove();
      }
    });
    
    // Remove large data attribute values
    const allElements = doc.querySelectorAll('[data-*]');
    allElements.forEach(el => {
      Array.from(el.attributes)
        .filter(attr => attr.name.startsWith('data-'))
        .forEach(attr => {
          if (attr.value.length > 100) {
            el.removeAttribute(attr.name);
          }
        });
    });
    
    // Get the body content
    return doc.body ? doc.body.innerHTML : '';
  } catch (err) {
    console.warn('Error cleaning HTML for memory:', err);
    return sanitizeHTML(html);
  }
}

/**
 * Sanitize a URL for analysis
 * Removes tracking parameters and normalizes for comparison
 * @param {string} url - The URL to sanitize
 * @returns {string} Sanitized URL
 */
export function sanitizeUrlForAnalysis(url) {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    
    // List of tracking parameters to remove
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'ref', 'referrer', 'source', 'yclid'
    ];
    
    // Remove tracking parameters
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Normalize
    let clean = urlObj.toString();
    
    // Remove trailing slash if present
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    
    return clean;
  } catch (err) {
    console.warn('Error sanitizing URL:', err);
    return url;
  }
}

export function applyContentScripts(webview) {
  if (!webview || typeof webview.executeJavaScript !== 'function') {
    console.warn('Cannot apply content scripts - invalid webview or missing executeJavaScript');
    return Promise.resolve(false);
  }
  
  console.log('Applying content enhancement scripts');
  
  const enhancementScript = `
    (function() {
      // Avoid duplicate execution
      if (window._contentScriptsApplied) {
        console.log('Content scripts already applied, skipping');
        return true;
      }
      
      // Mark as applied
      window._contentScriptsApplied = true;
      
      try {
        // Create and append stylesheet for better readability
        const styleElement = document.createElement('style');
        styleElement.id = 'cognivore-reader-styles';
        styleElement.textContent = \`
          /* Reader mode styles */
          body.cognivore-reader-mode {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif !important;
            font-size: 18px !important;
            line-height: 1.6 !important;
            max-width: 800px !important;
            margin: 0 auto !important;
            padding: 20px !important;
            color: #333 !important;
            background-color: #fff !important;
          }
          
          body.cognivore-reader-mode h1, 
          body.cognivore-reader-mode h2, 
          body.cognivore-reader-mode h3 {
            line-height: 1.3 !important;
            margin-top: 1.5em !important;
            margin-bottom: 0.5em !important;
          }
          
          body.cognivore-reader-mode p, 
          body.cognivore-reader-mode li {
            margin-bottom: 1em !important;
          }
          
          body.cognivore-reader-mode img {
            max-width: 100% !important;
            height: auto !important;
            margin: 1em 0 !important;
          }
          
          /* Dark mode styles */
          body.cognivore-reader-mode.dark-mode {
            color: #eee !important;
            background-color: #222 !important;
          }
          
          body.cognivore-reader-mode.dark-mode a {
            color: #6bf !important;
          }
        \`;
        
        document.head.appendChild(styleElement);
        
        // Create reader mode toggle button
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Reader Mode';
        toggleButton.id = 'cognivore-reader-toggle';
        toggleButton.style.cssText = \`
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 99999;
          background: #4a86e8;
          color: white;
          border: none;
          border-radius: 3px;
          padding: 8px 12px;
          font-size: 14px;
          cursor: pointer;
          opacity: 0.8;
          transition: opacity 0.2s;
        \`;
        
        toggleButton.addEventListener('mouseenter', () => {
          toggleButton.style.opacity = '1';
        });
        
        toggleButton.addEventListener('mouseleave', () => {
          toggleButton.style.opacity = '0.8';
        });
        
        toggleButton.addEventListener('click', () => {
          document.body.classList.toggle('cognivore-reader-mode');
          
          // If entering reader mode, also clean the page
          if (document.body.classList.contains('cognivore-reader-mode')) {
            // Find main content area
            const contentSelectors = [
              'article', 'main', '#main', '.main', '.article', '.post', 
              '[role="main"]', '.content', '#content', '.page-content'
            ];
            
            let mainContent = null;
            
            // Try to find main content
            for (const selector of contentSelectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim().length > 200) {
                mainContent = element;
                break;
              }
            }
            
            // If main content found, clean the page
            if (mainContent) {
              // Hide all elements except main content and its ancestors
              const allElements = document.body.querySelectorAll('*');
              let currentNode = mainContent;
              const ancestors = [];
              
              // Build list of ancestors
              while (currentNode && currentNode !== document.body) {
                ancestors.push(currentNode);
                currentNode = currentNode.parentNode;
              }
              
              // Hide elements not in the main content branch
              for (const element of allElements) {
                if (!ancestors.includes(element) && element !== mainContent && !mainContent.contains(element)) {
                  element.style.display = 'none';
                }
              }
              
              // Ensure main content is visible and centered
              mainContent.style.cssText = \`
                display: block !important;
                margin: 0 auto !important;
                width: 100% !important;
                max-width: 800px !important;
              \`;
            }
          } else {
            // If exiting reader mode, restore all elements
            const allElements = document.body.querySelectorAll('*');
            for (const element of allElements) {
              if (element.style.display === 'none') {
                element.style.display = '';
              }
            }
          }
        });
        
        // Add toggle button to page
        document.body.appendChild(toggleButton);
        
        // Add dark mode toggle
        const darkModeToggle = document.createElement('button');
        darkModeToggle.textContent = 'Dark Mode';
        darkModeToggle.id = 'cognivore-dark-toggle';
        darkModeToggle.style.cssText = \`
          position: fixed;
          top: 10px;
          right: 120px;
          z-index: 99999;
          background: #333;
          color: white;
          border: none;
          border-radius: 3px;
          padding: 8px 12px;
          font-size: 14px;
          cursor: pointer;
          opacity: 0.8;
          transition: opacity 0.2s;
        \`;
        
        darkModeToggle.addEventListener('mouseenter', () => {
          darkModeToggle.style.opacity = '1';
        });
        
        darkModeToggle.addEventListener('mouseleave', () => {
          darkModeToggle.style.opacity = '0.8';
        });
        
        darkModeToggle.addEventListener('click', () => {
          document.body.classList.toggle('dark-mode');
        });
        
        // Add dark mode toggle to page
        document.body.appendChild(darkModeToggle);
        
        console.log('Content enhancement scripts applied successfully');
        return true;
      } catch (error) {
        console.error('Error applying content scripts:', error);
        return false;
      }
    })();
  `;
  
  return webview.executeJavaScript(enhancementScript)
    .then(result => {
      console.log('Content scripts applied:', result);
      return result;
    })
    .catch(error => {
      console.error('Error executing content enhancement scripts:', error);
      return false;
    });
}

export function applyUrlSpecificTweaks(webview, url) {
  if (!webview || !url || typeof webview.executeJavaScript !== 'function') {
    console.warn('Cannot apply URL-specific tweaks - invalid parameters');
    return Promise.resolve(false);
  }
  
  // Check if URL is from certain sites that need tweaks
  const isGoogleSearch = /google\.[a-z]+\/search/.test(url);
  const isYouTube = /youtube\.com/.test(url);
  const isTwitter = /twitter\.com/.test(url) || /x\.com/.test(url);
  
  if (!isGoogleSearch && !isYouTube && !isTwitter) {
    // No specific tweaks needed
    return Promise.resolve(false);
  }
  
  console.log(`Applying URL-specific tweaks for: ${url}`);
  
  let tweakScript = '';
  
  if (isGoogleSearch) {
    tweakScript = `
      (function() {
        // Avoid duplicate execution
        if (window._googleTweaksApplied) {
          return true;
        }
        
        // Mark as applied
        window._googleTweaksApplied = true;
        
        try {
          // Create style element for Google-specific tweaks
          const styleElement = document.createElement('style');
          styleElement.id = 'cognivore-google-tweaks';
          styleElement.textContent = \`
            /* Make search results wider */
            #center_col, #rso, .g {
              width: 100% !important;
              max-width: none !important;
            }
            
            /* Increase readability of search results */
            .g {
              padding: 15px !important;
              margin-bottom: 10px !important;
              background: rgba(0,0,0,0.02) !important;
              border-radius: 8px !important;
            }
            
            /* Make the font size larger */
            .g .yuRUbf a h3 {
              font-size: 1.2em !important;
            }
            
            /* Improve result spacing */
            .g .yuRUbf {
              margin-bottom: 5px !important;
            }
            
            /* Ensure proper spacing between results */
            #rso > div {
              margin-bottom: 20px !important;
            }
          \`;
          
          document.head.appendChild(styleElement);
          
          console.log('Google search tweaks applied');
          return true;
        } catch (error) {
          console.error('Error applying Google tweaks:', error);
          return false;
        }
      })();
    `;
  } else if (isYouTube) {
    tweakScript = `
      (function() {
        // Avoid duplicate execution
        if (window._youtubeTweaksApplied) {
          return true;
        }
        
        // Mark as applied
        window._youtubeTweaksApplied = true;
        
        try {
          // Create style element for YouTube-specific tweaks
          const styleElement = document.createElement('style');
          styleElement.id = 'cognivore-youtube-tweaks';
          styleElement.textContent = \`
            /* Hide distracting elements */
            ytd-mini-guide-renderer, 
            #guide-content,
            ytd-comment-thread-renderer,
            #related {
              display: none !important;
            }
            
            /* Make video player larger */
            #primary, #player, video {
              width: 100% !important;
              max-width: none !important;
              height: auto !important;
            }
            
            /* Center the player */
            #primary {
              margin: 0 auto !important;
              float: none !important;
            }
            
            /* Hide comments section */
            #comments {
              display: none !important;
            }
          \`;
          
          document.head.appendChild(styleElement);
          
          console.log('YouTube tweaks applied');
          return true;
        } catch (error) {
          console.error('Error applying YouTube tweaks:', error);
          return false;
        }
      })();
    `;
  } else if (isTwitter) {
    tweakScript = `
      (function() {
        // Avoid duplicate execution
        if (window._twitterTweaksApplied) {
          return true;
        }
        
        // Mark as applied
        window._twitterTweaksApplied = true;
        
        try {
          // Create style element for Twitter-specific tweaks
          const styleElement = document.createElement('style');
          styleElement.id = 'cognivore-twitter-tweaks';
          styleElement.textContent = \`
            /* Hide sidebar elements */
            [data-testid="sidebarColumn"],
            [data-testid="primaryColumn"] > div:first-child {
              display: none !important;
            }
            
            /* Make main content wider */
            [data-testid="primaryColumn"] {
              width: 100% !important;
              max-width: 800px !important;
              margin: 0 auto !important;
            }
            
            /* Increase tweet text size */
            article {
              font-size: 1.1em !important;
            }
            
            /* Hide explore section */
            [aria-label="Timeline: Explore"] {
              display: none !important;
            }
          \`;
          
          document.head.appendChild(styleElement);
          
          console.log('Twitter tweaks applied');
          return true;
        } catch (error) {
          console.error('Error applying Twitter tweaks:', error);
          return false;
        }
      })();
    `;
  }
  
  return webview.executeJavaScript(tweakScript)
    .then(result => {
      console.log('URL-specific tweaks applied:', result);
      return result;
    })
    .catch(error => {
      console.error('Error executing URL-specific tweaks:', error);
      return false;
    });
}

export default {
  sanitizeHTML,
  applyRenderingFixes,
  handleContentCSS,
  handleContentJavaScript,
  cleanupHtmlForMemory,
  sanitizeUrlForAnalysis,
  applyContentScripts,
  applyUrlSpecificTweaks
}; 