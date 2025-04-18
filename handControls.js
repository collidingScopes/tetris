/**
 * handControls.js
 * Simplified hand gesture controls for Tetris using MediaPipe
 */

// Configuration options for hand controls
const handControlsConfig = {
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
    movementThreshold: 0.02,
    gestureThreshold: 100,
    velocityThreshold: 0.1,
    baseSensitivity: 4,
    horizontalSensitivityMultiplier: 2.5,
    fistHoldDuration: 600,
    indexFingerHoldDuration: 500, // Duration to hold index finger pose for rotation
    enabled: false
};
  
// State variables for hand tracking
let handLandmarks = null;
let previousHandLandmarks = null;
let lastGestureTime = 0;
let handTrackingActive = false;
let videoElement = null;
let hands = null;
let handCamera = null;
let gestureDirection = null;
let gestureStartTime = 0;
let trackingStarted = false;
let fistGestureStartTime = 0;
let isMakingFistGesture = false;
let fistNotificationElement = null;

// New state variables for index finger rotation gesture
let isHoldingIndexFingerGesture = false;
let indexFingerGestureStartTime = 0;
let indexFingerNotificationElement = null;
  
/**
 * Initialize hand controls
 */
function initHandControls() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error("getUserMedia is not supported in this browser");
    return;
  }

  // Set up MediaPipe Hands when the module is loaded
  if (window.Holistic) {
    console.log("MediaPipe already loaded, initializing hands");
    setupMediaPipeHands();
  } else {
    console.log("Loading MediaPipe scripts");
    loadMediaPipeScripts().then(() => {
      console.log("MediaPipe loaded, initializing hands");
      setupMediaPipeHands();
    });
  }
  
  // Create the fist notification element
  createFistNotification();
  
  // Create the index finger notification element
  createIndexFingerNotification();
}

/**
 * Create the fist notification element
 */
function createFistNotification() {
  fistNotificationElement = document.createElement('div');
  fistNotificationElement.id = 'fist-notification';
  fistNotificationElement.textContent = 'Hold Fist to Drop Piece ✊';
  fistNotificationElement.style.position = 'absolute';
  fistNotificationElement.style.top = '20px';
  fistNotificationElement.style.left = '50%';
  fistNotificationElement.style.transform = 'translateX(-50%)';
  fistNotificationElement.style.backgroundColor = 'rgba(4, 0, 255, 0.8)';
  fistNotificationElement.style.color = 'white';
  fistNotificationElement.style.padding = '8px 16px';
  fistNotificationElement.style.borderRadius = '5px';
  fistNotificationElement.style.fontSize = '20px';
  fistNotificationElement.style.fontWeight = 'bold';
  fistNotificationElement.style.zIndex = '200';
  fistNotificationElement.style.display = 'none';
  fistNotificationElement.style.transition = 'opacity 0.3s ease';
  document.body.appendChild(fistNotificationElement);
}

/**
 * Create the index finger notification element
 */
function createIndexFingerNotification() {
  indexFingerNotificationElement = document.createElement('div');
  indexFingerNotificationElement.id = 'index-finger-notification';
  indexFingerNotificationElement.textContent = 'Hold Index Finger to Rotate Piece ☝️';
  indexFingerNotificationElement.style.position = 'absolute';
  indexFingerNotificationElement.style.top = '40px';
  indexFingerNotificationElement.style.left = '50%';
  indexFingerNotificationElement.style.transform = 'translateX(-50%)';
  indexFingerNotificationElement.style.backgroundColor = 'rgba(0, 200, 0, 0.8)';
  indexFingerNotificationElement.style.color = 'white';
  indexFingerNotificationElement.style.padding = '8px 16px';
  indexFingerNotificationElement.style.borderRadius = '5px';
  indexFingerNotificationElement.style.fontSize = '20px';
  indexFingerNotificationElement.style.fontWeight = 'bold';
  indexFingerNotificationElement.style.zIndex = '200';
  indexFingerNotificationElement.style.display = 'none';
  indexFingerNotificationElement.style.transition = 'opacity 0.3s ease';
  document.body.appendChild(indexFingerNotificationElement);
}
  
/**
 * Load MediaPipe scripts dynamically
 */
