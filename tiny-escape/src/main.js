import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CharacterControls } from './CharacterControls.js'
import { KeyDisplay } from './utils.js'

// ----------------------------------------------------------------------------- //
// Scene + Camera
// ----------------------------------------------------------------------------- //
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb) // sky blue

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 400)
camera.position.set(0, 3.0, 4.5)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.shadowMap.enabled = true
// Sharper, more contrasted shadows
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

// No HDRI environment/background; keep simple background color

// Minimap camera (top-down)
const minimapCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000)
minimapCamera.up.set(0, 0, -1)
let minimapEnabled = false
let minimapSize = 220 // pixels
let minimapMargin = 12

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1.6, 0)
controls.enableDamping = true
controls.minDistance = 0.5
controls.maxDistance = 80
controls.update()

// ----------------------------------------------------------------------------- //
// Lighting
// ----------------------------------------------------------------------------- //
// Slightly dimmer ambient so shadows read darker
scene.add(new THREE.AmbientLight(0xffffff, 0.35))

const keyLight = new THREE.DirectionalLight(0xffffff, 0.9)
keyLight.position.set(3, 6, 4)
keyLight.castShadow = true
// Sharper, cleaner soft shadows
keyLight.shadow.mapSize.set(4096, 4096)
// Fit shadow camera to the room so we avoid acne/peter‑panning
const SHADOW_EXTENT = 30
keyLight.shadow.camera.left = -SHADOW_EXTENT
keyLight.shadow.camera.right = SHADOW_EXTENT
keyLight.shadow.camera.top = SHADOW_EXTENT
keyLight.shadow.camera.bottom = -SHADOW_EXTENT
keyLight.shadow.camera.near = 0.1
keyLight.shadow.camera.far = 100
keyLight.shadow.bias = -0.00025
keyLight.shadow.normalBias = 0.02
keyLight.shadow.camera.updateProjectionMatrix()
scene.add(keyLight)

const rimLight = new THREE.DirectionalLight(0xffffff, 0.35)
rimLight.position.set(-4, 4, -3)
rimLight.castShadow = true
rimLight.shadow.mapSize.set(2048, 2048)
rimLight.shadow.camera.left = -SHADOW_EXTENT
rimLight.shadow.camera.right = SHADOW_EXTENT
rimLight.shadow.camera.top = SHADOW_EXTENT
rimLight.shadow.camera.bottom = -SHADOW_EXTENT
rimLight.shadow.camera.near = 0.1
rimLight.shadow.camera.far = 100
rimLight.shadow.bias = -0.0002
rimLight.shadow.normalBias = 0.015
rimLight.shadow.camera.updateProjectionMatrix()
scene.add(rimLight)

const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33 })
const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), groundMat)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// ----------------------------------------------------------------------------- //
// Simple Outdoor Environment (sky dome + large ground) + Sun shadow light
// ----------------------------------------------------------------------------- //
function buildOutside() {
  // Remove any previous outdoor objects and keep a clean sky-blue background
  const old = scene.getObjectByName('OutdoorGroup')
  if (old) scene.remove(old)
  scene.background = new THREE.Color(0x87ceeb) // sky blue
}

// ----------------------------------------------------------------------------- //
// Animation / Navigation
// ----------------------------------------------------------------------------- //
const loader = new GLTFLoader()
const clock = new THREE.Clock()

let chefMixer = null
let chefRoot = null
let activeAction = null
let baseY = 0
let chefFloorY = 0

let playerMixer = null
let playerControls = null
let playerModel = null

const keysPressed = {}
const keyDisplay = new KeyDisplay()

let kitchenInfo = null
let kitchenRootRef = null
const spawnRay = new THREE.Raycaster()
// Feature flag: keep object-AABB collisions OFF to avoid movement glitches
// Turn on only when testing: set to true and refresh.
const USE_OBJECT_COLLIDERS = true
// Visible mesh list used for collisions (only meshes that are actually visible)
const collidableMeshList = []
const DEBUG_COLLISION_HELPERS = true
// Wall thickness used for simple perimeter collision (meters)
const WALL_THICKNESS = 0.18
let kitchenColliders = [] // { box: THREE.Box3, name: string }
let colliderHelpers = []
let highlightHelpers = []
let debugCollidersVisible = false
// Shadow: indoor spot to guarantee shadows inside the room
let roomLight = null

function debugLogLocations(tag = '') {
  const label = tag ? ` ${tag}` : ''
  try {
    if (kitchenInfo) {
      const k = kitchenInfo
      const innerW = (k.innerHalfWidth ?? k.halfWidth ?? 0) * 2
      const innerD = (k.innerHalfDepth ?? k.halfDepth ?? 0) * 2
      console.log(
        `[KITCHEN${label}] center=(${k.center.x.toFixed(2)}, ${k.center.y.toFixed(2)}, ${k.center.z.toFixed(2)}), floorY=${k.floorY.toFixed(2)}, innerSize≈(${innerW.toFixed(2)} x ${innerD.toFixed(2)})`
      )
    } else {
      console.log(`[KITCHEN${label}] not ready`)
    }
    if (typeof chefRoot !== 'undefined' && chefRoot) {
      const c = chefRoot.position
      console.log(
        `[CHEF${label}] pos=(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})`
      )
    } else {
      console.log(`[CHEF${label}] not spawned`)
    }
    if (playerModel) {
      const p = playerModel.position
      console.log(
        `[PLAYER${label}] pos=(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`
      )
    } else {
      console.log(`[PLAYER${label}] not spawned`)
    }
  } catch (e) {
    console.warn('debugLogLocations failed:', e)
  }
}

