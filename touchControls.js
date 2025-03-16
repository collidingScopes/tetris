/**
 * touchControls.js
 * Handles all touch interactions for the Tetris game on mobile devices
 * 
 * Enables:
 * - Left/right swipes to move pieces horizontally
 * - Downward swipes to move pieces down
 * - Fast downward swipes for hard drops
 * - Taps to rotate pieces
 * - Ensures UI buttons remain clickable
 */

// Touch state tracking object
const touchState = {
  active: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  lastMoveX: 0,
  lastMoveY: 0,
  startTime: 0,
  movementDirection: null,
  lastMoveTime: 0,
  
  reset: function() {
    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastMoveX = 0;
    this.lastMoveY = 0;
    this.startTime = 0;
    this.movementDirection = null;
    this.lastMoveTime = 0;
  }
};

// Touch control sensitivity constants
const TOUCH_CONTROLS = {
  MOVE_THRESHOLD: 8,            // Pixels needed for horizontal movement
  DOWN_THRESHOLD: 12,            // Pixels needed for downward movement
  VERTICAL_BIAS_THRESHOLD: 2.0,  // Ratio of vertical to horizontal movement to consider primarily vertical
  HORIZONTAL_BIAS_THRESHOLD: 2,  // Ratio of horizontal to vertical movement to consider primarily horizontal
  VERTICAL_MOVE_HORIZONTAL_THRESHOLD: 50, // Increased threshold during vertical swipes
  DIRECTION_LOCK_DURATION: 150,  // Time in ms to lock in a movement direction
  TAP_THRESHOLD: 20,             // Maximum movement allowed for a tap gesture
  TAP_DURATION: 250,             // Maximum duration (ms) for a tap
  HARD_DROP_MIN_Y: 30,           // Minimum vertical distance for hard drop
  HARD_DROP_VELOCITY: 0.45,      // Pixels/ms velocity threshold for hard drop
  MOVE_COOLDOWN: 60,              // Minimum time between consecutive move actions
};

/**
 * Checks if an element is a UI control that should receive normal touch events
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} True if the element is a UI control
 */
function isUIElement(element) {
  // Check for direct matches
  if (!element) return false;
  
  // Direct element matches
  if (
    element.tagName === 'BUTTON' || 
    element.tagName === 'SELECT' ||
    element.classList.contains('button') ||
    element.id === 'start-button' ||
    element.id === 'restart-button1' ||
    element.id === 'restart-button2' ||
    element.id === 'play-button' ||
    element.id === 'mute-button' ||
    element.id === 'pause-button' ||
    element.id === 'starting-level' ||
    element.id === 'restarting-level1' ||
    element.id === 'restarting-level2'
  ) {
    return true;
  }
  
  // Check for parent UI elements
  const parent = element.closest('#start-screen, #game-over, #pause-overlay, #controls, .level-selector');
  return !!parent;
}

/**
 * Handles touch start events
 * @param {TouchEvent} event - The touch event
 */