function loadMediaPipeScripts() {
  return new Promise((resolve) => {
    // Load MediaPipe scripts
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
    script1.crossOrigin = 'anonymous';

    const script2 = document.createElement('script');
    script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
    script2.crossOrigin = 'anonymous';

    const script3 = document.createElement('script');
    script3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
    script3.crossOrigin = 'anonymous';

    // Add them to the document
    document.body.appendChild(script1);
    document.body.appendChild(script2);
    
    // Wait for the final script to load before resolving
    script3.onload = () => {
      console.log("MediaPipe scripts loaded");
      resolve();
    };
    
    document.body.appendChild(script3);
  });
}
  
/**
 * Set up MediaPipe Hands
 */
function setupMediaPipeHands() {
  // Create video element for the camera feed
  videoElement = document.createElement('video');
  videoElement.id = 'hand-tracking-video';
  videoElement.style.position = 'absolute';
  videoElement.style.right = '20px';
  videoElement.style.bottom = '20px';
  videoElement.style.width = '320px';
  videoElement.style.height = '240px';
  videoElement.style.objectFit = 'cover';
  videoElement.style.border = '2px solid #33ccff';
  videoElement.style.borderRadius = '8px';
  videoElement.style.display = 'none'; // Initially hidden until tracking starts
  videoElement.style.zIndex = '150';
  videoElement.style.transform = 'scaleX(-1)'; // Mirror the video horizontally
  document.body.appendChild(videoElement);

  // Create canvas for visualization of hand landmarks
  const canvasElement = document.createElement('canvas');
  canvasElement.id = 'hand-tracking-canvas';
  canvasElement.width = 320;
  canvasElement.height = 240;
  canvasElement.style.position = 'absolute';
  canvasElement.style.right = '20px';
  canvasElement.style.bottom = '20px';
  canvasElement.style.zIndex = '151'; // Above video
  canvasElement.style.pointerEvents = 'none'; // Don't interfere with clicks
  canvasElement.style.transform = 'scaleX(-1)'; // Mirror the canvas horizontally to match video
  document.body.appendChild(canvasElement);

  // Initialize MediaPipe Hands with optimized settings
  hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  // Configure Hands with improved settings for responsiveness
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1, // Use full complexity for better accuracy
    minDetectionConfidence: handControlsConfig.minDetectionConfidence,
    minTrackingConfidence: handControlsConfig.minTrackingConfidence
  });

  // Set up the camera with higher framerate if supported
  handCamera = new Camera(videoElement, {
    onFrame: async () => {
      if (handControlsConfig.enabled) {
        await hands.send({ image: videoElement });
      }
    },
    width: 320,
    height: 240,
    facingMode: 'user'
  });

  // Set up hand landmark detection with improved processing
  hands.onResults(handleHandResults);

  // Add toggle button to UI
  addHandControlsToggle();
}
  
/**
 * Add toggle button to enable hand controls
 */
function addHandControlsToggle() {
  // Create button to toggle hand controls
  const handControlsButton = document.createElement('button');
  handControlsButton.id = 'hand-controls-button';
  handControlsButton.className = 'button';
  handControlsButton.textContent = '👋';
  handControlsButton.title = 'Hand Controls';
  handControlsButton.style.position = 'absolute';
  handControlsButton.style.left = '25px';
  handControlsButton.style.top = '45px';
  handControlsButton.style.zIndex = '100';
  handControlsButton.style.borderRadius = '50%';
  handControlsButton.style.fontSize = '20px';
  handControlsButton.style.width = '44px';
  handControlsButton.style.height = '44px';
  handControlsButton.style.padding = '0';
  handControlsButton.style.display = 'flex';
  handControlsButton.style.alignItems = 'center';
  handControlsButton.style.justifyContent = 'center';

  // Add to button container
  const buttonContainer = document.getElementById('button-container');
  buttonContainer.appendChild(handControlsButton);

  // Add event listener - simplified to directly toggle tracking
  handControlsButton.addEventListener('click', toggleHandTracking);

  // Add to game UI
  const startScreenControls = document.querySelector('#start-screen .controls-list:not(.mobile-controls .controls-list)');
  if (startScreenControls) {
    const handControlsOption = document.createElement('li');
    handControlsOption.innerHTML = '<strong>👋 Hand Controls:</strong> Enable gesture controls';
    startScreenControls.appendChild(handControlsOption);
  }
}
  
/**
 * Toggle hand tracking on/off
 */
