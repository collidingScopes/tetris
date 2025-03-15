// Initialize the performance mode based on device capability
function initPerformanceMode(isMobile, isLowPerformance) {
  
  // Initialize pooled geometries and materials
  blockGeometryPool.init();
  materialCache.init();
  
  // Set up FPS monitoring
  const fpsMonitor = {
    frameCount: 0,
    lastCheck: 0,
    fps: 60,
    lowPerformanceMode: false,
    
    update(timestamp) {
      this.frameCount++;
      
      // Calculate FPS every second
      if (timestamp - this.lastCheck >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastCheck = timestamp;
        
        // Check if we need to adjust performance settings
        if (this.fps < 40 && !this.lowPerformanceMode) {
          this.lowPerformanceMode = true;
          this.applyLowPerformanceMode();
        }
      }
    },
    
    // Apply low performance mode settings
    applyLowPerformanceMode() {
      console.log("Enabling low performance mode due to low FPS:", this.fps);
      
      // Reduce rendering resolution
      renderer.setPixelRatio(0.7);
      
      // Simplify ghost blocks (reduce opacity or disable)
      if (materialCache.ghostMaterial) {
        materialCache.ghostMaterial.opacity = 0.15;
      }
      
      // Disable some visual effects
      if (scene) {
        // Reduce lighting complexity
        scene.children.forEach(child => {
          if (child.isLight && child.type === "DirectionalLight") {
            child.intensity *= 0.5;
          }
        });
      }
      
      // Simplify the next piece preview
      updateNextPiecePreviewForLowPerformance();
    }
  };
  
  // Add FPS monitoring to animation loop
  const originalAnimate = animate;
  animate = function(timestamp) {
    // Update FPS counter
    fpsMonitor.update(timestamp);
    
    // Call the original animation function
    originalAnimate(timestamp);
  };
  
  // Apply performance settings based on device
  if (isMobile) {
    console.log("Applying mobile-specific performance optimizations");
    
    // Lower resolution for mobile
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    
    // Simpler lighting for mobile
    scene.children.forEach(child => {
      if (child.isLight && !(child.isAmbientLight)) {
        child.intensity *= 0.7; // Reduce non-ambient light intensity
      }
    });
    
    // Optimize resize event handling
    setupResizeEventThrottling();
    
    // Simplified next piece preview
    updateNextPiecePreviewForMobile();
    
    // Add visibility change detection for better battery life
    setupVisibilityChangeHandler();
    
    // Set up memory cleanup at regular intervals
    setupPeriodicMemoryCleanup();
  }
  
  // Replace the inefficient setInterval game loop with requestAnimationFrame
  setupImprovedGameLoop();
  
  // Override object creation functions to use pooling
  overrideObjectCreationFunctions();
}

// Helper functions for initPerformanceMode

// Function to update next piece preview for mobile
function updateNextPiecePreviewForMobile() {
  if (!nextPieceRenderer) return;
  
  // Make the preview smaller for mobile
  nextPieceRenderer.setSize(50, 50);
  
  // Optimize the preview rendering function
  const originalRenderNextPiecePreview = renderNextPiecePreview;
  renderNextPiecePreview = function() {
    // Clean the scene thoroughly first
    while (nextPieceScene.children.length > 0) {
      const object = nextPieceScene.children[0];
      nextPieceScene.remove(object);
    }
    
    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    nextPieceScene.add(ambientLight);
    
    if (!nextPiece) {
      nextPieceRenderer.render(nextPieceScene, nextPieceCamera);
      return;
    }
    
    // Calculate center position
    const offsetX = nextPiece.shape[0].length / 2;
    const offsetY = nextPiece.shape.length / 2;
    
    // Add blocks for next piece using shared materials and geometries
    for (let y = 0; y < nextPiece.shape.length; y++) {
      for (let x = 0; x < nextPiece.shape[y].length; x++) {
        if (nextPiece.shape[y][x]) {
          const geometry = blockGeometryPool.getGeometry();
          const material = materialCache.getBlockMaterial(nextPiece.color);
          const cube = new THREE.Mesh(geometry, material);
          
          // Position the cube centered in preview
          cube.position.set(x - offsetX + 0.5, -y + offsetY - 0.5, 0);
          
          nextPieceScene.add(cube);
        }
      }
    }
    
    // Render once
    nextPieceRenderer.render(nextPieceScene, nextPieceCamera);
  };
}

