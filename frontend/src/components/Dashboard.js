// Dashboard component
import ApiService from '../services/ApiService.js';

class Dashboard {
  constructor(notificationService) {
    this.notificationService = notificationService;
    this.apiService = new ApiService();
    this.container = null;
    this.statsData = {
      totalItems: 0,
      pdfCount: 0,
      urlCount: 0,
      youtubeCount: 0
    };
    this.recentItems = [];
  }
  
  async initialize() {
    try {
      // Fetch data for the dashboard
      await this.fetchStats();
      await this.fetchRecentItems();
      
      // Update the dashboard if it's already rendered
      if (this.container) {
        this.updateStats();
        this.updateRecentItems();
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      this.notificationService.error('Failed to load dashboard data');
    }
  }
  
  async fetchStats() {
    try {
      // Fetch items and calculate stats
      const items = await this.apiService.listItems();
      
      this.statsData.totalItems = items.length;
      this.statsData.pdfCount = items.filter(item => item.sourceType === 'pdf').length;
      this.statsData.urlCount = items.filter(item => item.sourceType === 'url').length;
      this.statsData.youtubeCount = items.filter(item => item.sourceType === 'youtube').length;
      
      return this.statsData;
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }
  
  async fetchRecentItems() {
    try {
      // Fetch items and sort by date
      const items = await this.apiService.listItems();
      
      // Sort by date (newest first) and take the first 6
      this.recentItems = items
        .sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0))
        .slice(0, 6);
      
      return this.recentItems;
    } catch (error) {
      console.error('Error fetching recent items:', error);
      throw error;
    }
  }
  
  updateStats() {
    const statsGrid = this.container.querySelector('.stats-grid');
    
    if (!statsGrid) return;
    
    // Update total items card
    const totalItemsValue = statsGrid.querySelector('#total-items-value');
    if (totalItemsValue) {
      totalItemsValue.textContent = this.statsData.totalItems;
    }
    
    // Update PDF count
    const pdfCountValue = statsGrid.querySelector('#pdf-count-value');
    if (pdfCountValue) {
      pdfCountValue.textContent = this.statsData.pdfCount;
    }
    
    // Update URL count
    const urlCountValue = statsGrid.querySelector('#url-count-value');
    if (urlCountValue) {
      urlCountValue.textContent = this.statsData.urlCount;
    }
    
    // Update YouTube count
    const youtubeCountValue = statsGrid.querySelector('#youtube-count-value');
    if (youtubeCountValue) {
      youtubeCountValue.textContent = this.statsData.youtubeCount;
    }
  }
  
  updateRecentItems() {
    const recentItemsGrid = this.container.querySelector('.recent-items-grid');
    
    if (!recentItemsGrid) return;
    
    // Clear existing items
    recentItemsGrid.innerHTML = '';
    
    if (this.recentItems.length === 0) {
      recentItemsGrid.innerHTML = this.createEmptyState();
      return;
    }
    
    // Add recent items
    this.recentItems.forEach(item => {
      const itemCard = this.createItemCard(item);
      recentItemsGrid.appendChild(itemCard);
    });
  }
  
  createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    const header = document.createElement('div');
    header.className = 'item-card-header';
    
    const title = document.createElement('h4');
    title.className = 'item-title';
    title.textContent = item.title || 'Untitled Content';
    
    const sourceTag = document.createElement('span');
    sourceTag.className = 'item-source-tag';
    sourceTag.textContent = item.sourceType;
    sourceTag.style.backgroundColor = this.getSourceColor(item.sourceType);
    
    header.appendChild(title);
    header.appendChild(sourceTag);
    
    const body = document.createElement('div');
    body.className = 'item-card-body';
    body.textContent = this.truncateText(item.textChunk || 'No content available', 150);
    
    const footer = document.createElement('div');
    footer.className = 'item-card-footer';
    
