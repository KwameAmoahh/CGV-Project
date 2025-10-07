export class UI {
  constructor({ onStart, onNew, onResume, onExit }) {
    this.onStart = onStart || (()=>{})
    this.onNew = onNew || (()=>{})
    this.onResume = onResume || (()=>{})
    this.onExit = onExit || (()=>{})

    this.root = document.createElement('div')
    this.root.id = 'game-ui'
    document.body.appendChild(this.root)

    this._injectStyles()
    this._buildMenus()
  }

  _injectStyles() {
    const css = `
      #game-ui { 
        position: fixed; 
        inset: 0; 
        pointer-events: none; 
        font-family: 'Courier New', monospace;
        background: radial-gradient(ellipse at center, rgba(173,216,230,0.1) 0%, rgba(135,206,250,0.05) 70%);
      }
      
      /* Cyber Frost Main Menu */
      .panel { 
        position: absolute; 
        inset: 0; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        background: 
          linear-gradient(135deg, rgba(0,20,40,0.9) 0%, rgba(0,30,60,0.95) 100%),
          repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(173,216,230,0.05) 10px, rgba(135,206,250,0.05) 20px),
          url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="rgba(173,216,230,0.3)"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
        color: #e0f7ff; 
        pointer-events: auto;
        animation: cyberFadeIn 0.6s ease;
      }
      
      @keyframes cyberFadeIn {
        from { 
          opacity: 0; 
          filter: blur(10px);
        }
        to { 
          opacity: 1; 
          filter: blur(0);
        }
      }
      
      @keyframes floatCyber {
        0%, 100% { transform: translateY(0px) rotate(-1deg); }
        50% { transform: translateY(-5px) rotate(1deg); }
      }
      
      @keyframes cyberGlow {
        0%, 100% { 
          box-shadow: 
            0 0 30px rgba(173,216,230,0.4),
            0 0 60px rgba(135,206,250,0.2),
            inset 0 0 30px rgba(173,216,230,0.1);
        }
        50% { 
          box-shadow: 
            0 0 40px rgba(173,216,230,0.6),
            0 0 80px rgba(135,206,250,0.3),
            inset 0 0 40px rgba(173,216,230,0.2);
        }
      }
      
      .menu-card { 
        width: min(800px, 90vw); 
        max-height: 90vh;
        background: rgba(0,15,30,0.85); 
        border: 3px solid rgba(173,216,230,0.6);
        border-radius: 12px; 
        padding: 40px 35px; 
        box-shadow: 
          0 25px 60px rgba(0,0,0,0.8),
          0 0 80px rgba(70,130,180,0.3),
          inset 0 1px 0 rgba(255,255,255,0.2),
          inset 0 -1px 0 rgba(0,0,0,0.5);
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(10px);
        animation: cyberGlow 4s ease-in-out infinite;
      }
      
      .menu-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, 
          transparent, 
          rgba(173,216,230,0.8), 
          rgba(135,206,250,0.8), 
          rgba(173,216,230,0.8), 
          transparent
        );
        animation: cyberShimmer 4s infinite;
      }
      
      @keyframes cyberShimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      
      .game-logo { 
        font-size: clamp(36px, 6vw, 52px); 
        font-weight: 900; 
        margin: 0 0 4px; 
        letter-spacing: 3px;
        background: linear-gradient(135deg, #e0f7ff 0%, #add8e6 30%, #87cefa 70%, #b0e0e6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-shadow: 
          0 2px 4px rgba(0,0,0,0.5),
          0 0 20px rgba(173,216,230,0.4);
        animation: floatCyber 4s ease-in-out infinite;
        text-transform: uppercase;
        text-align: center;
      }
      
      .game-subtitle { 
        font-size: 14px; 
        opacity: 0.9; 
        margin: 0 0 30px;
        color: #b0e0e6;
        letter-spacing: 4px;
        text-transform: uppercase;
        font-weight: 600;
        text-align: center;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }
      
      .mission-tag {
        background: linear-gradient(135deg, #4aa3ff, #3a93ef);
        color: #001f3f;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 1px;
        display: inline-block;
        margin: 0 0 25px;
        animation: pulseMission 2s infinite;
        box-shadow: 0 4px 15px rgba(74,163,255,0.4);
      }
      
      @keyframes pulseMission {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      
      .story-section {
        background: rgba(173,216,230,0.1);
        border: 1px solid rgba(173,216,230,0.3);
        border-radius: 8px;
        padding: 20px;
        margin: 0 0 25px;
        position: relative;
        backdrop-filter: blur(5px);
      }
      
      .story-title {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: #87cefa;
        font-weight: 800;
        margin: 0 0 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .story-title::before {
        content: '⚡';
        font-size: 14px;
      }
      
      .story-text { 
        font-size: 14px; 
        line-height: 1.6; 
        margin: 0;
        color: #c0e8ff;
        text-shadow: 0 1px 1px rgba(0,0,0,0.5);
      }
      
      .controls-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px;
        margin: 20px 0 30px;
        padding: 20px;
        background: rgba(0,20,40,0.6);
        border-radius: 8px;
        border: 1px solid rgba(173,216,230,0.2);
        backdrop-filter: blur(5px);
      }
      
      .control-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
      }
      
      .control-key {
        background: linear-gradient(180deg, rgba(30,60,90,0.9), rgba(20,40,70,0.9));
        border: 1px solid rgba(173,216,230,0.5);
        padding: 6px 10px;
        border-radius: 4px;
        font-weight: 700;
        color: #e0f7ff;
        min-width: 50px;
        text-align: center;
        font-size: 11px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        text-shadow: 0 1px 1px rgba(0,0,0,0.5);
      }
      
      .control-desc {
        color: #b0e0e6;
        text-shadow: 0 1px 1px rgba(0,0,0,0.3);
      }
      
      .menu-actions { 
        display: flex; 
        gap: 12px; 
        flex-wrap: wrap;
        justify-content: center;
      }
      
      .menu-btn { 
        appearance: none; 
        background: linear-gradient(135deg, #87cefa 0%, #4682b4 100%);
        border: none; 
        color: #001f3f; 
        font-weight: 800; 
        padding: 14px 28px; 
        border-radius: 6px; 
        cursor: pointer; 
        transition: all 0.3s ease;
        font-size: 14px;
        letter-spacing: 1px;
        text-transform: uppercase;
        box-shadow: 
          0 4px 15px rgba(70,130,180,0.5),
          inset 0 1px 0 rgba(255,255,255,0.4);
        position: relative;
        overflow: hidden;
        font-family: 'Courier New', monospace;
        text-shadow: 0 1px 0 rgba(255,255,255,0.3);
      }
      
      .menu-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
        transition: left 0.6s;
      }
      
      .menu-btn:hover::before {
        left: 100%;
      }
      
      .menu-btn:hover { 
        transform: translateY(-3px); 
        background: linear-gradient(135deg, #a0d8ff 0%, #5a9bd4 100%);
        box-shadow: 
          0 6px 20px rgba(70,130,180,0.7),
          inset 0 1px 0 rgba(255,255,255,0.5);
      }
      
      .menu-btn:active {
        transform: translateY(-1px);
      }
      
      .menu-btn.secondary { 
        background: rgba(30,60,90,0.8);
        color: #e0f7ff;
        border: 1px solid rgba(173,216,230,0.4);
        box-shadow: 
          0 4px 15px rgba(0,0,0,0.4),
          inset 0 1px 0 rgba(255,255,255,0.1);
      }
      
      .menu-btn.secondary:hover { 
        background: rgba(40,80,120,0.9);
        box-shadow: 
          0 6px 20px rgba(0,0,0,0.6),
          inset 0 1px 0 rgba(255,255,255,0.2);
      }
      
      .menu-btn.danger { 
        background: linear-gradient(135deg, #ff6b6b, #ee5a52);
        color: white;
      }
      
      .menu-btn.danger:hover { 
        background: linear-gradient(135deg, #ff8e8e, #ff6b6b);
      }
      
      /* Cyber Pause Menu */
      .pause-card {
        width: min(450px, 85vw);
        background: rgba(0,20,40,0.9); 
        border: 2px solid rgba(173,216,230,0.5);
        border-radius: 10px; 
        padding: 30px; 
        box-shadow: 
          0 20px 50px rgba(0,0,0,0.8),
          0 0 60px rgba(70,130,180,0.3);
        backdrop-filter: blur(10px);
        animation: cyberGlow 4s ease-in-out infinite;
      }
      
      .pause-title { 
        font-size: 28px; 
        font-weight: 800; 
        margin: 0 0 25px;
        text-align: center;
        color: #e0f7ff;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        letter-spacing: 2px;
      }
      
      /* Alert Banner */
      .hud-banner { 
        position: absolute; 
        top: 20px; 
        left: 50%; 
        transform: translateX(-50%); 
        background: linear-gradient(135deg, #ff4444, #cc0000);
        color: #fff; 
        font-weight: 800; 
        padding: 12px 24px; 
        border-radius: 8px; 
        box-shadow: 
          0 8px 30px rgba(255,0,0,0.6),
          0 0 20px rgba(255,100,100,0.8); 
        opacity: 0; 
        pointer-events: none; 
        transition: opacity 0.3s ease;
        font-size: 14px;
        letter-spacing: 1px;
        border: 2px solid rgba(255,200,200,0.6);
        animation: alertPulse 1.2s ease-in-out infinite;
        font-family: 'Courier New', monospace;
        text-transform: uppercase;
      }
      
      @keyframes alertPulse {
        0%, 100% { 
          transform: translateX(-50%) scale(1);
          box-shadow: 
            0 8px 30px rgba(255,0,0,0.6),
            0 0 20px rgba(255,100,100,0.8);
        }
        50% { 
          transform: translateX(-50%) scale(1.08);
          box-shadow: 
            0 12px 40px rgba(255,0,0,0.8),
            0 0 30px rgba(255,150,150,1);
        }
      }
      
      .hud-banner.show { opacity: 1; }
      
      /* Status Warning */
      .status-warning {
        position: absolute;
        bottom: 20px;
        right: 20px;
        background: rgba(255,100,0,0.9);
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
        border: 1px solid rgba(255,150,50,0.6);
        box-shadow: 0 4px 15px rgba(255,100,0,0.4);
      }
      
      .status-warning.show { opacity: 1; }
    `
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
  }

  _buildMenus() {
    // Main menu
    this.menu = document.createElement('div')
    this.menu.className = 'panel'
    this.menu.innerHTML = `
      <div class="menu-card">
        <div class="mission-tag">MISSION READY</div>
        <div class="game-logo">Tiny Escape</div>
        <div class="game-subtitle">Microscopic Adventure</div>
        
        <div class="story-section">
          <div class="story-title">Mission Briefing</div>
          <div class="story-text">
            You are a thief who tried to sneak into the legendary MadChef's kitchen… but he doesn't take kindly to intruders.
          Shrunken down and trapped inside his fridge, you must climb past towering food and escape. But beware: once you're out,
          the Chef himself will notice… and he's ready to crush you.
          </div>
        </div>
        
        <div class="controls-grid">
          <div class="control-item">
            <div class="control-key">WASD</div>
            <div class="control-desc">Move Character</div>
          </div>
          <div class="control-item">
            <div class="control-key">SHIFT</div>
            <div class="control-desc">Sprint</div>
          </div>
          <div class="control-item">
            <div class="control-key">SPACE</div>
            <div class="control-desc">Jump</div>
          </div>
          <div class="control-item">
            <div class="control-key">C</div>
            <div class="control-desc">Camera Toggle</div>
          </div>
          <div class="control-item">
            <div class="control-key">ESC</div>
            <div class="control-desc">Pause Menu</div>
          </div>
          <div class="control-item">
            <div class="control-key">R</div>
            <div class="control-desc">Quick Respawn</div>
          </div>
        </div>
        
        <div class="menu-actions">
          <button class="menu-btn" id="ui-start">Start Mission</button>
          <button class="menu-btn secondary" id="ui-new">New Game</button>
          <button class="menu-btn danger" id="ui-exit">Exit Game</button>
        </div>
      </div>
    `
    this.root.appendChild(this.menu)
    this.menu.querySelector('#ui-start').onclick = () => this.onStart()
    this.menu.querySelector('#ui-new').onclick = () => this.onNew()
    this.menu.querySelector('#ui-exit').onclick = () => this.onExit()

    // Pause menu (hidden by default)
    this.pause = document.createElement('div')
    this.pause.className = 'panel'
    this.pause.style.display = 'none'
    this.pause.innerHTML = `
      <div class="pause-card">
        <div class="pause-title">⏸ PAUSED</div>
        <div class="menu-actions">
          <button class="menu-btn" id="ui-resume">Resume Mission</button>
          <button class="menu-btn secondary" id="ui-new2">Restart Level</button>
        </div>
      </div>
    `
    this.root.appendChild(this.pause)
    this.pause.querySelector('#ui-resume').onclick = () => this.onResume()
    this.pause.querySelector('#ui-new2').onclick = () => this.onNew()

    // Alert banner
    this.alert = document.createElement('div')
    this.alert.className = 'hud-banner'
    this.alert.textContent = '⚠️ DANGER DETECTED! ⚠️'
    this.root.appendChild(this.alert)

    // Status warning
    this.statusWarning = document.createElement('div')
    this.statusWarning.className = 'status-warning'
    this.statusWarning.textContent = '⚡ LOW HEALTH ⚡'
    this.root.appendChild(this.statusWarning)
  }

  showMenu(show=true){ this.menu.style.display = show ? 'flex' : 'none' }
  showPause(show=true){ this.pause.style.display = show ? 'flex' : 'none' }
  showAlert(show=true, message=null){ 
    if (message) this.alert.textContent = message;
    this.alert.classList.toggle('show', !!show) 
  }
  showStatusWarning(show=true, message=null){ 
    if (message) this.statusWarning.textContent = message;
    this.statusWarning.classList.toggle('show', !!show) 
  }

  // Method to update story section for different levels
  updateMissionBriefing(title, description) {
    const storyTitle = this.menu.querySelector('.story-title');
    const storyText = this.menu.querySelector('.story-text');
    
    if (storyTitle) storyTitle.textContent = title;
    if (storyText) storyText.textContent = description;
  }

  // Method to update mission tag
  updateMissionTag(text) {
    const missionTag = this.menu.querySelector('.mission-tag');
    if (missionTag) missionTag.textContent = text;
  }
}