// Pick a floor point inside the kitchen bounds using a downward raycast
function pickInteriorPoint(preferNegativeZ = true) {
  if (!kitchenInfo || !kitchenRootRef) return null
  const iw = Math.max(2, kitchenInfo.innerHalfWidth ?? kitchenInfo.halfWidth ?? 6)
  const id = Math.max(2, kitchenInfo.innerHalfDepth ?? kitchenInfo.halfDepth ?? 6)
  const startY = kitchenInfo.floorY + (kitchenInfo.height || 8) + 2
  const dirDown = new THREE.Vector3(0, -1, 0)

  const samples = []
  if (preferNegativeZ) {
    // Favor deeper positions (negative Z) away from the front wall
    const steps = [
      [0.0, -0.30], [0.25, -0.30], [-0.25, -0.30],
      [0.0, -0.55], [0.35, -0.55], [-0.35, -0.55],
      [0.0, -0.80]
    ]
    for (const [nx, nz] of steps) {
      const x = THREE.MathUtils.clamp(nx * iw, -iw + 0.6, iw - 0.6)
      const z = THREE.MathUtils.clamp(nz * id, -id + 0.6, id - 0.6)
      samples.push([x, z])
    }
  } else {
    const x = THREE.MathUtils.clamp(0, -iw + 0.6, iw - 0.6)
    const z = THREE.MathUtils.clamp(0, -id + 0.6, id - 0.6)
    samples.push([x, z])
  }

  for (const [sx, sz] of samples) {
    spawnRay.set(new THREE.Vector3(sx, startY, sz), dirDown)
    const hits = spawnRay.intersectObject(kitchenRootRef, true)
    if (hits && hits.length) {
      const hit = hits[hits.length - 1] // lowest along ray
      const y = Math.max(kitchenInfo.floorY, hit.point.y)
      return new THREE.Vector3(sx, y, sz)
    }
  }
  return null
}

// Sample kitchen floor height at a given X/Z
function groundYAt(x, z) {
  if (!kitchenRootRef || !kitchenInfo) return 0
  const startY = kitchenInfo.floorY + (kitchenInfo.height || 8) + 2
  spawnRay.set(new THREE.Vector3(x, startY, z), new THREE.Vector3(0, -1, 0))
  const hits = spawnRay.intersectObject(kitchenRootRef, true)
  if (hits && hits.length) return Math.max(kitchenInfo.floorY, hits[hits.length - 1].point.y)
  return kitchenInfo.floorY
}

const actions = {
  walk: null,
  slowRun: null,
  run: null,
  idle: null,
  crouchToStand: null,
  crawl: null,
  lookBack: null,
  fallback: null,
}

// Waypoints the chef visits (updated once the kitchen model loads)
const PATH_POINTS = [
  new THREE.Vector3(3.5, 0, 3.5),
  new THREE.Vector3(-3.5, 0, 3.5),
]

const WALK_SPEED = 1.35
const CRAWL_SPEED = 0.55
const SLOW_RUN_SPEED = 2.1
const TURN_THRESHOLD = 0.05
const ORIENTATION_OFFSET = 0

let waypointIndex = 0
let behaviorIndex = 0
let currentBehavior = null

const BEHAVIOR_SEQUENCE = [
  { type: 'idle', duration: 2.5 },
  { type: 'crouchDown' },
  { type: 'crawl', target: 1, speed: CRAWL_SPEED },
  { type: 'standUp' },
  { type: 'idle', duration: 1.6 },
  { type: 'slowRun', target: 2, speed: SLOW_RUN_SPEED },
  { type: 'idle', duration: 1.5 },
  { type: 'walk', target: 3, speed: WALK_SPEED },
  { type: 'idle', duration: 1.8 },
  { type: 'slowRun', target: 0, speed: SLOW_RUN_SPEED },
]

const tempVecA = new THREE.Vector3()
const tempVecB = new THREE.Vector3()

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase()
  keyDisplay.down(event.key)
  keysPressed[key] = true

  if (key === 'shift') {
    if (!event.repeat) playerControls?.switchRunToggle()
  } else if (key === 'c') {
    playerControls?.toggleCameraMode()
  } else if (key === 'l') {
    debugLogLocations('key-L')
  } else if (key === 'm') {
    minimapEnabled = !minimapEnabled
  } else if (key === 'v') {
    debugCollidersVisible = !debugCollidersVisible
    if (debugCollidersVisible) drawColliderHelpers()
    else clearColliderHelpers()
  } else if (key === ' ' || event.code === 'Space') {
    event.preventDefault()
    playerControls?.jump()
  }
})

