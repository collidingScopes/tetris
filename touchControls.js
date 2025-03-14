// Touch controls for mobile users
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isTap = false;
const MIN_SWIPE_DISTANCE = 30; // Minimum distance for a swipe to be registered

function initTouchControls() {
    const gameContainer = document.getElementById('game-container');
    
    // Create mobile controls indicator
    const mobileControls = document.createElement('div');
    mobileControls.id = 'mobile-controls-info';
    mobileControls.innerHTML = `
        <div class="mobile-controls-title">Touch Controls:</div>
        <div class="mobile-control-item">👆 Tap to rotate</div>
        <div class="mobile-control-item">👈 Swipe left/right to move</div>
        <div class="mobile-control-item">👇 Swipe down to drop</div>
    `;
    document.getElementById('game-container').appendChild(mobileControls);
    
    // Add touch event listeners
    gameContainer.addEventListener('touchstart', handleTouchStart, false);
    gameContainer.addEventListener('touchmove', handleTouchMove, false);
    gameContainer.addEventListener('touchend', handleTouchEnd, false);
    
    // Check if we're on a mobile device and show mobile controls
    updateMobileControlsVisibility();
    window.addEventListener('resize', updateMobileControlsVisibility);
}

function updateMobileControlsVisibility() {
    const isMobile = window.innerWidth <= 768;
    const mobileControls = document.getElementById('mobile-controls-info');
    
    if (mobileControls) {
        mobileControls.style.display = isMobile ? 'block' : 'none';
    }
}

function handleTouchStart(event) {
    // Prevent default behavior to avoid scrolling
    if (gameStarted && !gameOver && !gamePaused) {
        event.preventDefault();
    }
    
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    touchEndX = touchStartX;
    touchEndY = touchStartY;
    isTap = true;
}

function handleTouchMove(event) {
    if (gameStarted && !gameOver && !gamePaused) {
        touchEndX = event.touches[0].clientX;
        touchEndY = event.touches[0].clientY;
        
        // If the finger moved more than a small threshold, it's not a tap
        if (Math.abs(touchEndX - touchStartX) > 10 || Math.abs(touchEndY - touchStartY) > 10) {
            isTap = false;
        }
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
    
    // Horizontal swipe (move left/right)
    if (absX > MIN_SWIPE_DISTANCE && absX > absY) {
        if (deltaX > 0) {
            // Swipe right
            movePiece(1, 0);
        } else {
            // Swipe left
            movePiece(-1, 0);
        }
    }
    
    // Vertical swipe down (hard drop)
    if (deltaY > MIN_SWIPE_DISTANCE && absY > absX) {
        dropPiece();
    }
}

// Add this to the init function to initialize touch controls
window.addEventListener('load', function() {
    // This will be called after the original init function
    initTouchControls();
});