function toggleHandTracking() {
  if (trackingStarted) {
    // Toggle tracking state
    handControlsConfig.enabled = !handControlsConfig.enabled;
    
    // Toggle visibility
    document.getElementById('hand-tracking-video').style.display = 
      handControlsConfig.enabled ? 'block' : 'none';
    document.getElementById('hand-tracking-canvas').style.display = 
      handControlsConfig.enabled ? 'block' : 'none';
    
    return;
  }

  // Start tracking if not already started
  if (handCamera) {
    try {
      handCamera.start()
        .then(() => {
          console.log('Camera started successfully');
          trackingStarted = true;
          handControlsConfig.enabled = true;
          
          // Show video and canvas when tracking is active
          document.getElementById('hand-tracking-video').style.display = 'block';
          document.getElementById('hand-tracking-canvas').style.display = 'block';
        })
        .catch(error => {
          console.error('Error starting camera:', error);
        });
    } catch (error) {
      console.error('Error starting camera:', error);
    }
  } else {
    console.error('Camera not initialized');
  }
}
  
/**
 * Handle hand tracking results from MediaPipe
 * @param {Object} results - The hand tracking results
 */
function handleHandResults(results) {
  // Store previous landmarks for motion detection
  previousHandLandmarks = handLandmarks;
  
  // Update current landmarks
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handLandmarks = results.multiHandLandmarks[0];
    handTrackingActive = true;
    
    // Update visualization
    updateHandVisualization(handLandmarks);
    
    // Process hand movements for game controls
    processHandGestures();
  } else {
    handTrackingActive = false;
    handLandmarks = null;
    
    // Reset fist gesture state when hand is lost
    isMakingFistGesture = false;
    fistGestureStartTime = 0;
    
    // Reset index finger gesture state when hand is lost
    isHoldingIndexFingerGesture = false;
    indexFingerGestureStartTime = 0;
    
    // Hide the notifications
    if (fistNotificationElement) {
      fistNotificationElement.style.display = 'none';
    }
    
    if (indexFingerNotificationElement) {
      indexFingerNotificationElement.style.display = 'none';
    }
    
    // Clear visualization when no hand is detected
    clearHandVisualization();
  }
}

/**
 * Check if the hand is making a fist gesture
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @returns {boolean} - True if the hand is making a fist
 */
function isHandMakingFist(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  
  // Get finger landmark positions
  // Check if all fingers are curled (tips closer to palm than bases)
  
  // Index finger
  const indexTip = landmarks[8];
  const indexBase = landmarks[5];
  
  // Middle finger
  const middleTip = landmarks[12];
  const middleBase = landmarks[9];
  
  // Ring finger
  const ringTip = landmarks[16];
  const ringBase = landmarks[13];
  
  // Pinky (if available in this implementation)
  let pinkyCurled = true;
  if (landmarks.length >= 21) {
    const pinkyTip = landmarks[20];
    const pinkyBase = landmarks[17];
    pinkyCurled = pinkyTip.y > pinkyBase.y;
  }
  
  // Check if fingers are curled (tip is below base in Y coordinate)
  // Y coordinates increase downward in the hand tracking space
  const indexCurled = indexTip.y > indexBase.y;
  const middleCurled = middleTip.y > middleBase.y;
  const ringCurled = ringTip.y > ringBase.y;
  
  // For a fist, most fingers should be curled
  // We require at least 3 fingers to be curled to consider it a fist
  const fingersCurledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;
  
  return fingersCurledCount >= 4;
}

/**
 * Check if only the index finger is extended
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @returns {boolean} - True if only index finger is extended
 */
function isOnlyIndexFingerExtended(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  
  // Get finger landmark positions
  
  // Index finger
  const indexTip = landmarks[8];
  const indexMCP = landmarks[5]; // Metacarpophalangeal joint (base of finger)
  
  // Middle finger
  const middleTip = landmarks[12];
  const middleMCP = landmarks[9];
  
  // Ring finger
  const ringTip = landmarks[16];
  const ringMCP = landmarks[13];
  
  // Pinky
  const pinkyTip = landmarks[20];
  const pinkyMCP = landmarks[17];
  
  // Wrist position for reference
  const wrist = landmarks[0];
  
  // Check if index finger is extended (tip is above MCP in Y coordinate)
  // Y coordinates increase downward in the hand tracking space
  const indexExtended = indexTip.y < indexMCP.y - 0.05; // Add threshold for clearer detection
  
  // Check if other fingers are curled (tip is below MCP in Y coordinate)
  const middleCurled = middleTip.y > middleMCP.y;
  const ringCurled = ringTip.y > ringMCP.y;
  const pinkyCurled = pinkyTip.y > pinkyMCP.y;
  
  // For the gesture we want, only the index should be extended, and all others curled
  return indexExtended && middleCurled && ringCurled && pinkyCurled;
}