document.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase()
  keyDisplay.up(event.key)
  keysPressed[key] = false
})

window.addEventListener('blur', () => {
  for (const key of Object.keys(keysPressed)) {
    if (keysPressed[key]) keyDisplay.up(key)
    keysPressed[key] = false
  }
})

const spatulaPromise = Promise.resolve(new THREE.Object3D())

const KITCHEN_SCALE = 0.12
const kitchenReady = new Promise((resolve) => {
  loader.load(
    '/assets/models/kitchen.glb',
    (gltf) => {
      const kitchenRoot = gltf.scene
      kitchenRoot.scale.setScalar(KITCHEN_SCALE)

      kitchenRoot.traverse((child) => {
        if (!child.isMesh) return
        child.castShadow = true
        child.receiveShadow = true
        if (USE_OBJECT_COLLIDERS && child.visible) {
          collidableMeshList.push(child)
          if (DEBUG_COLLISION_HELPERS) {
            const bh = new THREE.BoxHelper(child, 0xff0000)
            scene.add(bh)
          }
        }
      })

      const preBox = new THREE.Box3().setFromObject(kitchenRoot)
      const center = preBox.getCenter(new THREE.Vector3())
      const min = preBox.min.clone()

      // Center the kitchen around the origin and drop the floor to y ~ 0
      kitchenRoot.position.set(-center.x, -min.y, -center.z)
      scene.add(kitchenRoot)
      kitchenRootRef = kitchenRoot

  const box = new THREE.Box3().setFromObject(kitchenRoot)
  const size = box.getSize(new THREE.Vector3())
  const height = size.y

      const focusY = Math.max(1.8, height * 0.22)
      const camHeight = Math.max(2.8, height * 0.42)
      const halfWidth = Math.max(8, size.x * 0.45)
      const halfDepth = Math.max(10, size.z * 0.4)

      const interiorZ = Math.max(3.2, halfDepth * 0.22)
      controls.target.set(0, focusY, interiorZ * 0.25)

      camera.position.set(0, camHeight, -interiorZ * 0.55)
      controls.update()

      const marginX = Math.min(halfWidth * 0.25, 4)
      const marginZ = Math.min(halfDepth * 0.25, 4.5)

      const innerHalfWidth = Math.max(halfWidth - marginX, 2.5)
      const innerHalfDepth = Math.max(halfDepth - marginZ, 3.2)

      PATH_POINTS.length = 0
      PATH_POINTS.push(
        new THREE.Vector3(-innerHalfWidth, 0, innerHalfDepth),
        new THREE.Vector3(innerHalfWidth, 0, innerHalfDepth),
        new THREE.Vector3(innerHalfWidth, 0, -innerHalfDepth),
        new THREE.Vector3(-innerHalfWidth, 0, -innerHalfDepth)
      )

      const centerWorld = box.getCenter(new THREE.Vector3())
      kitchenInfo = {
        box,
        halfWidth,
        halfDepth,
        innerHalfWidth,
        innerHalfDepth,
        height,
        floorY: box.min.y,
        center: centerWorld,
      }

      debugLogLocations('kitchen-loaded')

      resolve(kitchenInfo)
      // Build simple outdoor env once kitchen floor is known
      buildOutside()
      // Build world colliders for furniture/walls so free spaces remain walkable
      if (USE_OBJECT_COLLIDERS) buildKitchenColliders()

      // Tune indoor shadows to tightly fit the kitchen bounds
      try {
        const ext = Math.max(size.x, size.z) * 0.6
        // Main light
        keyLight.target.position.copy(centerWorld)
        keyLight.shadow.camera.left = -ext
        keyLight.shadow.camera.right = ext
        keyLight.shadow.camera.top = ext
        keyLight.shadow.camera.bottom = -ext
        keyLight.shadow.camera.near = 0.1
        keyLight.shadow.camera.far = Math.max(100, size.y * 3)
        // Place the light so it looks into the room
        keyLight.position.set(centerWorld.x + ext, centerWorld.y + size.y * 0.8, centerWorld.z + ext * 0.6)
        keyLight.shadow.camera.updateProjectionMatrix()
        scene.add(keyLight.target)

        // Fill/rim light
        rimLight.target.position.copy(centerWorld)
        rimLight.shadow.camera.left = -ext
        rimLight.shadow.camera.right = ext
        rimLight.shadow.camera.top = ext
        rimLight.shadow.camera.bottom = -ext
        rimLight.shadow.camera.near = 0.1
        rimLight.shadow.camera.far = Math.max(80, size.y * 2.5)
        rimLight.position.set(centerWorld.x - ext * 0.7, centerWorld.y + size.y * 0.6, centerWorld.z - ext * 0.7)
        rimLight.shadow.camera.updateProjectionMatrix()
        scene.add(rimLight.target)

        // Add a dedicated indoor spotlight directly above the room to force player/furniture shadows
        if (roomLight) {
          scene.remove(roomLight)
          scene.remove(roomLight.target)
          roomLight.dispose?.()
        }
        // Stronger, slightly tighter spotlight for vivid indoor shadows
        roomLight = new THREE.SpotLight(0xffffff, 1.6)
        roomLight.name = 'RoomSpot'
        roomLight.position.set(centerWorld.x, centerWorld.y + size.y * 0.95, centerWorld.z)
        roomLight.castShadow = true
        roomLight.angle = Math.PI / 4
        roomLight.penumbra = 0.2
        roomLight.decay = 1
        roomLight.distance = Math.max(size.x, size.z) * 2
        roomLight.shadow.mapSize.set(4096, 4096)
        roomLight.shadow.bias = -0.0002
        roomLight.shadow.normalBias = 0.02
        roomLight.shadow.camera.near = 0.1
        roomLight.shadow.camera.far = Math.max(120, size.y * 3)
        roomLight.target.position.copy(centerWorld)
        scene.add(roomLight)
        scene.add(roomLight.target)
      } catch (e) { /* no-op */ }
    },
    undefined,
    (error) => {
      console.error('GLTF load failed: /assets/models/kitchen.glb', error)
      resolve(null)
    }
  )
})

