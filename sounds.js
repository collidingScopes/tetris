// Audio variables
let backgroundMusic;
let moveSound, rotateSound, dropSound, clearLineSound, gameOverSound;
let isMuted = false;

function initAudio() {
  // Create audio variables but don't start anything yet
  let audioInitialized = false;
  
  // Setup function that will run after user interaction
  const setupAudio = () => {
      if (audioInitialized) return;
      
      // Create a soft synth for background music
      const synth = new Tone.PolySynth(Tone.Synth).toDestination();
      synth.volume.value = -10; // Lower volume
      
      // Create a sequence for peaceful, ambient music
      const notes = ["G3", "B3", "D4", "G4", "B3", "D4", "G3", "A3", "C4", "E4", "A3", "C4"];
      
      /*
      backgroundMusic = new Tone.Sequence((time, note) => {
          synth.triggerAttackRelease(note, "4n", time);
      }, notes, "4n").start(0);
      */

      // Set up Tone.js transport
      Tone.Transport.bpm.value = 90;
      
      // Create sound effects using simple synths
      const fxSynth = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 }
      }).toDestination();
      fxSynth.volume.value = -15;
      
      // Move sound - gentle click
      moveSound = () => {
          if (!isMuted) fxSynth.triggerAttackRelease("C5", "32n");
      };
      
      // Rotate sound - upward sweep
      rotateSound = () => {
          if (!isMuted) {
              const now = Tone.now();
              fxSynth.triggerAttackRelease("G4", "16n", now);
              fxSynth.triggerAttackRelease("B4", "16n", now + 0.05);
          }
      };
      
      // Drop sound - downward sweep
      dropSound = () => {
          if (!isMuted) {
              const now = Tone.now();
              fxSynth.triggerAttackRelease("E5", "16n", now);
              fxSynth.triggerAttackRelease("A4", "16n", now + 0.05);
              fxSynth.triggerAttackRelease("E4", "16n", now + 0.1);
          }
      };
      
      // Line clear sound - pleasant chord
      const clearSynth = new Tone.PolySynth(Tone.Synth).toDestination();
      clearSynth.volume.value = -8;
      
      clearLineSound = (lines) => {
          if (!isMuted) {
              const now = Tone.now();
              // Different chords based on number of lines cleared
              if (lines === 1) {
                  clearSynth.triggerAttackRelease(["C4", "E4", "G4"], "8n", now);
              } else if (lines === 2) {
                  clearSynth.triggerAttackRelease(["D4", "F#4", "A4"], "8n", now);
              } else if (lines === 3) {
                  clearSynth.triggerAttackRelease(["E4", "G#4", "B4"], "8n", now);
              } else if (lines === 4) {
                  clearSynth.triggerAttackRelease(["F4", "A4", "C5", "E5"], "8n", now);
                  clearSynth.triggerAttackRelease(["G4", "B4", "D5", "F5"], "8n", now + 0.2);
              }
          }
      };
      
      // Game over sound - gentle descending pattern
      gameOverSound = () => {
          if (!isMuted) {
              const now = Tone.now();
              clearSynth.triggerAttackRelease(["G4", "B4", "D5"], "8n", now);
              clearSynth.triggerAttackRelease(["F4", "A4", "C5"], "8n", now + 0.3);
              clearSynth.triggerAttackRelease(["E4", "G4", "B4"], "8n", now + 0.6);
              clearSynth.triggerAttackRelease(["D4", "F4", "A4"], "8n", now + 0.9);
          }
      };
      
      // Mark as initialized so we don't set up twice
      audioInitialized = true;
      
      // Start transport if not muted
      if (!isMuted) {
          Tone.Transport.start();
      }
  };
  
  // Toggle mute button
  document.getElementById('mute-button').addEventListener('click', () => {
      // This click will also initialize audio if it hasn't been already
      if (!audioInitialized) {
          Tone.start().then(setupAudio);
      }
      
      isMuted = !isMuted;
      if (isMuted) {
          Tone.Transport.pause();
          document.getElementById('mute-button').textContent = '🔇';
      } else {
          Tone.Transport.start();
          document.getElementById('mute-button').textContent = '🔊';
      }
  });
  
  // Initialize audio on game start (user interaction)
  document.getElementById('start-button').addEventListener('click', () => {
      // This is a user gesture, so we can start audio now
      if (!audioInitialized) {
          Tone.start().then(setupAudio);
      }
  });
  
  // Default empty functions until audio is initialized
  if (typeof moveSound === 'undefined') {
    moveSound = () => {};
  }
  if (typeof rotateSound === 'undefined') {
    rotateSound = () => {};
  }
  if (typeof dropSound === 'undefined') {
    dropSound = () => {};
  }
  if (typeof clearLineSound === 'undefined') {
    clearLineSound = () => {};
  }
  if (typeof gameOverSound === 'undefined') {
    gameOverSound = () => {};
  }
}