    const date = document.createElement('div');
    date.className = 'item-date';
    date.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="6" x2="12" y2="12"></line>
        <line x1="12" y1="12" x2="16" y2="14"></line>
      </svg>
      <span>${this.formatDate(item.dateAdded || new Date())}</span>
    `;
    
    footer.appendChild(date);
    
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    
    // Add click handler
    card.addEventListener('click', () => {
      // Dispatch event for content selection
      const selectEvent = new CustomEvent('content:selected', {
        detail: {
          itemId: item.id,
          itemData: item
        }
      });
      document.dispatchEvent(selectEvent);
    });
    
    return card;
  }
  
  createEmptyState() {
    return `
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v8M12 18v4M4.93 10.93l1.41 1.41M17.66 17.66l1.41 1.41M2 18h2M20 18h2M6.34 17.66l-1.41 1.41M19.07 10.93l-1.41 1.41M22 12h-2M4 12H2M12 4c-4.42 0-8 3.58-8 8 0 4.42 3.58 8 8 8 4.42 0 8-3.58 8-8 0-4.42-3.58-8-8-8z"/>
        </svg>
        <h3 class="empty-state-title">No items found</h3>
        <p class="empty-state-text">Start adding content to build your knowledge base.</p>
        <button class="dashboard-action-button" id="add-content-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Content
        </button>
      </div>
    `;
  }
  
  getSourceColor(sourceType) {
    switch (sourceType.toLowerCase()) {
      case 'pdf': return '#e63946';
      case 'url': return '#4d74ff';
      case 'youtube': return '#ff7e36';
      case 'text': return '#2a9d8f';
      default: return '#777777';
    }
  }
  
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return 'Unknown date';
    }
  }
  
  render() {
    const container = document.createElement('section');
    container.id = 'dashboard-container';
    container.className = 'dashboard-container fade-in';
    
    // Dashboard header
    const header = document.createElement('div');
    header.className = 'dashboard-header';
    
    const title = document.createElement('h2');
    title.className = 'dashboard-title';
    title.textContent = 'Knowledge Dashboard';
    
    const actions = document.createElement('div');
    actions.className = 'dashboard-actions';
    
    // Add Content button
    const addContentBtn = document.createElement('button');
    addContentBtn.className = 'dashboard-action-button';
    addContentBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add Content
    `;
    addContentBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('navigation:change', { 
        detail: { section: 'upload' }
      }));
    });
    
    // Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'dashboard-action-button';
    refreshBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 4v6h-6"></path>
        <path d="M1 20v-6h6"></path>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
        <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
      </svg>
      Refresh
    `;
    refreshBtn.addEventListener('click', async () => {
      try {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = `
          <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
          Refreshing...
        `;
        
        await this.initialize();
        
        this.notificationService.success('Dashboard refreshed');
      } catch (error) {
        this.notificationService.error('Failed to refresh dashboard');
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
          </svg>
          Refresh
        `;
      }
    });
    
    actions.appendChild(addContentBtn);
    actions.appendChild(refreshBtn);
    
    header.appendChild(title);
    header.appendChild(actions);
    
    // Stats grid
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';
    
    // Total Items card
    statsGrid.appendChild(this.createStatCard({
      id: 'total-items',
      icon: '<path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 0h-4V4h4v2z"></path>',
      title: 'Total Items',
      value: this.statsData.totalItems,
      footer: 'Knowledge repository size'
    }));
    
    // PDF count card
    statsGrid.appendChild(this.createStatCard({
      id: 'pdf-count',
      icon: '<path d="M8 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm10 18H6V4h7v5h5v11z"></path>',
      title: 'PDF Documents',
      value: this.statsData.pdfCount,
      footer: 'PDF files in repository'
    }));
    
    // URL count card
    statsGrid.appendChild(this.createStatCard({
      id: 'url-count',
      icon: '<path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.71-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"></path>',
      title: 'Web URLs',
      value: this.statsData.urlCount,
      footer: 'Web pages in repository'
    }));
    
    // YouTube count card
    statsGrid.appendChild(this.createStatCard({
      id: 'youtube-count',
      icon: '<path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z"></path>',
      title: 'YouTube Videos',
      value: this.statsData.youtubeCount,
      footer: 'YouTube content in repository'
    }));
    
    // Recent items section
    const recentItemsSection = document.createElement('div');
    recentItemsSection.className = 'recent-items-section';
    
    const recentItemsHeader = document.createElement('div');
    recentItemsHeader.className = 'recent-items-header';
    
    const recentItemsTitle = document.createElement('h3');
    recentItemsTitle.className = 'recent-items-title';
    recentItemsTitle.textContent = 'Recent Content';
    
    const viewAllLink = document.createElement('a');
    viewAllLink.className = 'view-all-link';
    viewAllLink.href = '#';
    viewAllLink.innerHTML = `
      View All
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
    viewAllLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('navigation:change', { 
        detail: { section: 'knowledge' }
      }));
    });
    
    recentItemsHeader.appendChild(recentItemsTitle);
    recentItemsHeader.appendChild(viewAllLink);
    
    const recentItemsGrid = document.createElement('div');
    recentItemsGrid.className = 'recent-items-grid';
    
    // Add empty state or items (will be populated in initialize)
    recentItemsGrid.innerHTML = '<div class="empty-state">Loading items...</div>';
    
    recentItemsSection.appendChild(recentItemsHeader);
    recentItemsSection.appendChild(recentItemsGrid);
    
    // Add all sections to container
    container.appendChild(header);
    container.appendChild(statsGrid);
    container.appendChild(recentItemsSection);
    
    // Save reference to container
    this.container = container;
    
    // Initialize data
    this.initialize();
    
    return container;
  }
  
  createStatCard({ id, icon, title, value, footer }) {
    const card = document.createElement('div');
    card.className = 'stat-card slide-up';
    
    const header = document.createElement('div');
    header.className = 'stat-card-header';
    
    const iconEl = document.createElement('svg');
    iconEl.className = 'stat-card-icon';
    iconEl.setAttribute('viewBox', '0 0 24 24');
    iconEl.setAttribute('fill', 'currentColor');
    iconEl.innerHTML = icon;
    
    const titleEl = document.createElement('h4');
    titleEl.className = 'stat-card-title';
    titleEl.textContent = title;
    
    header.appendChild(iconEl);
    header.appendChild(titleEl);
    
    const valueEl = document.createElement('div');
    valueEl.className = 'stat-card-value';
    valueEl.id = `${id}-value`;
    valueEl.textContent = value;
    
    const footerEl = document.createElement('div');
    footerEl.className = 'stat-card-footer';
    footerEl.textContent = footer;
    
    // Background decoration
    const bgIconEl = document.createElement('svg');
    bgIconEl.className = 'stat-card-bg';
    bgIconEl.setAttribute('viewBox', '0 0 24 24');
    bgIconEl.setAttribute('fill', 'currentColor');
    bgIconEl.innerHTML = icon;
    
    card.appendChild(header);
    card.appendChild(valueEl);
    card.appendChild(footerEl);
    card.appendChild(bgIconEl);
    
    return card;
  }
}

export default Dashboard; 