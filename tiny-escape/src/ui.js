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
      #game-ui { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, Arial; }
      .panel { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at center, rgba(0,0,0,0.55), rgba(0,0,0,0.75)); color: #fff; pointer-events: auto; }
      .card { width: min(720px, 90vw); background: rgba(12,16,20,0.9); border: 1px solid #2a323a; border-radius: 12px; padding: 24px 28px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
      .title { font-size: 28px; font-weight: 800; margin: 0 0 8px; letter-spacing: 0.5px; }
      .subtitle { font-size: 14px; opacity: 0.85; margin: 0 0 18px; }
      .blurb { font-size: 14px; line-height: 1.5; opacity: 0.92; margin: 8px 0 16px; }
      .actions { display: flex; gap: 10px; flex-wrap: wrap; }
      .btn { appearance: none; background: #4aa3ff; border: none; color: #061018; font-weight: 700; padding: 10px 16px; border-radius: 8px; cursor: pointer; transition: transform .06s ease, background .2s ease; }
      .btn:hover { transform: translateY(-1px); background: #6ab4ff; }
      .btn.secondary { background: #2a323a; color: #dfe7ef; }
      .btn.secondary:hover { background: #35414b; }
      .corner { position: absolute; top: 10px; right: 10px; font-size: 12px; opacity: 0.7; }
      .hud-banner { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); background: rgba(220,30,30,0.9); color:#fff; font-weight:800; padding: 8px 14px; border-radius: 999px; box-shadow: 0 12px 40px rgba(220,30,30,0.35); opacity: 0; pointer-events: none; transition: opacity .2s ease; }
      .hud-banner.show { opacity: 1; }
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
      <div class="card">
        <div class="title">Tiny Escape: MadChef's Fridge</div>
        <div class="subtitle">A micro-climb through towering food</div>
        <div class="blurb">
          You are a thief who tried to sneak into the legendary MadChef’s kitchen… but he doesn’t take kindly to intruders.
          Shrunken down and trapped inside his fridge, you must climb past towering food and escape. But beware: once you’re out,
          the Chef himself will notice… and he’s ready to crush you.
        </div>
        <div class="actions">
          <button class="btn" id="ui-start">Start Game</button>
          <button class="btn secondary" id="ui-new">New Game</button>
          <button class="btn secondary" id="ui-exit">Quit</button>
          <div class="corner">Controls: WASD to move, Shift to run, Space to jump, C to toggle camera, Esc to pause</div>
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
      <div class="card">
        <div class="title">Paused</div>
        <div class="actions">
          <button class="btn" id="ui-resume">Resume</button>
          <button class="btn secondary" id="ui-new2">New Game</button>
        </div>
      </div>
    `
    this.root.appendChild(this.pause)
    this.pause.querySelector('#ui-resume').onclick = () => this.onResume()
    this.pause.querySelector('#ui-new2').onclick = () => this.onNew()

    // Chef alert banner
    this.alert = document.createElement('div')
    this.alert.className = 'hud-banner'
    this.alert.textContent = 'Chef Alert! Get out of sight!'
    this.root.appendChild(this.alert)
  }

  showMenu(show=true){ this.menu.style.display = show ? 'flex' : 'none' }
  showPause(show=true){ this.pause.style.display = show ? 'flex' : 'none' }
  showAlert(show=true){ this.alert.classList.toggle('show', !!show) }
}

