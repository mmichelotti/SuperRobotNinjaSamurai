import { state, elements } from './state.js';

// Lyrics system
export const lyricsManager = {
    lyricsDisplay: null,

    init() {
        this.lyricsDisplay = this.createLyricsDisplay();
        // Make display available globally for audio visualization
        window.lyricsManagerDisplay = this.lyricsDisplay;
        window.lyricsManagerUpdate = () => this.update();
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
        
        // Find container element or create one if it doesn't exist
        let containerElement = document.querySelector('.container');
        if (!containerElement) {
            containerElement = document.body;
        }
        containerElement.appendChild(container);
        
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

    showLyrics() {
        if (state.lyrics.loaded && state.isHomepageVisible) {
            elements.bandTitle.style.opacity = '0';
            elements.bandTitle.style.transform = 'scale(0.95)';
            setTimeout(() => { 
                this.lyricsDisplay.container.style.opacity = '1'; 
            }, 400);
        }
    },

    hideLyrics() {
        this.lyricsDisplay.container.style.opacity = '0';
        
        if (!state.isPlaying) {
            setTimeout(() => {
                elements.bandTitle.style.opacity = '0.95';
                elements.bandTitle.style.transform = 'scale(1)';
            }, 400);
        }
        
        setTimeout(() => {
            this.lyricsDisplay.text.textContent = '';
            state.lyrics.index = -1;
        }, 800);
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
                this.lyricsDisplay.container.style.opacity = '0';
                setTimeout(() => {
                    this.lyricsDisplay.text.textContent = '';
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
        this.lyricsDisplay.text.style.opacity = '0';
        
        setTimeout(() => {
            this.lyricsDisplay.text.textContent = '';
            this.lyricsDisplay.text.style.opacity = '1';
        }, 300);
    },

    showText(lyric) {
        elements.bandTitle.style.opacity = '0';
        elements.bandTitle.style.transform = 'scale(0.95)';
        this.lyricsDisplay.text.style.opacity = '0';
        
        setTimeout(() => {
            this.lyricsDisplay.text.textContent = lyric.text;
            this.lyricsDisplay.text.style.opacity = (state.isHoveringCenter && !state.isMobile) ? '0.3' : '1';
            this.lyricsDisplay.container.style.opacity = '1';
            
            this.applyLyricStyling(this.lyricsDisplay.text, lyric.style, state.currentSongData.palette);
            
            if (state.isHoveringCenter && !state.isMobile) {
                this.lyricsDisplay.text.style.opacity = '0.3';
            }
        }, 300);
    }
};