/**
 * Voyager - Modern Embedded Browser Component for Electron
 * 
 * Features:
 * - Secure content rendering in isolated context
 * - Memory management for browsing history
 * - Extraction and processing of page content
 * - Mobile-friendly browsing UI with navigation controls
 */

import React, { Component } from 'react';
import { nanoid } from 'nanoid';
import DOMPurify from 'dompurify';

// Import browser component utilities
import { 
  detectEnvironment, 
  applySandboxSettings, 
  formatUrl, 
  applySiteSpecificSettings
} from './utils/BrowserEnv';

import {
  cleanupHtmlForMemory,
  sanitizeUrlForAnalysis
} from './utils/ContentUtils';

import {
  handleTraverseHistory,
  handleBackAction,
  handleForwardAction,
  updateVisitedUrls,
  createHistoryRecord
} from './utils/HistoryManager';

import {
  extractPageContent,
  extractMainContent,
  extractHeadingStructure,
  extractFullPageContent
} from './handlers/ContentExtractor';

import {
  handleBookmarkCreation,
  updateBookmarksPanel
} from './utils/BookmarkManager';

import {
  renderHtml,
  createSafeIframe,
  renderContentView
} from './renderers/ContentRenderer';

import {
  setupBrowserLayout,
  setupNavigationBar,
  setupWebViewContainer,
  updateAddressBar,
  updateLoadingIndicator,
  updatePageTitle
} from './renderers/BrowserRenderer';

import {
  renderErrorPage
} from './renderers/ErrorPageRenderer';

import {
  handleLoadStart,
  handleLoadStop,
  handlePageNavigation
} from './handlers/EventHandlers';

