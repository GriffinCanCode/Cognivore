/**
 * NotificationService - Simple service to display toast notifications
 */
class NotificationService {
  constructor() {
    this.container = null;
    this.createContainer();
  }

  /**
   * Create the notification container
   */
  createContainer() {
    // Check if container already exists
    if (document.getElementById('notification-container')) {
      this.container = document.getElementById('notification-container');
      return;
    }
    
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 350px;
      }
      
      .notification {
        padding: 12px 16px;
        border-radius: 8px;
        color: white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: notification-slide-in 0.3s var(--animation-timing);
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .notification-icon {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
      }
      
      .notification-success {
        background-color: var(--success-color, #10b981);
      }
      
      .notification-error {
        background-color: var(--error-color, #ef4444);
      }
      
      .notification-warning {
        background-color: var(--warning-color, #f59e0b);
      }
      
      .notification-info {
        background-color: var(--accent-color, #0ea5e9);
      }
      
      @keyframes notification-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(this.container);
  }

  /**
   * Show a notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, warning, info)
   * @param {number} duration - Duration in ms
   */
  show(message, type = 'info', duration = 3000) {
    if (!this.container) {
      this.createContainer();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Set icon based on notification type
    let icon = '';
    switch (type) {
      case 'success':
        icon = `<svg class="notification-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        break;
      case 'error':
        icon = `<svg class="notification-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        break;
      case 'warning':
        icon = `<svg class="notification-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        break;
      default: // info
        icon = `<svg class="notification-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
    
    notification.innerHTML = `${icon}<div>${message}</div>`;
    this.container.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      notification.style.transition = 'all 0.3s var(--animation-timing)';
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  /**
   * Show a success notification
   * @param {string} message - Notification message
   * @param {number} duration - Duration in ms
   */
  success(message, duration = 3000) {
    this.show(message, 'success', duration);
  }

  /**
   * Show an error notification
   * @param {string} message - Notification message
   * @param {number} duration - Duration in ms
   */
  error(message, duration = 4000) {
    this.show(message, 'error', duration);
  }

  /**
   * Show a warning notification
   * @param {string} message - Notification message
   * @param {number} duration - Duration in ms
   */
  warning(message, duration = 3500) {
    this.show(message, 'warning', duration);
  }

  /**
   * Show an info notification
   * @param {string} message - Notification message
   * @param {number} duration - Duration in ms
   */
  info(message, duration = 3000) {
    this.show(message, 'info', duration);
  }
}

export default NotificationService; 