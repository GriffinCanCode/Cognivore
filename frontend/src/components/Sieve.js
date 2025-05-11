/**
 * Sieve Component - Knowledge management system for filtering and organizing stored content
 */
import ApiService from '../services/ApiService.js';
import logger from '../utils/logger.js';

// Create context-specific logger
const sieveLogger = logger.scope('Sieve');

// Add memoization helper with reset capability
const createMemoizer = () => {
  const caches = new Map();
  
  const memoize = (fn, cacheId) => {
    // Create a unique cache ID if not provided
    const cacheKey = cacheId || fn.name || Math.random().toString(36).substring(2, 9);
    const cache = new Map();
    caches.set(cacheKey, cache);
    
    return (...args) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
    };
  };
  
  // Add function to clear all caches
  memoize.clearAll = () => {
    caches.forEach(cache => cache.clear());
    sieveLogger.debug(`Cleared all memoization caches (${caches.size} caches)`);
  };
  
  return memoize;
};

// Create a memoizer instance
const memoizer = createMemoizer();

class Sieve {
  constructor(notificationService, documentManager = null) {
    this.notificationService = notificationService;
    this.documentManager = documentManager;
    this.apiService = new ApiService();
    this.container = null;
    this.itemList = null;
    this.refreshButton = null;
    this.filterInput = null;
    this.filterType = 'all';
    this.items = [];
    this.flippedCardId = null;
    this.eventListeners = new Map(); // Track event listeners for cleanup
    this.itemsBeingDeleted = new Set(); // Track items being deleted
    this.refreshTimeout = null; // Track refresh timeout
    this.isLoading = false; // Track loading state
    
    // Bind methods
    this.refreshItems = this.refreshItems.bind(this);
    this.filterItems = this.filterItems.bind(this);
    this.handleTypeFilter = this.handleTypeFilter.bind(this);
    this.handleCardFlip = this.handleCardFlip.bind(this);
    this.handleDeleteItem = this.handleDeleteItem.bind(this);
    
    // Memoize expensive functions
    this.createItemCard = memoizer(this.createItemCard.bind(this), 'createItemCard');
    this.formatTextContent = memoizer(this.formatTextContent.bind(this), 'formatTextContent');
    this.getSourceTypeIcon = memoizer(this.getSourceTypeIcon.bind(this), 'getSourceTypeIcon');
    this.getSourceColor = memoizer(this.getSourceColor.bind(this), 'getSourceColor');
  }
  
