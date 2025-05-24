/**
 * Browser Fixes Test Script
 * Validates that the browser rendering fixes are working correctly
 */

class BrowserFixesValidator {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  /**
   * Add a test to the validation suite
   * @param {string} name - Test name
   * @param {Function} testFn - Test function that returns boolean
   */
  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  /**
   * Run all tests and report results
   */
  async runTests() {
    console.log('🧪 Running Browser Fixes Validation Tests...\n');

    for (const test of this.tests) {
      try {
        const result = await test.testFn();
        this.results.total++;
        
        if (result) {
          this.results.passed++;
          console.log(`✅ ${test.name}`);
        } else {
          this.results.failed++;
          console.log(`❌ ${test.name}`);
        }
      } catch (error) {
        this.results.failed++;
        this.results.total++;
        console.log(`❌ ${test.name} - Error: ${error.message}`);
      }
    }

    this.reportResults();
  }

  /**
   * Report final test results
   */
  reportResults() {
    console.log('\n📊 Test Results:');
    console.log(`Total: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
    
    if (this.results.failed === 0) {
      console.log('🎉 All tests passed! Browser fixes are working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please check the implementation.');
    }
  }

  /**
   * Check if CSS file exists and is loadable
   */
  async checkCSSFile(href) {
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      
      link.onload = () => {
        document.head.removeChild(link);
        resolve(true);
      };
      
      link.onerror = () => {
        document.head.removeChild(link);
        resolve(false);
      };
      
      document.head.appendChild(link);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (link.parentNode) {
          document.head.removeChild(link);
          resolve(false);
        }
      }, 5000);
    });
  }

  /**
   * Check if CSS rules are applied correctly
   */
  checkCSSRules(selector, expectedRules) {
    const element = document.querySelector(selector);
    if (!element) return false;

    const computedStyle = window.getComputedStyle(element);
    
    for (const [property, expectedValue] of Object.entries(expectedRules)) {
      const actualValue = computedStyle.getPropertyValue(property);
      if (!actualValue.includes(expectedValue)) {
        console.log(`❌ CSS Rule mismatch for ${selector}.${property}: expected '${expectedValue}', got '${actualValue}'`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Create a test browser component to validate styling
   */
  createTestBrowserComponent() {
    const container = document.createElement('div');
    container.className = 'browser-container voyager-browser';
    container.id = 'test-browser-component';
    
    // Create tab bar
    const tabBarWrapper = document.createElement('div');
    tabBarWrapper.className = 'voyager-tab-bar-wrapper';
    
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item active fallback';
    tabItem.innerHTML = '<span class="tab-title">Test Tab</span>';
    
    tabBarWrapper.appendChild(tabItem);
    container.appendChild(tabBarWrapper);
    
    // Create address container
    const addressContainer = document.createElement('div');
    addressContainer.className = 'voyager-address-container';
    
    const addressBar = document.createElement('input');
    addressBar.className = 'voyager-address-bar';
    addressBar.value = 'https://test-url.com';
    
    addressContainer.appendChild(addressBar);
    container.appendChild(addressContainer);
    
    // Create webview container
    const webviewContainer = document.createElement('div');
    webviewContainer.className = 'browser-webview-container';
    container.appendChild(webviewContainer);
    
    document.body.appendChild(container);
    return container;
  }

  /**
   * Initialize all tests
   */
  initializeTests() {
    // Test 1: Check if CSS loader utility exists
    this.addTest('CSS Loader utility exists', () => {
      try {
        // Check if cssLoader is available globally
        return typeof window.cssLoader !== 'undefined' || 
               document.querySelector('script[src*="cssLoader"]') !== null;
      } catch (error) {
        return false;
      }
    });

    // Test 2: Validate browser container styling
    this.addTest('Browser container styling is correct', () => {
      const testContainer = this.createTestBrowserComponent();
      
      const isCorrect = this.checkCSSRules('.browser-container', {
        'position': 'relative',
        'display': 'flex',
        'flex-direction': 'column'
      });
      
      // Cleanup
      document.body.removeChild(testContainer);
      return isCorrect;
    });

    // Test 3: Validate tab bar styling
    this.addTest('Tab bar styling is correct', () => {
      const testContainer = this.createTestBrowserComponent();
      
      const isCorrect = this.checkCSSRules('.voyager-tab-bar-wrapper', {
        'display': 'flex',
        'height': '36px'
      });
      
      // Cleanup
      document.body.removeChild(testContainer);
      return isCorrect;
    });

    // Test 4: Validate webview container styling
    this.addTest('Webview container styling is correct', () => {
      const testContainer = this.createTestBrowserComponent();
      
      const isCorrect = this.checkCSSRules('.browser-webview-container', {
        'position': 'relative',
        'flex': '1'
      });
      
      // Cleanup
      document.body.removeChild(testContainer);
      return isCorrect;
    });

    // Test 5: Check for emergency styles in DOM
    this.addTest('Emergency styles are available', () => {
      const emergencyStyle = document.getElementById('emergency-browser-styles');
      return emergencyStyle !== null || 
             document.querySelector('style[id*="emergency"]') !== null ||
             document.querySelector('link[href*="browser-fix"]') !== null;
    });

    // Test 6: Validate fallback tab functionality
    this.addTest('Fallback tab elements are visible', () => {
      const testContainer = this.createTestBrowserComponent();
      
      // Check if tab elements are visible
      const tabItem = testContainer.querySelector('.tab-item');
      const computedStyle = window.getComputedStyle(tabItem);
      
      const isVisible = computedStyle.visibility === 'visible' && 
                       computedStyle.opacity !== '0' &&
                       computedStyle.display !== 'none';
      
      // Cleanup
      document.body.removeChild(testContainer);
      return isVisible;
    });
  }
}

// Auto-run tests when script is loaded
document.addEventListener('DOMContentLoaded', () => {
  const validator = new BrowserFixesValidator();
  validator.initializeTests();
  validator.runTests();
});

// Export for manual testing
window.BrowserFixesValidator = BrowserFixesValidator; 