// Main application entry point
import App from './components/App.js';
import './styles/main.css';

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  // Initialize and render the app
  const app = new App(appContainer);
  app.render();
}); 