  render() {
    sieveLogger.info('Rendering Sieve component');
    
    this.container = document.createElement('div');
    this.container.className = 'sieve-container';
    
    // Header with title and actions
    const header = document.createElement('div');
    header.className = 'sieve-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Knowledge Sieve';
    title.className = 'sieve-title';
    
    this.refreshButton = document.createElement('button');
    this.refreshButton.className = 'sieve-refresh-btn';
    this.refreshButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 4v6h-6"></path>
        <path d="M1 20v-6h6"></path>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
        <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
      </svg>
      <span>Refresh</span>
    `;
    this.addEventListenerWithCleanup(this.refreshButton, 'click', this.refreshItems);
    
    header.appendChild(title);
    header.appendChild(this.refreshButton);
    
    // Filter and search section
    const filterSection = document.createElement('div');
    filterSection.className = 'sieve-filter-section';
    
    this.filterInput = document.createElement('input');
    this.filterInput.type = 'text';
    this.filterInput.className = 'sieve-filter-input';
    this.filterInput.placeholder = 'Search knowledge...';
    this.addEventListenerWithCleanup(this.filterInput, 'input', this.filterItems);
    
    const filterTypes = document.createElement('div');
    filterTypes.className = 'sieve-filter-types';
    
    const filterOptions = [
      { id: 'all', label: 'All' },
      { id: 'pdf', label: 'PDF' },
      { id: 'url', label: 'Web' },
      { id: 'youtube', label: 'Video' }
    ];
    
    filterOptions.forEach(option => {
      const typeBtn = document.createElement('button');
      typeBtn.className = `sieve-type-filter ${option.id === this.filterType ? 'active' : ''}`;
      typeBtn.dataset.type = option.id;
      typeBtn.textContent = option.label;
      this.addEventListenerWithCleanup(typeBtn, 'click', () => this.handleTypeFilter(option.id));
      filterTypes.appendChild(typeBtn);
    });
    
    filterSection.appendChild(this.filterInput);
    filterSection.appendChild(filterTypes);
    
    // Content list
    this.itemList = document.createElement('div');
    this.itemList.className = 'sieve-item-list';
    
    // Append all sections to container
    this.container.appendChild(header);
    this.container.appendChild(filterSection);
    this.container.appendChild(this.itemList);
    
    return this.container;
  }
  
  initialize() {
    sieveLogger.info('Initializing Sieve component');
    this.refreshItems();
  }
  
  async refreshItems() {
    sieveLogger.info('Refreshing items');
    
    // Clear any existing refresh timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    
    // Reset memoization cache to prevent stale data
    memoizer.clearAll();
    
    try {
      // Skip showing loading state
      this.isLoading = false;
      
      // Fetch items with timeout handling
      sieveLogger.debug('Fetching items from backend...');
      const fetchPromise = this.documentManager 
        ? this.documentManager.getDocumentList()
        : this.apiService.listItems();
        
      // Add a timeout to prevent infinite loading state
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out after 15 seconds')), 15000);
      });
      
      // Race the fetch against the timeout
      this.items = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!this.items || !Array.isArray(this.items)) {
        throw new Error('Failed to load items: Invalid response format');
      }
      
      sieveLogger.debug(`Received ${this.items.length} items from backend`);
      
      // Display items immediately
      this.displayItems([...this.items]);
      this.isLoading = false;
    } catch (error) {
      sieveLogger.error('Failed to load items', error);
      if (this.notificationService) {
        this.notificationService.error(`Failed to load items: ${error.message}`);
      }
      
      // Just show empty state instead of error state
      this.isLoading = false;
      this.displayItems([]);
      
      // Reset items array to empty on error to prevent stale data
      this.items = [];
    }
  }
  
  showLoadingState() {
    // Do nothing - skip loading state completely
    this.isLoading = false;
  }
  
  showErrorState(message) {
    // Do nothing - skip error state and just show empty state
    this.isLoading = false;
  }
  
  filterItems() {
    const searchText = this.filterInput.value.toLowerCase();
    let filteredItems = [...this.items];
    
    // Filter by type if not 'all'
    if (this.filterType !== 'all') {
      filteredItems = filteredItems.filter(item => 
        item.source_type && item.source_type.toLowerCase() === this.filterType
      );
    }
    
    // Filter by search text
    if (searchText) {
      filteredItems = filteredItems.filter(item => 
        (item.title && item.title.toLowerCase().includes(searchText)) ||
        (item.preview && item.preview.toLowerCase().includes(searchText))
      );
    }
    
    this.displayItems(filteredItems);
  }
  
  handleTypeFilter(type) {
    this.filterType = type;
    
    // Update active state on buttons
    const typeButtons = this.container.querySelectorAll('.sieve-type-filter');
    typeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    
    this.filterItems();
  }
  
  displayItems(items) {
    if (!this.itemList) return;
    
    // Safety check - ensure items is an array
    if (!items || !Array.isArray(items)) {
      sieveLogger.warn('Received invalid items data', items);
      items = [];
    }
    
    // Always clear the container completely
    this.itemList.innerHTML = '';
    this.isLoading = false;
    
    if (items.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'sieve-empty-state';
      emptyState.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 12h8"></path>
        </svg>
        <p>No knowledge items found</p>
        <span>Try a different filter or import new content</span>
      `;
      this.itemList.appendChild(emptyState);
      return;
    }
    
    // Log key information for debugging
    sieveLogger.debug(`Rendering ${items.length} items`);
    
    const fragment = document.createDocumentFragment();
    const grid = document.createElement('div');
    grid.className = 'sieve-grid';
    
