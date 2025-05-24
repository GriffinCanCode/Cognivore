/**
 * AddressBarRenderer - Handles rendering and management of the browser address bar
 */

/**
 * Create the address bar container with input and form
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Address container element
 */
export function createAddressBarContainer(browser) {
  // Create address bar container
  const addressContainer = document.createElement('div');
  addressContainer.className = 'voyager-address-container';
  
  // Add styling to ensure proper connection with tab bar
  addressContainer.style.cssText = `
    width: 100%;
    padding: 8px 10px;
    background-color: var(--address-bg-color, #333);
    border-bottom: 1px solid var(--border-color, #444);
    margin: 0;
    box-sizing: border-box;
  `;
  
  // Create address form
  const addressForm = document.createElement('form');
  addressForm.className = 'browser-search-form';
  
  // Handle form submission with proper browser context
  addressForm.addEventListener('submit', (event) => {
    if (typeof browser.handleAddressSubmit === 'function') {
      browser.handleAddressSubmit(event);
    } else {
      event.preventDefault();
      console.warn('handleAddressSubmit not available on browser object');
    }
  });
  
  // Create address input
  const addressInput = createAddressInput(browser);
  
  // Add input to form
  addressForm.appendChild(addressInput);
  
  // Add form to container
  addressContainer.appendChild(addressForm);
  
  // Store references
  browser.addressInput = addressInput;
  browser.searchInput = addressInput; // For backward compatibility
  browser.searchForm = addressForm;
  browser.addressContainer = addressContainer;
  
  return addressContainer;
}

/**
 * Create the address input element with enhanced functionality
 * @param {Object} browser - Browser instance
 * @returns {HTMLElement} Address input element
 */
function createAddressInput(browser) {
  const addressInput = document.createElement('input');
  addressInput.type = 'text';
  addressInput.className = 'voyager-address-bar';
  addressInput.placeholder = 'Search or enter website name';
  addressInput.spellcheck = false;
  addressInput.autocomplete = 'off';
  
  // Add focus animation for better interactivity
  addressInput.addEventListener('focus', () => {
    const form = addressInput.closest('form');
    if (form) form.classList.add('focused');
  });
  
  addressInput.addEventListener('blur', () => {
    const form = addressInput.closest('form');
    if (form) form.classList.remove('focused');
  });
  
  // Handle input changes
  addressInput.addEventListener('change', (event) => {
    if (typeof browser.handleAddressChange === 'function') {
      browser.handleAddressChange(event);
    } else {
      console.warn('handleAddressChange not available on browser object');
    }
  });
  
  // Add keyup listener for real-time address bar updates
  addressInput.addEventListener('keyup', (event) => {
    // Trigger visual feedback when typing
    if (event.key !== 'Enter') {
      const form = addressInput.closest('form');
      if (form) {
        form.classList.add('typing');
        setTimeout(() => {
          form.classList.remove('typing');
        }, 500);
      }
    }
  });
  
  return addressInput;
}

/**
 * Update the address bar with a new URL
 * @param {Object} browser - Browser instance
 * @param {string} url - URL to display
 */
export function updateAddressBar(browser, url) {
  if (!browser.addressInput) {
    console.warn('Address input not found');
    return;
  }
  
  // Update the address input value
  browser.addressInput.value = url || '';
  
  // Update visual state based on URL validity
  const isValidUrl = isValidURL(url);
  browser.addressInput.classList.toggle('valid-url', isValidUrl);
  browser.addressInput.classList.toggle('invalid-url', !isValidUrl && url);
}

/**
 * Helper function to validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether URL is valid
 */
function isValidURL(url) {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    // Check if it's a search query or domain without protocol
    return url.includes('.') || url.includes(' ');
  }
} 