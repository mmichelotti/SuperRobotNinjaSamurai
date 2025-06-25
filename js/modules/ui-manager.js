import { state, elements } from './state.js';
import { songManager } from './song-manager.js';
import { lyricsManager } from './lyrics-manager.js';

// Volume control
export const volumeControl = {
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

// UI management
export const ui = {
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

    goToSong(index) {
        if (state.isPlaying && state.lyrics.loaded) {
            lyricsManager.hideLyrics();
        }
        
        const wasPlaying = state.isPlaying;
        
        state.currentSongIndex = index;
        songManager.loadCurrentSong().then(() => {
            this.updateSongIndicators();
            
            if (wasPlaying) {
                elements.audio.play().then(() => {
                    elements.speakerStatic.classList.add('hidden');
                    if (state.lyrics.loaded) {
                        setTimeout(() => lyricsManager.showLyrics(), 500);
                    }
                });
            } else {
                elements.speakerStatic.classList.remove('hidden');
            }
        });
    }
};

// Navigation
export const navigation = {
    nextSong() { ui.goToSong((state.currentSongIndex + 1) % state.songs.length); },
    previousSong() { ui.goToSong((state.currentSongIndex - 1 + state.songs.length) % state.songs.length); }
};