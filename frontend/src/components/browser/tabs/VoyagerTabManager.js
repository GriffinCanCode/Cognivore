/**
 * VoyagerTabManager.js - Integration layer between TabManager and Voyager browser
 * 
 * This module provides a bridge between the TabManager and Voyager browser,
 * handling synchronization of tab state, content extraction, and event handling.
 */

import TabManager from './TabManager.js';
import webviewStateManager from './WebviewStateManager.js';
import StyleManager from '../handlers/StyleManager.js';
import MetadataProcessor from '../extraction/processors/MetadataProcessor.js';

class VoyagerTabManager {
  constructor(voyager) {
    this.voyager = voyager;
    this.tabManager = new TabManager();
    this.initialized = false;
    this.isCleaningUp = false; // Track cleanup state to prevent race conditions
    this.isSwitchingTabs = false; // Track tab switching state
    this._refreshInProgress = false; // Track UI refresh state to prevent recursion
    
    // CIRCUIT BREAKER: Add recursion prevention and rate limiting
    this._navigationEventCount = 0;
    this._lastNavigationEventTime = 0;
    this._tabSwitchQueue = [];
    this._isProcessingQueue = false;
    this._maxQueueSize = 3; // Limit queue size to prevent infinite queueing
    this._eventCooldownPeriod = 1000; // 1 second cooldown between rapid events
    
    // Event emitter for tab changes
    this.eventListeners = new Map();
    
    // Content processing queue to prevent overloading
    this.contentQueue = [];
    this.isProcessingContent = false;
    this.maxConcurrentProcessing = 2;
    this.processingCount = 0;
    
    // Initialize the tab manager
    this.init();
  }
  
