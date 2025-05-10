// ContentInput component for adding new content
import ApiService from '../services/ApiService.js';

class ContentInput {
  constructor(notificationService) {
    this.notificationService = notificationService;
    this.apiService = new ApiService();
    
    // Initialize input elements
    this.pdfInput = null;
    this.pdfButton = null;
    this.urlInput = null;
    this.urlButton = null;
    this.youtubeInput = null;
    this.youtubeButton = null;
  }
  
  render() {
    const section = document.createElement('section');
    section.id = 'content-input';
    
    const title = document.createElement('h2');
    title.textContent = 'Add Content';
    section.appendChild(title);
    
    // PDF input section
    const pdfSection = this.createInputSection(
      'PDF Document',
      'file',
      'pdf-input',
      '.pdf',
      'Process PDF',
      this.processPDF.bind(this)
    );
    this.pdfInput = pdfSection.querySelector('input');
    this.pdfButton = pdfSection.querySelector('button');
    
    // URL input section
    const urlSection = this.createInputSection(
      'Web URL',
      'url',
      'url-input',
      null,
      'Process URL',
      this.processURL.bind(this)
    );
    this.urlInput = urlSection.querySelector('input');
    this.urlButton = urlSection.querySelector('button');
    urlSection.querySelector('input').placeholder = 'https://example.com';
    
    // YouTube input section
    const youtubeSection = this.createInputSection(
      'YouTube URL',
      'url',
      'youtube-input',
      null,
      'Process YouTube',
      this.processYouTube.bind(this)
    );
    this.youtubeInput = youtubeSection.querySelector('input');
    this.youtubeButton = youtubeSection.querySelector('button');
    youtubeSection.querySelector('input').placeholder = 'https://www.youtube.com/watch?v=...';
    
    // Add all sections to the component
    section.appendChild(pdfSection);
    section.appendChild(urlSection);
    section.appendChild(youtubeSection);
    
    return section;
  }
  
  // Helper method to create input sections
  createInputSection(title, inputType, inputId, accept, buttonText, buttonHandler) {
    const section = document.createElement('div');
    section.className = 'input-section';
    
    const heading = document.createElement('h3');
    heading.textContent = title;
    
    const input = document.createElement('input');
    input.type = inputType;
    input.id = inputId;
    if (accept) input.accept = accept;
    
    const button = document.createElement('button');
    button.textContent = buttonText;
    button.addEventListener('click', buttonHandler);
    
    section.appendChild(heading);
    section.appendChild(input);
    section.appendChild(button);
    
    return section;
  }
  
  // Handle PDF processing
  async processPDF() {
    const file = this.pdfInput.files[0];
    if (!file) {
      this.notificationService.warning('Please select a PDF file');
      return;
    }
    
    try {
      this.notificationService.show('Processing PDF file...');
      await this.apiService.processPDF(file.path);
      this.notificationService.success(`Successfully processed: ${file.name}`);
      this.pdfInput.value = '';
      
      // Notify that content has been updated
      document.dispatchEvent(new Event('content:updated'));
    } catch (error) {
      this.notificationService.error(`Failed to process PDF: ${error.message}`);
    }
  }
  
  // Handle URL processing
  async processURL() {
    const url = this.urlInput.value.trim();
    if (!url) {
      this.notificationService.warning('Please enter a URL');
      return;
    }
    
    try {
      this.notificationService.show('Processing URL...');
      await this.apiService.processURL(url);
      this.notificationService.success(`Successfully processed: ${url}`);
      this.urlInput.value = '';
      
      // Notify that content has been updated
      document.dispatchEvent(new Event('content:updated'));
    } catch (error) {
      this.notificationService.error(`Failed to process URL: ${error.message}`);
    }
  }
  
  // Handle YouTube URL processing
  async processYouTube() {
    const url = this.youtubeInput.value.trim();
    if (!url) {
      this.notificationService.warning('Please enter a YouTube URL');
      return;
    }
    
    try {
      this.notificationService.show('Processing YouTube URL...');
      await this.apiService.processYouTube(url);
      this.notificationService.success(`Successfully processed YouTube video`);
      this.youtubeInput.value = '';
      
      // Notify that content has been updated
      document.dispatchEvent(new Event('content:updated'));
    } catch (error) {
      this.notificationService.error(`Failed to process YouTube URL: ${error.message}`);
    }
  }
}

export default ContentInput; 