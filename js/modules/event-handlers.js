import { state, elements } from './state.js';
import { throttle, showMobileIcon } from './utils.js';
import { navigation, ui } from './ui-manager.js';
import { lyricsManager } from './lyrics-manager.js';

// Scroll handling
export const scrollHandler = {
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
export const events = {
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
                if (state.isPlaying && state.lyrics.loaded && lyricsManager.lyricsDisplay.text.textContent) {
                    lyricsManager.lyricsDisplay.text.style.opacity = '0.3';
                }
            });
            
            elements.centerPlayArea.addEventListener('mouseleave', () => {
                state.isHoveringCenter = false;
                if (state.isPlaying && state.lyrics.loaded) {
                    lyricsManager.lyricsDisplay.text.style.opacity = '0.9';
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