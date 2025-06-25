// State management
const state = {
    songs: [],
    currentSongIndex: 0,
    isPlaying: false,
    currentSongData: { title: "", palette: { mid: [255, 255, 255], high: [255, 255, 255] } },
    lyrics: { current: [], index: 0, loaded: false },
    touch: { startX: 0, startY: 0, startTime: 0 },
    isHoveringCenter: false,
    isDragging: false,
    isMobile: false,
    currentGalleryIndex: 0,
    currentVideoCarouselIndex: 0,
    isHomepageVisible: true,
    isScrolled: false,
    volume: 1.0
};

// Beat detection state
const beatDetection = {
    history: { bass: [], mid: [], treble: [], energy: [] },
    thresholds: { bass: 0, mid: 0, treble: 0 },
    lastTrigger: { kick: 0, snare: 0, hihat: 0 },
    adaptiveSensitivity: 1.0
};

// Audio and visualization
let audioContext, analyser, source, dataArray, bufferLength, canvas, ctx, animationId;
let isVisualizationInitialized = false;

// Gallery auto-advance
let galleryAutoAdvanceTimeout;

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
    volumeControl: document.getElementById('volumeControl'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeFill: document.getElementById('volumeFill'),
    // Gallery elements
    galleryMainDisplay: document.getElementById('galleryMainDisplay'),
    galleryMainImage: document.getElementById('galleryMainImage'),
    galleryMainPrev: document.getElementById('galleryMainPrev'),
    galleryMainNext: document.getElementById('galleryMainNext'),
    videoCarouselTrack: document.getElementById('videoCarouselTrack'),
    videoCarouselPrev: document.getElementById('videoCarouselPrev'),
    videoCarouselNext: document.getElementById('videoCarouselNext')
};

// Utility functions
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

// Mobile detection and prevention
function detectMobile() {
    state.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || 
                    (window.matchMedia && window.matchMedia("(hover: none)").matches);
}