function handleTouchStart(event) {
  // Don't handle touch if game isn't active
  if (!gameStarted || gameOver || gamePaused) return;
  
  // Allow UI elements to receive normal touches
  if (isUIElement(event.target)) return;
  
  event.preventDefault();
  
  const touch = event.touches[0];
  
  // Initialize touch state
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

/**
 * Handles touch move events
 * @param {TouchEvent} event - The touch event
 */
function handleTouchMove(event) {
  // Don't process if touch isn't active or game isn't running
  if (!touchState.active || !gameStarted || gameOver || gamePaused) return;
  
  // Allow UI elements to receive normal touches
  if (isUIElement(event.target)) return;
  
  event.preventDefault();
  
  const touch = event.touches[0];
  const currentX = touch.clientX;
  const currentY = touch.clientY;
  const currentTime = Date.now();
  
  // Calculate movement since start of touch
  const totalDeltaX = currentX - touchState.startX;
  const totalDeltaY = touchState.startY - currentY; // Inverted for easier logic (positive = downward)
  
  // Determine primary movement direction if not already set
  if (!touchState.movementDirection) {
    const totalMovement = Math.abs(totalDeltaX) + Math.abs(totalDeltaY);
    
    if (totalMovement > 20) {
      if (Math.abs(totalDeltaY) > Math.abs(totalDeltaX) * TOUCH_CONTROLS.VERTICAL_BIAS_THRESHOLD) {
        touchState.movementDirection = 'vertical';
      } else if (Math.abs(totalDeltaX) > Math.abs(totalDeltaY) * TOUCH_CONTROLS.HORIZONTAL_BIAS_THRESHOLD) {
        touchState.movementDirection = 'horizontal';
      }
      
      touchState.lastMoveX = currentX;
      touchState.lastMoveY = currentY;
    }
  }
  
  // Process movements with cooldown
  const timeSinceLastMove = currentTime - touchState.lastMoveTime;
  
  // Process horizontal movement (left/right)
  if (timeSinceLastMove >= TOUCH_CONTROLS.MOVE_COOLDOWN) {
    let horizontalThreshold = TOUCH_CONTROLS.MOVE_THRESHOLD;
    
    // Higher threshold for horizontal moves during vertical swipes
    if (touchState.movementDirection === 'vertical') {
      horizontalThreshold = TOUCH_CONTROLS.VERTICAL_MOVE_HORIZONTAL_THRESHOLD;
    }
    
    const horizontalMovement = currentX - touchState.lastMoveX;
    
    if (Math.abs(horizontalMovement) >= horizontalThreshold) {
      const direction = horizontalMovement > 0 ? 1 : -1; // 1 for right, -1 for left
      
      if (movePiece(direction, 0)) {
        // Update last position after successful move
        touchState.lastMoveX = currentX;
        touchState.lastMoveTime = currentTime;
        
        // Haptic feedback if available
        if (deviceUtils.supportsVibration()) {
          navigator.vibrate(10);
        }
      }
    }
  }
  
  // Process vertical movement (down)
  if (timeSinceLastMove >= TOUCH_CONTROLS.MOVE_COOLDOWN/2) {
    const verticalMovement = touchState.lastMoveY - currentY; // Negative = upward
    
    if (verticalMovement <= -TOUCH_CONTROLS.DOWN_THRESHOLD) { // User is swiping down
      if (movePiece(0, -1)) {
        touchState.lastMoveY = currentY;
        touchState.lastMoveTime = currentTime;
      }
    }
  }
  
  // Always update last position for next delta calculation
  touchState.lastX = currentX;
  touchState.lastY = currentY;
  
  // Check for hard drop - fast downward swipe
  if (totalDeltaY <= -TOUCH_CONTROLS.HARD_DROP_MIN_Y) { // User swiped down by threshold amount
    const duration = currentTime - touchState.startTime;
    
    if (duration > 50) { // Avoid accidental drops
      const velocity = Math.abs(totalDeltaY) / duration;
      
      if (velocity >= TOUCH_CONTROLS.HARD_DROP_VELOCITY) {
        // Execute hard drop
        dropPiece();
        
        // Reset touch state
        touchState.active = false;
        
        // Stronger haptic feedback for hard drop
        if (deviceUtils.supportsVibration()) {
          navigator.vibrate(30);
        }
      }
    }
  }
}

/**
 * Handles touch end events
 * @param {TouchEvent} event - The touch event
 */
function handleTouchEnd(event) {
  // Don't process if touch isn't active or game isn't running
  if (!touchState.active || !gameStarted || gameOver || gamePaused) return;
  
  // Allow UI elements to receive normal touches
  if (isUIElement(event.target)) return;
  
  event.preventDefault();
  
  const touch = event.changedTouches[0];
  
  // Calculate total movement for tap detection
  const deltaX = Math.abs(touch.clientX - touchState.startX);
  const deltaY = Math.abs(touch.clientY - touchState.startY);
  const duration = Date.now() - touchState.startTime;
  
  // Detect tap (small movement + short duration)
  if (deltaX < TOUCH_CONTROLS.TAP_THRESHOLD && 
      deltaY < TOUCH_CONTROLS.TAP_THRESHOLD && 
      duration < TOUCH_CONTROLS.TAP_DURATION) {
    
    // Rotate the piece on tap
    rotatePiece();
    
    // Light haptic feedback
    if (deviceUtils.supportsVibration()) {
      navigator.vibrate(15);
    }
  }
  
  // Reset touch state
  touchState.reset();
}

/**
 * Handle touch cancel events
 */
function handleTouchCancel() {
  touchState.reset();
}

/**
 * Sets up touch event handlers on the game canvas
 */
function setupTouchHandlers() {
  if (!deviceUtils.isMobile()) {
    console.log("Not initializing touch controls for non-mobile device");
    return;
  }
  
  console.log("Setting up touch handlers for mobile device");
  
  // Use the game container as fallback if canvas doesn't exist yet
  const gameContainer = document.getElementById('game-container');
  const canvas = renderer ? renderer.domElement : null;
  const targetElement = canvas || gameContainer;
  
  if (targetElement) {
    // Remove any existing event listeners to prevent duplicates
    targetElement.removeEventListener('touchstart', handleTouchStart);
    targetElement.removeEventListener('touchmove', handleTouchMove);
    targetElement.removeEventListener('touchend', handleTouchEnd);
    targetElement.removeEventListener('touchcancel', handleTouchCancel);
    
    // Add event listeners with passive: false to allow preventDefault
    targetElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    targetElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    targetElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    targetElement.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    
    console.log("Touch handlers initialized on", canvas ? "canvas" : "game container");
    
    // If we attached to the container but not canvas, wait for the canvas
    if (!canvas && gameContainer) {
      waitForCanvas();
    }
  } else {
    console.error("Could not find target element for touch handlers");
  }
}

/**
 * Wait for the canvas to be created and then attach touch handlers
 */
function waitForCanvas() {
  console.log("Waiting for canvas to be created...");
  
  // If renderer already exists, use it
  if (window.renderer && window.renderer.domElement) {
    setupTouchHandlers();
    return;
  }
  
  // Set up a MutationObserver to wait for the canvas
  const gameContainer = document.getElementById('game-container');
  
  if (!gameContainer) {
    console.error("Game container not found");
    return;
  }
  
  const observer = new MutationObserver(function(mutations) {
    for (const mutation of mutations) {
      if (mutation.addedNodes) {
        for (const node of mutation.addedNodes) {
          if (node.nodeName === 'CANVAS') {
            console.log("Canvas detected, attaching touch handlers");
            observer.disconnect();
            
            // Give the renderer a moment to initialize
            setTimeout(() => {
              if (window.renderer && window.renderer.domElement) {
                setupTouchHandlers();
              }
            }, 100);
            return;
          }
        }
      }
    }
  });
  
  observer.observe(gameContainer, { 
    childList: true,
    subtree: true
  });
  
  // Fallback timeout
  setTimeout(() => {
    observer.disconnect();
    if (window.renderer && window.renderer.domElement) {
      setupTouchHandlers();
    }
  }, 5000);
}

/**
 * Fix mobile button interactions
 */
function fixMobileButtons() {
  if (!deviceUtils.isMobile()) return;
  
  const buttonIds = [
    'start-button', 
    'restart-button1', 
    'restart-button2', 
    'play-button',
    'pause-button',
    'mute-button'
  ];
  
  buttonIds.forEach(id => {
    const button = document.getElementById(id);
    if (button) {
      // Ensure clicks reach these elements
      button.style.zIndex = '1000';
      button.style.position = 'relative';
      button.style.touchAction = 'manipulation';
      
      // Ensure proper tap handling
      button.addEventListener('touchstart', e => {
        e.stopPropagation();
      }, { passive: false });
    }
  });
  
  // Add CSS to ensure buttons are more tappable
  const style = document.createElement('style');
  style.textContent = `
    /* Fix for mobile buttons */
    #start-button, #restart-button1, #restart-button2, #play-button, #pause-button, #mute-button {
      position: relative;
      z-index: 300;
      touch-action: manipulation;
      -webkit-tap-highlight-color: rgba(0,0,0,0);
    }
    
    /* Make buttons easier to tap */
    @media (max-width: 768px) {
      #start-button, #restart-button1, #restart-button2, #play-button, #pause-button, #mute-button {
        min-height: 44px;
        min-width: 44px;
      }
    }
    
    /* Ensure overlay screens appear above canvas */
    #start-screen, #game-over, #pause-overlay {
      z-index: 250;
      pointer-events: auto;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Initialize touch controls
 */
function initTouchControls() {
  if (!deviceUtils.isMobile()) return;
  
  console.log("Initializing touch controls");
  
  // Fix mobile buttons first
  fixMobileButtons();
  
  // Set up touch handlers
  setupTouchHandlers();
  
  // Listen for new pieces to ensure touch controls remain active
  document.addEventListener('newPieceSpawned', () => {
    if (window.renderer && window.renderer.domElement) {
      if (!window.renderer.domElement.hasAttribute('touch-initialized')) {
        setupTouchHandlers();
        window.renderer.domElement.setAttribute('touch-initialized', 'true');
      }
    }
  });
}

// Initialize on load
window.addEventListener('load', initTouchControls);

// Initialize when the game starts
document.getElementById('start-button')?.addEventListener('click', () => {
  // Wait a moment for the game to initialize fully
  setTimeout(setupTouchHandlers, 300);
});