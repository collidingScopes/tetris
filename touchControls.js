/*
Instructions:
touchControls should only be available on iPad / mobile devices
Player should be able to move the tetromino block by dragging left/right/downwards
Swipping downwards with high velocity should trigger a hard drop of the block
All UI buttons (start game, restart game, mute button, pause button) should not be blocked by the touch interaction -- the user should be able to click those buttons
*/

// Enhanced touch state tracking object
const touchState = {
  active: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  lastMoveX: 0,    // Last position where horizontal move was processed
  lastMoveY: 0,    // Last position where vertical move was processed
  startTime: 0,
  movementDirection: null, // 'horizontal', 'vertical', or null
  lastMoveTime: 0,  // Time of last movement action
  
  // Reset the touch state
  reset: function() {
    this.active = false;
    this.movementDirection = null;
  }
};

// Enhanced constants for touch control sensitivity
const TOUCH_CONTROLS = {
  MOVE_THRESHOLD: 25,            // Base pixels needed for horizontal movement
  DOWN_THRESHOLD: 15,            // Base pixels needed for downward movement
  VERTICAL_BIAS_THRESHOLD: 2.5,  // Ratio of vertical to horizontal movement to consider primarily vertical
  HORIZONTAL_BIAS_THRESHOLD: 2,  // Ratio of horizontal to vertical movement to consider primarily horizontal
  VERTICAL_MOVE_HORIZONTAL_THRESHOLD: 40, // Increased threshold during vertical swipes
  DIRECTION_LOCK_DURATION: 150,  // Time in ms to lock in a movement direction
  TAP_THRESHOLD: 20,             // Maximum movement allowed for a tap gesture
  TAP_DURATION: 250,             // Maximum duration (ms) for a tap
  HARD_DROP_MIN_Y: 50,           // Minimum vertical distance for hard drop
  HARD_DROP_VELOCITY: 0.65,      // Pixels/ms velocity threshold for hard drop
  MOVE_COOLDOWN: 80              // Minimum time between consecutive move actions
};

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
  const currentTime = Date.now();
  
  // Calculate movement since initial touch
  const totalDeltaX = currentX - touchState.startX;
  const totalDeltaY = touchState.startY - currentY; // Invert for easier logic (positive = upward)
  
  // Calculate movement since last position
  const deltaX = currentX - touchState.lastX;
  const deltaY = touchState.lastY - currentY; // Invert for easier logic (positive = upward)
  
  // Determine primary movement direction if not already set
  if (!touchState.movementDirection) {
    // Wait for enough movement to determine direction
    const totalMovement = Math.abs(totalDeltaX) + Math.abs(totalDeltaY);
    
    if (totalMovement > 20) { // Minimum movement before locking direction
      if (Math.abs(totalDeltaY) > Math.abs(totalDeltaX) * TOUCH_CONTROLS.VERTICAL_BIAS_THRESHOLD) {
        touchState.movementDirection = 'vertical';
      } else if (Math.abs(totalDeltaX) > Math.abs(totalDeltaY) * TOUCH_CONTROLS.HORIZONTAL_BIAS_THRESHOLD) {
        touchState.movementDirection = 'horizontal';
      }
      
      // Initialize the last move positions once direction is determined
      touchState.lastMoveX = currentX;
      touchState.lastMoveY = currentY;
    }
  }
  
  // Handle movement based on primary direction
  const timeSinceLastMove = currentTime - touchState.lastMoveTime;
  
  // Process horizontal movement (left/right)
  if (timeSinceLastMove >= TOUCH_CONTROLS.MOVE_COOLDOWN) {
    let horizontalThreshold = TOUCH_CONTROLS.MOVE_THRESHOLD;
    
    // Use higher threshold for horizontal moves during vertical swipes
    if (touchState.movementDirection === 'vertical' || 
        (Math.abs(deltaY) > Math.abs(deltaX) * 1.5)) {
      horizontalThreshold = TOUCH_CONTROLS.VERTICAL_MOVE_HORIZONTAL_THRESHOLD;
    }
    
    const horizontalMovement = currentX - touchState.lastMoveX;
    
    if (Math.abs(horizontalMovement) >= horizontalThreshold) {
      const direction = horizontalMovement > 0 ? 1 : -1; // 1 for right, -1 for left
      
      // Try to move the piece
      if (movePiece(direction, 0)) {
        // Update last horizontal move position after successful move
        touchState.lastMoveX = currentX;
        touchState.lastMoveTime = currentTime;
        
        // Provide haptic feedback if available
        if (deviceUtils.supportsVibration()) {
          navigator.vibrate(10);
        }
      }
    }
  }
  
  // Process vertical movement
  if (timeSinceLastMove >= TOUCH_CONTROLS.MOVE_COOLDOWN/2) { // Allow vertical moves more frequently
    const verticalMovement = touchState.lastMoveY - currentY; // Inverted delta
    
    if (verticalMovement >= TOUCH_CONTROLS.DOWN_THRESHOLD) {
      // Try to move the piece down
      if (movePiece(0, -1)) {
        // Update last Y position, but only partially to allow continuous movement
        touchState.lastMoveY -= TOUCH_CONTROLS.DOWN_THRESHOLD * 0.8;
        touchState.lastMoveTime = currentTime;
      }
    }
  }
  
  // Always update last position for delta calculations on next move
  touchState.lastX = currentX;
  touchState.lastY = currentY;
  
  // Check for hard drop - total vertical movement with high velocity
  if (totalDeltaY < -TOUCH_CONTROLS.HARD_DROP_MIN_Y) { // Using inverted Y, negative means downward
    const duration = currentTime - touchState.startTime;
    
    if (duration > 50) {
      const velocity = Math.abs(totalDeltaY) / duration;
      
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
  touchState.lastMoveX = touch.clientX;
  touchState.lastMoveY = touch.clientY;
  touchState.startTime = Date.now();
  touchState.lastMoveTime = 0;
  touchState.movementDirection = null;
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
  touchState.reset();
}

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