// Main entry point for the Knowledge Store application
import ChatUI from '../src/components/ChatUI.js';
import NotificationService from '../src/services/NotificationService.js';

// Initialize services
const notificationService = new NotificationService();

// Initialize the chat component as the main landing page
const chatUI = new ChatUI(notificationService);

// Render the chat UI to the app container
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.appendChild(chatUI.render());
    
    // Short delay to ensure DOM is fully updated before initialization
    setTimeout(() => {
      chatUI.initialize();
    }, 0);
  }
});

console.log('Knowledge Store application initialized');

// Export the chat component for access from other modules if needed
window.chatUI = chatUI; 