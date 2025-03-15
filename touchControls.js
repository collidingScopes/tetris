/*
Instructions:
touchControls should only be available on iPad / mobile devices
Player should be able to move the tetromino block by dragging left/right/downwards
Swipping downwards with high velocity should trigger a hard drop of the block
All UI buttons (start game, restart game, mute button, pause button) should not be blocked by the touch interaction -- the user should be able to click those buttons
*/

/**
 * touchControls.js - Complete integrated touch controls and mobile button fixes
 * Handles all touch interactions for the Tetris game on mobile devices
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
  VERTICAL_BIAS_THRESHOLD: 2.0,  // Ratio of vertical to horizontal movement to consider primarily vertical
  HORIZONTAL_BIAS_THRESHOLD: 2,  // Ratio of horizontal to vertical movement to consider primarily horizontal
  VERTICAL_MOVE_HORIZONTAL_THRESHOLD: 50, // Increased threshold during vertical swipes
  DIRECTION_LOCK_DURATION: 150,  // Time in ms to lock in a movement direction
  TAP_THRESHOLD: 20,             // Maximum movement allowed for a tap gesture
  TAP_DURATION: 250,             // Maximum duration (ms) for a tap
  HARD_DROP_MIN_Y: 40,           // Minimum vertical distance for hard drop
  HARD_DROP_VELOCITY: 0.60,      // Pixels/ms velocity threshold for hard drop
  MOVE_COOLDOWN: 80              // Minimum time between consecutive move actions
};

/**
 * Checks if an element is a UI control that should receive normal touch events
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} True if the element is a UI control
 */
function isUIElement(element) {
  // If no element is provided, it's not a UI element
  if (!element) return false;
  
  // Check for direct matches on element
  if (
    element.tagName === 'BUTTON' || 
    element.tagName === 'SELECT' ||
    element.classList.contains('button') ||
    element.id === 'start-button' ||
    element.id === 'restart-button1' ||
    element.id === 'restart-button2' ||
    element.id === 'play-button' ||
    element.id === 'mute-button' ||
    element.id === 'starting-level' ||
    element.id === 'restarting-level1' ||
    element.id === 'restarting-level2'
  ) {
    return true;
  }
  
  // Check for parent elements that are UI elements
  const parent = element.closest('#start-screen, #game-over, #pause-overlay, #controls, .level-selector, #pause-button, #audio-control');
  if (parent) {
    return true;
  }
  
  // It's not a UI element
  return false;
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

// Setup touch event handlers on the THREE.js renderer's domElement
function setupTouchHandlers(element) {
  // First, ensure we remove any existing handlers to prevent duplicates
  element.removeEventListener('touchstart', handleTouchStart);
  element.removeEventListener('touchmove', handleTouchMove);
  element.removeEventListener('touchend', handleTouchEnd);
  element.removeEventListener('touchcancel', resetTouchState);
  
  // Now add our handlers
  element.addEventListener('touchstart', handleTouchStart, { passive: false });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });
  element.addEventListener('touchend', handleTouchEnd, { passive: false });
  element.addEventListener('touchcancel', resetTouchState, { passive: true });
  
  console.log("Touch handlers set up successfully on", element);
}

// FIX: Initialize touch controls AFTER the Three.js renderer is created
function initTouchControls() {
  // Only proceed if this is a mobile device
  if (!deviceUtils.isMobile()) {
    console.log("Not initializing touch controls for non-mobile device");
    return;
  }
  
  console.log("Initializing touch controls for mobile device");
  
  // Find the THREE.js canvas if it exists
  const rendererCanvas = document.querySelector('#game-container canvas');
  
  if (rendererCanvas) {
    // Canvas exists, set up touch controls immediately
    setupTouchHandlers(rendererCanvas);
    rendererCanvas.setAttribute('data-touch-initialized', 'true');
    console.log("Touch controls attached to existing canvas");
  } else {
    // Canvas doesn't exist yet, set up an observer to wait for it
    console.log("Canvas not found, waiting for it to be created...");
    
    const gameContainer = document.getElementById('game-container');
    
    // Set up a MutationObserver to wait for the canvas to be added
    const observer = new MutationObserver(function(mutations) {
      for (const mutation of mutations) {
        if (mutation.addedNodes) {
          for (const node of mutation.addedNodes) {
            if (node.nodeName === 'CANVAS' && !node.hasAttribute('data-touch-initialized')) {
              setupTouchHandlers(node);
              node.setAttribute('data-touch-initialized', 'true');
              console.log("Touch controls attached to dynamically created canvas");
              
              // Once we've found and initialized the canvas, disconnect the observer
              observer.disconnect();
              return;
            }
          }
        }
      }
    });
    
    // Start observing the game container for changes
    observer.observe(gameContainer, { 
      childList: true,
      subtree: true
    });
  }
}

