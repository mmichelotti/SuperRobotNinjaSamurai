// Your MP3 files - replace these paths with your actual file locations
        const songs = [
            { title: "ESTATE", url: "./Songs/Estate.mp3" },
            { title: "LIVIDI", url: "./Songs/Lividi.mp3" },
            { title: "PIOMBO", url: "./Songs/Piombo.mp3" },
            { title: "DENTI", url: "./Songs/Denti.mp3" },
            { title: "Track E", url: "./Songs/e.mp3" }
        ];
        
        let currentSongIndex = 0;
        let isPlaying = false;
        let lastBassKick = 0;
        let particles = [];
        
        const audio = document.getElementById('audioPlayer');
        const bandTitle = document.getElementById('bandTitle');
        const songInfo = document.getElementById('songInfo');
        const songTitleEl = document.getElementById('songTitle');
        const beatPulse = document.getElementById('beatPulse');
        
        // Audio Visualizer Setup
        let audioContext;
        let analyser;
        let source;
        let dataArray;
        let bufferLength;
        let canvas;
        let ctx;
        let animationId;
        
        // Dynamic color system
        let colorPhase = 0;
        let colorSpeed = 0.003;
        let energyHistory = [];
        let currentPalette = 0;
        
        // Color palettes for different moods/songs
        const colorPalettes = [
            // Cyberpunk
            { mid: [255, 0, 150], high: [0, 255, 255], name: 'cyberpunk' },
            // Sunset
            { mid: [255, 100, 0], high: [255, 200, 50], name: 'sunset' },
            // Ocean
            { mid: [0, 150, 255], high: [100, 255, 200], name: 'ocean' },
            // Forest
            { mid: [50, 255, 100], high: [150, 255, 50], name: 'forest' },
            // Fire
            { mid: [255, 50, 0], high: [255, 255, 0], name: 'fire' },
            // Purple Dream
            { mid: [150, 50, 255], high: [255, 100, 200], name: 'dream' },
            // Ice
            { mid: [100, 200, 255], high: [200, 255, 255], name: 'ice' }
        ];
        
        function initializeVisualizer() {
            canvas = document.getElementById('visualizerCanvas');
            ctx = canvas.getContext('2d');
            
            // Set canvas size
            function resizeCanvas() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            
            // Create audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            
            // Connect audio element to analyser
            source = audioContext.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            
            // Configure analyser
            analyser.fftSize = 2048;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            
            // Start visualization
            visualize();
        }
        
        // Enhanced particle system with colored particles
        function createParticle(x, y, intensity, color = [255, 255, 255]) {
            return {
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 1.0,
                decay: 0.015 + Math.random() * 0.01,
                size: 1 + intensity * 3,
                intensity: intensity,
                color: color
            };
        }
        
        function updateParticles() {
            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.life -= particle.decay;
                particle.vx *= 0.99;
                particle.vy *= 0.99;
                
                if (particle.life <= 0) {
                    particles.splice(i, 1);
                }
            }
        }
        
        function drawParticles() {
            particles.forEach(particle => {
                const alpha = particle.life * particle.intensity * 0.6;
                const [r, g, b] = particle.color;
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
        
        // Static color system - palette stays the same per song
        function updateColorSystem(bassAvg, midAvg, trebleAvg, totalEnergy) {
            // Just update the color phase for subtle color shifting within the same palette
            colorPhase += colorSpeed;
        }
        
        // Get color based on intensity and FIXED current palette (no dynamic switching)
        function getFrequencyColor(type, intensity) {
            const palette = colorPalettes[currentPalette];
            const baseColor = type === 'mid' ? palette.mid : palette.high;
            
            // Very subtle phase-based color shifting within the same palette
            const phaseShift = Math.sin(colorPhase + intensity * 2) * 0.1; // Reduced from 0.3 to 0.1
            const r = Math.max(0, Math.min(255, baseColor[0] + phaseShift * 20)); // Reduced from 50 to 20
            const g = Math.max(0, Math.min(255, baseColor[1] + phaseShift * 15)); // Reduced from 30 to 15
            const b = Math.max(0, Math.min(255, baseColor[2] + phaseShift * 20)); // Reduced from 40 to 20
            
            return [r, g, b];
        }
        
        function visualize() {
            animationId = requestAnimationFrame(visualize);
            
            analyser.getByteFrequencyData(dataArray);
            
            // Clear canvas with enhanced fade effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            // Calculate frequency averages
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const bassAverage = dataArray.slice(0, bufferLength / 8).reduce((a, b) => a + b) / (bufferLength / 8);
            const midAverage = dataArray.slice(bufferLength / 8, bufferLength / 2).reduce((a, b) => a + b) / (bufferLength * 3 / 8);
            const trebleAverage = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b) / (bufferLength / 2);
            
            // Update dynamic color system
            updateColorSystem(bassAverage, midAverage, trebleAverage, average);
            
            // Dynamic background pulse with current palette influence
            if (isPlaying) {
                const pulseIntensity = average / 255;
                const palette = colorPalettes[currentPalette];
                const bgColor = [
                    (palette.mid[0] + palette.high[0]) / 2,
                    (palette.mid[1] + palette.high[1]) / 2,
                    (palette.mid[2] + palette.high[2]) / 2
                ];
                
                const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 500 + bassAverage * 2);
                gradient.addColorStop(0, `rgba(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]}, ${pulseIntensity * 0.02})`);
                gradient.addColorStop(0.5, `rgba(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]}, ${pulseIntensity * 0.01})`);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, 500 + bassAverage * 2, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            // Enhanced circular spectrum visualization with dynamic colors
            const radius = 240;
            
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * 200;
                const angle = (i / bufferLength) * 2 * Math.PI - Math.PI / 2;
                const intensity = dataArray[i] / 255;
                
                // Inner circle (low frequencies) - keep as solid white with slight pulse
                if (i < bufferLength / 4) {
                    const x1 = centerX + Math.cos(angle * 4) * radius;
                    const y1 = centerY + Math.sin(angle * 4) * radius;
                    const x2 = centerX + Math.cos(angle * 4) * (radius + barHeight);
                    const y2 = centerY + Math.sin(angle * 4) * (radius + barHeight);
                    
                    // Slight color tint based on current palette
                    const palette = colorPalettes[currentPalette];
                    const tintStrength = 0.1;
                    const r = 255 - (255 - palette.mid[0]) * tintStrength;
                    const g = 255 - (255 - palette.mid[1]) * tintStrength;
                    const b = 255 - (255 - palette.mid[2]) * tintStrength;
                    
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${intensity * 0.8})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }

                // Middle circle (mid frequencies) - dynamic color
                if (i >= bufferLength / 4 && i < bufferLength / 2) {
                    const x1 = centerX + Math.cos(angle * 4) * radius;
                    const y1 = centerY + Math.sin(angle * 4) * radius;
                    const x2 = centerX + Math.cos(angle * 4) * (radius + barHeight);
                    const y2 = centerY + Math.sin(angle * 4) * (radius + barHeight);
                    
                    const [r, g, b] = getFrequencyColor('mid', intensity);
                    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity * 0.2})`);
                    gradient.addColorStop(1, `rgba(255, 255, 255, ${intensity * 0.1})`);
                    
                    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
                    ctx.shadowBlur = intensity * 6;
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 2 + intensity * 4;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                // Outer circle (high frequencies) - dynamic color
                if (i >= bufferLength / 2) {
                    const x1 = centerX + Math.cos(angle * 4) * radius;
                    const y1 = centerY + Math.sin(angle * 4) * radius;
                    const x2 = centerX + Math.cos(angle * 4) * (radius + barHeight);
                    const y2 = centerY + Math.sin(angle * 4) * (radius + barHeight);
                    
                    const [r, g, b] = getFrequencyColor('high', intensity);
                    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity * 0.25})`);
                    gradient.addColorStop(1, `rgba(255, 255, 255, ${intensity * 0.15})`);
                    
                    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
                    ctx.shadowBlur = intensity * 8;
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 1 + intensity * 5;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }    
            
            // Enhanced bass visualization with dynamic colors
            if (bassAverage > 80) {
                const now = Date.now();
                
                // Bass ring with dynamic glow
                const bassIntensity = Math.min(bassAverage / 255, 1);
                const palette = colorPalettes[currentPalette];
                const bassColor = [
                    Math.floor((palette.mid[0] + palette.high[0]) / 2),
                    Math.floor((palette.mid[1] + palette.high[1]) / 2),
                    Math.floor((palette.mid[2] + palette.high[2]) / 2)
                ];
                
                ctx.strokeStyle = `rgba(${bassColor[0]}, ${bassColor[1]}, ${bassColor[2]}, ${bassIntensity * 0.4})`;
                ctx.lineWidth = 3;
                ctx.shadowColor = `rgba(${bassColor[0]}, ${bassColor[1]}, ${bassColor[2]}, 0.6)`;
                ctx.shadowBlur = bassIntensity * 20;
                
                ctx.beginPath();
                ctx.arc(centerX, centerY, bassAverage * 1.2, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.shadowBlur = 0;
                
                // Beat pulse effect with colored particles
                if (bassAverage > 100 && now - lastBassKick > 300) {
                    lastBassKick = now;
                    
                    // Enhanced title effects
                    const intensity = Math.min(bassAverage / 255, 1);
                    const scale = 1 + (intensity * 0.06);
                    const glowIntensity = 0.4 + (intensity * 0.4);
                    
                    bandTitle.style.transform = `scale(${scale})`;
                    bandTitle.style.textShadow = `0 0 ${80 + intensity * 60}px rgba(${bassColor[0]}, ${bassColor[1]}, ${bassColor[2]}, ${glowIntensity * 0.3}), 0 0 ${40 + intensity * 30}px rgba(255, 255, 255, ${glowIntensity})`;
                    
                    // Beat pulse ring (no more annoying particles!)
                    beatPulse.classList.add('active');
                    setTimeout(() => {
                        beatPulse.classList.remove('active');
                    }, 800);
                    
                    // NO MORE PARTICLES - they were annoying!
                    
                    setTimeout(() => {
                        bandTitle.style.transform = 'scale(1)';
                        bandTitle.style.textShadow = '0 0 40px rgba(255, 255, 255, 0.25)';
                    }, 200);
                }
            }
            
            // Update and draw particles (but no new particles are created anymore)
            updateParticles();
            drawParticles();
        }
        
        // Song-specific color palettes assignment - FIXED colors per song
        function getSongPalette(songIndex) {
            // Each song gets its own permanent color - no randomness, no green
            const songPalettes = [
                0, // ESTATE - Cyberpunk (magenta/cyan)
                2, // LIVIDI - Ocean (blue/aqua) 
                4, // PIOMBO - Fire (red/yellow)
                5, // Track D - Purple Dream (purple/pink)
                6  // Track E - Ice (light blue/white)
            ];
            return songPalettes[songIndex] || 0; // Default to cyberpunk if out of range
        }
        
        // Audio control functions
        function loadCurrentSong() {
            const currentSong = songs[currentSongIndex];
            audio.src = currentSong.url;
            document.getElementById('songTitle').textContent = currentSong.title;
            document.getElementById('progressBar').style.width = '0%';
            
            // Set specific palette for this song (stays consistent throughout the song)
            currentPalette = getSongPalette(currentSongIndex);
            colorPhase = 0;
            colorSpeed = 0.003;
            energyHistory = [];
        }
        
        function togglePlay() {
            const playBtn = document.getElementById('playBtn');
            
            if (isPlaying) {
                audio.pause();
                playBtn.textContent = '▶';
                isPlaying = false;
                
                // Remove playing states
                bandTitle.classList.remove('playing');
                songInfo.classList.remove('playing');
                songTitleEl.classList.remove('playing');
            } else {
                // Initialize visualizer on first play
                if (!audioContext) {
                    initializeVisualizer();
                }
                
                // Resume audio context if suspended
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                
                const playPromise = audio.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        playBtn.textContent = '⏸';
                        isPlaying = true;
                        
                        // Add playing states
                        bandTitle.classList.add('playing');
                        songInfo.classList.add('playing');
                        songTitleEl.classList.add('playing');
                    }).catch(error => {
                        console.log('Playback failed:', error);
                    });
                } else {
                    playBtn.textContent = '⏸';
                    isPlaying = true;
                    
                    // Add playing states
                    bandTitle.classList.add('playing');
                    songInfo.classList.add('playing');
                    songTitleEl.classList.add('playing');
                }
            }
        }
        
        function nextSong() {
            currentSongIndex = (currentSongIndex + 1) % songs.length;
            loadCurrentSong();
            if (isPlaying) {
                audio.play().catch(e => console.log('Next song play failed:', e));
            }
        }
        
        function previousSong() {
            currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
            loadCurrentSong();
            if (isPlaying) {
                audio.play().catch(e => console.log('Previous song play failed:', e));
            }
        }
        
        // Enhanced progress bar with smooth interactions
        let isDragging = false;
        
        audio.addEventListener('timeupdate', () => {
            if (audio.duration && !isDragging) {
                const progress = (audio.currentTime / audio.duration) * 100;
                document.getElementById('progressBar').style.width = progress + '%';
            }
        });
        
        const progressContainer = document.getElementById('progressContainer');
        
        // Click anywhere on the progress container
        progressContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            seekToPosition(e);
        });
        
        // Drag anywhere on the progress container
        progressContainer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isDragging = true;
            seekToPosition(e);
            progressContainer.style.transform = 'scaleY(1.2)';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging && audio.duration) {
                e.preventDefault();
                const rect = progressContainer.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
                const newTime = clickPercent * audio.duration;
                
                audio.currentTime = newTime;
                document.getElementById('progressBar').style.width = (clickPercent * 100) + '%';
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            if (isDragging) {
                isDragging = false;
                progressContainer.style.transform = 'scaleY(1)';
                e.preventDefault();
            }
        });
        
        function seekToPosition(e) {
            if (!audio.duration) return;
            
            const rect = progressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
            const newTime = clickPercent * audio.duration;
            
            audio.currentTime = newTime;
            document.getElementById('progressBar').style.width = (clickPercent * 100) + '%';
        }
        
        // Auto-advance to next song when current ends
        audio.addEventListener('ended', () => {
            nextSong();
        });
        
        // Initialize first song
        loadCurrentSong();
        
        // Enhanced hover effects
        bandTitle.addEventListener('mouseenter', () => {
            if (!isPlaying) {
                bandTitle.style.transform = 'scale(1.015)';
                bandTitle.style.textShadow = '0 0 70px rgba(255, 255, 255, 0.4)';
            }
        });
        
        bandTitle.addEventListener('mouseleave', () => {
            if (!isPlaying) {
                bandTitle.style.transform = 'scale(1)';
                bandTitle.style.textShadow = '0 0 40px rgba(255, 255, 255, 0.25)';
            }
        });