import { state, elements, setGalleryAutoAdvanceTimeout, galleryAutoAdvanceTimeout } from './state.js';

// Gallery management
export const galleryManager = {
    images: [],
    videos: [],
    currentDirection: 'next', // Track direction for animations
    
    async init(galleryData) {
        this.videos = galleryData.videos || [];
        
        // Dynamically discover gallery images
        await this.discoverGalleryImages();
        
        this.createVideoCarousel();
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
    
loadCurrentImage(direction = 'next') {
    if (!elements.galleryMainImage || !this.images[state.currentGalleryIndex]) return;
    
    const currentImage = this.images[state.currentGalleryIndex];
    
    // Create or get the second image element for transitions
    let nextImageElement = elements.galleryMainImage.parentNode.querySelector('.gallery-main-image.next');
    if (!nextImageElement) {
        nextImageElement = elements.galleryMainImage.cloneNode(true);
        nextImageElement.classList.add('next');
        nextImageElement.classList.remove('current');
        elements.galleryMainImage.parentNode.appendChild(nextImageElement);
    }
    
    // Set current image as current and prepare next image
    elements.galleryMainImage.classList.add('current');
    nextImageElement.classList.remove('current');
    nextImageElement.classList.add('next');
    
    // Clear any existing animation classes
    elements.galleryMainImage.classList.remove('slideInFromRight', 'slideOutToLeft', 'slideInFromLeft', 'slideOutToRight');
    nextImageElement.classList.remove('slideInFromRight', 'slideOutToLeft', 'slideInFromLeft', 'slideOutToRight');
    
    // Load the new image into the next element
    const testImage = new Image();
    
    testImage.onload = () => {
        // Set the new image
        nextImageElement.style.backgroundImage = `url('${currentImage.src}')`;
        
        // Determine animation class based on direction (only for the incoming image)
        let nextSlideIn;
        if (direction === 'next') {
            nextSlideIn = 'slideInFromRight';
        } else {
            nextSlideIn = 'slideInFromLeft';
        }
        
        // Position the next image off-screen initially
        if (direction === 'next') {
            nextImageElement.style.transform = 'translateX(100%)';
        } else {
            nextImageElement.style.transform = 'translateX(-100%)';
        }
        
        // Make sure the current image stays still
        elements.galleryMainImage.style.transform = 'translateX(0)';
        
        // Start the transition - only animate the incoming image
        requestAnimationFrame(() => {
            // Don't animate the current image - it stays still
            nextImageElement.classList.add(nextSlideIn);
            
            // After animation completes, swap the elements
            setTimeout(() => {
                // Clean up classes
                elements.galleryMainImage.classList.remove('current');
                nextImageElement.classList.remove(nextSlideIn, 'next');
                
                // Swap the elements
                const tempImage = elements.galleryMainImage.style.backgroundImage;
                elements.galleryMainImage.style.backgroundImage = nextImageElement.style.backgroundImage;
                nextImageElement.style.backgroundImage = tempImage;
                
                // Reset positions
                elements.galleryMainImage.style.transform = 'translateX(0)';
                nextImageElement.style.transform = 'translateX(0)';
                
                // Reset z-index
                elements.galleryMainImage.style.zIndex = '2';
                nextImageElement.style.zIndex = '1';
                
                elements.galleryMainImage.classList.add('loaded');
            }, 800); // Match animation duration
        });
    };
    
    testImage.onerror = () => {
        // Handle error case
        nextImageElement.style.backgroundImage = 'linear-gradient(45deg, #333, #666)';
        
        // Continue with animation even on error
        let nextSlideIn;
        if (direction === 'next') {
            nextSlideIn = 'slideInFromRight';
        } else {
            nextSlideIn = 'slideInFromLeft';
        }
        
        if (direction === 'next') {
            nextImageElement.style.transform = 'translateX(100%)';
        } else {
            nextImageElement.style.transform = 'translateX(-100%)';
        }
        
        // Make sure the current image stays still
        elements.galleryMainImage.style.transform = 'translateX(0)';
        
        requestAnimationFrame(() => {
            // Don't animate the current image - it stays still
            nextImageElement.classList.add(nextSlideIn);
            
            setTimeout(() => {
                elements.galleryMainImage.classList.remove('current');
                nextImageElement.classList.remove(nextSlideIn, 'next');
                
                const tempImage = elements.galleryMainImage.style.backgroundImage;
                elements.galleryMainImage.style.backgroundImage = nextImageElement.style.backgroundImage;
                nextImageElement.style.backgroundImage = tempImage;
                
                elements.galleryMainImage.style.transform = 'translateX(0)';
                nextImageElement.style.transform = 'translateX(0)';
                
                elements.galleryMainImage.style.zIndex = '2';
                nextImageElement.style.zIndex = '1';
                
                elements.galleryMainImage.classList.add('loaded');
            }, 800);
        });
    };
    
    testImage.src = currentImage.src;
},
    
    nextImage() {
        if (this.images.length <= 1) return;
        
        const nextIndex = (state.currentGalleryIndex + 1) % this.images.length;
        state.currentGalleryIndex = nextIndex;
        this.loadCurrentImage('next');
        this.startAutoAdvance();
    },
    
    previousImage() {
        if (this.images.length <= 1) return;
        
        const prevIndex = (state.currentGalleryIndex - 1 + this.images.length) % this.images.length;
        state.currentGalleryIndex = prevIndex;
        this.loadCurrentImage('prev');
        this.startAutoAdvance();
    },
    
    startAutoAdvance() {
        clearTimeout(galleryAutoAdvanceTimeout);
        if (this.images.length > 1) {
            setGalleryAutoAdvanceTimeout(setTimeout(() => this.autoAdvance(), 4000)); // Increased to 8 seconds for better viewing
        }
    },
    
    autoAdvance() {
        this.nextImage();
    }
};