/**
 * Update hand visualization on canvas
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 */
function updateHandVisualization(landmarks) {
  const canvas = document.getElementById('hand-tracking-canvas');
  if (!canvas || !handControlsConfig.enabled) return;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!landmarks) return;
  
  // Draw landmarks with brighter colors for better visibility against video
  ctx.strokeStyle = '#33ccff';
  ctx.lineWidth = 1.5;
  
  // Draw palm connections
  const palmIndices = [0, 1, 2, 3, 4, 0, 17, 13, 9, 5, 0];
  drawConnections(ctx, landmarks, palmIndices, canvas.width, canvas.height);
  
  // Draw finger connections
  const fingerConnections = [
    [1, 5, 9, 13, 17], // Palm landmarks
    [5, 6, 7, 8],      // Thumb
    [9, 10, 11, 12],   // Index finger
    [13, 14, 15, 16],  // Middle finger
    [17, 18, 19, 20]   // Ring finger
  ];
  
  for (const connection of fingerConnections) {
    drawConnections(ctx, landmarks, connection, canvas.width, canvas.height);
  }
  
  // Draw landmarks with glow effect
  for (const landmark of landmarks) {
    // Draw glow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(
      landmark.x * canvas.width,
      landmark.y * canvas.height,
      3,
      0,
      2 * Math.PI
    );
    ctx.fill();
    
    // Draw center dot
    ctx.fillStyle = '#ff66ff';
    ctx.beginPath();
    ctx.arc(
      landmark.x * canvas.width,
      landmark.y * canvas.height,
      2,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }
  
  // Highlight key landmarks for better visibility
  // Wrist (landmark 0)
  if (landmarks[0]) {
    ctx.fillStyle = '#00ff99';
    ctx.beginPath();
    ctx.arc(
      landmarks[0].x * canvas.width,
      landmarks[0].y * canvas.height,
      5,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }
  
  // Highlight index finger tip (landmark 8) when the rotation gesture is active
  if (isOnlyIndexFingerExtended(landmarks) && landmarks[8]) {
    ctx.fillStyle = '#00ff00'; // Green for index finger rotation
    ctx.beginPath();
    ctx.arc(
      landmarks[8].x * canvas.width,
      landmarks[8].y * canvas.height,
      6,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }
}
  
/**
 * Draw connections between landmarks
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} landmarks - Hand landmarks
 * @param {Array} indices - Indices of landmarks to connect
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function drawConnections(ctx, landmarks, indices, width, height) {
  ctx.beginPath();
  
  for (let i = 0; i < indices.length - 1; i++) {
    const current = landmarks[indices[i]];
    const next = landmarks[indices[i + 1]];
    
    if (current && next) {
      ctx.moveTo(current.x * width, current.y * height);
      ctx.lineTo(next.x * width, next.y * height);
    }
  }
  
  ctx.stroke();
}
  
/**
 * Clear hand visualization on canvas
 */
function clearHandVisualization() {
  const trackingCanvas = document.getElementById('hand-tracking-canvas');
  if (trackingCanvas) {
    const ctx = trackingCanvas.getContext('2d');
    ctx.clearRect(0, 0, trackingCanvas.width, trackingCanvas.height);
  }
}
  
/**
 * Process hand gestures to control the game
 */
function processHandGestures() {
    if (!handLandmarks || !handTrackingActive || !handControlsConfig.enabled) return;
    
    const currentTime = Date.now();
    
    // Check for fist gesture for hard drop
    const isCurrentlyMakingFist = isHandMakingFist(handLandmarks);
    
    // Check for index finger gesture for rotation
    const isCurrentlyExtendingIndexFinger = isOnlyIndexFingerExtended(handLandmarks);
    
    // Handle fist gesture for hard drop
    if (isCurrentlyMakingFist) {
      if (!isMakingFistGesture) {
        // Start tracking fist hold time
        isMakingFistGesture = true;
        fistGestureStartTime = currentTime;
        
        // Show the fist notification
        if (fistNotificationElement) {
          fistNotificationElement.style.display = 'block';
        }
      } else {
        // Check if fist has been held long enough
        const fistHoldTime = currentTime - fistGestureStartTime;
        
        if (fistHoldTime >= handControlsConfig.fistHoldDuration) {
          // Execute hard drop after hold duration
          if (window.dropPiece && typeof window.dropPiece === 'function') {
            window.dropPiece();
            
            // Reset fist gesture state
            isMakingFistGesture = false;
            fistGestureStartTime = 0;
            
            // Hide the fist notification
            if (fistNotificationElement) {
              fistNotificationElement.style.display = 'none';
            }
            
            // Set cooldown
            lastGestureTime = currentTime;
            return; // Skip other gesture processing
          }
        }
      }
    } else {
      // Reset fist gesture tracking if hand is no longer making a fist
      isMakingFistGesture = false;
      fistGestureStartTime = 0;
      
      // Hide the fist notification
      if (fistNotificationElement) {
        fistNotificationElement.style.display = 'none';
      }
    }
    
    // Handle index finger gesture for rotation
    if (isCurrentlyExtendingIndexFinger) {
      if (!isHoldingIndexFingerGesture) {
        // Start tracking index finger hold time
        isHoldingIndexFingerGesture = true;
        indexFingerGestureStartTime = currentTime;
        
        // Show the index finger notification
        if (indexFingerNotificationElement) {
          indexFingerNotificationElement.style.display = 'block';
        }
      } else {
        // Check if index finger has been held long enough
        const indexFingerHoldTime = currentTime - indexFingerGestureStartTime;
        
        if (indexFingerHoldTime >= handControlsConfig.indexFingerHoldDuration) {
          // Execute rotation after hold duration
          if (window.rotatePiece && typeof window.rotatePiece === 'function') {
            window.rotatePiece();
            
            // Reset index finger gesture state
            isHoldingIndexFingerGesture = false;
            indexFingerGestureStartTime = 0;
            
            // Hide the index finger notification
            if (indexFingerNotificationElement) {
              indexFingerNotificationElement.style.display = 'none';
            }
            
            // Set cooldown
            lastGestureTime = currentTime;
            return; // Skip other gesture processing
          }
        }
      }
    } else {
      // Reset index finger gesture tracking if hand is no longer extending index finger
      isHoldingIndexFingerGesture = false;
      indexFingerGestureStartTime = 0;
      
      // Hide the index finger notification
      if (indexFingerNotificationElement) {
        indexFingerNotificationElement.style.display = 'none';
      }
    }
    
    // Only process movement gestures if we're not in the middle of a gesture
    if (!isMakingFistGesture && !isHoldingIndexFingerGesture) {
      // Use palm (wrist) as the main reference point for movement
      const wrist = handLandmarks[0];
      const previousWrist = previousHandLandmarks ? previousHandLandmarks[0] : null;
      
      if (!wrist || !previousWrist) return;
      
      // Calculate movement
      const dx = wrist.x - previousWrist.x;
      const dy = wrist.y - previousWrist.y;
      
      // Apply sensitivity adjustments
      const effectiveSensitivity = handControlsConfig.baseSensitivity;
      const adjustedThreshold = handControlsConfig.movementThreshold / effectiveSensitivity;
      
      // Apply additional horizontal sensitivity for left-right movements
      const horizontalThreshold = adjustedThreshold / handControlsConfig.horizontalSensitivityMultiplier;
      
      // Add variables to track horizontal movement state
      // Store last horizontal movement time
      if (!window.lastHorizontalMoveTime) {
        window.lastHorizontalMoveTime = 0;
      }
      
      // Cooldown for consecutive horizontal moves (shorter than other movements)
      const horizontalMoveCooldown = 75; // ms
      
      // Horizontal movement (left-right)
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > horizontalThreshold) {
        // Check if enough time has passed since last horizontal move
        const canMoveHorizontally = currentTime - window.lastHorizontalMoveTime >= horizontalMoveCooldown;
        
        // INVERTED: Moving hand right now moves piece left and vice versa
        if (dx > 0) {
          // Hand moves right, piece moves LEFT
          if (!gestureDirection || gestureDirection !== 'right') {
            gestureDirection = 'right';
            gestureStartTime = currentTime;
          } else if (currentTime - gestureStartTime > handControlsConfig.gestureThreshold && canMoveHorizontally) {
            if (window.movePiece && typeof window.movePiece === 'function') {
              window.movePiece(-1, 0); // INVERTED: -1 instead of 1
              window.lastHorizontalMoveTime = currentTime; // Update last move time
            }
          }
        } else {
          // Hand moves left, piece moves RIGHT
          if (!gestureDirection || gestureDirection !== 'left') {
            gestureDirection = 'left';
            gestureStartTime = currentTime;
          } else if (currentTime - gestureStartTime > handControlsConfig.gestureThreshold && canMoveHorizontally) {
            if (window.movePiece && typeof window.movePiece === 'function') {
              window.movePiece(1, 0); // INVERTED: 1 instead of -1
              window.lastHorizontalMoveTime = currentTime; // Update last move time
            }
          }
        }
      } else {
        // Reset gesture if movement is below threshold
        if (Math.abs(dx) < adjustedThreshold * 0.5 && Math.abs(dy) < adjustedThreshold * 0.5) {
          gestureDirection = null;
        }
      }
    }
}