// Add a function to properly initialize after THREE.js is ready
function waitForThreeJsRenderer() {
  const interval = setInterval(() => {
    if (window.renderer && window.renderer.domElement) {
      clearInterval(interval);
      setupTouchHandlers(window.renderer.domElement);
      window.renderer.domElement.setAttribute('data-touch-initialized', 'true');
      console.log("Touch controls attached to THREE.js renderer");
    }
  }, 100);
  
  // Safety timeout after 5 seconds
  setTimeout(() => clearInterval(interval), 5000);
}

// -----------------------------------------------------------------
// MOBILE BUTTON FIX INTEGRATION
// -----------------------------------------------------------------

/**
 * Fix button touch handling on mobile devices
 * Ensures buttons work properly alongside the game's touch controls
 */
function fixMobileButtons() {
  const startButton = document.getElementById('start-button');
  const restartButton1 = document.getElementById('restart-button1');
  const restartButton2 = document.getElementById('restart-button2');
  const playButton = document.getElementById('play-button');
  
  // Fix start button
  if (startButton) {
    // Remove existing click listeners to avoid duplication
    const newStartButton = startButton.cloneNode(true);
    startButton.parentNode.replaceChild(newStartButton, startButton);
    
    // Add both click and touchend events with stopPropagation to prevent interference with game touches
    newStartButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation(); // Important: stop propagation to game canvas
      console.log("Start button touched");
      startGame();
    }, { passive: false });
    
    // Keep the click handler for desktop
    newStartButton.addEventListener('click', function(e) {
      e.stopPropagation(); // Also stop click propagation
      console.log("Start button clicked");
      startGame();
    });
  }
  
  // Fix restart button 1 (pause overlay)
  if (restartButton1) {
    const newRestartButton = restartButton1.cloneNode(true);
    restartButton1.parentNode.replaceChild(newRestartButton, restartButton1);
    
    newRestartButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Restart button 1 touched");
      restartGame1();
    }, { passive: false });
    
    newRestartButton.addEventListener('click', function(e) {
      e.stopPropagation();
      console.log("Restart button 1 clicked");
      restartGame1();
    });
  }
  
  // Fix restart button 2 (game over screen)
  if (restartButton2) {
    const newRestartButton = restartButton2.cloneNode(true);
    restartButton2.parentNode.replaceChild(newRestartButton, restartButton2);
    
    newRestartButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Restart button 2 touched");
      restartGame2();
    }, { passive: false });
    
    newRestartButton.addEventListener('click', function(e) {
      e.stopPropagation();
      console.log("Restart button 2 clicked");
      restartGame2();
    });
  }
  
  // Fix play button
  if (playButton) {
    const newPlayButton = playButton.cloneNode(true);
    playButton.parentNode.replaceChild(newPlayButton, playButton);
    
    newPlayButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Play button touched");
      playGame();
    }, { passive: false });
    
    newPlayButton.addEventListener('click', function(e) {
      e.stopPropagation();
      console.log("Play button clicked");
      playGame();
    });
  }
  
  // Fix pause button
  const pauseButton = document.querySelector('#pause-button button');
  if (pauseButton) {
    const newPauseButton = pauseButton.cloneNode(true);
    pauseButton.parentNode.replaceChild(newPauseButton, pauseButton);
    
    newPauseButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Pause button touched");
      togglePause();
    }, { passive: false });
    
    newPauseButton.addEventListener('click', function(e) {
      e.stopPropagation();
      console.log("Pause button clicked");
      togglePause();
    });
  }
  
  // Fix mute button
  const muteButton = document.getElementById('mute-button');
  if (muteButton) {
    const newMuteButton = muteButton.cloneNode(true);
    muteButton.parentNode.replaceChild(newMuteButton, muteButton);
    
    newMuteButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Mute button touched");
      // The audio toggle functionality is handled elsewhere
    }, { passive: false });
  }
}

