/**
 * MuseModel.js
 * 3D Muse model using Three.js for the Mnemosyne component
 */

class MuseModel {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.muse = null;
    this.light = null;
    this.animationFrame = null;
    this.initialized = false;
    this.isActive = false;
    this.isRising = false;
    this.isHolding = false;
    this.targetCard = null;
    this.originalPosition = { x: 0, y: 0.5, z: 0 };
    this.targetPosition = { x: 0, y: 2.5, z: -2 };
    this.riseProgress = 0;
    
    // Bind methods
    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.riseAndHoldCard = this.riseAndHoldCard.bind(this);
    this.resetPosition = this.resetPosition.bind(this);
  }
  
  /**
   * Initialize the 3D scene
   */
  initialize() {
    if (!this.container) return;
    
    // Implement a basic fallback if Three.js can't be loaded
    if (!window.THREE) {
      try {
        this.setupFallbackAnimation();
        return;
      } catch (error) {
        console.error('Failed to set up fallback animation', error);
      }
    } else {
      this.setupScene();
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
      <div class="muse-cone"></div>
      <div class="muse-ring"></div>
    `;
    
    // Apply styles
    const style = document.createElement('style');
    style.textContent = `
      .mnemosyne-muse-fallback {
        position: absolute;
        bottom: 10px;
        right: 10px;
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
        background: linear-gradient(45deg, #8b5cf6, #9f7aea);
        top: 10px;
        left: 45px;
        opacity: 0.9;
        animation: float 3s infinite ease-in-out;
      }
      .muse-cone {
        position: absolute;
        width: 0;
        height: 0;
        border-left: 25px solid transparent;
        border-right: 25px solid transparent;
        border-bottom: 75px solid rgba(59, 130, 246, 0.85);
        top: 60px;
        left: 50px;
        animation: rotate 6s infinite linear;
      }
      .muse-ring {
        position: absolute;
        width: 100px;
        height: 20px;
        border: 3px solid rgba(56, 178, 172, 0.3);
        border-radius: 50%;
        top: 90px;
        left: 25px;
        transform: rotateX(75deg);
        animation: pulse 4s infinite ease-in-out;
      }
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      @keyframes rotate {
        0% { transform: rotateY(0); }
        100% { transform: rotateY(360deg); }
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
    
    // Create expanded interface for fallback animations
    this.activate = () => {
      fallbackElement.style.animation = 'pulse 2s infinite';
    };
    
    this.deactivate = () => {
      fallbackElement.style.animation = 'none';
    };
    
    this.riseAndHoldCard = (card) => {
      fallbackElement.style.animation = 'rise 1s forwards';
      setTimeout(() => {
        fallbackElement.style.animation = 'holdCard 3s infinite';
      }, 1000);
      
      // Position behind the card
      const cardRect = card.getBoundingClientRect();
      const containerRect = this.container.parentElement.getBoundingClientRect();
      
      fallbackElement.style.bottom = 'auto';
      fallbackElement.style.right = 'auto';
      fallbackElement.style.left = `${cardRect.left - containerRect.left + (cardRect.width / 2) - 75}px`;
      fallbackElement.style.top = `${cardRect.top - containerRect.top + cardRect.height - 60}px`;
      fallbackElement.style.zIndex = '-1';
    };
    
    this.resetPosition = () => {
      fallbackElement.style.animation = 'none';
      fallbackElement.style.bottom = '10px';
      fallbackElement.style.right = '10px';
      fallbackElement.style.left = 'auto';
      fallbackElement.style.top = 'auto';
      fallbackElement.style.zIndex = '0';
      
      // Fade out and back in at original position
      fallbackElement.style.opacity = '0';
      setTimeout(() => {
        fallbackElement.style.transition = 'opacity 0.5s ease';
        fallbackElement.style.opacity = '1';
      }, 500);
    };
  }
  
  /**
   * Load Three.js from CDN if not available
   * @returns {Promise} - Promise that resolves when Three.js is loaded
   */
  loadThreeJs() {
    return new Promise((resolve, reject) => {
      // We'll rely on the fallback animation instead of trying to load Three.js
      // to avoid CSP issues
      reject(new Error('Three.js loading skipped to avoid CSP issues'));
    });
  }
  
  /**
   * Set up the 3D scene
   */
  setupScene() {
    const THREE = window.THREE;
    
    // Create scene
    this.scene = new THREE.Scene();
    
    // Set up camera
    const aspectRatio = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    this.camera.position.z = 5;
    
    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true // transparent background
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0); // transparent
    this.container.appendChild(this.renderer.domElement);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    this.light = new THREE.DirectionalLight(0xffffff, 1);
    this.light.position.set(0, 1, 2);
    this.scene.add(this.light);
    
    // Create simple muse figure (placeholder for a more detailed model)
    this.createMuseFigure();
    
    // Start animation loop
    this.initialized = true;
    this.animate();
  }
  
  /**
   * Create a simple muse figure
   * Note: In a production app, we would load a detailed GLTF model
   */
  createMuseFigure() {
    const THREE = window.THREE;
    
    // Create a group to hold the muse figure
    this.muse = new THREE.Group();
    
    // Create "head" - Sphere
    const headGeometry = new THREE.SphereGeometry(0.6, 32, 32);
    const headMaterial = new THREE.MeshPhongMaterial({
      color: 0x8b5cf6, // Purple color matching the app theme
      emissive: 0x2a0080,
      specular: 0xffffff,
      shininess: 30,
      transparent: true,
      opacity: 0.9
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    this.muse.add(head);
    
    // Create "body" - Cone
    const bodyGeometry = new THREE.ConeGeometry(0.5, 1.5, 32);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0x3b82f6, // Blue color matching the app theme
      emissive: 0x001440,
      specular: 0xffffff,
      shininess: 30,
      transparent: true,
      opacity: 0.85
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = -1.05;
    this.muse.add(body);
    
    // Create "aura" - Ring
    const auraGeometry = new THREE.RingGeometry(1.2, 1.5, 32);
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0x38b2ac, // Teal color
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const aura = new THREE.Mesh(auraGeometry, auraMaterial);
    aura.rotation.x = Math.PI / 2;
    aura.position.y = -0.5;
    this.muse.add(aura);
    
    // Add some floating particles
    this.addParticles();
    
    // Add the muse to the scene
    this.scene.add(this.muse);
    
    // Position the muse
    this.muse.position.y = 0.5;
    this.muse.rotation.y = -Math.PI / 6;
    
    // Store original position
    this.originalPosition = {
      x: this.muse.position.x,
      y: this.muse.position.y,
      z: this.muse.position.z
    };
  }
  
  /**
   * Add floating particles around the muse
   */
  addParticles() {
    const THREE = window.THREE;
    
    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 50;
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    const color1 = new THREE.Color(0x3b82f6); // Blue
    const color2 = new THREE.Color(0x8b5cf6); // Purple
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Position
      positions[i3] = (Math.random() - 0.5) * 3; // x
      positions[i3 + 1] = (Math.random() - 0.5) * 3; // y
      positions[i3 + 2] = (Math.random() - 0.5) * 3; // z
      
      // Color
      const mixRatio = Math.random();
      const particleColor = color1.clone().lerp(color2, mixRatio);
      
      colors[i3] = particleColor.r;
      colors[i3 + 1] = particleColor.g;
      colors[i3 + 2] = particleColor.b;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });
    
    this.particles = new THREE.Points(particlesGeometry, particlesMaterial);
    this.muse.add(this.particles);
  }
  
  /**
   * Animation loop
   */
  animate() {
    if (!this.initialized || !this.renderer) return;
    
    this.animationFrame = requestAnimationFrame(this.animate);
    
    if (this.muse) {
      // Rotate muse slightly
      this.muse.rotation.y += 0.005;
      
      // Handle rising animation
      if (this.isRising && this.riseProgress < 1) {
        this.riseProgress += 0.02; // Controls the speed of rising
        
        // Interpolate position
        this.muse.position.x = this.originalPosition.x + (this.targetPosition.x - this.originalPosition.x) * this.riseProgress;
        this.muse.position.y = this.originalPosition.y + (this.targetPosition.y - this.originalPosition.y) * this.riseProgress;
        this.muse.position.z = this.originalPosition.z + (this.targetPosition.z - this.originalPosition.z) * this.riseProgress;
        
        // Scale effect during rise
        const scale = 1 + this.riseProgress * 0.5;
        this.muse.scale.set(scale, scale, scale);
        
        // If completed, switch to holding mode
        if (this.riseProgress >= 1) {
          this.isRising = false;
          this.isHolding = true;
        }
      }
      
      // Holding animation (gentle float)
      if (this.isHolding) {
        const time = Date.now() * 0.001;
        // Gentle floating motion
        this.muse.position.y = this.targetPosition.y + Math.sin(time) * 0.2;
        
        // Create a "holding" effect with arms spread
        if (this.particles) {
          // Make particles form a semicircle shape
          const positions = this.particles.geometry.attributes.position.array;
          for (let i = 0; i < positions.length; i += 3) {
            const angle = (i / positions.length) * Math.PI + Math.sin(time * 0.5) * 0.2;
            positions[i] = Math.cos(angle) * 2; // x - spread horizontally
            positions[i + 1] = Math.sin(time + i * 0.01) * 0.5; // y - gentle float
            positions[i + 2] = Math.sin(angle) * 1.5; // z - curve around
          }
          this.particles.geometry.attributes.position.needsUpdate = true;
        }
      } else if (!this.isRising) {
        // Normal floating animation when not rising or holding
        const time = Date.now() * 0.001;
        this.muse.position.y = this.originalPosition.y + Math.sin(time) * 0.1;
      }
      
      // Pulse animation for the muse when active
      if (this.isActive && !this.isRising && !this.isHolding) {
        const time = Date.now() * 0.001;
        const pulse = Math.sin(time * 2) * 0.05 + 1;
        this.muse.scale.set(pulse, pulse, pulse);
        
        // Rotate particles
        if (this.particles) {
          this.particles.rotation.y += 0.01;
        }
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Handle window resize
   */
  handleResize() {
    if (!this.initialized || !this.container || !this.renderer) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    
    this.renderer.setSize(width, height);
  }
  
  /**
   * Activate the muse (when a card is selected)
   */
  activate() {
    this.isActive = true;
    
    // If GSAP is available and Three.js is working
    if (window.gsap && this.muse) {
      window.gsap.to(this.muse.scale, {
        x: 1.2,
        y: 1.2,
        z: 1.2,
        duration: 0.5,
        ease: 'back.out'
      });
    }
  }
  
  /**
   * Deactivate the muse (when selection is reset)
   */
  deactivate() {
    this.isActive = false;
    
    // If GSAP is available and Three.js is working
    if (window.gsap && this.muse) {
      window.gsap.to(this.muse.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.5,
        ease: 'power2.out'
      });
    }
  }
  
  /**
   * Make muse rise behind card and hold it
   * @param {HTMLElement} card - The card element to hold
   */
  riseAndHoldCard(card) {
    this.targetCard = card;
    this.isRising = true;
    this.riseProgress = 0;
    this.isHolding = false;
    
    // Store initial position if needed
    if (!this.originalPosition) {
      this.originalPosition = {
        x: this.muse.position.x,
        y: this.muse.position.y,
        z: this.muse.position.z
      };
    }
    
    // If we have a card element, customize target position based on card position
    if (card && this.container) {
      // Get container and card positions relative to each other
      const cardRect = card.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      
      // Calculate relative position and convert to THREE.js coordinates
      // This is a simplified mapping and may need adjustment based on scene scale
      const relX = (cardRect.left + cardRect.width/2) - (containerRect.left + containerRect.width/2);
      const relY = (containerRect.bottom - cardRect.bottom) + cardRect.height;
      
      // Adjust target position based on relative positions
      // Scale factors convert pixels to Three.js units (adjust as needed)
      this.targetPosition = {
        x: relX * 0.01,  // Horizontal offset (might need scaling)
        y: 2.5,          // Fixed vertical position above original
        z: -2            // Behind the card
      };
    }
  }
  
  /**
   * Reset muse position
   */
  resetPosition() {
    if (!this.muse) return;
    
    this.isRising = false;
    this.isHolding = false;
    this.targetCard = null;
    
    // If GSAP is available, animate the return
    if (window.gsap && this.muse) {
      window.gsap.to(this.muse.position, {
        x: this.originalPosition.x,
        y: this.originalPosition.y,
        z: this.originalPosition.z,
        duration: 0.8,
        ease: 'power2.inOut'
      });
      
      window.gsap.to(this.muse.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.5,
        ease: 'power2.out'
      });
    } else {
      // Instant reset
      this.muse.position.x = this.originalPosition.x;
      this.muse.position.y = this.originalPosition.y;
      this.muse.position.z = this.originalPosition.z;
      this.muse.scale.set(1, 1, 1);
    }
    
    // Reset particles if they were modified
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        // Reset to random positions
        positions[i] = (Math.random() - 0.5) * 3;     // x
        positions[i + 1] = (Math.random() - 0.5) * 3; // y
        positions[i + 2] = (Math.random() - 0.5) * 3; // z
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    window.removeEventListener('resize', this.handleResize);
    
    if (this.renderer) {
      this.renderer.dispose();
      
      if (this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
  }
}

export default MuseModel; 