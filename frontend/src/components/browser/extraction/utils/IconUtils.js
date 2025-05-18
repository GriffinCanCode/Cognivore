/**
 * IconUtils.js - Advanced utilities for website icon extraction and processing
 * 
 * Provides robust favicon and icon extraction for websites with multiple fallback
 * strategies and support for various icon formats.
 */

import { formatUrl } from '../../utils/BrowserUtilities';
import { fetchWithTimeout } from './UrlUtils';

/**
 * Default icon as data URL (globe icon)
 */
const DEFAULT_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktZ2xvYmUiIHZpZXdCb3g9IjAgMCAxNiAxNiI+PHBhdGggZD0iTTAgOGE4IDggMCAxIDEgMTYgMEE4IDggMCAwIDEgMCA4em03LjUtNi45NWEuNS41IDAgMCAwLS41LjV2MS4yNWEuNS41IDAgMCAwIC41LjVoLjVhLjUuNSAwIDAgMSAuNS41djUuNWEuNS41IDAgMCAxLS41LjVoLS41YS41LjUgMCAwIDAgMCAxaDFhLjUuNSAwIDAgMCAuNS0uNXYtNS41YS41LjUgMCAwIDEgLjUtLjVoNWEuNS41IDAgMCAwIDAtMWgtNWEuNS41IDAgMCAxLS41LS41di0xLjI1YS41LjUgMCAwIDAtLjUtLjVoLTV6Ii8+PC9zdmc+';

/**
 * Error icon as data URL (file-earmark icon)
 */
const ERROR_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktZmlsZS1lYXJtYXJrIiB2aWV3Qm94PSIwIDAgMTYgMTYiPjxwYXRoIGQ9Ik03IDEwLjVhLjUuNSAwIDAgMSAuNS0uNWgxYS41LjUgMCAwIDEgLjUuNXYxYS41LjUgMCAwIDEtLjUuNWgtMWEuNS41IDAgMCAxLS41LS41di0xeiIvPjxwYXRoIGQ9Ik0yIDJhMiAyIDAgMCAxIDItMmg4YTIgMiAwIDAgMSAyIDJ2MTJhMiAyIDAgMCAxLTIgMkgyYTIgMiAwIDAgMS0yLTJWMnptMi0xYTEgMSAwIDAgMC0xIDF2MTJhMSAxIDAgMCAwIDEgMWg4YTEgMSAwIDAgMCAxLTFWMmExIDEgMCAwIDAtMS0xSDR6Ii8+PC9zdmc+';

/**
 * Icon cache to prevent duplicate extraction attempts
 * @type {Map<string, string>}
 */
const iconCache = new Map();

/**
 * Get an icon for a given URL with multiple fallback strategies
 * 
 * @param {string} url - Website URL to get icon for
 * @param {Object} options - Options for icon extraction
 * @param {boolean} options.forceRefresh - Whether to bypass cache and re-extract
 * @param {boolean} options.extractFromPage - Whether to extract icons from page HTML
 * @param {boolean} options.useProxy - Whether to use a proxy endpoint for extraction
 * @param {number} options.timeout - Timeout for icon fetch in milliseconds
 * @returns {Promise<string>} - Promise resolving to icon data URL
 */
export async function getIconForUrl(url, options = {}) {
  const {
    forceRefresh = false,
    extractFromPage = true,
    useProxy = true,
    timeout = 3000
  } = options;
  
  try {
    // Format and normalize the URL
    const formattedUrl = formatUrl(url);
    const urlObj = new URL(formattedUrl);
    const origin = urlObj.origin;
    
    // Check cache first if not forcing refresh
    if (!forceRefresh && iconCache.has(origin)) {
      return iconCache.get(origin);
    }
    
    // Attempt multiple strategies in sequence
    try {
      // Strategy 1: Use backend proxy if available and enabled
      if (useProxy) {
        try {
          const proxyUrl = `/api/favicon?url=${encodeURIComponent(origin)}`;
          const response = await fetchWithTimeout(proxyUrl, { timeout });
          
          if (response.ok) {
            // If response is JSON with a data URL
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              if (data && data.iconUrl) {
                iconCache.set(origin, data.iconUrl);
                return data.iconUrl;
              }
            } 
            
            // If response is direct image data
            if (contentType && contentType.includes('image/')) {
              const blob = await response.blob();
              const dataUrl = await blobToDataUrl(blob);
              iconCache.set(origin, dataUrl);
              return dataUrl;
            }
          }
        } catch (proxyError) {
          console.warn('Proxy icon fetch failed:', proxyError);
        }
      }
      
      // Strategy 2: Direct favicon.ico fetch if allowed by CSP (uncomment if needed)
      /*
      try {
        const faviconUrl = `${origin}/favicon.ico`;
        const response = await fetchWithTimeout(faviconUrl, { 
          timeout,
          mode: 'no-cors' // Attempt with no-cors as fallback
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          iconCache.set(origin, dataUrl);
          return dataUrl;
        }
      } catch (directFetchError) {
        console.warn('Direct favicon fetch failed:', directFetchError);
      }
      */
      
      // Strategy 3: Extract from page HTML (if we have DOM access and it's enabled)
      if (extractFromPage && typeof document !== 'undefined') {
        try {
          const icons = extractIconsFromDOM(document);
          if (icons.length > 0) {
            // Use highest quality icon
            const bestIcon = selectBestIcon(icons);
            iconCache.set(origin, bestIcon);
            return bestIcon;
          }
        } catch (domError) {
          console.warn('DOM icon extraction failed:', domError);
        }
      }
      
      // Strategy 4: Use Google favicon service (data URL version)
      // This is a fallback option that returns a data URL rather than an external URL
      const googleProxyDataUrl = generateGoogleFaviconDataUrl(origin);
      iconCache.set(origin, googleProxyDataUrl);
      return googleProxyDataUrl;
      
    } catch (error) {
      console.error('All icon extraction strategies failed:', error);
    }
    
    // Final fallback: Return default icon
    iconCache.set(origin, DEFAULT_ICON);
    return DEFAULT_ICON;
  } catch (e) {
    console.error('Icon extraction error:', e);
    return ERROR_ICON;
  }
}