function makeKitchenEnvironment() {
  return {
    // Rebuild colliders after loading new kitchen meshes
    _rebuildColliders() { buildKitchenColliders() },

    // Get ground height beneath a position
    getGroundInfo(pos, maxDistance = 8) {
      if (!kitchenRootRef) return { y: 0, surface: null }
      const from = new THREE.Vector3(pos.x, pos.y + 2, pos.z)
      spawnRay.set(from, new THREE.Vector3(0, -1, 0))
      const hits = spawnRay.intersectObject(kitchenRootRef, true)
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i]
        const dy = from.y - h.point.y
        if (dy >= 0 && dy <= (maxDistance + 2)) {
          return { y: h.point.y, surface: null }
        }
      }
      return { y: 0, surface: null }
    },

    // -------------------------------------------------------------------------
    // COLLISION SYSTEM — AABB-based
    // -------------------------------------------------------------------------
    resolveCollision(current, desired, radius = 0.12) {
      if (!kitchenInfo) return desired.clone()
      if (!kitchenColliders.length) {
        const bx = kitchenInfo.box
        const margin = WALL_THICKNESS
        const out = desired.clone()
        out.x = THREE.MathUtils.clamp(out.x, bx.min.x + margin, bx.max.x - margin)
        out.z = THREE.MathUtils.clamp(out.z, bx.min.z + margin, bx.max.z - margin)
        return out
      }

      const out = desired.clone()

      // Player bounding box (rough capsule approximation)
      const playerHeight = 1.6
      const playerBox = new THREE.Box3(
        new THREE.Vector3(out.x - radius, kitchenInfo.floorY, out.z - radius),
        new THREE.Vector3(out.x + radius, kitchenInfo.floorY + playerHeight, out.z + radius)
      )

      let collided = false

      // Loop over all furniture / wall colliders
      for (const c of kitchenColliders) {
        const box = c.box
        if (!box) continue
        if (playerBox.intersectsBox(box)) {
          collided = true

          // Compute overlap in X and Z
          const overlapX = Math.min(box.max.x - playerBox.min.x, playerBox.max.x - box.min.x)
          const overlapZ = Math.min(box.max.z - playerBox.min.z, playerBox.max.z - box.min.z)

          // Skip pathological overlaps (likely a perimeter box or malformed collider)
          if (Math.abs(overlapX) > 3 || Math.abs(overlapZ) > 3) continue

          if (Math.abs(overlapX) < 0.015 || Math.abs(overlapZ) < 0.015) continue

          // Push out along smallest overlap axis
          if (overlapX < overlapZ) {
            if (playerBox.min.x < box.min.x) out.x -= overlapX
            else out.x += overlapX
          } else {
            if (playerBox.min.z < box.min.z) out.z -= overlapZ
            else out.z += overlapZ
          }

          // Update playerBox after push to prevent double penetration
          playerBox.min.set(out.x - radius, kitchenInfo.floorY, out.z - radius)
          playerBox.max.set(out.x + radius, kitchenInfo.floorY + playerHeight, out.z + radius)
        }
      }

      // Clamp to outer kitchen walls (safety margin)
      const bx = kitchenInfo.box
      const margin = WALL_THICKNESS
      out.x = THREE.MathUtils.clamp(out.x, bx.min.x + margin, bx.max.x - margin)
      out.z = THREE.MathUtils.clamp(out.z, bx.min.z + margin, bx.max.z - margin)

      if (collided) {
        if (DEBUG_COLLISION_HELPERS) {
          console.log(`[Collision] Adjusted player to (${out.x.toFixed(2)}, ${out.z.toFixed(2)})`)
        }
      }

      return out
    },

    // Check if player inside the kitchen bounds
    isInsideFridgeWorld(p) {
      if (!kitchenInfo) return true
      const iw = kitchenInfo.innerHalfWidth ?? kitchenInfo.halfWidth ?? 6
      const id = kitchenInfo.innerHalfDepth ?? kitchenInfo.halfDepth ?? 6
      return (p.x >= -iw && p.x <= iw && p.z >= -id && p.z <= id)
    },

    // Clamp to fridge interior (used for interior scenes)
    clampToFridgeInterior(pos, radius = 0.12) {
      if (!kitchenInfo) return pos
      // Use same wall thickness margin as resolveCollision
      const bx = kitchenInfo.box
      const margin = WALL_THICKNESS
      const minX = bx.min.x + margin
      const maxX = bx.max.x - margin
      const minZ = bx.min.z + margin
      const maxZ = bx.max.z - margin
      const out = pos.clone()
      out.x = THREE.MathUtils.clamp(out.x, minX, maxX)
      out.z = THREE.MathUtils.clamp(out.z, minZ, maxZ)
      return out
    },
    getSurfaceAt() { return null },
  }
}

