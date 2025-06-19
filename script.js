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

// Fluid visualizer system
let fluidPoints = [];
let flowField = [];
let fluidTime = 0;

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

// Initialize fluid system
function initializeFluid() {
    fluidPoints = [];
    flowField = [];
    
    // Create fluid points based on song characteristics
    const songConfig = getSongFluidConfig(currentSongIndex);
    
    for (let i = 0; i < songConfig.pointCount; i++) {
        const angle = (i / songConfig.pointCount) * Math.PI * 2;
        const radius = songConfig.baseRadius + Math.random() * songConfig.radiusVariation;
        
        fluidPoints.push({
            x: canvas.width / 2 + Math.cos(angle) * radius,
            y: canvas.height / 2 + Math.sin(angle) * radius,
            originalX: canvas.width / 2 + Math.cos(angle) * radius,
            originalY: canvas.height / 2 + Math.sin(angle) * radius,
            angle: angle,
            radius: radius,
            velocity: {
                x: (Math.random() - 0.5) * songConfig.velocity,
                y: (Math.random() - 0.5) * songConfig.velocity
            },
            life: 1.0,
            originalRadius: radius,
            pulsePhase: Math.random() * Math.PI * 2
        });
    }
}

// Get fluid configuration for each song
function getSongFluidConfig(songIndex) {
    const configs = [
        // ESTATE - Cyberpunk: Sharp, angular, aggressive
        {
            pointCount: 8,
            baseRadius: 120,
            radiusVariation: 40,
            velocity: 0.8,
            flowIntensity: 1.2,
            smoothness: 0.3,
            reactivity: 0.9,
            shape: 'angular'
        },
        // LIVIDI - Ocean: Flowing, smooth, wave-like
        {
            pointCount: 12,
            baseRadius: 150,
            radiusVariation: 60,
            velocity: 0.4,
            flowIntensity: 0.8,
            smoothness: 0.8,
            reactivity: 0.6,
            shape: 'flowing'
        },
        // PIOMBO - Fire: Chaotic, explosive, irregular
        {
            pointCount: 6,
            baseRadius: 100,
            radiusVariation: 80,
            velocity: 1.2,
            flowIntensity: 1.5,
            smoothness: 0.2,
            reactivity: 1.0,
            shape: 'chaotic'
        },
        // DENTI - Purple Dream: Dreamy, pulsing, organic
        {
            pointCount: 10,
            baseRadius: 140,
            radiusVariation: 50,
            velocity: 0.6,
            flowIntensity: 1.0,
            smoothness: 0.7,
            reactivity: 0.7,
            shape: 'organic'
        },
        // Track E - Ice: Crystalline, geometric, cold
        {
            pointCount: 16,
            baseRadius: 130,
            radiusVariation: 30,
            velocity: 0.3,
            flowIntensity: 0.6,
            smoothness: 0.9,
            reactivity: 0.5,
            shape: 'crystalline'
        }
    ];
    return configs[songIndex] || configs[0];
}

