// Your MP3 files - replace these paths with your actual file locations
const songs = [
    { title: "ESTATE", url: "./Songs/Estate.mp3" },
    { title: "LIVIDI", url: "./Songs/Lividi.mp3" },
    { title: "PIOMBO", url: "./Songs/Piombo.mp3" },
    { title: "DENTI", url: "./Songs/Denti.mp3" },
    { title: "Track E", url: "./Songs/e.mp3" }
];

let currentSongIndex = 0;
let isPlaying = false;
let lastBassKick = 0;
let particles = [];

// Advanced beat detection variables
let beatDetection = {
    bassHistory: [],
    midHistory: [],
    trebleHistory: [],
    bassThreshold: 0,
    midThreshold: 0,
    trebleThreshold: 0,
    lastKick: 0,
    lastSnare: 0,
    lastHiHat: 0,
    adaptiveSensitivity: 1.0,
    energyBuffer: []
};

// Lyrics system
let currentLyrics = [];
let currentLyricIndex = 0;
let lyricsLoaded = false;

const audio = document.getElementById('audioPlayer');
const bandTitle = document.getElementById('bandTitle');
const songInfo = document.getElementById('songInfo');
const songTitleEl = document.getElementById('songTitle');
const beatPulse = document.getElementById('beatPulse');

// Audio Visualizer Setup
let audioContext;
let analyser;
let source;
let dataArray;
let bufferLength;
let canvas;
let ctx;
let animationId;

// Dynamic color system
let colorPhase = 0;
let colorSpeed = 0.003;
let energyHistory = [];
let currentPalette = 0;

// Color palettes for different moods/songs
const colorPalettes = [
    // Cyberpunk
    { mid: [255, 0, 150], high: [0, 255, 255], name: 'cyberpunk' },
    // Sunset
    { mid: [255, 100, 0], high: [255, 200, 50], name: 'sunset' },
    // Ocean
    { mid: [0, 150, 255], high: [100, 255, 200], name: 'ocean' },
    // Forest
    { mid: [50, 255, 100], high: [150, 255, 50], name: 'forest' },
    // Fire
    { mid: [255, 50, 0], high: [255, 255, 0], name: 'fire' },
    // Purple Dream
    { mid: [150, 50, 255], high: [255, 100, 200], name: 'dream' },
    // Ice
    { mid: [100, 200, 255], high: [200, 255, 255], name: 'ice' }
];

