import { utils } from './utils.js';
import { galleryManager } from './gallery-manager.js';

// Website Info Manager
export const infoManager = {
    data: {
        band: null,
        navigation: null,
        footer: null,
        meta: null,
        about: null,
        dates: null,
        gallery: null,
        contact: null
    },
    
    async loadInfo() {
        try {
            // Load all JSON files in parallel
            const [
                bandInfo,
                aboutInfo,
                datesInfo,
                galleryInfo,
                contactInfo
            ] = await Promise.all([
                utils.fetchJson('./assets/content/band-info.json'),
                utils.fetchJson('./assets/content/about.json'),
                utils.fetchJson('./assets/content/dates.json'),
                utils.fetchJson('./assets/content/gallery.json'),
                utils.fetchJson('./assets/content/contact.json')
            ]);

            // Merge all data into the main data object
            this.data = {
                ...bandInfo,
                ...aboutInfo,
                ...datesInfo,
                ...galleryInfo,
                ...contactInfo
            };

            return true;
        } catch (error) {
            console.error('Error loading website info:', error);
            return false;
        }
    },
    
    populateNavigation() {
        const navLogo = document.querySelector('.nav-logo');
        const navLinks = document.querySelector('.nav-links');
        
        if (navLogo && this.data.band) {
            navLogo.textContent = this.data.band.shortName;
        }
        
        if (navLinks && this.data.navigation) {
            navLinks.innerHTML = '';
            this.data.navigation.links.forEach(link => {
                const linkElement = document.createElement('a');
                linkElement.className = 'nav-link';
                linkElement.textContent = link.text;
                linkElement.href = '#';
                linkElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (window.scrollToSection) {
                        window.scrollToSection(link.target);
                    }
                });
                navLinks.appendChild(linkElement);
            });
        }
    },
    
    populateContent() {
        if (!this.data) return;
        
        // Homepage
        const bandTitle = document.getElementById('bandTitle');
        const pageTitle = document.querySelector('title');
        const favicon = document.querySelector('link[rel="icon"]');
        
        if (bandTitle && this.data.band) bandTitle.innerHTML = this.data.band.tagline;
        if (pageTitle && this.data.meta) pageTitle.textContent = this.data.meta.title;
        if (favicon && this.data.meta) favicon.href = this.data.meta.favicon;
        
        // About section
        const aboutSection = document.getElementById('about');
        if (aboutSection && this.data.about) {
            const title = aboutSection.querySelector('.section-title');
            if (title) title.textContent = this.data.about.title;
            
            const aboutText = aboutSection.querySelector('.about-text');
            if (aboutText) {
                aboutText.innerHTML = `
                    <h3>${this.data.about.content.sound.title}</h3>
                    <p>${this.data.about.content.sound.description}</p>
                    <h3>${this.data.about.content.vision.title}</h3>
                    <p>${this.data.about.content.vision.description}</p>
                `;
            }
            
            const membersContainer = aboutSection.querySelector('.band-members');
            if (membersContainer) {
                membersContainer.innerHTML = '';
                this.data.about.members.forEach(member => {
                    const memberDiv = document.createElement('div');
                    memberDiv.className = 'member';
                    memberDiv.innerHTML = `
                        <div class="member-avatar">${member.avatar}</div>
                        <div class="member-name">${member.name}</div>
                        <div class="member-role">${member.role}</div>
                    `;
                    membersContainer.appendChild(memberDiv);
                });
            }
        }
        
        // Dates section
        const datesSection = document.getElementById('dates');
        if (datesSection && this.data.dates) {
            const title = datesSection.querySelector('.section-title');
            if (title) title.textContent = this.data.dates.title;
            
            const datesContainer = datesSection.querySelector('.dates-container');
            if (datesContainer) {
                datesContainer.innerHTML = '';
                this.data.dates.shows.forEach(show => {
                    const dateItem = document.createElement('div');
                    dateItem.className = 'date-item';
                    dateItem.innerHTML = `
                        <div class="date-info">
                            <div class="date">${show.date}</div>
                            <div class="year">${show.year}</div>
                        </div>
                        <div class="venue-info">
                            <div class="venue">${show.venue}</div>
                            <div class="location">${show.location}</div>
                        </div>
                        <div class="date-action">
                            <button class="ticket-btn">${show.ticketText}</button>
                        </div>
                    `;
                    datesContainer.appendChild(dateItem);
                });
            }
        }
        
        // Gallery section
        const gallerySection = document.getElementById('gallery');
        if (gallerySection && this.data.gallery) {
            const title = gallerySection.querySelector('.section-title');
            if (title) title.textContent = this.data.gallery.title;
            
            // Initialize gallery manager with data
            galleryManager.init(this.data.gallery);
        }
        
        // Contact section
        const contactSection = document.getElementById('contact');
        if (contactSection && this.data.contact) {
            const title = contactSection.querySelector('.section-title');
            if (title) title.textContent = this.data.contact.title;
            
            const contactInfo = contactSection.querySelector('.contact-info');
            if (contactInfo) {
                contactInfo.innerHTML = '';
                this.data.contact.info.forEach(info => {
                    const contactItem = document.createElement('div');
                    contactItem.className = 'contact-item';
                    contactItem.innerHTML = `
                        <h3>${info.title}</h3>
                        <p>${info.email}</p>
                    `;
                    contactInfo.appendChild(contactItem);
                });
            }
            
            const socialTitle = contactSection.querySelector('.social-links h3');
            const socialGrid = contactSection.querySelector('.social-grid');
            
            if (socialTitle) socialTitle.textContent = this.data.contact.social.title;
            
            if (socialGrid) {
                socialGrid.innerHTML = '';
                this.data.contact.social.links.forEach(link => {
                    const socialLink = document.createElement('a');
                    socialLink.href = link.url;
                    socialLink.className = 'social-link';
                    socialLink.innerHTML = `
                        <span class="social-icon">${link.icon}</span>
                        <span class="social-name">${link.name}</span>
                    `;
                    socialGrid.appendChild(socialLink);
                });
            }
        }
    },
    
    populateFooter() {
        if (!this.data || !this.data.footer) return;
        
        const footerInfo = document.querySelector('.footer-info');
        const footerLinks = document.querySelector('.footer-links');
        
        if (footerInfo) {
            footerInfo.innerHTML = '';
            this.data.footer.leftText.forEach(text => {
                const p = document.createElement('p');
                p.textContent = text;
                footerInfo.appendChild(p);
            });
        }
        
        if (footerLinks) {
            footerLinks.textContent = this.data.footer.rightText;
        }
    },
    
    attachEventListeners() {
        // Ticket buttons
        document.querySelectorAll('.ticket-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const originalText = btn.textContent;
                btn.textContent = 'REDIRECTING...';
                btn.disabled = true;
                
                setTimeout(() => {
                    btn.textContent = 'SOLD OUT';
                    btn.disabled = false;
                }, 1000);
            });
        });

        // Handle logo click to scroll to top
        const navLogo = document.querySelector('.nav-logo');
        if (navLogo) {
            navLogo.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    },
    
    async populateAll() {
        const loaded = await this.loadInfo();
        if (!loaded) return false;
        
        this.populateNavigation();
        this.populateContent();
        this.populateFooter();
        
        setTimeout(() => this.attachEventListeners(), 100);
        return true;
    }
};