// Update fluid points based on audio data
function updateFluid(bassAvg, midAvg, trebleAvg) {
    if (fluidPoints.length === 0) return;
    
    const songConfig = getSongFluidConfig(currentSongIndex);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    fluidTime += 0.02;
    
    // Update each fluid point
    fluidPoints.forEach((point, index) => {
        const audioInfluence = (bassAvg + midAvg + trebleAvg) / (3 * 255);
        const bassInfluence = bassAvg / 255;
        const trebleInfluence = trebleAvg / 255;
        
        // Different movement patterns per song
        switch (songConfig.shape) {
            case 'angular':
                // Sharp, geometric movements
                point.angle += (bassInfluence * 0.05 + 0.01) * songConfig.reactivity;
                point.radius = point.originalRadius + bassInfluence * 80 + Math.sin(fluidTime * 3 + point.pulsePhase) * 20;
                break;
                
            case 'flowing':
                // Smooth, wave-like movements
                point.angle += 0.008 + trebleInfluence * 0.02;
                point.radius = point.originalRadius + Math.sin(fluidTime * 2 + point.pulsePhase) * 40 + audioInfluence * 60;
                break;
                
            case 'chaotic':
                // Erratic, explosive movements
                point.velocity.x += (Math.random() - 0.5) * bassInfluence * 2;
                point.velocity.y += (Math.random() - 0.5) * bassInfluence * 2;
                point.velocity.x *= 0.95;
                point.velocity.y *= 0.95;
                point.radius = point.originalRadius + bassInfluence * 100 + Math.random() * trebleInfluence * 40;
                break;
                
            case 'organic':
                // Breathing, pulsing movements
                const breathe = Math.sin(fluidTime + point.pulsePhase) * 0.5 + 0.5;
                point.angle += 0.006 + audioInfluence * 0.015;
                point.radius = point.originalRadius + breathe * 50 + audioInfluence * 70;
                break;
                
            case 'crystalline':
                // Precise, geometric, ice-like
                point.angle += 0.004 + trebleInfluence * 0.01;
                point.radius = point.originalRadius + Math.sin(fluidTime * 4 + point.pulsePhase) * 15 + audioInfluence * 30;
                break;
        }
        
        // Update position based on angle and radius
        if (songConfig.shape !== 'chaotic') {
            point.x = centerX + Math.cos(point.angle) * point.radius;
            point.y = centerY + Math.sin(point.angle) * point.radius;
        } else {
            // For chaotic, use velocity-based movement
            point.x += point.velocity.x;
            point.y += point.velocity.y;
            
            // Keep chaotic points roughly centered
            const distFromCenter = Math.sqrt((point.x - centerX) ** 2 + (point.y - centerY) ** 2);
            if (distFromCenter > 300) {
                const pullX = (centerX - point.x) * 0.01;
                const pullY = (centerY - point.y) * 0.01;
                point.velocity.x += pullX;
                point.velocity.y += pullY;
            }
        }
    });
}