// Create lyrics display element
function createLyricsDisplay() {
    const lyricsContainer = document.createElement('div');
    lyricsContainer.id = 'lyricsContainer';
    lyricsContainer.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 15;
        text-align: center;
        opacity: 0;
        transition: opacity 0.8s ease;
        pointer-events: none;
        max-width: 80vw;
    `;
    
    const lyricsText = document.createElement('div');
    lyricsText.id = 'lyricsText';
    lyricsText.style.cssText = `
        font-size: clamp(1rem, 2vw, 2.2rem);
        font-weight: 300;
        color: #fff;
        letter-spacing: 0.15em;
        line-height: 1.4;
        text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
        font-family: 'Inter', sans-serif;
        white-space: nowrap;
        filter: blur(0px);
        transition: all 0.6s ease;
        text-transform: uppercase;
        opacity: 0.9;
        text-align: center;
        overflow: visible;
    `;
    
    lyricsContainer.appendChild(lyricsText);
    document.querySelector('.container').appendChild(lyricsContainer);
    
    return { container: lyricsContainer, text: lyricsText };
}

// Initialize lyrics display
const lyricsDisplay = createLyricsDisplay();

// Apply styling based on lyric mode
function applyLyricStyling(element, styleMode, palette) {
    // Reset any existing animations
    element.style.animation = 'none';
    
    if (styleMode === 'enhance') {
        element.style.fontSize = 'clamp(1rem, 2vw, 2.2rem)';
        element.style.fontWeight = '300';
        element.style.letterSpacing = '0.15em';
        element.style.transform = 'scale(1)';
        const enhanceGlow = `rgba(${palette.high[0]}, ${palette.high[1]}, ${palette.high[2]}, 0.5)`;
        element.style.textShadow = `0 0 30px ${enhanceGlow}, 0 0 15px rgba(255, 255, 255, 0.6)`;
        element.style.transition = 'all 0.3s ease';
        element.style.animation = 'subtleGlow 1.2s ease-in-out infinite';
    } else if (styleMode === 'aggressive') {
        element.style.fontSize = 'clamp(1rem, 2vw, 2.2rem)';
        element.style.fontWeight = '500';
        element.style.letterSpacing = '0.15em';
        element.style.transform = 'scale(1)';
        const aggressiveGlow = `rgba(${palette.high[0]}, ${palette.high[1]}, ${palette.high[2]}, 0.7)`;
        element.style.textShadow = `
            2px 0 0 rgba(255, 0, 0, 0.5),
            -2px 0 0 rgba(0, 255, 255, 0.5),
            0 0 30px ${aggressiveGlow},
            0 0 15px rgba(255, 255, 255, 0.8)
        `;
        element.style.transition = 'all 0.2s ease';
        element.style.animation = 'glitchEffect 1s ease-in-out infinite';
    } else {
        element.style.fontSize = 'clamp(1rem, 2vw, 2.2rem)';
        element.style.fontWeight = '300';
        element.style.letterSpacing = '0.15em';
        element.style.transform = 'scale(1)';
        element.style.textShadow = '0 0 20px rgba(255, 255, 255, 0.3)';
        element.style.transition = 'all 0.6s ease';
    }
}

// Parse LRC format lyrics with regions and caps detection
function parseLyrics(lrcContent) {
    const lines = lrcContent.split('\n');
    const lyrics = [];
    let currentRegion = 'normal';
    
    lines.forEach(line => {
        if (line.trim().startsWith('#enhance')) {
            currentRegion = 'enhance';
            return;
        }
        if (line.trim().startsWith('#endenhance')) {
            currentRegion = 'normal';
            return;
        }
        
        const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2}))?\](.*)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const centiseconds = match[3] ? parseInt(match[3]) : 0;
            const text = match[4].trim();
            
            const timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
            
            let styleMode = currentRegion;
            
            if (text && /[A-Z]/.test(text) && text === text.toUpperCase() && text !== text.toLowerCase()) {
                styleMode = 'aggressive';
            }
            
            lyrics.push({
                time: timeInSeconds,
                text: text,
                style: styleMode
            });
        }
    });
    
    return lyrics.sort((a, b) => a.time - b.time);
}

// Load lyrics for current song
async function loadLyrics() {
    const currentSong = songs[currentSongIndex];
    const songName = currentSong.title;
    const lyricsPath = `./Songs/${songName}.txt`;
    const altLyricsPath = `./Songs/${songName.charAt(0).toUpperCase() + songName.slice(1).toLowerCase()}.txt`;
    
    try {
        let response = await fetch(lyricsPath);
        let finalPath = lyricsPath;
        
        if (!response.ok) {
            response = await fetch(altLyricsPath);
            finalPath = altLyricsPath;
        }
        
        if (response.ok) {
            const lrcContent = await response.text();
            currentLyrics = parseLyrics(lrcContent);
            lyricsLoaded = currentLyrics.length > 0;
            currentLyricIndex = 0;
            console.log(`Loaded ${currentLyrics.length} lyrics for ${songName} from ${finalPath}`);
        } else {
            console.log(`No lyrics file found for ${songName}`);
            currentLyrics = [];
            lyricsLoaded = false;
        }
    } catch (error) {
        console.log(`Error loading lyrics for ${songName}:`, error);
        currentLyrics = [];
        lyricsLoaded = false;
    }
}

// Update lyrics display based on current time
function updateLyrics() {
    if (!lyricsLoaded || !isPlaying || currentLyrics.length === 0) {
        return;
    }
    
    const currentTime = audio.currentTime;
    
    let newLyricIndex = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentTime >= currentLyrics[i].time) {
            newLyricIndex = i;
        } else {
            break;
        }
    }
    
    if (newLyricIndex !== currentLyricIndex && newLyricIndex >= 0) {
        currentLyricIndex = newLyricIndex;
        const currentLyric = currentLyrics[currentLyricIndex];
        
        if (!currentLyric.text || currentLyric.text.trim() === '') {
            lyricsDisplay.text.style.opacity = '0';
            lyricsDisplay.text.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                lyricsDisplay.text.textContent = '';
                lyricsDisplay.text.style.opacity = '1';
                lyricsDisplay.text.style.transform = 'translateY(0)';
            }, 300);
        } else {
            lyricsDisplay.text.style.opacity = '0';
            lyricsDisplay.text.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                lyricsDisplay.text.textContent = currentLyric.text;
                lyricsDisplay.text.style.opacity = '1';
                lyricsDisplay.text.style.transform = 'translateY(0)';
                
                const palette = colorPalettes[currentPalette];
                applyLyricStyling(lyricsDisplay.text, currentLyric.style, palette);
                
            }, 300);
        }
    }
}

// Show/hide lyrics and title
function showLyrics() {
    if (lyricsLoaded) {
        bandTitle.style.opacity = '0';
        bandTitle.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            lyricsDisplay.container.style.opacity = '1';
        }, 400);
    }
}

function hideLyrics() {
    lyricsDisplay.container.style.opacity = '0';
    
    setTimeout(() => {
        bandTitle.style.opacity = '0.95';
        bandTitle.style.transform = 'scale(1)';
    }, 400);
    
    setTimeout(() => {
        lyricsDisplay.text.textContent = '';
        currentLyricIndex = -1;
    }, 800);
}

// Advanced beat detection functions
function initializeBeatDetection() {
    beatDetection.bassHistory = new Array(20).fill(0);
    beatDetection.midHistory = new Array(15).fill(0);
    beatDetection.trebleHistory = new Array(10).fill(0);
    beatDetection.energyBuffer = new Array(30).fill(0);
}

function updateBeatDetection(bassAvg, midAvg, trebleAvg, totalEnergy) {
    const now = Date.now();
    
    beatDetection.bassHistory.shift();
    beatDetection.bassHistory.push(bassAvg);
    beatDetection.midHistory.shift();
    beatDetection.midHistory.push(midAvg);
    beatDetection.trebleHistory.shift();
    beatDetection.trebleHistory.push(trebleAvg);
    beatDetection.energyBuffer.shift();
    beatDetection.energyBuffer.push(totalEnergy);
    
    const bassHistoryAvg = beatDetection.bassHistory.reduce((a, b) => a + b) / beatDetection.bassHistory.length;
    const midHistoryAvg = beatDetection.midHistory.reduce((a, b) => a + b) / beatDetection.midHistory.length;
    const trebleHistoryAvg = beatDetection.trebleHistory.reduce((a, b) => a + b) / beatDetection.trebleHistory.length;
    const energyHistoryAvg = beatDetection.energyBuffer.reduce((a, b) => a + b) / beatDetection.energyBuffer.length;
    
    const bassVariance = calculateVariance(beatDetection.bassHistory, bassHistoryAvg);
    const midVariance = calculateVariance(beatDetection.midHistory, midHistoryAvg);
    const trebleVariance = calculateVariance(beatDetection.trebleHistory, trebleHistoryAvg);
    
    const energyRatio = totalEnergy / Math.max(energyHistoryAvg, 1);
    beatDetection.adaptiveSensitivity = Math.max(0.5, Math.min(2.0, energyRatio));
    
    beatDetection.bassThreshold = bassHistoryAvg + (bassVariance * 1.2 * beatDetection.adaptiveSensitivity);
    beatDetection.midThreshold = midHistoryAvg + (midVariance * 1.1 * beatDetection.adaptiveSensitivity);
    beatDetection.trebleThreshold = trebleHistoryAvg + (trebleVariance * 1.0 * beatDetection.adaptiveSensitivity);
    
    // Detect kick drums
    if (bassAvg > beatDetection.bassThreshold && 
        now - beatDetection.lastKick > 200 && 
        bassAvg > bassHistoryAvg * 1.4) {
        
        triggerKickEffect(bassAvg, bassHistoryAvg);
        beatDetection.lastKick = now;
    }
    
    // Detect snare drums
    if (midAvg > beatDetection.midThreshold && 
        now - beatDetection.lastSnare > 150 && 
        midAvg > midHistoryAvg * 1.3 &&
        bassAvg < bassHistoryAvg * 1.2) {
        
        triggerSnareEffect(midAvg, midHistoryAvg);
        beatDetection.lastSnare = now;
    }
    
    // Detect hi-hats
    if (trebleAvg > beatDetection.trebleThreshold && 
        now - beatDetection.lastHiHat > 80 && 
        trebleAvg > trebleHistoryAvg * 1.2) {
        
        triggerHiHatEffect(trebleAvg, trebleHistoryAvg);
        beatDetection.lastHiHat = now;
    }
}

function calculateVariance(array, mean) {
    const variance = array.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / array.length;
    return Math.sqrt(variance);
}

// BEAUTIFUL BEAT EFFECTS - Enhance existing elements
function triggerKickEffect(currentLevel, avgLevel) {
    const intensity = Math.min((currentLevel / avgLevel - 1), 1);
    const palette = colorPalettes[currentPalette];
    
    // Store kick intensity for use in visualize() function
    window.kickGlow = {
        intensity: intensity,
        timestamp: Date.now(),
        color: [
            Math.floor((palette.mid[0] + palette.high[0]) / 2),
            Math.floor((palette.mid[1] + palette.high[1]) / 2),
            Math.floor((palette.mid[2] + palette.high[2]) / 2)
        ]
    };
    
    // Elegant title effect
    if (!lyricsLoaded || !isPlaying) {
        const titleIntensity = Math.min(intensity * 1.2, 1);
        bandTitle.style.transform = `scale(${1 + titleIntensity * 0.02})`;
        bandTitle.style.textShadow = `
            0 0 ${40 + titleIntensity * 30}px rgba(255, 255, 255, ${titleIntensity * 0.6}), 
            0 0 ${20 + titleIntensity * 15}px rgba(255, 255, 255, ${titleIntensity * 0.4})
        `;
        
        setTimeout(() => {
            bandTitle.style.transform = 'scale(1)';
            bandTitle.style.textShadow = '0 0 40px rgba(255, 255, 255, 0.25)';
        }, 400);
    }
}

function triggerSnareEffect(currentLevel, avgLevel) {
    const intensity = Math.min((currentLevel / avgLevel - 1), 1);
    const palette = colorPalettes[currentPalette];
    
    // Store snare intensity for use in visualize() function
    window.snareFlash = {
        intensity: intensity,
        timestamp: Date.now(),
        color: palette.high
    };
    
    // Subtle lyrics pulse if visible
    if (lyricsLoaded && isPlaying && lyricsDisplay.text.textContent) {
        const originalTransform = lyricsDisplay.text.style.transform;
        lyricsDisplay.text.style.transform = `${originalTransform} scale(${1 + intensity * 0.03})`;
        setTimeout(() => {
            lyricsDisplay.text.style.transform = originalTransform;
        }, 150);
    }
    
    // Elegant controls pulse
    const controls = document.querySelector('.controls');
    controls.style.transform = `translateX(-50%) scale(${1 + intensity * 0.03})`;
    controls.style.boxShadow = `0 ${8 + intensity * 8}px ${32 + intensity * 16}px rgba(0, 0, 0, ${0.3 + intensity * 0.2})`;
    
    setTimeout(() => {
        controls.style.transform = 'translateX(-50%) scale(1)';
        controls.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
    }, 200);
}

function triggerHiHatEffect(currentLevel, avgLevel) {
    const intensity = Math.min((currentLevel / avgLevel - 1), 1);
    const palette = colorPalettes[currentPalette];
    
    // NO MORE SPARKLES - just spectrum shimmer
    const spectrumCircle = document.getElementById('spectrumCircle');
    if (spectrumCircle) {
        const shimmerColor = palette.high;
        spectrumCircle.style.boxShadow = `
            0 0 ${intensity * 20}px rgba(${shimmerColor[0]}, ${shimmerColor[1]}, ${shimmerColor[2]}, ${intensity * 0.3}),
            inset 0 0 ${intensity * 15}px rgba(${shimmerColor[0]}, ${shimmerColor[1]}, ${shimmerColor[2]}, ${intensity * 0.2})
        `;
        
        setTimeout(() => {
            spectrumCircle.style.boxShadow = '';
        }, 250);
    }
    
    // Add a subtle pulse to the canvas spectrum bars instead
    if (ctx) {
        // This will make the next frame's spectrum slightly brighter
        const trebleBoost = intensity * 30;
        for (let i = Math.floor(bufferLength / 2); i < bufferLength; i++) {
            dataArray[i] = Math.min(255, dataArray[i] + trebleBoost);
        }
    }
}

// Remove the createElegantSparkle function since we don't need it anymore

function initializeVisualizer() {
    canvas = document.getElementById('visualizerCanvas');
    ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    analyser.fftSize = 2048;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    initializeBeatDetection();
    
    visualize();
}

function createParticle(x, y, intensity, color = [255, 255, 255]) {
    return {
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.01,
        size: 1 + intensity * 3,
        intensity: intensity,
        color: color
    };
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;
        particle.vx *= 0.99;
        particle.vy *= 0.99;
        
        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(particle => {
        const alpha = particle.life * particle.intensity * 0.6;
        const [r, g, b] = particle.color;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function updateColorSystem(bassAvg, midAvg, trebleAvg, totalEnergy) {
    colorPhase += colorSpeed;
}

function getFrequencyColor(type, intensity) {
    const palette = colorPalettes[currentPalette];
    const baseColor = type === 'mid' ? palette.mid : palette.high;
    
    const phaseShift = Math.sin(colorPhase + intensity * 2) * 0.1;
    const r = Math.max(0, Math.min(255, baseColor[0] + phaseShift * 20));
    const g = Math.max(0, Math.min(255, baseColor[1] + phaseShift * 15));
    const b = Math.max(0, Math.min(255, baseColor[2] + phaseShift * 20));
    
    return [r, g, b];
}

function visualize() {
    animationId = requestAnimationFrame(visualize);
    
    analyser.getByteFrequencyData(dataArray);
    
    if (isPlaying) {
        updateLyrics();
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const average = sum / bufferLength;
    const bassAverage = dataArray.slice(0, bufferLength / 8).reduce((a, b) => a + b) / (bufferLength / 8);
    const midAverage = dataArray.slice(bufferLength / 8, bufferLength / 2).reduce((a, b) => a + b) / (bufferLength * 3 / 8);
    const trebleAverage = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b) / (bufferLength / 2);
    
    updateColorSystem(bassAverage, midAverage, trebleAverage, average);
    
    if (isPlaying) {
        updateBeatDetection(bassAverage, midAverage, trebleAverage, average);
    }
    
    if (isPlaying) {
        const pulseIntensity = average / 255;
        const palette = colorPalettes[currentPalette];
        const bgColor = [
            (palette.mid[0] + palette.high[0]) / 2,
            (palette.mid[1] + palette.high[1]) / 2,
            (palette.mid[2] + palette.high[2]) / 2
        ];
        
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 500 + bassAverage * 2);
        gradient.addColorStop(0, `rgba(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]}, ${pulseIntensity * 0.02})`);
        gradient.addColorStop(0.5, `rgba(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]}, ${pulseIntensity * 0.01})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 500 + bassAverage * 2, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    const radius = 240;
    
    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * 200;
        const angle = (i / bufferLength) * 2 * Math.PI - Math.PI / 2;
        const intensity = dataArray[i] / 255;
        
        if (i < bufferLength / 4) {
            const x1 = centerX + Math.cos(angle * 4) * radius;
            const y1 = centerY + Math.sin(angle * 4) * radius;
            const x2 = centerX + Math.cos(angle * 4) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle * 4) * (radius + barHeight);
            
            const palette = colorPalettes[currentPalette];
            const tintStrength = 0.1;
            const r = 255 - (255 - palette.mid[0]) * tintStrength;
            const g = 255 - (255 - palette.mid[1]) * tintStrength;
            const b = 255 - (255 - palette.mid[2]) * tintStrength;
            
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${intensity * 0.8})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        if (i >= bufferLength / 4 && i < bufferLength / 2) {
            const x1 = centerX + Math.cos(angle * 4) * radius;
            const y1 = centerY + Math.sin(angle * 4) * radius;
            const x2 = centerX + Math.cos(angle * 4) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle * 4) * (radius + barHeight);
            
            const [r, g, b] = getFrequencyColor('mid', intensity);
            const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity * 0.2})`);
            gradient.addColorStop(1, `rgba(255, 255, 255, ${intensity * 0.1})`);
            
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
            ctx.shadowBlur = intensity * 6;
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2 + intensity * 4;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        if (i >= bufferLength / 2) {
            const x1 = centerX + Math.cos(angle * 4) * radius;
            const y1 = centerY + Math.sin(angle * 4) * radius;
            const x2 = centerX + Math.cos(angle * 4) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle * 4) * (radius + barHeight);
            
            const [r, g, b] = getFrequencyColor('high', intensity);
            const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity * 0.25})`);
            gradient.addColorStop(1, `rgba(255, 255, 255, ${intensity * 0.15})`);
            
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
            ctx.shadowBlur = intensity * 8;
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1 + intensity * 5;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }    
    
    // Enhanced bass visualization with kick detection glow
    if (bassAverage > 80) {
        const now = Date.now();
        
        const bassIntensity = Math.min(bassAverage / 255, 1);
        const palette = colorPalettes[currentPalette];
        let bassColor = [
            Math.floor((palette.mid[0] + palette.high[0]) / 2),
            Math.floor((palette.mid[1] + palette.high[1]) / 2),
            Math.floor((palette.mid[2] + palette.high[2]) / 2)
        ];
        
        let strokeOpacity = bassIntensity * 0.4;
        let shadowBlur = bassIntensity * 20;
        let lineWidth = 3;
        
        // KICK GLOW ENHANCEMENT - Make the existing circle SUPER bright and white on kicks!
        if (window.kickGlow && (now - window.kickGlow.timestamp) < 400) {
            const kickFade = 1 - ((now - window.kickGlow.timestamp) / 400);
            const kickIntensity = window.kickGlow.intensity * kickFade;
            
            // Make it MUCH brighter and whiter
            bassColor = [
                Math.min(255, bassColor[0] + (255 - bassColor[0]) * kickIntensity * 0.8), // Add white
                Math.min(255, bassColor[1] + (255 - bassColor[1]) * kickIntensity * 0.8), // Add white
                Math.min(255, bassColor[2] + (255 - bassColor[2]) * kickIntensity * 0.8)  // Add white
            ];
            
            strokeOpacity = Math.min(1, strokeOpacity + kickIntensity * 0.6); // Much more visible
            shadowBlur = shadowBlur + kickIntensity * 40; // Much more glow
            lineWidth = lineWidth + kickIntensity * 6; // Thicker line
        }
        
        // SNARE FLASH ENHANCEMENT - Add flash effect to the background
        if (window.snareFlash && (now - window.snareFlash.timestamp) < 150) {
            const snareFade = 1 - ((now - window.snareFlash.timestamp) / 150);
            const snareIntensity = window.snareFlash.intensity * snareFade;
            
            // Add background flash
            const flashGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 800);
            flashGradient.addColorStop(0, `rgba(${window.snareFlash.color[0]}, ${window.snareFlash.color[1]}, ${window.snareFlash.color[2]}, ${snareIntensity * 0.1})`);
            flashGradient.addColorStop(0.5, `rgba(${window.snareFlash.color[0]}, ${window.snareFlash.color[1]}, ${window.snareFlash.color[2]}, ${snareIntensity * 0.05})`);
            flashGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = flashGradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 800, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        ctx.strokeStyle = `rgba(${bassColor[0]}, ${bassColor[1]}, ${bassColor[2]}, ${strokeOpacity})`;
        ctx.lineWidth = lineWidth;
        ctx.shadowColor = `rgba(${bassColor[0]}, ${bassColor[1]}, ${bassColor[2]}, 0.8)`;
        ctx.shadowBlur = shadowBlur;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, bassAverage * 1.2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        if (bassAverage > 100 && now - lastBassKick > 300) {
            lastBassKick = now;
            
            beatPulse.classList.add('active');
            setTimeout(() => {
                beatPulse.classList.remove('active');
            }, 800);
        }
    }
    
    updateParticles();
    drawParticles();
}

