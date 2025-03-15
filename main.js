/*
To do:
Add level select on the game over / restart screen
Glossy 3D buttons
Some animations
Background music?
Weird error where the game freezes / breaks?
Audit the score / level / speed progression calcs
Frutiger Aero styling for the whole page
Play sound upon level up
*/

// Game constants
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 1;
const COLORS = [
    0xff0000, // Red - I
    0x00ff00, // Green - J
    0x0000ff, // Blue - L
    0xffff00, // Yellow - O
    0xff00ff, // Magenta - S
    0x00ffff, // Cyan - T
    0xffa500  // Orange - Z
];

// Tetromino shapes
const SHAPES = [
    [[1, 1, 1, 1]],                        // I
    [[1, 0, 0], [1, 1, 1]],                // J
    [[0, 0, 1], [1, 1, 1]],                // L
    [[1, 1], [1, 1]],                      // O
    [[0, 1, 1], [1, 1, 0]],                // S
    [[0, 1, 0], [1, 1, 1]],                // T
    [[1, 1, 0], [0, 1, 1]]                 // Z
];

// Game variables
let scene, camera, renderer;
let board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
let currentPiece = null;
let nextPiece = null;
let currentPosition = { x: 0, y: 0 };
let score = 0;
let highScore = 0;
let level = 1;
let initialGameSpeed = 1100;
let speedProgression = 100;
let gameSpeed = initialGameSpeed; // milliseconds
let gameOver = false;
let gameStarted = false;
let gamePaused = false;
let gameLoop;
let blocks = [];
let ghostBlocks = [];
let nextPieceRenderer = null;
let nextPieceScene = null;
let nextPieceCamera = null;

// Initialize Three.js
function init() {
  // Initialize audio first
  initAudio();

  // Initialize object pooling and material caching (from performance improvements)
  initPerformanceMode();
  
  // Initialize performance monitoring
  let lastUpdateTime = 0;
  let gameLoopId = null;
  
  // Load high score from localStorage with fallback
  try {
      highScore = localStorage.getItem('tetrisHighScore') || 0;
      document.getElementById('high-score').textContent = highScore;
  } catch (e) {
      console.log('localStorage not available, high score tracking disabled');
      document.getElementById('high-score-container').style.display = 'none';
  }
  
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  // Create camera
  const aspectRatio = window.innerWidth / window.innerHeight;
  const viewSize = 25;
  camera = new THREE.OrthographicCamera(
      -aspectRatio * viewSize / 2,
      aspectRatio * viewSize / 2,
      viewSize / 2,
      -viewSize / 2,
      1,
      1000
  );
  camera.position.set(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 20);
  camera.lookAt(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 0);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('game-container').appendChild(renderer.domElement);

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 30);
  scene.add(directionalLight);

  // Create game board grid
  createGrid();
  createThreeBorder();

  // Create pause button
  createPauseButton();
  
  // Add event listeners
  window.addEventListener('keydown', handleKeyPress);
  window.addEventListener('resize', handleResize);
  document.getElementById('restart-button').addEventListener('click', restartGame);
  document.getElementById('start-button').addEventListener('click', startGame);
  document.getElementById('pause-button').addEventListener('click', togglePause);
  
  // Initialize next piece preview
  initNextPiecePreview();
  
  // Initialize touch controls for mobile
  initTouchControls();
    
  // Add document visibility handling
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // ======= PERFORMANCE OPTIMIZATIONS =======
  
  // Initialize pooled geometries and materials
  blockGeometryPool.init();
  materialCache.init();
  
  // Apply mobile-specific optimizations
  if (isMobileDevice()) {
    console.log("Applying mobile optimizations");
    
    // Lower resolution for mobile
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    
    // Simpler lighting for mobile
    scene.children.forEach(child => {
      if (child.isLight && !(child.isAmbientLight)) {
        child.intensity *= 0.7; // Reduce non-ambient light intensity
      }
    });
    
    // Add touch-event throttling
    let lastTouchMoveTime = 0;
    const TOUCH_THROTTLE_MS = 16; // ~60fps
    const originalHandleTouchMove = handleTouchMove;
    
    handleTouchMove = function(event) {
      // Apply throttling
      const now = performance.now();
      if (now - lastTouchMoveTime < TOUCH_THROTTLE_MS) {
        return; // Skip this update if it's too soon
      }
      lastTouchMoveTime = now;
      
      // Call original handler with throttling
      originalHandleTouchMove(event);
    };
    
    // Debounce resize events
    const originalHandleResize = handleResize;
    let resizeTimeout;
    
    handleResize = function() {
      // Debounce resize events which can be very frequent
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        originalHandleResize();
      }, 250); // Only handle resize after 250ms of inactivity
    };
  }
  
  // Replace interval-based game loop with requestAnimationFrame
  // Remove any existing interval
  if (gameLoop) {
    clearInterval(gameLoop);
    gameLoop = null;
  }
  
  // Set up FPS monitoring
  const fpsCounter = {
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
          console.log("Enabling low performance mode, FPS:", this.fps);
          
          // Reduce rendering resolution
          renderer.setPixelRatio(0.7);
          
          // Simplify ghost blocks (reduce opacity)
          materialCache.ghostMaterial.opacity = 0.15;
        }
      }
    }
  };
  
  // Enhanced animation function with game loop integrated
  function enhancedAnimate(timestamp) {
    gameLoopId = requestAnimationFrame(enhancedAnimate);
    
    // Update FPS counter
    fpsCounter.update(timestamp);
    
    // Render the game scene
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
    
    // Perform periodic memory cleanup
    if (timestamp % 30000 < 20) { // Every ~30 seconds
      renderer.renderLists.dispose();
    }
  }
  
  // Start the animation loop (which now includes game updates)
  gameLoopId = requestAnimationFrame(enhancedAnimate);
}

