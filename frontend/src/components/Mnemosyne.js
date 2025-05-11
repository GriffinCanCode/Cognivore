/**
 * Mnemosyne Component
 * A visual component representing document processing workflow
 * Displays three cards for docs, links, and videos
 */
import ApiService from '../services/ApiService.js';
import DocProcessor from '../services/DocProcessorService.js';
import logger from '../utils/logger.js';
import MuseModel from '../utils/MuseModel.js';

// Create scope-specific logger
const mnemosyneLogger = logger.scope('MnemosyneComponent');

class Mnemosyne {
  constructor(notificationService) {
    this.notificationService = notificationService;
    this.processor = new DocProcessor(notificationService);
    this.apiService = new ApiService();
    
    // Input elements
    this.pdfInput = null;
    this.urlInput = null;
    this.youtubeInput = null;
    
    // Card elements
    this.cardElements = [];
    this.activeCard = null;
    this.cardsContainer = null;
    
    // Content list element
    this.contentListElement = null;
    
    // 3D Muse model
    this.museModel = null;
    this.museContainer = null;
    
    // Processing state
    this.isProcessing = false;
    this.processingOverlay = null;
    this.summaryContainer = null;
    
    // Bind methods
    this.processPDF = this.processPDF.bind(this);
    this.processURL = this.processURL.bind(this);
    this.processYouTube = this.processYouTube.bind(this);
    this.refreshItems = this.refreshItems.bind(this);
    this.handleItemSelected = this.handleItemSelected.bind(this);
    this.handleItemDeleted = this.handleItemDeleted.bind(this);
    this.handleCardSelection = this.handleCardSelection.bind(this);
    this.resetCardSelection = this.resetCardSelection.bind(this);
    this.showProcessingOverlay = this.showProcessingOverlay.bind(this);
    this.hideProcessingOverlay = this.hideProcessingOverlay.bind(this);
    this.showSummary = this.showSummary.bind(this);
    this.hideSummary = this.hideSummary.bind(this);
    
    mnemosyneLogger.info('Initializing Mnemosyne component');
  }
  
  /**
   * Initialize component
   */
  initialize() {
    // Listen for document events
    this.processor.addDocumentListener((eventType, data) => {
      if (['pdf:processed', 'url:processed', 'youtube:processed', 'document:deleted'].includes(eventType)) {
        this.refreshItems();
      }
    });
    
    // Initialize 3D muse model if container exists
    if (this.museContainer) {
      this.initializeMuse();
    }
    
    // Add click event listeners to cards for selection
    if (this.cardElements.length > 0) {
      this.cardElements.forEach(card => {
        card.addEventListener('click', (e) => {
          // Don't trigger card selection when clicking input or button
          if (
            e.target.tagName !== 'INPUT' && 
            e.target.tagName !== 'BUTTON' && 
            !e.target.closest('button') &&
            !e.target.closest('input')
          ) {
            this.handleCardSelection(card);
          }
        });
      });
    }
    
    // Refresh content list
    this.refreshItems();
  }
  
  /**
   * Initialize 3D Muse model
   */
  initializeMuse() {
    try {
      this.museModel = new MuseModel(this.museContainer);
      this.museModel.initialize();
      
      // Make muse visible
      this.museContainer.classList.add('active');
    } catch (error) {
      mnemosyneLogger.error('Failed to initialize 3D Muse', { error: error.message });
    }
  }
  
  /**
   * Handle card selection
   * @param {HTMLElement} selectedCard - The selected card
   */
  handleCardSelection(selectedCard) {
    // If the card is already selected, reset the selection
    if (selectedCard === this.activeCard) {
      this.resetCardSelection();
      return;
    }
    
    // Set the active card
    this.activeCard = selectedCard;
    
    // Add selection-active class to cards container
    if (this.cardsContainer) {
      this.cardsContainer.classList.add('selection-active');
    }
    
    // Center the selected card
    this.centerSelectedCard(selectedCard);
    
    // Make the muse rise behind the card and hold it
    if (this.museModel) {
      this.museModel.riseAndHoldCard(selectedCard);
    }
  }
  
