// Import all modules
import { state, elements, animationId, audioContext, galleryAutoAdvanceTimeout, isVisualizationInitialized } from './modules/state.js';
import { detectMobile, preventZoom, showMobileIcon, throttle } from './modules/utils.js';
import { visualization } from './modules/audio-visualization.js';
import { songManager } from './modules/song-manager.js';
import { lyricsManager } from './modules/lyrics-manager.js';
import { ui, volumeControl, navigation } from './modules/ui-manager.js';
import { infoManager } from './modules/info-manager.js';
import { events, scrollHandler } from './modules/event-handlers.js';

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
        lyricsManager.hideLyrics();
    } else {
        if (!isVisualizationInitialized) visualization.init();
        if (audioContext && audioContext.state === 'suspended') audioContext.resume();
        
        const playPromise = elements.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                state.isPlaying = true;
                
                ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
                    elements[el].classList.add('playing');
                });
                
                elements.speakerStatic.classList.add('hidden');
                if (state.lyrics.loaded) lyricsManager.showLyrics();
            }).catch(error => {
                console.error('Error playing audio:', error);
            });
        } else {
            state.isPlaying = true;
            
            ['bandTitle', 'songInfo', 'songTitle', 'centerPlayArea'].forEach(el => {
                elements[el].classList.add('playing');
            });
            
            elements.speakerStatic.classList.add('hidden');
            if (state.lyrics.loaded) lyricsManager.showLyrics();
        }
    }
}

// Initialize application
async function initializeApp() {
    console.log('Starting app initialization...');
    
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
    lyricsManager.init();
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
    
    console.log('App initialization complete!');
}

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

// Make functions globally available for HTML
window.togglePlay = togglePlay;
window.scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    // Get the section's position
    const elementPosition = section.getBoundingClientRect().top + window.pageYOffset;
    
    // Smooth scroll to the calculated position
    window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
    });
};

// Start the application
initializeApp();