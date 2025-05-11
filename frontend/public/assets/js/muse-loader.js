/**
 * Muse Loader
 * Handles loading and animating the 3D Sea Angel model for Mnemosyne
 */
window.MuseLoader = (function() {
  let container;
  let camera, scene, renderer;
  let model;
  let mixer;
  let clock;
  let isActive = false;
  let isRising = false;
  let isHolding = false;
  let animations = [];
  let animationId = null;
  
  const originalPosition = { x: 0, y: 0.3, z: -2 };
  const targetPosition = { x: 0, y: 2.0, z: -3.5 };
  
  /**
   * Initialize the 3D scene
   * @param {HTMLElement} containerElement - DOM element to contain the 3D scene
   * @returns {Promise} - Resolves with an API object for controlling the model
   */
  function initialize(containerElement) {
    return new Promise((resolve, reject) => {
      try {
        // Store container reference
        container = containerElement;
        
        // Create element for container ID (for reuse by fallback)
        container.id = 'muse-model-container-' + Math.random().toString(36).substr(2, 9);
        
        // First try to use a simple model to avoid complexity
        setupSimpleModel()
          .then(api => {
            console.log('Simple model setup successful');
            resolve(api);
          })
          .catch(error => {
            console.error('Failed to set up simple model, using fallback:', error);
            setupFallbackAnimation();
            resolve(createFallbackAPI());
          });
      } catch (error) {
        console.error('Error during initialization:', error);
        setupFallbackAnimation();
        resolve(createFallbackAPI());
      }
    });
  }
  
  /**
   * Set up a simple 3D model
   * @returns {Promise} - Resolves with an API object for controlling the model
   */
  function setupSimpleModel() {
    return new Promise((resolve, reject) => {
      try {
        // Create scene
        scene = new THREE.Scene();
        
        // Create camera
        camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 0, 5);
        
        // Create renderer
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 5, 10);
        scene.add(directionalLight);
        
        // Create a simple geometric model instead of loading GLTF
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshPhongMaterial({
          color: 0x3a86ff,
          emissive: 0x3a86ff,
          emissiveIntensity: 0.2,
          specular: 0xffffff,
          shininess: 100
        });
        
        model = new THREE.Group();
        
        // Create main body
        const mainSphere = new THREE.Mesh(geometry, material);
        mainSphere.scale.set(0.5, 0.5, 0.5);
        model.add(mainSphere);
        
        // Create wings
        const wingGeometry = new THREE.CylinderGeometry(0.1, 0.5, 1, 32);
        const wingMaterial = new THREE.MeshPhongMaterial({
          color: 0xaabbff,
          transparent: true,
          opacity: 0.7,
          shininess: 100
        });
        
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.rotation.z = Math.PI / 2;
        leftWing.rotation.y = Math.PI / 6;
        leftWing.position.set(-0.5, 0, 0);
        leftWing.scale.set(0.2, 0.6, 0.1);
        model.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.rotation.z = -Math.PI / 2;
        rightWing.rotation.y = -Math.PI / 6;
        rightWing.position.set(0.5, 0, 0);
        rightWing.scale.set(0.2, 0.6, 0.1);
        model.add(rightWing);
        
        // Position and add model to scene
        model.position.set(originalPosition.x, originalPosition.y, originalPosition.z);
        scene.add(model);
        
        // Create clock for animations
        clock = new THREE.Clock();
        
        // Start animation loop
        animate();
        
        // Expose API
        const api = {
          activate: activate,
          deactivate: deactivate,
          riseAndHoldCard: riseAndHoldCard,
          resetPosition: resetPosition,
          dispose: dispose
        };
        
        resolve(api);
      } catch (error) {
        console.error('Error setting up simple model:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Set up a fallback CSS animation
   */
  function setupFallbackAnimation() {
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
        position: absolute;
        bottom: 50%;
        right: 50%;
        transform: translate(50%, 50%);
        width: 150px;
        height: 150px;
        perspective: 800px;
        transform-style: preserve-3d;
        z-index: 0;
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
        animation: museFloat 3s infinite ease-in-out;
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
        animation: museWingFlap 4s infinite ease-in-out;
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
        animation: musePulse 4s infinite ease-in-out;
        box-shadow: 0 0 8px rgba(255, 220, 153, 0.3);
      }
      @keyframes museFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      @keyframes museWingFlap {
        0%, 100% { transform: rotateX(60deg) scaleX(1); }
        50% { transform: rotateX(60deg) scaleX(1.2); }
      }
      @keyframes musePulse {
        0%, 100% { opacity: 0.3; transform: rotateX(75deg) scale(1); }
        50% { opacity: 0.6; transform: rotateX(75deg) scale(1.1); }
      }
      @keyframes museRise {
        0% { transform: translateY(0); opacity: 0.5; }
        100% { transform: translateY(-100px); opacity: 1; }
      }
      @keyframes museHoldCard {
        0%, 100% { transform: translateY(-100px) scale(1); }
        50% { transform: translateY(-105px) scale(1.05); }
      }
    `;
    
    // Add elements to the container
    container.appendChild(style);
    container.appendChild(fallbackElement);
    
    // Store reference to the fallback element
    window.museFallbackElement = fallbackElement;
  }
  
  /**
   * Create API for fallback animation
   * @returns {Object} - API object for controlling the fallback animation
   */
  function createFallbackAPI() {
    return {
      activate: function() {
        const fallbackEl = window.museFallbackElement;
        if (fallbackEl) {
          fallbackEl.style.animation = 'musePulse 2s infinite';
        }
      },
      deactivate: function() {
        const fallbackEl = window.museFallbackElement;
        if (fallbackEl) {
          fallbackEl.style.animation = 'none';
        }
      },
      riseAndHoldCard: function(card) {
        const fallbackEl = window.museFallbackElement;
        if (!fallbackEl || !card) return;
        
        // Position the fallback behind the card
        const cardRect = card.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        fallbackEl.style.animation = 'museRise 1s forwards';
        setTimeout(() => {
          fallbackEl.style.animation = 'museHoldCard 3s infinite';
        }, 1000);
        
        fallbackEl.style.bottom = 'auto';
        fallbackEl.style.right = 'auto';
        fallbackEl.style.left = `${cardRect.left - containerRect.left + (cardRect.width / 2) - 75}px`;
        fallbackEl.style.top = `${cardRect.top - containerRect.top + cardRect.height - 60}px`;
        fallbackEl.style.zIndex = '-1';
      },
      resetPosition: function() {
        const fallbackEl = window.museFallbackElement;
        if (!fallbackEl) return;
        
        fallbackEl.style.animation = 'none';
        fallbackEl.style.bottom = '50%';
        fallbackEl.style.right = '50%';
        fallbackEl.style.transform = 'translate(50%, 50%)';
        fallbackEl.style.left = 'auto';
        fallbackEl.style.top = 'auto';
        fallbackEl.style.zIndex = '0';
        
        // Fade out and back in at original position
        fallbackEl.style.opacity = '0';
        setTimeout(() => {
          fallbackEl.style.transition = 'opacity 0.5s ease';
          fallbackEl.style.opacity = '1';
        }, 500);
      },
      dispose: function() {
        const fallbackEl = window.museFallbackElement;
        if (fallbackEl && fallbackEl.parentNode) {
          fallbackEl.parentNode.removeChild(fallbackEl);
        }
        window.museFallbackElement = null;
      }
    };
  }
  
  /**
   * Animation loop
   */
  function animate() {
    animationId = requestAnimationFrame(animate);
    
    try {
      // Update animations
      const delta = clock.getDelta();
      
      // Animate wings
      if (model) {
        // Make the wings flap
        if (model.children && model.children.length > 2) {
          const leftWing = model.children[1];
          const rightWing = model.children[2];
          
          if (leftWing && rightWing) {
            const time = clock.getElapsedTime();
            
            // Make the wings flap
            leftWing.scale.z = 0.1 + Math.sin(time * 2) * 0.05;
            rightWing.scale.z = 0.1 + Math.sin(time * 2) * 0.05;
            
            // Make the model float up and down
            model.position.y = originalPosition.y + Math.sin(time) * 0.1;
          }
        }
        
        // Handle model rising animation
        if (isRising) {
          const progress = Math.min(1, clock.getElapsedTime() * 0.5);
          model.position.y = originalPosition.y + (targetPosition.y - originalPosition.y) * progress;
          model.position.z = originalPosition.z + (targetPosition.z - originalPosition.z) * progress;
          
          if (progress >= 1) {
            isRising = false;
            isHolding = true;
          }
        }
        
        // Subtle floating animation when holding
        if (isHolding) {
          const floatY = Math.sin(clock.getElapsedTime() * 0.8) * 0.2;
          model.position.y = targetPosition.y + floatY;
        }
      }
      
      // Render the scene
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    } catch (error) {
      console.error('Error in animation loop:', error);
      // Don't stop the animation loop, just continue
    }
  }
  
  /**
   * Handle window resize
   */
  function onWindowResize() {
    if (!container || !camera || !renderer) return;
    
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  
  /**
   * Activate model (make it more prominent)
   */
  function activate() {
    isActive = true;
    
    // Subtle pulse animation
    if (model) {
      // Increase brightness/prominence
      if (model.children && model.children.length > 0) {
        const mainSphere = model.children[0];
        if (mainSphere && mainSphere.material) {
          mainSphere.material.emissiveIntensity = 0.4;
        }
      }
    }
  }
  
  /**
   * Deactivate model (return to normal state)
   */
  function deactivate() {
    isActive = false;
    
    // Return to normal appearance
    if (model) {
      if (model.children && model.children.length > 0) {
        const mainSphere = model.children[0];
        if (mainSphere && mainSphere.material) {
          mainSphere.material.emissiveIntensity = 0.2;
        }
      }
    }
  }
  
  /**
   * Make model rise behind card and hold it
   * @param {HTMLElement} card - The card element to hold
   */
  function riseAndHoldCard(card) {
    if (!model) return;
    
    // Reset clock for smooth rising animation
    if (clock) clock.start();
    
    // Start rising animation
    isRising = true;
    isHolding = false;
    
    // Position model behind the card
    if (card) {
      const cardRect = card.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Calculate position relative to the container
      const cardCenterX = (cardRect.left + cardRect.width / 2) - (containerRect.left + containerRect.width / 2);
      
      // Move model behind the card (adjust X position only)
      model.position.x = cardCenterX * 0.01; // Scale down for subtlety
    }
  }
  
  /**
   * Reset model position to original state
   */
  function resetPosition() {
    if (!model) return;
    
    isRising = false;
    isHolding = false;
    
    // Animate back to original position
    const duration = 1; // seconds
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    const startPos = {
      x: model.position.x,
      y: model.position.y,
      z: model.position.z
    };
    
    function updatePosition() {
      const now = Date.now();
      if (now >= endTime) {
        model.position.set(originalPosition.x, originalPosition.y, originalPosition.z);
        return;
      }
      
      const elapsed = (now - startTime) / (endTime - startTime);
      const easedElapsed = 1 - Math.pow(1 - elapsed, 2); // easeOutQuad
      
      model.position.x = startPos.x + (originalPosition.x - startPos.x) * easedElapsed;
      model.position.y = startPos.y + (originalPosition.y - startPos.y) * easedElapsed;
      model.position.z = startPos.z + (originalPosition.z - startPos.z) * easedElapsed;
      
      requestAnimationFrame(updatePosition);
    }
    
    updatePosition();
  }
  
  /**
   * Clean up resources
   */
  function dispose() {
    window.removeEventListener('resize', onWindowResize);
    
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    if (renderer) {
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    }
    
    scene = null;
    camera = null;
    renderer = null;
    model = null;
    mixer = null;
  }
  
  // Add window resize listener
  window.addEventListener('resize', onWindowResize);
  
  // Return public API
  return {
    initialize: initialize
  };
})(); 