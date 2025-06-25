import { state, elements, setGalleryAutoAdvanceTimeout, galleryAutoAdvanceTimeout } from './state.js';

// Gallery management
export const galleryManager = {
    images: [],
    videos: [],
    
    async init(galleryData) {
        this.videos = galleryData.videos || [];
        
        // Dynamically discover gallery images
        await this.discoverGalleryImages();
        
        this.createVideoCarousel();
        this.attachGalleryNavigation();
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
    
    attachGalleryNavigation() {
        if (elements.galleryMainPrev) {
            elements.galleryMainPrev.addEventListener('click', () => {
                this.previousImage();
            });
        }
        
        if (elements.galleryMainNext) {
            elements.galleryMainNext.addEventListener('click', () => {
                this.nextImage();
            });
        }
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
    
    loadCurrentImage() {
        if (!elements.galleryMainImage || !this.images[state.currentGalleryIndex]) return;
        
        const currentImage = this.images[state.currentGalleryIndex];
        
        // Start transition
        elements.galleryMainImage.classList.add('changing');
        
        // Load image
        const testImage = new Image();
        
        testImage.onload = () => {
            setTimeout(() => {
                elements.galleryMainImage.style.backgroundImage = `url('${currentImage.src}')`;
                elements.galleryMainImage.classList.remove('changing');
                elements.galleryMainImage.classList.add('loaded');
            }, 600);
        };
        
        testImage.onerror = () => {
            setTimeout(() => {
                elements.galleryMainImage.style.backgroundImage = 'linear-gradient(45deg, #333, #666)';
                elements.galleryMainImage.classList.remove('changing');
                elements.galleryMainImage.classList.add('loaded');
            }, 600);
        };
        
        testImage.src = currentImage.src;
    },
    
    nextImage() {
        if (this.images.length <= 1) return;
        
        const nextIndex = (state.currentGalleryIndex + 1) % this.images.length;
        state.currentGalleryIndex = nextIndex;
        this.loadCurrentImage();
        this.startAutoAdvance();
    },
    
    previousImage() {
        if (this.images.length <= 1) return;
        
        const prevIndex = (state.currentGalleryIndex - 1 + this.images.length) % this.images.length;
        state.currentGalleryIndex = prevIndex;
        this.loadCurrentImage();
        this.startAutoAdvance();
    },
    
    startAutoAdvance() {
        clearTimeout(galleryAutoAdvanceTimeout);
        if (this.images.length > 1) {
            setGalleryAutoAdvanceTimeout(setTimeout(() => this.autoAdvance(), 8000)); // Increased to 8 seconds for better viewing
        }
    },
    
    autoAdvance() {
        this.nextImage();
    }
};