// Object pooling for block geometry and materials
const blockGeometryPool = {
  geometry: null,
  borderGeometry: null,
  init() {
    this.geometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.95, BLOCK_SIZE * 0.95, BLOCK_SIZE * 0.95);
    this.borderGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  },
  getGeometry() {
    return this.geometry;
  },
  getBorderGeometry() {
    return this.borderGeometry;
  }
};

// Material caching to reduce object creation
const materialCache = {
  blockMaterials: {},
  borderMaterial: null,
  ghostMaterial: null,
  init() {
    // Create shared border material
    this.borderMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xcccccc, 
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    
    // Create ghost material
    this.ghostMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x888888, 
      transparent: true, 
      opacity: 0.25
    });
  },
  getBlockMaterial(color) {
    // Cache materials by color
    if (!this.blockMaterials[color]) {
      this.blockMaterials[color] = new THREE.MeshPhongMaterial({ color: color });
    }
    return this.blockMaterials[color];
  },
  getBorderMaterial() {
    return this.borderMaterial;
  },
  getGhostMaterial() {
    return this.ghostMaterial;
  }
};

// Helper function for visibility changes
function handleVisibilityChange() {
  if (document.hidden) {
    // Page is not visible, pause the game to save resources
    if (gameStarted && !gameOver && !gamePaused) {
      // Auto-pause when switching away
      gamePaused = true;
      
      // Save state of pause button
      const pauseButton = document.getElementById('pause-button').querySelector('button');
      pauseButton.textContent = '▶️';
      
      // Show pause overlay if it doesn't exist
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
    }
  }
}

// Start the game
function startGame() {
  console.log("start game");
  document.getElementById('start-screen').style.display = 'none';
  gameStarted = true;
  
  // Get the selected starting level
  const selectedLevel = parseInt(document.getElementById('starting-level').value);
  level = selectedLevel;
  gameSpeed = Math.max(100, initialGameSpeed - ((level - 1) * speedProgression) );
  
  resetGame();
}

function restartGame(){
    
    gameStarted = true;

    // Get the selected starting level
    const selectedLevel = parseInt(document.getElementById('restarting-level').value);
    level = selectedLevel;
    gameSpeed = Math.max(100, initialGameSpeed - ((level - 1) * speedProgression) );
    resetGame();
}

