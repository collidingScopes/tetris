/**
 * deviceUtils.js
 * Provides centralized device detection utilities for the game
 */

const deviceUtils = {
  /**
   * Detects if the current device is a mobile device
   * @returns {boolean} True if the device is a mobile device
   */
  isMobile: function() {
    // Primary check is for touch capability
    const hasTouchCapability = 'ontouchstart' in window || 
                              navigator.maxTouchPoints > 0 || 
                              navigator.msMaxTouchPoints > 0;
    
    // Secondary check is for screen size and common mobile user agents
    const isMobileSize = window.innerWidth <= 768;
    const isMobileAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    return hasTouchCapability && (isMobileSize || isMobileAgent);
  },
  
  /**
   * Detects if the current device is a low-performance device
   * @returns {boolean} True if the device is a low-performance device
   */
  isLowPerformanceDevice: function() {
    // Check for indicators of a low-performance device
    const isOlderDevice = 
      /Android [1-5]/.test(navigator.userAgent) || // Older Android
      /(iPhone|iPad).*OS [5-9]_|OS 10_/.test(navigator.userAgent); // Older iOS
    
    // Use deviceMemory API if available (Chrome only)
    const hasLowMemory = 
      window.navigator.deviceMemory !== undefined && 
      window.navigator.deviceMemory < 4;
    
    // Check for older browsers or known low-performance markers
    const isLowPerformanceBrowser = 
      !window.requestAnimationFrame || 
      !window.performance ||
      navigator.hardwareConcurrency <= 2;
    
    return isOlderDevice || hasLowMemory || isLowPerformanceBrowser;
  },
  
  /**
   * Detects if the device supports haptic feedback (vibration)
   * @returns {boolean} True if the device supports vibration
   */
  supportsVibration: function() {
    return 'vibrate' in navigator;
  }
};