// touchControls.js - Improved touch interaction for mobile Tetris gameplay

// Touch state variables
let touchState = {
  active: false,
  identifier: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  lastMoveX: 0,
  lastMoveY: 0,
  isHardDrop: false,
  velocityY: 0,
  lastTimestamp: 0,
  positionHistory: []
};

// Configuration constants
const TOUCH_CONFIG = {
  MOVE_THRESHOLD: 30,         // Pixels needed to move a piece horizontally
  DOWN_THRESHOLD: 40,         // Pixels needed to move a piece down
  HARD_DROP_VELOCITY: 0.8,    // Pixels per millisecond to trigger hard drop
  VELOCITY_SAMPLE_SIZE: 5,    // Number of touch points to calculate velocity
  TAP_THRESHOLD: 10,          // Maximum movement to register as a tap
  TAP_DURATION: 300           // Maximum ms for a tap
};

/**
 * Initialize touch controls
 */
function initTouchControls() {
  // IMPORTANT FIX: Add touch events to the renderer's canvas, not the whole game container
  // This allows buttons and UI elements to still receive touch events
  
  let canvas;
  
  // Wait for the renderer to be initialized and its canvas to be added to the DOM
  const checkForCanvas = setInterval(() => {
    canvas = document.querySelector('#game-container canvas');
    if (canvas) {
      clearInterval(checkForCanvas);
      setupTouchListeners(canvas);
    }
  }, 100);
  
  // Listen for new piece spawns to reset touch interaction
  document.addEventListener('newPieceSpawned', resetTouchInteraction);
  
  console.log("Touch controls initialized");
}

/**
 * Set up touch event listeners on the provided element
 * @param {HTMLElement} element - The element to attach touch listeners to
 */
function setupTouchListeners(element) {
  // Only add touch listeners to the game canvas, not UI elements
  element.addEventListener('touchstart', function(event) {
    // Check if the touch is on a UI element (button, select, etc.)
    let target = event.target;
    while (target) {
      if (target.tagName === 'BUTTON' || 
          target.tagName === 'SELECT' || 
          target.classList.contains('button')) {
        // Don't handle game controls for UI elements
        return;
      }
      target = target.parentElement;
    }
    
    // Call the original handler for game area touches
    handleTouchStart(event);
  }, { passive: false });
  
  element.addEventListener('touchmove', function(event) {
    // Check if the touch is on a UI element
    let target = event.target;
    while (target) {
      if (target.tagName === 'BUTTON' || 
          target.tagName === 'SELECT' || 
          target.classList.contains('button')) {
        // Don't handle game controls for UI elements
        return;
      }
      target = target.parentElement;
    }
    
    // Call the original handler for game area touches
    handleTouchMove(event);
  }, { passive: false });
  
  element.addEventListener('touchend', function(event) {
    // Check if the touch is on a UI element
    let target = event.target;
    while (target) {
      if (target.tagName === 'BUTTON' || 
          target.tagName === 'SELECT' || 
          target.classList.contains('button')) {
        // Don't handle game controls for UI elements
        return;
      }
      target = target.parentElement;
    }
    
    // Call the original handler for game area touches
    handleTouchEnd(event);
  }, { passive: false });
  
  element.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  
  console.log("Touch listeners added to game canvas with UI element protection");
}

/**
 * Reset touch interaction state
 * Called when a new piece is spawned
 */
function resetTouchInteraction() {
  touchState.active = false;
  touchState.identifier = null;
  touchState.isHardDrop = false;
  touchState.positionHistory = [];
}

/**
 * Handle touch start event
 * @param {TouchEvent} event - Touch event
 */
function handleTouchStart(event) {
  // Only handle touch if game is active
  if (!gameStarted || gameOver || gamePaused) return;
  
  // Prevent default behavior to avoid scrolling, but only for game canvas
  event.preventDefault();
  
  // Only process touch if no active touch or previous touch completed
  if (!touchState.active) {
    const touch = event.touches[0];
    
    // Initialize touch state
    touchState.active = true;
    touchState.identifier = touch.identifier;
    touchState.startX = touch.clientX;
    touchState.startY = touch.clientY;
    touchState.currentX = touch.clientX;
    touchState.currentY = touch.clientY;
    touchState.lastMoveX = touch.clientX;
    touchState.lastMoveY = touch.clientY;
    touchState.isHardDrop = false;
    touchState.lastTimestamp = event.timeStamp;
    touchState.velocityY = 0;
    touchState.positionHistory = [{
      x: touch.clientX,
      y: touch.clientY,
      timestamp: event.timeStamp
    }];
  }
}

/**
 * Handle touch move event
 * @param {TouchEvent} event - Touch event
 */
let lastTouchMoveTime = 0;
const TOUCH_THROTTLE_MS = 16; // ~60fps

