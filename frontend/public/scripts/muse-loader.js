/**
 * Muse Loader Script
 * Handles loading of the 3D model for the Mnemosyne component
 */

// Create global namespace for the loader
window.MuseLoader = (function() {
  // Private variables
  let isInitialized = false;
  let loadPromise = null;
  
  // Create scene and load model
  function initializeThreeJS(containerElement) {
    if (!window.THREE) {
      console.error('THREE.js is not loaded!');
      return Promise.reject(new Error('THREE.js not loaded'));
    }
    
    if (!window.THREE.GLTFLoader) {
      console.error('THREE.GLTFLoader is not loaded!');
      return Promise.reject(new Error('GLTFLoader not loaded'));
    }
    
    // Clear container
    while (containerElement.firstChild) {
      containerElement.removeChild(containerElement.firstChild);
    }
    
    // Create scene
    const scene = new THREE.Scene();
    
    // Set up camera
    const aspectRatio = containerElement.clientWidth / containerElement.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.z = 5;
    
    // Set up renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true // transparent background
    });
    renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); // transparent
    containerElement.appendChild(renderer.domElement);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 1, 2);
    scene.add(directionalLight);
    
    // Create a clock for animations
    const clock = new THREE.Clock();
    
    // Create a group to hold the muse
    const museGroup = new THREE.Group();
    scene.add(museGroup);
    
    // Position the group
    museGroup.position.y = 0.3;
    museGroup.position.z = -0.5;
    museGroup.rotation.y = -Math.PI / 6;
    
    // Add temporary placeholder while model loads
    const sphereGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: 0xf4f4f4,
      emissive: 0x222222,
      specular: 0xffffff,
      shininess: 30,
      transparent: true,
      opacity: 0.9
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    museGroup.add(sphere);
    
    // Add wing-like planes as placeholder
    const wingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    
    const leftWingGeometry = new THREE.PlaneGeometry(0.8, 1.2);
    const leftWing = new THREE.Mesh(leftWingGeometry, wingMaterial);
    leftWing.position.set(-0.5, 0.4, -0.2);
    leftWing.rotation.y = Math.PI / 4;
    museGroup.add(leftWing);
    
    const rightWingGeometry = new THREE.PlaneGeometry(0.8, 1.2);
    const rightWing = new THREE.Mesh(rightWingGeometry, wingMaterial);
    rightWing.position.set(0.5, 0.4, -0.2);
    rightWing.rotation.y = -Math.PI / 4;
    museGroup.add(rightWing);
    
    // Create promise for model loading
    loadPromise = new Promise((resolve, reject) => {
      try {
        // Create loader
        const loader = new THREE.GLTFLoader();
        
        // Load model
        const modelPath = 'assets/models/sea_angel_gltf/scene.gltf';
        console.log('[MuseLoader] Loading model from', modelPath);
        
        loader.load(
          modelPath,
          function(gltf) {
            console.log('[MuseLoader] Model loaded successfully');
            
            // Remove placeholder elements
            while (museGroup.children.length > 0) {
              const child = museGroup.children[0];
              museGroup.remove(child);
              
              if (child.geometry) child.geometry.dispose();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            }
            
            // Add model to group
            const model = gltf.scene;
            model.scale.set(0.4, 0.4, 0.4);
            model.rotation.y = Math.PI;
            museGroup.add(model);
            
            // Set up animations if available
            let mixer = null;
            if (gltf.animations && gltf.animations.length > 0) {
              mixer = new THREE.AnimationMixer(model);
              gltf.animations.forEach(clip => {
                mixer.clipAction(clip).play();
              });
            }
            
            // Add particle effects around the model
            const particlesGeometry = new THREE.BufferGeometry();
            const particleCount = 50;
            
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            
            const color1 = new THREE.Color(0xffffff);
            const color2 = new THREE.Color(0xf0e6ff);
            
            for (let i = 0; i < particleCount; i++) {
              const i3 = i * 3;
              
              positions[i3] = (Math.random() - 0.5) * 3;
              positions[i3 + 1] = (Math.random() - 0.5) * 3;
              positions[i3 + 2] = (Math.random() - 0.5) * 3;
              
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
            
            const particles = new THREE.Points(particlesGeometry, particlesMaterial);
            museGroup.add(particles);
            
            // Set up animation variables
            const animState = {
              isActive: true,
              isRising: false,
              isHolding: false,
              originalPosition: {
                x: museGroup.position.x,
                y: museGroup.position.y,
                z: museGroup.position.z
              },
              targetPosition: {
                x: 0,
                y: 2.0,
                z: -3.5
              },
              riseProgress: 0,
              particles: particles,
              mixer: mixer
            };
            
            // Animation loop
            function animate() {
              const animFrame = requestAnimationFrame(animate);
              
              // Update mixer for animations
              if (animState.mixer) {
                const delta = clock.getDelta();
                animState.mixer.update(delta);
              }
              
              // Gentle rotation when not holding
              if (!animState.isHolding) {
                museGroup.rotation.y += 0.005;
              }
              
              // Handle rising animation
              if (animState.isRising && animState.riseProgress < 1) {
                animState.riseProgress += 0.015;
                
                museGroup.position.x = animState.originalPosition.x + 
                  (animState.targetPosition.x - animState.originalPosition.x) * animState.riseProgress;
                museGroup.position.y = animState.originalPosition.y + 
                  (animState.targetPosition.y - animState.originalPosition.y) * animState.riseProgress;
                museGroup.position.z = animState.originalPosition.z + 
                  (animState.targetPosition.z - animState.originalPosition.z) * animState.riseProgress;
                
                const scale = 1 + animState.riseProgress * 0.3;
                museGroup.scale.set(scale, scale, scale);
                
                if (animState.riseProgress >= 1) {
                  animState.isRising = false;
                  animState.isHolding = true;
                }
              }
              
              // Holding animation
              if (animState.isHolding) {
                const time = Date.now() * 0.001;
                museGroup.position.y = animState.targetPosition.y + Math.sin(time) * 0.15;
                museGroup.rotation.y = Math.PI / 6 + Math.sin(time * 0.5) * 0.1;
                
                if (animState.particles) {
                  const positions = animState.particles.geometry.attributes.position.array;
                  for (let i = 0; i < positions.length; i += 3) {
                    const angle = (i / positions.length) * Math.PI + Math.sin(time * 0.5) * 0.2;
                    positions[i] = Math.cos(angle) * 2;
                    positions[i + 1] = Math.sin(time + i * 0.01) * 0.5;
                    positions[i + 2] = Math.sin(angle) * 1.5;
                  }
                  animState.particles.geometry.attributes.position.needsUpdate = true;
                }
              } else if (!animState.isRising) {
                const time = Date.now() * 0.001;
                museGroup.position.y = animState.originalPosition.y + Math.sin(time) * 0.1;
              }
              
              // Pulse animation when active
              if (animState.isActive && !animState.isRising && !animState.isHolding) {
                const time = Date.now() * 0.001;
                const pulse = Math.sin(time * 2) * 0.05 + 1;
                museGroup.scale.set(pulse, pulse, pulse);
                
                if (animState.particles) {
                  animState.particles.rotation.y += 0.01;
                }
              }
              
              renderer.render(scene, camera);
            }
            
            // Start animation
            animate();
            
            // Handle window resizing
            function handleResize() {
              if (!containerElement) return;
              
              const width = containerElement.clientWidth;
              const height = containerElement.clientHeight;
              
              camera.aspect = width / height;
              camera.updateProjectionMatrix();
              
              renderer.setSize(width, height);
            }
            
            window.addEventListener('resize', handleResize);
            
            // Prepare API for the controller
            const api = {
              scene,
              camera,
              renderer,
              museGroup,
              animState,
              
              activate: function() {
                animState.isActive = true;
              },
              
              deactivate: function() {
                animState.isActive = false;
              },
              
              riseAndHoldCard: function(card) {
                animState.isRising = true;
                animState.riseProgress = 0;
                animState.isHolding = false;
                
                if (card) {
                  const cardRect = card.getBoundingClientRect();
                  const containerRect = containerElement.getBoundingClientRect();
                  
                  const relX = (cardRect.left + cardRect.width/2) - (containerRect.left + containerRect.width/2);
                  const relY = (containerRect.bottom - cardRect.bottom) + cardRect.height;
                  
                  animState.targetPosition = {
                    x: relX * 0.01,
                    y: 2.0,
                    z: -3.5
                  };
                }
              },
              
              resetPosition: function() {
                animState.isRising = false;
                animState.isHolding = false;
                
                museGroup.position.x = animState.originalPosition.x;
                museGroup.position.y = animState.originalPosition.y;
                museGroup.position.z = animState.originalPosition.z;
                museGroup.scale.set(1, 1, 1);
                
                if (animState.particles) {
                  const positions = animState.particles.geometry.attributes.position.array;
                  for (let i = 0; i < positions.length; i += 3) {
                    positions[i] = (Math.random() - 0.5) * 3;
                    positions[i + 1] = (Math.random() - 0.5) * 3;
                    positions[i + 2] = (Math.random() - 0.5) * 3;
                  }
                  animState.particles.geometry.attributes.position.needsUpdate = true;
                }
              },
              
              dispose: function() {
                window.removeEventListener('resize', handleResize);
                renderer.dispose();
                if (containerElement.contains(renderer.domElement)) {
                  containerElement.removeChild(renderer.domElement);
                }
              }
            };
            
            // Resolve the promise with the API
            resolve(api);
            
          },
          function(xhr) {
            console.log('[MuseLoader] ' + (xhr.loaded / xhr.total * 100) + '% loaded');
          },
          function(error) {
            console.error('[MuseLoader] Error loading model:', error);
            reject(error);
          }
        );
      } catch (error) {
        console.error('[MuseLoader] Error setting up model:', error);
        reject(error);
      }
    });
    
    return loadPromise;
  }
  
  // Public API
  return {
    initialize: function(container) {
      if (isInitialized) {
        console.warn('[MuseLoader] Already initialized');
        return loadPromise;
      }
      
      isInitialized = true;
      return initializeThreeJS(container);
    }
  };
})(); 