// Function to update next piece preview for low performance mode
function updateNextPiecePreviewForLowPerformance() {
  if (!nextPieceRenderer) return;
  
  // Set even smaller size for low performance mode
  nextPieceRenderer.setSize(40, 40);
  
  // Even more simplified preview
  renderNextPiecePreview = function() {
    // Thorough scene cleanup
    while (nextPieceScene.children.length > 0) {
      nextPieceScene.remove(nextPieceScene.children[0]);
    }
    
    // Minimal lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    nextPieceScene.add(ambientLight);
    
    if (!nextPiece) {
      nextPieceRenderer.render(nextPieceScene, nextPieceCamera);
      return;
    }
    
    // Use a single merged geometry for all blocks to reduce draw calls
    const offsetX = nextPiece.shape[0].length / 2;
    const offsetY = nextPiece.shape.length / 2;
    
    // Create a single mesh for the entire piece
    const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const material = materialCache.getBlockMaterial(nextPiece.color);
    
    for (let y = 0; y < nextPiece.shape.length; y++) {
      for (let x = 0; x < nextPiece.shape[y].length; x++) {
        if (nextPiece.shape[y][x]) {
          const cube = new THREE.Mesh(geometry, material);
          cube.position.set(x - offsetX + 0.5, -y + offsetY - 0.5, 0);
          nextPieceScene.add(cube);
        }
      }
    }
    
    // Render once with no antialiasing
    nextPieceRenderer.render(nextPieceScene, nextPieceCamera);
  };
}

// Function to optimize resize event handling
function setupResizeEventThrottling() {
  // Debounce resize events which can be costly
  const originalHandleResize = handleResize;
  let resizeTimeout;
  
  handleResize = function() {
    // Cancel previous timeout
    clearTimeout(resizeTimeout);
    
    // Set a new timeout to handle resize after a delay
    resizeTimeout = setTimeout(() => {
      originalHandleResize();
    }, 250); // Only handle resize after 250ms of inactivity
  };
}

// Function to handle visibility changes for better battery life
function setupVisibilityChangeHandler() {
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Page is not visible, pause game to save resources
      if (gameStarted && !gameOver && !gamePaused) {
        // Auto-pause
        gamePaused = true;
        
        // Update UI to reflect paused state
        const pauseButton = document.getElementById('pause-button').querySelector('button');
        pauseButton.textContent = '▶️';
        
        // Show pause overlay
        if (!document.getElementById('pause-overlay')) {
          const overlay = document.createElement('div');
          overlay.id = 'pause-overlay';
          overlay.style.position = 'absolute';
          overlay.style.top = '50%';
          overlay.style.left = '50%';
          overlay.style.transform = 'translate(-50%, -50%)';
          overlay.style.background = 'rgba(0,0,0,0.7)';
          overlay.style.padding = '20px';
          overlay.style.borderRadius = '10px';
          overlay.style.color = 'white';
          overlay.style.fontSize = '24px';
          overlay.style.fontWeight = 'bold';
          overlay.style.zIndex = '90';
          overlay.textContent = 'PAUSED';
          document.getElementById('game-container').appendChild(overlay);
        }
        
        // Cancel any pending animation frame
        if (gameLoopId) {
          cancelAnimationFrame(gameLoopId);
          gameLoopId = null;
        }
      }
    } else {
      // Page is visible again, resume animation loop if needed
      if (gameLoopId === null && gameStarted && !gameOver) {
        gameLoopId = requestAnimationFrame(animate);
      }
    }
  });
}