function handleTouchMove(event) {
  // Only handle touch if game is active
  if (!gameStarted || gameOver || gamePaused || !touchState.active) return;
  
  // Prevent default behavior to avoid scrolling, but only for game canvas
  event.preventDefault();
  
  // Throttle touch processing to improve performance
  const now = performance.now();
  if (now - lastTouchMoveTime < TOUCH_THROTTLE_MS) {
    return; // Skip this update if it's too soon
  }
  lastTouchMoveTime = now;
  
  // Find our active touch
  const touch = findActiveTouch(event.touches);
  if (!touch) return;
  
  // Update current position
  touchState.currentX = touch.clientX;
  touchState.currentY = touch.clientY;
  
  // Limit history size to improve performance
  // Only add entry every few updates
  if (touchState.positionHistory.length === 0 || 
      now - touchState.positionHistory[touchState.positionHistory.length - 1].timestamp > 50) {
    touchState.positionHistory.push({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: now
    });
    
    // Keep history size limited
    if (touchState.positionHistory.length > TOUCH_CONFIG.VELOCITY_SAMPLE_SIZE) {
      touchState.positionHistory.shift();
    }
    
    // Calculate vertical velocity
    calculateVerticalVelocity(now);
  }
  
  // Check for hard drop (high vertical velocity)
  if (!touchState.isHardDrop && touchState.velocityY > TOUCH_CONFIG.HARD_DROP_VELOCITY) {
    performHardDrop();
    return;
  }
  
  // Handle horizontal movement if not in hard drop mode
  if (!touchState.isHardDrop) {
    handleHorizontalMovement();
  }
  
  // Handle vertical movement if not in hard drop mode
  if (!touchState.isHardDrop) {
    handleVerticalMovement();
  }
}

/**
 * Calculate vertical velocity based on recent touch history
 * @param {number} currentTimestamp - Current timestamp
 */
function calculateVerticalVelocity(currentTimestamp) {
  if (touchState.positionHistory.length < 2) return;
  
  const oldestPoint = touchState.positionHistory[0];
  const newestPoint = touchState.positionHistory[touchState.positionHistory.length - 1];
  
  const deltaY = newestPoint.y - oldestPoint.y;
  const deltaTime = newestPoint.timestamp - oldestPoint.timestamp;
  
  // Calculate velocity in pixels per millisecond
  if (deltaTime > 0) {
    touchState.velocityY = deltaY / deltaTime;
  }
}

/**
 * Handle horizontal movement based on touch position
 */
function handleHorizontalMovement() {
  const deltaX = touchState.currentX - touchState.lastMoveX;
  
  // Only move if we've crossed the movement threshold
  if (Math.abs(deltaX) >= TOUCH_CONFIG.MOVE_THRESHOLD) {
    // Get direction (-1 for left, 1 for right)
    const direction = deltaX > 0 ? 1 : -1;
    
    // Move the piece
    movePiece(direction, 0);
    
    // Update last position to current
    touchState.lastMoveX = touchState.currentX;
  }
}

/**
 * Handle vertical movement based on touch position
 */
function handleVerticalMovement() {
  const deltaY = touchState.currentY - touchState.lastMoveY;
  
  // Only move down if enough downward movement
  if (deltaY >= TOUCH_CONFIG.DOWN_THRESHOLD) {
    // Determine how many downward moves to make
    const moveCount = Math.floor(deltaY / TOUCH_CONFIG.DOWN_THRESHOLD);
    
    for (let i = 0; i < moveCount; i++) {
      movePiece(0, -1);
    }
    
    // Update last position, accounting for the movement we made
    touchState.lastMoveY += moveCount * TOUCH_CONFIG.DOWN_THRESHOLD;
  }
}

/**
 * Perform a hard drop
 */
function performHardDrop() {
  touchState.isHardDrop = true;
  dropPiece();
  
  // Vibrate device if supported (tactile feedback)
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(50);
  }
}

/**
 * Handle touch end event
 * @param {TouchEvent} event - Touch event
 */
function handleTouchEnd(event) {
  // Only handle touch if game is active
  if (!gameStarted || gameOver || gamePaused || !touchState.active) return;
  
  // Check if our active touch has ended
  const touch = findActiveTouch(event.changedTouches);
  if (!touch) return;
  
  // Calculate if this was a tap (small movement, short duration)
  const deltaX = Math.abs(touchState.currentX - touchState.startX);
  const deltaY = Math.abs(touchState.currentY - touchState.startY);
  const duration = event.timeStamp - touchState.lastTimestamp;
  
  const isTap = (deltaX < TOUCH_CONFIG.TAP_THRESHOLD && 
                 deltaY < TOUCH_CONFIG.TAP_THRESHOLD &&
                 duration < TOUCH_CONFIG.TAP_DURATION);
  
  // Handle tap for rotation
  if (isTap) {
    rotatePiece();
  }
  
  // Reset touch state
  touchState.active = false;
  touchState.identifier = null;
}

/**
 * Find the active touch in a TouchList
 * @param {TouchList} touches - The list of touches to search
 * @return {Touch|null} - The active touch or null if not found
 */
function findActiveTouch(touches) {
  for (let i = 0; i < touches.length; i++) {
    if (touches[i].identifier === touchState.identifier) {
      return touches[i];
    }
  }
  return null;
}

// Initialize touch controls when the page loads
window.addEventListener('load', initTouchControls);