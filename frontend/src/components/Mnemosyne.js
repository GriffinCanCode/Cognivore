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
        // Handle document processing events
        mnemosyneLogger.info(`Document event received: ${eventType}`);
      }
    });
    
    // Create the muse container if it doesn't exist yet
    if (!this.museContainer) {
      this.museContainer = document.createElement('div');
      this.museContainer.className = 'mnemosyne-muse-container';
      this.museContainer.id = 'mnemosyne-muse-container';
      
      // Add to the DOM if we have a cards container to append after
      if (this.cardsContainer && this.cardsContainer.parentNode) {
        this.cardsContainer.parentNode.insertBefore(this.museContainer, this.cardsContainer.nextSibling);
        mnemosyneLogger.info('Created and added muse container to DOM');
      }
    }
    
    // Load required scripts for 3D model
    this.loadModelScripts()
      .then(() => {
        // Initialize 3D muse model if container exists
        mnemosyneLogger.info('Model scripts loaded, initializing muse model');
        if (this.museContainer) {
          this.initializeMuse();
        }
      })
      .catch(error => {
        mnemosyneLogger.error('Failed to load model scripts', { error: error.message });
      });
    
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
    
    // Try to initialize again after a short delay in case script loading took longer
    setTimeout(() => {
      if (!this.museModel && this.museContainer) {
        mnemosyneLogger.info('Attempting to initialize muse model again after delay');
        this.initializeMuse();
      }
    }, 2000);
  }
  
  /**
   * Load required scripts for 3D model
   * @returns {Promise} - Resolves when scripts are loaded
   */
  loadModelScripts() {
    return new Promise((resolve, reject) => {
      try {
        // Add Three.js first with specific version
        const threeScript = document.createElement('script');
        threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        
        threeScript.onload = () => {
          // After Three.js loads, load GLTFLoader
          const loaderScript = document.createElement('script');
          loaderScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.min.js';
          document.head.appendChild(loaderScript);
          
          loaderScript.onload = () => {
            // After GLTFLoader loads, load GSAP
            const gsapScript = document.createElement('script');
            gsapScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.11.4/gsap.min.js';
            document.head.appendChild(gsapScript);
            
            gsapScript.onload = () => {
              // After GSAP loads, load muse-loader
              const museLoaderScript = document.createElement('script');
              museLoaderScript.src = './assets/js/muse-loader.js';
              document.head.appendChild(museLoaderScript);
              
              museLoaderScript.onload = () => {
                mnemosyneLogger.info('All model scripts loaded successfully');
                resolve();
              };
              
              museLoaderScript.onerror = (error) => {
                mnemosyneLogger.error('Failed to load muse-loader.js', { error });
                // Continue even if muse-loader fails
                resolve();
              };
            };
            
            gsapScript.onerror = (error) => {
              mnemosyneLogger.error('Failed to load GSAP', { error });
              // Continue even if GSAP fails
              resolve();
            };
          };
          
          loaderScript.onerror = (error) => {
            mnemosyneLogger.error('Failed to load GLTFLoader', { error });
            reject(new Error('Failed to load GLTFLoader'));
          };
        };
        
        threeScript.onerror = (error) => {
          mnemosyneLogger.error('Failed to load Three.js', { error });
          reject(new Error('Failed to load Three.js'));
        };
        
        // Start loading scripts by adding Three.js first
        document.head.appendChild(threeScript);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Initialize 3D Muse model
   */
  initializeMuse() {
    try {
      // Add unique ID to the container for easier reference
      this.museContainer.id = 'mnemosyne-muse-container';
      
      mnemosyneLogger.info('Initializing muse model');
      
      // Create model instance
      this.museModel = new MuseModel(this.museContainer);
      this.museModel.initialize();
      
      // Make muse visible
      this.museContainer.classList.add('active');
      
      // Activate the muse by default
      this.museModel.activate();
      
      mnemosyneLogger.info('Muse model initialized and activated');
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
    
    // Add a slight delay before activating the model to ensure
    // the card has time to center properly first
    setTimeout(() => {
      // Make the muse rise behind the card and hold it
      if (this.museModel) {
        this.museModel.riseAndHoldCard(selectedCard);
      }
    }, 200);
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
    
    // Add file information if available
    if (data.filePath || data.fileSize) {
      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';
      
      const fileTitle = document.createElement('h3');
      fileTitle.textContent = 'File Information';
      fileInfo.appendChild(fileTitle);
      
      const fileDetails = document.createElement('p');
      if (data.fileSize) {
        const fileSizeMB = (data.fileSize / (1024 * 1024)).toFixed(2);
        fileDetails.textContent = `Size: ${fileSizeMB} MB`;
      }
      fileInfo.appendChild(fileDetails);
      
      content.appendChild(fileInfo);
    }
    
    // Add transcript info for YouTube videos
    if (sourceType === 'youtube' && data.hasTranscript) {
      const transcriptInfo = document.createElement('div');
      transcriptInfo.className = 'transcript-info';
      
      const transcriptTitle = document.createElement('h3');
      transcriptTitle.textContent = 'Transcript Information';
      transcriptInfo.appendChild(transcriptTitle);
      
      const transcriptDetails = document.createElement('p');
      transcriptDetails.textContent = 'Full transcript has been saved and will be available when viewing this content.';
      transcriptInfo.appendChild(transcriptDetails);
      
      content.appendChild(transcriptInfo);
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
      
      // Set options to ensure file is saved along with embeddings and summary
      const options = {
        saveFile: true,
        generateEmbedding: true,
        generateSummary: true,
        useLLM: true  // Explicitly enable LLM for summary generation
      };
      
      // Process the PDF with enhanced options
      const result = await this.processor.processPDF(file.path, options);
      
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
      
      // Show success notification
      if (this.notificationService) {
        this.notificationService.success('PDF document processed and stored successfully');
      }
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
      
      // Set options to ensure content is saved along with embeddings and summary
      const options = {
        saveScreenshot: true,
        saveHtml: true,
        generateEmbedding: true,
        generateSummary: true,
        saveMetadata: true,
        useLLM: true  // Explicitly enable LLM for summary generation
      };
      
      // Process the URL with enhanced options
      const result = await this.processor.processURL(url, options);
      
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
      
      // Show success notification
      if (this.notificationService) {
        this.notificationService.success('Web page processed and stored successfully');
      }
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
      
      // Set options to ensure transcript is saved along with embeddings and summary
      const options = {
        saveTranscript: true,
        saveThumbnail: true,
        generateEmbedding: true,
        generateSummary: true,
        saveMetadata: true,
        useLLM: true,  // Explicitly enable LLM for summary generation
        // Explicitly save the YouTube URL for linking back
        youtubeUrl: url,
        // Try to extract and save a thumbnail URL
        extractThumbnail: true
      };
      
      // Process the YouTube URL with enhanced options
      const result = await this.processor.processYouTube(url, options);
      
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
      
      // Show success notification
      if (this.notificationService) {
        this.notificationService.success('YouTube video processed and transcript stored successfully');
      }
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
   * Render the component
   * @returns {HTMLElement} - The rendered component
   */
  render() {
    const container = document.createElement('div');
    container.className = 'mnemosyne-container';
    
    // Create enhanced title section
    const titleSection = document.createElement('div');
    titleSection.className = 'mnemosyne-title-section';
    
    const titleContainer = document.createElement('div');
    titleContainer.className = 'mnemosyne-title-container';
    
    const title = document.createElement('h2');
    title.textContent = 'Mnemosyne';
    title.className = 'mnemosyne-title';
    
    // Add individual letter spans for animation
    const titleText = title.textContent;
    title.textContent = '';
    [...titleText].forEach(letter => {
      const span = document.createElement('span');
      span.className = 'title-letter';
      span.textContent = letter;
      span.setAttribute('data-letter', letter);
      title.appendChild(span);
    });
    
    const subtitle = document.createElement('p');
    subtitle.className = 'mnemosyne-subtitle';
    subtitle.textContent = 'The Keeper of the Knowledge of the World';
    
    // Create decorative elements
    const titleGlow = document.createElement('div');
    titleGlow.className = 'title-glow';
    
    const titleParticles = document.createElement('div');
    titleParticles.className = 'title-particles';
    
    // Create floating particles
    for (let i = 0; i < 12; i++) {
      const particle = document.createElement('div');
      particle.className = 'floating-particle';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 5}s`;
      particle.style.animationDuration = `${3 + Math.random() * 7}s`;
      particle.style.opacity = `${0.1 + Math.random() * 0.5}`;
      particle.style.width = particle.style.height = `${Math.random() * 5 + 2}px`;
      titleContainer.appendChild(particle);
    }
    
    // Add event listeners for interactive effects
    titleContainer.addEventListener('mousemove', (e) => {
      const rect = titleContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      titleGlow.style.background = `radial-gradient(
        circle at ${x}px ${y}px,
        rgba(74, 99, 231, 0.8),
        rgba(148, 96, 255, 0.4) 30%,
        rgba(0, 0, 0, 0) 70%
      )`;
    });
    
    titleContainer.addEventListener('mouseleave', () => {
      titleGlow.style.background = 'none';
    });
    
    // Assemble title section
    titleContainer.appendChild(titleGlow);
    titleContainer.appendChild(titleParticles);
    titleContainer.appendChild(title);
    titleSection.appendChild(titleContainer);
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
    
    // Create 3D muse container
    this.museContainer = document.createElement('div');
    this.museContainer.className = 'mnemosyne-muse-container';
    this.museContainer.id = 'mnemosyne-muse-container';
    
    // Add CSS for the muse container directly (ensures proper styling even before external CSS loads)
    const style = document.createElement('style');
    style.textContent = `
      .mnemosyne-muse-container {
        position: relative;
        width: 100%;
        height: 300px;
        margin-top: 40px;
        z-index: 1;
        opacity: 1; /* Changed from 0 to make it visible by default */
        transition: opacity 0.8s ease;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: rgba(10, 15, 30, 0.1); /* Subtle background to see the container */
        border-radius: 8px;
      }
      
      .mnemosyne-muse-container.active {
        opacity: 1;
      }
      
      .mnemosyne-muse-container.rising canvas {
        animation: glimmer 2s infinite alternate;
      }
      
      @keyframes glimmer {
        0% { filter: brightness(1); }
        100% { filter: brightness(1.3); }
      }
    `;
    document.head.appendChild(style);
    
    // Assemble the component
    container.appendChild(titleSection);
    container.appendChild(this.cardsContainer);
    container.appendChild(this.museContainer);
    
    // Attempt to initialize the muse after rendering
    setTimeout(() => {
      if (this.museContainer && !this.museModel) {
        mnemosyneLogger.info('Delayed initialization of muse model after render');
        this.initializeMuse();
      }
    }, 500);
    
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
    
    // Add button glow effect element
    const buttonGlow = document.createElement('span');
    buttonGlow.className = 'button-glow';
    submitButton.appendChild(buttonGlow);
    
    // Add card particles for enhanced visual effects
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement('div');
      particle.className = 'card-particle';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 5}s`;
      particle.style.animationDuration = `${8 + Math.random() * 7}s`;
      particle.style.opacity = `${0.1 + Math.random() * 0.3}`;
      particle.style.width = particle.style.height = `${Math.random() * 4 + 1}px`;
      card.appendChild(particle);
    }
    
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