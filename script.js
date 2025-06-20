// State management
const state = {
    songs: [],
    currentSongIndex: 0,
    isPlaying: false,
    isTransitioning: false, // Add transition state
    currentSongData: { title: "", palette: { mid: [255, 255, 255], high: [255, 255, 255] } },
    lyrics: { current: [], index: 0, loaded: false },
    touch: { startX: 0, startY: 0, startTime: 0, isScrolling: false },
    isHoveringCenter: false,
    isDragging: false,
    colorPhase: 0,
    backgroundAnimationPhase: 0
};

// Beat detection state
const beatDetection = {
    history: { bass: [], mid: [], treble: [], energy: [] },
    thresholds: { bass: 0, mid: 0, treble: 0 },
    lastTrigger: { kick: 0, snare: 0, hihat: 0 },
    adaptiveSensitivity: 1.0,
    lastBeatTrigger: 0
};

// Audio and visualization
let audioContext, analyser, source, dataArray, bufferLength, canvas, ctx, animationId;

// DOM elements cache
const elements = {
    audio: document.getElementById('audioPlayer'),
    bandTitle: document.getElementById('bandTitle'),
    songInfo: document.getElementById('songInfo'),
    songTitle: document.getElementById('songTitle'),
    beatPulse: document.getElementById('beatPulse'),
    navLeft: document.getElementById('navLeft'),
    navRight: document.getElementById('navRight'),
    progressContainer: document.getElementById('progressContainer'),
    progressBar: document.getElementById('progressBar'),
    songIndicators: document.getElementById('songIndicators'),
    centerPlayArea: document.getElementById('centerPlayArea'),
    speakerStatic: document.getElementById('speakerStatic'),
    songBackground: document.getElementById('songBackground')
};

// Utility functions
const utils = {
    async fetchJson(path) {
        try {
            const response = await fetch(path);
            return response.ok ? await response.json() : null;
        } catch { return null; }
    },

    async fetchText(path) {
        try {
            const response = await fetch(path);
            return response.ok ? await response.text() : null;
        } catch { return null; }
    },

    calculateVariance(array, mean) {
        const variance = array.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / array.length;
        return Math.sqrt(variance);
    },

    // Convert RGB to HSL
    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h * 360, s * 100, l * 100];
    }
};

