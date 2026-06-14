/* ==========================================================================
   RETRO DFD VISUALIZER - SOUND SYNTHESIS ENGINE (WEB AUDIO API)
   ========================================================================== */

const SoundManager = (() => {
    let audioCtx = null;
    let isEnabled = true;
    let dragHumOsc = null;
    let dragHumGain = null;

    // Initialize audio context lazily on user gesture
    function init() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function toggle(state) {
        if (state !== undefined) {
            isEnabled = state;
        } else {
            isEnabled = !isEnabled;
        }
        return isEnabled;
    }

    // Play a standard retro click (sine wave, short decay)
    function playClick() {
        if (!isEnabled) return;
        init();
        
        try {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, audioCtx.currentTime); // High pitch click
            
            gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
            
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.06);
        } catch (e) {
            console.warn("Audio error:", e);
        }
    }

    // Play a keystroke tap (higher frequency, shorter decay)
    function playTap() {
        if (!isEnabled) return;
        init();
        
        try {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1800, audioCtx.currentTime);
            
            gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.02);
            
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.03);
        } catch (e) {}
    }

    // Play success chime (ascending double beep)
    function playSuccess() {
        if (!isEnabled) return;
        init();

        try {
            const now = audioCtx.currentTime;
            
            // First note (C5)
            playTone(523.25, 0.08, now);
            // Second note (G5)
            playTone(783.99, 0.12, now + 0.08);
        } catch (e) {}
    }

    // Play error buzz (low saw wave)
    function playError() {
        if (!isEnabled) return;
        init();

        try {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(130, audioCtx.currentTime);
            
            gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
            
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.26);
        } catch (e) {}
    }

    // Play delete slide (decreasing frequency)
    function playDelete() {
        if (!isEnabled) return;
        init();

        try {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.21);
            
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.22);
        } catch (e) {}
    }

    // Start a dragging hum (modulated frequency)
    function startDragHum() {
        if (!isEnabled) return;
        init();

        try {
            if (dragHumOsc) stopDragHum();

            dragHumOsc = audioCtx.createOscillator();
            dragHumGain = audioCtx.createGain();
            
            dragHumOsc.connect(dragHumGain);
            dragHumGain.connect(audioCtx.destination);
            
            dragHumOsc.type = 'triangle';
            dragHumOsc.frequency.setValueAtTime(120, audioCtx.currentTime);
            
            dragHumGain.gain.setValueAtTime(0.06, audioCtx.currentTime);
            
            dragHumOsc.start(audioCtx.currentTime);
        } catch (e) {}
    }

    // Update drag hum frequency based on drag offset/speed
    function updateDragHum(speed) {
        if (!isEnabled || !dragHumOsc) return;
        
        try {
            // Clamp speed and convert to frequency offset
            const targetFreq = 100 + Math.min(speed * 2.5, 300);
            dragHumOsc.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.05);
        } catch (e) {}
    }

    // Stop dragging hum
    function stopDragHum() {
        if (dragHumOsc) {
            try {
                const now = audioCtx.currentTime;
                dragHumGain.gain.setValueAtTime(dragHumGain.gain.value, now);
                dragHumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                
                const tempOsc = dragHumOsc;
                setTimeout(() => {
                    try { tempOsc.stop(); } catch (e) {}
                }, 100);
            } catch (e) {}
            
            dragHumOsc = null;
            dragHumGain = null;
        }
    }

    // Private helper to play a clean single tone
    function playTone(freq, duration, startTime) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(0.06, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration + 0.01);
    }

    return {
        init,
        toggle,
        playClick,
        playTap,
        playSuccess,
        playError,
        playDelete,
        startDragHum,
        updateDragHum,
        stopDragHum,
        getEnabled: () => isEnabled
    };
})();
