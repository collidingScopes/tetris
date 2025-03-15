/*
Instructions:
touchControls should only be available on iPad / mobile devices
Player should be able to move the tetromino block by dragging left/right/downwards
Swipping downwards with high velocity should trigger a hard drop of the block
All UI buttons (start game, restart game, mute button, pause button) should not be blocked by the touch interaction -- the user should be able to click those buttons
*/

// Initialize touch controls
function initTouchControls() {
  // Only initialize on mobile/tablet devices
  if (!deviceUtils.isMobile()) {
    console.log("Not a mobile device, skipping touch controls");
    return;
  }
  
  console.log("Mobile device detected, initializing touch controls");
  
  // Add touch mode class to the body
  document.body.classList.add('touch-mode');
  
  // Find the game container
  const gameContainer = document.getElementById('game-container');
  
  // Create a touch overlay that will capture touch events
  const touchOverlay = document.createElement('div');
  touchOverlay.id = 'touch-overlay';
  touchOverlay.style.position = 'absolute';
  touchOverlay.style.top = '0';
  touchOverlay.style.left = '0';
  touchOverlay.style.width = '100%';
  touchOverlay.style.height = '100%';
  touchOverlay.style.zIndex = '50'; // Above the game but below UI elements
  touchOverlay.style.touchAction = 'none'; // Disable browser handling of touch
  gameContainer.appendChild(touchOverlay);
  
  // Set up touch handlers on the overlay
  setupTouchHandlers(touchOverlay);
  
  // Listen for new piece spawns to reset touch state
  document.addEventListener('newPieceSpawned', resetTouchState);
  
  console.log("Touch controls initialized");
}

// Touch state tracking object
const touchState = {
  active: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  startTime: 0,
  
  // Reset the touch state
  reset: function() {
    this.active = false;
  }
};

// Constants for touch control sensitivity
const TOUCH_CONTROLS = {
  MOVE_THRESHOLD: 25,    // Minimum pixels needed for horizontal movement
  DOWN_THRESHOLD: 15,    // Minimum pixels needed for downward movement
  TAP_THRESHOLD: 20,     // Maximum movement allowed for a tap gesture
  TAP_DURATION: 250,     // Maximum duration (ms) for a tap
  HARD_DROP_MIN_Y: 50,   // Minimum vertical distance for hard drop
  HARD_DROP_VELOCITY: 0.65 // Pixels/ms velocity threshold for hard drop
};

// Setup touch event handlers
function setupTouchHandlers(element) {
  // Touch start handler
  element.addEventListener('touchstart', handleTouchStart, { passive: false });
  
  // Touch move handler
  element.addEventListener('touchmove', handleTouchMove, { passive: false });
  
  // Touch end handler
  element.addEventListener('touchend', handleTouchEnd, { passive: false });
  
  // Touch cancel handler
  element.addEventListener('touchcancel', resetTouchState, { passive: true });
}

// Handle touch start event
function handleTouchStart(event) {
  // Ignore if game isn't active
  if (!gameStarted || gameOver || gamePaused) return;
  
  // Allow UI elements to receive clicks
  if (isUIElement(event.target)) return;
  
  // Prevent default behavior to avoid scrolling
  event.preventDefault();
  
  const touch = event.touches[0];
  
  // Store initial touch position and time
  touchState.active = true;
  touchState.startX = touch.clientX;
  touchState.startY = touch.clientY;
  touchState.lastX = touch.clientX;
  touchState.lastY = touch.clientY;
  touchState.startTime = Date.now();
}