// Draw fluid visualizer
function drawFluid() {
    if (fluidPoints.length === 0 || !isPlaying) return;
    
    const palette = colorPalettes[currentPalette];
    const songConfig = getSongFluidConfig(currentSongIndex);
    
    // Create gradient colors
    const color1 = getFrequencyColor('mid', 0.8);
    const color2 = getFrequencyColor('high', 0.6);
    
    // Draw fluid shape using curves
    ctx.save();
    
    // Set up gradient fill
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 200);
    gradient.addColorStop(0, `rgba(${color1[0]}, ${color1[1]}, ${color1[2]}, 0.15)`);
    gradient.addColorStop(0.5, `rgba(${color2[0]}, ${color2[1]}, ${color2[2]}, 0.08)`);
    gradient.addColorStop(1, `rgba(${color1[0]}, ${color1[1]}, ${color1[2]}, 0.02)`);
    
    ctx.fillStyle = gradient;
    
    // Draw the fluid shape
    if (fluidPoints.length > 2) {
        ctx.beginPath();
        
        // Start from first point
        ctx.moveTo(fluidPoints[0].x, fluidPoints[0].y);
        
        // Draw smooth curves between points
        for (let i = 0; i < fluidPoints.length; i++) {
            const current = fluidPoints[i];
            const next = fluidPoints[(i + 1) % fluidPoints.length];
            
            if (songConfig.smoothness > 0.5) {
                // Smooth curves for flowing shapes
                const midX = (current.x + next.x) / 2;
                const midY = (current.y + next.y) / 2;
                ctx.quadraticCurveTo(current.x, current.y, midX, midY);
            } else {
                // More angular for sharp shapes
                ctx.lineTo(next.x, next.y);
            }
        }
        
        ctx.closePath();
        ctx.fill();
        
        // Add glowing outline
        ctx.strokeStyle = `rgba(${color2[0]}, ${color2[1]}, ${color2[2]}, 0.4)`;
        ctx.lineWidth = 1 + songConfig.flowIntensity;
        ctx.shadowColor = `rgba(${color2[0]}, ${color2[1]}, ${color2[2]}, 0.3)`;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    // Draw connection lines for crystalline effect
    if (songConfig.shape === 'crystalline') {
        ctx.strokeStyle = `rgba(${color1[0]}, ${color1[1]}, ${color1[2]}, 0.1)`;
        ctx.lineWidth = 0.5;
        
        for (let i = 0; i < fluidPoints.length; i++) {
            for (let j = i + 2; j < fluidPoints.length; j++) {
                if (j - i > fluidPoints.length / 2) continue;
                
                ctx.beginPath();
                ctx.moveTo(fluidPoints[i].x, fluidPoints[i].y);
                ctx.lineTo(fluidPoints[j].x, fluidPoints[j].y);
                ctx.stroke();
            }
        }
    }
    
    ctx.restore();
}

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
        // Enhanced styling - same weight, just subtle glow animation
        element.style.fontSize = 'clamp(1rem, 2vw, 2.2rem)'; // Same as normal
        element.style.fontWeight = '300'; // Same weight, not bold
        element.style.letterSpacing = '0.15em'; // Same spacing
        element.style.transform = 'scale(1)'; // No scaling
        const enhanceGlow = `rgba(${palette.high[0]}, ${palette.high[1]}, ${palette.high[2]}, 0.5)`;
        element.style.textShadow = `0 0 30px ${enhanceGlow}, 0 0 15px rgba(255, 255, 255, 0.6)`;
        element.style.transition = 'all 0.3s ease';
        
        // Add subtle glow pulsing only
        element.style.animation = 'subtleGlow 1.2s ease-in-out infinite';
        
    } else if (styleMode === 'aggressive') {
        // Aggressive styling - bold with glitch effects
        element.style.fontSize = 'clamp(1rem, 2vw, 2.2rem)'; // Same size
        element.style.fontWeight = '500'; // Bold for caps only
        element.style.letterSpacing = '0.15em'; // Same spacing
        element.style.transform = 'scale(1)'; // No scaling
        const aggressiveGlow = `rgba(${palette.high[0]}, ${palette.high[1]}, ${palette.high[2]}, 0.7)`;
        element.style.textShadow = `
            2px 0 0 rgba(255, 0, 0, 0.5),
            -2px 0 0 rgba(0, 255, 255, 0.5),
            0 0 30px ${aggressiveGlow},
            0 0 15px rgba(255, 255, 255, 0.8)
        `;
        element.style.transition = 'all 0.2s ease';
        
        // Add glitchy animation
        element.style.animation = 'glitchEffect 1s ease-in-out infinite';
        
    } else {
        // Normal styling
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
    let currentRegion = 'normal'; // 'normal', 'enhance'
    
    lines.forEach(line => {
        // Check for region markers
        if (line.trim().startsWith('#enhance')) {
            currentRegion = 'enhance';
            return;
        }
        if (line.trim().startsWith('#endenhance')) {
            currentRegion = 'normal';
            return;
        }
        
        // Match LRC format: [mm:ss.xx]text or [mm:ss]text
        const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2}))?\](.*)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const centiseconds = match[3] ? parseInt(match[3]) : 0;
            const text = match[4].trim();
            
            const timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
            
            // Detect styling modes
            let styleMode = currentRegion;
            
            // Check if text is all caps (and has letters)
            if (text && /[A-Z]/.test(text) && text === text.toUpperCase() && text !== text.toLowerCase()) {
                styleMode = 'aggressive';
            }
            
            // Add both empty and non-empty lyrics to handle clearing
            lyrics.push({
                time: timeInSeconds,
                text: text, // text can be empty string for clearing
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
    // Try the exact case first, then try capitalized first letter
    const lyricsPath = `./Songs/${songName}.txt`;
    const altLyricsPath = `./Songs/${songName.charAt(0).toUpperCase() + songName.slice(1).toLowerCase()}.txt`;
    
    try {
        let response = await fetch(lyricsPath);
        let finalPath = lyricsPath;
        
        // If first attempt fails, try alternative case
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
            console.log(`No lyrics file found for ${songName} (tried both ${lyricsPath} and ${altLyricsPath})`);
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
    
    // Debug: log current time for first few seconds
    if (currentTime < 10) {
        console.log(`Current time: ${currentTime.toFixed(2)}s`);
    }
    
    // Find the current lyric line
    let newLyricIndex = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentTime >= currentLyrics[i].time) {
            newLyricIndex = i;
        } else {
            break;
        }
    }
    
    // Debug: log when we find a new lyric
    if (newLyricIndex !== currentLyricIndex && newLyricIndex >= 0) {
        console.log(`New lyric at ${currentTime.toFixed(2)}s: "${currentLyrics[newLyricIndex].text}"`);
    }
    // Update display if we have a new lyric (including empty ones for clearing)
    if (newLyricIndex !== currentLyricIndex && newLyricIndex >= 0) {
        currentLyricIndex = newLyricIndex;
        const currentLyric = currentLyrics[currentLyricIndex];
        
        // Handle empty text (clear lyrics)
        if (!currentLyric.text || currentLyric.text.trim() === '') {
            lyricsDisplay.text.style.opacity = '0';
            lyricsDisplay.text.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                lyricsDisplay.text.textContent = '';
                lyricsDisplay.text.style.opacity = '1';
                lyricsDisplay.text.style.transform = 'translateY(0)';
            }, 300);
        } else {
            // Update lyrics text with fade effect for non-empty text
            lyricsDisplay.text.style.opacity = '0';
            lyricsDisplay.text.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                lyricsDisplay.text.textContent = currentLyric.text;
                lyricsDisplay.text.style.opacity = '1';
                lyricsDisplay.text.style.transform = 'translateY(0)';
                
                // Apply styling based on lyric mode
                const palette = colorPalettes[currentPalette];
                applyLyricStyling(lyricsDisplay.text, currentLyric.style, palette);
                
            }, 300);
        }
    }
}

