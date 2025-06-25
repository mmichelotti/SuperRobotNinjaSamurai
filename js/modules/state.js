// Global application state
export const state = {
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
export const beatDetection = {
    history: { bass: [], mid: [], treble: [], energy: [] },
    thresholds: { bass: 0, mid: 0, treble: 0 },
    lastTrigger: { kick: 0, snare: 0, hihat: 0 },
    adaptiveSensitivity: 1.0
};

// Audio and visualization globals
export let audioContext, analyser, source, dataArray, bufferLength, canvas, ctx, animationId;
export let isVisualizationInitialized = false;
export let galleryAutoAdvanceTimeout;

// DOM elements cache
export const elements = {
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
    galleryMainDisplay: document.getElementById('galleryMainDisplay'),
    galleryMainImage: document.getElementById('galleryMainImage'),
    galleryMainPrev: document.getElementById('galleryMainPrev'),
    galleryMainNext: document.getElementById('galleryMainNext'),
    videoCarouselTrack: document.getElementById('videoCarouselTrack'),
    videoCarouselPrev: document.getElementById('videoCarouselPrev'),
    videoCarouselNext: document.getElementById('videoCarouselNext')
};

// Setters for audio context variables
export function setAudioContext(value) { audioContext = value; }
export function setAnalyser(value) { analyser = value; }
export function setSource(value) { source = value; }
export function setDataArray(value) { dataArray = value; }
export function setBufferLength(value) { bufferLength = value; }
export function setCanvas(value) { canvas = value; }
export function setCtx(value) { ctx = value; }
export function setAnimationId(value) { animationId = value; }
export function setVisualizationInitialized(value) { isVisualizationInitialized = value; }
export function setGalleryAutoAdvanceTimeout(value) { galleryAutoAdvanceTimeout = value; }