function buildKitchenColliders() {
  kitchenColliders = []
  if (!kitchenRootRef || !kitchenInfo) return
  const tempBox = new THREE.Box3()
  const minHeightAsObstacle = Math.max(0.06, kitchenInfo.height * 0.015)
  kitchenRootRef.updateMatrixWorld(true)
  // Build only from visible meshes we registered
  for (const obj of collidableMeshList) {
    tempBox.setFromObject(obj)
    if (tempBox.isEmpty()) continue
    const sz = tempBox.getSize(new THREE.Vector3())
    const lname = (obj.name || '').toLowerCase()
    const skipByName = ['floor','tile','tiles','base','kick','plinth','trim','molding','moulding','skirting','sill']
      .some(k => lname.includes(k))
    const area = sz.x * sz.z
    const isTiny = area < 0.08 || sz.y < minHeightAsObstacle
    const closeToFloor = (tempBox.min.y - kitchenInfo.floorY) < 0.05 && sz.y < 0.25
    if (skipByName || isTiny || closeToFloor) continue
    const inflate = 0.02
    const box = tempBox.clone()
    box.min.x -= inflate; box.min.z -= inflate
    box.max.x += inflate; box.max.z += inflate
    kitchenColliders.push({ box, name: obj.name || '(unnamed mesh)' })
  }
  if (debugCollidersVisible) drawColliderHelpers()
}

function clearColliderHelpers() {
  if (colliderHelpers.length) {
    for (const h of colliderHelpers) scene.remove(h)
    colliderHelpers.length = 0
  }
  if (highlightHelpers.length) {
    for (const h of highlightHelpers) scene.remove(h)
    highlightHelpers.length = 0
  }
}

function drawColliderHelpers() {
  clearColliderHelpers()
  if (!kitchenColliders.length) return
  for (const c of kitchenColliders) {
    const helper = new THREE.Box3Helper(c.box || c, 0xff9800)
    helper.name = 'ColliderHelper'
    scene.add(helper)
    colliderHelpers.push(helper)
  }
}

function probeCollidersHere(radius = 0.6) {
  if (!playerModel || !kitchenColliders.length) {
    console.log('[probe] no player or no colliders')
    return
  }
  // clear previous highlights
  for (const h of highlightHelpers) scene.remove(h)
  highlightHelpers.length = 0
  const p = playerModel.position
  const hits = []
  for (const c of kitchenColliders) {
    const b = c.box || c
    const inside = (p.x > b.min.x - radius && p.x < b.max.x + radius &&
                    p.z > b.min.z - radius && p.z < b.max.z + radius)
    if (inside) {
      hits.push(c)
      const hh = new THREE.Box3Helper(b, 0xff0000)
      scene.add(hh)
      highlightHelpers.push(hh)
    }
  }
  if (hits.length) {
    console.log(`[probe] ${hits.length} collider(s) near player:`)
    hits.forEach((c,i)=>{
      const b=c.box||c
      console.log(`  #${i+1} name=${c.name||'(none)'} min=(${b.min.x.toFixed(2)},${b.min.y.toFixed(2)},${b.min.z.toFixed(2)}) max=(${b.max.x.toFixed(2)},${b.max.y.toFixed(2)},${b.max.z.toFixed(2)})`)
    })
  } else {
    console.log('[probe] no collider near player within', radius)
  }
}