/**
 * Handle visibility change to manage camera resources
 */
function handleHandControlsVisibilityChange() {
  if (document.hidden) {
    // Pause hand controls when tab is hidden
    if (handControlsConfig.enabled) {
      handControlsConfig.enabled = false;
      
      // Hide video and canvas elements
      const videoEl = document.getElementById('hand-tracking-video');
      const canvasEl = document.getElementById('hand-tracking-canvas');
      if (videoEl) videoEl.style.display = 'none';
      if (canvasEl) canvasEl.style.display = 'none';
      
      // Hide the notifications
      if (fistNotificationElement) {
        fistNotificationElement.style.display = 'none';
      }
      
      if (indexFingerNotificationElement) {
        indexFingerNotificationElement.style.display = 'none';
      }
    }
  } else {
    // Resume if it was active before
    if (trackingStarted && !handControlsConfig.enabled) {
      handControlsConfig.enabled = true;
      
      // Show video and canvas elements
      const videoEl = document.getElementById('hand-tracking-video');
      const canvasEl = document.getElementById('hand-tracking-canvas');
      if (videoEl) videoEl.style.display = 'block';
      if (canvasEl) canvasEl.style.display = 'block';
    }
  }
}
  
/**
 * Clean up resources when the game ends
 */
function cleanupHandControls() {
  if (handCamera) {
    handCamera.stop();
  }
  
  if (hands) {
    hands.close();
  }
  
  // Remove video element
  if (videoElement) {
    document.body.removeChild(videoElement);
  }
  
  // Remove tracking canvas
  const trackingCanvas = document.getElementById('hand-tracking-canvas');
  if (trackingCanvas) {
    document.body.removeChild(trackingCanvas);
  }
  
  // Remove the notifications
  if (fistNotificationElement) {
    document.body.removeChild(fistNotificationElement);
  }
  
  if (indexFingerNotificationElement) {
    document.body.removeChild(indexFingerNotificationElement);
  }
  
  // Reset state
  handControlsConfig.enabled = false;
  trackingStarted = false;
  gestureDirection = null;
  isMakingFistGesture = false;
  fistGestureStartTime = 0;
  isHoldingIndexFingerGesture = false;
  indexFingerGestureStartTime = 0;
}

