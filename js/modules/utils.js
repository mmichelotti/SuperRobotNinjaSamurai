import { state } from './state.js';

// Utility functions
export const throttle = (func, delay) => {
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

export const debounce = (func, delay) => {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
};

// Mobile detection and prevention
export function detectMobile() {
    state.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || 
                    (window.matchMedia && window.matchMedia("(hover: none)").matches);
}

export function preventZoom() {
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

export function showMobileIcon(element) {
    if (!state.isMobile) return;
    element.classList.add('mobile-click');
    setTimeout(() => element.classList.remove('mobile-click'), 300);
}

// Utility functions
export const utils = {
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