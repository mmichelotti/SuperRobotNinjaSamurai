// State management with performance flags
const state = {
    songs: [],
    currentSongIndex: 0,
    isPlaying: false,
    isTransitioning: false,
    currentSongData: { title: "", palette: { mid: [255, 255, 255], high: [255, 255, 255] } },
    lyrics: { current: [], index: 0, loaded: false },
    touch: { startX: 0, startY: 0, startTime: 0, isScrolling: false },
    isHoveringCenter: false,
    isDragging: false,
    colorPhase: 0,
    backgroundAnimationPhase: 0,
    isMobile: false,
    currentGalleryIndex: 0,
    isScrolled: false,
    // Performance optimization flags
    isHomepageVisible: true,
    isVisualizerActive: false,
    shouldUpdateLyrics: false,
    shouldUpdateBackground: false,
    performanceMode: 'auto' // 'high', 'auto', 'low'
};

// Performance monitoring
const performance = {
    frameCount: 0,
    lastFpsCheck: Date.now(),
    currentFps: 60,
    targetFps: 60,
    lowFpsThreshold: 30,
    
    updateFps() {
        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFpsCheck >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsCheck = now;
            
            // Auto-adjust performance mode
            if (state.performanceMode === 'auto') {
                if (this.currentFps < this.lowFpsThreshold) {
                    this.enableLowPerformanceMode();
                } else if (this.currentFps > 50) {
                    this.enableHighPerformanceMode();
                }
            }
        }
    },
    
    enableLowPerformanceMode() {
        state.performanceMode = 'low';
        // Reduce animation frequency
        beatDetection.adaptiveSensitivity *= 0.5;
        // Disable heavy effects
        elements.songBackground.classList.add('low-performance');
    },
    
    enableHighPerformanceMode() {
        state.performanceMode = 'high';
        beatDetection.adaptiveSensitivity = Math.min(2.0, beatDetection.adaptiveSensitivity * 1.2);
        elements.songBackground.classList.remove('low-performance');
    }
};

// Beat detection state with optimization
const beatDetection = {
    history: { bass: [], mid: [], treble: [], energy: [] },
    thresholds: { bass: 0, mid: 0, treble: 0 },
    lastTrigger: { kick: 0, snare: 0, hihat: 0 },
    adaptiveSensitivity: 1.0,
    lastBeatTrigger: 0,
    // Performance optimization
    lastUpdate: 0,
    updateInterval: 16, // ~60fps, will be adjusted based on performance
    skipFrames: 0
};

// Audio and visualization with lazy loading
let audioContext, analyser, source, dataArray, bufferLength, canvas, ctx, animationId;
let isVisualizationInitialized = false;

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
    songBackground: document.getElementById('songBackground'),
    navOverlay: document.getElementById('navOverlay'),
    scrollIndicator: document.getElementById('scrollIndicator'),
    galleryTrack: document.getElementById('galleryTrack'),
    galleryPrev: document.getElementById('galleryPrev'),
    galleryNext: document.getElementById('galleryNext'),
    newsletterForm: document.getElementById('newsletterForm')
};

// Debounced and throttled functions
const throttle = (func, delay) => {
    let timeoutId;
    let lastExecTime = 0;
    return function (...args) {
        const currentTime = Date.now();
        
        if (currentTime - lastExecTime > delay) {
            func.apply(this, args);
            lastExecTime = currentTime;
        } else {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
                lastExecTime = Date.now();
            }, delay - (currentTime - lastExecTime));
        }
    };
};

const debounce = (func, delay) => {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
};

// Mobile detection
function detectMobile() {
    state.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || 
                    (window.matchMedia && window.matchMedia("(hover: none)").matches);
}

