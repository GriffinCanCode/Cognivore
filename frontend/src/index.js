// Main application entry point
import App from './components/App.js';
// Import public CSS directly instead of from src
// This will be handled by Webpack copy plugin
// import './styles/main.css';

// Use DOMContentLoaded to ensure DOM is ready
document.addEventListener('DOMContentLoaded', () => {
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
  
  // Initialize and render the app
  const app = new App(appContainer);
  app.render();
  
  console.log('Application initialized successfully');
}); 