class Voyager extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      url: props.initialUrl || 'about:blank',
      title: 'Loading...',
      isLoading: false,
      history: [],
      historyPosition: -1,
      errorState: null,
      viewMode: 'browser', // 'browser', 'reader', 'split'
      readerContent: null,
      bookmarks: [],
      // Track if the component is mounted
      isMounted: false,
      // Environment detection results
      environment: detectEnvironment()
    };
    
    // Create unique ID for component
    this.browserId = nanoid();
    
    // References
    this.containerRef = React.createRef();
    this.webview = null;
    this.iframe = null;
    this.addressInput = null;
    
    // Bind methods
    this.navigate = this.navigate.bind(this);
    this.refreshPage = this.refreshPage.bind(this);
    this.stopLoading = this.stopLoading.bind(this);
    this.handleAddressSubmit = this.handleAddressSubmit.bind(this);
    this.handleAddressChange = this.handleAddressChange.bind(this);
    this.handleWebviewLoad = this.handleWebviewLoad.bind(this);
    this.capturePageContent = this.capturePageContent.bind(this);
    this.toggleReaderMode = this.toggleReaderMode.bind(this);
  }
  
  componentDidMount() {
    this.setState({ isMounted: true });
    
    // Set up browser layout
    setupBrowserLayout(this);
    
    // Set up navigation bar
    setupNavigationBar(this);
    
    // Set up webview container
    setupWebViewContainer(this);
    
    // Set initial URL if provided
    if (this.props.initialUrl && this.props.initialUrl !== 'about:blank') {
      setTimeout(() => {
        this.navigate(this.props.initialUrl);
      }, 500);
    }
  }
  
  componentWillUnmount() {
    this.setState({ isMounted: false });
    
    // Clean up any event listeners
    if (this.webview) {
      this.webview.removeEventListener('did-start-loading', this.handleLoadStart);
      this.webview.removeEventListener('did-stop-loading', this.handleLoadStop);
      this.webview.removeEventListener('did-navigate', this.handlePageNavigation);
      this.webview.removeEventListener('did-finish-load', this.handleWebviewLoad);
    }
  }
  
  componentDidUpdate(prevProps) {
    // Handle URL updates from parent component
    if (prevProps.initialUrl !== this.props.initialUrl && 
        this.props.initialUrl && 
        this.props.initialUrl !== 'about:blank') {
      this.navigate(this.props.initialUrl);
    }
  }
  
  /**
   * Navigate to a URL
   * @param {string} url - URL to navigate to
   */
  navigate(url) {
    if (!url) return;
    
    // Format the URL (add protocol if needed)
    const formattedUrl = formatUrl(url);
    
    // Apply site-specific settings
    applySiteSpecificSettings.call(this, formattedUrl);
    
    // Update state
    this.setState({ 
      url: formattedUrl,
      isLoading: true,
      errorState: null
    });
    
    // Update address bar display
    updateAddressBar(this, formattedUrl);
    
    // Update loading indicator
    updateLoadingIndicator(this, true);
    
    // Navigate based on implementation type
    if (this.webview && this.state.environment.webviewImplementation === 'webview') {
      try {
        console.log(`🌐 Navigating webview to: ${formattedUrl}`);
        this.webview.src = formattedUrl;
      } catch (err) {
        console.error('WebView navigation error:', err);
        renderErrorPage(this, {
          code: 'NAV_ERROR',
          url: formattedUrl,
          message: 'Failed to navigate: ' + err.message
        });
      }
    } else if (this.iframe) {
      try {
        console.log(`🌐 Navigating iframe to: ${formattedUrl}`);
        // Handle navigation errors for iframes
        this.iframe.onload = this.handleWebviewLoad;
        this.iframe.onerror = (event) => {
          renderErrorPage(this, {
            code: 'IFRAME_LOAD_ERROR',
            url: formattedUrl,
            message: 'Failed to load content in iframe'
          });
        };
        this.iframe.src = formattedUrl;
      } catch (err) {
        console.error('iframe navigation error:', err);
        renderErrorPage(this, {
          code: 'NAV_ERROR',
          url: formattedUrl,
          message: 'Failed to navigate: ' + err.message
        });
      }
    } else {
      // Fallback renderer for when neither webview nor iframe is available
      renderHtml(this, `
        <div style="font-family: system-ui; padding: 20px; text-align: center;">
          <h2>Navigation Not Supported</h2>
          <p>This browser view cannot navigate directly to: ${formattedUrl}</p>
          <p>Please use an external browser or enable the internal browser view.</p>
          <a href="${formattedUrl}" target="_blank" rel="noopener noreferrer">Open in new window</a>
        </div>
      `);
    }
    
    // Update history
    updateVisitedUrls(this, formattedUrl);
  }
  
  /**
   * Refresh the current page
   */
  refreshPage() {
    if (this.webview) {
      this.webview.reload();
    } else if (this.iframe) {
      this.iframe.src = this.iframe.src;
    }
    
    this.setState({ isLoading: true });
    updateLoadingIndicator(this, true);
  }
  
  /**
   * Stop loading the current page
   */
  stopLoading() {
    if (this.webview) {
      this.webview.stop();
    } else if (this.iframe) {
      // For iframe, we just update the UI state since we can't actually stop it
      this.setState({ isLoading: false });
      updateLoadingIndicator(this, false);
    }
  }
  
  /**
   * Handle submission of address bar input
   * @param {Event} event - Form submission event
   */
  handleAddressSubmit(event) {
    event.preventDefault();
    const url = this.addressInput ? this.addressInput.value : '';
    if (url) {
      this.navigate(url);
    }
  }
  
  /**
   * Handle changes to address bar input
   * @param {Event} event - Input change event
   */
  handleAddressChange(event) {
    // Just update the input field, don't navigate yet
    // Navigation happens on form submission
  }
  
  /**
   * Handle webview/iframe load completion
   * @param {Event} event - Load event
   */
  handleWebviewLoad(event) {
    console.log('Webview loaded:', this.state.url);
    
    // Update UI state
    this.setState({ isLoading: false });
    updateLoadingIndicator(this, false);
    
    // Capture page content and title for memory
    this.capturePageContent();
    
    // Add to browsing history
    const historyRecord = createHistoryRecord(
      this.state.url, 
      this.state.title, 
      new Date().toISOString()
    );
    
    // Notify parent component if callback provided
    if (this.props.onPageLoad) {
      this.props.onPageLoad(historyRecord);
    }
  }
  
  /**
   * Captures and processes the content of the current page
   */
  capturePageContent() {
    if (this.webview) {
      // Extract content using the webview's executeJavaScript method
      this.webview.executeJavaScript(`
        {
          const title = document.title;
          const html = document.documentElement.outerHTML;
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .map(h => ({ level: h.tagName.toLowerCase(), text: h.textContent.trim() }));
          
          { title, html, headings }
        }
      `).then(result => {
        if (!result) return;
        
        // Update page title
        this.setState({ title: result.title || 'Untitled Page' });
        updatePageTitle(this, result.title || 'Untitled Page');
        
        // Clean up HTML for memory storage
        const cleanHtml = cleanupHtmlForMemory(result.html);
        
        // Extract main content
        const mainContent = extractMainContent(cleanHtml);
        
        // Update state with reader content
        this.setState({ readerContent: mainContent });
        
        // Capture page metadata for memory
        if (this.props.onContentCapture) {
          const content = {
            url: this.state.url,
            title: result.title,
            html: cleanHtml,
            mainContent: mainContent,
            headings: result.headings || [],
            capturedAt: new Date().toISOString()
          };
          this.props.onContentCapture(content);
        }
      }).catch(err => {
        console.error('Error capturing page content:', err);
      });
    } else if (this.iframe) {
      // For iframe, we have more limited access due to same-origin policy
      try {
        const title = this.iframe.contentDocument.title;
        this.setState({ title: title || 'Untitled Page' });
        updatePageTitle(this, title || 'Untitled Page');
        
        // We might not be able to extract content from cross-origin iframes
        if (this.props.onContentCapture) {
          const content = {
            url: this.state.url,
            title: title,
            html: '<p>Content extraction not available for this page</p>',
            mainContent: '<p>Content extraction not available for this page</p>',
            headings: [],
            capturedAt: new Date().toISOString()
          };
          this.props.onContentCapture(content);
        }
      } catch (err) {
        console.log('Cannot access iframe content due to same-origin policy');
      }
    }
  }
  
  /**
   * Toggle reader mode
   */
  toggleReaderMode() {
    const currentMode = this.state.viewMode;
    let newMode;
    
    if (currentMode === 'browser') {
      newMode = 'reader';
    } else if (currentMode === 'reader') {
      newMode = 'split';
    } else {
      newMode = 'browser';
    }
    
    this.setState({ viewMode: newMode });
    
    // If entering reader mode and we don't have content yet, try to fetch it
    if ((newMode === 'reader' || newMode === 'split') && !this.state.readerContent) {
      this.capturePageContent();
    }
  }
  
  render() {
    // Destructure props for easier access and defaults
    const { 
      className = '',
      style = {},
      showToolbar = true,
      showAddressBar = true,
      showStatusBar = true,
      height = '100%'
    } = this.props;
    
    // Compute container styles
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      height,
      border: '1px solid #ddd',
      borderRadius: '4px',
      overflow: 'hidden',
      ...style
    };
    
    return (
      <div 
        className={`voyager-browser ${className}`} 
        style={containerStyle}
        ref={this.containerRef}
        id={`voyager-${this.browserId}`}
      >
        {/* Browser chrome (toolbar, address bar) */}
        {showToolbar && (
          <div className="voyager-toolbar" style={{
            display: 'flex',
            padding: '8px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #ddd'
          }}>
            {/* Navigation buttons */}
            <button onClick={() => handleBackAction(this)} style={{ marginRight: '4px' }}>◀</button>
            <button onClick={() => handleForwardAction(this)} style={{ marginRight: '8px' }}>▶</button>
            <button onClick={this.refreshPage} style={{ marginRight: '8px' }}>↻</button>
            <button onClick={this.stopLoading} style={{ marginRight: '8px' }}>✕</button>
            
            {/* Address bar */}
            {showAddressBar && (
              <form onSubmit={this.handleAddressSubmit} style={{ flex: 1, display: 'flex' }}>
                <input 
                  type="text"
                  className="voyager-address-bar"
                  defaultValue={this.state.url}
                  onChange={this.handleAddressChange}
                  style={{ flex: 1, padding: '4px 8px' }}
                  ref={el => this.addressInput = el}
                />
              </form>
            )}
            
            {/* Reader mode toggle */}
            <button onClick={this.toggleReaderMode} style={{ marginLeft: '8px' }}>
              📖
            </button>
            
            {/* Bookmark button */}
            <button onClick={() => handleBookmarkCreation(this)} style={{ marginLeft: '8px' }}>
              🔖
            </button>
          </div>
        )}
        
        {/* Browser content area */}
        <div className="voyager-content" style={{
          flex: 1,
          display: 'flex',
          position: 'relative'
        }}>
          {/* Main browser view */}
          <div 
            className="voyager-browser-container"
            style={{
              flex: this.state.viewMode === 'reader' ? 0 : (this.state.viewMode === 'split' ? 1 : 1),
              display: this.state.viewMode === 'reader' ? 'none' : 'block',
              height: '100%',
              position: 'relative'
            }}
          >
            {/* This div will be populated with webview or iframe */}
          </div>
          
          {/* Reader view */}
          {(this.state.viewMode === 'reader' || this.state.viewMode === 'split') && (
            <div 
              className="voyager-reader-view"
              style={{
                flex: this.state.viewMode === 'browser' ? 0 : (this.state.viewMode === 'split' ? 1 : 1),
                display: this.state.viewMode === 'browser' ? 'none' : 'block',
                padding: '20px',
                height: '100%',
                overflow: 'auto',
                backgroundColor: '#fff'
              }}
            >
              <h1>{this.state.title}</h1>
              <div 
                className="reader-content"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(this.state.readerContent || '<p>No content available for reader view</p>') 
                }}
              />
            </div>
          )}
          
          {/* Loading indicator */}
          {this.state.isLoading && (
            <div className="voyager-loading-indicator" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255,255,255,0.8)',
              padding: '10px 20px',
              borderRadius: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              Loading...
            </div>
          )}
          
          {/* Error state */}
          {this.state.errorState && (
            <div className="voyager-error-container" style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f8f8f8',
              padding: '20px',
              overflow: 'auto'
            }}>
              <h2>Browser Error</h2>
              <p>Error Code: {this.state.errorState.code}</p>
              <p>URL: {this.state.errorState.url}</p>
              <p>{this.state.errorState.message}</p>
              <button onClick={() => this.navigate(this.state.url)}>Try Again</button>
              <button onClick={() => this.setState({ errorState: null })}>Dismiss</button>
            </div>
          )}
        </div>
        
        {/* Status bar */}
        {showStatusBar && (
          <div className="voyager-status-bar" style={{
            padding: '4px 8px',
            backgroundColor: '#f5f5f5',
            borderTop: '1px solid #ddd',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <div>{this.state.url}</div>
            <div>{this.state.isLoading ? 'Loading...' : 'Ready'}</div>
          </div>
        )}
      </div>
    );
  }
}

export default Voyager; 