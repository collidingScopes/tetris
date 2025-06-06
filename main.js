/*
To do:
Some animations
Background music?
Play sound upon level up / locking the block
Increase sensitivity of multi-movement drags to the left / right
*/

// Game constants
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 1;

// const COLORS = [
//     0xff0000, // Red - I
//     0x00ff00, // Green - J
//     0x0000ff, // Blue - L
//     0xffff00, // Yellow - O
//     0xff00ff, // Magenta - S
//     0x7300c8, // Purple - T
//     0x00ffff,  // Cyan - Z
// ];

const COLORS = [
  0xff3366, // Hot Pink - I
  0x33ccff, // Cyan Blue - J
  0x00ff99, // Neon Green - L
  0xffcc00, // Golden Yellow - O
  0xff66ff, // Magenta - S
  0x9933ff, // Purple - T
  0x00ffff,  // Aqua - Z
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
let minimumSpeed = 150;
//let speedProgression = 95;
let speedMultiplier = 0.9; //game becomes 10% faster each level
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
let fpsCounter;

let viewSize;
if(isMobile){
  viewSize = 24;
} else {
  viewSize = 22;
}
let currentLevelLinesCleared = 0;

let lastUpdateTime = 0;
let gameLoopId = null;

// Initialize Three.js
function init() {
  // Initialize audio first
  initAudio();
  
  console.log("Device detection - Mobile:", isMobile, "Low Performance:", isLowPerformance);
  
  // Initialize UI adjustments based on device
  adaptUIForDevice();

  // Initialize hand controls if available
  if (typeof initHandControls === 'function') {
    initHandControls();
  }
  
  // Load high score from localStorage with fallback
  try {
      highScore = localStorage.getItem('tetrisHighScore') || 0;
      document.getElementById('high-score').textContent = Number(highScore).toLocaleString();
  } catch (e) {
      console.log('localStorage not available, high score tracking disabled');
      document.getElementById('high-score-container').style.display = 'none';
  }
  
  // Create scene with Y2K-style background
  scene = new THREE.Scene();
  //scene.background = new THREE.Color(0x000033); // Deep blue background
  
  // Add fog for depth perception (subtle Y2K effect)
  scene.fog = new THREE.Fog(0x000033, 30, 50);

  // Create camera
  const aspectRatio = window.innerWidth / window.innerHeight;
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

  // Create renderer with better quality settings for Y2K glossy look
  renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
  });
  renderer.setClearColor(0x000000, 0); // Set clear color with alpha 0 (fully transparent)
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('game-container').appendChild(renderer.domElement);
  
  // Adjust pixel ratio for better performance on high-DPI screens
  const pixelRatio = isLowPerformance ? 1 : Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  
  // Enable shadow mapping if not on low performance device
  if (!isLowPerformance) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  // Y2K-style lighting setup
  // Remove default lighting and add new Y2K-themed lights
  // Main ambient light - subtle blue tone
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);
  
  /*
  // Main directional light - bright white for primary illumination
  const mainLight = new THREE.DirectionalLight(0xff0000, 0.8);
  mainLight.position.set(10, 20, 15);
  scene.add(mainLight);
  
  // Fill light - blue-cyan for that Y2K feel
  const fillLight = new THREE.DirectionalLight(0x00ccff, 0.9);
  fillLight.position.set(-15, 10, 8);
  scene.add(fillLight);
  
  // Rim light - magenta to create that distinctive Y2K glow on edges

  const rimLight = new THREE.DirectionalLight(0xff00ff, 0.3);
  rimLight.position.set(0, -10, -10);
  scene.add(rimLight);
  */

  // Create game board grid
  createGrid();
  createThreeBorder();
  
  // Add event listeners
  window.addEventListener('keydown', handleKeyPress);
  window.addEventListener('resize', handleResize);
  document.getElementById('restart-button1').addEventListener('click', restartGame1);
  document.getElementById('restart-button2').addEventListener('click', restartGame2);
  document.getElementById('start-button').addEventListener('click', startGame);
  document.getElementById('pause-button').addEventListener('click', togglePause);
  document.getElementById('play-button').addEventListener('click', playGame);

  // Initialize next piece preview
  initNextPiecePreview();
  
  // Add document visibility handling
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Remove any existing interval
  cancelAnimationFrame(gameLoopId);

  // Initialize pooled geometries and materials
  blockGeometryPool.init();
  materialCache.init();
  
  // Enhance materials for Y2K look
  Object.values(materialCache.blockMaterials).forEach(material => {
      material.shininess = 100;
      material.specular = new THREE.Color(0xffffff);
      material.emissiveIntensity = 0.2;
  });
  
  // Set up FPS monitoring
  fpsCounter = {
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
          }
      }
  };
  
  // Start the animation loop
  gameLoopId = requestAnimationFrame(animate);
}

