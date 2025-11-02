export class UI {
  constructor({ onStart, onNew, onResume, onExit, onSettingsChange }) {
    this.onStart = onStart || (()=>{})
    this.onNew = onNew || (()=>{})
    this.onResume = onResume || (()=>{})
    this.onExit = onExit || (()=>{})
    this.onSettingsChange = onSettingsChange || (()=>{})

    this.settings = {
      volume: 0.7,
      music: true,
      quality: 'high',
      sensitivity: 1.0,
      shadows: true,
      antialiasing: true
    }

    this.root = document.createElement('div')
    this.root.id = 'game-ui'
    document.body.appendChild(this.root)

    // UI Music - Use the preloaded audio element from HTML for instant loading
    this.uiMusic = document.getElementById('ui-music')
    if (!this.uiMusic) {
      console.error('❌ Audio element not found! Creating new one...')
      this.uiMusic = new Audio('/assets/models/ui_song.mp3')
      this.uiMusic.loop = true
      this.uiMusic.preload = 'auto'
    }
    this.uiMusic.volume = this.settings.volume
    this.musicReady = false
    this.gameIsPlaying = false // Track if game is active

    console.log('🎵 Music element loaded, will start on user interaction')

    // Set up GLOBAL interaction listeners that start music IMMEDIATELY on ANY interaction
    const startMusicOnInteraction = () => {
      if (!this.gameIsPlaying && this.settings.music && this.uiMusic.paused) {
        console.log('🎵 User interaction detected, starting music...')
        this.uiMusic.play().then(() => {
          this.musicReady = true
          console.log('✅ MUSIC NOW PLAYING!')
        }).catch((e) => {
          console.error('❌ Failed to start music:', e)
        })
      }
    }

    // Listen on DOCUMENT for ANY interaction
    document.addEventListener('click', startMusicOnInteraction)
    document.addEventListener('keydown', startMusicOnInteraction)
    document.addEventListener('touchstart', startMusicOnInteraction)

    console.log('🔇 Music will start on first click or keypress (browser blocks autoplay)')

    this._injectStyles()
    this._buildMenus()
  }

  _injectStyles() {
    const css = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');

      * { margin: 0; padding: 0; box-sizing: border-box; }

      #game-ui {
        position: fixed;
        inset: 0;
        pointer-events: none;
        font-family: 'Inter', system-ui, -apple-system, Arial, sans-serif;
        z-index: 9999;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .panel {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, rgba(10,14,18,0.97), rgba(20,25,35,0.95));
        backdrop-filter: blur(20px);
        color: #fff;
        pointer-events: auto;
        opacity: 0;
        animation: fadeIn 0.2s ease forwards;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes glow {
        0%, 100% {
          box-shadow: 0 0 20px rgba(74, 163, 255, 0.3),
                      0 0 40px rgba(74, 163, 255, 0.2),
                      0 0 60px rgba(74, 163, 255, 0.1);
        }
        50% {
          box-shadow: 0 0 30px rgba(74, 163, 255, 0.5),
                      0 0 60px rgba(74, 163, 255, 0.3),
                      0 0 90px rgba(74, 163, 255, 0.2);
        }
      }

      .card {
        width: min(600px, 90vw);
        max-height: 85vh;
        overflow-y: auto;
        background: linear-gradient(135deg, rgba(15,20,28,0.95), rgba(20,28,40,0.95));
        border: 1px solid rgba(74, 163, 255, 0.2);
        border-radius: 24px;
        padding: 32px;
        box-shadow: 0 25px 80px rgba(0,0,0,0.5),
                    0 0 1px rgba(74, 163, 255, 0.3);
        position: relative;
      }

      .card::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: 24px;
        background: linear-gradient(135deg, rgba(74, 163, 255, 0.3), rgba(106, 180, 255, 0.1));
        z-index: -1;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .card:hover::before {
        opacity: 1;
      }

      .card::-webkit-scrollbar { width: 8px; }
      .card::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
      .card::-webkit-scrollbar-thumb { background: rgba(74, 163, 255, 0.3); border-radius: 4px; }
      .card::-webkit-scrollbar-thumb:hover { background: rgba(74, 163, 255, 0.5); }

      .title {
        font-size: 42px;
        font-weight: 900;
        margin: 0 0 12px;
        letter-spacing: -0.5px;
        background: linear-gradient(135deg, #4aa3ff, #6ab4ff, #8ac5ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-shadow: 0 2px 20px rgba(74, 163, 255, 0.3);
      }

      .subtitle {
        font-size: 16px;
        opacity: 0.75;
        margin: 0 0 16px;
        font-weight: 600;
        color: #8ac5ff;
      }

      .blurb {
        font-size: 15px;
        line-height: 1.7;
        opacity: 0.85;
        margin: 0 0 32px;
        color: rgba(255,255,255,0.8);
      }

      .section {
        margin: 18px 0;
      }

      .section-title {
        font-size: 16px;
        font-weight: 800;
        margin: 0 0 12px;
        color: #6ab4ff;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 24px;
      }

      .btn {
        appearance: none;
        background: linear-gradient(135deg, #4aa3ff, #5cafff);
        border: none;
        color: #0a0e12;
        font-weight: 800;
        font-size: 15px;
        padding: 16px 32px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'Inter', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 4px 15px rgba(74, 163, 255, 0.4);
      }

      .btn::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, #5cafff, #6ab4ff);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .btn:hover::before {
        opacity: 1;
      }

      .btn:hover {
        transform: translateY(-2px) scale(1.02);
        box-shadow: 0 8px 25px rgba(74, 163, 255, 0.6);
      }

      .btn:active {
        transform: translateY(0) scale(0.98);
      }

      .btn span {
        position: relative;
        z-index: 1;
      }

      .btn.secondary {
        background: linear-gradient(135deg, rgba(42, 50, 58, 0.8), rgba(53, 65, 75, 0.8));
        color: #dfe7ef;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      }

      .btn.secondary::before {
        background: linear-gradient(135deg, rgba(53, 65, 75, 0.9), rgba(65, 80, 90, 0.9));
      }

      .btn.secondary:hover {
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
      }

      .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        transform: none !important;
      }

      .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 18px 0;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        transition: background 0.2s ease;
      }

      .setting-row:hover {
        background: rgba(74, 163, 255, 0.05);
        margin: 0 -20px;
        padding-left: 20px;
        padding-right: 20px;
      }

      .setting-row:last-child { border: none; }

      .setting-label {
        font-size: 15px;
        font-weight: 700;
        color: rgba(255,255,255,0.9);
      }

      .setting-control {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .slider {
        width: 140px;
        height: 6px;
        -webkit-appearance: none;
        appearance: none;
        background: rgba(255,255,255,0.1);
        border-radius: 3px;
        outline: none;
      }

      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        background: linear-gradient(135deg, #4aa3ff, #6ab4ff);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(74, 163, 255, 0.5);
        transition: all 0.2s ease;
      }

      .slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
        box-shadow: 0 4px 12px rgba(74, 163, 255, 0.7);
      }

      .slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        background: linear-gradient(135deg, #4aa3ff, #6ab4ff);
        border-radius: 50%;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 8px rgba(74, 163, 255, 0.5);
      }

      select {
        background: rgba(42, 50, 58, 0.8);
        color: #fff;
        border: 1px solid rgba(74, 163, 255, 0.3);
        padding: 10px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.2s ease;
      }

      select:hover {
        border-color: rgba(74, 163, 255, 0.5);
        background: rgba(42, 50, 58, 1);
      }

      select:focus {
        outline: none;
        border-color: #4aa3ff;
        box-shadow: 0 0 0 3px rgba(74, 163, 255, 0.1);
      }

      .controls-grid {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 12px;
        font-size: 15px;
      }

      .control-key {
        background: linear-gradient(135deg, #4aa3ff, #5cafff);
        padding: 10px 16px;
        border-radius: 12px;
        font-weight: 800;
        text-align: center;
        color: #0a0e12;
        border: none;
        font-size: 14px;
        letter-spacing: 1.5px;
        box-shadow: 0 4px 15px rgba(74, 163, 255, 0.4);
        text-shadow: none;
      }

      .control-desc {
        color: rgba(255, 255, 255, 0.95);
        display: flex;
        align-items: center;
        font-weight: 600;
        font-size: 15px;
      }

      .checkbox-wrapper {
        position: relative;
        display: inline-block;
      }

      .checkbox {
        width: 48px;
        height: 26px;
        background: rgba(255,255,255,0.1);
        border-radius: 13px;
        position: relative;
        cursor: pointer;
        transition: background 0.3s ease;
        border: 1px solid rgba(255,255,255,0.2);
      }

      .checkbox.checked {
        background: linear-gradient(135deg, #4aa3ff, #5cafff);
        border-color: #4aa3ff;
      }

      .checkbox::after {
        content: '';
        position: absolute;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        top: 2px;
        left: 2px;
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      .checkbox.checked::after {
        transform: translateX(22px);
      }

      /* Loading Screen */
      .loading-screen {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #0a0e12 0%, #141923 100%);
        color: #fff;
        pointer-events: auto;
        overflow: hidden;
      }

      .loading-screen::before {
        content: '';
        position: absolute;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle, rgba(74, 163, 255, 0.1) 0%, transparent 70%);
        animation: rotate 20s linear infinite;
      }

      @keyframes rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .loading-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .loading-logo {
        font-size: 64px;
        font-weight: 900;
        margin-bottom: 60px;
        background: linear-gradient(135deg, #4aa3ff, #6ab4ff, #8ac5ff, #4aa3ff);
        background-size: 200% 200%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: gradientShift 3s ease infinite, glow 2s ease-in-out infinite;
        letter-spacing: 2px;
        text-shadow: 0 0 40px rgba(74, 163, 255, 0.5);
      }

      @keyframes gradientShift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }

      .loading-bar-container {
        width: 450px;
        max-width: 85vw;
        height: 10px;
        background: rgba(255,255,255,0.08);
        border-radius: 10px;
        overflow: hidden;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        border: 1px solid rgba(74, 163, 255, 0.2);
      }

      .loading-bar {
        height: 100%;
        background: linear-gradient(90deg, #4aa3ff, #6ab4ff, #8ac5ff);
        border-radius: 10px;
        transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 0 20px rgba(74, 163, 255, 0.6);
        position: relative;
        overflow: hidden;
      }

      .loading-bar::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
        animation: shimmer 2s infinite;
      }

      @keyframes shimmer {
        from { transform: translateX(-100%); }
        to { transform: translateX(100%); }
      }

      .loading-text {
        margin-top: 28px;
        font-size: 16px;
        opacity: 0.7;
        font-weight: 600;
        animation: pulse 2s ease-in-out infinite;
      }

      .loading-percent {
        margin-top: 12px;
        font-size: 32px;
        font-weight: 900;
        color: #4aa3ff;
        text-shadow: 0 0 20px rgba(74, 163, 255, 0.5);
      }

      .loading-dots {
        margin-top: 20px;
        display: flex;
        gap: 8px;
      }

      .loading-dot {
        width: 8px;
        height: 8px;
        background: #4aa3ff;
        border-radius: 50%;
        animation: dotBounce 1.4s ease-in-out infinite;
      }

      .loading-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .loading-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes dotBounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-10px); }
      }

      .hud-banner {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(220,30,30,0.95), rgba(180,20,20,0.95));
        color: #fff;
        font-weight: 800;
        padding: 12px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(220,30,30,0.4);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
        border: 1px solid rgba(255,255,255,0.2);
      }

      .hud-banner.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      @keyframes pulse {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }

      /* Fancy particles background */
      .particles {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }

      .particle {
        position: absolute;
        background: rgba(74, 163, 255, 0.4);
        border-radius: 50%;
        animation: float 20s infinite;
      }

      @keyframes float {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0; }
        10% { opacity: 0.3; }
        90% { opacity: 0.3; }
        100% { transform: translate(100vw, -100vh) scale(0); opacity: 0; }
      }
    `
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
  }

  _buildMenus() {
    // Initial loading screen (shows first on page load)
    this.initialLoading = document.createElement('div')
    this.initialLoading.className = 'loading-screen'
    this.initialLoading.innerHTML = `
      <div class="loading-content">
        <div class="loading-logo">TINY ESCAPE</div>
        <div class="loading-bar-container">
          <div class="loading-bar" id="initial-loading-bar"></div>
        </div>
        <div class="loading-percent" id="initial-loading-percent">0%</div>
        <div class="loading-text" id="initial-loading-text">Loading...</div>
        <div class="loading-dots">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>
      </div>
    `
    this.root.appendChild(this.initialLoading)

    // Main menu (shows after initial loading)
    this.menu = document.createElement('div')
    this.menu.className = 'panel'
    this.menu.style.display = 'none'
    this.menu.innerHTML = `
      <div class="particles" id="particles"></div>
      <div class="card">
        <div class="title">TINY ESCAPE</div>
        <div class="subtitle">MadChef's Kitchen Adventure</div>
        <div class="blurb">
          You are a daring thief who attempted to steal from the legendary MadChef's kitchen.
          Caught in the act, you've been shrunk down to the size of a crumb and must navigate
          the treacherous terrain of towering kitchen obstacles to escape.
        </div>
        <div class="actions">
          <button class="btn" id="ui-start"><span>START GAME</span></button>
          <button class="btn secondary" id="ui-settings"><span>SETTINGS</span></button>
          <button class="btn secondary" id="ui-controls"><span>CONTROLS</span></button>
        </div>
      </div>
    `
    this.root.appendChild(this.menu)

    // Add particle effects
    this._createParticles()

    this.menu.querySelector('#ui-start').onclick = () => {
      this.showMenu(false)
      this.onStart()
    }
    this.menu.querySelector('#ui-settings').onclick = () => {
      this.showMenu(false)
      this.showSettings(true)
    }
    this.menu.querySelector('#ui-controls').onclick = () => {
      this.showMenu(false)
      this.showControls(true)
    }

    // Loading screen
    this.loadingScreen = document.createElement('div')
    this.loadingScreen.className = 'loading-screen'
    this.loadingScreen.style.display = 'none'
    this.loadingScreen.innerHTML = `
      <div class="loading-content">
        <div class="loading-logo">TINY ESCAPE</div>
        <div class="loading-bar-container">
          <div class="loading-bar" id="loading-bar"></div>
        </div>
        <div class="loading-percent" id="loading-percent">0%</div>
        <div class="loading-text" id="loading-text">Initializing...</div>
        <div class="loading-dots">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>
      </div>
    `
    this.root.appendChild(this.loadingScreen)

    // Settings menu
    this.settingsMenu = document.createElement('div')
    this.settingsMenu.className = 'panel'
    this.settingsMenu.style.display = 'none'
    this.settingsMenu.innerHTML = `
      <div class="card">
        <div class="title">Settings</div>
        <div class="subtitle">Customize Your Experience</div>

        <div class="section">
          <div class="setting-row">
            <div class="setting-label">Volume</div>
            <div class="setting-control">
              <input type="range" class="slider" id="volume-slider" min="0" max="100" value="70">
              <span id="volume-value" style="min-width: 45px; font-weight: 700; color: #4aa3ff;">70%</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-label">Graphics Quality</div>
            <div class="setting-control">
              <select id="quality-select">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high" selected>High</option>
                <option value="ultra">Ultra</option>
              </select>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-label">Mouse Sensitivity</div>
            <div class="setting-control">
              <input type="range" class="slider" id="sensitivity-slider" min="0.1" max="2" step="0.1" value="1.0">
              <span id="sensitivity-value" style="min-width: 45px; font-weight: 700; color: #4aa3ff;">1.0x</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-label">Shadows</div>
            <div class="setting-control">
              <div class="checkbox-wrapper">
                <div class="checkbox checked" id="shadows-toggle"></div>
              </div>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-label">Anti-Aliasing</div>
            <div class="setting-control">
              <div class="checkbox-wrapper">
                <div class="checkbox checked" id="aa-toggle"></div>
              </div>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-label">Music</div>
            <div class="setting-control">
              <div class="checkbox-wrapper">
                <div class="checkbox checked" id="music-toggle"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn" id="settings-apply"><span>APPLY</span></button>
          <button class="btn secondary" id="settings-back"><span>BACK</span></button>
        </div>
      </div>
    `
    this.root.appendChild(this.settingsMenu)

    // Settings event listeners
    const volumeSlider = this.settingsMenu.querySelector('#volume-slider')
    const volumeValue = this.settingsMenu.querySelector('#volume-value')
    volumeSlider.oninput = () => {
      const val = volumeSlider.value
      volumeValue.textContent = val + '%'
      this.settings.volume = val / 100
      this.uiMusic.volume = this.settings.volume
    }

    const qualitySelect = this.settingsMenu.querySelector('#quality-select')
    qualitySelect.onchange = () => {
      this.settings.quality = qualitySelect.value
    }

    const sensSlider = this.settingsMenu.querySelector('#sensitivity-slider')
    const sensValue = this.settingsMenu.querySelector('#sensitivity-value')
    sensSlider.oninput = () => {
      const val = sensSlider.value
      sensValue.textContent = val + 'x'
      this.settings.sensitivity = parseFloat(val)
    }

    const shadowsToggle = this.settingsMenu.querySelector('#shadows-toggle')
    shadowsToggle.onclick = () => {
      shadowsToggle.classList.toggle('checked')
      this.settings.shadows = shadowsToggle.classList.contains('checked')
    }

    const aaToggle = this.settingsMenu.querySelector('#aa-toggle')
    aaToggle.onclick = () => {
      aaToggle.classList.toggle('checked')
      this.settings.antialiasing = aaToggle.classList.contains('checked')
    }

    const musicToggle = this.settingsMenu.querySelector('#music-toggle')
    musicToggle.onclick = () => {
      musicToggle.classList.toggle('checked')
      this.settings.music = musicToggle.classList.contains('checked')
      if (!this.settings.music) {
        this._stopUIMusic()
      } else {
        this._playUIMusic()
      }
    }

    this.settingsMenu.querySelector('#settings-apply').onclick = () => {
      this.onSettingsChange(this.settings)
      this.showSettings(false)
      this.showMenu(true)
    }

    this.settingsMenu.querySelector('#settings-back').onclick = () => {
      this.showSettings(false)
      this.showMenu(true)
    }

    // Controls menu
    this.controlsMenu = document.createElement('div')
    this.controlsMenu.className = 'panel'
    this.controlsMenu.style.display = 'none'
    this.controlsMenu.innerHTML = `
      <div class="card">
        <div class="title">Controls</div>
        <div class="subtitle">Master The Movement</div>

        <div class="section">
          <div class="section-title">Movement</div>
          <div class="controls-grid">
            <div class="control-key">W</div>
            <div class="control-desc">Move Forward</div>
            <div class="control-key">S</div>
            <div class="control-desc">Move Backward</div>
            <div class="control-key">A</div>
            <div class="control-desc">Move Left</div>
            <div class="control-key">D</div>
            <div class="control-desc">Move Right</div>
            <div class="control-key">SHIFT</div>
            <div class="control-desc">Sprint (Hold)</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Actions</div>
          <div class="controls-grid">
            <div class="control-key">SPACE</div>
            <div class="control-desc">Jump</div>
            <div class="control-key">MOUSE</div>
            <div class="control-desc">Look Around</div>
            <div class="control-key">C</div>
            <div class="control-desc">Toggle Camera View</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Menu</div>
          <div class="controls-grid">
            <div class="control-key">ESC</div>
            <div class="control-desc">Pause Game</div>
          </div>
        </div>

        <div class="actions">
          <button class="btn" id="controls-back"><span>BACK</span></button>
        </div>
      </div>
    `
    this.root.appendChild(this.controlsMenu)
    this.controlsMenu.querySelector('#controls-back').onclick = () => {
      this.showControls(false)
      this.showMenu(true)
    }

    // Pause menu
    this.pause = document.createElement('div')
    this.pause.className = 'panel'
    this.pause.style.display = 'none'
    this.pause.innerHTML = `
      <div class="card">
        <div class="title">Paused</div>
        <div class="subtitle">Game is Paused</div>
        <div class="actions">
          <button class="btn" id="ui-resume"><span>RESUME</span></button>
          <button class="btn secondary" id="ui-new2"><span>NEW GAME</span></button>
          <button class="btn secondary" id="ui-settings2"><span>SETTINGS</span></button>
          <button class="btn secondary" id="ui-controls2"><span>CONTROLS</span></button>
        </div>
      </div>
    `
    this.root.appendChild(this.pause)
    this.pause.querySelector('#ui-resume').onclick = () => this.onResume()
    this.pause.querySelector('#ui-new2').onclick = () => this.onNew()
    this.pause.querySelector('#ui-settings2').onclick = () => {
      this.showPause(false)
      this.showSettings(true)
    }
    this.pause.querySelector('#ui-controls2').onclick = () => {
      this.showPause(false)
      this.showControls(true)
    }

    // Level Complete menu
    this.levelComplete = document.createElement('div')
    this.levelComplete.className = 'panel'
    this.levelComplete.style.display = 'none'
    this.levelComplete.innerHTML = `
      <div class="particles" id="level-complete-particles"></div>
      <div class="card">
        <div class="title" style="color: #00ff00;">🎉 LEVEL COMPLETE! 🎉</div>
        <div class="subtitle">You Escaped the Freezer!</div>
        <div class="blurb" id="level-complete-message">
          Great job! You successfully escaped from the top freezer before the chef returned.
        </div>
        <div class="section">
          <div class="section-title">NEXT LEVEL</div>
          <p style="font-size: 18px; color: #ffaa00; text-align: center; margin: 20px 0;">
            🚧 Level 2: "The Great Countertop Escape" 🚧<br>
            <span style="font-size: 14px; opacity: 0.7;">(Coming Soon™ - We're still teaching the chef to cook)</span>
          </p>
        </div>
        <div class="actions">
          <button class="btn" id="level-complete-next"><span>NEXT LEVEL (Soon)</span></button>
          <button class="btn secondary" id="level-complete-retry"><span>RETRY LEVEL</span></button>
          <button class="btn secondary" id="level-complete-menu"><span>MAIN MENU</span></button>
        </div>
      </div>
    `
    this.root.appendChild(this.levelComplete)
    this.levelComplete.querySelector('#level-complete-next').onclick = () => {
      alert('🎮 Level 2 is still in development! The chef is perfecting his recipe... 👨‍🍳')
    }
    this.levelComplete.querySelector('#level-complete-retry').onclick = () => {
      this.showLevelComplete(false)
      this.onNew()
    }
    this.levelComplete.querySelector('#level-complete-menu').onclick = () => {
      this.showLevelComplete(false)
      this.showMenu(true)
    }

    // Level Failed menu
    this.levelFailed = document.createElement('div')
    this.levelFailed.className = 'panel'
    this.levelFailed.style.display = 'none'
    this.levelFailed.innerHTML = `
      <div class="card">
        <div class="title" style="color: #ff5555;">😱 LEVEL FAILED! 😱</div>
        <div class="subtitle" id="level-failed-subtitle">The Chef Caught You!</div>
        <div class="blurb" id="level-failed-message">
          Time ran out! The chef returned and found you in his kitchen. Better luck next time!
        </div>
        <div class="section">
          <p style="font-size: 16px; color: #ffaa00; text-align: center; margin: 20px 0;">
            💡 <strong>Tip:</strong> Use shift to run faster and reach the checkpoint in time!
          </p>
        </div>
        <div class="actions">
          <button class="btn" id="level-failed-retry"><span>RETRY LEVEL</span></button>
          <button class="btn secondary" id="level-failed-menu"><span>MAIN MENU</span></button>
        </div>
      </div>
    `
    this.root.appendChild(this.levelFailed)
    this.levelFailed.querySelector('#level-failed-retry').onclick = () => {
      this.showLevelFailed(false)
      this.onNew()
    }
    this.levelFailed.querySelector('#level-failed-menu').onclick = () => {
      this.showLevelFailed(false)
      this.showMenu(true)
    }

    // Chef alert banner
    this.alert = document.createElement('div')
    this.alert.className = 'hud-banner'
    this.alert.textContent = '⚠️ Chef Alert! Hide!'
    this.root.appendChild(this.alert)
  }

  _createParticles() {
    const particlesContainer = this.menu.querySelector('#particles')
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div')
      particle.className = 'particle'
      const size = Math.random() * 4 + 2
      particle.style.width = size + 'px'
      particle.style.height = size + 'px'
      particle.style.left = Math.random() * 100 + '%'
      particle.style.top = Math.random() * 100 + '%'
      particle.style.animationDelay = Math.random() * 20 + 's'
      particle.style.animationDuration = (Math.random() * 10 + 15) + 's'
      particlesContainer.appendChild(particle)
    }
  }

  // Initial loading screen methods
  setInitialLoadingProgress(percent, text = 'Loading...') {
    const bar = this.initialLoading.querySelector('#initial-loading-bar')
    const percentText = this.initialLoading.querySelector('#initial-loading-percent')
    const loadingText = this.initialLoading.querySelector('#initial-loading-text')

    bar.style.width = percent + '%'
    percentText.textContent = Math.round(percent) + '%'
    loadingText.textContent = text
  }

  async completeInitialLoading() {
    this.setInitialLoadingProgress(100, 'Ready!')
    await new Promise(resolve => setTimeout(resolve, 200))
    this.initialLoading.style.display = 'none'
    this.showMenu(true)
    // Immediately try to start music when menu opens
    this._playUIMusic()
  }

  // Loading screen methods
  showLoading(show = true) {
    this.loadingScreen.style.display = show ? 'flex' : 'none'
    if (show) {
      // Stop UI music because game is about to start
      this._stopUIMusic()
      this.gameIsPlaying = true
    }
  }

  setLoadingProgress(percent, text = 'Loading...') {
    const bar = this.loadingScreen.querySelector('#loading-bar')
    const percentText = this.loadingScreen.querySelector('#loading-percent')
    const loadingText = this.loadingScreen.querySelector('#loading-text')

    bar.style.width = percent + '%'
    percentText.textContent = Math.round(percent) + '%'
    loadingText.textContent = text
  }

  showMenu(show = true) {
    this.menu.style.display = show ? 'flex' : 'none'
    if (show) {
      this.gameIsPlaying = false
      // Small delay to ensure menu is visible before playing
      setTimeout(() => this._playUIMusic(), 100)
    } else {
      this._stopUIMusic()
    }
  }

  showSettings(show = true) {
    this.settingsMenu.style.display = show ? 'flex' : 'none'
    if (show) this._playUIMusic()
  }

  showControls(show = true) {
    this.controlsMenu.style.display = show ? 'flex' : 'none'
    if (show) this._playUIMusic()
  }

  showPause(show = true) {
    this.pause.style.display = show ? 'flex' : 'none'
    if (show) {
      this.gameIsPlaying = false
      this._playUIMusic()
    } else {
      this.gameIsPlaying = true
      this._stopUIMusic()
    }
  }

  showLevelComplete(show = true) {
    this.levelComplete.style.display = show ? 'flex' : 'none'
    if (show) {
      this.gameIsPlaying = false
      this._playUIMusic()
      document.exitPointerLock?.()
    }
  }

  showLevelFailed(show = true) {
    this.levelFailed.style.display = show ? 'flex' : 'none'
    if (show) {
      this.gameIsPlaying = false
      this._playUIMusic()
      document.exitPointerLock?.()
    }
  }

  _playUIMusic() {
    // NEVER play music if game is actively being played
    if (this.gameIsPlaying) {
      console.log('🎮 Game is playing - music will not start')
      return
    }

    console.log(`🎵 _playUIMusic called: music=${this.settings.music}, paused=${this.uiMusic.paused}`)

    if (this.settings.music && this.uiMusic.paused) {
      // Don't reset currentTime - continue from where we left off
      console.log('🎵 Attempting to play UI music...')
      this.uiMusic.play().then(() => {
        this.musicReady = true
        console.log('✅ UI music NOW PLAYING')
      }).catch((err) => {
        console.log('🔇 Music blocked by browser:', err.message)
        console.log('🔇 Will play on next user interaction...')
        // Set up click handler to start music on ANY click
        if (!this.musicReady) {
          const playOnInteraction = () => {
            if (this.settings.music && !this.gameIsPlaying) {
              console.log('🎵 Playing music from user interaction...')
              this.uiMusic.play().then(() => {
                this.musicReady = true
                console.log('✅ Music started after user click!')
              }).catch((e) => {
                console.error('❌ Still failed:', e)
              })
            }
          }
          // Listen on document for any click
          document.addEventListener('click', playOnInteraction, { once: true })
          document.addEventListener('keydown', playOnInteraction, { once: true })
        }
      })
    } else if (!this.settings.music) {
      console.log('🔇 Music is disabled in settings')
    } else if (!this.uiMusic.paused) {
      console.log('🎵 Music is already playing')
    }
  }

  _stopUIMusic() {
    if (!this.uiMusic.paused) {
      this.uiMusic.pause()
      // Don't reset currentTime - keep position for when we resume
    }
  }

  showAlert(show = true) {
    this.alert.classList.toggle('show', !!show)
  }

  getSettings() {
    return this.settings
  }
}
