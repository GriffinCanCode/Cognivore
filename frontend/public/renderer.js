// This script runs in the renderer process and manages the UI

// DOM Element References
const pdfInput = document.getElementById('pdf-input');
const pdfButton = document.getElementById('process-pdf-btn');
const urlInput = document.getElementById('url-input');
const urlButton = document.getElementById('process-url-btn');
const youtubeInput = document.getElementById('youtube-input');
const youtubeButton = document.getElementById('process-youtube-btn');
const refreshButton = document.getElementById('refresh-list-btn');
const itemList = document.getElementById('item-list');

// Search elements
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');

// Content viewer elements
const contentViewer = document.getElementById('content-viewer');
const contentMetadata = document.querySelector('.content-metadata');
const contentText = document.querySelector('.content-text');

// Status display helper
function showStatus(message, isError = false) {
  const statusElement = document.createElement('div');
  statusElement.textContent = message;
  statusElement.className = `status ${isError ? 'error' : 'success'}`;
  statusElement.style.padding = '10px';
  statusElement.style.margin = '10px 0';
  statusElement.style.backgroundColor = isError ? '#ffecec' : '#e8f5e9';
  statusElement.style.border = `1px solid ${isError ? '#f8d7da' : '#c8e6c9'}`;
  statusElement.style.borderRadius = '4px';
  
  // Find status container or create one
  let statusContainer = document.querySelector('.status-container');
  if (!statusContainer) {
    statusContainer = document.createElement('div');
    statusContainer.className = 'status-container';
    document.querySelector('#app').prepend(statusContainer);
  }
  
  // Add new status at the top
  statusContainer.prepend(statusElement);
  
  // Remove status after 5 seconds
  setTimeout(() => {
    statusElement.remove();
    // Remove container if empty
    if (statusContainer.children.length === 0) {
      statusContainer.remove();
    }
  }, 5000);
}

// Display list of items from the database
async function displayItems() {
  try {
    const response = await window.api.listItems();
    const items = response.success ? response.items : [];
    itemList.innerHTML = '';
    
    if (items.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.textContent = 'No items stored yet.';
      emptyMessage.style.fontStyle = 'italic';
      emptyMessage.style.color = '#999';
      itemList.appendChild(emptyMessage);
      return;
    }
    
    items.forEach(item => {
      const li = document.createElement('li');
      
      // Create title element
      const titleDiv = document.createElement('div');
      titleDiv.textContent = item.title;
      titleDiv.style.fontWeight = 'bold';
      
      // Create source type badge
      const typeBadge = document.createElement('span');
      typeBadge.textContent = item.source_type.toUpperCase();
      typeBadge.style.backgroundColor = getSourceColor(item.source_type);
      typeBadge.style.color = 'white';
      typeBadge.style.padding = '3px 8px';
      typeBadge.style.borderRadius = '12px';
      typeBadge.style.fontSize = '0.8rem';
      typeBadge.style.marginLeft = '10px';
      
      // Combine title and badge
      titleDiv.appendChild(typeBadge);
      
      // Create delete button
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.style.backgroundColor = '#e74c3c';
      
      // Handle delete
      deleteButton.addEventListener('click', async () => {
        try {
          await window.api.deleteItem(item.id);
          showStatus(`Deleted item: ${item.title}`);
          displayItems(); // Refresh the list
        } catch (error) {
          showStatus(`Error deleting item: ${error.message}`, true);
        }
      });
      
      // Add elements to list item
      li.appendChild(titleDiv);
      li.appendChild(deleteButton);
      itemList.appendChild(li);
    });
  } catch (error) {
    showStatus(`Failed to load items: ${error.message}`, true);
  }
}

// Perform a search with the current query
async function performSearch() {
  const query = searchInput.value.trim();
  
  if (!query) {
    showStatus('Please enter a search query', true);
    return;
  }
  
  try {
    showStatus(`Searching for: ${query}...`);
    searchResults.innerHTML = '<p>Searching...</p>';
    
    const response = await window.api.search(query, 10);
    
    if (!response.success) {
      throw new Error(response.error || 'Unknown error occurred');
    }
    
    const results = response.results || [];
    
    // Display results
    displaySearchResults(results, query);
  } catch (error) {
    showStatus(`Search failed: ${error.message}`, true);
    searchResults.innerHTML = `<p style="padding: 15px; color: #e74c3c;">Search error: ${error.message}</p>`;
  }
}