// Prevent zoom and pinch gestures
function preventZoom() {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    document.addEventListener('gesturestart', function (event) {
        event.preventDefault();
    });

    document.addEventListener('gesturechange', function (event) {
        event.preventDefault();
    });

    document.addEventListener('gestureend', function (event) {
        event.preventDefault();
    });

    document.addEventListener('touchstart', function(event) {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    });

    document.addEventListener('touchmove', function(event) {
        if (event.scale !== 1) {
            event.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('keydown', function(event) {
        if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '-' || event.key === '=' || event.key === '0')) {
            event.preventDefault();
        }
    });

    document.addEventListener('wheel', function(event) {
        if (event.ctrlKey) {
            event.preventDefault();
        }
    }, { passive: false });
}

// Mobile animation helpers
function showMobileIcon(element) {
    if (!state.isMobile) return;
    
    element.classList.add('mobile-click');
    setTimeout(() => {
        element.classList.remove('mobile-click');
    }, 300);
}

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
        const brightness = state.currentSongData.backgroundBrightness || 0.85;
        elements.songBackground.style.setProperty('--background-overlay-opacity', brightness);
    },

    applyBackgroundTint() {
        const palette = state.currentSongData.palette;
        const tintColor = palette.mid || [255, 255, 255];
        const [hue, saturation, lightness] = utils.rgbToHsl(tintColor[0], tintColor[1], tintColor[2]);
        const filterValue = `sepia(1) saturate(1.5) hue-rotate(${hue - 60}deg) brightness(0.8) contrast(1.2)`;
        
        elements.songBackground.style.filter = filterValue;
        
        document.documentElement.style.setProperty('--bg-tint-r', tintColor[0]);
        document.documentElement.style.setProperty('--bg-tint-g', tintColor[1]);
        document.documentElement.style.setProperty('--bg-tint-b', tintColor[2]);
        
        const sectionHeaders = document.querySelectorAll('.section-title');
        const shadowColor = `rgba(${tintColor[0]}, ${tintColor[1]}, ${tintColor[2]}, 1.0)`;

        sectionHeaders.forEach(header => {
            header.style.textShadow = `0 0 20px ${shadowColor}`;
        });
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
            backgroundBrightness: 0.85,
            ...metadata
        };
    },

    async loadLyrics() {
        if (!state.isHomepageVisible) return; // Skip if not visible
        
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
        
        this.loadSongBackground(folderName);
        
        state.colorPhase = 0;
        state.backgroundAnimationPhase = 0;
        this.initializeBeatDetection();
        await this.loadLyrics();
    },

    loadSongBackground(folderName) {
        const backgroundPath = `./Songs/${folderName}/background.png`;
        const testImage = new Image();
        
        testImage.onload = () => {
            elements.songBackground.style.backgroundImage = `url('${backgroundPath}')`;
            elements.songBackground.classList.add('loaded');
            this.applyBackgroundBrightness();
            this.applyBackgroundTint();
        };
        
        testImage.onerror = () => {
            elements.songBackground.style.backgroundImage = 'none';
            elements.songBackground.classList.remove('loaded');
        };
        
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

// UI management with performance optimization
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
            position: absolute; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%);
            z-index: 15; 
            text-align: center; 
            opacity: 0; 
            transition: opacity 0.8s ease;
            pointer-events: none; 
            width: 100vw;
            display: flex;
            justify-content: center;
            align-items: center;
            touch-action: manipulation;
        `;
        
        const text = document.createElement('div');
        text.id = 'lyricsText';
        text.style.cssText = `
            font-size: clamp(1rem, 2vw, 2.2rem); 
            font-weight: 300; 
            color: #fff;
            letter-spacing: 0.15em; 
            line-height: 1.4; 
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
            font-family: 'Inter', sans-serif; 
            filter: blur(0px);
            transition: all 0.6s ease; 
            text-transform: uppercase; 
            opacity: 0.9; 
            text-align: center;
            touch-action: manipulation;
            max-width: 90vw;
            padding: 0 5vw;
        `;
        
        if (state.isMobile) {
            text.style.whiteSpace = 'normal';
            text.style.wordBreak = 'break-word';
        } else {
            text.style.whiteSpace = 'nowrap';
        }
        
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
            maxWidth: '90vw',
            padding: '0 5vw'
        };
        
        if (state.isMobile) {
            baseStyle.whiteSpace = 'normal';
            baseStyle.wordBreak = 'break-word';
        } else {
            baseStyle.whiteSpace = 'nowrap';
        }
        
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
        
        const wasPlaying = state.isPlaying;
        state.isTransitioning = true;
        
        state.currentSongIndex = index;
        songManager.loadCurrentSong().then(() => {
            this.updateSongIndicators();
            
            if (wasPlaying) {
                elements.audio.play().then(() => {
                    state.isTransitioning = false;
                    elements.speakerStatic.classList.add('hidden');
                    if (state.lyrics.loaded) {
                        setTimeout(() => this.showLyrics(), 500);
                    }
                }).catch(() => {
                    state.isTransitioning = false;
                });
            } else {
                state.isTransitioning = false;
                elements.speakerStatic.classList.remove('hidden');
            }
        });
    },

    showLyrics() {
        if (state.lyrics.loaded && state.isHomepageVisible) {
            elements.bandTitle.style.opacity = '0';
            elements.bandTitle.style.transform = 'scale(0.95)';
            setTimeout(() => { lyricsDisplay.container.style.opacity = '1'; }, 400);
        }
    },

    hideLyrics() {
        lyricsDisplay.container.style.opacity = '0';
        
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

// Optimized scroll and navigation functionality
const scrollHandler = {
    lastScrollTime: 0,
    
    init() {
        const throttledScroll = throttle(this.handleScroll.bind(this), 16); // ~60fps
        window.addEventListener('scroll', throttledScroll, { passive: true });
        this.setupSectionObserver();
    },

    handleScroll() {
        const now = Date.now();
        if (now - this.lastScrollTime < 16) return; // Throttle to 60fps
        this.lastScrollTime = now;
        
        const scrolled = window.scrollY > 50;
        const isHomepageVisible = window.scrollY < window.innerHeight * 0.7; // More generous threshold
        
        // Update homepage visibility state for performance
        if (state.isHomepageVisible !== isHomepageVisible) {
            state.isHomepageVisible = isHomepageVisible;
            state.shouldUpdateLyrics = isHomepageVisible && state.isPlaying;
            state.shouldUpdateBackground = isHomepageVisible && state.isPlaying;
            
            // Always enable full visualizer when homepage becomes visible
            if (isHomepageVisible) {
                this.enableFullVisualizer();
            }
        }
        
        if (scrolled !== state.isScrolled) {
            state.isScrolled = scrolled;
            elements.navOverlay.classList.toggle('scrolled', scrolled);
            elements.scrollIndicator.classList.toggle('hidden', scrolled);
            elements.songInfo.classList.toggle('scrolled', scrolled);
        }
    },

    enableFullVisualizer() {
        // Always ensure we're in full quality mode when homepage is visible
        if (canvas) {
            state.isVisualizerActive = true;
            canvas.classList.add('active');
            elements.homepage.classList.add('optimized');
        }
        // Reset performance mode to ensure full quality
        if (state.performanceMode === 'low') {
            performance.enableHighPerformanceMode();
        }
    },

    enableVisualizer() {
        // Same as enableFullVisualizer - always full quality
        this.enableFullVisualizer();
    },

    disableVisualizer() {
        // Only disable when truly not visible (very far from homepage)
        if (window.scrollY > window.innerHeight * 1.5) {
            if (state.isVisualizerActive) {
                state.isVisualizerActive = false;
                if (canvas) canvas.classList.remove('active');
                elements.homepage.classList.remove('optimized');
            }
        }
    },

    setupSectionObserver() {
        const sections = document.querySelectorAll('.section');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.3 });

        sections.forEach(section => observer.observe(section));
    }
};

// Optimized gallery functionality
const gallery = {
    autoAdvanceTimeout: null,
    
    init() {
        if (elements.galleryPrev && elements.galleryNext) {
            elements.galleryPrev.addEventListener('click', () => this.navigate(-1));
            elements.galleryNext.addEventListener('click', () => this.navigate(1));
            
            this.startAutoAdvance();
        }
    },

    navigate(direction) {
        const items = document.querySelectorAll('.gallery-item');
        const maxIndex = items.length - Math.floor(elements.galleryTrack.offsetWidth / 300);
        
        state.currentGalleryIndex += direction;
        
        if (state.currentGalleryIndex < 0) {
            state.currentGalleryIndex = 0;
        } else if (state.currentGalleryIndex > maxIndex) {
            state.currentGalleryIndex = maxIndex;
        }
        
        const translateX = -state.currentGalleryIndex * 301;
        elements.galleryTrack.style.transform = `translateX(${translateX}px)`;
        
        // Reset auto-advance timer
        this.startAutoAdvance();
    },

    startAutoAdvance() {
        clearTimeout(this.autoAdvanceTimeout);
        this.autoAdvanceTimeout = setTimeout(() => this.autoAdvance(), 5000);
    },

    autoAdvance() {
        const items = document.querySelectorAll('.gallery-item');
        const maxIndex = items.length - Math.floor(elements.galleryTrack.offsetWidth / 300);
        
        if (state.currentGalleryIndex >= maxIndex) {
            state.currentGalleryIndex = -1;
        }
        
        this.navigate(1);
    }
};

// Newsletter functionality
const newsletter = {
    init() {
        if (elements.newsletterForm) {
            elements.newsletterForm.addEventListener('submit', this.handleSubmit.bind(this));
        }
    },

    handleSubmit(e) {
        e.preventDefault();
        const email = e.target.querySelector('.newsletter-input').value;
        
        const btn = e.target.querySelector('.newsletter-btn');
        const originalText = btn.textContent;
        
        btn.textContent = 'SUBSCRIBING...';
        btn.disabled = true;
        
        setTimeout(() => {
            btn.textContent = 'SUBSCRIBED!';
            e.target.querySelector('.newsletter-input').value = '';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 2000);
        }, 1000);
    }
};

// Global navigation functions
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Optimized event handlers
const events = {
    setupGestureControls() {
        document.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        document.addEventListener('wheel', this.handleWheel, { passive: false });
        
        elements.navLeft.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            showMobileIcon(elements.navLeft);
            navigation.previousSong(); 
        });
        elements.navRight.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            showMobileIcon(elements.navRight);
            navigation.nextSong(); 
        });
        
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
        if (window.scrollY === 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.preventDefault();
            e.deltaX > 0 ? navigation.nextSong() : navigation.previousSong();
        }
    },

    setupCenterAreaHover() {
        if (!state.isMobile) {
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
        }
    },

    setupProgressBar() {
        const hitArea = document.createElement('div');
        hitArea.style.cssText = `
            position: absolute; top: -20px; left: -10px; right: -10px; bottom: -20px;
            z-index: 101; cursor: pointer; touch-action: manipulation;
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

