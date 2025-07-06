import { state, beatDetection, elements, setAudioContext, setAnalyser, setSource, setDataArray, setBufferLength, setCanvas, setCtx, setAnimationId, setVisualizationInitialized, audioContext, analyser, source, dataArray, bufferLength, canvas, ctx, animationId, isVisualizationInitialized } from './state.js';
import { debounce, utils } from './utils.js';

// Beat effects
export const beatEffects = {
    updateBeatDetection(bassAvg, midAvg, trebleAvg, totalEnergy) {
        const now = Date.now();
        if (!state.isHomepageVisible) return;
        
        const { history, thresholds, lastTrigger } = beatDetection;
        
        history.bass.shift(); history.bass.push(bassAvg);
        history.mid.shift(); history.mid.push(midAvg);
        history.treble.shift(); history.treble.push(trebleAvg);
        history.energy.shift(); history.energy.push(totalEnergy);
        
        const avgs = {
            bass: history.bass.reduce((a, b) => a + b) / history.bass.length,
            mid: history.mid.reduce((a, b) => a + b) / history.mid.length,
            treble: history.treble.reduce((a, b) => a + b) / history.treble.length,
            energy: history.energy.reduce((a, b) => a + b) / history.energy.length
        };
        
        const variances = {
            bass: utils.calculateVariance(history.bass, avgs.bass),
            mid: utils.calculateVariance(history.mid, avgs.mid),
            treble: utils.calculateVariance(history.treble, avgs.treble)
        };
        
        beatDetection.adaptiveSensitivity = Math.max(0.5, Math.min(2.0, totalEnergy / Math.max(avgs.energy, 1)));
        
        thresholds.bass = avgs.bass + (variances.bass * 1.2 * beatDetection.adaptiveSensitivity);
        thresholds.mid = avgs.mid + (variances.mid * 1.1 * beatDetection.adaptiveSensitivity);
        thresholds.treble = avgs.treble + (variances.treble * 1.0 * beatDetection.adaptiveSensitivity);
        
        if (bassAvg > thresholds.bass && now - lastTrigger.kick > 200 && bassAvg > avgs.bass * 1.4) {
            this.triggerKickEffect(bassAvg, avgs.bass);
            lastTrigger.kick = now;
        }
        
        if (midAvg > thresholds.mid && now - lastTrigger.snare > 150 && midAvg > avgs.mid * 1.3 && bassAvg < avgs.bass * 1.2) {
            this.triggerSnareEffect(midAvg, avgs.mid);
            lastTrigger.snare = now;
        }
        
        if (trebleAvg > thresholds.treble && now - lastTrigger.hihat > 80 && trebleAvg > avgs.treble * 1.2) {
            this.triggerHiHatEffect(trebleAvg, avgs.treble);
            lastTrigger.hihat = now;
        }
    },

    triggerKickEffect(currentLevel, avgLevel) {
        const intensity = Math.min((currentLevel / avgLevel - 1), 1);
        const palette = state.currentSongData.palette;
        
        window.kickGlow = {
            intensity,
            timestamp: Date.now(),
            color: palette.mid.map((c, i) => Math.floor((c + palette.high[i]) / 2))
        };
        
        if (!state.lyrics.loaded || !state.isPlaying) {
            const titleIntensity = Math.min(intensity * 1.2, 1);
            elements.bandTitle.style.transform = `scale(${1 + titleIntensity * 0.02})`;
            elements.bandTitle.style.textShadow = `
                0 0 ${40 + titleIntensity * 30}px rgba(255, 255, 255, ${titleIntensity * 0.6}), 
                0 0 ${20 + titleIntensity * 15}px rgba(255, 255, 255, ${titleIntensity * 0.4})
            `;
            
            setTimeout(() => {
                elements.bandTitle.style.transform = 'scale(1)';
                elements.bandTitle.style.textShadow = '0 0 40px rgba(255, 255, 255, 0.25)';
            }, 400);
        }
    },

    triggerSnareEffect(currentLevel, avgLevel) {
        const intensity = Math.min((currentLevel / avgLevel - 1), 1);
        window.snareFlash = { intensity, timestamp: Date.now(), color: state.currentSongData.palette.high };
        
        // Check if lyrics manager is available and has display
        if (state.lyrics.loaded && state.isPlaying && window.lyricsManagerDisplay && window.lyricsManagerDisplay.text.textContent) {
            const originalTransform = window.lyricsManagerDisplay.text.style.transform;
            window.lyricsManagerDisplay.text.style.transform = `${originalTransform} scale(${1 + intensity * 0.03})`;
            setTimeout(() => { window.lyricsManagerDisplay.text.style.transform = originalTransform; }, 150);
        }
    },

    triggerHiHatEffect(currentLevel, avgLevel) {
        const intensity = Math.min((currentLevel / avgLevel - 1), 1);
        if (intensity > 0.3) {
            elements.beatPulse.classList.add('active');
            setTimeout(() => elements.beatPulse.classList.remove('active'), 250);
        }
    }
};

