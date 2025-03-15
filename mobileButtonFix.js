/**
 * Fix for mobile start button issues
 * Add this code to the end of main.js or create a new file and include it in index.html
 */

// Fix mobile start button issue
document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('start-button');
  const restartButton = document.getElementById('restart-button');
  
  if (startButton) {
    // Remove existing click listeners to avoid duplication
    const newStartButton = startButton.cloneNode(true);
    startButton.parentNode.replaceChild(newStartButton, startButton);
    
    // Add both click and touchend events with preventDefault to ensure it works
    newStartButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      console.log("Start button touched");
      startGame();
    }, { passive: false });
    
    // Keep the click handler for desktop
    newStartButton.addEventListener('click', function(e) {
      console.log("Start button clicked");
      startGame();
    });
  }
  
  if (restartButton) {
    // Do the same for restart button
    const newRestartButton = restartButton.cloneNode(true);
    restartButton.parentNode.replaceChild(newRestartButton, restartButton);
    
    newRestartButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      console.log("Restart button touched");
      restartGame();
    }, { passive: false });
    
    newRestartButton.addEventListener('click', function(e) {
      console.log("Restart button clicked");
      restartGame();
    });
  }
  
  // Also ensure pause button works
  const pauseButton = document.getElementById('pause-button');
  if (pauseButton) {
    pauseButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      togglePause();
    }, { passive: false });
  }
});

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
        target.id === 'restart-button' ||
        target.id === 'pause-button' ||
        target.id === 'mute-button' ||
        target.closest('.level-selector') !== null
      ) {
        // Let the event continue without interference
        return;
      }
    }, { capture: true });
  }
}

// Run the fix on load
window.addEventListener('load', fixTouchPropagation);

// Apply CSS fix to ensure buttons are tappable
function applyButtonCSSFix() {
  const style = document.createElement('style');
  style.textContent = `
    /* Fix for mobile buttons */
    #start-button, #restart-button, #pause-button button, #mute-button {
      position: relative;
      z-index: 300;
      touch-action: manipulation;
      -webkit-tap-highlight-color: rgba(0,0,0,0);
      user-select: none;
    }
    
    /* Make start screen appear above canvas */
    #start-screen {
      z-index: 250;
    }
    
    /* Make game over screen appear above canvas */
    #game-over {
      z-index: 250;
    }
  `;
  document.head.appendChild(style);
}

// Apply CSS fix on load
window.addEventListener('load', applyButtonCSSFix);