// Initialize the next piece preview
function initNextPiecePreview() {
    const canvas = document.getElementById('next-piece-canvas');
    
    // Create renderer
    nextPieceRenderer = new THREE.WebGLRenderer({ 
        canvas: canvas,
        antialias: true 
    });
    if(mobileDeviceFlag){
      console.log("small next piece preview window");
      nextPieceRenderer.setSize(50, 50);
    } else {
      console.log("large next piece preview window");
      nextPieceRenderer.setSize(100, 100);
    }
    nextPieceRenderer.setClearColor(0x111111);
    
    // Create scene
    nextPieceScene = new THREE.Scene();
    
    // Create camera
    nextPieceCamera = new THREE.OrthographicCamera(-3, 3, 3, -3, 1, 10);
    nextPieceCamera.position.z = 5;
    
    // Add lights (these will be recreated in renderNextPiecePreview)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    nextPieceScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 3, 5);
    nextPieceScene.add(directionalLight);
    
    // Force initial render
    nextPieceRenderer.render(nextPieceScene, nextPieceCamera);
    
    console.log("Next piece preview initialized");
}

// Render the next piece preview
function renderNextPiecePreview() {
    // First thoroughly clean the scene
    while (nextPieceScene.children.length > 0) {
        const object = nextPieceScene.children[0];
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
            } else {
                object.material.dispose();
            }
        }
        nextPieceScene.remove(object);
    }
    
    // Add lights back to the scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    nextPieceScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 3, 5);
    nextPieceScene.add(directionalLight);
    
    if (!nextPiece) {
        console.error("No next piece to render in preview!");
        nextPieceRenderer.render(nextPieceScene, nextPieceCamera);
        return;
    }
    
    // Calculate center position
    const offsetX = nextPiece.shape[0].length / 2;
    const offsetY = nextPiece.shape.length / 2;
    
    // Add blocks for next piece
    for (let y = 0; y < nextPiece.shape.length; y++) {
        for (let x = 0; x < nextPiece.shape[y].length; x++) {
            if (nextPiece.shape[y][x]) {
                const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
                const material = new THREE.MeshPhongMaterial({ color: nextPiece.color });
                const cube = new THREE.Mesh(geometry, material);
                
                // Position the cube centered in preview
                cube.position.set(x - offsetX + 0.5, -y + offsetY - 0.5, 0);
                
                nextPieceScene.add(cube);
            }
        }
    }
    
    // Force a render
    nextPieceRenderer.render(nextPieceScene, nextPieceCamera);
}

// Create grid lines for visual reference
function createGrid() {
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
    
    // Vertical lines
    for (let x = 0; x <= BOARD_WIDTH; x++) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, 0, 0),
            new THREE.Vector3(x, BOARD_HEIGHT, 0)
        ]);
        const line = new THREE.Line(geometry, gridMaterial);
        scene.add(line);
    }
    
    // Horizontal lines
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, y, 0),
            new THREE.Vector3(BOARD_WIDTH, y, 0)
        ]);
        const line = new THREE.Line(geometry, gridMaterial);
        scene.add(line);
    }

    // Add a background plane
    const backGeometry = new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT);
    const backMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const backPlane = new THREE.Mesh(backGeometry, backMaterial);
    backPlane.position.set(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, -0.1);
    scene.add(backPlane);
}

// Generate the next piece
function generateNextPiece() {
    const shapeIndex = Math.floor(Math.random() * SHAPES.length);
    nextPiece = {
        shape: SHAPES[shapeIndex],
        color: COLORS[shapeIndex]
    };
    
    // Render the next piece in the preview window
    if (nextPieceScene && nextPieceCamera && nextPieceRenderer) {
        renderNextPiecePreview();
    } else {
        console.error("Next piece preview components not initialized");
    }
}