// Apply CSS fix to ensure buttons are tappable and properly positioned above the canvas
function applyButtonCSSFix() {
  const style = document.createElement('style');
  style.textContent = `
    /* Fix for mobile buttons */
    #start-button, #restart-button1, #restart-button2, #play-button, #pause-button button, #mute-button {
      position: relative;
      z-index: 300;
      touch-action: manipulation;
      -webkit-tap-highlight-color: rgba(0,0,0,0);
      user-select: none;
      cursor: pointer;
    }
    
    /* Make buttons easier to tap on mobile */
    @media (max-width: 768px) {
      #start-button, #restart-button1, #restart-button2, #play-button, #pause-button button, #mute-button {
        padding: 15px 25px;
        min-height: 44px;
        min-width: 44px;
      }
    }
    
    /* Make start screen appear above canvas */
    #start-screen {
      z-index: 250;
      pointer-events: auto;
    }
    
    /* Make game over screen appear above canvas */
    #game-over {
      z-index: 250;
      pointer-events: auto;
    }
    
    /* Make pause overlay appear above canvas */
    #pause-overlay {
      z-index: 250;
      pointer-events: auto;
    }
    
    /* Ensure canvas doesn't capture all touch events */
    #game-container canvas {
      z-index: 10;
      touch-action: none;
    }
  `;
  document.head.appendChild(style);
}

// Fix touch event propagation in game container
function fixTouchPropagation() {
  const gameContainer = document.getElementById('game-container');
  
  if (gameContainer && deviceUtils.isMobile()) {
    // Add a specific capture phase handler for UI elements
    gameContainer.addEventListener('touchstart', function(e) {
      const target = e.target;
      
      // If the touch is on a button or UI control, don't interfere
      if (
        target.tagName === 'BUTTON' || 
        target.classList.contains('button') ||
        target.id === 'start-button' ||
        target.id === 'restart-button1' ||
        target.id === 'restart-button2' ||
        target.id === 'pause-button' ||
        target.id === 'mute-button' ||
        target.closest('.level-selector') !== null
      ) {
        // Don't prevent default or stop propagation
        // Just let it pass through to the normal event handlers
        return;
      }
    }, { capture: true });
  }
}

// -----------------------------------------------------------------
// INITIALIZATION AND EVENT BINDING
// -----------------------------------------------------------------

// Hook into the game start for initialization
function hookIntoGameStart() {
  const startButton = document.getElementById('start-button');
  if (startButton) {
    startButton.addEventListener('click', function() {
      // Wait a moment for the game to initialize before setting up touch controls
      setTimeout(initTouchControls, 200);
    });
  }
}

// Main initialization function to run on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  // First, fix mobile buttons
  fixMobileButtons();
  
  // Fix touch propagation
  fixTouchPropagation();
  
  // Apply CSS fixes
  applyButtonCSSFix();
  
  // Attempt to initialize touch controls right away
  initTouchControls();
  
  // Also try after a short delay to allow scripts to initialize
  setTimeout(initTouchControls, 500);
  
  // Wait specifically for the THREE.js renderer
  setTimeout(waitForThreeJsRenderer, 1000);
  
  // Final safety attempt after everything should be loaded
  setTimeout(initTouchControls, 2000);
});

// Reinitialize controls when a new game starts
document.addEventListener('newPieceSpawned', function() {
  const canvas = document.querySelector('#game-container canvas');
  if (canvas && !canvas.hasAttribute('data-touch-initialized')) {
    setupTouchHandlers(canvas);
    canvas.setAttribute('data-touch-initialized', 'true');
    console.log("Touch controls attached after new piece spawned");
  }
});

// Run our game start hook when the page loads
window.addEventListener('load', hookIntoGameStart);