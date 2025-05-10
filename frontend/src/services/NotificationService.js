// NotificationService handles displaying status messages to the user
class NotificationService {
  constructor() {
    this.container = null;
    this.createContainer();
  }
  
  // Create a container for notifications if it doesn't exist
  createContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }
  
  // Show a notification message
  show(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    this.container.prepend(notification);
    
    // Add entry animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Remove after duration
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
        // Remove container if empty
        if (this.container.children.length === 0) {
          this.container.remove();
          this.container = null;
        }
      }, 300); // Wait for exit animation
    }, duration);
    
    return notification;
  }
  
  // Show an error notification
  error(message, duration = 5000) {
    return this.show(message, 'error', duration);
  }
  
  // Show a success notification
  success(message, duration = 5000) {
    return this.show(message, 'success', duration);
  }
  
  // Show a warning notification
  warning(message, duration = 5000) {
    return this.show(message, 'warning', duration);
  }
}

export default NotificationService; 