function getSongPalette(songIndex) {
    const songPalettes = [
        0, // ESTATE - Cyberpunk (magenta/cyan)
        2, // LIVIDI - Ocean (blue/aqua) 
        4, // PIOMBO - Fire (red/yellow)
        5, // DENTI - Purple Dream (purple/pink)
        6  // Track E - Ice (light blue/white)
    ];
    return songPalettes[songIndex] || 0;
}

async function loadCurrentSong() {
    const currentSong = songs[currentSongIndex];
    audio.src = currentSong.url;
    document.getElementById('songTitle').textContent = currentSong.title;
    document.getElementById('progressBar').style.width = '0%';
    
    currentPalette = getSongPalette(currentSongIndex);
    colorPhase = 0;
    colorSpeed = 0.003;
    energyHistory = [];
    
    if (beatDetection.bassHistory.length > 0) {
        initializeBeatDetection();
    }
    
    await loadLyrics();
}

function togglePlay() {
    const playBtn = document.getElementById('playBtn');
    
    if (isPlaying) {
        audio.pause();
        playBtn.textContent = '▶';
        isPlaying = false;
        
        bandTitle.classList.remove('playing');
        songInfo.classList.remove('playing');
        songTitleEl.classList.remove('playing');
        
        hideLyrics();
    } else {
        if (!audioContext) {
            initializeVisualizer();
        }
        
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                playBtn.textContent = '⏸';
                isPlaying = true;
                
                bandTitle.classList.add('playing');
                songInfo.classList.add('playing');
                songTitleEl.classList.add('playing');
                
                if (lyricsLoaded) {
                    showLyrics();
                }
            }).catch(error => {
                console.log('Playback failed:', error);
            });
        } else {
            playBtn.textContent = '⏸';
            isPlaying = true;
            
            bandTitle.classList.add('playing');
            songInfo.classList.add('playing');
            songTitleEl.classList.add('playing');
            
            if (lyricsLoaded) {
                showLyrics();
            }
        }
    }
}

