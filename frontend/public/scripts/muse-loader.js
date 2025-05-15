/**
 * Muse Loader 
 * Manages loading and displaying of 3D Muse model for Cognivore
 */

class MuseLoader {
  constructor(container) {
    this.container = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.model = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.animations = {};
    this.currentAnimation = null;
    
    // Bind methods
    this.init = this.init.bind(this);
    this.loadModel = this.loadModel.bind(this);
    this.animate = this.animate.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
    
    // Initialize if THREE is available
    if (typeof THREE !== 'undefined' && this.container) {
      this.init();
    } else {
      console.warn('MuseLoader: THREE.js not loaded or container not found');
    }
  }
  
  init() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111827);
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      45, 
      this.container.clientWidth / this.container.clientHeight, 
      0.1, 
      1000
    );
    this.camera.position.set(0, 1.5, 4);
    this.camera.lookAt(0, 1, 0);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 2, 3);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize);
    
    // Load the model
    this.loadModel();
    
    // Start animation loop
    this.animate();
  }
  
  loadModel() {
    // Check if GLTFLoader is available
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.warn('MuseLoader: GLTFLoader not available');
      return;
    }
    
    const loader = new THREE.GLTFLoader();
    
    // Use a placeholder model path - update this to your actual model path
    const modelPath = './assets/models/muse.glb';
    
    loader.load(
      modelPath,
      (gltf) => {
        this.model = gltf.scene;
        this.model.scale.set(1, 1, 1);
        this.model.position.set(0, 0, 0);
        
        // Apply shadows
        this.model.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        
        this.scene.add(this.model);
        
        // Set up animations if available
        if (gltf.animations && gltf.animations.length) {
          this.mixer = new THREE.AnimationMixer(this.model);
          
          gltf.animations.forEach(animation => {
            const action = this.mixer.clipAction(animation);
            this.animations[animation.name] = action;
            
            // Play the first animation by default
            if (!this.currentAnimation) {
              this.currentAnimation = animation.name;
              action.play();
            }
          });
        }
      },
      (xhr) => {
        // Loading progress 
        console.log(`Loading model: ${Math.floor(xhr.loaded / xhr.total * 100)}%`);
      },
      (error) => {
        console.error('Error loading model:', error);
      }
    );
  }
  
  animate() {
    requestAnimationFrame(this.animate);
    
    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(this.clock.getDelta());
    }
    
    // Rotate model slightly for visual interest
    if (this.model) {
      this.model.rotation.y += 0.005;
    }
    
    this.renderer.render(this.scene, this.camera);
  }
  
  onWindowResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
  
  // Play a specific animation
  playAnimation(name) {
    if (!this.animations[name] || !this.mixer) return;
    
    // Stop current animation
    if (this.currentAnimation && this.animations[this.currentAnimation]) {
      this.animations[this.currentAnimation].fadeOut(0.5);
    }
    
    // Play new animation
    this.animations[name].reset().fadeIn(0.5).play();
    this.currentAnimation = name;
  }
}

// Make available globally
window.MuseLoader = MuseLoader; 