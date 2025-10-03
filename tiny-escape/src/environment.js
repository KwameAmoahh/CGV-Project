import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'


const AUDIO_ENABLED = false

// Make the fridge very large relative to the player
const FRIDGE_SCALE = 10

// Product placement disabled: keep the fridge empty
const PRODUCT_CATALOG = []

// Naive name-tag helpers for surface and interaction classification
const isNamedLike = (name, keywords) => {
  const n = (name || '').toLowerCase()
  return keywords.some(k => n.includes(k))
}

export class Environment {
  constructor(scene) {
    this.scene = scene

    this.group = new THREE.Group()
    this.group.name = 'FridgeEnvironment'
    this.scene.add(this.group)

    this.loaded = false
    this._ray = new THREE.Raycaster()
    this._down = new THREE.Vector3(0, -1, 0)

    // Collections
    this._allMeshes = []
    this._blockingBoxes = []
    this._surfaceZones = [] // { box: Box3, type: 'slippery'|'sticky' }
    this._walkableMeshes = []
    this._shelves = []
    this._productsLoaded = false
    this._onReadyCallbacks = []
    this._shelves = []

    // Interactives
    this.doorMesh = null
    this.doorOpening = false
    this.doorOpenAmount = 0 // 0..1
    this.buttonBox = null
    this._doorBlockerRemoved = false
    this._doorClosedRotationY = 0
    this._doorOpenSign = -1 // default open rota is negative around Y

    // Lights and FX
    this.fridgeLight = new THREE.PointLight(0xbfdcff, 1.2, 25)
    this.fridgeLight.position.set(0, 5, 0)
    this.fridgeLight.castShadow = false
    this.fridgeLight.visible = true
    this.fridgeLight.intensity = 0
    this.scene.add(this.fridgeLight)

    // Ambient hum (disabled)
    if (AUDIO_ENABLED) {
      this._audio = {
        ctx: null,
        osc: null,
        gain: null,
        started: false
      }
      this._bindAudioBootstrap()
    } else {
      this._audio = { started: false }
    }

    // Cold ambient fog
    if (!this.scene.fog) {
      this.scene.fog = new THREE.FogExp2(0xa8def0, 0.03)
    }

    // Load the fridge model (contains structure and props)
    this._loadFridge()
  }