const PLAYER_SCALE = 0.45
const CHEF_SCALE = 5.0
const CHEF_IDLE_ONLY = true
loader.load('assets/models/player.glb', async (gltf) => {
  const kitchen = await kitchenReady

  playerModel = gltf.scene
  playerModel.scale.setScalar(PLAYER_SCALE)
  playerModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      if (child.material && child.material.map) child.material.map.anisotropy = 8
    }
  })

  const playerBox = new THREE.Box3().setFromObject(playerModel)
  const baseOffset = -playerBox.min.y

  function pickInteriorSpawn() {
    if (!kitchenInfo || !kitchenRootRef) return null
    const iw = Math.max(2, kitchenInfo.innerHalfWidth ?? kitchenInfo.halfWidth ?? 6)
    const id = Math.max(2, kitchenInfo.innerHalfDepth ?? kitchenInfo.halfDepth ?? 6)
    const startY = kitchenInfo.floorY + kitchenInfo.height + 2
    const dirDown = new THREE.Vector3(0, -1, 0)
    const samples = []
    // Bias toward negative Z (deeper inside) so we don't land outside the front wall
    const steps = [
      [0.0, -0.30],
      [0.25, -0.30], [-0.25, -0.30],
      [0.0, -0.55], [0.35, -0.55], [-0.35, -0.55],
      [0.0, -0.80]
    ]
    for (const [nx, nz] of steps) {
      const x = THREE.MathUtils.clamp(nx * iw, -iw + 0.6, iw - 0.6)
      const z = THREE.MathUtils.clamp(nz * id, -id + 0.6, id - 0.6)
      samples.push([x, z])
    }
    for (const [sx, sz] of samples) {
      spawnRay.set(new THREE.Vector3(sx, startY, sz), dirDown)
      const hits = spawnRay.intersectObject(kitchenRootRef, true)
      if (hits && hits.length) {
        // choose the closest hit from above (roof/floor), then clamp to floor
        const hit = hits[0]
        const y = Math.max(kitchenInfo.floorY, hit.point.y)
        return new THREE.Vector3(sx, y, sz)
      }
    }
    return null
  }

  let spawn = new THREE.Vector3(0, baseOffset + 0.02, 0)
  const inside = pickInteriorSpawn()
  if (inside) {
    spawn = inside
    spawn.y += baseOffset + 0.02
  } else if (kitchen) {
    const innerDepth = kitchen.innerHalfDepth ?? kitchen.halfDepth ?? 6
    spawn.x = 0
    // Push to negative Z so we start inside the room rather than in front of windows
    spawn.z = -Math.max(1.0, innerDepth - 1.0)
    spawn.y = kitchen.floorY + baseOffset + 0.02
  }

  playerModel.position.copy(spawn)
  if (kitchen) {
    playerModel.lookAt(new THREE.Vector3(0, playerModel.position.y, kitchen.halfDepth || 10))
  }
  scene.add(playerModel)

  debugLogLocations('player-spawn')

  playerMixer = new THREE.AnimationMixer(playerModel)
  const animationsMap = new Map()
  let defaultAction = null

  gltf.animations.forEach((clip) => {
    const lower = clip.name.toLowerCase()
    const action = playerMixer.clipAction(clip)

    if (!defaultAction) defaultAction = lower

    animationsMap.set(clip.name, action)
    animationsMap.set(lower, action)

    if (lower.includes('idle')) animationsMap.set('idle', action)
    if (lower.includes('walk')) animationsMap.set('walk', action)
    if (lower.includes('run')) animationsMap.set('run', action)
    if (lower.includes('jump')) animationsMap.set('jump', action)
    if (lower.includes('climb')) animationsMap.set('climb', action)
  })

  if (!animationsMap.has('idle') && defaultAction) {
    animationsMap.set('idle', animationsMap.get(defaultAction))
  }
  if (!animationsMap.has('walk') && animationsMap.has('run')) {
    animationsMap.set('walk', animationsMap.get('run'))
  }

  ;['idle', 'walk', 'run'].forEach((name) => {
    const action = animationsMap.get(name)
    if (action) {
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
    }
  })

  const startAction = animationsMap.has('idle') ? 'idle' : defaultAction || 'idle'
  playerControls = new CharacterControls(
    playerModel,
    playerMixer,
    animationsMap,
    controls,
    camera,
    startAction
  )

  if (playerControls) {
    // Attach simple environment so gravity/ground and walls behave inside the kitchen
    playerControls.setEnvironment(makeKitchenEnvironment())
    playerControls.toggleRun = false
    const camPos = playerControls.getThirdPersonCameraPos()
    camera.position.copy(camPos)
    playerControls.updateCameraTarget(0, 0)
    controls.target.copy(playerControls.cameraTarget)
    controls.update()
  }
}, undefined, (err) => {
  console.error('GLTF load failed: assets/models/player.glb', err)
})