// Function to set up periodic memory cleanup
function setupPeriodicMemoryCleanup() {
  let lastMemoryCleanupTime = 0;
  const MEMORY_CLEANUP_INTERVAL = 30000; // 30 seconds
  
  // Add to animation loop
  const originalAnimate = animate;
  animate = function(timestamp) {
    // Call original animation function
    originalAnimate(timestamp);
    
    // Perform memory cleanup periodically
    if (timestamp - lastMemoryCleanupTime > MEMORY_CLEANUP_INTERVAL) {
      lastMemoryCleanupTime = timestamp;
      
      // Clean up renderer
      renderer.renderLists.dispose();
      
      // Remove unused materials from cache
      for (const colorKey in materialCache.blockMaterials) {
        const inUse = blocks.some(block => 
          block.userData.color && block.userData.color.toString() === colorKey
        );
        
        if (!inUse) {
          materialCache.blockMaterials[colorKey].dispose();
          delete materialCache.blockMaterials[colorKey];
        }
      }
    }
  };
}

// Function to replace setInterval with requestAnimationFrame
function setupImprovedGameLoop() {
  // Clear any existing interval
  if (gameLoop) {
    clearInterval(gameLoop);
    gameLoop = null;
  }
  
  // Track last update time
  let lastUpdateTime = 0;
  
  // Replace animate function with one that includes game logic updates
  const originalAnimate = animate;
  animate = function(timestamp) {
    // Set up next animation frame
    gameLoopId = requestAnimationFrame(animate);
    
    // Render the scene
    renderer.render(scene, camera);
    
    // Skip game logic if game is not running
    if (!gameStarted || gameOver || gamePaused) return;
    
    // Calculate time since last update
    if (!lastUpdateTime) lastUpdateTime = timestamp;
    const elapsed = timestamp - lastUpdateTime;
    
    // Update game state if enough time has passed
    if (elapsed >= gameSpeed) {
      update();
      lastUpdateTime = timestamp;
    }
  };
}

// Function to override object creation to use pooling
function overrideObjectCreationFunctions() {
  // Override createBlock to use pooled geometries and cached materials
  const originalCreateBlock = createBlock;
  createBlock = function(x, y, color, isPiece = false) {
    // Create a group to hold both the main block and its border
    const blockGroup = new THREE.Group();
    
    // Main block (using pooled geometry and cached materials)
    const cube = new THREE.Mesh(
      blockGeometryPool.getGeometry(),
      materialCache.getBlockMaterial(color)
    );
    
    // Border using pooled geometry and shared material
    const border = new THREE.Mesh(
      blockGeometryPool.getBorderGeometry(),
      materialCache.getBorderMaterial()
    );
    
    // Add both to the group
    blockGroup.add(cube);
    blockGroup.add(border);
    
    // Position the group
    blockGroup.position.set(x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2, 0);
    
    // Add custom data for tracking
    blockGroup.userData = { x, y, color, isPiece };
    
    // Add to scene and blocks array
    scene.add(blockGroup);
    blocks.push(blockGroup);
    
    return blockGroup;
  };
  
  // Override createGhostPiece to use pooled resources
  const originalCreateGhostPiece = createGhostPiece;
  createGhostPiece = function() {
    // Calculate drop position
    let dropY = currentPosition.y;
    while (isValidMove(currentPosition.x, dropY - 1, currentPiece.shape)) {
      dropY--;
    }
    
    // Don't show ghost if it would be at the same position as the current piece
    if (dropY === currentPosition.y) {
      return;
    }
    
    // Remove old ghost blocks
    ghostBlocks.forEach(block => scene.remove(block));
    ghostBlocks = [];
    
    // Create ghost blocks using shared material from cache
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x]) {
          const blockX = currentPosition.x + x;
          const blockY = dropY + y;
          
          // Create a group for ghost piece with border
          const ghostGroup = new THREE.Group();
          
          // Main ghost block with shared geometry and material
          const cube = new THREE.Mesh(
            blockGeometryPool.getGeometry(),
            materialCache.getGhostMaterial()
          );
          
          // Border with shared geometry and material
          const border = new THREE.Mesh(
            blockGeometryPool.getBorderGeometry(),
            materialCache.getBorderMaterial()
          );
          
          // Add both to the group
          ghostGroup.add(cube);
          ghostGroup.add(border);
          
          // Position the group
          ghostGroup.position.set(blockX + BLOCK_SIZE / 2, blockY + BLOCK_SIZE / 2, 0);
          
          // Add to scene and ghost blocks array
          scene.add(ghostGroup);
          ghostBlocks.push(ghostGroup);
        }
      }
    }
  };
}