    // Add new items - with safety checks
    items.forEach(item => {
      if (!item) return; // Skip null/undefined items
      
      // Skip items being deleted
      if (item.id && this.itemsBeingDeleted.has(item.id)) return;
      
      // Ensure item has an ID to prevent rendering issues
      if (!item.id) {
        sieveLogger.warn('Item without ID detected, generating temporary ID', item);
        item.id = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }
      
      try {
        const flipContainer = this.createItemCard(item);
        grid.appendChild(flipContainer);
      } catch (err) {
        sieveLogger.error(`Error creating card for item ${item.id}`, err);
      }
    });
    
    fragment.appendChild(grid);
    this.itemList.appendChild(fragment);
  }
  
  createItemCard(item) {
    // Create flip container for the card
    const flipContainer = document.createElement('div');
    flipContainer.className = 'sieve-card-flip-container';
    
    // Ensure item has a valid ID
    if (!item.id) {
      sieveLogger.warn('Item without ID detected', item);
      item.id = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    
    flipContainer.dataset.itemId = item.id;
    
    const card = document.createElement('div');
    card.className = 'sieve-item-card';
    
    // Create front side of card
    const cardFront = this.createCardFront(item);
    
    // Create back side of card
    const cardBack = this.createCardBack(item);
    
    // Add both sides to the card
    card.appendChild(cardFront);
    card.appendChild(cardBack);
    
    // Add card to flip container
    flipContainer.appendChild(card);
    
    return flipContainer;
  }
  
  createCardFront(item) {
    const cardFront = document.createElement('div');
    cardFront.className = 'sieve-card-front';
    
    // Card header with title and type badge
    const cardHeader = document.createElement('div');
    cardHeader.className = 'sieve-item-header';
    
    const typeIcon = this.getSourceTypeIcon(item.source_type);
    const typeBadge = document.createElement('div');
    typeBadge.className = 'sieve-item-badge';
    typeBadge.innerHTML = typeIcon;
    typeBadge.style.backgroundColor = this.getSourceColor(item.source_type);
    
    const title = document.createElement('h3');
    title.className = 'sieve-item-title';
    title.textContent = item.title || 'Untitled';
    
    cardHeader.appendChild(typeBadge);
    cardHeader.appendChild(title);
    
    // Card content with preview
    const cardContent = document.createElement('div');
    cardContent.className = 'sieve-item-content';
    
    const preview = document.createElement('p');
    preview.className = 'sieve-item-preview';
    preview.textContent = item.preview || 'No preview available';
    
    cardContent.appendChild(preview);
    
    // Card actions
    const cardActions = document.createElement('div');
    cardActions.className = 'sieve-item-actions';
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'sieve-action-btn view-btn';
    viewBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      <span>View</span>
    `;
    this.addEventListenerWithCleanup(viewBtn, 'click', () => this.handleCardFlip(item.id, item));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'sieve-action-btn delete-btn';
    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      <span>Delete</span>
    `;
    this.addEventListenerWithCleanup(deleteBtn, 'click', () => this.handleDeleteItem(item));
    
    cardActions.appendChild(viewBtn);
    cardActions.appendChild(deleteBtn);
    
    // Assemble front of card
    cardFront.appendChild(cardHeader);
    cardFront.appendChild(cardContent);
    cardFront.appendChild(cardActions);
    
    return cardFront;
  }
  
  createCardBack(item) {
    const cardBack = document.createElement('div');
    cardBack.className = 'sieve-card-back';
    
    const typeIcon = this.getSourceTypeIcon(item.source_type);
    
    // Back header with badge, title and close button
    const backHeader = document.createElement('div');
    backHeader.className = 'sieve-card-back-header';
    
    const backTitle = document.createElement('div');
    backTitle.className = 'sieve-card-back-title';
    
    const backBadge = document.createElement('div');
    backBadge.className = 'sieve-item-badge';
    backBadge.innerHTML = typeIcon;
    backBadge.style.backgroundColor = this.getSourceColor(item.source_type);
    
    backTitle.appendChild(backBadge);
    backTitle.appendChild(document.createTextNode(item.title || 'Untitled'));
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sieve-card-close';
    closeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    this.addEventListenerWithCleanup(closeBtn, 'click', () => this.handleCardFlip(item.id, null));
    
    backHeader.appendChild(backTitle);
    backHeader.appendChild(closeBtn);
    
    // Card content with metadata and text
    const backContent = document.createElement('div');
    backContent.className = 'sieve-card-content';
    
    // Metadata section
    const metadata = this.createMetadataSection(item);
    
    // Text content
    const textContent = document.createElement('div');
    textContent.className = 'sieve-card-text';
    
    const formattedText = this.formatTextContent(item.preview || 'No content available');
    textContent.innerHTML = formattedText;
    
    backContent.appendChild(metadata);
    backContent.appendChild(textContent);
    
    // Back footer with actions
    const backFooter = document.createElement('div');
    backFooter.className = 'sieve-card-footer';
    
    const actionButtons = document.createElement('div');
    actionButtons.className = 'sieve-card-actions';
    
    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'sieve-card-action-btn';
    copyBtn.title = 'Copy Content';
    copyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    this.addEventListenerWithCleanup(copyBtn, 'click', () => this.copyItemText(item));
    
    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'sieve-card-action-btn';
    exportBtn.title = 'Export Content';
    exportBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;
    this.addEventListenerWithCleanup(exportBtn, 'click', () => this.exportItemContent(item));
    
    actionButtons.appendChild(copyBtn);
    actionButtons.appendChild(exportBtn);
    
    backFooter.appendChild(actionButtons);
    
    // Assemble back of card
    cardBack.appendChild(backHeader);
    cardBack.appendChild(backContent);
    cardBack.appendChild(backFooter);
    
    return cardBack;
  }
  
  createMetadataSection(item) {
    const metadata = document.createElement('div');
    metadata.className = 'sieve-card-metadata';
    
    // Source type
    const sourceItem = document.createElement('div');
    sourceItem.className = 'sieve-card-meta-item';
    
    const sourceLabel = document.createElement('div');
    sourceLabel.className = 'sieve-card-meta-label';
    sourceLabel.textContent = 'Source:';
    
    const sourceValue = document.createElement('div');
    sourceValue.className = 'sieve-card-meta-value';
    sourceValue.innerHTML = this.formatSourceLink(item);
    
    sourceItem.appendChild(sourceLabel);
    sourceItem.appendChild(sourceValue);
    
    // Date added
    const dateItem = document.createElement('div');
    dateItem.className = 'sieve-card-meta-item';
    
    const dateLabel = document.createElement('div');
    dateLabel.className = 'sieve-card-meta-label';
    dateLabel.textContent = 'Added:';
    
    const dateValue = document.createElement('div');
    dateValue.className = 'sieve-card-meta-value';
    dateValue.textContent = this.formatDate(item.created_at || new Date());
    
    dateItem.appendChild(dateLabel);
    dateItem.appendChild(dateValue);
    
    // ID reference
    const idItem = document.createElement('div');
    idItem.className = 'sieve-card-meta-item';
    
    const idLabel = document.createElement('div');
    idLabel.className = 'sieve-card-meta-label';
    idLabel.textContent = 'ID:';
    
    const idValue = document.createElement('div');
    idValue.className = 'sieve-card-meta-value';
    idValue.textContent = item.id;
    
    idItem.appendChild(idLabel);
    idItem.appendChild(idValue);
    
    metadata.appendChild(sourceItem);
    metadata.appendChild(dateItem);
    metadata.appendChild(idItem);
    
    return metadata;
  }
  
  async handleDeleteItem(item) {
    // Skip if we're already deleting this item
    if (this.itemsBeingDeleted.has(item.id)) {
      sieveLogger.info(`Item ${item.id} is already being deleted, skipping duplicate request`);
      return;
    }

    try {
      // Mark item as being deleted
      this.itemsBeingDeleted.add(item.id);
      
      // Find the card for this item
      const card = this.container.querySelector(`.sieve-card-flip-container[data-item-id="${item.id}"]`);
      if (card) {
        // Add a visual indication that delete is in progress
        card.classList.add('deleting');
        
        // Find the delete button and disable it
        const deleteBtn = card.querySelector('.delete-btn');
        if (deleteBtn) {
          deleteBtn.disabled = true;
          deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="6" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12" y2="16"></line>
            </svg>
            <span>Deleting...</span>
          `;
        }
      }
      
      // Perform the delete operation
      if (this.documentManager) {
        await this.documentManager.deleteDocument(item.id);
      } else {
        await this.apiService.deleteItem(item.id);
      }
      
      // Show success notification
      if (this.notificationService) {
        this.notificationService.success(`Deleted: ${item.title}`);
      }
      
      // Remove the item from the local items array
      this.items = this.items.filter(i => i.id !== item.id);
      
      // Update the UI without a full refresh
      if (card) {
        // Apply delete animation
        card.classList.add('deleting-animate');
        
        // Remove the card after animation completes
        setTimeout(() => {
          if (card.parentNode) {
            card.parentNode.removeChild(card);
          }
          
          // Check if we need to show empty state
          if (this.items.length === 0) {
            this.displayItems([]);
          }
        }, 800); // Match the animation duration
      }
      
      // Schedule a delayed full refresh to ensure backend changes are reflected
      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout);
      }
      this.refreshTimeout = setTimeout(() => {
        this.refreshItems();
      }, 3000); // Refresh after 3 seconds to ensure backend consistency
      
    } catch (error) {
      sieveLogger.error('Error deleting item', error);
      
      // Show error notification
      if (this.notificationService) {
        this.notificationService.error(`Error deleting item: ${error.message}`);
      }
      
      // Reset the delete button if it exists
      const card = this.container.querySelector(`.sieve-card-flip-container[data-item-id="${item.id}"]`);
      if (card) {
        card.classList.remove('deleting');
        card.classList.remove('deleting-animate');
        
        const deleteBtn = card.querySelector('.delete-btn');
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Delete</span>
          `;
        }
      }
    } finally {
      // Remove the item from the tracking Set
      this.itemsBeingDeleted.delete(item.id);
    }
  }
  
  handleCardFlip(itemId, itemData) {
    // Validate itemId
    if (!itemId) {
      sieveLogger.warn('Attempted to flip card with null/undefined ID');
      return;
    }
    
    sieveLogger.info(`Attempting to flip card with ID: ${itemId}`);
    
    const targetContainer = this.container.querySelector(`.sieve-card-flip-container[data-item-id="${itemId}"]`);
    
    if (!targetContainer) {
      sieveLogger.warn(`Card container not found for item ID: ${itemId}`);
      return;
    }
    
    sieveLogger.info(`Found target container: ${targetContainer.className}`);
    
    // If this card is already flipped and we're closing it
    if (this.flippedCardId === itemId && !itemData) {
      sieveLogger.info(`Unflipping card ${itemId}`);
      targetContainer.classList.remove('flipped');
      this.flippedCardId = null;
      return;
    }
    
    // If another card is flipped, unflip it first
    if (this.flippedCardId && this.flippedCardId !== itemId) {
      const previousFlipped = this.container.querySelector(`.sieve-card-flip-container[data-item-id="${this.flippedCardId}"]`);
      if (previousFlipped) {
        sieveLogger.info(`Unflipping previous card ${this.flippedCardId}`);
        previousFlipped.classList.remove('flipped');
      }
    }
    
    // Force update to ensure rendering
    setTimeout(() => {
      // Flip the target card
      sieveLogger.info(`Flipping card ${itemId}`);
      targetContainer.classList.add('flipped');
      this.flippedCardId = itemId;
      
      // Scroll the flipped card into view if needed
      targetContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Add debug info to console
      console.log('Card flipped:', {
        id: itemId,
        element: targetContainer,
        hasFlippedClass: targetContainer.classList.contains('flipped'),
        cardStyles: window.getComputedStyle(targetContainer.querySelector('.sieve-item-card')),
        frontStyles: window.getComputedStyle(targetContainer.querySelector('.sieve-card-front')),
        backStyles: window.getComputedStyle(targetContainer.querySelector('.sieve-card-back'))
      });
    }, 50); // Small delay to ensure DOM updates
  }
  
  copyItemText(item) {
    const text = item.preview || '';
    navigator.clipboard.writeText(text)
      .then(() => {
        if (this.notificationService) {
          this.notificationService.success('Content copied to clipboard');
        }
      })
      .catch(err => {
        sieveLogger.error('Error copying content', err);
        if (this.notificationService) {
          this.notificationService.error('Failed to copy content');
        }
      });
  }
  
  exportItemContent(item) {
    const fileName = `knowledge-content-${item.id.substring(0, 8)}-${Date.now()}.txt`;
    const content = item.preview || 'No content available';
    
    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  formatSourceLink(item) {
    const source = item.source_identifier || '';
    
    if (item.source_type && item.source_type.toLowerCase() === 'url' && source.startsWith('http')) {
      return `<a href="${source}" target="_blank">${source}</a>`;
    } else if (item.source_type && item.source_type.toLowerCase() === 'youtube' && source.includes('youtube.com')) {
      return `<a href="${source}" target="_blank">${source}</a>`;
    }
    
    return source;
  }
  
  formatTextContent(text) {
    // Enhanced formatting with proper paragraph handling and link detection
    let formatted = text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .trim();
    
    // Convert URLs to clickable links
    formatted = formatted.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank">$1</a>'
    );
    
    return `<p>${formatted}</p>`;
  }
  
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Unknown date';
    }
  }
  
  getSourceTypeIcon(sourceType) {
    if (!sourceType) return '';
    
    switch (sourceType.toLowerCase()) {
      case 'pdf':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>`;
      case 'url':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>`;
      case 'youtube':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>`;
      default:
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>`;
    }
  }
  
  getSourceColor(sourceType) {
    if (!sourceType) return '#95a5a6';
    
    switch (sourceType.toLowerCase()) {
      case 'pdf': return '#e74c3c';
      case 'url': return '#3498db';
      case 'youtube': return '#e67e22';
      default: return '#95a5a6';
    }
  }
  
  // Helper method to track event listeners for proper cleanup
  addEventListenerWithCleanup(element, event, handler) {
    if (!element) return;
    
    element.addEventListener(event, handler);
    
    // Store reference for cleanup
    const elementListeners = this.eventListeners.get(element) || [];
    elementListeners.push({ event, handler });
    this.eventListeners.set(element, elementListeners);
  }
  
  // Add shouldComponentUpdate-like functionality to optimize rendering
  shouldUpdate(newItems) {
    // If either array is null or undefined, force update
    if (!this.items || !newItems) return true;
    
    // Always update if lengths are different
    if (this.items.length !== newItems.length) return true;
    
    try {
      // Check for item ID differences - more reliable than stringifying entire objects
      const oldIds = this.items.map(item => item?.id || '').sort().join(',');
      const newIds = newItems.map(item => item?.id || '').sort().join(',');
      
      return oldIds !== newIds;
    } catch (error) {
      // If comparison fails for any reason, force an update to be safe
      sieveLogger.warn('Error in shouldUpdate comparison, forcing update', error);
      return true;
    }
  }
  
  cleanup() {
    // Remove all tracked event listeners
    this.eventListeners.forEach((listeners, element) => {
      listeners.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
    });
    
    // Clear the event listeners map
    this.eventListeners.clear();
    
    // Clear refresh timeout if it exists
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    
    // Clear memoization cache
    memoizer.clearAll();
    
    // Clear references
    this.container = null;
    this.itemList = null;
    this.refreshButton = null;
    this.filterInput = null;
    this.items = [];
    this.flippedCardId = null;
    this.itemsBeingDeleted.clear();
  }
}

export default Sieve; 