loader.load('assets/models/chef2.glb', async (gltf) => {
  await kitchenReady
  if (PATH_POINTS.length < 2) {
    PATH_POINTS.length = 0
    PATH_POINTS.push(
      new THREE.Vector3(0, 0, 2.4),
      new THREE.Vector3(0, 0, -2.4)
    )
  }

  chefRoot = gltf.scene
  chefRoot.scale.setScalar(CHEF_SCALE)
  chefRoot.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      if (child.material && child.material.map) child.material.map.anisotropy = 8
    }
  })

  // Attach spatula ------------------------------------------------------------
  const spatula = await spatulaPromise
  spatula.scale.setScalar(0.018)
  spatula.rotation.set(Math.PI / 2, 0, Math.PI / 4)
  spatula.position.set(0.045, -0.02, 0.085)

  const handCandidates = ['mixamorig:RightHand', 'mixamorigRightHand', 'RightHand', 'Armature|RightHand']
  let handBone = null
  for (const name of handCandidates) {
    handBone = chefRoot.getObjectByName(name)
    if (handBone) break
  }
  if (handBone) handBone.add(spatula)
  else scene.add(spatula)

  // Mixer + clips -------------------------------------------------------------
  chefMixer = new THREE.AnimationMixer(chefRoot)
  gltf.animations.forEach((clip) => {
    const lower = clip.name.toLowerCase()
    const action = chefMixer.clipAction(clip)
    if (!actions.fallback) actions.fallback = action
    if (lower.includes('low_crawl')) actions.crawl = action
    else if (lower.includes('crouch_to_stand')) actions.crouchToStand = action
    else if (lower === 'walk') actions.walk = action
    else if (lower.includes('slowrun')) actions.slowRun = action
    else if (lower.includes('run')) actions.run = action
    else if (lower.includes('look_back')) actions.lookBack = action
    else if (lower.includes('idle') || lower.includes('breath')) actions.idle = action
  })

  ;[actions.run, actions.walk, actions.slowRun, actions.crawl, actions.idle, actions.lookBack].forEach((action) => {
    if (action) {
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
    }
  })

  // Lock the feet to sit on the ground plane
  const bound = new THREE.Box3().setFromObject(chefRoot)
  const FOOT_LOCK_EPS = 0.02
  baseY = -bound.min.y + FOOT_LOCK_EPS

  // Spawn chef at a valid interior floor position
  let chefSpawn = pickInteriorPoint(true)
  if (!chefSpawn && kitchenInfo) {
    chefSpawn = new THREE.Vector3(0, kitchenInfo.floorY, -((kitchenInfo.innerHalfDepth ?? kitchenInfo.halfDepth ?? 6) * 0.5))
  }
  const start = chefSpawn ?? PATH_POINTS[0] ?? new THREE.Vector3()
  chefFloorY = start.y ?? kitchenInfo?.floorY ?? 0
  chefRoot.position.set(start.x, chefFloorY + baseY, start.z)
  chefRoot.rotation.set(0, ORIENTATION_OFFSET, 0)
  scene.add(chefRoot)
  console.log(`[CHEF spawn] pos=(${chefRoot.position.x.toFixed(2)}, ${(chefRoot.position.y).toFixed(2)}, ${chefRoot.position.z.toFixed(2)})`)

  if (typeof CHEF_IDLE_ONLY !== 'undefined' && CHEF_IDLE_ONLY) {
    const idleAction = actions.idle || actions.lookBack || actions.fallback
    playAction(idleAction)
  } else {
    waypointIndex = 0
    behaviorIndex = 0
    currentBehavior = null
    beginBehavior(0)
  }
}, undefined, (err) => {
  console.error('GLTF load failed: assets/models/chef2.glb', err)
})

function playAction(action) {
  if (!action || activeAction === action) return
  if (activeAction) activeAction.fadeOut(0.25)
  action.reset().fadeIn(0.25).play()
  activeAction = action
}

function playOneShot(action, { timeScale = 1 } = {}) {
  if (!action) return 0
  if (activeAction && activeAction !== action) activeAction.fadeOut(0.25)
  action.enabled = true
  action.setLoop(THREE.LoopOnce, 1)
  action.clampWhenFinished = true
  action.reset()
  const clipDuration = action.getClip().duration || 1
  if (timeScale < 0) action.time = clipDuration
  action.timeScale = timeScale
  action.fadeIn(0.15).play()
  activeAction = action
  return clipDuration
}

function beginBehavior(index) {
  if (!chefRoot || BEHAVIOR_SEQUENCE.length === 0) return
  behaviorIndex = index % BEHAVIOR_SEQUENCE.length
  const config = BEHAVIOR_SEQUENCE[behaviorIndex]
  currentBehavior = {
    type: config.type,
    remaining: config.duration ?? null,
    targetIndex: config.target ?? null,
    speed: config.speed ?? null,
    moving: config.type === 'crawl' || config.type === 'walk' || config.type === 'slowRun',
  }

  if (
    typeof currentBehavior.targetIndex === 'number' &&
    PATH_POINTS.length > 0
  ) {
    const len = PATH_POINTS.length
    currentBehavior.targetIndex =
      ((currentBehavior.targetIndex % len) + len) % len
  }

  switch (config.type) {
    case 'idle': {
      const idleOptions = [actions.idle, actions.lookBack].filter(Boolean)
      const choice = idleOptions.length
        ? idleOptions[Math.floor(Math.random() * idleOptions.length)]
        : actions.walk || actions.slowRun || actions.fallback
      playAction(choice)
      if (currentBehavior.remaining == null) currentBehavior.remaining = choice?.getClip().duration ?? 2
      chefRoot.position.y = baseY
      break
    }
    case 'crouchDown': {
      const dur = playOneShot(actions.crouchToStand, { timeScale: -1 })
      currentBehavior.remaining = dur || 1.2
      chefRoot.position.y = baseY
      break
    }
    case 'standUp': {
      const dur = playOneShot(actions.crouchToStand, { timeScale: 1 })
      currentBehavior.remaining = dur || 1.2
      chefRoot.position.y = baseY
      break
    }
    case 'crawl': {
      const moveAction = actions.crawl || actions.walk || actions.slowRun || actions.fallback
      playAction(moveAction)
      currentBehavior.speed = currentBehavior.speed ?? CRAWL_SPEED
      if (currentBehavior.targetIndex == null && PATH_POINTS.length > 1) {
        currentBehavior.targetIndex = (waypointIndex + 1) % PATH_POINTS.length
      }
      break
    }
    case 'walk': {
      const moveAction = actions.walk || actions.slowRun || actions.run || actions.fallback
      playAction(moveAction)
      currentBehavior.speed = currentBehavior.speed ?? WALK_SPEED
      if (currentBehavior.targetIndex == null && PATH_POINTS.length > 1) {
        currentBehavior.targetIndex = (waypointIndex + 1) % PATH_POINTS.length
      }
      break
    }
    case 'slowRun': {
      const moveAction = actions.slowRun || actions.run || actions.walk || actions.fallback
      playAction(moveAction)
      currentBehavior.speed = currentBehavior.speed ?? SLOW_RUN_SPEED
      if (currentBehavior.targetIndex == null && PATH_POINTS.length > 1) {
        currentBehavior.targetIndex = (waypointIndex + 1) % PATH_POINTS.length
      }
      break
    }
    default: {
      if (currentBehavior.remaining == null) currentBehavior.remaining = 1.5
      chefRoot.position.y = baseY
    }
  }
}