// Handle touch move event
function handleTouchMove(event) {
  // Ignore if touch isn't active or game isn't running
  if (!touchState.active || !gameStarted || gameOver || gamePaused) return;
  
  // Allow UI elements to receive normal touch events
  if (isUIElement(event.target)) return;
  
  // Prevent default behavior
  event.preventDefault();
  
  const touch = event.touches[0];
  const currentX = touch.clientX;
  const currentY = touch.clientY;
  
  // Calculate horizontal and vertical movement since last processed position
  const deltaX = currentX - touchState.lastX;
  const deltaY = currentY - touchState.lastY;
  
  // Handle horizontal movement (left/right)
  if (Math.abs(deltaX) >= TOUCH_CONTROLS.MOVE_THRESHOLD) {
    const direction = deltaX > 0 ? 1 : -1; // 1 for right, -1 for left
    
    // Try to move the piece
    if (movePiece(direction, 0)) {
      // Update last position after successful move
      touchState.lastX = currentX;
      
      // Provide haptic feedback if available
      if (deviceUtils.supportsVibration()) {
        navigator.vibrate(10);
      }
    }
  }
  
  // Handle downward movement
  if (deltaY >= TOUCH_CONTROLS.DOWN_THRESHOLD) {
    // Try to move the piece down
    if (movePiece(0, -1)) {
      // Update last Y position, but only partially to allow continuous movement
      touchState.lastY += TOUCH_CONTROLS.DOWN_THRESHOLD * 0.8;
    }
  }
  
  // Check for hard drop - total vertical movement with high velocity
  const totalDeltaY = currentY - touchState.startY;
  const duration = Date.now() - touchState.startTime;
  
  if (duration > 50 && totalDeltaY > TOUCH_CONTROLS.HARD_DROP_MIN_Y) {
    const velocity = totalDeltaY / duration;
    
    if (velocity >= TOUCH_CONTROLS.HARD_DROP_VELOCITY) {
      // Execute hard drop
      dropPiece();
      
      // Reset touch state to prevent further actions
      touchState.active = false;
      
      // Stronger haptic feedback for hard drop
      if (deviceUtils.supportsVibration()) {
        navigator.vibrate(30);
      }
    }
  }
}

// Handle touch end event
function handleTouchEnd(event) {
  // Ignore if touch isn't active or game isn't running
  if (!touchState.active || !gameStarted || gameOver || gamePaused) return;
  
  // Allow UI elements to receive normal touch events
  if (isUIElement(event.target)) return;
  
  // Prevent default behavior
  event.preventDefault();
  
  const touch = event.changedTouches[0];
  
  // Calculate total movement
  const deltaX = Math.abs(touch.clientX - touchState.startX);
  const deltaY = Math.abs(touch.clientY - touchState.startY);
  const duration = Date.now() - touchState.startTime;
  
  // Check if this was a tap (small movement + short duration)
  if (deltaX < TOUCH_CONTROLS.TAP_THRESHOLD && 
      deltaY < TOUCH_CONTROLS.TAP_THRESHOLD && 
      duration < TOUCH_CONTROLS.TAP_DURATION) {
    
    // Rotate the piece on tap
    rotatePiece();
    
    // Light haptic feedback for rotation
    if (deviceUtils.supportsVibration()) {
      navigator.vibrate(15);
    }
  }
  
  // Reset touch state
  resetTouchState();
}

// Reset the touch state
function resetTouchState() {
  touchState.active = false;
}

/**
 * Check if an element is a UI control that should receive normal touch events
 * @param {Element} element - The element to check
 * @returns {boolean} - True if the element is a UI control
 */
function isUIElement(element) {
  // UI element identifiers (id, class, or tag)
  const uiElements = [
    // Buttons
    'start-button', 'restart-button', 'pause-button', 'mute-button',
    // Controls
    'level-selector', 'starting-level', 'restarting-level',
    // Classes
    'button'
  ];
  
  // Walk up the DOM tree to check if element or any parent is a UI element
  let current = element;
  while (current && current !== document) {
    // Check element ID
    if (current.id && uiElements.includes(current.id)) {
      return true;
    }
    
    // Check element tag
    if (['BUTTON', 'SELECT', 'INPUT'].includes(current.tagName)) {
      return true;
    }
    
    // Check element classes
    if (current.classList) {
      for (let i = 0; i < current.classList.length; i++) {
        if (uiElements.includes(current.classList[i])) {
          return true;
        }
      }
    }
    
    // Move up to parent
    current = current.parentElement;
  }
  
  return false;
}

// Initialize touch controls when the page loads
window.addEventListener('load', initTouchControls);