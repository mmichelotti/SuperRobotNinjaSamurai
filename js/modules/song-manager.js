import { state, beatDetection, elements } from './state.js';
import { utils } from './utils.js';

// Song management
export const songManager = {
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
        const backgroundPath = `./assets/songs/${folderName}/background.webp`;
        const testImage = new Image();
        
        elements.songBackground.classList.add('changing');
        
        testImage.onload = () => {
            setTimeout(() => {
                elements.songBackground.style.backgroundImage = `url('${backgroundPath}')`;
                elements.songBackground.classList.remove('changing');
                elements.songBackground.classList.add('loaded');
                this.applyBackgroundEffects();
            }, 400);
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