// Song management
const songManager = {
    async loadSongsList() {
        return await utils.fetchJson('./Songs/SongData.json') || [];
    },

    applyBackgroundBrightness() {
        // Get brightness value from song data (default to 0.85 if not specified)
        const brightness = state.currentSongData.backgroundBrightness || 0.85;
        
        // Apply the brightness to the overlay
        elements.songBackground.style.setProperty('--background-overlay-opacity', brightness);
    },

    applyBackgroundTint() {
        const palette = state.currentSongData.palette;
        
        // Use mid palette color for tinting
        const tintColor = palette.mid || [255, 255, 255];
        
        // Convert to HSL to get the hue for color tinting
        const [hue, saturation, lightness] = utils.rgbToHsl(tintColor[0], tintColor[1], tintColor[2]);
        
        // Apply color tint using CSS filters
        // sepia(1) makes it monochrome, then we adjust hue and saturation
        const filterValue = `sepia(1) saturate(1.5) hue-rotate(${hue - 60}deg) brightness(0.8) contrast(1.2)`;
        
        elements.songBackground.style.filter = filterValue;
        
        // Store palette colors as CSS variables for potential use in animations
        document.documentElement.style.setProperty('--bg-tint-r', tintColor[0]);
        document.documentElement.style.setProperty('--bg-tint-g', tintColor[1]);
        document.documentElement.style.setProperty('--bg-tint-b', tintColor[2]);
    },

    async discoverSongs() {
        const folderNames = await this.loadSongsList();
        const discoveredSongs = [];
        
        for (const folderName of folderNames) {
            const data = await utils.fetchJson(`./Songs/${folderName}/Data.json`);
            if (data) {
                discoveredSongs.push({ folder: folderName, title: folderName, ...data });
            }
        }
        return discoveredSongs;
    },

    async loadMetadata(folderName) {
        const metadata = await utils.fetchJson(`./Songs/${folderName}/Data.json`);
        state.currentSongData = {
            title: folderName,
            palette: { mid: [255, 255, 255], high: [255, 255, 255] },
            backgroundBrightness: 0.85, // Default brightness
            ...metadata
        };
    },

    async loadLyrics() {
        const folderName = state.songs[state.currentSongIndex].folder;
        const lrcContent = await utils.fetchText(`./Songs/${folderName}/Lyrics.lrc`);
        
        if (lrcContent) {
            state.lyrics.current = this.parseLyrics(lrcContent);
            state.lyrics.loaded = state.lyrics.current.length > 0;
            state.lyrics.index = 0;
        } else {
            state.lyrics.current = [];
            state.lyrics.loaded = false;
        }
    },

    parseLyrics(lrcContent) {
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
                let text = match[4].trim();
                
                const timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
                let styleMode = currentRegion;
                let isTitle = false;
                
                if (text.toLowerCase() === '"title"' || text.toLowerCase() === 'title' || text === '"title"') {
                    isTitle = true;
                    text = 'SUPER ROBOT\nNINJA SAMURAI';
                    styleMode = 'title';
                } else if (text && /[A-Z]/.test(text) && text === text.toUpperCase() && text !== text.toLowerCase()) {
                    styleMode = 'aggressive';
                }
                
                lyrics.push({ time: timeInSeconds, text, style: styleMode, isTitle });
            }
        });
        
        return lyrics.sort((a, b) => a.time - b.time);
    },

    async loadCurrentSong() {
        const folderName = state.songs[state.currentSongIndex].folder;
        
        await this.loadMetadata(folderName);
        elements.audio.src = `./Songs/${folderName}/Song.mp3`;
        elements.songTitle.textContent = state.currentSongData.title;
        elements.progressBar.style.width = '0%';
        
        // Load background image for this song
        this.loadSongBackground(folderName);
        
        // Reset states
        state.colorPhase = 0;
        state.backgroundAnimationPhase = 0;
        this.initializeBeatDetection();
        await this.loadLyrics();
    },

    loadSongBackground(folderName) {
        const backgroundPath = `./Songs/${folderName}/background.png`;
        
        // Create a new image to test if background exists
        const testImage = new Image();
        
        testImage.onload = () => {
            // Background image exists, show it
            elements.songBackground.style.backgroundImage = `url('${backgroundPath}')`;
            elements.songBackground.classList.add('loaded');
            
            // Apply background brightness and color tint
            this.applyBackgroundBrightness();
            this.applyBackgroundTint();
        };
        
        testImage.onerror = () => {
            // No background image found, hide background
            elements.songBackground.style.backgroundImage = 'none';
            elements.songBackground.classList.remove('loaded');
        };
        
        // Start loading the image
        testImage.src = backgroundPath;
    },

    initializeBeatDetection() {
        beatDetection.history.bass = new Array(20).fill(0);
        beatDetection.history.mid = new Array(15).fill(0);
        beatDetection.history.treble = new Array(10).fill(0);
        beatDetection.history.energy = new Array(30).fill(0);
        beatDetection.lastBeatTrigger = 0;
    }
};

