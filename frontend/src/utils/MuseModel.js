/**
 * MuseModel.js
 * 3D Muse model using Three.js for the Mnemosyne component
 */

class MuseModel {
  constructor(container) {
    this.container = container;
    this.muse = null;
    this.initialized = false;
    this.isActive = false;
    this.isRising = false;
    this.isHolding = false;
    this.targetCard = null;
    this.originalPosition = { x: 0, y: 0.8, z: -2.0 };
    this.targetPosition = { x: 0, y: 2.0, z: -3.5 };
    this.riseProgress = 0;
    
    // Muse loader API reference
    this.museLoader = null;
    
    // Bind methods
    this.handleResize = this.handleResize.bind(this);
    this.riseAndHoldCard = this.riseAndHoldCard.bind(this);
    this.resetPosition = this.resetPosition.bind(this);
    
    console.log('MuseModel instance created');
  }
  
  /**
   * Initialize the 3D scene
   */
  initialize() {
    if (!this.container) {
      console.error('No container element provided for MuseModel');
      return;
    }
    
    console.log('Initializing MuseModel...');
    
    // Check if the MuseLoader is available
    if (window.MuseLoader) {
      try {
        console.log('Using MuseLoader to initialize Sea Angel 3D model');
        // Initialize using the external loader
        window.MuseLoader.initialize(this.container, this.originalPosition)
          .then(api => {
            console.log('MuseLoader initialized successfully');
            this.museLoader = api;
            this.container.classList.add('active');
            this.initialized = true;
          })
          .catch(error => {
            console.error('Failed to initialize with MuseLoader:', error);
            this.setupFallbackAnimation();
          });
      } catch (error) {
        console.error('Error with MuseLoader:', error);
        this.setupFallbackAnimation();
      }
    } else {
      console.warn('MuseLoader not available yet, using fallback animation');
      this.setupFallbackAnimation();
      
      // Check again after a short delay in case scripts are still loading
      setTimeout(() => {
        if (window.MuseLoader && !this.initialized) {
          console.log('MuseLoader now available, reinitializing...');
          this.initialize();
        }
      }, 2000);
    }
    
    // Add window resize listener
    window.addEventListener('resize', this.handleResize);
  }
  
  /**
   * Set up a fallback CSS animation if Three.js is not available
   */
  setupFallbackAnimation() {
    // Create a simple div with CSS animations as fallback
    const fallbackElement = document.createElement('div');
    fallbackElement.className = 'mnemosyne-muse-fallback';
    fallbackElement.innerHTML = `
      <div class="muse-sphere"></div>
      <div class="muse-wings"></div>
      <div class="muse-ring"></div>
    `;
    
    // Apply styles
    const style = document.createElement('style');
    style.textContent = `
      .mnemosyne-muse-fallback {
        position: relative;
        width: 150px;
        height: 150px;
        margin: 0 auto;
        perspective: 800px;
        transform-style: preserve-3d;
        z-index: 1;
      }
      .muse-sphere {
        position: absolute;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: radial-gradient(circle at 40% 40%, 
                                  rgba(255, 255, 255, 0.9) 0%,
                                  rgba(240, 230, 255, 0.7) 50%,
                                  rgba(200, 190, 255, 0.6) 100%);
        top: 10px;
        left: 45px;
        opacity: 0.9;
        animation: float 3s infinite ease-in-out;
        box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
      }
      .muse-wings {
        position: absolute;
        width: 80px;
        height: 50px;
        background: radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.1) 70%);
        border-radius: 50%;
        top: 30px;
        left: 35px;
        filter: blur(5px);
        transform: rotateX(60deg);
        animation: wingFlap 4s infinite ease-in-out;
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
      }
      .muse-ring {
        position: absolute;
        width: 100px;
        height: 20px;
        border: 3px solid rgba(255, 220, 153, 0.5);
        border-radius: 50%;
        top: 90px;
        left: 25px;
        transform: rotateX(75deg);
        animation: pulse 4s infinite ease-in-out;
        box-shadow: 0 0 8px rgba(255, 220, 153, 0.3);
      }
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      @keyframes wingFlap {
        0%, 100% { transform: rotateX(60deg) scaleX(1); }
        50% { transform: rotateX(60deg) scaleX(1.2); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.3; transform: rotateX(75deg) scale(1); }
        50% { opacity: 0.6; transform: rotateX(75deg) scale(1.1); }
      }
      @keyframes rise {
        0% { transform: translateY(0); opacity: 0.5; }
        100% { transform: translateY(-100px); opacity: 1; }
      }
      @keyframes holdCard {
        0%, 100% { transform: translateY(-100px) scale(1); }
        50% { transform: translateY(-105px) scale(1.05); }
      }
    `;
    
    // Add elements to the container
    this.container.appendChild(style);
    this.container.appendChild(fallbackElement);
    this.container.classList.add('active');
    
    this.initialized = true;
    this.useFallback = true;
    this.fallbackElement = fallbackElement;
    
    console.log('Fallback animation set up');
  }
  