  _bindAudioBootstrap() {
    const start = () => {
      if (this._audio.started) return
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        // Low-frequency, filtered hum
        osc.type = 'sawtooth'
        osc.frequency.value = 55
        gain.gain.value = 0.02
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        this._audio = { ctx, osc, gain, started: true }
      } catch (e) {
        // Ignore audio errors (autoplay policy, etc.)
      }
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
    }
    window.addEventListener('pointerdown', start)
    window.addEventListener('keydown', start)
  }

  _loadFridge() {
    const loader = new GLTFLoader()
    loader.load('assets/models/fridge.glb', (gltf) => {
      const root = gltf.scene
      // Scale up before building collision boxes so AABBs include scaling
      root.scale.set(FRIDGE_SCALE, FRIDGE_SCALE, FRIDGE_SCALE)
      this.group.add(root)

      const shelfHeights = []
      const meshRecords = []
      root.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true
          obj.receiveShadow = true
          this._allMeshes.push(obj)

          // Walkable raycast targets – default to all meshes
          this._walkableMeshes.push(obj)

          const name = (obj.name || '').toLowerCase()

          // Surfaces
          if (isNamedLike(name, ['ice', 'butter', 'slipper'])) {
            this._addSurfaceZone(obj, 'slippery')
          }
          if (isNamedLike(name, ['jam', 'jelly', 'honey', 'sticky'])) {
            this._addSurfaceZone(obj, 'sticky')
          }

          // Interactives
          if (!this.doorMesh && isNamedLike(name, ['door'])) {
            this.doorMesh = obj
            this._doorClosedRotationY = this.doorMesh.rotation.y
          }
          if (!this.buttonBox && isNamedLike(name, ['button', 'switch'])) {
            const box = new THREE.Box3().setFromObject(obj)
            this.buttonBox = box
          }

          // Blockers – by default everything except tiny details
          if (!isNamedLike(name, ['light', 'bulb', 'vent_fan'])) {
            const box = new THREE.Box3().setFromObject(obj)
            if (box.isEmpty() === false) this._blockingBoxes.push({ box, ref: obj })
          }

          if (isNamedLike(name, ['shelf', 'tray', 'rack', 'drawer', 'floor'])) {
            const b = new THREE.Box3().setFromObject(obj)
            if (!b.isEmpty()) shelfHeights.push(b.max.y)
          }

          // Record mesh for shelf detection by geometry later
          const bAll = new THREE.Box3().setFromObject(obj)
          if (!bAll.isEmpty()) meshRecords.push({ obj, name, box: bAll.clone() })
        }
      })

      // Light flicker on spawn
      this._scheduleFlicker(1.2)

      // Detect shelves by geometry/name and compute usable rectangles
      const fridgeBox = new THREE.Box3().setFromObject(root)
      const fridgeSize = fridgeBox.getSize(new THREE.Vector3())
      const shelves = []
      for (const rec of meshRecords) {
        const sz = rec.box.getSize(new THREE.Vector3())
        const named = isNamedLike(rec.name, ['shelf', 'tray', 'rack', 'drawer'])
        const isThin = sz.y <= Math.max(0.02, fridgeSize.y * 0.06)
        const wideEnough = sz.x >= fridgeSize.x * 0.35
        const deepEnough = sz.z >= fridgeSize.z * 0.15
        if (named || (isThin && wideEnough && deepEnough)) {
          const marginX = Math.max(0.01, sz.x * 0.06)
          const marginZ = Math.max(0.01, sz.z * 0.06)
          shelves.push({
            obj: rec.obj,
            box: rec.box.clone(),
            y: rec.box.max.y,
            xMin: rec.box.min.x + marginX,
            xMax: rec.box.max.x - marginX,
            zMin: rec.box.min.z + marginZ,
            zMax: rec.box.max.z - marginZ,
          })
        }
      }
      shelves.sort((a, b) => a.y - b.y)
      this._shelves = shelves

      this._shelfHeights = (shelves.length ? shelves.map(s => s.y) : shelfHeights).sort((a, b) => a - b)

      // Simple onLoaded callback mechanism
      this.loaded = true
      if (this._onLoadedCallbacks && this._onLoadedCallbacks.length) {
        for (const cb of this._onLoadedCallbacks) {
          try { cb(this) } catch (e) {}
        }
        this._onLoadedCallbacks.length = 0
      }

      // Populate products after fridge has been added/scaled
      const done = this._populateProducts()
      Promise.resolve(done).then(() => {
        this._productsLoaded = true
        this._emitReady()
      })
    }, undefined, (err) => {
      console.warn('Failed to load fridge.glb:', err)
      this.loaded = true
    })
  }

  _scheduleFlicker(duration = 1.2) {
    // Simple intensity flicker for effect
    const start = performance.now()
    const base = 1.2
    const tick = () => {
      const t = (performance.now() - start) / (duration * 1000)
      if (t >= 1) {
        this.fridgeLight.intensity = base
        return
      }
      const noise = (Math.random() * 0.6)
      this.fridgeLight.intensity = base * (0.3 + 0.7 * Math.sin(t * Math.PI * 6)) * (0.7 + 0.3 * noise)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  _addSurfaceZone(mesh, type) {
    const box = new THREE.Box3().setFromObject(mesh)
    if (box.isEmpty()) return
    this._surfaceZones.push({ box, type })
  }

  // Returns ground info below a position.
  // { y: number|null, surface: 'slippery'|'sticky'|null }
  getGroundInfo(pos, maxDistance = 6) {
    if (!this.loaded || this._walkableMeshes.length === 0) return { y: 0, surface: null }

    const from = new THREE.Vector3(pos.x, pos.y + 2, pos.z)
    this._ray.set(from, this._down)
    const hits = this._ray.intersectObjects(this._walkableMeshes, true)
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i]
      const dy = from.y - h.point.y
      if (dy >= 0 && dy <= (maxDistance + 2)) {
        const surface = this.getSurfaceAt(h.point)
        return { y: h.point.y, surface }
      }
    }
    return { y: 0, surface: null }
  }

  // Lookup surface tag at a position using zone boxes
  getSurfaceAt(pos) {
    for (const z of this._surfaceZones) {
      if (z.box.containsPoint(pos)) return z.type
    }
    return null
  }

  // Basic capsule/point vs AABB collision resolution on X/Z plane.
  // Returns a corrected Vector3 position.
  resolveCollision(current, desired, radius = 0.25) {
    if (!this.loaded) return desired.clone()

    const result = desired.clone()
    const y = desired.y
    const pointToBox2D = (p, box) => (
      p.x >= box.min.x - radius && p.x <= box.max.x + radius &&
      p.z >= box.min.z - radius && p.z <= box.max.z + radius &&
      y >= box.min.y - 1 && y <= box.max.y + 1
    )

    // Test combined movement; fall back to axis separation
    const testPoint = (p) => {
      for (const b of this._blockingBoxes) {
        if (pointToBox2D(p, b.box)) return true
      }
      return false
    }

    // If no collision, accept
    if (!testPoint(result)) return result

    // Try only X
    const onlyX = new THREE.Vector3(desired.x, y, current.z)
    if (!testPoint(onlyX)) {
      result.x = onlyX.x
      result.z = onlyX.z
      return result
    }

    // Try only Z
    const onlyZ = new THREE.Vector3(current.x, y, desired.z)
    if (!testPoint(onlyZ)) {
      result.x = onlyZ.x
      result.z = onlyZ.z
      return result
    }

    // Block both
    result.x = current.x
    result.z = current.z
    return result
  }

  // Returns true if player is within the exit button volume
  isAtExitButton(pos) {
    if (!this.buttonBox) return false
    return this.buttonBox.containsPoint(pos)
  }

  openDoor() {
    if (this.doorMesh) {
      this.doorOpening = true
      if (!this._doorBlockerRemoved) {
        this._blockingBoxes = this._blockingBoxes.filter(b => b.ref !== this.doorMesh)
        this._doorBlockerRemoved = true
      }
    }
  }

  update(dt) {
    // Door opening animation
    if (this.doorOpening && this.doorMesh) {
      this.doorOpenAmount = Math.min(1, this.doorOpenAmount + dt * 0.6)
      const angle = this._doorClosedRotationY + this._doorOpenSign * (Math.PI / 2) * this.doorOpenAmount
      this.doorMesh.rotation.y = angle
    }
  }

  // Allow async notification if caller wants to wait for load
  onLoaded(cb) {
    this._onLoadedCallbacks = this._onLoadedCallbacks || []
    if (this.loaded) cb(this)
    else this._onLoadedCallbacks.push(cb)
  }

  onReady(cb) {
    if (this.loaded && this._productsLoaded) cb(this)
    else this._onReadyCallbacks.push(cb)
  }

  _emitReady() {
    if (!(this.loaded && this._productsLoaded)) return
    if (this._onReadyCallbacks && this._onReadyCallbacks.length) {
      for (const cb of this._onReadyCallbacks) {
        try { cb(this) } catch (e) {}
      }
      this._onReadyCallbacks.length = 0
    }
  }

  // Suggest a spawn point roughly centered inside the fridge, at the top of the
  // lowest shelf-like surface we detected.
  getSpawnPoint() {
    // Default fallback
    const fallback = new THREE.Vector3(0, 1, 0)
    if (!this.loaded) return fallback

    const bbox = new THREE.Box3().setFromObject(this.group)
    const center = bbox.getCenter(new THREE.Vector3())
    const pos = center.clone()

    // Choose a shelf height if any, otherwise bottom + small offset
    let y = bbox.min.y + 0.5
    if (this._shelfHeights && this._shelfHeights.length) {
      y = this._shelfHeights[0] + 0.05
    }

    pos.y = y + 0.1

    // If products are placed and shelves detected, try a safe spot
    if (this._productsLoaded && this._shelves && this._shelves.length) {
      const safe = this.getSafeSpawnPoint()
      if (safe) return safe
    }

    // Let raycast snap to actual ground if possible
    const info = this.getGroundInfo(pos)
    if (info && typeof info.y === 'number') pos.y = info.y + 0.05
    return pos
  }
  _populateProducts() {
    try {
      const loader = new GLTFLoader()
      const bbox = new THREE.Box3().setFromObject(this.group)
      const size = bbox.getSize(new THREE.Vector3())
      const center = bbox.getCenter(new THREE.Vector3())

      // Prefer detected shelves; fallback to a single interior layer
      const fallbackLayer = { y: center.y, xMin: center.x - size.x * 0.25, xMax: center.x + size.x * 0.25, zMin: center.z - size.z * 0.18, zMax: center.z + size.z * 0.05 }
      const layers = (this._shelves && this._shelves.length) ? this._shelves : [fallbackLayer]

      // Occupancy grid per shelf to avoid overlaps
      const taken = layers.map((L) => {
        const gridX = Math.max(3, Math.round((L.xMax - L.xMin) / (size.x * 0.1)))
        const gridZ = Math.max(2, Math.round((L.zMax - L.zMin) / (size.z * 0.15)))
        return { gridX, gridZ, occ: Array.from({ length: gridX * gridZ }, () => false) }
      })

      const allocCell = (li) => {
        const g = taken[li]
        for (let idx = 0; idx < g.occ.length; idx++) {
          if (!g.occ[idx]) { g.occ[idx] = true; return idx }
        }
        return Math.floor(Math.random() * g.occ.length)
      }

      const loadOne = (entry, li) => new Promise((resolve) => {
        loader.load(`assets/models/${entry.file}`,(gltf)=>{
          const root = gltf.scene

          // Build a pivot so we can bottom-align to the shelf easily
          const pivot = new THREE.Object3D()
          const tempBox = new THREE.Box3().setFromObject(root)
          const tempCenter = tempBox.getCenter(new THREE.Vector3())
          // center at origin
          root.position.sub(tempCenter)
          // lift so bottom sits at y=0
          const bottom = tempBox.min.y - tempCenter.y
          root.position.y -= bottom
          pivot.add(root)

          // Determine scale based on shelf clearance
          const layer = layers[li]
          const shelfY = layer.y
          const nextY = (li + 1 < layers.length) ? layers[li + 1].y : shelfY + size.y * 0.20
          const clearance = Math.max(0.05, nextY - shelfY)

          const targetH = entry.targetHeight || Math.max(0.05, Math.min(clearance * (entry.heightRatio || 0.25), clearance * 0.9))
          // Compute current height
          const boxBefore = new THREE.Box3().setFromObject(pivot)
          const currentH = Math.max(0.001, boxBefore.getSize(new THREE.Vector3()).y)
          const s = targetH / currentH
          pivot.scale.setScalar(s)

          // Pick a grid cell within shelf rectangle
          const g = taken[li]
          const cellIndex = allocCell(li)
          const cx = cellIndex % g.gridX
          const cz = Math.floor(cellIndex / g.gridX)
          const cellW = (layer.xMax - layer.xMin) / g.gridX
          const cellD = (layer.zMax - layer.zMin) / g.gridZ
          const px = layer.xMin + (cx + 0.5) * cellW + (Math.random() - 0.5) * cellW * 0.15
          const pz = layer.zMin + (cz + 0.5) * cellD + (Math.random() - 0.5) * cellD * 0.15
          let py = shelfY + 0.01
          pivot.position.set(px, py, pz)
          this.group.add(pivot)
          pivot.traverse((obj)=>{
            if (obj.isMesh) {
              obj.castShadow = true
              obj.receiveShadow = true
              this._allMeshes.push(obj)
              this._walkableMeshes.push(obj)
              const nm = (obj.name||'').toLowerCase()
              if (isNamedLike(nm, ['ice','butter','slipper'])) this._addSurfaceZone(obj,'slippery')
              if (isNamedLike(nm, ['jam','jelly','honey','sticky'])) this._addSurfaceZone(obj,'sticky')
              const b = new THREE.Box3().setFromObject(obj)
              if (!b.isEmpty()) this._blockingBoxes.push({ box: b, ref: obj })
            }
          })

    
          const from = new THREE.Vector3(px, shelfY + 2, pz)
          this._ray.set(from, new THREE.Vector3(0, -1, 0))
          const shelfTarget = (this._shelves && this._shelves.length) ? [layer.obj] : this._walkableMeshes
          const hits = this._ray.intersectObjects(shelfTarget, true)
          if (hits && hits.length) {
            py = hits[0].point.y + 0.005
            pivot.position.y = py
          }

          resolve()
        }, undefined, ()=> resolve())
      })

      const tasks = []
      let li = 0
      for (const p of PRODUCT_CATALOG) {
        for (let i = 0; i < (p.count || 1); i++) {
          tasks.push(loadOne(p, li))
          li = (li + 1) % layers.length
        }
      }
      return Promise.all(tasks)
    } catch (e) {
      return Promise.resolve()
    }
  }
  getSafeSpawnPoint(radius = 0.12) {
    if (!this._shelves || this._shelves.length === 0) return null
    const candidates = this._shelves.filter(s => (s.xMax - s.xMin) > 0.2 && (s.zMax - s.zMin) > 0.1)
    const pickIndex = Math.min(1, Math.max(0, candidates.length - 1))
    const shelf = candidates[pickIndex] || this._shelves[Math.floor(this._shelves.length / 2)] || this._shelves[0]

    const collides = (p) => {
      for (const b of this._blockingBoxes) {
        const box = b.box
        const y = shelf.y
        const hit = (
          p.x >= box.min.x - radius && p.x <= box.max.x + radius &&
          p.z >= box.min.z - radius && p.z <= box.max.z + radius &&
          y >= box.min.y - 0.5 && y <= box.max.y + 0.5
        )
        if (hit) return true
      }
      return false
    }

    for (let tries = 0; tries < 80; tries++) {
      const x = THREE.MathUtils.lerp(shelf.xMin, shelf.xMax, Math.random())
      const z = THREE.MathUtils.lerp(shelf.zMin, shelf.zMax, Math.random())
      const from = new THREE.Vector3(x, shelf.y + 2, z)
      this._ray.set(from, new THREE.Vector3(0, -1, 0))
      const hits = this._ray.intersectObjects([shelf.obj], true)
      if (hits && hits.length) {
        const p = hits[0].point.clone()
        if (!collides(p)) {
          p.y += 0.05
          return p
        }
      }
    }

    const cx = (shelf.xMin + shelf.xMax) * 0.5
    const cz = (shelf.zMin + shelf.zMax) * 0.5
    const from = new THREE.Vector3(cx, shelf.y + 2, cz)
    this._ray.set(from, new THREE.Vector3(0, -1, 0))
    const hits = this._ray.intersectObjects([shelf.obj], true)
    if (hits && hits.length) {
      const p = hits[0].point.clone()
      p.y += 0.05
      return p
    }
    return null
  }
}
