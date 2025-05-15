// SearchSection component
import ApiService from '../../services/ApiService.js';

class SearchSection {
  constructor(notificationService) {
    this.notificationService = notificationService;
    this.apiService = new ApiService();
    this.searchInput = null;
    this.searchButton = null;
    this.resultsContainer = null;
    this.isSearching = false;
  }
  
  render() {
    const section = document.createElement('section');
    section.id = 'search-section';
    section.classList.add('fade-in');
    
    const title = document.createElement('h2');
    title.textContent = 'Search Your Knowledge';
    
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    
    // Create modern search icon
    const searchIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    searchIcon.classList.add('search-icon');
    searchIcon.setAttribute('viewBox', '0 0 24 24');
    searchIcon.innerHTML = `
      <path d="M21.71 20.29L18 16.61A9 9 0 1 0 16.61 18l3.68 3.68a1 1 0 0 0 1.42 0 1 1 0 0 0 0-1.39zM11 18a7 7 0 1 1 7-7 7 7 0 0 1-7 7z"/>
    `;
    
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.id = 'search-input';
    this.searchInput.placeholder = 'Enter your search query...';
    this.searchInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && !this.isSearching) {
        this.performSearch();
      }
    });
    
    this.searchButton = document.createElement('button');
    this.searchButton.id = 'search-btn';
    this.searchButton.innerHTML = `
      <span>Search</span>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 7l5 5-5 5"></path>
        <path d="M6 7l5 5-5 5" style="opacity: 0.5"></path>
      </svg>
    `;
    this.searchButton.style.display = 'flex';
    this.searchButton.style.alignItems = 'center';
    this.searchButton.style.justifyContent = 'center';
    this.searchButton.style.gap = '8px';
    
    this.searchButton.addEventListener('click', () => {
      if (!this.isSearching) {
        this.performSearch();
      }
    });
    
    searchContainer.appendChild(searchIcon);
    searchContainer.appendChild(this.searchInput);
    searchContainer.appendChild(this.searchButton);
    
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.id = 'search-results';
    
    section.appendChild(title);
    section.appendChild(searchContainer);
    section.appendChild(this.resultsContainer);
    
    // Add decorative background elements
    const bgDecoration = document.createElement('div');
    bgDecoration.className = 'search-bg-decoration';
    bgDecoration.innerHTML = `
      <svg class="search-bg-circle" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(77, 116, 255, 0.1)" stroke-width="10" />
        <circle cx="100" cy="100" r="40" fill="none" stroke="rgba(77, 116, 255, 0.05)" stroke-width="8" />
      </svg>
    `;
    section.appendChild(bgDecoration);
    
    // Add styles for background decoration
    const style = document.createElement('style');
    style.textContent = `
      .search-bg-decoration {
        position: absolute;
        top: 50%;
        right: -50px;
        transform: translateY(-50%);
        z-index: 0;
        opacity: 0.5;
        width: 200px;
        height: 200px;
        pointer-events: none;
      }
      
      .search-bg-circle {
        width: 100%;
        height: 100%;
        filter: drop-shadow(0 0 10px rgba(77, 116, 255, 0.1));
        animation: rotate 20s linear infinite;
      }
      
      @keyframes rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    return section;
  }
  
  async performSearch() {
    const query = this.searchInput.value.trim();
    
    if (!query) {
      this.notificationService.warning('Please enter a search query');
      return;
    }
    
    try {
      // Set searching state
      this.isSearching = true;
      this.searchButton.disabled = true;
      this.searchButton.innerHTML = `
        <svg class="spin" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        Searching...
      `;
      
      // Show loading indicator
      this.showLoadingIndicator();
      
      // Perform search
      const results = await this.apiService.search(query, 15);
      
      // Display results
      this.displaySearchResults(results, query);
    } catch (error) {
      this.notificationService.error(`Search failed: ${error.message}`);
      
      // Show error in results container
      this.resultsContainer.innerHTML = `
        <div class="search-results-empty">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#e63946" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>Search error: ${error.message}</p>
          <p>Please try again or contact support if the problem persists.</p>
        </div>
      `;
    } finally {
      // Reset search state
      this.isSearching = false;
      this.searchButton.disabled = false;
      this.searchButton.innerHTML = `
        <span>Search</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 7l5 5-5 5"></path>
          <path d="M6 7l5 5-5 5" style="opacity: 0.5"></path>
        </svg>
      `;
    }
  }
  
  showLoadingIndicator() {
    this.resultsContainer.innerHTML = `
      <div class="search-loading">
        <div class="search-loading-spinner"></div>
        <div class="search-loading-text">Searching knowledge base...</div>
      </div>
    `;
  }
  
  displaySearchResults(results, query) {
    this.resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
      this.resultsContainer.innerHTML = `
        <div class="search-results-empty">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 15h8M15.5 9l-7 .01"></path>
          </svg>
          <p>No results found for "${query}"</p>
          <p>Try different keywords or check your spelling</p>
        </div>
      `;
      return;
    }
    
    // Create header
    const header = document.createElement('div');
    header.className = 'search-results-header';
    header.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.29 7 12 12 20.71 7"></polyline>
        <line x1="12" y1="22" x2="12" y2="12"></line>
      </svg>
      <strong>Found ${results.length} results for "${query}"</strong>
    `;
    this.resultsContainer.appendChild(header);
    
    // Create result items
    results.forEach(result => {
      const resultItem = document.createElement('div');
      resultItem.className = 'search-result-item';
      
      // Create title with source info
      const titleDiv = document.createElement('div');
      titleDiv.className = 'search-result-title';
      
      const title = document.createElement('span');
      title.textContent = result.title || 'Untitled Content';
      
      const sourceType = document.createElement('span');
      sourceType.className = 'search-result-source';
      
      // Add source type icon
      const icon = this.getSourceIcon(result.sourceType);
      sourceType.innerHTML = icon + result.sourceType.toUpperCase();
      sourceType.style.backgroundColor = this.getSourceColor(result.sourceType);
      
      titleDiv.appendChild(title);
      titleDiv.appendChild(sourceType);
      resultItem.appendChild(titleDiv);
      
      // Create text snippet
      const textDiv = document.createElement('div');
      textDiv.className = 'search-result-text';
      textDiv.textContent = result.textChunk || 'No preview available';
      resultItem.appendChild(textDiv);
      
      // Add visual indicator for clickable items
      const actionDiv = document.createElement('div');
      actionDiv.className = 'search-result-action';
      actionDiv.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        <span>View Content</span>
      `;
      resultItem.appendChild(actionDiv);
      
      // Add styles for action div
      const style = document.createElement('style');
      style.textContent = `
        .search-result-action {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 5px;
          color: #4d74ff;
          font-size: 0.8rem;
          font-weight: 500;
          opacity: 0;
          transform: translateX(-10px);
          transition: all 0.3s ease;
        }
        
        .search-result-item:hover .search-result-action {
          opacity: 1;
          transform: translateX(0);
        }
      `;
      document.head.appendChild(style);
      
      // Add click handler to view the full content
      resultItem.addEventListener('click', () => {
        // Dispatch event for App to handle
        const selectEvent = new CustomEvent('content:selected', {
          detail: {
            itemId: result.id,
            itemData: result
          }
        });
        document.dispatchEvent(selectEvent);
      });
      
      this.resultsContainer.appendChild(resultItem);
    });
  }
  
  getSourceIcon(sourceType) {
    switch (sourceType.toLowerCase()) {
      case 'pdf':
        return `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="9" y1="15" x2="15" y2="15"></line>
          <line x1="9" y1="12" x2="15" y2="12"></line>
          <line x1="9" y1="18" x2="12" y2="18"></line>
        </svg>`;
      case 'url':
        return `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>`;
      case 'youtube':
        return `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
        </svg>`;
      case 'text':
        return `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
          <polyline points="4 7 4 4 20 4 20 7"></polyline>
          <line x1="9" y1="20" x2="15" y2="20"></line>
          <line x1="12" y1="4" x2="12" y2="20"></line>
        </svg>`;
      default:
        return `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>`;
    }
  }
  
  getSourceColor(sourceType) {
    if (!sourceType) return '#777777';
    
    switch (sourceType.toLowerCase()) {
      case 'pdf': return '#e63946';
      case 'url': return '#4d74ff';
      case 'youtube': return '#ff7e36';
      case 'text': return '#2a9d8f';
      default: return '#777777';
    }
  }
}

export default SearchSection; 