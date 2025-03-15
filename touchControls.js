/**
 * Enhanced Touch Controls for Tetris
 * Replaces touchControls.js with improved event handling
 */

function initTouchControls() {
  // Only initialize if this is a mobile device
  if (!deviceUtils.isMobile()) {
    console.log("Not a mobile device, skipping touch controls");
    return;
  }
  
  console.log("Mobile device detected, initializing touch controls");
  
  // Add a class to the body to indicate touch mode
  document.body.classList.add('touch-mode');
  
  // Try to get the canvas immediately
  let canvas = document.querySelector('#game-container canvas');
  
  if (canvas) {
    setupTouchListeners(canvas);
    console.log("Touch controls initialized immediately on canvas");
  } else {
    // Set up a mutation observer to watch for the canvas being added
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeName === 'CANVAS') {
              setupTouchListeners(node);
              console.log("Touch controls initialized via observer on canvas");
              observer.disconnect();
            }
          });
        }
      });
    });
    
    // Start observing the game container
    observer.observe(document.getElementById('game-container'), { 
      childList: true, 
      subtree: true 
    });
    
    // Fallback timeout approach as well
    setTimeout(() => {
      canvas = document.querySelector('#game-container canvas');
      if (canvas && !canvas.hasAttribute('touch-initialized')) {
        setupTouchListeners(canvas);
        console.log("Touch controls initialized via timeout fallback");
      }
    }, 1000);
  }
  
  // Listen for new piece spawns to reset touch state
  document.addEventListener('newPieceSpawned', function() {
    console.log("New piece spawned, touch state reset");
    // Reset state will be managed in the touch state object
  });
}

