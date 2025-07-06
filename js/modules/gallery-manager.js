import { state, elements, setGalleryAutoAdvanceTimeout, galleryAutoAdvanceTimeout } from './state.js';

// Gallery management with smart loading
export const galleryManager = {
    images: [],
    videos: [],
    currentDirection: 'next',
    preloadedImages: new Map(), // Cache for preloaded images
    isTransitioning: false, // Prevent multiple transitions
    isFullyLoaded: false, // Track if all images are loaded
    loadingProgress: { loaded: 0, total: 0 }, // Track progress
    
    async init(galleryData) {
        this.videos = galleryData.videos || [];
        
        // Show loading state immediately
        this.showLoadingIndicator();
        
        // Create video carousel first (it's fast)
        this.createVideoCarousel();
        
        // Discover all images first (just URLs, no actual loading)
        await this.discoverGalleryImages();
        
        if (this.images.length > 0) {
            // Load ONLY the first image immediately
            await this.loadFirstImageOnly();
            
            // Start background loading of remaining images
            this.loadRemainingImagesInBackground();
        } else {
            this.hideLoadingIndicator();
        }
        
        // Add intersection observer for performance
        this.setupIntersectionObserver();
    },
    
    showLoadingIndicator() {
        // Create a subtle loading indicator
        let loadingIndicator = document.getElementById('galleryLoadingIndicator');
        if (!loadingIndicator) {
            loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'galleryLoadingIndicator';
            loadingIndicator.style.cssText = `
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 150;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-family: 'Inter', sans-serif;
                font-size: 0.8rem;
                letter-spacing: 0.1em;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: opacity 0.3s ease;
            `;
            loadingIndicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span id="loadingText">Loading gallery...</span>
                </div>
                <style>
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            `;
            
            // Add to gallery section
            const gallerySection = document.querySelector('.gallery-section');
            if (gallerySection) {
                gallerySection.appendChild(loadingIndicator);
            }
        }
    },
    
    updateLoadingIndicator(loaded, total) {
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            if (loaded === 1 && total > 1) {
                loadingText.textContent = `Loading ${total - 1} more images...`;
            } else if (loaded < total) {
                loadingText.textContent = `Loading ${total - loaded} images...`;
            } else {
                loadingText.textContent = 'Gallery ready!';
            }
        }
    },
    
    hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('galleryLoadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.opacity = '0';
            setTimeout(() => {
                if (loadingIndicator.parentNode) {
                    loadingIndicator.parentNode.removeChild(loadingIndicator);
                }
            }, 300);
        }
    },
    
    async discoverGalleryImages() {
        this.images = [];
        let imageNumber = 1;
        let consecutiveFailures = 0;
        
        // Quick discovery - just check if files exist, don't load them
        while (consecutiveFailures < 3) {
            const imagePath = `./assets/gallery/Gallery${imageNumber.toString().padStart(2, '0')}.webp`;
            
            try {
                const imageExists = await this.checkImageExists(imagePath);
                if (imageExists) {
                    this.images.push({
                        src: imagePath,
                        alt: `Gallery Image ${imageNumber}`,
                        loaded: false // Track loading state
                    });
                    consecutiveFailures = 0;
                } else {
                    consecutiveFailures++;
                }
            } catch (error) {
                consecutiveFailures++;
            }
            
            imageNumber++;
        }
        
        this.loadingProgress.total = this.images.length;
        console.log(`Discovered ${this.images.length} gallery images`);
    },
    
    async loadFirstImageOnly() {
        if (this.images.length === 0) return;
        
        console.log('Loading first image only...');
        const firstImage = this.images[0];
        
        return new Promise((resolve) => {
            const img = new Image();
            
            img.onload = () => {
                // Set the first image immediately
                elements.galleryMainImage.style.backgroundImage = `url('${firstImage.src}')`;
                elements.galleryMainImage.classList.add('loaded');
                
                // Cache it
                this.preloadedImages.set(0, img);
                this.images[0].loaded = true;
                this.loadingProgress.loaded = 1;
                
                console.log('First image loaded! Gallery is now visible.');
                this.updateLoadingIndicator(1, this.images.length);
                
                resolve();
            };
            
            img.onerror = () => {
                console.error('Failed to load first image');
                elements.galleryMainImage.style.backgroundImage = 'linear-gradient(45deg, #333, #666)';
                resolve();
            };
            
            img.src = firstImage.src;
        });
    },
    
    async loadRemainingImagesInBackground() {
        if (this.images.length <= 1) {
            this.isFullyLoaded = true;
            this.hideLoadingIndicator();
            return;
        }
        
        console.log('Starting background loading of remaining images...');
        
        // Load images one by one in the background
        for (let i = 1; i < this.images.length; i++) {
            await this.loadSingleImageInBackground(i);
            
            // Small delay to not overwhelm the browser
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.isFullyLoaded = true;
        this.hideLoadingIndicator();
        
        // Now start auto-advance if we have multiple images
        if (this.images.length > 1) {
            console.log('All images loaded! Starting auto-advance.');
            this.startAutoAdvance();
        }
    },
    
    loadSingleImageInBackground(index) {
        return new Promise((resolve) => {
            if (this.images[index].loaded) {
                resolve();
                return;
            }
            
            const img = new Image();
            
            img.onload = () => {
                this.preloadedImages.set(index, img);
                this.images[index].loaded = true;
                this.loadingProgress.loaded++;
                
                console.log(`Loaded image ${index + 1}/${this.images.length}`);
                this.updateLoadingIndicator(this.loadingProgress.loaded, this.loadingProgress.total);
                
                resolve();
            };
            
            img.onerror = () => {
                console.error(`Failed to load image ${index + 1}`);
                this.images[index].loaded = false;
                resolve();
            };
            
            img.src = this.images[index].src;
        });
    },
    
    checkImageExists(imagePath) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = imagePath;
        });
    },
    
    setupIntersectionObserver() {
        const gallerySection = document.querySelector('.gallery-section');
        if (!gallerySection) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.optimizeForVisibility(true);
                } else {
                    this.optimizeForVisibility(false);
                }
            });
        }, {
            threshold: 0.1
        });
        
        observer.observe(gallerySection);
    },
    
    optimizeForVisibility(isVisible) {
        if (isVisible) {
            // Only start auto-advance if all images are loaded
            if (this.isFullyLoaded && this.images.length > 1 && !galleryAutoAdvanceTimeout) {
                this.startAutoAdvance();
            }
        } else {
            // Pause auto-advance when not visible
            clearTimeout(galleryAutoAdvanceTimeout);
            setGalleryAutoAdvanceTimeout(null);
        }
    },
    
    createVideoCarousel() {
        if (!elements.videoCarouselTrack) return;
        
        elements.videoCarouselTrack.innerHTML = '';
        
        this.videos.forEach((video, index) => {
            const item = document.createElement('div');
            item.className = 'video-carousel-item';
            
            // Lazy load iframes
            if (video.link && video.link !== '#') {
                item.innerHTML = `
                    <div class="video-carousel-video" data-video-index="${index}">
                        <div class="video-placeholder" style="background: ${video.gradient || 'linear-gradient(45deg, #333, #666)'}; display: flex; align-items: center; justify-content: center; width: 100%; height: 200px; border-radius: 10px; cursor: pointer;">
                            <button class="video-play-button" style="background: rgba(255,255,255,0.9); border: none; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; cursor: pointer;">▶</button>
                        </div>
                    </div>
                    <div class="video-carousel-caption">${video.caption}</div>
                `;
                
                // Load iframe on click
                const placeholder = item.querySelector('.video-placeholder');
                placeholder.addEventListener('click', () => {
                    const videoContainer = item.querySelector('.video-carousel-video');
                    videoContainer.innerHTML = `
                        <iframe 
                            src="${video.link}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen
                            loading="lazy"
                            style="width: 100%; height: 200px; border-radius: 10px;">
                        </iframe>
                    `;
                });
            } else {
                item.innerHTML = `
                    <div class="video-carousel-image" style="background: ${video.gradient}; width: 100%; height: 200px; border-radius: 10px;"></div>
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
        const maxScroll = Math.max(0, this.videos.length - 3);
        
        state.currentVideoCarouselIndex = Math.max(0, Math.min(
            maxScroll,
            state.currentVideoCarouselIndex + direction
        ));
        
        track.style.transform = `translateX(-${state.currentVideoCarouselIndex * itemWidth}px)`;
    },
    
    loadCurrentImage(direction = 'next') {
        if (!elements.galleryMainImage || !this.images[state.currentGalleryIndex] || this.isTransitioning) return;
        
        // Check if target image is loaded
        const targetImage = this.images[state.currentGalleryIndex];
        if (!targetImage.loaded) {
            console.log(`Image ${state.currentGalleryIndex + 1} not loaded yet, staying on current image`);
            return;
        }
        
        this.isTransitioning = true;
        
        // Get or create the next image element
        let nextImageElement = elements.galleryMainImage.parentNode.querySelector('.gallery-main-image.next');
        if (!nextImageElement) {
            nextImageElement = elements.galleryMainImage.cloneNode(true);
            nextImageElement.classList.add('next');
            nextImageElement.classList.remove('current');
            elements.galleryMainImage.parentNode.appendChild(nextImageElement);
        }
        
        // Set classes
        elements.galleryMainImage.classList.add('current');
        nextImageElement.classList.remove('current');
        nextImageElement.classList.add('next');
        
        // Remove any existing animation classes
        elements.galleryMainImage.classList.remove('slideInFromRight', 'slideOutToLeft', 'slideInFromLeft', 'slideOutToRight');
        nextImageElement.classList.remove('slideInFromRight', 'slideOutToLeft', 'slideInFromLeft', 'slideOutToRight');
        
        // Use preloaded image (should always be available since we check loaded state)
        const preloadedImg = this.preloadedImages.get(state.currentGalleryIndex);
        
        if (preloadedImg && preloadedImg.complete) {
            this.performImageTransition(nextImageElement, targetImage.src, direction);
        } else {
            // Fallback: load on demand
            const img = new Image();
            img.onload = () => {
                this.preloadedImages.set(state.currentGalleryIndex, img);
                this.performImageTransition(nextImageElement, targetImage.src, direction);
            };
            img.onerror = () => {
                this.performImageTransition(nextImageElement, 'linear-gradient(45deg, #333, #666)', direction);
            };
            img.src = targetImage.src;
        }
    },
    
    performImageTransition(nextImageElement, imageSrc, direction) {
        // Set the new image
        nextImageElement.style.backgroundImage = imageSrc.startsWith('url') ? imageSrc : `url('${imageSrc}')`;
        
        // Position the next image off-screen
        if (direction === 'next') {
            nextImageElement.style.transform = 'translateX(100%)';
        } else {
            nextImageElement.style.transform = 'translateX(-100%)';
        }
        
        // Ensure current image is in position
        elements.galleryMainImage.style.transform = 'translateX(0)';
        
        // Force layout recalculation
        void nextImageElement.offsetHeight;
        
        // Start the transition
        requestAnimationFrame(() => {
            const slideClass = direction === 'next' ? 'slideInFromRight' : 'slideInFromLeft';
            nextImageElement.classList.add(slideClass);
            
            // After animation completes
            setTimeout(() => {
                // Clean up classes
                elements.galleryMainImage.classList.remove('current');
                nextImageElement.classList.remove(slideClass, 'next');
                
                // Swap the elements
                const tempImage = elements.galleryMainImage.style.backgroundImage;
                elements.galleryMainImage.style.backgroundImage = nextImageElement.style.backgroundImage;
                nextImageElement.style.backgroundImage = tempImage;
                
                // Reset positions
                elements.galleryMainImage.style.transform = 'translateX(0)';
                nextImageElement.style.transform = 'translateX(100%)';
                
                // Reset z-index
                elements.galleryMainImage.style.zIndex = '2';
                nextImageElement.style.zIndex = '1';
                
                elements.galleryMainImage.classList.add('loaded');
                
                this.isTransitioning = false;
            }, 800);
        });
    },
    
    nextImage() {
        if (this.images.length <= 1 || this.isTransitioning) return;
        
        const nextIndex = (state.currentGalleryIndex + 1) % this.images.length;
        
        // Only advance if the next image is loaded OR if all images are loaded
        if (!this.images[nextIndex].loaded && !this.isFullyLoaded) {
            console.log('Next image not ready yet, waiting...');
            return;
        }
        
        state.currentGalleryIndex = nextIndex;
        this.loadCurrentImage('next');
        this.startAutoAdvance();
    },
    
    previousImage() {
        if (this.images.length <= 1 || this.isTransitioning) return;
        
        const prevIndex = (state.currentGalleryIndex - 1 + this.images.length) % this.images.length;
        
        // Only go back if the previous image is loaded
        if (!this.images[prevIndex].loaded) {
            console.log('Previous image not ready yet');
            return;
        }
        
        state.currentGalleryIndex = prevIndex;
        this.loadCurrentImage('prev');
        this.startAutoAdvance();
    },
    
    startAutoAdvance() {
        clearTimeout(galleryAutoAdvanceTimeout);
        
        // Only start auto-advance if we have multiple images AND all are loaded
        if (this.images.length > 1 && this.isFullyLoaded) {
            setGalleryAutoAdvanceTimeout(setTimeout(() => this.autoAdvance(), 4000));
        }
    },
    
    autoAdvance() {
        this.nextImage();
    }
};