// Reset game state
function resetGame() {
  // Clear the board
  board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
  
  // Clear all blocks from the scene
  blocks.forEach(block => {
    scene.remove(block);
    // Properly dispose of geometries and materials (if not shared)
    if (block.children) {
      block.children.forEach(child => {
        if (child.geometry && !child.geometry.isShared) child.geometry.dispose();
        if (child.material && !child.material.isShared) child.material.dispose();
      });
    }
  });
  blocks = [];
  
  // Clear ghost blocks
  ghostBlocks.forEach(block => scene.remove(block));
  ghostBlocks = [];
  
  // Reset variables
  score = 0;
  if (!gameStarted) {
    level = 1;
    gameSpeed = initialGameSpeed;
  }
  gameOver = false;
  lastUpdateTime = 0; // Reset time for RAF-based game loop
  
  // Update UI
  document.getElementById('score').textContent = score;
  document.getElementById('level').textContent = level;
  document.getElementById('game-over').style.display = 'none';
  
  // No need to reset interval as we're using requestAnimationFrame
  
  // First, generate a random piece for the preview window
  const shapeIndex = Math.floor(Math.random() * SHAPES.length);
  nextPiece = {
    shape: SHAPES[shapeIndex],
    color: COLORS[shapeIndex]
  };
  
  // Update the preview window
  renderNextPiecePreview();
  
  // Then spawn the first piece
  spawnNewPiece();
}

// Create a new Tetromino piece
function spawnNewPiece() {
  // Use the piece that was shown in the preview
  currentPiece = nextPiece;
  
  // Position at top center
  currentPosition = {
      x: Math.floor(BOARD_WIDTH / 2) - Math.floor(currentPiece.shape[0].length / 2),
      y: BOARD_HEIGHT - currentPiece.shape.length
  };
  
  // Generate new nextPiece for the preview
  generateNextPiece();
  
  // Check if the new piece can be placed
  if (!isValidMove(currentPosition.x, currentPosition.y, currentPiece.shape)) {
      gameOver = true;
      clearInterval(gameLoop);
      
      // Play game over sound
      gameOverSound();
      
      // Update high score if localStorage is available
      try {
          if (score > highScore) {
              highScore = score;
              localStorage.setItem('tetrisHighScore', highScore);
              document.getElementById('high-score').textContent = highScore;
          }
      } catch (e) {
          // Skip high score update if localStorage is not available
      }
      
      document.getElementById('final-score').textContent = score;
      try {
          document.getElementById('final-high-score').textContent = highScore;
      } catch (e) {
          // Ignore if high score display isn't available
      }
      document.getElementById('game-over').style.display = 'block';
      return;
  }
  
  // Create and add the blocks to the scene
  renderPiece();
  
  // Trigger the new piece event
  triggerNewPieceEvent();
}

// Render the current piece
function renderPiece() {
    // Remove old blocks for this piece
    const oldBlocks = blocks.filter(block => block.userData.isPiece);
    oldBlocks.forEach(block => {
        scene.remove(block);
        blocks = blocks.filter(b => b !== block);
    });
    
    // Remove old ghost blocks
    ghostBlocks.forEach(block => scene.remove(block));
    ghostBlocks = [];
    
    // Create new blocks for current piece
    for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
            if (currentPiece.shape[y][x]) {
                const blockX = currentPosition.x + x;
                const blockY = currentPosition.y + y;
                createBlock(blockX, blockY, currentPiece.color, true);
            }
        }
    }
    
    // Create ghost piece (shadow)
    createGhostPiece();
}

// Create a block at the given position
function createBlock(x, y, color, isPiece = false) {
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
}

function cleanupBlock(block) {
  scene.remove(block);
  
  // In pooled mode, we don't need to dispose geometries or shared materials
  // Just remove references to the block
  return null;
}

// Create a ghost piece to show where the current piece will land
function createGhostPiece() {
  // Calculate drop position
  let dropY = currentPosition.y;
  while (isValidMove(currentPosition.x, dropY - 1, currentPiece.shape)) {
    dropY--;
  }
  
  // Don't show ghost if it would be at the same position as the current piece
  if (dropY === currentPosition.y) {
    return;
  }
  
  // Clear old ghost blocks
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
}

// Check if the move is valid
function isValidMove(newX, newY, shape) {
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const boardX = newX + x;
                const boardY = newY + y;
                
                // Check boundaries
                if (boardX < 0 || boardX >= BOARD_WIDTH || boardY < 0) {
                    return false;
                }
                
                // Check if position is already filled
                if (boardY < BOARD_HEIGHT && board[boardY][boardX]) {
                    return false;
                }
            }
        }
    }
    return true;
}