// UI management
const ui = {
    createSongIndicators() {
        elements.songIndicators.innerHTML = '';
        
        state.songs.forEach((song, index) => {
            const dot = document.createElement('div');
            dot.className = 'song-dot';
            if (index === state.currentSongIndex) dot.classList.add('active');
            
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                if (index !== state.currentSongIndex) this.goToSong(index);
            });
            
            elements.songIndicators.appendChild(dot);
        });
    },

    updateSongIndicators() {
        const dots = document.querySelectorAll('.song-dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === state.currentSongIndex);
        });
    },

    createLyricsDisplay() {
        const container = document.createElement('div');
        container.id = 'lyricsContainer';
        container.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 15; text-align: center; opacity: 0; transition: opacity 0.8s ease;
            pointer-events: none; max-width: 80vw;
        `;
        
        const text = document.createElement('div');
        text.id = 'lyricsText';
        text.style.cssText = `
            font-size: clamp(1rem, 2vw, 2.2rem); font-weight: 300; color: #fff;
            letter-spacing: 0.15em; line-height: 1.4; text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
            font-family: 'Inter', sans-serif; white-space: nowrap; filter: blur(0px);
            transition: all 0.6s ease; text-transform: uppercase; opacity: 0.9; text-align: center;
        `;
        
        container.appendChild(text);
        document.querySelector('.container').appendChild(container);
        return { container, text };
    },

    applyLyricStyling(element, styleMode, palette) {
        element.style.animation = 'none';
        
        const baseStyle = {
            fontSize: 'clamp(1rem, 2vw, 2.2rem)',
            letterSpacing: '0.15em',
            transform: 'scale(1)',
            whiteSpace: 'nowrap'
        };
        
        Object.assign(element.style, baseStyle);
        
        if (styleMode === 'enhance') {
            element.style.fontWeight = '300';
            const enhanceGlow = `rgba(${palette.high.join(', ')}, 0.5)`;
            element.style.textShadow = `0 0 30px ${enhanceGlow}, 0 0 15px rgba(255, 255, 255, 0.6)`;
            element.style.animation = 'glitchEffect 1.2s ease-in-out infinite';
        } else if (styleMode === 'aggressive') {
            element.style.fontWeight = '500';
            const aggressiveGlow = `rgba(${palette.high.join(', ')}, 0.7)`;
            element.style.textShadow = `
                2px 0 0 rgba(255, 0, 0, 0.5), -2px 0 0 rgba(0, 255, 255, 0.5),
                0 0 30px ${aggressiveGlow}, 0 0 15px rgba(255, 255, 255, 0.8)
            `;
            element.style.animation = 'glitchEffect 1s ease-in-out infinite';
        } else {
            element.style.fontWeight = '300';
            element.style.textShadow = '0 0 20px rgba(255, 255, 255, 0.3)';
        }
    },

    goToSong(index) {
        if (state.isPlaying && state.lyrics.loaded) {
            this.hideLyrics();
        }
        
        // Set transition state to prevent title from showing
        const wasPlaying = state.isPlaying;
        state.isTransitioning = true;
        
        state.currentSongIndex = index;
        songManager.loadCurrentSong().then(() => {
            this.updateSongIndicators();
            
            if (wasPlaying) {
                elements.audio.play().then(() => {
                    state.isTransitioning = false; // Clear transition state
                    // Keep static speaker hidden during transitions if we were playing
                    elements.speakerStatic.classList.add('hidden');
                    if (state.lyrics.loaded) {
                        setTimeout(() => this.showLyrics(), 500);
                    }
                }).catch(() => {
                    state.isTransitioning = false; // Clear on error too
                });
            } else {
                state.isTransitioning = false; // Clear if not playing
                // Show static speaker if not playing
                elements.speakerStatic.classList.remove('hidden');
            }
        });
    },

    showLyrics() {
        if (state.lyrics.loaded) {
            elements.bandTitle.style.opacity = '0';
            elements.bandTitle.style.transform = 'scale(0.95)';
            setTimeout(() => { lyricsDisplay.container.style.opacity = '1'; }, 400);
        }
    },

    hideLyrics() {
        lyricsDisplay.container.style.opacity = '0';
        
        // Only show title if not transitioning and not playing
        if (!state.isTransitioning && !state.isPlaying) {
            setTimeout(() => {
                elements.bandTitle.style.opacity = '0.95';
                elements.bandTitle.style.transform = 'scale(1)';
            }, 400);
        }
        
        setTimeout(() => {
            lyricsDisplay.text.textContent = '';
            state.lyrics.index = -1;
        }, 800);
    }
};

// Navigation helpers
const navigation = {
    nextSong() { ui.goToSong((state.currentSongIndex + 1) % state.songs.length); },
    previousSong() { ui.goToSong((state.currentSongIndex - 1 + state.songs.length) % state.songs.length); }
};

// Event handlers
const events = {
    setupGestureControls() {
        document.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        document.addEventListener('wheel', this.handleWheel, { passive: false });
        
        elements.navLeft.addEventListener('click', (e) => { e.stopPropagation(); navigation.previousSong(); });
        elements.navRight.addEventListener('click', (e) => { e.stopPropagation(); navigation.nextSong(); });
        
        ui.createSongIndicators();
        this.setupCenterAreaHover();
        this.setupProgressBar();
    },

    handleTouchStart(e) {
        state.touch.startX = e.touches[0].clientX;
        state.touch.startY = e.touches[0].clientY;
        state.touch.startTime = Date.now();
        state.touch.isScrolling = false;
    },

    handleTouchMove(e) {
        if (!state.touch.startX || !state.touch.startY) return;
        
        const diffX = state.touch.startX - e.touches[0].clientX;
        const diffY = state.touch.startY - e.touches[0].clientY;
        
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
            state.touch.isScrolling = true;
            e.preventDefault();
        }
    },

    handleTouchEnd(e) {
        if (!state.touch.startX || !state.touch.startY) return;
        
        const diffX = state.touch.startX - e.changedTouches[0].clientX;
        const timeDiff = Date.now() - state.touch.startTime;
        
        if (Math.abs(diffX) > 50 && timeDiff < 300) {
            diffX > 0 ? navigation.nextSong() : navigation.previousSong();
        }
        
        state.touch = { startX: 0, startY: 0, startTime: 0, isScrolling: false };
    },

    handleWheel(e) {
        e.preventDefault();
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.deltaX > 0 ? navigation.nextSong() : navigation.previousSong();
        }
    },

    setupCenterAreaHover() {
        elements.centerPlayArea.addEventListener('mouseenter', () => {
            state.isHoveringCenter = true;
            if (state.isPlaying && state.lyrics.loaded && lyricsDisplay.text.textContent) {
                lyricsDisplay.text.style.opacity = '0.3';
            }
        });
        
        elements.centerPlayArea.addEventListener('mouseleave', () => {
            state.isHoveringCenter = false;
            if (state.isPlaying && state.lyrics.loaded) {
                lyricsDisplay.text.style.opacity = '0.9';
            }
        });
    },

    setupProgressBar() {
        const hitArea = document.createElement('div');
        hitArea.style.cssText = `
            position: absolute; top: -20px; left: -10px; right: -10px; bottom: -20px;
            z-index: 101; cursor: pointer;
        `;
        elements.progressContainer.style.position = 'relative';
        elements.progressContainer.appendChild(hitArea);

        const seekToPosition = (e) => {
            if (!elements.audio.duration) return;
            const rect = elements.progressContainer.getBoundingClientRect();
            const clickPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            elements.audio.currentTime = clickPercent * elements.audio.duration;
            elements.progressBar.style.width = (clickPercent * 100) + '%';
            if (state.lyrics.loaded) state.lyrics.index = -1;
        };

        hitArea.addEventListener('click', (e) => { e.stopPropagation(); seekToPosition(e); });
        
        // Mouse drag handling
        hitArea.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            state.isDragging = true;
            seekToPosition(e);
            
            const handleMove = (e) => state.isDragging && seekToPosition(e);
            const handleUp = () => {
                state.isDragging = false;
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleUp);
            };
            
            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleUp);
        });
    }
};

// Beat detection and effects
const beatEffects = {
    updateBeatDetection(bassAvg, midAvg, trebleAvg, totalEnergy) {
        const now = Date.now();
        const { history, thresholds, lastTrigger } = beatDetection;
        
        // Update history arrays
        history.bass.shift(); history.bass.push(bassAvg);
        history.mid.shift(); history.mid.push(midAvg);
        history.treble.shift(); history.treble.push(trebleAvg);
        history.energy.shift(); history.energy.push(totalEnergy);
        
        // Calculate averages and thresholds
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
        
        // Trigger effects
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
        
        // Only trigger title effects if not transitioning and lyrics are not loaded/playing
        if (!state.isTransitioning && (!state.lyrics.loaded || !state.isPlaying)) {
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
        
        if (state.lyrics.loaded && state.isPlaying && lyricsDisplay.text.textContent) {
            const originalTransform = lyricsDisplay.text.style.transform;
            lyricsDisplay.text.style.transform = `${originalTransform} scale(${1 + intensity * 0.03})`;
            setTimeout(() => { lyricsDisplay.text.style.transform = originalTransform; }, 150);
        }
    },

    triggerHiHatEffect(currentLevel, avgLevel) {
        const intensity = Math.min((currentLevel / avgLevel - 1), 1);
        const spectrumCircle = document.getElementById('spectrumCircle');
        if (spectrumCircle) {
            const color = state.currentSongData.palette.high;
            spectrumCircle.style.boxShadow = `
                0 0 ${intensity * 20}px rgba(${color.join(', ')}, ${intensity * 0.3}),
                inset 0 0 ${intensity * 15}px rgba(${color.join(', ')}, ${intensity * 0.2})
            `;
            setTimeout(() => { spectrumCircle.style.boxShadow = ''; }, 250);
        }
    }
};

// Lyrics system
const lyrics = {
    display: null,

    init() {
        this.display = ui.createLyricsDisplay();
    },

    update() {
        if (!state.lyrics.loaded || !state.isPlaying || state.lyrics.current.length === 0) return;
        
        const currentTime = elements.audio.currentTime;
        let newIndex = -1;
        
        for (let i = 0; i < state.lyrics.current.length; i++) {
            if (currentTime >= state.lyrics.current[i].time) {
                newIndex = i;
            } else break;
        }
        
        if (newIndex !== state.lyrics.index && newIndex >= 0) {
            state.lyrics.index = newIndex;
            const lyric = state.lyrics.current[newIndex];
            
            if (lyric.isTitle) {
                this.display.container.style.opacity = '0';
                setTimeout(() => {
                    this.display.text.textContent = '';
                    elements.bandTitle.style.opacity = '0.95';
                    elements.bandTitle.style.transform = 'scale(1)';
                }, 400);
            } else if (!lyric.text || lyric.text.trim() === '') {
                this.hideText();
            } else {
                this.showText(lyric);
            }
        }
    },

    hideText() {
        elements.bandTitle.style.opacity = '0';
        elements.bandTitle.style.transform = 'scale(0.95)';
        
        this.display.text.style.opacity = '0';
        this.display.text.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            this.display.text.textContent = '';
            this.display.text.style.opacity = '1';
            this.display.text.style.transform = 'translateY(0)';
        }, 300);
    },

    showText(lyric) {
        elements.bandTitle.style.opacity = '0';
        elements.bandTitle.style.transform = 'scale(0.95)';
        
        this.display.text.style.opacity = '0';
        this.display.text.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            this.display.text.textContent = lyric.text;
            this.display.text.style.opacity = state.isHoveringCenter ? '0.3' : '1';
            this.display.text.style.transform = 'translateY(0)';
            this.display.container.style.opacity = '1';
            
            ui.applyLyricStyling(this.display.text, lyric.style, state.currentSongData.palette);
            
            if (state.isHoveringCenter) {
                this.display.text.style.opacity = '0.3';
            }
        }, 300);
    }
};

// Background animation system
const backgroundAnimation = {
    updateAnimation() {
        if (!state.isPlaying) return;
        
        // Increment animation phase
        state.backgroundAnimationPhase += 0.001;
        
        // Calculate gentle animation values based on music analysis
        const time = Date.now() * 0.001;
        const slowWave = Math.sin(time * 0.1) * 0.5;
        const mediumWave = Math.sin(time * 0.15) * 0.3;
        const fastWave = Math.sin(time * 0.2) * 0.2;
        
        // Combine waves for complex movement
        const xOffset = -5 + slowWave + mediumWave * 0.5;
        const yOffset = -5 + fastWave + slowWave * 0.3;
        const scale = 1 + (slowWave * 0.01) + (mediumWave * 0.005);
        const rotation = (slowWave + fastWave) * 0.3;
        
        // Apply the transformation
        const transform = `translate(${xOffset}%, ${yOffset}%) scale(${scale}) rotate(${rotation}deg)`;
        elements.songBackground.style.transform = transform;
    }
};

// Visualization
const visualization = {
    init() {
        canvas = document.getElementById('visualizerCanvas');
        ctx = canvas.getContext('2d');
        
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        
        source = audioContext.createMediaElementSource(elements.audio);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        analyser.fftSize = 2048;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        songManager.initializeBeatDetection();
        this.visualize();
    },

    getFrequencyColor(type, intensity) {
        const palette = state.currentSongData.palette;
        const baseColor = type === 'mid' ? palette.mid : palette.high;
        
        const phaseShift = Math.sin(state.colorPhase + intensity * 2) * 0.1;
        return baseColor.map(c => Math.max(0, Math.min(255, c + phaseShift * 20)));
    },

    visualize() {
        animationId = requestAnimationFrame(() => this.visualize());
        
        analyser.getByteFrequencyData(dataArray);
        
        if (state.isPlaying) {
            lyrics.update();
        }
        
        // Very light fade effect for visualizer trails (won't hide background)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Calculate frequency averages
        const total = dataArray.reduce((sum, val) => sum + val, 0);
        const average = total / bufferLength;
        const bassAverage = dataArray.slice(0, bufferLength / 8).reduce((a, b) => a + b) / (bufferLength / 8);
        const midAverage = dataArray.slice(bufferLength / 8, bufferLength / 2).reduce((a, b) => a + b) / (bufferLength * 3 / 8);
        const trebleAverage = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b) / (bufferLength / 2);
        
        state.colorPhase += 0.003;
        
        if (state.isPlaying) {
            beatEffects.updateBeatDetection(bassAverage, midAverage, trebleAverage, average);
            this.drawBackground(centerX, centerY, average, bassAverage);
        }
        
        this.drawSpectrum(centerX, centerY);
        this.drawBassCircle(centerX, centerY, bassAverage);
    },

    drawBackground(centerX, centerY, average, bassAverage) {
        const pulseIntensity = average / 255;
        const palette = state.currentSongData.palette;
        const bgColor = palette.mid.map((c, i) => (c + palette.high[i]) / 2);
        
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 500 + bassAverage * 2);
        gradient.addColorStop(0, `rgba(${bgColor.join(', ')}, ${pulseIntensity * 0.02})`);
        gradient.addColorStop(0.5, `rgba(${bgColor.join(', ')}, ${pulseIntensity * 0.01})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 500 + bassAverage * 2, 0, 2 * Math.PI);
        ctx.fill();
    },

    drawSpectrum(centerX, centerY) {
        const radius = 245;
        
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * 200;
            const angle = (i / bufferLength) * 2 * Math.PI - Math.PI / 2;
            const intensity = dataArray[i] / 255;
            
            const x1 = centerX + Math.cos(angle * 4) * radius;
            const y1 = centerY + Math.sin(angle * 4) * radius;
            const x2 = centerX + Math.cos(angle * 4) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle * 4) * (radius + barHeight);
            
            if (i < bufferLength / 4) {
                // Bass frequencies
                const palette = state.currentSongData.palette;
                const tintStrength = 0.1;
                const color = palette.mid.map(c => 255 - (255 - c) * tintStrength);
                
                ctx.strokeStyle = `rgba(${color.join(', ')}, ${intensity * 0.8})`;
                ctx.lineWidth = 0.5;
            } else if (i < bufferLength / 2) {
                // Mid frequencies
                const color = this.getFrequencyColor('mid', intensity);
                const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                gradient.addColorStop(0, `rgba(${color.join(', ')}, ${intensity * 0.5})`);
                gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                
                ctx.shadowColor = `rgba(${color.join(', ')}, 0.4)`;
                ctx.shadowBlur = intensity * 6;
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 2 + intensity * 4;
            } else {
                // High frequencies
                const color = this.getFrequencyColor('high', intensity);
                const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                gradient.addColorStop(0, `rgba(${color.join(', ')}, ${intensity * 0.5})`);
                gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                
                ctx.shadowColor = `rgba(${color.join(', ')}, 0.5)`;
                ctx.shadowBlur = intensity * 8;
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 1 + intensity * 5;
            }
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    },

    drawBassCircle(centerX, centerY, bassAverage) {
        if (bassAverage <= 80) return;
        
        const now = Date.now();
        const intensity = Math.min(bassAverage / 255, 1);
        const palette = state.currentSongData.palette;
        let bassColor = palette.mid.map((c, i) => Math.floor((c + palette.high[i]) / 2));
        
        let strokeOpacity = intensity * 0.4;
        let shadowBlur = intensity * 20;
        let lineWidth = 3;
        
        // Apply kick glow effect
        if (window.kickGlow && (now - window.kickGlow.timestamp) < 400) {
            const kickFade = 1 - ((now - window.kickGlow.timestamp) / 400);
            const kickIntensity = window.kickGlow.intensity * kickFade;
            
            bassColor = bassColor.map(c => Math.min(255, c + (255 - c) * kickIntensity * 0.8));
            strokeOpacity = Math.min(1, strokeOpacity + kickIntensity * 0.6);
            shadowBlur = shadowBlur + kickIntensity * 40;
            lineWidth = lineWidth + kickIntensity * 6;
        }
        
        // Apply snare flash effect
        if (window.snareFlash && (now - window.snareFlash.timestamp) < 150) {
            const snareFade = 1 - ((now - window.snareFlash.timestamp) / 150);
            const snareIntensity = window.snareFlash.intensity * snareFade;
            
            const flashGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 800);
            const color = window.snareFlash.color;
            flashGradient.addColorStop(0, `rgba(${color.join(', ')}, ${snareIntensity * 0.1})`);
            flashGradient.addColorStop(0.5, `rgba(${color.join(', ')}, ${snareIntensity * 0.05})`);
            flashGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = flashGradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 800, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        ctx.strokeStyle = `rgba(${bassColor.join(', ')}, ${strokeOpacity})`;
        ctx.lineWidth = lineWidth;
        ctx.shadowColor = `rgba(${bassColor.join(', ')}, 0.8)`;
        ctx.shadowBlur = shadowBlur;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, bassAverage * 1.2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Trigger beat pulse effect
        if (bassAverage > 100 && now - (window.lastBassKick || 0) > 300) {
            window.lastBassKick = now;
            elements.beatPulse.classList.add('active');
            setTimeout(() => elements.beatPulse.classList.remove('active'), 800);
        }
    }
};

