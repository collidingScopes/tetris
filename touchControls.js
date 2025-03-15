// Touch controls for mobile users
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let currentTouchX = 0;
let currentTouchY = 0;
let lastMoveX = 0;
let lastMoveY = 0;
let isTap = false;
let isHardDrop = false;
let isDownwardSwipe = false;
let activeTouchId = null;
const MIN_SWIPE_DISTANCE = 50; // Minimum distance for a swipe to be registered
const MOVE_THRESHOLD = 40; // Distance required to trigger a movement
const DOWN_MOVE_THRESHOLD = 30; // Distance required to trigger a downward movement
const HARD_DROP_THRESHOLD = 100; // Distance required for a hard drop
const DOWNWARD_SWIPE_THRESHOLD = 10; // Threshold to detect primarily downward movement

function initTouchControls() {
    const gameContainer = document.getElementById('game-container');
    
    // Add touch event listeners
    gameContainer.addEventListener('touchstart', handleTouchStart, false);
    gameContainer.addEventListener('touchmove', handleTouchMove, false);
    gameContainer.addEventListener('touchend', handleTouchEnd, false);
    
    // Listen for new piece spawns to reset touch interaction
    document.addEventListener('newPieceSpawned', resetTouchInteraction);
}

function resetTouchInteraction() {
    // Reset all touch variables when a new piece is spawned
    activeTouchId = null;
    isDownwardSwipe = false;
    isHardDrop = false;
}

function handleTouchStart(event) {
    // Prevent default behavior to avoid scrolling
    if (gameStarted && !gameOver && !gamePaused) {
        event.preventDefault();
    }
    
    // Only process touch if no active touch or previous touch completed
    if (activeTouchId === null) {
        activeTouchId = event.touches[0].identifier;
        
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        currentTouchX = touchStartX;
        currentTouchY = touchStartY;
        touchEndX = touchStartX;
        touchEndY = touchStartY;
        isTap = true;
        isHardDrop = false;
        isDownwardSwipe = false;
        lastMoveX = Math.floor(touchStartX / MOVE_THRESHOLD) * MOVE_THRESHOLD;
        lastMoveY = Math.floor(touchStartY / DOWN_MOVE_THRESHOLD) * DOWN_MOVE_THRESHOLD;
    }
}

function handleTouchMove(event) {
    if (!gameStarted || gameOver || gamePaused || activeTouchId === null) return;
    
    // Find our active touch
    let activeTouch = null;
    for (let i = 0; i < event.touches.length; i++) {
        if (event.touches[i].identifier === activeTouchId) {
            activeTouch = event.touches[i];
            break;
        }
    }
    
    // If we lost our active touch, exit
    if (!activeTouch) return;
    
    const currentX = activeTouch.clientX;
    const currentY = activeTouch.clientY;
    
    currentTouchX = currentX;
    currentTouchY = currentY;
    touchEndX = currentX;
    touchEndY = currentY;
    
    // Determine the type of movement
    const deltaX = currentX - touchStartX;
    const deltaY = currentY - touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // If the finger moved more than a small threshold, it's not a tap
    if (absX > 10 || absY > 10) {
        isTap = false;
    }
    
    // Detect if this is primarily a downward swipe
    if (deltaY > DOWNWARD_SWIPE_THRESHOLD && absY > absX * 1.2) {
        isDownwardSwipe = true;
    }
    
    // Handle horizontal movement only if not in a downward swipe
    if (!isDownwardSwipe && absX > 10) {
        handleHorizontalMovement(currentX);
    }
    
    // Handle vertical movement if there's enough vertical movement
    if (deltaY > 10) {
        // Check for hard drop first - if movement is very fast and primarily downward
        if (deltaY > HARD_DROP_THRESHOLD && absY > absX * 1.5 && !isHardDrop) {
            dropPiece();
            isHardDrop = true;
            
            // Immediately end this touch interaction after a hard drop
            activeTouchId = null;
        } else {
            // Otherwise handle gradual downward movement
            handleVerticalMovement(currentY);
        }
    }
}

function handleHorizontalMovement(currentX) {
    // Calculate how many movements we should make based on distance
    const currentBlockX = Math.floor(currentX / MOVE_THRESHOLD) * MOVE_THRESHOLD;
    
    if (currentBlockX !== lastMoveX) {
        // Determine direction and number of movements
        const moveDirection = currentBlockX > lastMoveX ? 1 : -1;
        const moveSteps = Math.floor(Math.abs(currentBlockX - lastMoveX) / MOVE_THRESHOLD);
        
        // Move the piece the appropriate number of times in the right direction
        for (let i = 0; i < moveSteps; i++) {
            movePiece(moveDirection, 0);
        }
        
        // Update last move position
        lastMoveX = currentBlockX;
    }
}

function handleVerticalMovement(currentY) {
    // For downward movement, we want a slightly different threshold
    const currentBlockY = Math.floor(currentY / DOWN_MOVE_THRESHOLD) * DOWN_MOVE_THRESHOLD;
    
    if (currentBlockY !== lastMoveY && currentBlockY > lastMoveY) {
        // Calculate number of downward moves
        const moveSteps = Math.floor((currentBlockY - lastMoveY) / DOWN_MOVE_THRESHOLD);
        
        // Move the piece down appropriate number of times
        for (let i = 0; i < moveSteps; i++) {
            movePiece(0, -1);
        }
        
        // Update last vertical position
        lastMoveY = currentBlockY;
    }
}

function handleTouchEnd(event) {
    if (!gameStarted || gameOver || gamePaused) return;
    
    // Check if our active touch has ended
    let touchFound = false;
    for (let i = 0; i < event.touches.length; i++) {
        if (event.touches[i].identifier === activeTouchId) {
            touchFound = true;
            break;
        }
    }
    
    // If our touch has ended, process the final action
    if (!touchFound) {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        // Detect tap (for rotation)
        if (isTap) {
            rotatePiece();
        }
        // Handle hard drop if not already processed and it's a significant downward swipe
        else if (deltaY > HARD_DROP_THRESHOLD && absY > absX && !isHardDrop) {
            dropPiece();
        }
        // Otherwise handle a final horizontal movement if needed
        else if (!isDownwardSwipe && absX > MIN_SWIPE_DISTANCE && absX > absY * 0.7) {
            if (deltaX > 0) {
                // Swipe right
                movePiece(1, 0);
            } else {
                // Swipe left
                movePiece(-1, 0);
            }
        }
        
        // Reset active touch
        activeTouchId = null;
    }
}

// Add this to the init function to initialize touch controls
window.addEventListener('load', function() {
    // This will be called after the original init function
    initTouchControls();
});