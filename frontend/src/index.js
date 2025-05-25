// Import polyfill for global object
import './global-polyfill.js';

// Main application entry point
import App from './components/App.js';
// Import public CSS directly instead of from src
// This will be handled by Webpack copy plugin
import '../public/styles/main.css';

// Use DOMContentLoaded to ensure DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  // Get the app container from the DOM
  const appContainer = document.getElementById('app');
  
  // Check if API is available from the Electron preload script
  if (!window.api) {
    console.error('Error: API not available. Electron preload script might not be working correctly.');
    
    // Display an error message to the user
    const errorMessage = document.createElement('div');
    errorMessage.innerHTML = `
      <h1>Error: Could not connect to backend</h1>
      <p>The application could not establish a connection to the backend services.</p>
      <p>Please restart the application or contact support if the problem persists.</p>
    `;
    errorMessage.style.padding = '20px';
    errorMessage.style.color = 'red';
    errorMessage.style.textAlign = 'center';
    
    appContainer.appendChild(errorMessage);
    return;
  }
  
  // Initialize the app with the new initialization method
  const app = new App();
  await app.init();
  
  // Make app available globally for debugging
  window.app = app;
  
  // Set up data preservation on window close/refresh
  const handleBeforeUnload = async (event) => {
    console.log('🔍 Application closing - triggering data preservation');
    
    // Trigger data preservation if available
    if (window.dataPreservationManager && window.dataPreservationManager.isInitialized) {
      try {
        // Use synchronous preservation for critical data
        await window.dataPreservationManager.preserveAllData({
          source: 'window-beforeunload',
          priority: 'critical',
          synchronous: true
        });
        console.log('✅ Data preservation completed before window close');
      } catch (error) {
        console.error('❌ Data preservation failed before window close:', error);
      }
    }
    
    // Clean up the app
    if (app && typeof app.cleanup === 'function') {
      try {
        await app.cleanup();
        console.log('✅ App cleanup completed');
      } catch (error) {
        console.error('❌ App cleanup failed:', error);
      }
    }
  };
  
  // Add event listeners for application close
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('unload', handleBeforeUnload);
  
  // Handle Electron-specific close events if available
  if (window.api && window.api.onAppWillQuit) {
    window.api.onAppWillQuit(handleBeforeUnload);
  }
  
  console.log('Knowledge Store application initialized');
}); 