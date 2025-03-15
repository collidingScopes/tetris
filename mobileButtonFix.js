/**
 * Fix for mobile start button issues
 * Add this code to the end of main.js or create a new file and include it in index.html
 */

document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('start-button');
  const restartButton1 = document.getElementById('restart-button1');
  const restartButton2 = document.getElementById('restart-button2');
  const playButton = document.getElementById('play-button');
  
  // Fix start button
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
  
  // Fix restart button 1 (pause overlay)
  if (restartButton1) {
    const newRestartButton = restartButton1.cloneNode(true);
    restartButton1.parentNode.replaceChild(newRestartButton, restartButton1);
    
    newRestartButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      console.log("Restart button 1 touched");
      restartGame1();
    }, { passive: false });
    
    newRestartButton.addEventListener('click', function(e) {
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
      console.log("Restart button 2 touched");
      restartGame2();
    }, { passive: false });
    
    newRestartButton.addEventListener('click', function(e) {
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
      console.log("Play button touched");
      playGame();
    }, { passive: false });
    
    newPlayButton.addEventListener('click', function(e) {
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
      console.log("Pause button touched");
      togglePause();
    }, { passive: false });
    
    newPauseButton.addEventListener('click', function(e) {
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
      console.log("Mute button touched");
      // The audio toggle functionality is handled elsewhere
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