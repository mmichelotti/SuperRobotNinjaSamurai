import { state, elements, setGalleryAutoAdvanceTimeout, galleryAutoAdvanceTimeout } from './state.js';

// Gallery management
export const galleryManager = {
    images: [],
    videos: [],
    currentDirection: 'next',
    preloadedImages: new Map(), // Cache for preloaded images
    isTransitioning: false, // Prevent multiple transitions
    
    async init(galleryData) {
        this.videos = galleryData.videos || [];
        
        // Dynamically discover gallery images
        await this.discoverGalleryImages();
        
        // Preload first few images
        this.preloadImages();
        
        this.createVideoCarousel();
        this.loadCurrentImage();
        this.startAutoAdvance();
        
        // Add intersection observer for performance
        this.setupIntersectionObserver();
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
                    break;
                }
            } catch (error) {
                break;
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
    
    preloadImages() {
        // Preload current, next, and previous images
        const indicesToPreload = [
            state.currentGalleryIndex,
            (state.currentGalleryIndex + 1) % this.images.length,
            (state.currentGalleryIndex - 1 + this.images.length) % this.images.length
        ];
        
        indicesToPreload.forEach(index => {
            if (this.images[index] && !this.preloadedImages.has(index)) {
                const img = new Image();
                img.src = this.images[index].src;
                this.preloadedImages.set(index, img);
            }
        });
    },
    
    setupIntersectionObserver() {
        const gallerySection = document.querySelector('.gallery-section');
        if (!gallerySection) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Gallery is visible - ensure smooth performance
                    this.optimizeForVisibility(true);
                } else {
                    // Gallery is not visible - reduce resource usage
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
            // Resume auto-advance if it was running
            if (this.images.length > 1 && !galleryAutoAdvanceTimeout) {
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
                        <div class="video-placeholder" style="background: ${video.gradient || 'linear-gradient(45deg, #333, #666)'};">
                            <button class="video-play-button">▶</button>
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
                            loading="lazy">
                        </iframe>
                    `;
                });
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
        const maxScroll = Math.max(0, this.videos.length - 3);
        
        state.currentVideoCarouselIndex = Math.max(0, Math.min(
            maxScroll,
            state.currentVideoCarouselIndex + direction
        ));
        
        track.style.transform = `translateX(-${state.currentVideoCarouselIndex * itemWidth}px)`;
    },
    
    loadCurrentImage(direction = 'next') {
        if (!elements.galleryMainImage || !this.images[state.currentGalleryIndex] || this.isTransitioning) return;
        
        this.isTransitioning = true;
        const currentImage = this.images[state.currentGalleryIndex];
        
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
        
        // Use preloaded image if available
        const preloadedImg = this.preloadedImages.get(state.currentGalleryIndex);
        
        const loadImage = () => {
            // Set the new image
            nextImageElement.style.backgroundImage = `url('${currentImage.src}')`;
            
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
                    
                    // Preload next images
                    this.preloadImages();
                }, 800);
            });
        };
        
        if (preloadedImg && preloadedImg.complete) {
            loadImage();
        } else {
            const testImage = new Image();
            testImage.onload = loadImage;
            testImage.onerror = () => {
                nextImageElement.style.backgroundImage = 'linear-gradient(45deg, #333, #666)';
                this.isTransitioning = false;
            };
            testImage.src = currentImage.src;
        }
    },
    
    nextImage() {
        if (this.images.length <= 1 || this.isTransitioning) return;
        
        const nextIndex = (state.currentGalleryIndex + 1) % this.images.length;
        state.currentGalleryIndex = nextIndex;
        this.loadCurrentImage('next');
        this.startAutoAdvance();
    },
    
    previousImage() {
        if (this.images.length <= 1 || this.isTransitioning) return;
        
        const prevIndex = (state.currentGalleryIndex - 1 + this.images.length) % this.images.length;
        state.currentGalleryIndex = prevIndex;
        this.loadCurrentImage('prev');
        this.startAutoAdvance();
    },
    
    startAutoAdvance() {
        clearTimeout(galleryAutoAdvanceTimeout);
        if (this.images.length > 1) {
            setGalleryAutoAdvanceTimeout(setTimeout(() => this.autoAdvance(), 4000));
        }
    },
    
    autoAdvance() {
        this.nextImage();
    }
};