function advanceBehavior() {
  currentBehavior = null
  behaviorIndex = (behaviorIndex + 1) % BEHAVIOR_SEQUENCE.length
  beginBehavior(behaviorIndex)
}

function updateBehavior(delta) {
  if (!chefRoot || !currentBehavior) return

  if (currentBehavior.moving && typeof currentBehavior.targetIndex === 'number') {
    const reached = moveTowardsWaypoint(delta, currentBehavior.targetIndex, currentBehavior.speed ?? WALK_SPEED)
    if (reached) {
      waypointIndex = currentBehavior.targetIndex
      advanceBehavior()
      return
    }
  }

  if (typeof currentBehavior.remaining === 'number') {
    currentBehavior.remaining -= delta
    if (currentBehavior.remaining <= 0) {
      advanceBehavior()
    }
  }
}

function moveTowardsWaypoint(delta, targetIndex, speed) {
  const len = PATH_POINTS.length
  if (len === 0) return true
  const safeIndex = ((targetIndex % len) + len) % len
  const target = PATH_POINTS[safeIndex]
  tempVecA.copy(target).sub(chefRoot.position)
  tempVecB.set(tempVecA.x, 0, tempVecA.z)
  const distance = tempVecB.length()

  if (distance < TURN_THRESHOLD) {
    chefRoot.position.set(target.x, baseY, target.z)
    orientTowards(tempVecB)
    chefRoot.position.y = baseY
    return true
  }

  const travel = speed * delta
  if (distance <= travel) {
    const gy = groundYAt(target.x, target.z)
    chefRoot.position.set(target.x, gy + baseY, target.z)
    orientTowards(tempVecB)
    return true
  }

  tempVecB.normalize()
  const nextPos = chefRoot.position.clone().addScaledVector(tempVecB, travel)
  const gy = groundYAt(nextPos.x, nextPos.z)
  chefRoot.position.set(nextPos.x, gy + baseY, nextPos.z)
  orientTowards(tempVecB)
  return false
}

function orientTowards(direction) {
  const lenSq = direction.x * direction.x + direction.z * direction.z
  if (lenSq === 0) return
  const yaw = Math.atan2(direction.x, direction.z) + ORIENTATION_OFFSET
  chefRoot.rotation.set(0, yaw, 0)
}

// ----------------------------------------------------------------------------- //
// Render Loop
// ----------------------------------------------------------------------------- //
function animate() {
  requestAnimationFrame(animate)
  const delta = clock.getDelta()

  if (chefMixer) chefMixer.update(delta)
  if (playerControls) playerControls.update(delta, keysPressed)

  if (!CHEF_IDLE_ONLY) updateBehavior(delta)

  controls.update()
  renderer.render(scene, camera)

  // Minimap overlay
  if (minimapEnabled) {
    const focus = (playerModel && playerModel.position) || (chefRoot && chefRoot.position)
    if (focus) {
      const mapHeight = 35
      minimapCamera.position.set(focus.x, (focus.y || 0) + mapHeight, focus.z)
      minimapCamera.lookAt(focus.x, (focus.y || 0), focus.z)
    }
    renderer.clearDepth()
    renderer.setScissorTest(true)
    const w = minimapSize
    const h = minimapSize
    const x = window.innerWidth - w - minimapMargin
    const y = minimapMargin
    renderer.setViewport(x, y, w, h)
    renderer.setScissor(x, y, w, h)
    minimapCamera.aspect = 1
    minimapCamera.updateProjectionMatrix()
    renderer.render(scene, minimapCamera)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight)
  }
}

animate()

// ----------------------------------------------------------------------------- //
// Resize handling
// ----------------------------------------------------------------------------- //
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  keyDisplay.updatePosition()
  minimapCamera.aspect = 1
  minimapCamera.updateProjectionMatrix()
}) 