function setupTouchListeners(canvas) {
  // Mark the canvas as having touch initialized to prevent duplicate setup
  canvas.setAttribute('touch-initialized', 'true');
  
  // Simple touch state with only essential properties
  const touchState = {
    startX: 0,
    startY: 0,
    startTime: 0,
    lastMoveX: 0,
    lastMoveY: 0,
    isTouchActive: false,
    reset: function() {
      this.isTouchActive = false;
    }
  };
  
  // Constants for gesture detection - REDUCED THRESHOLDS for better responsiveness
  const TOUCH = {
    MOVE_THRESHOLD: 15,    // Reduced from 30 - Min pixels for horizontal movement
    DOWN_THRESHOLD: 20,    // Reduced from 40 - Min pixels for downward movement
    TAP_THRESHOLD: 20,     // Increased slightly - Max movement for a tap
    TAP_DURATION: 300,     // Max duration for a tap (ms)
    HARD_DROP_MIN_Y: 60,   // Reduced from 100 - Min pixels for hard drop swipe
    HARD_DROP_SPEED: 0.5   // Reduced from 0.7 - Min pixels/ms for hard drop
  };
  
  // Log initialization
  console.log("Setting up touch handlers with thresholds:", TOUCH);
  
  // Instead of attaching to canvas only, attach to game container for wider area
  const gameContainer = document.getElementById('game-container');
  
  // Create an overlay div that will receive all touch events
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
  
  // We'll use the overlay for touch events instead of the canvas
  const touchElement = touchOverlay;
  
  // Touch start handler
  touchElement.addEventListener('touchstart', function(event) {
    // Ignore if game is not running
    if (!gameStarted || gameOver || gamePaused) return;
    
    // Skip if touching UI elements
    if (isUIElement(event.target)) return;
    
    // Important: Prevent default to stop scrolling
    event.preventDefault();
    
    const touch = event.touches[0];
    
    // Initialize touch state
    touchState.startX = touch.clientX;
    touchState.startY = touch.clientY;
    touchState.lastMoveX = touch.clientX;
    touchState.lastMoveY = touch.clientY;
    touchState.startTime = Date.now();
    touchState.isTouchActive = true;
    
    console.log("Touch start:", touchState.startX, touchState.startY);
  }, { passive: false }); // Must be non-passive to call preventDefault
  
  // Touch move handler with reduced throttling
  let lastMoveTime = 0;
  
  touchElement.addEventListener('touchmove', function(event) {
    // Ignore if game is not running or touch is not active
    if (!gameStarted || gameOver || gamePaused || !touchState.isTouchActive) return;
    
    // Skip if touching UI elements
    if (isUIElement(event.target)) return;
    
    // Critical: Prevent default to stop scrolling
    event.preventDefault();
    
    // Apply light throttling (60+ fps)
    const now = Date.now();
    if (now - lastMoveTime < 10) return; // Process at ~100fps for smoother feeling
    lastMoveTime = now;
    
    const touch = event.touches[0];
    
    // Calculate deltas
    const currentDeltaX = touch.clientX - touchState.lastMoveX;
    const currentDeltaY = touch.clientY - touchState.lastMoveY;
    const totalDeltaY = touch.clientY - touchState.startY;
    
    // Debug logging for significant movements
    if (Math.abs(currentDeltaX) > 5 || Math.abs(currentDeltaY) > 5) {
      console.log("Touch move - deltaX:", currentDeltaX, "deltaY:", currentDeltaY);
    }
    
    // ---- HORIZONTAL MOVEMENT (LEFT/RIGHT) ----
    if (Math.abs(currentDeltaX) >= TOUCH.MOVE_THRESHOLD) {
      // Move left or right
      const direction = currentDeltaX > 0 ? 1 : -1;
      movePiece(direction, 0);
      
      // Update last position for horizontal
      touchState.lastMoveX = touch.clientX;
      
      // Provide very light haptic feedback if available
      if (deviceUtils.supportsVibration()) {
        navigator.vibrate(10);
      }
    }
    
    // ---- VERTICAL MOVEMENT (DOWN) ----
    if (currentDeltaY >= TOUCH.DOWN_THRESHOLD) {
      // Move down
      movePiece(0, -1);
      
      // Update last position for vertical with smaller increment to allow continuous movement
      touchState.lastMoveY += TOUCH.DOWN_THRESHOLD * 0.8;
    }
    
    // ---- HARD DROP DETECTION ----
    const duration = now - touchState.startTime;
    
    // Fast downward swipe detection (high velocity + minimum distance)
    if (duration > 50 && totalDeltaY > TOUCH.HARD_DROP_MIN_Y) {
      const velocity = totalDeltaY / duration;
      if (velocity > TOUCH.HARD_DROP_SPEED) {
        console.log("Hard drop detected - velocity:", velocity);
        dropPiece();
        touchState.isTouchActive = false;
        
        // Provide stronger haptic feedback for hard drop
        if (deviceUtils.supportsVibration()) {
          navigator.vibrate(50);
        }
      }
    }
  }, { passive: false }); // Must be non-passive
  
  // Touch end handler for tap detection (rotation)
  touchElement.addEventListener('touchend', function(event) {
    // Ignore if game is not running or touch is not active
    if (!gameStarted || gameOver || gamePaused || !touchState.isTouchActive) return;
    
    // Skip if touching UI elements
    if (isUIElement(event.target)) return;
    
    // Get the last touch position
    const touch = event.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchState.startX);
    const deltaY = Math.abs(touch.clientY - touchState.startY);
    const duration = Date.now() - touchState.startTime;
    
    console.log("Touch end - deltaX:", deltaX, "deltaY:", deltaY, "duration:", duration);
    
    // Tap detection for rotation (small movement + short time)
    if (deltaX < TOUCH.TAP_THRESHOLD && deltaY < TOUCH.TAP_THRESHOLD && duration < TOUCH.TAP_DURATION) {
      console.log("Tap detected, rotating piece");
      rotatePiece();
      
      // Light haptic feedback for rotation
      if (deviceUtils.supportsVibration()) {
        navigator.vibrate(15);
      }
    }
    
    // Reset touch state
    touchState.isTouchActive = false;
  }, { passive: true });
  
  // Touch cancel handler
  touchElement.addEventListener('touchcancel', function() {
    touchState.isTouchActive = false;
  }, { passive: true });
  
  // Add some additional debug/visual feedback
  if (deviceUtils.isMobile()) {
    // Add a visual indicator for touch positions (debug only)
    /*
    const touchIndicator = document.createElement('div');
    touchIndicator.id = 'touch-indicator';
    touchIndicator.style.position = 'absolute';
    touchIndicator.style.width = '20px';
    touchIndicator.style.height = '20px';
    touchIndicator.style.borderRadius = '50%';
    touchIndicator.style.background = 'rgba(255,0,0,0.5)';
    touchIndicator.style.pointerEvents = 'none';
    touchIndicator.style.zIndex = '999';
    touchIndicator.style.display = 'none';
    gameContainer.appendChild(touchIndicator);
    
    // Show touch position during debug
    touchElement.addEventListener('touchmove', function(event) {
      const touch = event.touches[0];
      touchIndicator.style.display = 'block';
      touchIndicator.style.left = (touch.clientX - 10) + 'px';
      touchIndicator.style.top = (touch.clientY - 10) + 'px';
    }, { passive: true });
    
    touchElement.addEventListener('touchend', function() {
      touchIndicator.style.display = 'none';
    }, { passive: true });
    */
  }
  
  console.log("Touch listeners successfully set up on game element");
}

/**
 * Improved function to check if an element is a UI control
 */
function isUIElement(element) {
  // UI element identifiers
  const uiSelectors = [
    '#pause-button', '#mute-button', '#start-button', '#restart-button',
    '.level-selector', 'button', 'select', '.button'
  ];
  
  // Check if the element or any parent matches UI selectors
  let target = element;
  while (target && target !== document) {
    // Check tag names first
    if (['BUTTON', 'SELECT', 'INPUT'].includes(target.tagName)) {
      return true;
    }
    
    // Check all selectors
    for (const selector of uiSelectors) {
      if ((selector.startsWith('#') && target.id === selector.substring(1)) ||
          (selector.startsWith('.') && target.classList.contains(selector.substring(1))) ||
          (selector === target.tagName.toLowerCase())) {
        return true;
      }
    }
    
    target = target.parentElement;
  }
  
  return false;
}

// Initialize touch controls when the page loads if on mobile
window.addEventListener('load', initTouchControls);