  /**
   * Center the selected card and handle animations
   * @param {HTMLElement} selectedCard - The card to center
   */
  centerSelectedCard(selectedCard) {
    // Add selected class to the active card and not-selected to others
    this.cardElements.forEach(card => {
      if (card === selectedCard) {
        card.classList.add('selected');
        // Add centered class for positioning
        card.classList.add('card-centered');
      } else {
        card.classList.add('not-selected');
        // Remove centered class if it exists
        card.classList.remove('card-centered');
      }
    });
    
    // Determine which position the card is in
    const cardIndex = this.cardElements.indexOf(selectedCard);
    
    // Apply specific classes based on position
    if (cardIndex === 0) {
      // Left card, needs to move right
      selectedCard.classList.add('center-from-left');
    } else if (cardIndex === 2) {
      // Right card, needs to move left
      selectedCard.classList.add('center-from-right');
    } else {
      // Center card stays in place
      selectedCard.classList.add('center-stays');
    }
  }
  
  /**
   * Reset card selection
   */
  resetCardSelection() {
    if (!this.activeCard) return;
    
    this.activeCard = null;
    
    // Remove selection-active class from cards container
    if (this.cardsContainer) {
      this.cardsContainer.classList.remove('selection-active');
    }
    
    // Remove selection and positioning classes from all cards
    this.cardElements.forEach(card => {
      card.classList.remove('selected', 'not-selected', 'card-centered', 
                          'center-from-left', 'center-from-right', 'center-stays');
    });
    
    // Reset muse position
    if (this.museModel) {
      this.museModel.resetPosition();
      this.museModel.deactivate();
    }
    
    // Hide any processing overlay or summary
    this.hideProcessingOverlay();
    this.hideSummary();
  }
  
  /**
   * Handle file selection change
   * @param {Event} event - Change event
   */
  handleFileSelected(event) {
    const fileInput = event.target;
    const fileNameElement = fileInput.parentElement.querySelector('.file-name');
    
    if (fileInput.files.length > 0) {
      fileNameElement.textContent = fileInput.files[0].name;
      fileNameElement.style.display = 'block';
    } else {
      fileNameElement.textContent = '';
      fileNameElement.style.display = 'none';
    }
  }
  
  /**
   * Show processing overlay with animation
   * @param {string} processingType - Type of processing being done
   */
  showProcessingOverlay(processingType) {
    // Create overlay if it doesn't exist
    if (!this.processingOverlay) {
      this.processingOverlay = document.createElement('div');
      this.processingOverlay.className = 'mnemosyne-processing-overlay';
      
      const processingContent = document.createElement('div');
      processingContent.className = 'processing-content';
      
      const processingIcon = document.createElement('div');
      processingIcon.className = 'processing-icon';
      
      const processingText = document.createElement('div');
      processingText.className = 'processing-text';
      
      const processingStatus = document.createElement('div');
      processingStatus.className = 'processing-status';
      processingStatus.textContent = 'Processing content...';
      
      processingContent.appendChild(processingIcon);
      processingContent.appendChild(processingText);
      processingContent.appendChild(processingStatus);
      this.processingOverlay.appendChild(processingContent);
      
      // Add to document body
      document.body.appendChild(this.processingOverlay);
    }
    
    // Set processing type text
    const textElement = this.processingOverlay.querySelector('.processing-text');
    textElement.textContent = processingType || 'Processing Content';
    
    // Show overlay with animation
    this.processingOverlay.style.display = 'flex';
    setTimeout(() => {
      this.processingOverlay.classList.add('active');
      
      // Activate muse animation if not already rising/holding
      if (this.museModel && !this.museModel.isRising && !this.museModel.isHolding) {
        this.museModel.activate();
      }
    }, 10);
    
    this.isProcessing = true;
  }
  