// Mobile detection for real devices (not just screen size)
const isMobileDevice = () => {
    return state.isMobile && (
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        ('ontouchstart' in window && navigator.maxTouchPoints > 0)
    );
};

// Responsive scaling helper with mobile performance considerations
const getVisualizationScale = () => {
    const screenWidth = window.innerWidth;
    if (screenWidth <= 480) {
        return 0.4; // Extra small mobile
    } else if (screenWidth <= 768) {
        return 0.6; // Mobile
    } else if (screenWidth <= 1024) {
        return 0.8; // Tablet
    }
    return 1.0; // Desktop
};

// Mobile performance settings
const getMobilePerformanceSettings = () => {
    if (!isMobileDevice()) {
        return {
            skipFrames: 0, // No frame skipping on desktop
            maxBars: bufferLength, // Full spectrum
            enableShadows: true,
            enableGradients: true,
            complexEffects: true
        };
    }
    
    // Mobile optimizations
    return {
        skipFrames: 1, // Skip every other frame (30fps instead of 60fps)
        maxBars: Math.min(bufferLength / 3, 128), // Reduce bars by 66%
        enableShadows: false, // Disable shadows on mobile
        enableGradients: false, // Simplify gradients
        complexEffects: false // Disable complex effects
    };
};

// Visualization
export const visualization = {
    frameSkipCounter: 0,
    
    init() {
        setCanvas(document.getElementById('visualizerCanvas'));
        setCtx(canvas.getContext('2d'));
        
        // Mobile performance optimization for canvas
        if (isMobileDevice()) {
            console.log('🔧 Applying mobile performance optimizations to audio visualization');
            canvas.style.willChange = 'transform'; // GPU acceleration hint
            ctx.imageSmoothingEnabled = false; // Disable anti-aliasing on mobile
        }
        
        const resizeCanvas = debounce(() => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }, 250);
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        setAudioContext(new (window.AudioContext || window.webkitAudioContext)());
        setAnalyser(audioContext.createAnalyser());
        
        setSource(audioContext.createMediaElementSource(elements.audio));
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        // Mobile-specific audio analysis settings
        if (isMobileDevice()) {
            analyser.fftSize = 1024; // Smaller FFT size for mobile (instead of 2048)
            analyser.smoothingTimeConstant = 0.9; // More smoothing on mobile
        } else {
            analyser.fftSize = 2048; // Full quality for desktop
            analyser.smoothingTimeConstant = 0.8;
        }
        
        setBufferLength(analyser.frequencyBinCount);
        setDataArray(new Uint8Array(bufferLength));
        
        // Initialize beat detection
        beatDetection.history.bass = new Array(20).fill(0);
        beatDetection.history.mid = new Array(15).fill(0);
        beatDetection.history.treble = new Array(10).fill(0);
        beatDetection.history.energy = new Array(30).fill(0);
        
        setVisualizationInitialized(true);
        this.visualize();
    },

    visualize() {
        if (!state.isHomepageVisible) {
            setAnimationId(requestAnimationFrame(() => this.visualize()));
            return;
        }
        
        setAnimationId(requestAnimationFrame(() => this.visualize()));
        
        const perfSettings = getMobilePerformanceSettings();
        
        // Frame skipping for mobile performance
        if (perfSettings.skipFrames > 0) {
            this.frameSkipCounter++;
            if (this.frameSkipCounter <= perfSettings.skipFrames) {
                return; // Skip this frame
            }
            this.frameSkipCounter = 0; // Reset counter
        }
        
        analyser.getByteFrequencyData(dataArray);
        
        if (state.isPlaying && window.lyricsManagerUpdate) {
            window.lyricsManagerUpdate();
        }
        
        // Simplified clearing for mobile
        if (isMobileDevice()) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; // Faster clearing on mobile
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'; // Original desktop clearing
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        const total = dataArray.reduce((sum, val) => sum + val, 0);
        const average = total / bufferLength;
        const bassAverage = dataArray.slice(0, bufferLength / 8).reduce((a, b) => a + b) / (bufferLength / 8);
        const midAverage = dataArray.slice(bufferLength / 8, bufferLength / 2).reduce((a, b) => a + b) / (bufferLength * 3 / 8);
        const trebleAverage = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b) / (bufferLength / 2);
        
        if (state.isPlaying) {
            beatEffects.updateBeatDetection(bassAverage, midAverage, trebleAverage, average);
            if (perfSettings.complexEffects) {
                this.drawBackground(centerX, centerY, average);
            }
        }
        
        this.drawSpectrum(centerX, centerY, perfSettings);
        this.drawBassCircle(centerX, centerY, bassAverage, perfSettings);
    },

    drawBackground(centerX, centerY, average) {
        const pulseIntensity = average / 255;
        const palette = state.currentSongData.palette;
        const bgColor = palette.mid.map((c, i) => (c + palette.high[i]) / 2);
        const scale = getVisualizationScale();
        
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(canvas.width, canvas.height) * scale);
        gradient.addColorStop(0, `rgba(${bgColor.join(', ')}, ${pulseIntensity * 0.02})`);
        gradient.addColorStop(0.5, `rgba(${bgColor.join(', ')}, ${pulseIntensity * 0.01})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    },

    drawSpectrum(centerX, centerY, perfSettings) {
        const scale = getVisualizationScale();
        const radius = 245 * scale; // Responsive radius
        const maxBars = perfSettings.maxBars;
        const step = Math.floor(bufferLength / maxBars); // Skip bars on mobile
        
        for (let i = 0; i < bufferLength; i += step) {
            const barHeight = (dataArray[i] / 255) * 200 * scale; // Responsive bar height
            const angle = (i / bufferLength) * 2 * Math.PI - Math.PI / 2;
            const intensity = dataArray[i] / 255;
            
            const x1 = centerX + Math.cos(angle * 4) * radius;
            const y1 = centerY + Math.sin(angle * 4) * radius;
            const x2 = centerX + Math.cos(angle * 4) * (radius + barHeight * 0.75);
            const y2 = centerY + Math.sin(angle * 4) * (radius + barHeight * 0.75);
            
            if (i < bufferLength / 4) {
                const palette = state.currentSongData.palette;
                const tintStrength = 0.1;
                const color = palette.mid.map(c => 255 - (255 - c) * tintStrength);
                ctx.strokeStyle = `rgba(${color.join(', ')}, ${intensity * 0.8})`;
                ctx.lineWidth = 0.5 * scale; // Responsive line width
            } else if (i < bufferLength / 2) {
                const color = state.currentSongData.palette.mid;
                
                if (perfSettings.enableGradients) {
                    // Full gradient for desktop
                    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                    gradient.addColorStop(0, `rgba(${color.join(', ')}, ${intensity * 0.5})`);
                    gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                    ctx.strokeStyle = gradient;
                } else {
                    // Simplified color for mobile
                    ctx.strokeStyle = `rgba(${color.join(', ')}, ${intensity * 0.5})`;
                }
                
                if (perfSettings.enableShadows) {
                    ctx.shadowColor = `rgba(${color.join(', ')}, 0.4)`;
                    ctx.shadowBlur = intensity * 6 * scale; // Responsive shadow blur
                }
                ctx.lineWidth = (2 + intensity * 4) * scale; // Responsive line width
            } else {
                const color = state.currentSongData.palette.high;
                
                if (perfSettings.enableGradients) {
                    // Full gradient for desktop
                    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                    gradient.addColorStop(0, `rgba(${color.join(', ')}, ${intensity * 0.5})`);
                    gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                    ctx.strokeStyle = gradient;
                } else {
                    // Simplified color for mobile
                    ctx.strokeStyle = `rgba(${color.join(', ')}, ${intensity * 0.5})`;
                }
                
                if (perfSettings.enableShadows) {
                    ctx.shadowColor = `rgba(${color.join(', ')}, 0.5)`;
                    ctx.shadowBlur = intensity * 8 * scale; // Responsive shadow blur
                }
                ctx.lineWidth = (1 + intensity * 5) * scale; // Responsive line width
            }
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            
            if (perfSettings.enableShadows) {
                ctx.shadowBlur = 0; // Reset shadow
            }
        }
    },

    drawBassCircle(centerX, centerY, bassAverage, perfSettings) {
        if (bassAverage <= 80) return;
        
        const now = Date.now();
        const scale = getVisualizationScale();
        const intensity = Math.min(bassAverage / 255, 1);
        const palette = state.currentSongData.palette;
        let bassColor = palette.mid.map((c, i) => Math.floor((c + palette.high[i]) / 2));
        
        let strokeOpacity = intensity * 0.4;
        let shadowBlur = perfSettings.enableShadows ? intensity * 20 * scale : 0;
        let lineWidth = 3 * scale; // Responsive line width
        
        if (window.kickGlow && (now - window.kickGlow.timestamp) < 400 && perfSettings.complexEffects) {
            const kickFade = 1 - ((now - window.kickGlow.timestamp) / 400);
            const kickIntensity = window.kickGlow.intensity * kickFade;
            
            bassColor = bassColor.map(c => Math.min(255, c + (255 - c) * kickIntensity * 0.8));
            strokeOpacity = Math.min(1, strokeOpacity + kickIntensity * 0.6);
            shadowBlur = shadowBlur + (perfSettings.enableShadows ? kickIntensity * 40 * scale : 0);
            lineWidth = lineWidth + kickIntensity * 6 * scale;
        }
        
        if (window.snareFlash && (now - window.snareFlash.timestamp) < 150 && perfSettings.complexEffects) {
            const snareFade = 1 - ((now - window.snareFlash.timestamp) / 150);
            const snareIntensity = window.snareFlash.intensity * snareFade;
            
            if (perfSettings.enableGradients) {
                const flashGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 450 * scale);
                const color = window.snareFlash.color;
                flashGradient.addColorStop(0, `rgba(${color.join(', ')}, ${snareIntensity * 0.1})`);
                flashGradient.addColorStop(0.5, `rgba(${color.join(', ')}, ${snareIntensity * 0.05})`);
                flashGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = flashGradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, 450 * scale, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
        
        ctx.strokeStyle = `rgba(${bassColor.join(', ')}, ${strokeOpacity})`;
        ctx.lineWidth = lineWidth;
        
        if (perfSettings.enableShadows) {
            ctx.shadowColor = `rgba(${bassColor.join(', ')}, 0.8)`;
            ctx.shadowBlur = shadowBlur;
        }
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, bassAverage * 1.2 * scale, 0, 2 * Math.PI); // Responsive bass circle
        ctx.stroke();
        
        if (perfSettings.enableShadows) {
            ctx.shadowBlur = 0;
        }
        
        if (bassAverage > 100 && now - (window.lastBassKick || 0) > 300) {
            window.lastBassKick = now;
            elements.beatPulse.classList.add('active');
            setTimeout(() => elements.beatPulse.classList.remove('active'), 800);
        }
    }
};