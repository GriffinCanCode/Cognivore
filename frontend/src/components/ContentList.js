// ContentList component
import ApiService from '../services/ApiService.js';

class ContentList {
  constructor(notificationService) {
    this.notificationService = notificationService;
    this.apiService = new ApiService();
    this.itemList = null;
    this.refreshButton = null;
  }
  
  render() {
    const section = document.createElement('section');
    section.id = 'content-list';
    
    const title = document.createElement('h2');
    title.textContent = 'Stored Content';
    
    this.refreshButton = document.createElement('button');
    this.refreshButton.id = 'refresh-list-btn';
    this.refreshButton.textContent = 'Refresh List';
    this.refreshButton.addEventListener('click', () => this.refreshItems());
    
    this.itemList = document.createElement('ul');
    this.itemList.id = 'item-list';
    
    section.appendChild(title);
    section.appendChild(this.refreshButton);
    section.appendChild(this.itemList);
    
    return section;
  }
  
  initialize() {
    this.refreshItems();
  }
  
  async refreshItems() {
    try {
      const items = await this.apiService.listItems();
      this.displayItems(items);
    } catch (error) {
      this.notificationService.error(`Failed to load items: ${error.message}`);
    }
  }
  
  displayItems(items) {
    this.itemList.innerHTML = '';
    
    if (items.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.textContent = 'No items stored yet.';
      emptyMessage.style.fontStyle = 'italic';
      emptyMessage.style.color = '#999';
      this.itemList.appendChild(emptyMessage);
      return;
    }
    
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'content-list-item';
      
      // Create item container with better styling
      const itemContainer = document.createElement('div');
      itemContainer.className = 'item-container';
      
      // Create title element with badge
      const titleContainer = document.createElement('div');
      titleContainer.className = 'item-title-container';
      
      const titleDiv = document.createElement('div');
      titleDiv.className = 'item-title';
      titleDiv.textContent = item.title;
      
      // Create source type badge
      const typeBadge = document.createElement('span');
      typeBadge.className = 'item-type-badge';
      typeBadge.textContent = item.source_type.toUpperCase();
      typeBadge.style.backgroundColor = this.getSourceColor(item.source_type);
      
      titleContainer.appendChild(titleDiv);
      titleContainer.appendChild(typeBadge);
      
      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'item-button-container';
      
      // Create view button
      const viewButton = document.createElement('button');
      viewButton.className = 'view-button';
      viewButton.textContent = 'View';
      viewButton.addEventListener('click', () => {
        // Dispatch event to view the content
        const selectEvent = new CustomEvent('content:selected', {
          detail: {
            itemId: item.id,
            itemData: {
              id: item.id,
              title: item.title,
              sourceType: item.source_type,
              sourceIdentifier: item.source || 'Unknown',
              textChunk: item.preview || 'No preview available'
            }
          }
        });
        document.dispatchEvent(selectEvent);
      });
      
      // Create delete button
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-button';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent triggering the item selection
        try {
          await this.apiService.deleteItem(item.id);
          this.notificationService.success(`Deleted item: ${item.title}`);
          this.refreshItems(); // Refresh the list
        } catch (error) {
          this.notificationService.error(`Error deleting item: ${error.message}`);
        }
      });
      
      // Add buttons to container
      buttonContainer.appendChild(viewButton);
      buttonContainer.appendChild(deleteButton);
      
      // Add elements to list item
      itemContainer.appendChild(titleContainer);
      itemContainer.appendChild(buttonContainer);
      li.appendChild(itemContainer);
      
      // Add item to list
      this.itemList.appendChild(li);
    });
  }
  
  getSourceColor(sourceType) {
    switch (sourceType.toLowerCase()) {
      case 'pdf': return '#e74c3c';
      case 'url': return '#3498db';
      case 'youtube': return '#e67e22';
      default: return '#95a5a6';
    }
  }
}

export default ContentList; 