// Listen for game events
document.addEventListener('newPieceSpawned', () => {
  // Reset gesture state for new piece
  gestureDirection = null;
  lastGestureTime = Date.now();
});

// Listen for game pause/resume events
document.addEventListener('gamePaused', () => {
  if (handControlsConfig.enabled) {
    // Pause hand tracking when game is paused
    handControlsConfig.enabled = false;
    
    // Hide video and canvas
    const videoEl = document.getElementById('hand-tracking-video');
    const canvasEl = document.getElementById('hand-tracking-canvas');
    if (videoEl) videoEl.style.display = 'none';
    if (canvasEl) canvasEl.style.display = 'none';
    
    // Hide the notifications
    if (fistNotificationElement) {
      fistNotificationElement.style.display = 'none';
    }
    
    if (indexFingerNotificationElement) {
      indexFingerNotificationElement.style.display = 'none';
    }
  }
});

document.addEventListener('gameResumed', () => {
  if (trackingStarted) {
    // Resume hand tracking when game resumes
    handControlsConfig.enabled = true;
    
    // Show video and canvas
    const videoEl = document.getElementById('hand-tracking-video');
    const canvasEl = document.getElementById('hand-tracking-canvas');
    if (videoEl) videoEl.style.display = 'block';
    if (canvasEl) canvasEl.style.display = 'block';
  }
});

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Add visibility change handler
  document.addEventListener('visibilitychange', handleHandControlsVisibilityChange);
});

// Export functions if needed
window.initHandControls = initHandControls;
window.cleanupHandControls = cleanupHandControls;