function nextSong() {
    if (isPlaying) {
        hideLyrics();
    }
    
    currentSongIndex = (currentSongIndex + 1) % songs.length;
    loadCurrentSong().then(() => {
        if (isPlaying) {
            audio.play().then(() => {
                if (lyricsLoaded) {
                    setTimeout(() => showLyrics(), 500);
                }
            }).catch(e => console.log('Next song play failed:', e));
        }
    });
}

function previousSong() {
    if (isPlaying) {
        hideLyrics();
    }
    
    currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    loadCurrentSong().then(() => {
        if (isPlaying) {
            audio.play().then(() => {
                if (lyricsLoaded) {
                    setTimeout(() => showLyrics(), 500);
                }
            }).catch(e => console.log('Previous song play failed:', e));
        }
    });
}

let isDragging = false;

audio.addEventListener('timeupdate', () => {
    if (audio.duration && !isDragging) {
        const progress = (audio.currentTime / audio.duration) * 100;
        document.getElementById('progressBar').style.width = progress + '%';
    }
});

const progressContainer = document.getElementById('progressContainer');

progressContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    seekToPosition(e);
});

progressContainer.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    isDragging = true;
    seekToPosition(e);
    progressContainer.style.transform = 'scaleY(1.2)';
});

document.addEventListener('mousemove', (e) => {
    if (isDragging && audio.duration) {
        e.preventDefault();
        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = clickPercent * audio.duration;
        
        audio.currentTime = newTime;
        document.getElementById('progressBar').style.width = (clickPercent * 100) + '%';
    }
});

document.addEventListener('mouseup', (e) => {
    if (isDragging) {
        isDragging = false;
        progressContainer.style.transform = 'scaleY(1)';
        e.preventDefault();
    }
});

function seekToPosition(e) {
    if (!audio.duration) return;
    
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = clickPercent * audio.duration;
    
    audio.currentTime = newTime;
    document.getElementById('progressBar').style.width = (clickPercent * 100) + '%';
    
    if (lyricsLoaded) {
        currentLyricIndex = -1;
    }
}

audio.addEventListener('ended', () => {
    nextSong();
});

loadCurrentSong();

bandTitle.addEventListener('mouseenter', () => {
    if (!isPlaying) {
        bandTitle.style.transform = 'scale(1.015)';
        bandTitle.style.textShadow = '0 0 70px rgba(255, 255, 255, 0.4)';
    }
});

bandTitle.addEventListener('mouseleave', () => {
    if (!isPlaying) {
        bandTitle.style.transform = 'scale(1)';
        bandTitle.style.textShadow = '0 0 40px rgba(255, 255, 255, 0.25)';
    }
});