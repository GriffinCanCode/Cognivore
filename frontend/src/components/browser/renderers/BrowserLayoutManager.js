/**
 * BrowserLayoutManager - Coordinates all browser UI components and manages layout
 * This replaces the complex layout logic from BrowserRenderer and properly delegates
 * to specialized renderer components for separation of concerns.
 */

import { createAddressBarContainer } from './AddressBarRenderer.js';
import { createNavigationControls } from './NavigationControlsRenderer.js';
import { createActionButtons, updateActionButtonStates } from './ActionButtonsRenderer.js';
import { createTabBarContainer, updateTabBar } from './TabBarRenderer.js';
import { createProgressBar } from './BrowserRenderer.js';
import VoyagerTabManager from '../tabs/VoyagerTabManager.js';

/**
 * Set up the complete browser layout with all components
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Complete browser container
 */
export function setupCompleteBrowserLayout(browser) {
  if (!browser || !browser.containerRef || !browser.containerRef.current) {
    console.error('Cannot set up browser layout - container reference is missing');
    return null;
  }
  
  const container = browser.containerRef.current;
  
  // Clear any existing content
  container.innerHTML = '';
  
  // Set up container styling
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--browser-bg-color, #1a1a1a);
    color: var(--browser-text-color, #ffffff);
    overflow: hidden;
  `;
  
  // Initialize or get tab manager
  const tabManager = initializeTabManager(browser);
  
  // Create main header container
  const headerContainer = createBrowserHeaderContainer(browser, tabManager);
  container.appendChild(headerContainer);
  
  // Create progress bar
  const progressBar = createProgressBar();
  container.appendChild(progressBar);
  
  // Create main content area
  const webviewContainer = createWebviewContainer(browser);
  container.appendChild(webviewContainer);
  
  // Create research panel placeholder
  const researchPanelPlaceholder = createResearchPanelPlaceholder();
  container.appendChild(researchPanelPlaceholder);
  
  // Store references
  storeLayoutReferences(browser, {
    headerContainer,
    progressBar,
    webviewContainer,
    researchPanelPlaceholder,
    tabManager
  });
  
  // Initialize component states
  initializeComponentStates(browser);
  
  console.log('Complete browser layout created successfully');
  return container;
}

/**
 * Initialize or get existing tab manager
 * @param {Object} browser - Browser instance
 * @returns {Object} VoyagerTabManager instance
 */
function initializeTabManager(browser) {
  // Check if tab manager already exists
  if (browser.tabManager) {
    return browser.tabManager;
  }
  
  // Create new VoyagerTabManager
  const voyagerTabManager = new VoyagerTabManager(browser);
  
  // Store the VoyagerTabManager instance (not the internal TabManager)
  browser.tabManager = voyagerTabManager;
  
  // Create initial tab if none exist
  const internalTabManager = voyagerTabManager.getTabManager();
  if (!internalTabManager.getTabs().length) {
    console.log('Creating initial tab since no tabs exist');
    internalTabManager.createTab({
      url: 'https://www.google.com',
      title: 'New Tab',
      active: true
    });
  }
  
  return voyagerTabManager;
}

/**
 * Create the browser header container with all header components
 * @param {Object} browser - Browser instance
 * @param {Object} tabManager - Tab manager instance
 * @returns {HTMLElement} Header container
 */
function createBrowserHeaderContainer(browser, tabManager) {
  // Create container for all header elements
  const headerContainer = document.createElement('div');
  headerContainer.className = 'browser-header-container';
  
  // Add styling to ensure proper layout for all header elements
  headerContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    background-color: var(--header-bg-color, #222);
    border-bottom: 1px solid var(--border-color, #444);
  `;
  
  // CRITICAL FIX: Create a browser-header element that Voyager.js expects
  const browserHeader = document.createElement('div');
  browserHeader.className = 'browser-header';
  browserHeader.style.cssText = `
    display: flex;
    flex-direction: column;
    width: 100%;
  `;
  
  // Create tab bar FIRST (order: 1)
  const tabBarContainer = createTabBarContainer(browser, tabManager);
  browserHeader.appendChild(tabBarContainer);
  
  // Create address bar SECOND (order: 2)
  const addressContainer = createAddressBarContainer(browser);
  browserHeader.appendChild(addressContainer);
  
  // Create action toolbar THIRD (order: 3)
  const actionToolbar = createBrowserActionToolbar(browser);
  browserHeader.appendChild(actionToolbar);
  
  // Add the browser-header to the header container
  headerContainer.appendChild(browserHeader);
  
  return headerContainer;
}

/**
 * Create the browser action toolbar as a separate component
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Action toolbar element
 */
function createBrowserActionToolbar(browser) {
  const actionToolbar = document.createElement('div');
  actionToolbar.className = 'browser-action-toolbar';
  
  // Create toolbar actions container
  const toolbarActions = document.createElement('div');
  toolbarActions.className = 'toolbar-actions';
  
  // Add navigation controls
  const navControls = createNavigationControls(browser);
  toolbarActions.appendChild(navControls);
  
  // Create toolbar actions right container
  const toolbarActionsRight = document.createElement('div');
  toolbarActionsRight.className = 'toolbar-actions-right';
  
  // Add action buttons
  const actionButtons = createActionButtons(browser);
  toolbarActionsRight.appendChild(actionButtons);
  
  actionToolbar.appendChild(toolbarActions);
  actionToolbar.appendChild(toolbarActionsRight);
  
  return actionToolbar;
}

/**
 * Create webview container for browser content
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Webview container
 */
function createWebviewContainer(browser) {
  const webviewContainer = document.createElement('div');
  webviewContainer.className = 'browser-webview-container';
  webviewContainer.style.cssText = `
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 500px !important;
    display: flex !important;
    flex: 1 !important;
    overflow: hidden !important;
    background-color: white !important;
  `;
  
  return webviewContainer;
}

/**
 * Create research panel placeholder
 * @returns {HTMLElement} Research panel placeholder
 */
function createResearchPanelPlaceholder() {
  const researchPanelPlaceholder = document.createElement('div');
  researchPanelPlaceholder.className = 'browser-research-panel-placeholder';
  researchPanelPlaceholder.style.display = 'none';
  return researchPanelPlaceholder;
}

/**
 * Store layout references on browser object
 * @param {Object} browser - Browser instance
 * @param {Object} components - Layout component references
 */
function storeLayoutReferences(browser, components) {
  const { headerContainer, progressBar, webviewContainer, researchPanelPlaceholder, tabManager } = components;
  
  // Find sub-components within the layout
  const header = headerContainer.querySelector('.browser-header');
  const addressContainer = headerContainer.querySelector('.voyager-address-container');
  const tabBarContainer = headerContainer.querySelector('.voyager-tab-bar-wrapper');
  
  // Store all references
  browser.headerContainer = headerContainer;
  browser.header = header;
  browser.addressContainer = addressContainer;
  browser.tabBarContainer = tabBarContainer;
  browser.progressBar = progressBar.querySelector('.browser-progress-bar');
  browser.progressContainer = progressBar;
  browser.webviewContainer = webviewContainer;
  browser.researchPanelPlaceholder = researchPanelPlaceholder;
  browser.tabManager = tabManager;
  
  // Note: Individual button references are stored by their respective renderers
}

/**
 * Initialize component states after layout is complete
 * @param {Object} browser - Browser instance
 */
function initializeComponentStates(browser) {
  // Update action button states
  setTimeout(() => {
    updateActionButtonStates(browser);
  }, 100);
  
  // Set up any additional initialization
  console.log('Browser component states initialized');
}

/**
 * Update the entire browser layout (for dynamic changes)
 * @param {Object} browser - Browser instance
 */
export function updateBrowserLayout(browser) {
  // Update tab bar
  updateTabBar(browser);
  
  // Update action button states
  updateActionButtonStates(browser);
  
  // Any other layout updates as needed
  console.log('Browser layout updated');
}

/**
 * Setup the navigation bar specifically (for backward compatibility)
 * @param {Object} browser - Browser instance
 */
export function setupNavigationBar(browser) {
  console.log('Navigation bar already set up by BrowserLayoutManager');
  // Navigation controls are already created by createNavigationControls
  // This function maintains compatibility with existing code
}

/**
 * Setup the webview container specifically (for backward compatibility)
 * @param {Object} browser - Browser instance
 */
export function setupWebViewContainer(browser) {
  console.log('Webview container already set up by BrowserLayoutManager');
  // Webview container is already created by createWebviewContainer
  // This function maintains compatibility with existing code
}

/**
 * Get tab manager instance
 * @param {Object} browser - Browser instance
 * @returns {Object} Tab manager instance
 */
export function getTabManager(browser) {
  return browser.tabManager;
} 