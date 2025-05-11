/**
 * Router Service - Manages navigation between different application views
 */
class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.defaultRoute = null;
    this.container = null;
    this.listeners = [];
  }

  /**
   * Set the container element for routing
   * @param {HTMLElement} container - The container element
   */
  setContainer(container) {
    this.container = container;
  }

  /**
   * Register a route
   * @param {string} name - Route name
   * @param {Function} initCallback - Function to call when route is activated
   * @param {boolean} isDefault - Whether this is the default route
   */
  register(name, initCallback, isDefault = false) {
    this.routes[name] = {
      name,
      init: initCallback
    };

    if (isDefault) {
      this.defaultRoute = name;
    }
  }

  /**
   * Navigate to a specific route
   * @param {string} routeName - Name of the route to navigate to
   * @param {Object} params - Parameters to pass to the route
   */
  navigateTo(routeName, params = {}) {
    // Check if route exists
    if (!this.routes[routeName]) {
      console.error(`Route "${routeName}" not found.`);
      return;
    }

    // Clear container if exists
    if (this.container) {
      this.container.innerHTML = '';
    }

    // Store current route
    this.currentRoute = routeName;

    // Initialize the route
    this.routes[routeName].init(this.container, params);

    // Notify listeners
    this.notifyListeners(routeName, params);
  }

  /**
   * Get the current active route
   * @returns {string} - The name of the current route
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Navigate to the default route
   * @param {Object} params - Parameters to pass to the route
   */
  navigateToDefault(params = {}) {
    if (!this.defaultRoute) {
      console.error('No default route defined.');
      return;
    }

    this.navigateTo(this.defaultRoute, params);
  }

  /**
   * Add a navigation change listener
   * @param {Function} listener - Function to call when navigation changes
   */
  addListener(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
    }
  }

  /**
   * Remove a navigation change listener
   * @param {Function} listener - The listener to remove
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners of a navigation change
   * @param {string} route - The route that was navigated to
   * @param {Object} params - Parameters that were passed to the route
   */
  notifyListeners(route, params) {
    this.listeners.forEach(listener => {
      try {
        listener(route, params);
      } catch (err) {
        console.error('Error in navigation listener:', err);
      }
    });
  }
}

export default Router; 