// Enhanced animation function with game loop integrated
function animate(timestamp) {
  gameLoopId = requestAnimationFrame(animate);
  
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

// Object pooling for block geometry and materials
const blockGeometryPool = {
  geometry: null,
  borderGeometry: null,
  init() {
    this.geometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.95, BLOCK_SIZE * 0.95, BLOCK_SIZE * 0.95);
    this.geometry.isShared = true; // Mark as shared resource
    this.borderGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    this.borderGeometry.isShared = true; // Mark as shared resource
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
  envMap: null,
  init() {
      // Create shared border material with glow effect
      this.borderMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xffffff, 
          wireframe: true,
          transparent: true,
          opacity: 0.4
      });
      this.borderMaterial.isShared = true;
      
      // Create more Y2K-styled ghost material
      this.ghostMaterial = new THREE.MeshPhongMaterial({ 
          color: 0xaaaaff, 
          transparent: true, 
          opacity: 0.12,
      });
      this.ghostMaterial.isShared = true;

  },
  getBlockMaterial(color) {
      // Cache materials by color
      if (!this.blockMaterials[color]) {
          // Create a glossy, reflective material for the Y2K look
          this.blockMaterials[color] = new THREE.MeshPhongMaterial({ 
              color: color,
              transparent: true,
          });
      }
      return this.blockMaterials[color];
  },
  getBorderMaterial() {
      return this.borderMaterial;
  },
  getGhostMaterial() {
      return this.ghostMaterial;
  },
};

function disposeThreeJsObject(object) {
  if (!object) return;
  
  // Handle children first
  if (object.children) {
    // Create a copy of the children array to avoid modification during iteration
    const children = [...object.children];
    for (const child of children) {
      disposeThreeJsObject(child);
    }
  }
  
  // Remove from parent
  if (object.parent) {
    object.parent.remove(object);
  }
  
  // Dispose of geometries and materials
  if (object.geometry && !object.geometry.isShared) {
    object.geometry.dispose();
  }
  
  if (object.material) {
    if (Array.isArray(object.material)) {
      for (const material of object.material) {
        if (material && !material.isShared) {
          disposeMaterial(material);
        }
      }
    } else if (!object.material.isShared) {
      disposeMaterial(object.material);
    }
  }
}

function disposeMaterial(material) {
  if (!material) return;
  
  // Dispose of material properties
  for (const prop in material) {
    if (material[prop] && typeof material[prop].dispose === 'function') {
      material[prop].dispose();
    }
  }
  
  material.dispose();
}