// Main playbook control
function togglePlay() {
    if (state.isPlaying) {
        elements.audio.pause();
        state.isPlaying = false;
        state.isTransitioning = false; // Clear transition state when manually stopping
        
        // Remove playing classes
        ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
            elements[el].classList.remove('playing');
        });
        
        // Show static speaker when stopped
        elements.speakerStatic.classList.remove('hidden');
        
        ui.hideLyrics();
    } else {
        if (!audioContext) visualization.init();
        if (audioContext.state === 'suspended') audioContext.resume();
        
        const playPromise = elements.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                state.isPlaying = true;
                state.isTransitioning = false; // Clear transition state when successfully playing
                
                // Add playing classes
                ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
                    elements[el].classList.add('playing');
                });
                
                // Hide static speaker when playing
                elements.speakerStatic.classList.add('hidden');
                
                if (state.lyrics.loaded) ui.showLyrics();
            });
        } else {
            state.isPlaying = true;
            state.isTransitioning = false; // Clear transition state
            
            // Add playing classes
            ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
                elements[el].classList.add('playing');
            });
            
            // Hide static speaker when playing
            elements.speakerStatic.classList.add('hidden');
            
            if (state.lyrics.loaded) ui.showLyrics();
        }
    }
}

// Audio event listeners
elements.audio.addEventListener('timeupdate', () => {
    if (elements.audio.duration && !state.isDragging) {
        const progress = (elements.audio.currentTime / elements.audio.duration) * 100;
        elements.progressBar.style.width = progress + '%';
    }
});

elements.audio.addEventListener('ended', navigation.nextSong);

// Band title hover effects
elements.bandTitle.addEventListener('mouseenter', () => {
    if (!state.isPlaying) {
        elements.bandTitle.style.transform = 'scale(1.015)';
        elements.bandTitle.style.textShadow = '0 0 70px rgba(255, 255, 255, 0.4)';
    }
});

elements.bandTitle.addEventListener('mouseleave', () => {
    if (!state.isPlaying) {
        elements.bandTitle.style.transform = 'scale(1)';
        elements.bandTitle.style.textShadow = '0 0 40px rgba(255, 255, 255, 0.25)';
    }
});

// Initialize application
async function initializeApp() {
    state.songs = await songManager.discoverSongs();
    
    if (state.songs.length === 0) {
        console.error('No songs found! Make sure you have Data.json files in your song folders.');
        return;
    }
    
    await songManager.loadCurrentSong();
    lyrics.init();
    events.setupGestureControls();
}

// Global variable for lyrics display (referenced by UI functions)
let lyricsDisplay;

// Start the application
initializeApp().then(() => {
    lyricsDisplay = lyrics.display;
});