  /**
   * Handle window resize
   */
  handleResize() {
    // If using MuseLoader, resizing is handled there
    // Otherwise, nothing needed for the fallback animation
  }
  
  /**
   * Activate the muse (when a card is selected)
   */
  activate() {
    this.isActive = true;
    
    if (this.museLoader) {
      console.log('Activating Sea Angel model');
      this.museLoader.activate();
    } else if (this.useFallback && this.fallbackElement) {
      console.log('Activating fallback animation');
      this.fallbackElement.style.animation = 'pulse 2s infinite';
    }
  }
  
  /**
   * Deactivate the muse (when selection is reset)
   */
  deactivate() {
    this.isActive = false;
    
    if (this.museLoader) {
      console.log('Deactivating Sea Angel model');
      this.museLoader.deactivate();
    } else if (this.useFallback && this.fallbackElement) {
      console.log('Deactivating fallback animation');
      this.fallbackElement.style.animation = 'none';
    }
  }
  
  /**
   * Make muse rise behind card and hold it
   * @param {HTMLElement} card - The card element to hold
   */
  riseAndHoldCard(card) {
    console.log('Rising and holding card');
    this.targetCard = card;
    this.isRising = true;
    this.isHolding = false;
    
    // Add 'rising' class to container for additional effects
    if (this.container) {
      this.container.classList.add('rising');
    }
    
    // Use the loader API if available, otherwise fallback
    if (this.museLoader) {
      console.log('Using Sea Angel model to rise and hold card');
      this.museLoader.riseAndHoldCard(card);
    } else if (this.useFallback && this.fallbackElement) {
      console.log('Using fallback animation to rise and hold card');
      // Position the fallback behind the card
      const cardRect = card.getBoundingClientRect();
      const containerRect = this.container.parentElement.getBoundingClientRect();
      
      this.fallbackElement.style.animation = 'rise 1s forwards';
      setTimeout(() => {
        this.fallbackElement.style.animation = 'holdCard 3s infinite';
      }, 1000);
      
      this.fallbackElement.style.position = 'absolute';
      this.fallbackElement.style.left = `${cardRect.left - containerRect.left + (cardRect.width / 2) - 75}px`;
      this.fallbackElement.style.top = `${cardRect.top - containerRect.top + cardRect.height - 60}px`;
      this.fallbackElement.style.zIndex = '-1';
    }
  }
  
  /**
   * Reset muse position
   */
  resetPosition() {
    console.log('Resetting position');
    this.isRising = false;
    this.isHolding = false;
    this.targetCard = null;
    
    // Remove 'rising' class from container
    if (this.container) {
      this.container.classList.remove('rising');
    }
    
    // Use the loader API if available, otherwise fallback
    if (this.museLoader) {
      console.log('Resetting Sea Angel model position');
      this.museLoader.resetPosition();
    } else if (this.useFallback && this.fallbackElement) {
      console.log('Resetting fallback animation position');
      this.fallbackElement.style.animation = 'none';
      this.fallbackElement.style.position = 'relative';
      this.fallbackElement.style.left = 'auto';
      this.fallbackElement.style.top = 'auto';
      this.fallbackElement.style.margin = '0 auto';
      this.fallbackElement.style.zIndex = '1';
      
      // Fade out and back in at original position
      this.fallbackElement.style.opacity = '0';
      setTimeout(() => {
        this.fallbackElement.style.transition = 'opacity 0.5s ease';
        this.fallbackElement.style.opacity = '1';
      }, 500);
    }
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    window.removeEventListener('resize', this.handleResize);
    
    if (this.museLoader) {
      this.museLoader.dispose();
    }
  }
}

export default MuseModel; 