// Move the current piece
function movePiece(dx, dy) {
    const newX = currentPosition.x + dx;
    const newY = currentPosition.y + dy;
    
    if (isValidMove(newX, newY, currentPiece.shape)) {
        currentPosition.x = newX;
        currentPosition.y = newY;
        renderPiece();
        
        // Play move sound when moving horizontally
        if (dx !== 0 && dy === 0) {
            moveSound();
        }
        
        return true;
    }
    return false;
}

// Add this function to create a custom event
function triggerNewPieceEvent() {
  const newPieceEvent = new Event('newPieceSpawned');
  document.dispatchEvent(newPieceEvent);
}

// Rotate the current piece
function rotatePiece() {
    const rotated = [];
    for (let x = 0; x < currentPiece.shape[0].length; x++) {
        const row = [];
        for (let y = currentPiece.shape.length - 1; y >= 0; y--) {
            row.push(currentPiece.shape[y][x]);
        }
        rotated.push(row);
    }
    
    if (isValidMove(currentPosition.x, currentPosition.y, rotated)) {
        currentPiece.shape = rotated;
        renderPiece();
        
        // Play rotate sound
        rotateSound();
        
        return true;
    }
    return false;
}

// Lock the current piece in place
function lockPiece() {
  for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x]) {
              const boardX = currentPosition.x + x;
              const boardY = currentPosition.y + y;
              
              if (boardY >= 0 && boardY < BOARD_HEIGHT) {
                  board[boardY][boardX] = currentPiece.color;
                  
                  // Convert current piece blocks to locked blocks
                  blocks.forEach(block => {
                      if (block.userData.isPiece && 
                          block.userData.x === boardX && 
                          block.userData.y === boardY) {
                          block.userData.isPiece = false;
                      }
                  });
              }
          }
      }
  }
  
  // Check for completed lines
  checkLines();
  
  // Spawn a new piece
  spawnNewPiece();
}

// Drop the piece all the way down
function dropPiece() {
    let dropped = false;
    let droppedRows = 0;
    
    while (movePiece(0, -1)) {
        dropped = true;
        droppedRows++;
    }
    
    if (dropped) {
        // Play drop sound
        dropSound();
        
        // Add bonus points for hard drop (1 point per row)
        score += droppedRows;
        document.getElementById('score').textContent = score;
        
        lockPiece();
    }
}

// Check for completed lines
function checkLines() {
  let linesCleared = 0;
  
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    let complete = true;
    
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (!board[y][x]) {
        complete = false;
        break;
      }
    }
  
    if (complete) {
      // Clear the line
      for (let y2 = y; y2 < BOARD_HEIGHT - 1; y2++) {
        board[y2] = [...board[y2 + 1]];
      }
      board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill(0);
      
      // Remove blocks for this line with proper cleanup
      const blocksToRemove = blocks.filter(block => !block.userData.isPiece && block.userData.y === y);
      blocksToRemove.forEach(block => {
        cleanupBlock(block);
      });
      blocks = blocks.filter(b => !blocksToRemove.includes(b));
      
      // Update positions of blocks above this line
      blocks.forEach(block => {
        if (!block.userData.isPiece && block.userData.y > y) {
          block.userData.y--;
          block.position.y -= BLOCK_SIZE;
        }
      });
      
      linesCleared++;
      y--; // Check the same line again
    }
  }
  
  // Update score
  if (linesCleared > 0) {
      // Play clear line sound and pass the number of lines cleared
      clearLineSound(linesCleared);
      
      const points = [0, 40, 100, 250, 600][linesCleared] * level;
      score += points;
      document.getElementById('score').textContent = score;
      
      // Update high score if needed and localStorage is available
      try {
          if (score > highScore) {
              highScore = score;
              localStorage.setItem('tetrisHighScore', highScore);
              document.getElementById('high-score').textContent = highScore;
          }
      } catch (e) {
          // Skip high score update if localStorage is not available
      }
      
      // Increase level every 10 lines
      const newLevel = Math.floor(score / 1000) + 1;
      if (newLevel > level) {
          level = newLevel;
          document.getElementById('level').textContent = level;
          
          // Speed up the game
          gameSpeed = Math.max(100, initialGameSpeed - ((level - 1) * speedProgression) );
          clearInterval(gameLoop);
          gameLoop = setInterval(update, gameSpeed);
      }
  }
}

