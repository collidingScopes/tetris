/**
 * simpleTouchControls.js
 * Provides simplified touch controls for Tetris
 */

/**
 * Initializes touch controls if on a mobile device
 */
function initTouchControls() {
  // Only initialize if this is a mobile device
  if (!deviceUtils.isMobile()) {
    console.log("Not a mobile device, skipping touch controls");
    return;
  }
  
  // Wait for the renderer to be initialized and its canvas to be added to the DOM
  const checkForCanvas = setInterval(() => {
    const canvas = document.querySelector('#game-container canvas');
    if (canvas) {
      clearInterval(checkForCanvas);
      setupTouchListeners(canvas);
      console.log("Touch controls initialized on game canvas");
    }
  }, 100);
  
  // Listen for new piece spawns to reset touch state
  document.addEventListener('newPieceSpawned', function() {
    // We'll reset state in the handler
    console.log("New piece spawned, touch state reset");
  });
}

/**
 * Sets up touch event listeners on the game canvas
 * @param {HTMLElement} canvas - The game canvas element
 */
function setupTouchListeners(canvas) {
  // Simple touch state with only essential properties
  const touchState = {
    startX: 0,
    startY: 0,
    startTime: 0,
    lastMoveX: 0,
    lastMoveY: 0,
    isTouchActive: false
  };
  
  // Constants for gesture detection
  const TOUCH = {
    MOVE_THRESHOLD: 30,   // Min pixels for horizontal movement
    DOWN_THRESHOLD: 40,   // Min pixels for downward movement
    TAP_THRESHOLD: 15,    // Max movement for a tap
    TAP_DURATION: 300,    // Max duration for a tap (ms)
    HARD_DROP_MIN_Y: 100, // Min pixels for hard drop swipe
    HARD_DROP_SPEED: 0.7  // Min pixels/ms for hard drop
  };
  
  // Touch start handler
  canvas.addEventListener('touchstart', function(event) {
    // Ignore if game is not running
    if (!gameStarted || gameOver || gamePaused) return;
    
    // Skip if touching UI elements
    if (isUIElement(event.target)) return;
    
    // Prevent default behavior to avoid scrolling
    event.preventDefault();
    
    const touch = event.touches[0];
    
    // Initialize touch state
    touchState.startX = touch.clientX;
    touchState.startY = touch.clientY;
    touchState.lastMoveX = touch.clientX;
    touchState.lastMoveY = touch.clientY;
    touchState.startTime = Date.now();
    touchState.isTouchActive = true;
    
    console.log("Touch start detected");
  }, { passive: false });
  
  // Touch move handler with throttling
  let lastMoveTime = 0;
  
  canvas.addEventListener('touchmove', function(event) {
    // Ignore if game is not running or touch is not active
    if (!gameStarted || gameOver || gamePaused || !touchState.isTouchActive) return;
    
    // Skip if touching UI elements
    if (isUIElement(event.target)) return;
    
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    // Apply throttling for better performance (process at max 60fps)
    const now = Date.now();
    if (now - lastMoveTime < 16) return;
    lastMoveTime = now;
    
    const touch = event.touches[0];
    
    // ---- HORIZONTAL MOVEMENT (LEFT/RIGHT) ----
    const deltaX = touch.clientX - touchState.lastMoveX;
    if (Math.abs(deltaX) >= TOUCH.MOVE_THRESHOLD) {
      // Move left or right
      const direction = deltaX > 0 ? 1 : -1;
      movePiece(direction, 0);
      
      // Update last position for horizontal
      touchState.lastMoveX = touch.clientX;
    }
    
    // ---- VERTICAL MOVEMENT (DOWN) ----
    const deltaY = touch.clientY - touchState.lastMoveY;
    if (deltaY >= TOUCH.DOWN_THRESHOLD) {
      // Move down
      movePiece(0, -1);
      
      // Only partially update lastMoveY to allow continuous movement
      touchState.lastMoveY += TOUCH.DOWN_THRESHOLD;
    }
    
    // ---- HARD DROP DETECTION ----
    const totalDeltaY = touch.clientY - touchState.startY;
    const duration = now - touchState.startTime;
    
    // Fast downward swipe detection (high velocity + minimum distance)
    const velocity = totalDeltaY / duration;
    if (totalDeltaY > TOUCH.HARD_DROP_MIN_Y && velocity > TOUCH.HARD_DROP_SPEED) {
      console.log("Hard drop gesture detected", velocity);
      dropPiece();
      touchState.isTouchActive = false;
      
      // Provide haptic feedback if available
      if (deviceUtils.supportsVibration()) {
        navigator.vibrate(50);
      }
    }
  }, { passive: false });
  
  // Touch end handler for tap detection (rotation)
  canvas.addEventListener('touchend', function(event) {
    // Ignore if game is not running or touch is not active
    if (!gameStarted || gameOver || gamePaused || !touchState.isTouchActive) return;
    
    // Skip if touching UI elements
    if (isUIElement(event.target)) return;
    
    const touch = event.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchState.startX);
    const deltaY = Math.abs(touch.clientY - touchState.startY);
    const duration = Date.now() - touchState.startTime;
    
    // Tap detection for rotation (small movement + short time)
    if (deltaX < TOUCH.TAP_THRESHOLD && deltaY < TOUCH.TAP_THRESHOLD && duration < TOUCH.TAP_DURATION) {
      console.log("Tap detected, rotating piece");
      rotatePiece();
    }
    
    // Reset touch state
    touchState.isTouchActive = false;
  }, { passive: false });
  
  // Touch cancel handler
  canvas.addEventListener('touchcancel', function() {
    touchState.isTouchActive = false;
  }, { passive: false });
  
  console.log("Touch listeners set up on game canvas");
}

/**
 * Checks if an element is a UI control that should receive touch events directly
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} - True if the element is a UI control
 */
function isUIElement(element) {
  const uiElements = ['BUTTON', 'SELECT', 'INPUT'];
  let target = element;
  
  // Check element and all parents
  while (target) {
    if (
      uiElements.includes(target.tagName) || 
      target.classList.contains('button') ||
      target.id === 'pause-button' ||
      target.id === 'mute-button'
    ) {
      return true;
    }
    target = target.parentElement;
  }
  return false;
}

// Initialize touch controls when the page loads if on mobile
window.addEventListener('load', initTouchControls);