function preventZoom() {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    document.addEventListener('touchmove', function(event) {
        if (event.scale !== 1) {
            event.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('wheel', function(event) {
        if (event.ctrlKey) {
            event.preventDefault();
        }
    }, { passive: false });
}

function showMobileIcon(element) {
    if (!state.isMobile) return;
    element.classList.add('mobile-click');
    setTimeout(() => element.classList.remove('mobile-click'), 300);
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

// Volume control
const volumeControl = {
    init() {
        elements.volumeSlider.addEventListener('input', this.handleVolumeChange);
        elements.volumeSlider.addEventListener('change', this.handleVolumeChange);
        
        // Initialize volume
        state.volume = elements.volumeSlider.value / 100;
        elements.audio.volume = state.volume;
        this.updateVolumeDisplay();
    },

    handleVolumeChange(e) {
        state.volume = e.target.value / 100;
        elements.audio.volume = state.volume;
        volumeControl.updateVolumeDisplay();
    },

    updateVolumeDisplay() {
        const percentage = Math.round(state.volume * 100);
        elements.volumeFill.style.width = percentage + '%';
    }
};

// Gallery management - REFACTORED for full screen
const galleryManager = {
    images: [],
    videos: [],
    
    async init(galleryData) {
        this.videos = galleryData.videos || [];
        
        // Dynamically discover gallery images
        await this.discoverGalleryImages();
        
        this.createVideoCarousel();
        this.attachGalleryNavigation();
        this.loadCurrentImage();
        this.startAutoAdvance();
    },
    
    async discoverGalleryImages() {
        this.images = [];
        let imageNumber = 1;
        
        while (true) {
            const imagePath = `./assets/gallery/Gallery${imageNumber.toString().padStart(2, '0')}.png`;
            
            try {
                const imageExists = await this.checkImageExists(imagePath);
                if (imageExists) {
                    this.images.push({
                        src: imagePath,
                        alt: `Gallery Image ${imageNumber}`
                    });
                    imageNumber++;
                } else {
                    break; // No more images found
                }
            } catch (error) {
                break; // Stop on any error
            }
        }
        
        console.log(`Found ${this.images.length} gallery images`);
    },
    
    checkImageExists(imagePath) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = imagePath;
        });
    },
    
    attachGalleryNavigation() {
        if (elements.galleryMainPrev) {
            elements.galleryMainPrev.addEventListener('click', () => {
                this.previousImage();
            });
        }
        
        if (elements.galleryMainNext) {
            elements.galleryMainNext.addEventListener('click', () => {
                this.nextImage();
            });
        }
    },
    
    createVideoCarousel() {
        if (!elements.videoCarouselTrack) return;
        
        elements.videoCarouselTrack.innerHTML = '';
        
        this.videos.forEach(video => {
            const item = document.createElement('div');
            item.className = 'video-carousel-item';
            
            if (video.link && video.link !== '#') {
                item.innerHTML = `
                    <div class="video-carousel-video">
                        <iframe 
                            src="${video.link}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    </div>
                    <div class="video-carousel-caption">${video.caption}</div>
                `;
            } else {
                item.innerHTML = `
                    <div class="video-carousel-image" style="background: ${video.gradient};"></div>
                    <div class="video-carousel-caption">${video.caption}</div>
                `;
            }
            
            elements.videoCarouselTrack.appendChild(item);
        });
        
        // Attach video carousel navigation
        if (elements.videoCarouselPrev) {
            elements.videoCarouselPrev.addEventListener('click', () => {
                this.scrollVideoCarousel(-1);
            });
        }
        
        if (elements.videoCarouselNext) {
            elements.videoCarouselNext.addEventListener('click', () => {
                this.scrollVideoCarousel(1);
            });
        }
    },
    
    scrollVideoCarousel(direction) {
        const track = elements.videoCarouselTrack;
        const itemWidth = 320; // 300px + 20px gap
        const maxScroll = (this.videos.length - 3) * itemWidth;
        
        state.currentVideoCarouselIndex = Math.max(0, Math.min(
            this.videos.length - 3,
            state.currentVideoCarouselIndex + direction
        ));
        
        track.style.transform = `translateX(-${state.currentVideoCarouselIndex * itemWidth}px)`;
    },
    
    loadCurrentImage() {
        if (!elements.galleryMainImage || !this.images[state.currentGalleryIndex]) return;
        
        const currentImage = this.images[state.currentGalleryIndex];
        
        // Start transition
        elements.galleryMainImage.classList.add('changing');
        
        // Load image
        const testImage = new Image();
        
        testImage.onload = () => {
            setTimeout(() => {
                elements.galleryMainImage.style.backgroundImage = `url('${currentImage.src}')`;
                elements.galleryMainImage.classList.remove('changing');
                elements.galleryMainImage.classList.add('loaded');
            }, 600);
        };
        
        testImage.onerror = () => {
            setTimeout(() => {
                elements.galleryMainImage.style.backgroundImage = 'linear-gradient(45deg, #333, #666)';
                elements.galleryMainImage.classList.remove('changing');
                elements.galleryMainImage.classList.add('loaded');
            }, 600);
        };
        
        testImage.src = currentImage.src;
    },
    
    nextImage() {
        if (this.images.length <= 1) return;
        
        const nextIndex = (state.currentGalleryIndex + 1) % this.images.length;
        state.currentGalleryIndex = nextIndex;
        this.loadCurrentImage();
        this.startAutoAdvance();
    },
    
    previousImage() {
        if (this.images.length <= 1) return;
        
        const prevIndex = (state.currentGalleryIndex - 1 + this.images.length) % this.images.length;
        state.currentGalleryIndex = prevIndex;
        this.loadCurrentImage();
        this.startAutoAdvance();
    },
    
    startAutoAdvance() {
        clearTimeout(galleryAutoAdvanceTimeout);
        if (this.images.length > 1) {
            galleryAutoAdvanceTimeout = setTimeout(() => this.autoAdvance(), 8000); // Increased to 8 seconds for better viewing
        }
    },
    
    autoAdvance() {
        this.nextImage();
    }
};

// Song management
const songManager = {
    async loadSongsList() {
        return await utils.fetchJson('./assets/songs/SongData.json') || [];
    },

    applyBackgroundEffects() {
        const brightness = state.currentSongData.backgroundBrightness || 0.85;
        elements.songBackground.style.setProperty('--background-overlay-opacity', brightness);
        
        const palette = state.currentSongData.palette;
        const tintColor = palette.mid || [255, 255, 255];
        const [hue] = utils.rgbToHsl(tintColor[0], tintColor[1], tintColor[2]);
        
        elements.songBackground.style.filter = `sepia(1) saturate(1.5) hue-rotate(${hue - 60}deg) brightness(0.8) contrast(1.2)`;
        
        document.documentElement.style.setProperty('--bg-tint-r', tintColor[0]);
        document.documentElement.style.setProperty('--bg-tint-g', tintColor[1]);
        document.documentElement.style.setProperty('--bg-tint-b', tintColor[2]);
        
        const shadowColor = `rgba(${tintColor[0]}, ${tintColor[1]}, ${tintColor[2]}, 0.6)`;
        document.querySelectorAll('.section-title').forEach(header => {
            header.style.textShadow = `0 0 40px ${shadowColor}, 0 0 20px ${shadowColor}`;
        });
    },

    async discoverSongs() {
        const folderNames = await this.loadSongsList();
        const discoveredSongs = [];
        
        for (const folderName of folderNames) {
            const data = await utils.fetchJson(`./assets/songs/${folderName}/Data.json`);
            if (data) {
                discoveredSongs.push({ folder: folderName, title: folderName, ...data });
            }
        }
        return discoveredSongs;
    },

    async loadMetadata(folderName) {
        const metadata = await utils.fetchJson(`./assets/songs/${folderName}/Data.json`);
        state.currentSongData = {
            title: folderName,
            palette: { mid: [255, 255, 255], high: [255, 255, 255] },
            backgroundBrightness: 0.85,
            ...metadata
        };
    },

    async loadLyrics() {
        if (!state.isHomepageVisible) return;
        
        const folderName = state.songs[state.currentSongIndex].folder;
        const lrcContent = await utils.fetchText(`./assets/songs/${folderName}/Lyrics.lrc`);
        
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
        elements.audio.src = `./assets/songs/${folderName}/Song.mp3`;
        elements.audio.volume = state.volume;
        elements.songTitle.textContent = state.currentSongData.title;
        elements.progressBar.style.width = '0%';
        
        this.loadSongBackground(folderName);
        this.initializeBeatDetection();
        await this.loadLyrics();
    },

    loadSongBackground(folderName) {
        const backgroundPath = `./assets/songs/${folderName}/background.png`;
        const testImage = new Image();
        
        // Start fade out with subtle zoom
        elements.songBackground.classList.add('changing');
        
        testImage.onload = () => {
            setTimeout(() => {
                // Change background image
                elements.songBackground.style.backgroundImage = `url('${backgroundPath}')`;
                elements.songBackground.classList.remove('changing');
                elements.songBackground.classList.add('loaded');
                this.applyBackgroundEffects();
            }, 400); // Wait for fade out
        };
        
        testImage.onerror = () => {
            setTimeout(() => {
                elements.songBackground.style.backgroundImage = 'none';
                elements.songBackground.classList.remove('changing', 'loaded');
            }, 400);
        };
        
        testImage.src = backgroundPath;
    },

    initializeBeatDetection() {
        beatDetection.history.bass = new Array(20).fill(0);
        beatDetection.history.mid = new Array(15).fill(0);
        beatDetection.history.treble = new Array(10).fill(0);
        beatDetection.history.energy = new Array(30).fill(0);
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
            pointer-events: none; width: 100vw; display: flex; justify-content: center;
            align-items: center; touch-action: manipulation;
        `;
        
        const text = document.createElement('div');
        text.id = 'lyricsText';
        text.style.cssText = `
            font-size: clamp(1rem, 2vw, 2.2rem); font-weight: 300; color: #fff;
            letter-spacing: 0.15em; line-height: 1.4; text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
            font-family: 'Inter', sans-serif; filter: blur(0px); transition: all 0.6s ease; 
            text-transform: uppercase; opacity: 0.9; text-align: center; touch-action: manipulation;
            max-width: 90vw; padding: 0 5vw;
            ${state.isMobile ? 'white-space: normal; word-break: break-word;' : 'white-space: nowrap;'}
        `;
        
        container.appendChild(text);
        document.querySelector('.container').appendChild(container);
        return { container, text };
    },

    applyLyricStyling(element, styleMode, palette) {
        element.style.animation = 'none';
        
        Object.assign(element.style, {
            fontSize: 'clamp(1rem, 2vw, 2.2rem)',
            letterSpacing: '0.15em',
            transform: 'scale(1)',
            maxWidth: '90vw',
            padding: '0 5vw',
            whiteSpace: state.isMobile ? 'normal' : 'nowrap',
            wordBreak: state.isMobile ? 'break-word' : 'normal'
        });
        
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
        
        state.currentSongIndex = index;
        songManager.loadCurrentSong().then(() => {
            this.updateSongIndicators();
            
            if (wasPlaying) {
                elements.audio.play().then(() => {
                    elements.speakerStatic.classList.add('hidden');
                    if (state.lyrics.loaded) {
                        setTimeout(() => this.showLyrics(), 500);
                    }
                });
            } else {
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
        
        if (!state.isPlaying) {
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

// Navigation
const navigation = {
    nextSong() { ui.goToSong((state.currentSongIndex + 1) % state.songs.length); },
    previousSong() { ui.goToSong((state.currentSongIndex - 1 + state.songs.length) % state.songs.length); }
};

// Scroll handling
const scrollHandler = {
    init() {
        
        window.addEventListener('scroll', throttle(() => {
        const scrolled = window.scrollY > 50;
        const isHomepageVisible = window.scrollY < window.innerHeight * 0.7;
        
        if (state.isHomepageVisible !== isHomepageVisible) {
            state.isHomepageVisible = isHomepageVisible;
        }
        
        if (scrolled !== state.isScrolled) {
            state.isScrolled = scrolled;
            elements.navOverlay.classList.toggle('scrolled', scrolled);
            elements.scrollIndicator.classList.toggle('hidden', scrolled);
            elements.songInfo.classList.toggle('scrolled', scrolled);
            elements.volumeControl.classList.toggle('scrolled', scrolled);
        }
        
        const isAtBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 100;
        const footerOverlay = document.getElementById('footerOverlay');
        
        if (footerOverlay) {
            footerOverlay.classList.toggle('visible', isAtBottom);
        }
    }, 16), { passive: true });
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        }, { threshold: 0.3 });

        document.querySelectorAll('.section').forEach(section => observer.observe(section));
    }
};

// Event handlers
const events = {
    setupGestureControls() {
        document.addEventListener('touchstart', (e) => {
            state.touch.startX = e.touches[0].clientX;
            state.touch.startY = e.touches[0].clientY;
            state.touch.startTime = Date.now();
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!state.touch.startX || !state.touch.startY) return;
            
            const diffX = state.touch.startX - e.touches[0].clientX;
            const diffY = state.touch.startY - e.touches[0].clientY;
            
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
                e.preventDefault();
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (!state.touch.startX || !state.touch.startY) return;
            
            const diffX = state.touch.startX - e.changedTouches[0].clientX;
            const timeDiff = Date.now() - state.touch.startTime;
            
            if (Math.abs(diffX) > 50 && timeDiff < 300) {
                diffX > 0 ? navigation.nextSong() : navigation.previousSong();
            }
            
            state.touch = { startX: 0, startY: 0, startTime: 0 };
        }, { passive: false });

        document.addEventListener('wheel', (e) => {
            if (window.scrollY === 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                e.deltaX > 0 ? navigation.nextSong() : navigation.previousSong();
            }
        }, { passive: false });
        
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

// Beat effects
const beatEffects = {
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
        
        if (state.lyrics.loaded && state.isPlaying && lyricsDisplay.text.textContent) {
            const originalTransform = lyricsDisplay.text.style.transform;
            lyricsDisplay.text.style.transform = `${originalTransform} scale(${1 + intensity * 0.03})`;
            setTimeout(() => { lyricsDisplay.text.style.transform = originalTransform; }, 150);
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

// Visualization
const visualization = {
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

    visualize() {
        if (!state.isHomepageVisible) {
            animationId = requestAnimationFrame(() => this.visualize());
            return;
        }
        
        animationId = requestAnimationFrame(() => this.visualize());
        
        analyser.getByteFrequencyData(dataArray);
        
        if (state.isPlaying) {
            lyrics.update();
        }
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
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
            this.drawBackground(centerX, centerY, average);
        }
        
        this.drawSpectrum(centerX, centerY);
        this.drawBassCircle(centerX, centerY, bassAverage);
    },

    drawBackground(centerX, centerY, average) {
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
        
        for (let i = 0; i < bufferLength; i++) {
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
                const color = state.currentSongData.palette.mid;
                const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                gradient.addColorStop(0, `rgba(${color.join(', ')}, ${intensity * 0.5})`);
                gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                
                ctx.shadowColor = `rgba(${color.join(', ')}, 0.4)`;
                ctx.shadowBlur = intensity * 6;
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 2 + intensity * 4;
            } else {
                const color = state.currentSongData.palette.high;
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
        ctx.shadowColor = `rgba(${bassColor.join(', ')}, 0.8)`;
        ctx.shadowBlur = shadowBlur;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, bassAverage * 1.2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        if (bassAverage > 100 && now - (window.lastBassKick || 0) > 300) {
            window.lastBassKick = now;
            elements.beatPulse.classList.add('active');
            setTimeout(() => elements.beatPulse.classList.remove('active'), 800);
        }
    }
};

// Website Info Manager
const infoManager = {
    data: null,
    
    async loadInfo() {
        try {
            this.data = await utils.fetchJson('./Info.json');
            return !!this.data;
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
    
    populateContent() {
        if (!this.data) return;
        
        // Homepage
        const bandTitle = document.getElementById('bandTitle');
        const pageTitle = document.querySelector('title');
        const favicon = document.querySelector('link[rel="icon"]');
        
        if (bandTitle && this.data.band) bandTitle.innerHTML = this.data.band.tagline;
        if (pageTitle && this.data.meta) pageTitle.textContent = this.data.meta.title;
        if (favicon && this.data.meta) favicon.href = this.data.meta.favicon;
        
        // About section
        const aboutSection = document.getElementById('about');
        if (aboutSection && this.data.about) {
            const title = aboutSection.querySelector('.section-title');
            if (title) title.textContent = this.data.about.title;
            
            const aboutText = aboutSection.querySelector('.about-text');
            if (aboutText) {
                aboutText.innerHTML = `
                    <h3>${this.data.about.content.sound.title}</h3>
                    <p>${this.data.about.content.sound.description}</p>
                    <h3>${this.data.about.content.vision.title}</h3>
                    <p>${this.data.about.content.vision.description}</p>
                `;
            }
            
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
        }
        
        // Dates section
        const datesSection = document.getElementById('dates');
        if (datesSection && this.data.dates) {
            const title = datesSection.querySelector('.section-title');
            if (title) title.textContent = this.data.dates.title;
            
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
        }
        
        // Gallery section
        const gallerySection = document.getElementById('gallery');
        if (gallerySection && this.data.gallery) {
            const title = gallerySection.querySelector('.section-title');
            if (title) title.textContent = this.data.gallery.title;
            
            // Initialize gallery manager with data
            galleryManager.init(this.data.gallery);
        }
        
        // Contact section
        const contactSection = document.getElementById('contact');
        if (contactSection && this.data.contact) {
            const title = contactSection.querySelector('.section-title');
            if (title) title.textContent = this.data.contact.title;
            
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
        }
    },
    
    populateFooter() {
    if (!this.data || !this.data.footer) return;
    
    const footerInfo = document.querySelector('.footer-info');
    const footerLinks = document.querySelector('.footer-links');
    
    if (footerInfo) {
        footerInfo.innerHTML = '';
        this.data.footer.leftText.forEach(text => {
            const p = document.createElement('p');
            p.textContent = text;
            footerInfo.appendChild(p);
        });
    }
    
    if (footerLinks) {
        footerLinks.textContent = this.data.footer.rightText;
    }
},
    
    attachEventListeners() {
        // Ticket buttons
        document.querySelectorAll('.ticket-btn').forEach(btn => {
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
    
    async populateAll() {
        const loaded = await this.loadInfo();
        if (!loaded) return false;
        
        this.populateNavigation();
        this.populateContent();
        this.populateFooter();
        
        setTimeout(() => this.attachEventListeners(), 100);
        return true;
    }
};

// Main play control
function togglePlay() {
    showMobileIcon(elements.centerPlayArea);
    
    if (state.isPlaying) {
        elements.audio.pause();
        state.isPlaying = false;
        
        ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
            elements[el].classList.remove('playing');
        });
        
        elements.speakerStatic.classList.remove('hidden');
        ui.hideLyrics();
    } else {
        if (!isVisualizationInitialized) visualization.init();
        if (audioContext.state === 'suspended') audioContext.resume();
        
        const playPromise = elements.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                state.isPlaying = true;
                
                ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
                    elements[el].classList.add('playing');
                });
                
                elements.speakerStatic.classList.add('hidden');
                if (state.lyrics.loaded) ui.showLyrics();
            });
        } else {
            state.isPlaying = true;
            
            ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
                elements[el].classList.add('playing');
            });
            
            elements.speakerStatic.classList.add('hidden');
            if (state.lyrics.loaded) ui.showLyrics();
        }
    }
}

// Global navigation - GENERALIZED with automatic offset calculation
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    // Get the section's position
    const elementPosition = section.getBoundingClientRect().top + window.pageYOffset;
    
    // Smooth scroll to the calculated position
    window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
    });
}

// Initialize application
async function initializeApp() {
    detectMobile();
    if (state.isMobile) preventZoom();
    
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
    volumeControl.init();
    events.setupGestureControls();
    
    const currentScrollY = window.scrollY;
    state.isScrolled = currentScrollY > 50;
    state.isHomepageVisible = currentScrollY < window.innerHeight * 0.7;
    
    elements.navOverlay.classList.toggle('scrolled', state.isScrolled);
    elements.scrollIndicator.classList.toggle('hidden', state.isScrolled);
    elements.songInfo.classList.toggle('scrolled', state.isScrolled);
    elements.volumeControl.classList.toggle('scrolled', state.isScrolled);
    
    scrollHandler.init();
    
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

// Audio event listeners
elements.audio.addEventListener('timeupdate', throttle(() => {
    if (elements.audio.duration && !state.isDragging) {
        const progress = (elements.audio.currentTime / elements.audio.duration) * 100;
        elements.progressBar.style.width = progress + '%';
    }
}, 100));

elements.audio.addEventListener('ended', navigation.nextSong);

// Keyboard navigation
document.addEventListener('keydown', throttle((e) => {
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
        case 'ArrowUp':
            e.preventDefault();
            state.volume = Math.min(1, state.volume + 0.1);
            elements.audio.volume = state.volume;
            elements.volumeSlider.value = state.volume * 100;
            volumeControl.updateVolumeDisplay();
            break;
        case 'ArrowDown':
            e.preventDefault();
            state.volume = Math.max(0, state.volume - 0.1);
            elements.audio.volume = state.volume;
            elements.volumeSlider.value = state.volume * 100;
            volumeControl.updateVolumeDisplay();
            break;
    }
}, 100));

// Memory cleanup
window.addEventListener('beforeunload', () => {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (audioContext) {
        audioContext.close();
    }
    clearTimeout(galleryAutoAdvanceTimeout);
});

// Start the application
initializeApp().then(() => {
    lyricsDisplay = lyrics.display;
});