// Main game update function
function update() {
    if (gameOver || !gameStarted || gamePaused) return;
    
    // Move piece down
    if (!movePiece(0, -1)) {
        lockPiece();
    }
}

// Handle keyboard input
function handleKeyPress(event) {
    if (gameOver || !gameStarted) return;
    
    // Toggle pause with 'P' key
    if (event.keyCode === 80) { // P key
        togglePause();
        return;
    }
    
    // Don't process movement keys if game is paused
    if (gamePaused) return;
    
    switch (event.keyCode) {
        case 37: // Left arrow
            movePiece(-1, 0);
            break;
        case 39: // Right arrow
            movePiece(1, 0);
            break;
        case 40: // Down arrow
            movePiece(0, -1);
            break;
        case 38: // Up arrow
            rotatePiece();
            break;
        case 32: // Space
            event.preventDefault();
            dropPiece();
            break;
    }
}

// Handle window resize
function handleResize() {
    const aspectRatio = window.innerWidth / window.innerHeight;
    const viewSize = 25;
    
    camera.left = -aspectRatio * viewSize / 2;
    camera.right = aspectRatio * viewSize / 2;
    camera.top = viewSize / 2;
    camera.bottom = -viewSize / 2;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Create pause button
function createPauseButton() {
    const pauseButton = document.createElement('div');
    pauseButton.id = 'pause-button';
    pauseButton.innerHTML = '<button class="button">⏸️</button>';
    pauseButton.style.position = 'absolute';
    pauseButton.style.left = '20px';
    pauseButton.style.top = '0px';
    pauseButton.style.zIndex = '100';
    document.getElementById('game-container').appendChild(pauseButton);
}

// Toggle pause state
function togglePause() {
    if (!gameStarted || gameOver) return;
    
    gamePaused = !gamePaused;
    
    const pauseButton = document.getElementById('pause-button').querySelector('button');
    
    if (gamePaused) {
        pauseButton.textContent = '▶️';
        clearInterval(gameLoop);
        
        // Create pause overlay
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
    } else {
        pauseButton.textContent = '⏸️';
        gameLoop = setInterval(update, gameSpeed);
        
        // Remove pause overlay
        const overlay = document.getElementById('pause-overlay');
        if (overlay) {
            overlay.parentNode.removeChild(overlay);
        }
    }
}

// Animation loop
let lastUpdateTime = 0;
let gameLoopId = null;

// Replace the main animate function with this improved version
function animate(timestamp) {
  gameLoopId = requestAnimationFrame(animate);
  
  // Render the game scene
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
}

// Function to create a border in the Three.js scene
function createThreeBorder() {

  // Calculate the actual board dimensions
  const boardWidth = BOARD_WIDTH;
  const boardHeight = BOARD_HEIGHT;
  
  // Create an inner border with a different color for contrast
  const innerBorderMaterial = new THREE.LineBasicMaterial({ 
    color: 0xFFFFFF, // White
    transparent: true,
    opacity: 0.8,
    linewidth: 6,
  });
  
  // Create slightly smaller inner border
  const innerBorderGeometry = new THREE.BufferGeometry().setFromPoints([
    // Bottom edge
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(boardWidth, 0, 0),
    
    // Right edge
    new THREE.Vector3(boardWidth, 0, 0),
    new THREE.Vector3(boardWidth, boardHeight, 0),
    
    // Top edge
    new THREE.Vector3(boardWidth, boardHeight, 0),
    new THREE.Vector3(0, boardHeight, 0),
    
    // Left edge
    new THREE.Vector3(0, boardHeight, 0),
    new THREE.Vector3(0, 0, 0)
  ]);
  
  const innerBorderLines = new THREE.LineSegments(innerBorderGeometry, innerBorderMaterial);
  
  // Add the inner border to the scene
  scene.add(innerBorderLines);

}

// Start the game when the page loads
let mobileDeviceFlag = isMobileDevice();
console.log("mobile device: "+mobileDeviceFlag);
window.onload = init;