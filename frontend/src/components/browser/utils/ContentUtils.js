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
    return sanitizeHtml(html);
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

export default {
  sanitizeHtml,
  applyRenderingFixes,
  handleContentCSS,
  handleContentJavaScript,
  cleanupHtmlForMemory,
  sanitizeUrlForAnalysis
}; 