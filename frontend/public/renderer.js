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
    const items = await window.api.listItems();
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

// Helper to get color based on source type
function getSourceColor(sourceType) {
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

// Refresh item list
refreshButton.addEventListener('click', () => {
  displayItems();
});

// Load items on startup
document.addEventListener('DOMContentLoaded', () => {
  displayItems();
}); 