// Show/hide lyrics and title
function showLyrics() {
    if (lyricsLoaded) {
        // Hide band title
        bandTitle.style.opacity = '0';
        bandTitle.style.transform = 'scale(0.95)';
        
        // Show lyrics container
        setTimeout(() => {
            lyricsDisplay.container.style.opacity = '1';
        }, 400);
    }
}

function hideLyrics() {
    // Hide lyrics
    lyricsDisplay.container.style.opacity = '0';
    
    // Show band title
    setTimeout(() => {
        bandTitle.style.opacity = '0.95';
        bandTitle.style.transform = 'scale(1)';
    }, 400);
    
    // Clear lyrics text
    setTimeout(() => {
        lyricsDisplay.text.textContent = '';
        currentLyricIndex = -1;
    }, 800);
}

function initializeVisualizer() {
    canvas = document.getElementById('visualizerCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Create audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    
    // Connect audio element to analyser
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    // Configure analyser
    analyser.fftSize = 2048;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    // Start visualization
    visualize();
    
    // Initialize fluid system
    initializeFluid();
}

// Enhanced particle system with colored particles
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

// Static color system - palette stays the same per song
function updateColorSystem(bassAvg, midAvg, trebleAvg, totalEnergy) {
    // Just update the color phase for subtle color shifting within the same palette
    colorPhase += colorSpeed;
}

// Get color based on intensity and FIXED current palette (no dynamic switching)
function getFrequencyColor(type, intensity) {
    const palette = colorPalettes[currentPalette];
    const baseColor = type === 'mid' ? palette.mid : palette.high;
    
    // Very subtle phase-based color shifting within the same palette
    const phaseShift = Math.sin(colorPhase + intensity * 2) * 0.1; // Reduced from 0.3 to 0.1
    const r = Math.max(0, Math.min(255, baseColor[0] + phaseShift * 20)); // Reduced from 50 to 20
    const g = Math.max(0, Math.min(255, baseColor[1] + phaseShift * 15)); // Reduced from 30 to 15
    const b = Math.max(0, Math.min(255, baseColor[2] + phaseShift * 20)); // Reduced from 40 to 20
    
    return [r, g, b];
}

function visualize() {
    animationId = requestAnimationFrame(visualize);
    
    analyser.getByteFrequencyData(dataArray);
    
    // Update lyrics if playing
    if (isPlaying) {
        updateLyrics();
    }
    
    // Clear canvas with enhanced fade effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Calculate frequency averages
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const average = sum / bufferLength;
    const bassAverage = dataArray.slice(0, bufferLength / 8).reduce((a, b) => a + b) / (bufferLength / 8);
    const midAverage = dataArray.slice(bufferLength / 8, bufferLength / 2).reduce((a, b) => a + b) / (bufferLength * 3 / 8);
    const trebleAverage = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b) / (bufferLength / 2);
    
    // Update dynamic color system
    updateColorSystem(bassAverage, midAverage, trebleAverage, average);
    
    // Update fluid visualizer
    updateFluid(bassAverage, midAverage, trebleAverage);
    
    // Dynamic background pulse with current palette influence
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
    
    // Draw fluid visualizer (behind other elements)
    drawFluid();
    
    // Enhanced circular spectrum visualization with dynamic colors
    const radius = 240;
    
    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * 200;
        const angle = (i / bufferLength) * 2 * Math.PI - Math.PI / 2;
        const intensity = dataArray[i] / 255;
        
        // Inner circle (low frequencies) - keep as solid white with slight pulse
        if (i < bufferLength / 4) {
            const x1 = centerX + Math.cos(angle * 4) * radius;
            const y1 = centerY + Math.sin(angle * 4) * radius;
            const x2 = centerX + Math.cos(angle * 4) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle * 4) * (radius + barHeight);
            
            // Slight color tint based on current palette
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

        // Middle circle (mid frequencies) - dynamic color
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

        // Outer circle (high frequencies) - dynamic color
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
    
    // Enhanced bass visualization with dynamic colors
    if (bassAverage > 80) {
        const now = Date.now();
        
        // Bass ring with dynamic glow
        const bassIntensity = Math.min(bassAverage / 255, 1);
        const palette = colorPalettes[currentPalette];
        const bassColor = [
            Math.floor((palette.mid[0] + palette.high[0]) / 2),
            Math.floor((palette.mid[1] + palette.high[1]) / 2),
            Math.floor((palette.mid[2] + palette.high[2]) / 2)
        ];
        
        ctx.strokeStyle = `rgba(${bassColor[0]}, ${bassColor[1]}, ${bassColor[2]}, ${bassIntensity * 0.4})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `rgba(${bassColor[0]}, ${bassColor[1]}, ${bassColor[2]}, 0.6)`;
        ctx.shadowBlur = bassIntensity * 20;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, bassAverage * 1.2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Beat pulse effect with colored particles
        if (bassAverage > 100 && now - lastBassKick > 300) {
            lastBassKick = now;
            
            // Enhanced title effects (only if lyrics not showing)
            if (!lyricsLoaded || !isPlaying) {
                const intensity = Math.min(bassAverage / 255, 1);
                const scale = 1 + (intensity * 0.06);
                const glowIntensity = 0.4 + (intensity * 0.4);
                
                bandTitle.style.transform = `scale(${scale})`;
                bandTitle.style.textShadow = `0 0 ${80 + intensity * 60}px rgba(${bassColor[0]}, ${bassColor[1]}, ${bassColor[2]}, ${glowIntensity * 0.3}), 0 0 ${40 + intensity * 30}px rgba(255, 255, 255, ${glowIntensity})`;
                
                setTimeout(() => {
                    bandTitle.style.transform = 'scale(1)';
                    bandTitle.style.textShadow = '0 0 40px rgba(255, 255, 255, 0.25)';
                }, 200);
            }
            
            // Beat pulse ring
            beatPulse.classList.add('active');
            setTimeout(() => {
                beatPulse.classList.remove('active');
            }, 800);
        }
    }
    
    // Update and draw particles
    updateParticles();
    drawParticles();
}

// Song-specific color palettes assignment - FIXED colors per song
function getSongPalette(songIndex) {
    // Each song gets its own permanent color - no randomness, no green
    const songPalettes = [
        0, // ESTATE - Cyberpunk (magenta/cyan)
        2, // LIVIDI - Ocean (blue/aqua) 
        4, // PIOMBO - Fire (red/yellow)
        5, // DENTI - Purple Dream (purple/pink)
        6  // Track E - Ice (light blue/white)
    ];
    return songPalettes[songIndex] || 0; // Default to cyberpunk if out of range
}

// Audio control functions
async function loadCurrentSong() {
    const currentSong = songs[currentSongIndex];
    audio.src = currentSong.url;
    document.getElementById('songTitle').textContent = currentSong.title;
    document.getElementById('progressBar').style.width = '0%';
    
    // Set specific palette for this song (stays consistent throughout the song)
    currentPalette = getSongPalette(currentSongIndex);
    colorPhase = 0;
    colorSpeed = 0.003;
    energyHistory = [];
    
    // Initialize fluid system for new song
    if (canvas) {
        initializeFluid();
    }
    
    // Load lyrics for this song
    await loadLyrics();
}

function togglePlay() {
    const playBtn = document.getElementById('playBtn');
    
    if (isPlaying) {
        audio.pause();
        playBtn.textContent = '▶';
        isPlaying = false;
        
        // Remove playing states
        bandTitle.classList.remove('playing');
        songInfo.classList.remove('playing');
        songTitleEl.classList.remove('playing');
        
        // Hide lyrics and show title
        hideLyrics();
    } else {
        // Initialize visualizer on first play
        if (!audioContext) {
            initializeVisualizer();
        }
        
        // Resume audio context if suspended
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                playBtn.textContent = '⏸';
                isPlaying = true;
                
                // Add playing states
                bandTitle.classList.add('playing');
                songInfo.classList.add('playing');
                songTitleEl.classList.add('playing');
                
                // Show lyrics if available
                if (lyricsLoaded) {
                    showLyrics();
                }
            }).catch(error => {
                console.log('Playback failed:', error);
            });
        } else {
            playBtn.textContent = '⏸';
            isPlaying = true;
            
            // Add playing states
            bandTitle.classList.add('playing');
            songInfo.classList.add('playing');
            songTitleEl.classList.add('playing');
            
            // Show lyrics if available
            if (lyricsLoaded) {
                showLyrics();
            }
        }
    }
}

function nextSong() {
    // Hide lyrics first
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
    // Hide lyrics first
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

// Enhanced progress bar with smooth interactions
let isDragging = false;

audio.addEventListener('timeupdate', () => {
    if (audio.duration && !isDragging) {
        const progress = (audio.currentTime / audio.duration) * 100;
        document.getElementById('progressBar').style.width = progress + '%';
    }
});

const progressContainer = document.getElementById('progressContainer');

// Click anywhere on the progress container
progressContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    seekToPosition(e);
});

// Drag anywhere on the progress container
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
    
    // Reset lyrics index when seeking
    if (lyricsLoaded) {
        currentLyricIndex = -1;
    }
}

// Auto-advance to next song when current ends
audio.addEventListener('ended', () => {
    nextSong();
});

// Initialize first song
loadCurrentSong();

// Enhanced hover effects
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