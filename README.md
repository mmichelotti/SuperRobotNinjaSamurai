## 📁 Project Structure

```
SuperRobotNinjaSamurai/
├── README.md                      # Project documentation
├── index.html                     # Main HTML file
├── Info.json                      # Website content configuration
│
├── assets/                        # Static assets directory
│   ├── gallery/                   # Gallery images
│   │   ├── Gallery01.png          # Auto-discovered gallery images
│   │   ├── Gallery02.png          # (numbered sequentially)
│   │   └── Gallery03.png
│   │
│   ├── images/                    # Static images and icons
│   │   └── Icon.png               # Main site icon
│   │
│   └── songs/                     # Music and song data
│       ├── SongData.json          # List of available songs
│       └── [SongFolder]/          # Individual song directories
│           ├── Data.json          # Song metadata and color palette
│           ├── Song.mp3           # Audio file
│           ├── Lyrics.lrc         # Synchronized lyrics file
│           └── background.png     # Song-specific background image
│
├── css/                           # Stylesheets (modular architecture)
│   ├── main.css                   # Main CSS entry point
│   └── modules/                   # CSS modules
│       ├── variables.css          # CSS custom properties and theme variables
│       ├── base.css               # Reset, typography, and base styles
│       ├── navigation.css         # Navigation overlay and links
│       ├── homepage.css           # Homepage interface and player controls
│       ├── controls.css           # Volume controls and progress bars
│       ├── sections.css           # About, Dates, and Contact sections
│       ├── gallery.css            # Gallery display and video carousel
│       ├── footer.css             # Footer overlay
│       ├── animations.css         # Keyframe animations and transitions
│       └── responsive.css         # Media queries and mobile optimizations
│
└── js/                            # JavaScript (modular architecture)
    ├── main.js                    # Main JavaScript entry point
    └── modules/                   # JavaScript modules
        ├── state.js               # Global state management and DOM cache
        ├── utils.js               # Utility functions and mobile detection
        ├── audio-visualization.js # Audio analysis and canvas visualization
        ├── song-manager.js        # Song loading and metadata management
        ├── lyrics-manager.js      # Lyrics parsing and display synchronization
        ├── gallery-manager.js     # Image gallery and auto-advancement
        ├── ui-manager.js          # UI controls and navigation
        ├── info-manager.js        # Content population from Info.json
        └── event-handlers.js      # Event listeners and user interactions
```

### Adding Songs
1. Create a folder in `assets/songs/` with your song name
2. Add the required files:
   ```
   assets/songs/YourSongName/
   ├── Data.json          # Song metadata
   ├── Song.mp3           # Audio file
   ├── Lyrics.lrc         # Optional: Synchronized lyrics
   └── background.png     # Optional: Background image
   ```
3. Add your song folder name to `assets/songs/SongData.json`

### Adding Gallery Images
Simply add images to `assets/gallery/` with the naming pattern:
- `Gallery01.png`
- `Gallery02.png`
- `Gallery03.png`
- etc.

The system will automatically discover and display them.

## 🛠 Architecture

### Modular Design
Both CSS and JavaScript use a modular architecture for better maintainability:

**CSS Modules:**
- Each module handles a specific UI component
- Variables centralized in `variables.css`
- Import order managed in `main.css`

**JavaScript Modules:**
- ES6 modules with clear separation of concerns
- State management centralized in `state.js`
- Event-driven architecture with clean interfaces

### Key Components

**Audio Visualization:**
- Real-time frequency analysis
- Beat detection with adaptive sensitivity
- Canvas-based circular spectrum display

**Lyrics System:**
- LRC format support with timing
- Multiple display modes (normal, enhance, aggressive)
- Automatic song title detection

**Gallery Management:**
- Automatic image discovery
- Smooth transitions with CSS animations
- Auto-advancing slideshow

## 📝 Configuration

### Info.json Structure
Configure your website content in `Info.json`:
```json
{
  "band": { "name": "...", "shortName": "...", "tagline": "..." },
  "navigation": { "links": [...] },
  "about": { "title": "...", "content": {...}, "members": [...] },
  "dates": { "title": "...", "shows": [...] },
  "gallery": { "title": "...", "videos": [...] },
  "contact": { "title": "...", "info": [...], "social": {...} },
  "footer": { "leftText": [...], "rightText": "..." },
  "meta": { "title": "...", "favicon": "..." }
}
```

### Song Data.json Structure
Each song's `Data.json` should include:
```json
{
  "title": "Song Title",
  "palette": {
    "mid": [255, 255, 255],
    "high": [255, 255, 255]
  },
  "backgroundBrightness": 0.85
}
```

## 🎮 Controls

**Keyboard:**
- `Space` - Play/Pause
- `←/→` - Previous/Next song
- `↑/↓` - Volume up/down
- `Escape` - Scroll to top

**Mouse/Touch:**
- Click center area - Play/Pause
- Click left/right areas - Previous/Next song
- Swipe horizontally - Change songs
- Click progress bar - Seek to position

## 🌐 Browser Support

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Requires ES6 module support and Web Audio API.

## 📱 Mobile Support
Fully responsive design with:
- Touch gesture support
- Mobile-optimized layouts
- Zoom prevention
- Adaptive typography

## 🔧 Development

### Adding New Modules
1. Create new `.js` file in `js/modules/`
2. Export your functions/objects
3. Import in `main.js` or relevant modules
4. Follow the established patterns for state management

## 📄 License
This project is created for educational and portfolio purposes. All music is my own artistic property and should never be used/reused/recycled/used for AI training or anything else in anyway shape or form without my explicit, direct and unequivocal consent.