  /**
   * Initialize the tab manager and set up event listeners
   */
  async init() {
    if (this.initialized || this.isCleaningUp) return;
    
    try {
      // CRITICAL FIX: Ensure we always have a valid URL and don't create duplicate tabs
      if (this.voyager) {
        let initialUrl = 'https://www.google.com';
        let initialTitle = 'Google';
        
        // Only use voyager URL if it's actually valid
        if (this.voyager.state?.url && 
            this.voyager.state.url !== '' && 
            this.voyager.state.url !== 'about:blank' &&
            this.voyager.state.url !== null &&
            this.voyager.state.url !== undefined) {
          initialUrl = this.voyager.state.url;
          initialTitle = this.voyager.state.title || this.voyager.state.url;
        }
        
        console.log('Initializing VoyagerTabManager with:', { initialUrl, initialTitle });
        
        // CRITICAL FIX: Clear any existing tabs first to prevent duplicates
        if (this.tabManager.getTabs().length > 0) {
          console.log('Clearing existing tabs before initialization');
          this.tabManager.getTabs().forEach(tab => {
            this.tabManager.closeTab(tab.id);
          });
        }
        
        // Create initial tab with guaranteed valid URL - use basic favicon for now
        const initialTab = this.tabManager.addTab({
          url: initialUrl,
          title: initialTitle,
          favicon: this.getFaviconFromUrl(initialUrl),
          isActive: true
        });
        
        // Ensure the tab is set as active
        this.tabManager.setActiveTab(initialTab.id);
        
        console.log('Created initial tab:', initialTab);
        
        // Set up clean event listeners
        this.setupEventListeners();
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing VoyagerTabManager:', error);
    }
  }
  
  /**
   * Set up event listeners using a clean event-based approach
   */
  setupEventListeners() {
    if (this.isCleaningUp) return;
    
    try {
      // Listen for Voyager navigation events
      this.addEventListener('navigation', (event) => {
        if (!this.isCleaningUp && !this.isSwitchingTabs) {
          this.handlePageNavigation(event.detail);
        }
      });
      
      // Listen for content capture events
      this.addEventListener('contentCaptured', (event) => {
        if (!this.isCleaningUp) {
          this.handleContentCapture(event.detail);
        }
      });
      
      // Subscribe to tab manager changes
      this.tabManager.subscribe((state) => {
        if (!this.isCleaningUp) {
          this.handleTabManagerUpdate(state);
        }
      });
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }
  
  /**
   * Add event listener
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler
   */
  addEventListener(eventType, handler) {
    if (this.isCleaningUp) return;
    
    try {
      if (!this.eventListeners.has(eventType)) {
        this.eventListeners.set(eventType, []);
      }
      this.eventListeners.get(eventType).push(handler);
    } catch (error) {
      console.error('Error adding event listener:', error);
    }
  }
  
  /**
   * Emit event to listeners
   * @param {string} eventType - Event type
   * @param {Object} detail - Event detail
   */
  emitEvent(eventType, detail) {
    if (this.isCleaningUp) return;
    
    try {
      const listeners = this.eventListeners.get(eventType) || [];
      const event = new CustomEvent(eventType, { detail });
      listeners.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    } catch (error) {
      console.error('Error emitting event:', error);
    }
  }
  
  /**
   * Extract metadata from webview page content
   * @param {string} tabId - Tab ID to update
   * @param {HTMLElement} webview - Webview element
   * @returns {Promise<Object>} - Extracted metadata
   */
  async extractPageMetadata(tabId, webview) {
    if (!webview || !tabId) {
      console.warn('extractPageMetadata: Missing webview or tabId');
      return null;
    }
    
    try {
      console.log(`🔍 Starting metadata extraction for tab ${tabId}`);
      
      // Check if webview is ready
      if (!webview.getWebContents || typeof webview.executeJavaScript !== 'function') {
        console.warn('Webview not ready for JavaScript execution, using fallback');
        this.extractBasicPageInfo(tabId);
        return null;
      }
      
      // Get page content from webview with enhanced error handling
      const pageData = await webview.executeJavaScript(`
        (function() {
          console.log('🚀 Executing metadata extraction script');
          try {
            // Check if document is ready
            if (document.readyState !== 'complete') {
              console.log('Document not ready, readyState:', document.readyState);
              return {
                error: 'Document not ready',
                readyState: document.readyState,
                url: window.location.href,
                title: document.title || 'Loading...'
              };
            }
            
            console.log('📄 Document ready, extracting metadata from:', window.location.href);
            
            // Extract metadata from page
            const metaTags = {};
            try {
              document.querySelectorAll('meta').forEach(meta => {
                const name = meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('http-equiv');
                const content = meta.getAttribute('content');
                if (name && content) {
                  metaTags[name.toLowerCase()] = content;
                }
              });
              console.log('📋 Extracted', Object.keys(metaTags).length, 'meta tags');
            } catch (metaError) {
              console.warn('Error extracting meta tags:', metaError);
            }
            
            // Get favicon URLs with enhanced detection and validation
            let faviconUrl = null;
            const faviconSelectors = [
              'link[rel="icon"]',
              'link[rel="shortcut icon"]', 
              'link[rel="apple-touch-icon"]',
              'link[rel="apple-touch-icon-precomposed"]',
              'link[rel="mask-icon"]'
            ];
            
            console.log('🎨 Searching for favicon...');
            for (const selector of faviconSelectors) {
              try {
                const link = document.querySelector(selector);
                if (link && link.href) {
                  // CRITICAL FIX: Validate and normalize favicon URL
                  let candidateUrl = link.href;
                  
                  // Handle relative URLs
                  if (candidateUrl.startsWith('/')) {
                    candidateUrl = window.location.origin + candidateUrl;
                  } else if (candidateUrl.startsWith('./') || candidateUrl.startsWith('../')) {
                    candidateUrl = new URL(candidateUrl, window.location.href).href;
                  }
                  
                  // Validate URL format
                  try {
                    new URL(candidateUrl);
                    faviconUrl = candidateUrl;
                    console.log('✅ Found valid favicon via', selector, ':', faviconUrl);
                    break;
                  } catch (urlError) {
                    console.warn('Invalid favicon URL:', candidateUrl, urlError);
                  }
                }
              } catch (selectorError) {
                console.warn('Error checking selector', selector, ':', selectorError);
              }
            }
            
            // ENHANCED: Try multiple fallback favicon URLs
            if (!faviconUrl) {
              const fallbackUrls = [
                window.location.origin + '/favicon.ico',
                window.location.origin + '/favicon.png',
                window.location.origin + '/apple-touch-icon.png',
                window.location.origin + '/icon.png'
              ];
              
              // Use the first fallback for now - we'll validate it later
              faviconUrl = fallbackUrls[0];
              console.log('🔄 Using fallback favicon:', faviconUrl);
            }
            
            const result = {
              url: window.location.href,
              title: document.title || 'Untitled',
              favicon: faviconUrl,
              metaTags: metaTags,
              html: document.documentElement ? document.documentElement.outerHTML : '',
              readyState: document.readyState,
              timestamp: Date.now()
            };
            
            console.log('✨ Metadata extraction successful:', {
              title: result.title,
              favicon: result.favicon,
              url: result.url,
              metaTagCount: Object.keys(result.metaTags).length
            });
            
            return result;
          } catch (error) {
            console.error('❌ Error in metadata extraction script:', error);
            return {
              error: error.message,
              url: window.location.href,
              title: document.title || 'Error',
              favicon: window.location.origin + '/favicon.ico',
              fallback: true
            };
          }
        })()
      `);
      
      console.log('📦 Webview script execution result:', pageData ? 'Success' : 'Failed');
      
      if (pageData && pageData.url) {
        // Check for document readiness error
        if (pageData.error === 'Document not ready') {
          console.log(`⏳ Document not ready for tab ${tabId}, scheduling retry`);
          // Retry after a longer delay
          setTimeout(() => {
            if (!this.isCleaningUp && !this.isSwitchingTabs) {
              console.log(`🔄 Retrying metadata extraction for tab ${tabId}`);
              this.extractPageMetadata(tabId, webview);
            }
          }, 2000);
          return null;
        }
        
        // If this is a fallback result, update tab with basic info
        if (pageData.fallback) {
          console.log(`🛡️ Using fallback metadata for tab ${tabId}:`, pageData.title);
          
          // Get current tab data before update for comparison
          const beforeUpdate = this.tabManager.getTabById(tabId);
          console.log(`📊 Tab ${tabId} BEFORE fallback update:`, {
            title: beforeUpdate?.title,
            favicon: beforeUpdate?.favicon,
            url: beforeUpdate?.url
          });
          
          const updatedTab = this.tabManager.updateTab(tabId, {
            title: pageData.title,
            favicon: pageData.favicon
          });
          
          // Verify the update was successful
          const afterUpdate = this.tabManager.getTabById(tabId);
          console.log(`📝 Tab ${tabId} AFTER fallback update:`, {
            title: afterUpdate?.title,
            favicon: afterUpdate?.favicon,
            url: afterUpdate?.url,
            updateResult: updatedTab ? 'SUCCESS' : 'FAILED'
          });
          
          // ENHANCED: Force UI refresh after fallback metadata update
          this.forceTabUIRefresh();
          
          // Emit event for any additional UI components that need to know about metadata updates
          this.emitEvent('tabMetadataUpdated', {
            tabId,
            title: pageData.title,
            favicon: pageData.favicon
          });
          
          return pageData;
        }
        
        // Process metadata using MetadataProcessor
        try {
          console.log(`🧠 Processing metadata with MetadataProcessor for tab ${tabId}`);
          const processedMetadata = await MetadataProcessor.process(pageData.metaTags, {
            url: pageData.url,
            title: pageData.title,
            html: pageData.html
          });
          
          const finalTitle = processedMetadata.title || pageData.title;
          const finalFavicon = processedMetadata.favicon || pageData.favicon;
          
          console.log(`✅ Metadata processing complete for tab ${tabId}:`, {
            title: finalTitle,
            favicon: finalFavicon,
            url: pageData.url
          });
          
          // Get current tab data before update for comparison
          const beforeUpdate = this.tabManager.getTabById(tabId);
          console.log(`📊 Tab ${tabId} BEFORE metadata update:`, {
            title: beforeUpdate?.title,
            favicon: beforeUpdate?.favicon,
            url: beforeUpdate?.url
          });
          
          // Update tab with processed metadata
          const updatedTab = this.tabManager.updateTab(tabId, {
            title: finalTitle,
            favicon: finalFavicon,
            metadata: processedMetadata
          });
          
          // Verify the update was successful
          const afterUpdate = this.tabManager.getTabById(tabId);
          console.log(`📝 Tab ${tabId} AFTER metadata update:`, {
            title: afterUpdate?.title,
            favicon: afterUpdate?.favicon,
            url: afterUpdate?.url,
            updateResult: updatedTab ? 'SUCCESS' : 'FAILED',
            hasMetadata: !!afterUpdate?.metadata
          });
          
          // CRITICAL FIX: Force UI refresh after metadata update
          this.forceTabUIRefresh();
          
          // Emit event for any additional UI components that need to know about metadata updates
          this.emitEvent('tabMetadataUpdated', {
            tabId,
            title: finalTitle,
            favicon: finalFavicon
          });
          
          return processedMetadata;
        } catch (metaError) {
          console.warn(`⚠️ MetadataProcessor failed for tab ${tabId}, using basic metadata:`, metaError);
          
          // Fallback to basic metadata
          this.tabManager.updateTab(tabId, {
            title: pageData.title,
            favicon: pageData.favicon
          });
          
          console.log(`📝 Tab ${tabId} updated with fallback metadata:`, {
            title: pageData.title,
            favicon: pageData.favicon,
            currentTabData: this.tabManager.getTabById(tabId)
          });
          
          // CRITICAL FIX: Force UI refresh after fallback metadata update
          this.forceTabUIRefresh();
          
          // Emit event for any additional UI components that need to know about metadata updates
          this.emitEvent('tabMetadataUpdated', {
            tabId,
            title: pageData.title,
            favicon: pageData.favicon
          });
          
          return pageData;
        }
      } else {
        console.warn(`❌ No valid page data received for tab ${tabId}`);
        // Try basic page info extraction as last resort
        this.extractBasicPageInfo(tabId);
      }
    } catch (error) {
      console.error(`💥 Failed to extract page metadata for tab ${tabId}:`, error);
      // Always try basic page info as fallback
      this.extractBasicPageInfo(tabId);
    }
    
    return null;
  }
  
  /**
   * Extract basic page info when full metadata extraction fails
   * @param {string} tabId - Tab ID to update
   */
  extractBasicPageInfo(tabId) {
    if (!this.voyager || !this.voyager.webview) return;
    
    try {
      console.log(`Extracting basic page info for tab ${tabId} as fallback`);
      
      // Try to get basic title from webContents
      if (this.voyager.webview.getWebContents) {
        const webContents = this.voyager.webview.getWebContents();
        if (webContents && typeof webContents.getTitle === 'function') {
          const pageTitle = webContents.getTitle();
          if (pageTitle && pageTitle !== 'Loading...' && pageTitle !== '' && pageTitle !== 'about:blank') {
            console.log(`Got basic page title for tab ${tabId}: ${pageTitle}`);
            this.tabManager.updateTab(tabId, {
              title: pageTitle
            });
            
            console.log(`📝 Tab ${tabId} updated with basic title:`, {
              title: pageTitle,
              currentTabData: this.tabManager.getTabById(tabId)
            });
            
            // CRITICAL FIX: Force UI refresh after basic title update
            this.forceTabUIRefresh();
            
            return;
          }
        }
      }
      
      // Fallback: try simple JavaScript execution
      this.voyager.webview.executeJavaScript(`document.title`)
        .then(title => {
          if (title && title !== 'Loading...' && title !== '' && title !== 'about:blank') {
            console.log(`Got fallback page title for tab ${tabId}: ${title}`);
            this.tabManager.updateTab(tabId, {
              title: title
            });
            
            console.log(`📝 Tab ${tabId} updated with JS title:`, {
              title: title,
              currentTabData: this.tabManager.getTabById(tabId)
            });
            
            // CRITICAL FIX: Force UI refresh after JS title update
            this.forceTabUIRefresh();
          }
        })
        .catch(error => {
          console.warn('Failed to get basic page title:', error);
        });
        
    } catch (error) {
      console.warn('Error in extractBasicPageInfo:', error);
    }
  }
  
  /**
   * Handle page navigation in Voyager to update tab state
   * @param {Object} navigationData - Page navigation data
   */
  async handlePageNavigation(navigationData) {
    // CIRCUIT BREAKER: Prevent navigation event storms
    const now = Date.now();
    
    // Basic validation
    if (!navigationData || !navigationData.url || this.isCleaningUp) {
      return;
    }
    
    // CIRCUIT BREAKER: Rate limiting - prevent more than 10 events per second (increased from 5)
    this._navigationEventCount++;
    if (now - this._lastNavigationEventTime < 100) { // Reduced from 200ms to 100ms for better responsiveness
      if (this._navigationEventCount > 10) { // Increased from 5 to 10
        console.warn('🛑 CIRCUIT BREAKER: Navigation event storm detected, throttling events');
        return;
      }
    } else {
      // Reset counter after cooldown period
      this._navigationEventCount = 1;
      this._lastNavigationEventTime = now;
    }
    
    // CRITICAL FIX: Only ignore navigation events during ACTIVE tab switching operations
    // Allow metadata extraction events even during tab switching for better UX
    if (this.isSwitchingTabs && navigationData.source !== 'metadata_extraction') {
      console.log('🚫 Ignoring navigation event during tab switching:', navigationData.url, 'source:', navigationData.source);
      return;
    }
    
    // Enhanced filtering based on navigation source and timing
    const { url, title, source } = navigationData;
    
    // CRITICAL FIX: Reduced aggressive filtering - only filter webview events for 2 seconds (reduced from 5)
    // and allow user navigation and metadata extraction events through
    if ((source === 'webview_load' || source === 'webview_navigation') && source !== 'user_navigation') {
      // Check if we just finished a tab switch recently (reduced to 2 seconds)
      if (this._lastTabSwitchTime && (now - this._lastTabSwitchTime) < 2000) {
        console.log(`🚫 Ignoring ${source} event - too close to recent tab switch:`, url);
        return;
      }
    }
    
    // CRITICAL FIX: Validate URL before processing
    if (!url || url === '' || url === 'about:blank' || url === null || url === undefined) {
      console.log('🚫 Ignoring navigation event with invalid URL:', url);
      return;
    }
    
    // CRITICAL FIX: Allow duplicate navigation events if they have different titles or sources
    // This ensures metadata updates work properly
    const activeTab = this.tabManager.getActiveTab();
    if (activeTab && activeTab.url === url && (now - this._lastNavigationEventTime) < this._eventCooldownPeriod) {
      // Allow if this is a metadata extraction or has a different title
      if (source !== 'metadata_extraction' && (!title || title === activeTab.title)) {
        console.log('🚫 Ignoring duplicate navigation event to same URL with same title:', url);
        return;
      }
    }
    
    // CRITICAL FIX: Remove the tab switch detection that was blocking legitimate navigation
    // The previous logic was incorrectly identifying normal navigation as tab switches
    // Instead, only check for actual tab switching state
    
    try {
      if (activeTab) {
        // CRITICAL FIX: Better URL validation and comparison
        if (!activeTab.url || activeTab.url === '' || activeTab.url === null) {
          console.log('📝 Active tab has invalid URL, updating with navigation URL:', url);
          this.tabManager.updateTab(activeTab.id, {
            url,
            title: title || activeTab.title || url,
            lastVisited: new Date().toISOString()
          });
          
          // CRITICAL FIX: Force UI refresh after URL update
          this.forceTabUIRefresh();
          return;
        }
        
        // CRITICAL FIX: Always allow title updates even if URL is the same
        // This ensures tab titles update when navigating to pages with the same URL but different content
        const normalizedCurrentUrl = this.normalizeUrl(activeTab.url);
        const normalizedNewUrl = this.normalizeUrl(url);
        
        // Update if URL changed OR if we have a new title
        const urlChanged = normalizedCurrentUrl !== normalizedNewUrl;
        const titleChanged = title && title !== activeTab.title && title !== 'Loading...' && title !== '';
        
        if (!urlChanged && !titleChanged) {
          console.log('🔄 URL and title unchanged, skipping navigation update:', url);
          return;
        }
        
        console.log(`🌐 Page navigation detected: ${activeTab.url} -> ${url} (source: ${source || 'unknown'})`, {
          urlChanged,
          titleChanged,
          newTitle: title,
          oldTitle: activeTab.title
        });
        
        // CRITICAL FIX: Immediately update tab with new URL and title, and get favicon
        const updateData = {
          lastVisited: new Date().toISOString()
        };
        
        if (urlChanged) {
          updateData.url = url;
          // ENHANCED: Get immediate favicon for new URL
          updateData.favicon = await this.validateFavicon(url);
        }
        
        if (titleChanged) {
          updateData.title = title;
        }
        
        // Update the tab immediately
        this.tabManager.updateTab(activeTab.id, updateData);
        
        console.log(`📝 Tab ${activeTab.id} updated immediately:`, {
          url: updateData.url,
          title: updateData.title,
          favicon: updateData.favicon,
          currentTabData: this.tabManager.getTabById(activeTab.id)
        });
        
        // CRITICAL FIX: Force UI refresh after immediate update
        this.forceTabUIRefresh();

        // ENHANCED: Extract proper metadata after page loads - but with improved rate limiting
        if (this.voyager && this.voyager.webview && !this._metadataExtractionInProgress && urlChanged) {
          console.log(`⏰ Scheduling metadata extraction for tab ${activeTab.id} after navigation (source: ${source})`);
          
          this._metadataExtractionInProgress = true;
          
          // Clear any existing metadata extraction timeout
          if (this._metadataExtractionTimeout) {
            clearTimeout(this._metadataExtractionTimeout);
          }
          
          // CRITICAL FIX: Immediate basic title/favicon update, then enhanced metadata later
          // This ensures the tab bar updates immediately while we wait for full metadata
          if (title && title !== activeTab.title) {
            console.log(`🚀 IMMEDIATE title update for tab ${activeTab.id}: ${title}`);
            this.tabManager.updateTab(activeTab.id, { title });
            this.forceTabUIRefresh();
          }
          
          // Schedule metadata extraction with progressive delays based on source
          let delay = 1000; // Reduced default delay from 1500ms
          if (source === 'webview_load') {
            delay = 1500; // Reduced from 2000ms
          } else if (source === 'user_navigation') {
            delay = 2000; // Reduced from 3000ms
          }
          
          this._metadataExtractionTimeout = setTimeout(async () => {
            if (!this.isCleaningUp && !this.isSwitchingTabs) {
              try {
                console.log(`🚀 EXECUTING metadata extraction for tab ${activeTab.id} after ${delay}ms delay`);
                const extractionResult = await this.extractPageMetadata(activeTab.id, this.voyager.webview);
                
                // ENHANCED: Add retry logic for failed extractions (but limit retries)
                if (!extractionResult && !this.isCleaningUp && !this.isSwitchingTabs && !this._metadataRetryAttempted) {
                  console.log(`⚠️ Metadata extraction failed for tab ${activeTab.id}, retrying once...`);
                  this._metadataRetryAttempted = true;
                  setTimeout(async () => {
                    if (!this.isCleaningUp && !this.isSwitchingTabs) {
                      try {
                        console.log(`🔄 RETRY: Executing metadata extraction for tab ${activeTab.id}`);
                        await this.extractPageMetadata(activeTab.id, this.voyager.webview);
                      } catch (retryError) {
                        console.warn('Retry metadata extraction failed:', retryError);
                        // Final fallback: try to get at least the page title
                        this.extractBasicPageInfo(activeTab.id);
                      } finally {
                        this._metadataRetryAttempted = false;
                      }
                    }
                  }, 1500); // Reduced retry delay
                }
              } catch (error) {
                console.warn('Failed to extract metadata after page load:', error);
                // Fallback: try to get at least the page title from webview
                this.extractBasicPageInfo(activeTab.id);
              } finally {
                this._metadataExtractionInProgress = false;
              }
            } else {
              this._metadataExtractionInProgress = false;
            }
          }, delay);
        }

        // CRITICAL FIX: Enhanced state capture after navigation with better timing
        if (this.voyager && this.voyager.webview && urlChanged) {
          // Clear any existing capture timeout to prevent overlapping captures
          if (this._navigationCaptureTimeout) {
            clearTimeout(this._navigationCaptureTimeout);
          }
          
          this._navigationCaptureTimeout = setTimeout(async () => {
            if (!this.isCleaningUp && !this.isSwitchingTabs) {
              try {
                console.log(`📸 Capturing state for tab ${activeTab.id} after navigation to ${url}`);
                await webviewStateManager.captureState(activeTab.id, this.voyager.webview);
              } catch (error) {
                console.warn('Failed to capture state after navigation:', error);
              }
            }
          }, 3000); // Reduced delay from 4000ms
        }
      } else {
        // Create new tab if none exists - but ensure it has a valid URL
        const newTab = this.tabManager.addTab({
          url,
          title: title || url,
          favicon: this.getFaviconFromUrl(url),
          isActive: true
        });
        this.tabManager.setActiveTab(newTab.id);
        console.log('🆕 Created new tab for navigation:', newTab);
        
        // CRITICAL FIX: Force UI refresh after creating new tab
        this.forceTabUIRefresh();
        
        // Schedule metadata extraction for new tab too
        if (this.voyager && this.voyager.webview) {
          setTimeout(async () => {
            if (!this.isCleaningUp) {
              try {
                console.log(`🔍 Extracting metadata for new tab ${newTab.id}`);
                await this.extractPageMetadata(newTab.id, this.voyager.webview);
              } catch (error) {
                console.warn('Failed to extract metadata for new tab:', error);
              }
            }
          }, 1500); // Reduced delay from 2000ms
        }
      }
    } catch (error) {
      console.error('Error handling page navigation:', error);
    }
  }
  
  /**
   * Handle content capture from Voyager to update tab content
   * @param {Object} content - Captured page content
   */
  handleContentCapture(content) {
    if (!content || !content.url || this.isCleaningUp) return;
    
    try {
      const activeTab = this.tabManager.getActiveTab();
      if (activeTab && activeTab.url === content.url) {
        // Queue content processing instead of processing immediately
        this.queueContentProcessing(activeTab.id, content);
      }
    } catch (error) {
      console.error('Error handling content capture:', error);
    }
  }
  
  /**
   * Queue content processing to prevent system overload
   * @param {string} tabId - Tab ID
   * @param {Object} content - Content to process
   */
  queueContentProcessing(tabId, content) {
    if (this.isCleaningUp) return;
    
    try {
      this.contentQueue.push({ tabId, content, timestamp: Date.now() });
      this.processContentQueue();
    } catch (error) {
      console.error('Error queuing content processing:', error);
    }
  }
  
  /**
   * Process content queue efficiently
   */
  async processContentQueue() {
    // Prevent concurrent processing beyond limit or during cleanup
    if (this.processingCount >= this.maxConcurrentProcessing || this.isCleaningUp) {
      return;
    }

    // Get next item from queue
    const item = this.contentQueue.shift();
    if (!item) return;

    this.processingCount++;

    try {
      await this.processTabContent(item.tabId, item.content);
    } catch (error) {
      console.error('Error processing tab content:', error);
    } finally {
      this.processingCount--;
      
      // Process next item if queue has items and not cleaning up
      if (this.contentQueue.length > 0 && !this.isCleaningUp) {
        // Small delay to prevent overwhelming the system
        setTimeout(() => {
          if (!this.isCleaningUp) {
            this.processContentQueue();
          }
        }, 100);
      }
    }
  }
  
  /**
   * Process individual tab content
   * @param {string} tabId - Tab ID
   * @param {Object} content - Content to process
   */
  async processTabContent(tabId, content) {
    if (this.isCleaningUp) return;
    
    try {
      const extractedContent = {
        title: content.title,
        text: content.text || '',
        html: content.processedContent || '',
        summary: content.text?.substring(0, 1000) || '',
        paragraphs: this.extractParagraphs(content.text),
        keywords: this.extractKeywords(content.title, content.text),
        capturedAt: content.timestamp || new Date().toISOString()
      };

      // Update tab content only if not cleaning up
      if (!this.isCleaningUp) {
        this.tabManager.updateTabContent(tabId, { extractedContent });
      }
    } catch (error) {
      console.error('Error processing tab content:', error);
    }
  }
  
  /**
   * Handle tab manager state updates
   * @param {Object} state - New tab manager state
   */
  handleTabManagerUpdate(state) {
    if (this.isCleaningUp) return;
    
    try {
      console.log('🔄 Tab manager state updated:', state);
      
      // Emit event for UI components to update
      this.emitEvent('tabsUpdated', state);
      
      // Update Voyager if active tab changed and not currently switching tabs
      if (!this.isSwitchingTabs) {
        const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
        if (activeTab && this.voyager) {
          // Only navigate if URL is different from current
          if (activeTab.url !== this.voyager.state?.url) {
            this.emitEvent('tabSwitched', { tab: activeTab });
          }
        }
      }
    } catch (error) {
      console.error('Error handling tab manager update:', error);
    }
  }
  
  /**
   * Force the tab UI to refresh by notifying all listeners
   * Only refreshes if tab data has actually changed to prevent unnecessary updates
   */
  forceTabUIRefresh() {
    // CRITICAL FIX: Add recursion protection and rate limiting
    if (this.isCleaningUp || this._refreshInProgress) {
      console.log('🚫 Skipping UI refresh - cleanup in progress or refresh already running');
      return;
    }
    
    // Rate limit UI refreshes to prevent excessive updates
    const now = Date.now();
    if (this._lastUIRefreshTime && (now - this._lastUIRefreshTime) < 100) {
      console.log('🚫 Skipping UI refresh - too soon since last refresh');
      return;
    }
    
    this._refreshInProgress = true;
    this._lastUIRefreshTime = now;
    
    try {
      console.log('🎨 Refreshing tab bar UI (titles and favicons only)');
      
      // Force the internal TabManager to notify all its listeners
      // This only updates the tab bar display, NOT the page content
      if (this.tabManager && typeof this.tabManager.notifyListeners === 'function') {
        this.tabManager.notifyListeners();
        console.log('✅ Tab bar UI updated successfully');
      } else {
        console.warn('⚠️ TabManager notifyListeners method not available');
      }
      
      // Also emit our own event for VoyagerTabManager listeners
      // This is for UI components like TabBar, NOT for page navigation
      const currentState = this.tabManager ? this.tabManager.getState() : null;
      if (currentState) {
        this.emitEvent('tabsUpdated', currentState);
        this.emitEvent('forceUIRefresh', currentState);
        console.log('✅ Tab UI events emitted successfully');
      } else {
        console.warn('⚠️ Unable to get current TabManager state for UI refresh');
      }
      
    } catch (error) {
      console.warn('Error refreshing tab UI:', error);
    } finally {
      // Reset flag after a small delay to prevent rapid successive calls
      setTimeout(() => {
        this._refreshInProgress = false;
      }, 50);
    }
  }
  
  /**
   * Switch to a specific tab with state preservation
   * @param {string} tabId - Tab ID to switch to
   */
  async switchToTab(tabId) {
    if (this.isCleaningUp) {
      console.log('🧹 Component cleaning up, skipping tab switch');
      return;
    }
    
    // CIRCUIT BREAKER: Prevent infinite queue and overlapping switches
    if (this.isSwitchingTabs) {
      // Check if this tab is already queued to prevent duplicates
      const isAlreadyQueued = this._tabSwitchQueue.some(queuedTabId => queuedTabId === tabId);
      
      if (isAlreadyQueued) {
        console.log('🔄 Tab switch already queued, ignoring duplicate request for tab:', tabId);
        return;
      }
      
      // Check queue size limit
      if (this._tabSwitchQueue.length >= this._maxQueueSize) {
        console.warn('🛑 CIRCUIT BREAKER: Tab switch queue full, dropping oldest request');
        this._tabSwitchQueue.shift(); // Remove oldest request
      }
      
      console.log(`⏳ Tab switch in progress, queueing request for tab: ${tabId} (queue size: ${this._tabSwitchQueue.length + 1})`);
      this._tabSwitchQueue.push(tabId);
      
      // Start processing queue if not already processing
      if (!this._isProcessingQueue) {
        this._processTabSwitchQueue();
      }
      return;
    }
    
    // Set flag to prevent race conditions
    this.isSwitchingTabs = true;
    // CRITICAL FIX: Track tab switch timing for navigation event filtering
    this._lastTabSwitchTime = Date.now();
    
    try {
      const targetTab = this.tabManager.getTabById(tabId);
      const currentActiveTab = this.tabManager.getActiveTab();
      
      if (!targetTab) {
        console.warn(`❌ Cannot switch to tab ${tabId}: tab not found`);
        this.isSwitchingTabs = false;
        this._processTabSwitchQueue(); // Process next in queue
        return;
      }

      // CRITICAL FIX: Validate target tab has a valid URL
      if (!targetTab.url || targetTab.url === '' || targetTab.url === null || targetTab.url === undefined) {
        console.warn(`🚨 Target tab ${tabId} has invalid URL, setting default`);
        targetTab.url = 'https://www.google.com';
        this.tabManager.updateTab(tabId, { url: targetTab.url, title: 'Google' });
      }

      // Skip if already the active tab
      if (currentActiveTab && currentActiveTab.id === tabId) {
        console.log('✅ Target tab is already active, no switch needed');
        this.isSwitchingTabs = false;
        this._processTabSwitchQueue(); // Process next in queue
        return;
      }

      console.log(`🔀 Switching from tab ${currentActiveTab?.id || 'none'} to tab ${tabId}`, {
        currentUrl: currentActiveTab?.url,
        targetUrl: targetTab.url,
        timestamp: new Date().toISOString()
      });

      // Step 1: Save current tab state if we have an active tab and webview
      if (currentActiveTab && this.voyager && this.voyager.webview) {
        try {
          // CRITICAL FIX: Only capture state if current tab has a valid URL
          if (currentActiveTab.url && currentActiveTab.url !== '' && currentActiveTab.url !== null) {
            console.log(`💾 Capturing state for current tab ${currentActiveTab.id} (${currentActiveTab.url})`);
            await webviewStateManager.captureState(currentActiveTab.id, this.voyager.webview);
          } else {
            console.log(`⏭️ Skipping state capture for tab ${currentActiveTab.id} - invalid URL`);
          }
        } catch (error) {
          console.warn('Failed to capture current tab state:', error);
          // Continue with tab switch even if state capture fails
        }
      }

      // Step 2: Set the new active tab in TabManager
      this.tabManager.setActiveTab(tabId);
      
      // Step 3: Navigate and restore state for the target tab
      if (this.voyager && targetTab.url) {
        try {
          // Check if we have saved state for this tab
          const savedState = webviewStateManager.getState(tabId);
          
          if (savedState && savedState.url && this.voyager.webview) {
            // CRITICAL FIX: Validate saved state URL before restoration
            if (savedState.url !== 'about:blank' && savedState.url !== '' && savedState.url !== null) {
              console.log(`🔄 Restoring saved state for tab ${tabId} (${savedState.url})`);
              const restored = await webviewStateManager.restoreState(
                tabId, 
                this.voyager.webview, 
                targetTab.url
              );
              
              if (restored) {
                console.log(`✅ Successfully restored state for tab ${tabId}`);
              } else {
                console.log(`⚠️ State restoration failed for tab ${tabId}, navigating normally`);
                // Fallback to normal navigation
                await this.safeNavigate(targetTab.url);
              }
            } else {
              console.log(`🔍 Saved state has invalid URL for tab ${tabId}, navigating normally`);
              await this.safeNavigate(targetTab.url);
            }
          } else {
            // No saved state, just navigate normally
            console.log(`🌐 No saved state for tab ${tabId}, navigating to ${targetTab.url}`);
            await this.safeNavigate(targetTab.url);
          }
        } catch (error) {
          console.error('Error during tab navigation/restoration:', error);
          // Fallback to basic navigation
          await this.safeNavigate(targetTab.url);
        }
      }

      // CRITICAL FIX: Extended delay to ensure navigation completes before clearing flag
      setTimeout(() => {
        this.isSwitchingTabs = false;
        console.log(`✅ Tab switch to ${tabId} completed at ${new Date().toISOString()}`);
        
        // Process next item in queue
        this._processTabSwitchQueue();
      }, 700); // Increased delay to prevent race conditions

    } catch (error) {
      console.error('Error switching to tab:', error);
      this.isSwitchingTabs = false;
      this._processTabSwitchQueue(); // Process next in queue even if error
    }
  }
  
  /**
   * Process the tab switch queue to handle queued tab switches
   * @private
   */
  _processTabSwitchQueue() {
    // Prevent concurrent queue processing
    if (this._isProcessingQueue || this.isSwitchingTabs || this.isCleaningUp) {
      return;
    }
    
    // Check if there are items in the queue
    if (this._tabSwitchQueue.length === 0) {
      return;
    }
    
    this._isProcessingQueue = true;
    
    // Process next item in queue after a short delay
    setTimeout(() => {
      if (this.isCleaningUp) {
        this._isProcessingQueue = false;
        return;
      }
      
      const nextTabId = this._tabSwitchQueue.shift();
      this._isProcessingQueue = false;
      
      if (nextTabId && !this.isSwitchingTabs) {
        console.log(`🔄 Processing queued tab switch to: ${nextTabId}`);
        this.switchToTab(nextTabId);
      }
    }, 800); // Wait for previous switch to complete
  }
  
  /**
   * Safe navigation wrapper that handles errors gracefully
   * @param {string} url - URL to navigate to
   */
  async safeNavigate(url) {
    try {
      if (this.voyager && this.voyager.navigate && typeof this.voyager.navigate === 'function') {
        await this.voyager.navigate(url);
      } else {
        console.warn('Voyager navigate method not available');
      }
    } catch (error) {
      console.error('Error in safe navigation:', error);
    }
  }
  
  /**
   * Create a new tab with enhanced state management
   * @param {Object} tabData - Tab data
   * @returns {Object} - Created tab
   */
  async createTab(tabData = {}) {
    if (this.isCleaningUp) return null;
    
    try {
      // Capture current tab state before creating new tab
      const currentActiveTab = this.tabManager.getActiveTab();
      if (currentActiveTab && this.voyager && this.voyager.webview) {
        // Do a quick basic state capture for the current tab
        webviewStateManager.captureBasicState(currentActiveTab.id, this.voyager.webview);
      }

      // CRITICAL FIX: Ensure new tab has a valid URL
      const defaultUrl = 'https://www.google.com';
      const newTabData = {
        url: tabData.url || defaultUrl,
        title: tabData.title || 'New Tab',
        favicon: tabData.favicon || this.getFaviconFromUrl(tabData.url || defaultUrl),
        ...tabData
      };

      console.log('Creating new tab with data:', newTabData);

      const newTab = this.tabManager.addTab(newTabData);
      
      // Switch to new tab with state preservation
      await this.switchToTab(newTab.id);
      
      return newTab;
    } catch (error) {
      console.error('Error creating tab:', error);
      return null;
    }
  }
  
  /**
   * Close a tab
   * @param {string} tabId - Tab ID to close
   */
  closeTab(tabId) {
    if (this.isCleaningUp) return;
    
    try {
      const tabs = this.tabManager.getTabs();
      
      // Prevent closing the last tab
      if (tabs.length <= 1) {
        // Instead of closing, navigate to Google
        this.switchToTab(tabId);
        if (this.voyager) {
          this.voyager.navigate('https://www.google.com');
        }
        return;
      }
      
      this.tabManager.closeTab(tabId);
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  }
  
  /**
   * Extract paragraphs from HTML content
   * @param {string} html - HTML content
   * @returns {Array} - Array of paragraph texts
   */
  extractParagraphs(html) {
    if (!html) return [];
    
    try {
      // Create temporary DOM element
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Get all paragraphs
      const paragraphs = Array.from(tempDiv.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(text => text.length > 30); // Only keep substantial paragraphs
      
      return paragraphs.slice(0, 10); // Limit to 10 paragraphs
    } catch (error) {
      console.error('Error extracting paragraphs:', error);
      return [];
    }
  }
  
  /**
   * Extract keywords from title and content
   * @param {string} title - Page title
   * @param {string} content - Page content
   * @returns {Array} - Array of keywords
   */
  extractKeywords(title, content) {
    if (!title && !content) return [];
    
    try {
      // Combine title and content
      const text = `${title || ''} ${content || ''}`;
      
      // Remove HTML tags
      const plainText = text.replace(/<[^>]*>/g, ' ');
      
      // Split into words and clean up
      const words = plainText.toLowerCase()
        .split(/\s+/)
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length > 3);
      
      // Count word frequencies
      const wordCounts = {};
      words.forEach(word => {
        if (!this.isStopWord(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
      
      // Sort by frequency
      const sortedWords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([word]) => word);
      
      return sortedWords.slice(0, 15); // Limit to 15 keywords
    } catch (error) {
      console.error('Error extracting keywords:', error);
      return [];
    }
  }
  
  /**
   * Check if a word is a common stop word
   * @param {string} word - Word to check
   * @returns {boolean} - True if word is a stop word
   */
  isStopWord(word) {
    const stopWords = ['the', 'and', 'that', 'this', 'with', 'from', 'for', 'have', 'has', 'are', 'were', 'was', 'you', 'your', 'they', 'their', 'our', 'ours', 'what', 'which', 'when', 'where', 'why', 'how'];
    return stopWords.includes(word.toLowerCase());
  }
  
  /**
   * Normalize URL for comparison
   * @param {string} url - URL to normalize
   * @returns {string} - Normalized URL
   */
  normalizeUrl(url) {
    if (!url) return '';
    
    try {
      // Remove protocol and trailing slashes
      return url.toLowerCase()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '');
    } catch (error) {
      return url.toLowerCase();
    }
  }
  
  /**
   * Get favicon URL from page URL (fallback method)
   * @param {string} url - Page URL
   * @returns {string} - Favicon URL
   */
  getFaviconFromUrl(url) {
    if (!url) return null;
    
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.protocol}//${parsedUrl.hostname}/favicon.ico`;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get the internal TabManager instance
   * @returns {TabManager} - TabManager instance
   */
  getTabManager() {
    return this.tabManager;
  }
  
  /**
   * Get serialized tab data for React components
   * @returns {Object} - Serialized tab data
   */
  getSerializedTabData() {
    const state = this.tabManager.getState();
    return {
      tabs: state.tabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favicon: tab.favicon,
        isActive: tab.id === state.activeTabId
      })),
      activeTabId: state.activeTabId,
      onTabClick: (tabId) => this.switchToTab(tabId),
      onTabClose: (tabId) => this.closeTab(tabId),
      onNewTab: () => this.createTab()
    };
  }
  
  /**
   * Analyze tabs using the specified clustering method
   * @param {string} method - Clustering method ('dbscan' or 'kmeans')
   * @param {Object} options - Clustering options
   * @returns {Promise<Object>} - Clustering results
   */
  async analyzeTabs(method = 'dbscan', options = {}) {
    return this.tabManager.analyzeTabs(method, options);
  }
  
  /**
   * Remove event listener
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler to remove
   */
  removeEventListener(eventType, handler) {
    if (this.isCleaningUp) return;
    
    try {
      if (!this.eventListeners.has(eventType)) return;
      
      const listeners = this.eventListeners.get(eventType);
      const index = listeners.indexOf(handler);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      // Clean up empty listener arrays
      if (listeners.length === 0) {
        this.eventListeners.delete(eventType);
      }
    } catch (error) {
      console.error('Error removing event listener:', error);
    }
  }

  /**
   * Clean up VoyagerTabManager resources and event listeners
   */
  cleanup() {
    // Prevent multiple cleanup calls and race conditions
    if (this.isCleaningUp) {
      console.log('VoyagerTabManager cleanup already in progress, skipping');
      return;
    }
    
    this.isCleaningUp = true;
    
    try {
      console.log('🧹 VoyagerTabManager cleaning up...');
      
      // CIRCUIT BREAKER: Clear all ongoing operations and queues
      this.isSwitchingTabs = false;
      this._isProcessingQueue = false;
      this._tabSwitchQueue = [];
      this._navigationEventCount = 0;
      this._metadataExtractionInProgress = false;
      this._metadataRetryAttempted = false;
      this._refreshInProgress = false; // Clear UI refresh flag
      
      // CRITICAL FIX: Clear all timeouts to prevent memory leaks and recursive calls
      if (this._metadataExtractionTimeout) {
        clearTimeout(this._metadataExtractionTimeout);
        this._metadataExtractionTimeout = null;
      }
      if (this._tabSwitchTimeout) {
        clearTimeout(this._tabSwitchTimeout);
        this._tabSwitchTimeout = null;
      }
      if (this._navigationRetryTimeout) {
        clearTimeout(this._navigationRetryTimeout);
        this._navigationRetryTimeout = null;
      }
      
      // CIRCUIT BREAKER: Clean up StyleManager circuit breaker state
      try {
        // Get all current tab IDs before cleanup
        const currentTabs = this.tabManager ? this.tabManager.getAllTabs() : [];
        currentTabs.forEach(tab => {
          if (tab.id) {
            StyleManager.cleanupCircuitBreakerState(tab.id);
          }
        });
        
        // Also do a complete cleanup for safety
        StyleManager.cleanupAllCircuitBreakerState();
        console.log('✅ StyleManager circuit breaker state cleaned up');
      } catch (styleCleanupError) {
        console.error('Error cleaning up StyleManager state:', styleCleanupError);
      }
      
      // Clean up webview state manager
      if (webviewStateManager && typeof webviewStateManager.clearAllStates === 'function') {
        webviewStateManager.clearAllStates();
        console.log('✅ WebviewStateManager states cleared');
      }
      
      // Clean up tab manager
      if (this.tabManager && typeof this.tabManager.cleanup === 'function') {
        this.tabManager.cleanup();
        console.log('✅ TabManager cleaned up');
      }
      
      // Clear references
      this.tabManager = null;
      this.voyager = null;
      
      console.log('✅ VoyagerTabManager cleanup completed successfully');
    } catch (error) {
      console.error('❌ Error during VoyagerTabManager cleanup:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Clean up resources for a specific tab
   * @param {string} tabId - Tab ID to clean up
   */
  cleanupTab(tabId) {
    if (!tabId) return;
    
    try {
      console.log(`🧹 Cleaning up resources for tab ${tabId}`);
      
      // Clean up circuit breaker state
      StyleManager.cleanupCircuitBreakerState(tabId);
      
      // Clean up webview state
      if (webviewStateManager && typeof webviewStateManager.clearState === 'function') {
        webviewStateManager.clearState(tabId);
      }
      
      // Clear any pending metadata extraction for this tab
      if (this._metadataExtractionTimeout && this._currentMetadataTabId === tabId) {
        clearTimeout(this._metadataExtractionTimeout);
        this._metadataExtractionTimeout = null;
        this._currentMetadataTabId = null;
        this._metadataExtractionInProgress = false;
      }
      
      console.log(`✅ Tab ${tabId} cleanup completed`);
    } catch (error) {
      console.error(`❌ Error cleaning up tab ${tabId}:`, error);
    }
  }

  // PROXY METHODS: Expose TabManager methods that UI components expect
  
  /**
   * Get all tabs - proxy method for TabManagerPanel compatibility
   * @returns {Array} - Array of tabs
   */
  getTabs() {
    return this.tabManager ? this.tabManager.getTabs() : [];
  }
  
  /**
   * Get all groups - proxy method for TabManagerPanel compatibility
   * @returns {Array} - Array of groups
   */
  getGroups() {
    return this.tabManager ? this.tabManager.getGroups() : [];
  }
  
  /**
   * Get active tab ID - proxy method for TabManagerPanel compatibility
   * @returns {string|null} - Active tab ID
   */
  getActiveTabId() {
    return this.tabManager ? this.tabManager.getActiveTabId() : null;
  }
  
  /**
   * Add listener - proxy method for TabManagerPanel compatibility
   * @param {Function} listener - Listener function
   */
  addListener(listener) {
    if (this.tabManager && typeof this.tabManager.addListener === 'function') {
      this.tabManager.addListener(listener);
    }
  }
  
  /**
   * Remove listener - proxy method for TabManagerPanel compatibility 
   * @param {Function} listener - Listener function to remove
   */
  removeListener(listener) {
    if (this.tabManager && typeof this.tabManager.removeListener === 'function') {
      this.tabManager.removeListener(listener);
    }
  }
  
  /**
   * Create a new group - proxy method for TabManagerPanel compatibility
   * @param {string} name - Group name
   * @returns {Object} - Created group
   */
  createGroup(name) {
    return this.tabManager ? this.tabManager.createGroup(name) : null;
  }
  
  /**
   * Rename a group - proxy method for TabManagerPanel compatibility
   * @param {string} groupId - Group ID
   * @param {string} name - New name
   * @returns {Object} - Updated group
   */
  renameGroup(groupId, name) {
    return this.tabManager ? this.tabManager.renameGroup(groupId, name) : null;
  }
  
  /**
   * Delete a group - proxy method for TabManagerPanel compatibility
   * @param {string} groupId - Group ID
   */
  deleteGroup(groupId) {
    if (this.tabManager && typeof this.tabManager.deleteGroup === 'function') {
      this.tabManager.deleteGroup(groupId);
    }
  }
  
  /**
   * Move tab to group - proxy method for TabManagerPanel compatibility
   * @param {string} tabId - Tab ID
   * @param {string} groupId - Group ID
   */
  moveTabToGroup(tabId, groupId) {
    if (this.tabManager && typeof this.tabManager.moveTabToGroup === 'function') {
      this.tabManager.moveTabToGroup(tabId, groupId);
    }
  }

  /**
   * Validate and get the best favicon URL for a given page URL
   * @param {string} pageUrl - The page URL to get favicon for
   * @param {string} extractedFavicon - Favicon URL extracted from page (optional)
   * @returns {Promise<string>} - Valid favicon URL or fallback
   */
  async validateFavicon(pageUrl, extractedFavicon = null) {
    if (!pageUrl) return null;
    
    try {
      const url = new URL(pageUrl);
      const candidates = [];
      
      // Add extracted favicon if provided
      if (extractedFavicon) {
        candidates.push(extractedFavicon);
      }
      
      // Add common favicon paths
      candidates.push(
        `${url.protocol}//${url.hostname}/favicon.ico`,
        `${url.protocol}//${url.hostname}/favicon.png`,
        `${url.protocol}//${url.hostname}/apple-touch-icon.png`,
        `${url.protocol}//${url.hostname}/icon.png`
      );
      
      // Test each candidate URL
      for (const candidateUrl of candidates) {
        try {
          // Quick validation - just return the first valid-looking URL for now
          // In a real implementation, you might want to actually test the URL
          new URL(candidateUrl);
          console.log(`✅ Using favicon URL: ${candidateUrl}`);
          return candidateUrl;
        } catch (error) {
          console.warn(`❌ Invalid favicon URL: ${candidateUrl}`);
        }
      }
      
      // Return default fallback
      return `${url.protocol}//${url.hostname}/favicon.ico`;
    } catch (error) {
      console.warn('Error validating favicon:', error);
      return null;
    }
  }
}

export default VoyagerTabManager; 