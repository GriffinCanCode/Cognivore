// ApiService handles all communication with the backend via Electron IPC
class ApiService {
  constructor() {
    // Check if the API is available from the preload script
    if (!window.api) {
      console.error('API not available. Make sure Electron preload script is working correctly.');
      throw new Error('API not available');
    }
    
    this.api = window.api;
  }

  // List all items from the database
  async listItems() {
    try {
      const response = await this.api.listItems();
      if (!response.success) {
        throw new Error(response.error || 'Failed to list items');
      }
      return response.items || [];
    } catch (error) {
      console.error('Error listing items:', error);
      throw new Error(`Error listing items: ${error.message}`);
    }
  }
  
  // Process a PDF file
  async processPDF(filePath) {
    try {
      const response = await this.api.processPDF(filePath);
      if (!response.success) {
        throw new Error(response.error || 'Failed to process PDF');
      }
      return response;
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw new Error(`Error processing PDF: ${error.message}`);
    }
  }
  
  // Process a URL
  async processURL(url) {
    try {
      const response = await this.api.processURL(url);
      if (!response.success) {
        throw new Error(response.error || 'Failed to process URL');
      }
      return response;
    } catch (error) {
      console.error('Error processing URL:', error);
      throw new Error(`Error processing URL: ${error.message}`);
    }
  }
  
  // Process a YouTube URL
  async processYouTube(url) {
    try {
      const response = await this.api.processYouTube(url);
      if (!response.success) {
        throw new Error(response.error || 'Failed to process YouTube URL');
      }
      return response;
    } catch (error) {
      console.error('Error processing YouTube URL:', error);
      throw new Error(`Error processing YouTube URL: ${error.message}`);
    }
  }
  
  // Delete an item
  async deleteItem(itemId) {
    try {
      const response = await this.api.deleteItem(itemId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete item');
      }
      return response;
    } catch (error) {
      console.error('Error deleting item:', error);
      throw new Error(`Error deleting item: ${error.message}`);
    }
  }
  
  // Search for items
  async search(query, limit = 10) {
    try {
      const response = await this.api.search(query, limit);
      if (!response.success) {
        throw new Error(response.error || 'Search failed');
      }
      return response.results || [];
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search error: ${error.message}`);
    }
  }
}

export default ApiService; 