/**
 * Extract icons from a DOM document
 * 
 * @param {Document} document - DOM document to extract from
 * @returns {Array<{url: string, sizes: string, type: string}>} Array of icon objects
 */
function extractIconsFromDOM(document) {
  const icons = [];
  
  // Look for link elements with rel="icon" or similar
  const iconLinks = document.querySelectorAll(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]'
  );
  
  iconLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Convert relative URLs to absolute
    let url = href;
    if (url.startsWith('//')) {
      url = window.location.protocol + url;
    } else if (url.startsWith('/')) {
      url = window.location.origin + url;
    } else if (!url.startsWith('http')) {
      const base = document.querySelector('base[href]');
      const baseHref = base ? base.getAttribute('href') : window.location.href;
      url = new URL(url, baseHref).href;
    }
    
    icons.push({
      url,
      sizes: link.getAttribute('sizes') || '',
      type: link.getAttribute('type') || ''
    });
  });
  
  // Look for meta tags with msapplication-TileImage (Microsoft)
  const tileImage = document.querySelector('meta[name="msapplication-TileImage"]');
  if (tileImage) {
    const content = tileImage.getAttribute('content');
    if (content) {
      icons.push({
        url: content,
        sizes: '144x144', // Usually the size for tile images
        type: 'image/png'  // Usually the format for tile images
      });
    }
  }
  
  return icons;
}

/**
 * Select the best icon from a list based on size and format
 * 
 * @param {Array<{url: string, sizes: string, type: string}>} icons - List of icons
 * @returns {string} URL of the best icon
 */
function selectBestIcon(icons) {
  if (!icons || icons.length === 0) return DEFAULT_ICON;
  
  // Prioritize vector formats
  const svgIcons = icons.filter(icon => 
    icon.type === 'image/svg+xml' || icon.url.endsWith('.svg')
  );
  if (svgIcons.length > 0) return svgIcons[0].url;
  
  // Parse sizes to numbers for comparison
  const iconsWithParsedSizes = icons.map(icon => {
    let width = 0;
    let height = 0;
    
    if (icon.sizes) {
      const sizeMatch = icon.sizes.match(/(\d+)x(\d+)/);
      if (sizeMatch) {
        width = parseInt(sizeMatch[1], 10);
        height = parseInt(sizeMatch[2], 10);
      }
    }
    
    // Extract size from filename as fallback (e.g., favicon-32x32.png)
    if (width === 0 && height === 0) {
      const filenameMatch = icon.url.match(/(\d+)x(\d+)/);
      if (filenameMatch) {
        width = parseInt(filenameMatch[1], 10);
        height = parseInt(filenameMatch[2], 10);
      }
    }
    
    return {
      ...icon,
      parsedWidth: width,
      parsedHeight: height,
      area: width * height
    };
  });
  
  // Sort by area (largest first)
  iconsWithParsedSizes.sort((a, b) => b.area - a.area);
  
  // Return the largest icon URL, or the first one if no size info
  return iconsWithParsedSizes[0].url;
}

/**
 * Convert a Blob to a data URL
 * 
 * @param {Blob} blob - Blob to convert
 * @returns {Promise<string>} Promise resolving to data URL
 */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Generate a data URL version of a Google Favicon
 * Uses a local SVG instead of connecting to Google's service
 * 
 * @param {string} origin - Website origin
 * @returns {string} Data URL of the icon
 */
function generateGoogleFaviconDataUrl(origin) {
  // Instead of using Google's service directly, return our default icon
  // This avoids CSP issues while still giving a visual representation
  return DEFAULT_ICON;
}

/**
 * Get all icons used by a page, with metadata
 * 
 * @param {Document} document - DOM document to analyze
 * @returns {Array<Object>} Array of all icons with metadata
 */
export function getAllPageIcons(document) {
  if (!document) {
    if (typeof window !== 'undefined' && window.document) {
      document = window.document;
    } else {
      return [];
    }
  }
  
  return extractIconsFromDOM(document);
}

export default {
  getIconForUrl,
  getAllPageIcons,
  DEFAULT_ICON,
  ERROR_ICON
}; 