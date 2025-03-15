// dynamicControls.js - Script for showing appropriate control instructions based on device type

// Function to detect if user is on a mobile device
function isMobileDevice() {
  // Primary check is for touch capability
  const hasTouchCapability = 'ontouchstart' in window || 
                             navigator.maxTouchPoints > 0 || 
                             navigator.msMaxTouchPoints > 0;
  
  // Secondary check is for screen size and common mobile user agents
  const isMobileSize = window.innerWidth <= 768;
  const isMobileAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  return hasTouchCapability && (isMobileSize || isMobileAgent);
}

// Function to update control instructions based on device type
function updateControlsDisplay() {
  const desktopControls = document.querySelector('#start-screen .controls-list:not(.mobile-controls .controls-list)');
  const mobileControlsContainer = document.querySelector('#start-screen .mobile-controls');
  
  if (isMobileDevice()) {
    console.log("Mobile device detected, updating UI accordingly");
    
    // On mobile: hide desktop controls, show mobile controls
    if (desktopControls) desktopControls.style.display = 'none';
    if (mobileControlsContainer) mobileControlsContainer.style.display = 'block';
    
    // Update game container for better mobile experience
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.classList.add('mobile-view');
    }
    
    // Make all buttons more touch-friendly by adding a clickable class
    const allButtons = document.querySelectorAll('.button');
    allButtons.forEach(button => {
      button.classList.add('touch-friendly');
    });
    
    // Add specific handling for start button to ensure it works
    const startButton = document.getElementById('start-button');
    if (startButton) {
      console.log("Ensuring start button works on mobile");
      // Make sure any event listeners can't interfere with button functionality
      startButton.style.zIndex = "1000";
    }
  } else {
    // On desktop: show desktop controls, hide mobile controls
    if (desktopControls) desktopControls.style.display = 'block';
    if (mobileControlsContainer) mobileControlsContainer.style.display = 'none';
    
    // Remove mobile-specific class if exists
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.classList.remove('mobile-view');
    }
  }
}

// Initialize the controls display when the window loads
window.addEventListener('load', function() {
  console.log("Dynamic controls initialized");
  updateControlsDisplay();
  
  // Update controls display on window resize
  window.addEventListener('resize', updateControlsDisplay);
  
  // Also update when orientation changes on mobile devices
  window.addEventListener('orientationchange', updateControlsDisplay);
});