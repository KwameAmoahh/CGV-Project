export const W = 'w'
export const A = 'a'
export const S = 's'
export const D = 'd'
export const SHIFT = 'shift'
export const SPACE = ' '

// all directions for movement checks
export const DIRECTIONS = [W, A, S, D]

export class KeyDisplay {
    constructor() {
        this.map = new Map()
        
        // Create container for the key display
        this.container = document.createElement("div")
        this.container.id = 'key-display-container'
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            display: flex;
            gap: 12px;
            align-items: flex-end;
            pointer-events: none;
            z-index: 100;
        `

        // Create WASD group
        const wasdGroup = document.createElement("div")
        wasdGroup.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
            position: relative;
        `

        // Create keys
        const w = this.createKey('W')
        const a = this.createKey('A')
        const s = this.createKey('S')
        const d = this.createKey('D')
        const shift = this.createKey('SHIFT')
        const space = this.createKey('SPACE')

        this.map.set(W, w)
        this.map.set(A, a)
        this.map.set(S, s)
        this.map.set(D, d)
        this.map.set(SHIFT, shift)
        this.map.set(SPACE, space)

        // Position WASD in grid
        w.style.gridColumn = '2'
        w.style.gridRow = '1'
        a.style.gridColumn = '1'
        a.style.gridRow = '2'
        s.style.gridColumn = '2'
        s.style.gridRow = '2'
        d.style.gridColumn = '3'
        d.style.gridRow = '2'

        wasdGroup.appendChild(w)
        wasdGroup.appendChild(a)
        wasdGroup.appendChild(s)
        wasdGroup.appendChild(d)

        // Shift is separate
        shift.style.minWidth = '80px'

        // Space bar is wide
        space.style.minWidth = '180px'

        this.container.appendChild(shift)
        this.container.appendChild(wasdGroup)
        this.container.appendChild(space)
        document.body.appendChild(this.container)
    }

    createKey(label) {
        const key = document.createElement("div")
        key.textContent = label
        key.style.cssText = `
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            font-family: system-ui, Arial, sans-serif;
            color: #dfe7ef;
            background: linear-gradient(180deg, rgba(42, 50, 58, 0.95) 0%, rgba(30, 36, 42, 0.95) 100%);
            border: 1px solid rgba(74, 163, 255, 0.3);
            border-radius: 6px;
            box-shadow: 
                0 2px 8px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            transition: all 0.1s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        `
        return key
    }

    updatePosition() {
        // Position is now handled by the container's fixed positioning
        // This method is kept for compatibility but doesn't need to do anything
    }

    down(key) {
        const el = this.map.get(key.toLowerCase())
        if (el) {
            el.style.background = 'linear-gradient(180deg, rgba(74, 163, 255, 0.9) 0%, rgba(54, 143, 235, 0.9) 100%)'
            el.style.color = '#061018'
            el.style.borderColor = 'rgba(74, 163, 255, 0.8)'
            el.style.transform = 'translateY(2px)'
            el.style.boxShadow = `
                0 1px 4px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.2),
                0 0 12px rgba(74, 163, 255, 0.4)
            `
        }
    }

    up(key) {
        const el = this.map.get(key.toLowerCase())
        if (el) {
            el.style.background = 'linear-gradient(180deg, rgba(42, 50, 58, 0.95) 0%, rgba(30, 36, 42, 0.95) 100%)'
            el.style.color = '#dfe7ef'
            el.style.borderColor = 'rgba(74, 163, 255, 0.3)'
            el.style.transform = 'translateY(0)'
            el.style.boxShadow = `
                0 2px 8px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `
        }
    }
}