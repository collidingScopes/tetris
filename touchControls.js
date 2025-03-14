// Touch controls for mobile users
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let currentTouchX = 0;
let isTap = false;
let isMoving = false;
let lastMoveX = 0;
const MIN_SWIPE_DISTANCE = 30; // Minimum distance for a swipe to be registered
const MOVE_THRESHOLD = 20; // Distance required to trigger a movement

function initTouchControls() {
    const gameContainer = document.getElementById('game-container');
    
    // Add touch event listeners
    gameContainer.addEventListener('touchstart', handleTouchStart, false);
    gameContainer.addEventListener('touchmove', handleTouchMove, false);
    gameContainer.addEventListener('touchend', handleTouchEnd, false);
}

function handleTouchStart(event) {
    // Prevent default behavior to avoid scrolling
    if (gameStarted && !gameOver && !gamePaused) {
        event.preventDefault();
    }
    
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    currentTouchX = touchStartX;
    touchEndX = touchStartX;
    touchEndY = touchStartY;
    isTap = true;
    isMoving = false;
    lastMoveX = Math.floor(touchStartX / MOVE_THRESHOLD) * MOVE_THRESHOLD;
}

function handleTouchMove(event) {
    if (gameStarted && !gameOver && !gamePaused) {
        const currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;
        
        currentTouchX = currentX;
        touchEndX = currentX;
        touchEndY = currentY;
        
        // Determine if this is a drag (horizontal movement) or a swipe down
        const deltaX = currentX - touchStartX;
        const deltaY = currentY - touchStartY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        // If the finger moved more than a small threshold, it's not a tap
        if (absX > 10 || absY > 10) {
            isTap = false;
        }
        
        // If it's primarily horizontal movement, handle continuous movement
        if (absX > absY && absX > 10) {
            handleContinuousMovement(currentX);
        }
        
        // If it's a definite downward swipe, drop the piece immediately
        if (deltaY > MIN_SWIPE_DISTANCE && absY > absX && !isMoving) {
            dropPiece();
            isMoving = true; // Prevent multiple drops in the same gesture
        }
    }
}

function handleContinuousMovement(currentX) {
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
        isMoving = true;
    }
}

function handleTouchEnd(event) {
    if (!gameStarted || gameOver || gamePaused) return;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Detect tap (for rotation)
    if (isTap) {
        rotatePiece();
        return;
    }
    
    // Handle final horizontal movement if needed
    if (absX > MIN_SWIPE_DISTANCE && absX > absY && !isMoving) {
        // This handles the case where the movement wasn't enough to trigger continuous movement
        if (deltaX > 0) {
            // Swipe right
            movePiece(1, 0);
        } else {
            // Swipe left
            movePiece(-1, 0);
        }
    }
    
    // Handle vertical swipe down (hard drop) if not already handled
    if (deltaY > MIN_SWIPE_DISTANCE && absY > absX && !isMoving) {
        dropPiece();
    }
}

// Add this to the init function to initialize touch controls
window.addEventListener('load', function() {
    // This will be called after the original init function
    initTouchControls();
});