// Helper function for visibility changes
function handleVisibilityChange() {
  if (document.hidden) {
    // Page is not visible, pause the game to save resources
    if (gameStarted && !gameOver && !gamePaused) {
      // Auto-pause when switching away
      gamePaused = true;
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
  gameSpeed = Math.max(minimumSpeed, initialGameSpeed * Math.pow(speedMultiplier,level-1) );
  
  resetGame();
}

function restartGame1(){
  console.log("restart game from pauseOverlay screen");

  gameStarted = true;

  // Get the selected starting level
  const selectedLevel = parseInt(document.getElementById('restarting-level1').value);
  level = selectedLevel;
  gameSpeed = Math.max(minimumSpeed, initialGameSpeed * Math.pow(speedMultiplier,level-1) );
  resetGame();
}

function restartGame2(){
  console.log("restart game from gameOver screen");
  gameStarted = true;

  // Get the selected starting level
  const selectedLevel = parseInt(document.getElementById('restarting-level2').value);
  level = selectedLevel;
  gameSpeed = Math.max(minimumSpeed, initialGameSpeed * Math.pow(speedMultiplier,level-1) );
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
  
  if(isMobile){
    nextPieceRenderer.setSize(60, 60);
  } else {
    nextPieceRenderer.setSize(110, 110);
  }
  
  nextPieceRenderer.setClearColor(0x000033);
  
  // Create scene
  nextPieceScene = new THREE.Scene();
  
  // Create camera
  nextPieceCamera = new THREE.OrthographicCamera(-3, 3, 3, -3, 1, 10);
  nextPieceCamera.position.z = 5;
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(2, 3, 5);
  nextPieceScene.add(directionalLight);
  
  // Force initial render
  nextPieceRenderer.render(nextPieceScene, nextPieceCamera);
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
  
  // Add a simple dark background
  const bgGeometry = new THREE.PlaneGeometry(6, 6);
  const bgMaterial = new THREE.MeshBasicMaterial({
      color: 0x000033,
      transparent: true,
      opacity: 0.8
  });
  
  const bgPlane = new THREE.Mesh(bgGeometry, bgMaterial);
  bgPlane.position.z = -1;
  nextPieceScene.add(bgPlane);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(2, 3, 5);
  nextPieceScene.add(directionalLight);

  if (!nextPiece) {
      console.error("No next piece to render in preview!");
      nextPieceRenderer.render(nextPieceScene, nextPieceCamera);
      return;
  }
  
  // Calculate center position based on shape dimensions
  const width = nextPiece.shape[0].length;
  const height = nextPiece.shape.length;
  
  // Add blocks for next piece with simplified Y2K styling
  for (let y = 0; y < nextPiece.shape.length; y++) {
      for (let x = 0; x < nextPiece.shape[y].length; x++) {
          if (nextPiece.shape[y][x]) {
              // Create a basic block with some depth
              const geometry = new THREE.BoxGeometry(0.85, 0.85, 0.4);
              
              // Create a simple glossy material
              const material = new THREE.MeshPhongMaterial({ 
                  color: nextPiece.color,
                  shininess: 60,
                  specular: 0xffffff
              });
              
              const cube = new THREE.Mesh(geometry, material);
              
              // Position the cube centered in preview
              cube.position.set(
                x + 0.5 - width/2,  // Center horizontally based on piece width
                y + 0.5 - height/2,  // Center vertically based on piece height
                0
              );
              
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
  console.log("reset game");

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
  
  gamePaused = false;
  document.getElementById("pause-overlay").classList.add("hidden");

  // Update UI
  document.getElementById('score').textContent = Number(score).toLocaleString();
  document.getElementById('level').textContent = level;
  document.getElementById('game-over').style.display = 'none';

  gameLoopId = requestAnimationFrame(animate);
    
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
      
      cancelAnimationFrame(gameLoopId)
      //clearInterval(gameLoop);
      
      // Play game over sound
      gameOverSound();
      
      // Update high score if localStorage is available
      try {
          if (score > highScore) {
              highScore = score;
              localStorage.setItem('tetrisHighScore', highScore);
              document.getElementById('high-score').textContent = Number(highScore).toLocaleString();
          }
      } catch (e) {
          // Skip high score update if localStorage is not available
      }
      
      document.getElementById('final-score').textContent = Number(score).toLocaleString();
      try {
          document.getElementById('final-high-score').textContent = Number(highScore).toLocaleString();
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
  
  // Main block with rounded corners (use BufferGeometry for better performance)
  const cubeGeom = blockGeometryPool.getGeometry();
  const cube = new THREE.Mesh(
      cubeGeom,
      materialCache.getBlockMaterial(color)
  );
  
  cube.scale.set(0.85, 0.85, 0.85); // Scale down slightly to create gap between blocks
  
  // Border using pooled geometry and shared material
  const border = new THREE.Mesh(
      blockGeometryPool.getBorderGeometry(),
      materialCache.getBorderMaterial()
  );
  
  // Add a glow effect for active pieces
  if (isPiece) {
      const glowMaterial = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.15,
      });
      
      const glow = new THREE.Mesh(
          blockGeometryPool.getBorderGeometry().clone().scale(1.1, 1.1, 1.1),
          glowMaterial
      );
      
      blockGroup.add(glow);
  }
  
  // Add both to the group
  blockGroup.add(cube);
  blockGroup.add(border);
  
  // Position the group
  blockGroup.position.set(x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2, 0);

  // Add custom data for tracking
  blockGroup.userData = { 
      ...blockGroup.userData,
      x, 
      y, 
      color, 
      isPiece 
  };
  
  // Add to scene and blocks array
  scene.add(blockGroup);
  blocks.push(blockGroup);
  
  return blockGroup;
}

function cleanupBlock(block) {
  disposeThreeJsObject(block);
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

        // Add both to the group
        ghostGroup.add(cube);
        
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
        document.getElementById('score').textContent = Number(score).toLocaleString();
        
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
      document.getElementById('score').textContent = Number(score).toLocaleString();
      
      // Update high score if needed and localStorage is available
      try {
          if (score > highScore) {
              highScore = score;
              localStorage.setItem('tetrisHighScore', highScore);
              document.getElementById('high-score').textContent = Number(highScore).toLocaleString();
          }
      } catch (e) {
          // Skip high score update if localStorage is not available
      }

      // Increase level every 10 lines
      currentLevelLinesCleared += linesCleared;
      if(currentLevelLinesCleared>=10){
        
        // Increase level
        currentLevelLinesCleared = 0;
        level++;
        document.getElementById('level').textContent = level;
          
        // Speed up the game
        gameSpeed = Math.max(100, initialGameSpeed * Math.pow(speedMultiplier,level-1) );
        cancelAnimationFrame(gameLoopId);
        gameLoopId = requestAnimationFrame(animate);
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
    
    camera.left = -aspectRatio * viewSize / 2;
    camera.right = aspectRatio * viewSize / 2;
    camera.top = viewSize / 2;
    camera.bottom = -viewSize / 2;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Toggle pause state
function togglePause() {
    if (!gameStarted || gameOver) return;
    
    gamePaused = !gamePaused;
        
    if (gamePaused) {
        cancelAnimationFrame(gameLoopId);        
        document.getElementById("pause-overlay").classList.remove("hidden");
    } else {
        gameLoopId = requestAnimationFrame(animate);
        document.getElementById("pause-overlay").classList.add("hidden");
    }
}

function playGame() {
  if (gamePaused) {
    gameLoopId = requestAnimationFrame(animate);
    document.getElementById("pause-overlay").classList.add("hidden");
    gamePaused = false;
  } else {

  }
}

// Function to create a border in the Three.js scene
function createThreeBorder() {
  // Calculate the actual board dimensions
  const boardWidth = BOARD_WIDTH;
  const boardHeight = BOARD_HEIGHT;
  
  // Create glowing inner border
  const innerBorderMaterial = new THREE.LineBasicMaterial({ 
      color: 0x33ccff,
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
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
  scene.add(innerBorderLines);
  
  // Add an outer glow border
  const outerBorderMaterial = new THREE.LineBasicMaterial({ 
      color: 0xff66cc,
      transparent: true,
      opacity: 0.5,
      linewidth: 1,
  });
  
  // Create outer border with offset
  const outerBorderGeometry = new THREE.BufferGeometry().setFromPoints([
      // Bottom edge
      new THREE.Vector3(-0.2, -0.2, 0),
      new THREE.Vector3(boardWidth + 0.2, -0.2, 0),
      
      // Right edge
      new THREE.Vector3(boardWidth + 0.2, -0.2, 0),
      new THREE.Vector3(boardWidth + 0.2, boardHeight + 0.2, 0),
      
      // Top edge
      new THREE.Vector3(boardWidth + 0.2, boardHeight + 0.2, 0),
      new THREE.Vector3(-0.2, boardHeight + 0.2, 0),
      
      // Left edge
      new THREE.Vector3(-0.2, boardHeight + 0.2, 0),
      new THREE.Vector3(-0.2, -0.2, 0)
  ]);
  
  const outerBorderLines = new THREE.LineSegments(outerBorderGeometry, outerBorderMaterial);
  scene.add(outerBorderLines);
}

// Start the game when the page loads
window.addEventListener('load', init);

// Expose game control functions to the global scope for hand controls
window.movePiece = movePiece;
window.rotatePiece = rotatePiece;
window.dropPiece = dropPiece;