// Optimized beat detection and effects
const beatEffects = {
    lastEffectTime: 0,
    
    updateBeatDetection(bassAvg, midAvg, trebleAvg, totalEnergy) {
        const now = Date.now();
        
        // Skip update if performance is low
        if (state.performanceMode === 'low' && now - this.lastEffectTime < 32) {
            return;
        }
        
        // Skip if not visible
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
            this.lastEffectTime = now;
        }
        
        if (midAvg > thresholds.mid && now - lastTrigger.snare > 150 && midAvg > avgs.mid * 1.3 && bassAvg < avgs.bass * 1.2) {
            this.triggerSnareEffect(midAvg, avgs.mid);
            lastTrigger.snare = now;
            this.lastEffectTime = now;
        }
        
        if (trebleAvg > thresholds.treble && now - lastTrigger.hihat > 80 && trebleAvg > avgs.treble * 1.2) {
            this.triggerHiHatEffect(trebleAvg, avgs.treble);
            lastTrigger.hihat = now;
            this.lastEffectTime = now;
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

// Optimized lyrics system
const lyrics = {
    display: null,
    lastUpdateTime: 0,

    init() {
        this.display = ui.createLyricsDisplay();
    },

    update() {
        const now = Date.now();
        
        // Throttle lyrics updates
        if (now - this.lastUpdateTime < 100) return;
        this.lastUpdateTime = now;
        
        // Skip if not needed
        if (!state.shouldUpdateLyrics || !state.lyrics.loaded || !state.isPlaying || state.lyrics.current.length === 0) return;
        
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
        
        setTimeout(() => {
            this.display.text.textContent = '';
            this.display.text.style.opacity = '1';
        }, 300);
    },

    showText(lyric) {
        elements.bandTitle.style.opacity = '0';
        elements.bandTitle.style.transform = 'scale(0.95)';
        
        this.display.text.style.opacity = '0';
        
        setTimeout(() => {
            this.display.text.textContent = lyric.text;
            this.display.text.style.opacity = (state.isHoveringCenter && !state.isMobile) ? '0.3' : '1';
            this.display.container.style.opacity = '1';
            
            ui.applyLyricStyling(this.display.text, lyric.style, state.currentSongData.palette);
            
            if (state.isHoveringCenter && !state.isMobile) {
                this.display.text.style.opacity = '0.3';
            }
        }, 300);
    }
};

// Optimized background animation system
const backgroundAnimation = {
    lastUpdateTime: 0,
    
    updateAnimation() {
        const now = Date.now();
        
        // Skip if not visible or throttle updates
        if (!state.shouldUpdateBackground || now - this.lastUpdateTime < 32) return;
        this.lastUpdateTime = now;
        
        if (!state.isPlaying) return;
        
        state.backgroundAnimationPhase += 0.001;
        
        const time = now * 0.001;
        const slowWave = Math.sin(time * 0.1) * 0.5;
        const mediumWave = Math.sin(time * 0.15) * 0.3;
        const fastWave = Math.sin(time * 0.2) * 0.2;
        
        const xOffset = -5 + slowWave + mediumWave * 0.5;
        const yOffset = -5 + fastWave + slowWave * 0.3;
        const scale = 1 + (slowWave * 0.01) + (mediumWave * 0.005);
        const rotation = (slowWave + fastWave) * 0.3;
        
        const transform = `translate(${xOffset}%, ${yOffset}%) scale(${scale}) rotate(${rotation}deg)`;
        elements.songBackground.style.transform = transform;
        
        // Add animating class for performance
        if (!elements.songBackground.classList.contains('animating')) {
            elements.songBackground.classList.add('animating');
        }
    }
};

// Optimized visualization
const visualization = {
    lastFrameTime: 0,
    skipFrameCount: 0,
    
    init() {
        canvas = document.getElementById('visualizerCanvas');
        ctx = canvas.getContext('2d');
        
        const resizeCanvas = debounce(() => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }, 250);
        
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
        isVisualizationInitialized = true;
        this.visualize();
    },

    getFrequencyColor(type, intensity) {
        const palette = state.currentSongData.palette;
        const baseColor = type === 'mid' ? palette.mid : palette.high;
        
        const phaseShift = Math.sin(state.colorPhase + intensity * 2) * 0.1;
        return baseColor.map(c => Math.max(0, Math.min(255, c + phaseShift * 20)));
    },

    visualize() {
        const now = Date.now();
        
        // Performance-based frame skipping
        if (state.performanceMode === 'low') {
            this.skipFrameCount++;
            if (this.skipFrameCount < 2) { // Skip every other frame
                animationId = requestAnimationFrame(() => this.visualize());
                return;
            }
            this.skipFrameCount = 0;
        }
        
        // Continue visualizer even when paused if homepage is visible (for transition effect)
        // Only skip if not visible
        if (!state.isHomepageVisible) {
            animationId = requestAnimationFrame(() => this.visualize());
            return;
        }
        
        animationId = requestAnimationFrame(() => this.visualize());
        
        // Update performance monitoring
        performance.updateFps();
        
        analyser.getByteFrequencyData(dataArray);
        
        // Only update lyrics and background when playing
        if (state.isPlaying) {
            lyrics.update();
            backgroundAnimation.updateAnimation();
        }
        
        // Clear canvas with performance optimization
        if (state.performanceMode !== 'low') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        const total = dataArray.reduce((sum, val) => sum + val, 0);
        const average = total / bufferLength;
        const bassAverage = dataArray.slice(0, bufferLength / 8).reduce((a, b) => a + b) / (bufferLength / 8);
        const midAverage = dataArray.slice(bufferLength / 8, bufferLength / 2).reduce((a, b) => a + b) / (bufferLength * 3 / 8);
        const trebleAverage = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b) / (bufferLength / 2);
        
        state.colorPhase += 0.003;
        
        // Only trigger beat effects when playing
        if (state.isPlaying) {
            beatEffects.updateBeatDetection(bassAverage, midAverage, trebleAverage, average);
            if (state.performanceMode !== 'low') {
                this.drawBackground(centerX, centerY, average, bassAverage);
            }
        }
        
        // Always draw spectrum and bass circle (this creates the fade-out effect when paused)
        this.drawSpectrum(centerX, centerY);
        this.drawBassCircle(centerX, centerY, bassAverage);
        
        this.lastFrameTime = now;
    },

    drawBackground(centerX, centerY, average, bassAverage) {
        const pulseIntensity = average / 255;
        const palette = state.currentSongData.palette;
        const bgColor = palette.mid.map((c, i) => (c + palette.high[i]) / 2);
        
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(canvas.width, canvas.height));
        gradient.addColorStop(0, `rgba(${bgColor.join(', ')}, ${pulseIntensity * 0.02})`);
        gradient.addColorStop(0.5, `rgba(${bgColor.join(', ')}, ${pulseIntensity * 0.01})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    },

    drawSpectrum(centerX, centerY) {
        const radius = 245;
        const step = state.performanceMode === 'low' ? 4 : 1; // Reduce detail in low performance mode
        
        for (let i = 0; i < bufferLength; i += step) {
            const barHeight = (dataArray[i] / 255) * 200;
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
                ctx.lineWidth = 0.5;
            } else if (i < bufferLength / 2) {
                const color = this.getFrequencyColor('mid', intensity);
                const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                gradient.addColorStop(0, `rgba(${color.join(', ')}, ${intensity * 0.5})`);
                gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                
                if (state.performanceMode !== 'low') {
                    ctx.shadowColor = `rgba(${color.join(', ')}, 0.4)`;
                    ctx.shadowBlur = intensity * 6;
                }
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 2 + intensity * 4;
            } else {
                const color = this.getFrequencyColor('high', intensity);
                const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                gradient.addColorStop(0, `rgba(${color.join(', ')}, ${intensity * 0.5})`);
                gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                
                if (state.performanceMode !== 'low') {
                    ctx.shadowColor = `rgba(${color.join(', ')}, 0.5)`;
                    ctx.shadowBlur = intensity * 8;
                }
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 1 + intensity * 5;
            }
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            
            if (state.performanceMode !== 'low') {
                ctx.shadowBlur = 0;
            }
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
        
        if (window.kickGlow && (now - window.kickGlow.timestamp) < 400) {
            const kickFade = 1 - ((now - window.kickGlow.timestamp) / 400);
            const kickIntensity = window.kickGlow.intensity * kickFade;
            
            bassColor = bassColor.map(c => Math.min(255, c + (255 - c) * kickIntensity * 0.8));
            strokeOpacity = Math.min(1, strokeOpacity + kickIntensity * 0.6);
            shadowBlur = shadowBlur + kickIntensity * 40;
            lineWidth = lineWidth + kickIntensity * 6;
        }
        
        if (window.snareFlash && (now - window.snareFlash.timestamp) < 150) {
            const snareFade = 1 - ((now - window.snareFlash.timestamp) / 150);
            const snareIntensity = window.snareFlash.intensity * snareFade;
            
            const flashGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 450);
            const color = window.snareFlash.color;
            flashGradient.addColorStop(0, `rgba(${color.join(', ')}, ${snareIntensity * 0.1})`);
            flashGradient.addColorStop(0.5, `rgba(${color.join(', ')}, ${snareIntensity * 0.05})`);
            flashGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = flashGradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 450, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        ctx.strokeStyle = `rgba(${bassColor.join(', ')}, ${strokeOpacity})`;
        ctx.lineWidth = lineWidth;
        
        if (state.performanceMode !== 'low') {
            ctx.shadowColor = `rgba(${bassColor.join(', ')}, 0.8)`;
            ctx.shadowBlur = shadowBlur;
        }
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, bassAverage * 1.2, 0, 2 * Math.PI);
        ctx.stroke();
        
        if (state.performanceMode !== 'low') {
            ctx.shadowBlur = 0;
        }
        
        if (bassAverage > 100 && now - (window.lastBassKick || 0) > 300) {
            window.lastBassKick = now;
            elements.beatPulse.classList.add('active');
            setTimeout(() => elements.beatPulse.classList.remove('active'), 800);
        }
    }
};

// Main play control function
function togglePlay() {
    showMobileIcon(elements.centerPlayArea);
    
    if (state.isPlaying) {
        elements.audio.pause();
        state.isPlaying = false;
        state.isTransitioning = false;
        state.shouldUpdateLyrics = false;
        state.shouldUpdateBackground = false;
        
        ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
            elements[el].classList.remove('playing');
        });
        
        elements.speakerStatic.classList.remove('hidden');
        ui.hideLyrics();
        
        // DON'T disable visualizer immediately - let it transition naturally
        // The visualizer will continue running but with no audio data, creating the fade effect
        
        // Remove animation classes for performance after a delay
        setTimeout(() => {
            elements.songBackground.classList.remove('animating');
            if (state.isHomepageVisible) {
                // Keep visualizer running even when paused if homepage is visible
                // This maintains the transition effect you had before
            }
        }, 1000); // Give time for the transition
    } else {
        if (!isVisualizationInitialized) visualization.init();
        if (audioContext.state === 'suspended') audioContext.resume();
        
        const playPromise = elements.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                state.isPlaying = true;
                state.isTransitioning = false;
                state.shouldUpdateLyrics = state.isHomepageVisible;
                state.shouldUpdateBackground = state.isHomepageVisible;
                
                ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
                    elements[el].classList.add('playing');
                });
                
                elements.speakerStatic.classList.add('hidden');
                
                if (state.lyrics.loaded) ui.showLyrics();
                if (state.isHomepageVisible) scrollHandler.enableVisualizer();
            });
        } else {
            state.isPlaying = true;
            state.isTransitioning = false;
            state.shouldUpdateLyrics = state.isHomepageVisible;
            state.shouldUpdateBackground = state.isHomepageVisible;
            
            ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
                elements[el].classList.add('playing');
            });
            
            elements.speakerStatic.classList.add('hidden');
            
            if (state.lyrics.loaded) ui.showLyrics();
            if (state.isHomepageVisible) scrollHandler.enableVisualizer();
        }
    }
}

// Optimized audio event listeners
const optimizedProgressUpdate = throttle(() => {
    if (elements.audio.duration && !state.isDragging) {
        const progress = (elements.audio.currentTime / elements.audio.duration) * 100;
        elements.progressBar.style.width = progress + '%';
    }
}, 100); // Update progress at most 10 times per second

elements.audio.addEventListener('timeupdate', optimizedProgressUpdate);
elements.audio.addEventListener('ended', navigation.nextSong);

// Website Info Manager
const infoManager = {
    data: null,
    
    async loadInfo() {
        try {
            this.data = await utils.fetchJson('./Info.json');
            if (!this.data) {
                console.error('Failed to load Info.json');
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error loading website info:', error);
            return false;
        }
    },
    
    populateNavigation() {
        const navLogo = document.querySelector('.nav-logo');
        const navLinks = document.querySelector('.nav-links');
        
        if (navLogo && this.data.band) {
            navLogo.textContent = this.data.band.shortName;
        }
        
        if (navLinks && this.data.navigation) {
            navLinks.innerHTML = '';
            this.data.navigation.links.forEach(link => {
                const linkElement = document.createElement('a');
                linkElement.className = 'nav-link';
                linkElement.textContent = link.text;
                linkElement.onclick = () => scrollToSection(link.target);
                navLinks.appendChild(linkElement);
            });
        }
    },
    
    populateHomepage() {
        const bandTitle = document.getElementById('bandTitle');
        const pageTitle = document.querySelector('title');
        const favicon = document.querySelector('link[rel="icon"]');
        
        if (bandTitle && this.data.band) {
            bandTitle.innerHTML = this.data.band.tagline;
        }
        
        if (pageTitle && this.data.meta) {
            pageTitle.textContent = this.data.meta.title;
        }
        
        if (favicon && this.data.meta) {
            favicon.href = this.data.meta.favicon;
        }
    },
    
    populateAbout() {
        const aboutSection = document.getElementById('about');
        if (!aboutSection || !this.data.about) return;
        
        // Update title
        const title = aboutSection.querySelector('.section-title');
        if (title) title.textContent = this.data.about.title;
        
        // Update content
        const aboutText = aboutSection.querySelector('.about-text');
        if (aboutText) {
            aboutText.innerHTML = `
                <h3>${this.data.about.content.sound.title}</h3>
                <p>${this.data.about.content.sound.description}</p>
                
                <h3>${this.data.about.content.vision.title}</h3>
                <p>${this.data.about.content.vision.description}</p>
            `;
        }
        
        // Update band members
        const membersContainer = aboutSection.querySelector('.band-members');
        if (membersContainer) {
            membersContainer.innerHTML = '';
            this.data.about.members.forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'member';
                memberDiv.innerHTML = `
                    <div class="member-avatar">${member.avatar}</div>
                    <div class="member-name">${member.name}</div>
                    <div class="member-role">${member.role}</div>
                `;
                membersContainer.appendChild(memberDiv);
            });
        }
    },
    
    populateDates() {
        const datesSection = document.getElementById('dates');
        if (!datesSection || !this.data.dates) return;
        
        // Update title
        const title = datesSection.querySelector('.section-title');
        if (title) title.textContent = this.data.dates.title;
        
        // Update dates
        const datesContainer = datesSection.querySelector('.dates-container');
        if (datesContainer) {
            datesContainer.innerHTML = '';
            this.data.dates.shows.forEach(show => {
                const dateItem = document.createElement('div');
                dateItem.className = 'date-item';
                dateItem.innerHTML = `
                    <div class="date-info">
                        <div class="date">${show.date}</div>
                        <div class="year">${show.year}</div>
                    </div>
                    <div class="venue-info">
                        <div class="venue">${show.venue}</div>
                        <div class="location">${show.location}</div>
                    </div>
                    <div class="date-action">
                        <button class="ticket-btn">${show.ticketText}</button>
                    </div>
                `;
                datesContainer.appendChild(dateItem);
            });
        }
        
        // Update gallery
        const galleryTitle = datesSection.querySelector('.gallery-title');
        const galleryTrack = datesSection.querySelector('.gallery-track');
        
        if (galleryTitle) galleryTitle.textContent = this.data.dates.gallery.title;
        
        if (galleryTrack) {
            galleryTrack.innerHTML = '';
            this.data.dates.gallery.items.forEach(item => {
                const galleryItem = document.createElement('div');
                galleryItem.className = 'gallery-item';
                galleryItem.innerHTML = `
                    <div class="gallery-image" style="background: ${item.gradient};"></div>
                    <div class="gallery-caption">${item.caption}</div>
                `;
                galleryTrack.appendChild(galleryItem);
            });
        }
    },
    
    populateContact() {
        const contactSection = document.getElementById('contact');
        if (!contactSection || !this.data.contact) return;
        
        // Update title
        const title = contactSection.querySelector('.section-title');
        if (title) title.textContent = this.data.contact.title;
        
        // Update contact info
        const contactInfo = contactSection.querySelector('.contact-info');
        if (contactInfo) {
            contactInfo.innerHTML = '';
            this.data.contact.info.forEach(info => {
                const contactItem = document.createElement('div');
                contactItem.className = 'contact-item';
                contactItem.innerHTML = `
                    <h3>${info.title}</h3>
                    <p>${info.email}</p>
                `;
                contactInfo.appendChild(contactItem);
            });
        }
        
        // Update social links
        const socialTitle = contactSection.querySelector('.social-links h3');
        const socialGrid = contactSection.querySelector('.social-grid');
        
        if (socialTitle) socialTitle.textContent = this.data.contact.social.title;
        
        if (socialGrid) {
            socialGrid.innerHTML = '';
            this.data.contact.social.links.forEach(link => {
                const socialLink = document.createElement('a');
                socialLink.href = link.url;
                socialLink.className = 'social-link';
                socialLink.innerHTML = `
                    <span class="social-icon">${link.icon}</span>
                    <span class="social-name">${link.name}</span>
                `;
                socialGrid.appendChild(socialLink);
            });
        }
        
        // Update newsletter
        const newsletter = contactSection.querySelector('.newsletter');
        if (newsletter) {
            const newsletterData = this.data.contact.newsletter;
            newsletter.innerHTML = `
                <h3>${newsletterData.title}</h3>
                <p>${newsletterData.description}</p>
                <form class="newsletter-form" id="newsletterForm">
                    <input type="email" placeholder="${newsletterData.placeholder}" class="newsletter-input" required>
                    <button type="submit" class="newsletter-btn">${newsletterData.buttonText}</button>
                </form>
            `;
        }
    },
    
    updateTicketButtons() {
        // Re-attach event listeners to ticket buttons after they're created
        const ticketButtons = document.querySelectorAll('.ticket-btn');
        ticketButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const originalText = btn.textContent;
                btn.textContent = 'REDIRECTING...';
                btn.disabled = true;
                
                setTimeout(() => {
                    btn.textContent = 'SOLD OUT';
                    btn.disabled = false;
                }, 1000);
            });
        });
    },
    
    updateNewsletterForm() {
        // Re-attach newsletter form handler
        const newsletterForm = document.getElementById('newsletterForm');
        if (newsletterForm && this.data.contact.newsletter) {
            const newsletterData = this.data.contact.newsletter;
            newsletterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = e.target.querySelector('.newsletter-input').value;
                
                const btn = e.target.querySelector('.newsletter-btn');
                const originalText = btn.textContent;
                
                btn.textContent = newsletterData.subscribingText;
                btn.disabled = true;
                
                setTimeout(() => {
                    btn.textContent = newsletterData.subscribedText;
                    e.target.querySelector('.newsletter-input').value = '';
                    
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }, 2000);
                }, 1000);
            });
        }
    },
    
    async populateAll() {
        const loaded = await this.loadInfo();
        if (!loaded) return false;
        
        this.populateNavigation();
        this.populateHomepage();
        this.populateAbout();
        this.populateDates();
        this.populateContact();
        
        // Re-attach event listeners after populating content
        setTimeout(() => {
            this.updateTicketButtons();
            this.updateNewsletterForm();
        }, 100);
        
        return true;
    }
};

// Initialize application
async function initializeApp() {
    detectMobile();
    
    if (state.isMobile) {
        preventZoom();
    }
    
    // Load website info first
    const infoLoaded = await infoManager.populateAll();
    if (!infoLoaded) {
        console.warn('Website info could not be loaded, using default content');
    }
    
    state.songs = await songManager.discoverSongs();
    
    if (state.songs.length === 0) {
        console.error('No songs found! Make sure you have Data.json files in your song folders.');
        return;
    }
    
    await songManager.loadCurrentSong();
    lyrics.init();
    events.setupGestureControls();
    
    // Cache homepage element for performance
    elements.homepage = document.querySelector('.homepage');
    
    // IMPORTANT: Properly initialize state based on current scroll position
    const currentScrollY = window.scrollY;
    const scrolled = currentScrollY > 50;
    const isHomepageVisible = currentScrollY < window.innerHeight * 0.7;
    
    // Set initial states correctly
    state.isScrolled = scrolled;
    state.isHomepageVisible = isHomepageVisible;
    
    // Apply initial classes based on actual scroll position
    elements.navOverlay.classList.toggle('scrolled', scrolled);
    elements.scrollIndicator.classList.toggle('hidden', scrolled);
    elements.songInfo.classList.toggle('scrolled', scrolled);
    
    // Only enable visualizer if actually on homepage
    if (isHomepageVisible) {
        scrollHandler.enableFullVisualizer();
    } else {
        // Make sure visualizer is properly disabled if not on homepage
        scrollHandler.disableVisualizer();
    }
    
    // Initialize scroll handler AFTER setting initial state
    scrollHandler.init();
    gallery.init();
    
    if (!state.isMobile) {
        const titleHoverHandler = throttle(() => {
            if (!state.isPlaying) {
                elements.bandTitle.style.transform = 'scale(1.015)';
                elements.bandTitle.style.textShadow = '0 0 70px rgba(255, 255, 255, 0.4)';
            }
        }, 100);
        
        const titleLeaveHandler = throttle(() => {
            if (!state.isPlaying) {
                elements.bandTitle.style.transform = 'scale(1)';
                elements.bandTitle.style.textShadow = '0 0 40px rgba(255, 255, 255, 0.25)';
            }
        }, 100);
        
        elements.bandTitle.addEventListener('mouseenter', titleHoverHandler);
        elements.bandTitle.addEventListener('mouseleave', titleLeaveHandler);
    }
}

// Global variable for lyrics display
let lyricsDisplay;

// Start the application
initializeApp().then(() => {
    lyricsDisplay = lyrics.display;
});

// Optimized event listeners
document.addEventListener('DOMContentLoaded', () => {
    const ticketButtons = document.querySelectorAll('.ticket-btn');
    ticketButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const originalText = btn.textContent;
            btn.textContent = 'REDIRECTING...';
            btn.disabled = true;
            
            setTimeout(() => {
                btn.textContent = 'SOLD OUT';
                btn.disabled = false;
            }, 1000);
        });
    });
});

// Optimized resize handler for gallery
const galleryResizeHandler = debounce(() => {
    state.currentGalleryIndex = 0;
    if (elements.galleryTrack) {
        elements.galleryTrack.style.transform = 'translateX(0px)';
    }
}, 250);

window.addEventListener('resize', galleryResizeHandler);

// Optimized keyboard navigation
const keyboardHandler = throttle((e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.key) {
        case ' ':
            e.preventDefault();
            togglePlay();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            navigation.previousSong();
            break;
        case 'ArrowRight':
            e.preventDefault();
            navigation.nextSong();
            break;
        case 'Escape':
            window.scrollTo({ top: 0, behavior: 'smooth' });
            break;
    }
}, 100);

document.addEventListener('keydown', keyboardHandler);

// Page visibility API for performance optimization
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, reduce performance
        state.shouldUpdateLyrics = false;
        state.shouldUpdateBackground = false;
        scrollHandler.disableVisualizer();
    } else {
        // Page is visible, restore performance
        if (state.isPlaying && state.isHomepageVisible) {
            state.shouldUpdateLyrics = true;
            state.shouldUpdateBackground = true;
            scrollHandler.enableVisualizer();
        }
    }
});

// Memory cleanup on unload
window.addEventListener('beforeunload', () => {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (audioContext) {
        audioContext.close();
    }
});