// Display search results in the UI
function displaySearchResults(results, query) {
  searchResults.innerHTML = '';
  
  if (results.length === 0) {
    searchResults.innerHTML = '<p style="padding: 15px; font-style: italic;">No results found for your query.</p>';
    return;
  }
  
  // Create header
  const header = document.createElement('div');
  header.style.padding = '10px 15px';
  header.style.borderBottom = '1px solid #eee';
  header.style.backgroundColor = '#f9f9f9';
  header.innerHTML = `<strong>Found ${results.length} results for "${query}"</strong>`;
  searchResults.appendChild(header);
  
  // Create result items
  results.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    
    // Create title with source info
    const titleDiv = document.createElement('div');
    titleDiv.className = 'search-result-title';
    
    const title = document.createElement('span');
    title.textContent = result.title;
    
    const sourceType = document.createElement('span');
    sourceType.className = 'search-result-source';
    sourceType.textContent = result.sourceType.toUpperCase();
    sourceType.style.backgroundColor = getSourceColor(result.sourceType);
    sourceType.style.color = 'white';
    sourceType.style.padding = '2px 6px';
    sourceType.style.borderRadius = '10px';
    sourceType.style.fontSize = '0.7rem';
    
    titleDiv.appendChild(title);
    titleDiv.appendChild(sourceType);
    resultItem.appendChild(titleDiv);
    
    // Create text snippet
    const textDiv = document.createElement('div');
    textDiv.className = 'search-result-text';
    textDiv.textContent = result.textChunk;
    resultItem.appendChild(textDiv);
    
    // Add click handler to view the full content
    resultItem.addEventListener('click', () => {
      viewItem(result.id, result);
    });
    
    searchResults.appendChild(resultItem);
  });
}

// View the full content of an item
async function viewItem(itemId, preloadedData = null) {
  try {
    // In a real implementation, we would fetch the full content by ID
    // For now, we'll just use the preloaded data from search results
    if (!preloadedData) {
      showStatus('Full content viewing not implemented yet.');
      return;
    }
    
    // Display content viewer
    contentViewer.style.display = 'block';
    
    // Populate metadata section
    contentMetadata.innerHTML = `
      <h3>${preloadedData.title}</h3>
      <div>
        <p><strong>Source Type:</strong> ${preloadedData.sourceType}</p>
        <p><strong>Source:</strong> ${preloadedData.sourceIdentifier}</p>
      </div>
    `;
    
    // Populate text section
    contentText.textContent = preloadedData.textChunk;
    
    // Scroll to content viewer
    contentViewer.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    showStatus(`Error viewing item: ${error.message}`, true);
  }
}

// Helper to get color based on source type
function getSourceColor(sourceType) {
  if (!sourceType) return '#95a5a6';
  
  switch (sourceType.toLowerCase()) {
    case 'pdf': return '#e74c3c';
    case 'url': return '#3498db';
    case 'youtube': return '#e67e22';
    default: return '#95a5a6';
  }
}

// Process PDF file
pdfButton.addEventListener('click', async () => {
  const file = pdfInput.files[0];
  if (!file) {
    showStatus('Please select a PDF file', true);
    return;
  }
  
  try {
    showStatus('Processing PDF file...');
    await window.api.processPDF(file.path);
    showStatus(`Successfully processed: ${file.name}`);
    pdfInput.value = '';
    displayItems(); // Refresh the list
  } catch (error) {
    showStatus(`Failed to process PDF: ${error.message}`, true);
  }
});

// Process URL
urlButton.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) {
    showStatus('Please enter a URL', true);
    return;
  }
  
  try {
    showStatus('Processing URL...');
    await window.api.processURL(url);
    showStatus(`Successfully processed: ${url}`);
    urlInput.value = '';
    displayItems(); // Refresh the list
  } catch (error) {
    showStatus(`Failed to process URL: ${error.message}`, true);
  }
});

// Process YouTube URL
youtubeButton.addEventListener('click', async () => {
  const url = youtubeInput.value.trim();
  if (!url) {
    showStatus('Please enter a YouTube URL', true);
    return;
  }
  
  try {
    showStatus('Processing YouTube URL...');
    await window.api.processYouTube(url);
    showStatus(`Successfully processed YouTube video`);
    youtubeInput.value = '';
    displayItems(); // Refresh the list
  } catch (error) {
    showStatus(`Failed to process YouTube URL: ${error.message}`, true);
  }
});

// Handle search button click
searchButton.addEventListener('click', performSearch);

// Handle pressing Enter in search input
searchInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    performSearch();
  }
});

// Refresh item list
refreshButton.addEventListener('click', () => {
  displayItems();
});

// Load items on startup
document.addEventListener('DOMContentLoaded', () => {
  displayItems();
}); 