/**
 * uiAdapter.js
 * Handles adapting the UI for different device types
 */

/**
 * Adapts the UI based on the device type (mobile/desktop)
 * @returns {boolean} Whether the device is mobile
 */
function adaptUIForDevice() {
  let isMobile = deviceUtils.isMobile();
  
  // Elements to update
  const desktopControls = document.querySelector('#start-screen .controls-list:not(.mobile-controls .controls-list)');
  const mobileControlsContainer = document.querySelector('#start-screen .mobile-controls');
  const gameContainer = document.getElementById('game-container');
  const controlsDisplay = document.getElementById('controls');
  
  if (isMobile) {
    console.log("Mobile device detected, updating UI accordingly");
    
    // On mobile: hide desktop controls, show mobile controls
    if (desktopControls) desktopControls.style.display = 'none';
    if (mobileControlsContainer) mobileControlsContainer.style.display = 'block';
    if (controlsDisplay) controlsDisplay.style.display = 'none';
    
    // Add mobile-specific class to game container
    if (gameContainer) {
      gameContainer.classList.add('mobile-view');
    }
    
    // Make buttons more touch-friendly
    document.querySelectorAll('.button').forEach(button => {
      button.classList.add('touch-friendly');
    });
    
    // Make sure the start button is easily tappable
    const startButton = document.getElementById('start-button');
    if (startButton) {
      console.log("Ensuring start button works on mobile");
      startButton.style.zIndex = "1000";
    }
  } else {
    // On desktop: show desktop controls, hide mobile controls
    if (desktopControls) desktopControls.style.display = 'block';
    if (mobileControlsContainer) mobileControlsContainer.style.display = 'none';
    if (controlsDisplay) controlsDisplay.style.display = 'block';
    
    // Remove mobile-specific class if exists
    if (gameContainer) {
      gameContainer.classList.remove('mobile-view');
    }
  }
  
  // Set up resize handling with debounce
  setupResponsiveHandling();
  
  return isMobile;
}

/**
 * Sets up responsive handling for window resize
 */
function setupResponsiveHandling() {
  let resizeTimeout;
  
  window.addEventListener('resize', function() {
    // Debounce resize events to avoid performance issues
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      // Re-adapt UI on resize
      adaptUIForDevice();
      
      // If game has a resize handler, call it
      if (typeof handleResize === 'function') {
        handleResize();
      }
    }, 250);
  });
  
  // Handle orientation changes on mobile
  window.addEventListener('orientationchange', function() {
    setTimeout(adaptUIForDevice, 200);
  });
}