  /**
   * Hide processing overlay
   */
  hideProcessingOverlay() {
    if (this.processingOverlay) {
      this.processingOverlay.classList.remove('active');
      
      // Wait for animation to complete before hiding
      setTimeout(() => {
        this.processingOverlay.style.display = 'none';
      }, 500);
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Show content summary after processing
   * @param {Object} data - Summary data from the backend
   * @param {string} sourceType - Type of content (pdf, url, youtube)
   */
  showSummary(data, sourceType) {
    // Create summary container if it doesn't exist
    if (!this.summaryContainer) {
      this.summaryContainer = document.createElement('div');
      this.summaryContainer.className = 'mnemosyne-summary-container';
      
      document.body.appendChild(this.summaryContainer);
    }
    
    // Clear existing content
    this.summaryContainer.innerHTML = '';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'summary-header';
    
    const title = document.createElement('h2');
    title.textContent = data.title || 'Content Summary';
    
    const typeBadge = document.createElement('span');
    typeBadge.className = 'summary-type-badge';
    typeBadge.textContent = (sourceType || 'Content').toUpperCase();
    typeBadge.setAttribute('data-type', sourceType || 'content');
    
    header.appendChild(title);
    header.appendChild(typeBadge);
    
    // Create summary content
    const content = document.createElement('div');
    content.className = 'summary-content';
    
    if (data.summary) {
      const summaryText = document.createElement('p');
      summaryText.className = 'summary-text';
      summaryText.textContent = data.summary;
      content.appendChild(summaryText);
    }
    
    if (data.keyPoints && data.keyPoints.length) {
      const keyPointsTitle = document.createElement('h3');
      keyPointsTitle.textContent = 'Key Points';
      content.appendChild(keyPointsTitle);
      
      const keyPointsList = document.createElement('ul');
      keyPointsList.className = 'key-points-list';
      
      data.keyPoints.forEach(point => {
        const listItem = document.createElement('li');
        listItem.textContent = point;
        keyPointsList.appendChild(listItem);
      });
      
      content.appendChild(keyPointsList);
    }
    
    // Create actions
    const actions = document.createElement('div');
    actions.className = 'summary-actions';
    
    const saveButton = document.createElement('button');
    saveButton.className = 'summary-save-btn';
    saveButton.textContent = 'Save Content';
    saveButton.addEventListener('click', () => {
      // Dispatch event to save the content
      const saveEvent = new CustomEvent('content:save', {
        detail: {
          data: data
        }
      });
      document.dispatchEvent(saveEvent);
      
      // Hide summary and reset
      this.hideSummary();
      this.resetCardSelection();
      
      // Show notification
      if (this.notificationService) {
        this.notificationService.success('Content saved successfully');
      }
      
      // Refresh items list
      this.refreshItems();
    });
    
    const closeButton = document.createElement('button');
    closeButton.className = 'summary-close-btn';
    closeButton.textContent = 'Cancel';
    closeButton.addEventListener('click', () => {
      this.hideSummary();
      this.resetCardSelection();
    });
    
    actions.appendChild(saveButton);
    actions.appendChild(closeButton);
    
    // Assemble summary
    this.summaryContainer.appendChild(header);
    this.summaryContainer.appendChild(content);
    this.summaryContainer.appendChild(actions);
    
    // Show with animation
    this.summaryContainer.style.display = 'block';
    setTimeout(() => {
      this.summaryContainer.classList.add('active');
    }, 10);
  }
  
  /**
   * Hide summary
   */
  hideSummary() {
    if (this.summaryContainer) {
      this.summaryContainer.classList.remove('active');
      
      // Wait for animation to complete before hiding
      setTimeout(() => {
        this.summaryContainer.style.display = 'none';
      }, 500);
    }
  }
  
  /**
   * Process PDF document
   */
  async processPDF() {
    const file = this.pdfInput.files[0];
    if (!file) {
      if (this.notificationService) {
        this.notificationService.warning('Please select a PDF file');
      }
      return;
    }
    
    try {
      // Show processing overlay
      this.showProcessingOverlay('Processing PDF Document');
      
      // Process the PDF
      const result = await this.processor.processPDF(file.path);
      
      // Hide processing overlay
      this.hideProcessingOverlay();
      
      // Show summary if available
      if (result && result.summary) {
        this.showSummary(result, 'pdf');
      } else {
        // Reset card selection if no summary
        this.resetCardSelection();
      }
      
      // Clear the input
      this.pdfInput.value = '';
      const fileNameElement = this.pdfInput.parentElement.querySelector('.file-name');
      fileNameElement.textContent = '';
      fileNameElement.style.display = 'none';
    } catch (error) {
      // Hide processing overlay
      this.hideProcessingOverlay();
      
      // Reset card selection
      this.resetCardSelection();
      
      mnemosyneLogger.error('Error processing PDF', { error: error.message });
      
      if (this.notificationService) {
        this.notificationService.error(`Error processing PDF: ${error.message}`);
      }
    }
  }
  
  /**
   * Process web URL
   */
  async processURL() {
    const url = this.urlInput.value.trim();
    if (!url) {
      if (this.notificationService) {
        this.notificationService.warning('Please enter a URL');
      }
      return;
    }
    
    try {
      // Show processing overlay
      this.showProcessingOverlay('Processing Web Page');
      
      // Process the URL
      const result = await this.processor.processURL(url);
      
      // Hide processing overlay
      this.hideProcessingOverlay();
      
      // Show summary if available
      if (result && result.summary) {
        this.showSummary(result, 'url');
      } else {
        // Reset card selection if no summary
        this.resetCardSelection();
      }
      
      // Clear the input
      this.urlInput.value = '';
    } catch (error) {
      // Hide processing overlay
      this.hideProcessingOverlay();
      
      // Reset card selection
      this.resetCardSelection();
      
      mnemosyneLogger.error('Error processing URL', { error: error.message });
      
      if (this.notificationService) {
        this.notificationService.error(`Error processing URL: ${error.message}`);
      }
    }
  }
  
  /**
   * Process YouTube URL
   */
  async processYouTube() {
    const url = this.youtubeInput.value.trim();
    if (!url) {
      if (this.notificationService) {
        this.notificationService.warning('Please enter a YouTube URL');
      }
      return;
    }
    
    try {
      // Show processing overlay
      this.showProcessingOverlay('Processing YouTube Video');
      
      // Process the YouTube URL
      const result = await this.processor.processYouTube(url);
      
      // Hide processing overlay
      this.hideProcessingOverlay();
      
      // Show summary if available
      if (result && result.summary) {
        this.showSummary(result, 'youtube');
      } else {
        // Reset card selection if no summary
        this.resetCardSelection();
      }
      
      // Clear the input
      this.youtubeInput.value = '';
    } catch (error) {
      // Hide processing overlay
      this.hideProcessingOverlay();
      
      // Reset card selection
      this.resetCardSelection();
      
      mnemosyneLogger.error('Error processing YouTube URL', { error: error.message });
      
      if (this.notificationService) {
        this.notificationService.error(`Error processing YouTube URL: ${error.message}`);
      }
    }
  }
  
  /**
   * Refresh the list of stored content
   */
  async refreshItems() {
    try {
      mnemosyneLogger.info('Refreshing content list');
      const items = await this.processor.getDocumentList();
      this.displayItems(items);
    } catch (error) {
      mnemosyneLogger.error('Failed to refresh items', { error: error.message });
    }
  }
  
  /**
   * Display items in the content list
   * @param {Array} items - List of content items
   */
  displayItems(items) {
    if (!this.contentListElement) return;
    
    this.contentListElement.innerHTML = '';
    
    if (!items || items.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'mnemosyne-empty-message';
      emptyMessage.textContent = 'No content stored yet.';
      this.contentListElement.appendChild(emptyMessage);
      return;
    }
    
    items.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'mnemosyne-item';
      
      // Create item header
      const itemHeader = document.createElement('div');
      itemHeader.className = 'mnemosyne-item-header';
      
      // Add type badge
      const typeBadge = document.createElement('span');
      typeBadge.className = 'mnemosyne-item-badge';
      typeBadge.textContent = item.source_type.toUpperCase();
      typeBadge.setAttribute('data-type', item.source_type.toLowerCase());
      
      // Add title
      const titleElement = document.createElement('h3');
      titleElement.className = 'mnemosyne-item-title';
      titleElement.textContent = item.title;
      
      itemHeader.appendChild(typeBadge);
      itemHeader.appendChild(titleElement);
      
      // Create item preview
      const previewElement = document.createElement('div');
      previewElement.className = 'mnemosyne-item-preview';
      previewElement.textContent = item.preview || 'No preview available';
      
      // Create item actions
      const actionsElement = document.createElement('div');
      actionsElement.className = 'mnemosyne-item-actions';
      
      // View button
      const viewButton = document.createElement('button');
      viewButton.className = 'mnemosyne-view-btn';
      viewButton.textContent = 'View';
      viewButton.addEventListener('click', () => this.handleItemSelected(item));
      
      // Delete button
      const deleteButton = document.createElement('button');
      deleteButton.className = 'mnemosyne-delete-btn';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => this.handleItemDeleted(item.id));
      
      // Add buttons to actions
      actionsElement.appendChild(viewButton);
      actionsElement.appendChild(deleteButton);
      
      // Assemble the item
      itemElement.appendChild(itemHeader);
      itemElement.appendChild(previewElement);
      itemElement.appendChild(actionsElement);
      
      // Add to list
      this.contentListElement.appendChild(itemElement);
    });
  }
  
  /**
   * Handle item selection
   * @param {Object} item - Selected item data
   */
  handleItemSelected(item) {
    mnemosyneLogger.info('Item selected', { id: item.id });
    
    // Create item data for the viewer
    const itemData = {
      id: item.id,
      title: item.title,
      sourceType: item.source_type,
      sourceIdentifier: item.source_identifier || 'Unknown',
      textChunk: item.preview || 'No preview available'
    };
    
    // Dispatch selection event
    const selectEvent = new CustomEvent('content:selected', {
      detail: {
        itemId: item.id,
        itemData: itemData
      }
    });
    document.dispatchEvent(selectEvent);
  }
  
  /**
   * Handle item deletion
   * @param {string} itemId - ID of the item to delete
   */
  async handleItemDeleted(itemId) {
    try {
      mnemosyneLogger.info('Deleting item', { id: itemId });
      await this.processor.deleteDocument(itemId);
    } catch (error) {
      mnemosyneLogger.error('Failed to delete item', { id: itemId, error: error.message });
    }
  }
  
  /**
   * Render the component
   * @returns {HTMLElement} - The rendered component
   */
  render() {
    const container = document.createElement('div');
    container.className = 'mnemosyne-container';
    
    // Create title section
    const titleSection = document.createElement('div');
    titleSection.className = 'mnemosyne-title-section';
    
    const title = document.createElement('h2');
    title.textContent = 'Mnemosyne - Knowledge Processing';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'mnemosyne-subtitle';
    subtitle.textContent = 'Greek goddess of memory and mother of the Muses';
    
    titleSection.appendChild(title);
    titleSection.appendChild(subtitle);
    
    // Create cards container
    this.cardsContainer = document.createElement('div');
    this.cardsContainer.className = 'mnemosyne-cards';
    
    // Create PDF card
    const pdfCard = this.createCardElement(
      'document',
      'PDF Documents',
      'Upload and process PDF files to extract knowledge',
      'file',
      'Choose PDF File',
      '.pdf',
      'Process Document',
      this.processPDF
    );
    this.pdfInput = pdfCard.querySelector('input');
    this.cardElements.push(pdfCard);
    
    // Create URL card
    const urlCard = this.createCardElement(
      'link',
      'Web Pages',
      'Process web pages to extract their content',
      'text',
      'Enter URL',
      null,
      'Process Web Page',
      this.processURL
    );
    this.urlInput = urlCard.querySelector('input');
    this.urlInput.placeholder = 'https://example.com';
    this.cardElements.push(urlCard);
    
    // Create YouTube card
    const youtubeCard = this.createCardElement(
      'video',
      'YouTube Videos',
      'Process YouTube videos to extract their content',
      'text',
      'Enter YouTube URL',
      null,
      'Process Video',
      this.processYouTube
    );
    this.youtubeInput = youtubeCard.querySelector('input');
    this.youtubeInput.placeholder = 'https://www.youtube.com/watch?v=...';
    this.cardElements.push(youtubeCard);
    
    // Add cards to container
    this.cardsContainer.appendChild(pdfCard);
    this.cardsContainer.appendChild(urlCard);
    this.cardsContainer.appendChild(youtubeCard);
    
    // Create content list section
    const contentSection = document.createElement('div');
    contentSection.className = 'mnemosyne-content-section';
    
    const contentHeader = document.createElement('div');
    contentHeader.className = 'mnemosyne-content-header';
    
    const contentTitle = document.createElement('h2');
    contentTitle.textContent = 'Stored Knowledge';
    
    const refreshButton = document.createElement('button');
    refreshButton.className = 'mnemosyne-refresh-btn';
    refreshButton.textContent = 'Refresh List';
    refreshButton.addEventListener('click', this.refreshItems);
    
    contentHeader.appendChild(contentTitle);
    contentHeader.appendChild(refreshButton);
    
    // Create content list
    this.contentListElement = document.createElement('div');
    this.contentListElement.className = 'mnemosyne-content-list';
    
    // Add content elements to section
    contentSection.appendChild(contentHeader);
    contentSection.appendChild(this.contentListElement);
    
    // Create 3D muse container
    this.museContainer = document.createElement('div');
    this.museContainer.className = 'mnemosyne-muse-container';
    
    // Assemble the component
    container.appendChild(titleSection);
    container.appendChild(this.cardsContainer);
    container.appendChild(contentSection);
    container.appendChild(this.museContainer);
    
    return container;
  }
  
  /**
   * Create a card element
   * @param {string} type - Card type identifier
   * @param {string} title - Card title
   * @param {string} description - Card description
   * @param {string} inputType - Input field type
   * @param {string} inputLabel - Input field label
   * @param {string|null} accept - Accepted file types
   * @param {string} buttonText - Submit button text
   * @param {Function} submitHandler - Submit button handler
   * @returns {HTMLElement} - Card element
   */
  createCardElement(type, title, description, inputType, inputLabel, accept, buttonText, submitHandler) {
    const card = document.createElement('div');
    card.className = 'mnemosyne-card';
    card.setAttribute('data-type', type);
    
    // Card header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'mnemosyne-card-header';
    
    const cardTitle = document.createElement('h3');
    cardTitle.textContent = title;
    
    const cardIcon = document.createElement('div');
    cardIcon.className = 'mnemosyne-card-icon';
    cardIcon.setAttribute('data-icon', type);
    
    cardHeader.appendChild(cardIcon);
    cardHeader.appendChild(cardTitle);
    
    // Card body
    const cardBody = document.createElement('div');
    cardBody.className = 'mnemosyne-card-body';
    
    const cardDescription = document.createElement('p');
    cardDescription.textContent = description;
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'mnemosyne-input-group';
    
    const inputLabelElement = document.createElement('label');
    inputLabelElement.textContent = inputLabel;
    
    const inputElement = document.createElement('input');
    inputElement.type = inputType;
    if (accept) inputElement.accept = accept;
    
    // For file input, add file name display
    if (inputType === 'file') {
      inputElement.addEventListener('change', this.handleFileSelected);
      
      const fileName = document.createElement('span');
      fileName.className = 'file-name';
      fileName.style.display = 'none';
      
      inputGroup.appendChild(inputLabelElement);
      inputGroup.appendChild(inputElement);
      inputGroup.appendChild(fileName);
    } else {
      inputGroup.appendChild(inputLabelElement);
      inputGroup.appendChild(inputElement);
    }
    
    // Submit button
    const submitButton = document.createElement('button');
    submitButton.className = 'mnemosyne-submit-btn';
    submitButton.textContent = buttonText;
    submitButton.addEventListener('click', submitHandler);
    
    // Assemble card
    cardBody.appendChild(cardDescription);
    cardBody.appendChild(inputGroup);
    cardBody.appendChild(submitButton);
    
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    
    return card;
  }
}

export default Mnemosyne; 