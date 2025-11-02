import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CharacterControls } from './CharacterControls.js'
import { UI } from './ui.js'

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
document.getElementById('root').appendChild(renderer.domElement);

// Hide canvas until game starts - user should only see UI menus first
renderer.domElement.style.display = 'none';

// No HDRI environment/background; keep simple background color

// Minimap camera (top-down)
const minimapCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000)
minimapCamera.up.set(0, 0, -1)
let minimapEnabled = true
let minimapSize = 220 // pixels
let minimapMargin = 12

// Create minimap render target
const minimapRenderTarget = new THREE.WebGLRenderTarget(minimapSize, minimapSize)
const minimapScene = new THREE.Scene()
minimapScene.background = new THREE.Color(0x1a1a2e)

// Minimap objects with pulsing animation
const minimapPlayer = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
)
minimapPlayer.name = 'minimapPlayer'
minimapPlayer.userData.pulseSpeed = 2
minimapPlayer.userData.pulsePhase = 0
minimapScene.add(minimapPlayer)

const minimapChef = new THREE.Mesh(
  new THREE.SphereGeometry(0.4, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0xff6600 })
)
minimapChef.name = 'minimapChef'
minimapChef.userData.pulseSpeed = 1.5
minimapChef.userData.pulsePhase = Math.PI
minimapScene.add(minimapChef)

// Kitchen furniture for minimap
const minimapFurniture = new THREE.Group()
minimapFurniture.name = 'minimapFurniture'
minimapScene.add(minimapFurniture)

// Kitchen bounds for minimap
let minimapKitchenBounds = null

// Minimap animation
let minimapTime = 0

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


let kitchenInfo = null
let kitchenRootRef = null
const spawnRay = new THREE.Raycaster()
// Feature flag: keep object-AABB collisions OFF to avoid movement glitches
// Turn on only when testing: set to true and refresh.
const USE_OBJECT_COLLIDERS = true
// Visible mesh list used for collisions (only meshes that are actually visible)
const collidableMeshList = []
const DEBUG_COLLISION_HELPERS = false
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

  // ESC key for pausing
  if (key === 'escape') {
    if (gameStarted && !ui.pause.style.display || ui.pause.style.display === 'none') {
      gameStarted = false
      ui.showPause(true)
      document.exitPointerLock?.()
    } else if (ui.pause.style.display === 'flex') {
      ui.showPause(false)
      resumeGame()
    }
    return
  }

  // Don't process game keys if game hasn't started
  if (!gameStarted) return

  keysPressed[key] = true

  if (key === 'shift') {
    if (!event.repeat) playerControls?.switchRunToggle()
  } else if (key === 'c') {
    playerControls?.toggleCameraMode()
  } else if (key === 'l') {
    debugLogLocations('key-L')
  } else if (key === 'p') {
    // Log current player position for manual collision box placement
    if (playerModel) {
      const pos = playerModel.position
      console.log('=== PLAYER POSITION ===')
      console.log(`Position: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}, z=${pos.z.toFixed(2)}`)
      console.log(`Code: new THREE.Vector3(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`)

      // Check which collision boxes contain this position
      if (kitchenColliders.length) {
        const radius = 0.12
        const colliding = []
        for (const c of kitchenColliders) {
          const b = c.box
          if (pos.x + radius > b.min.x && pos.x - radius < b.max.x &&
              pos.z + radius > b.min.z && pos.z - radius < b.max.z) {
            colliding.push(c.name)
          }
        }
        if (colliding.length > 0) {
          console.log(`INSIDE COLLIDERS: ${colliding.join(', ')}`)
        } else {
          console.log('NOT INSIDE ANY COLLIDERS - CAN WALK HERE')
        }
      }

      console.log('Stand at wall edge and press P again to get coordinates')
    }
  } else if (key === 'm') {
    minimapEnabled = !minimapEnabled
  } else if (key === 'v') {
    // no-op: debug toggle disabled
  } else if (key === ' ' || event.code === 'Space') {
    event.preventDefault()
    playerControls?.jump()
  }
})

document.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase()
  
  keysPressed[key] = false
})

window.addEventListener('blur', () => {
  for (const key of Object.keys(keysPressed)) {
    
    keysPressed[key] = false
  }
})

// Game state
let gameStarted = false
let assetsLoaded = false
let loadingStarted = false

// UI System
const ui = new UI({
  onStart: () => {
    if (!loadingStarted) {
      loadingStarted = true
      ui.showLoading(true)
      loadAllAssets()
    }
  },
  onNew: () => {
    location.reload()
  },
  onResume: () => {
    ui.showPause(false)
    resumeGame()
  },
  onExit: () => {
    window.close()
  },
  onSettingsChange: (settings) => {
    console.log('Settings changed:', settings)

    // Apply quality/pixel ratio
    if (settings.quality) {
      const pixelRatio = settings.quality === 'ultra' ? 2 : settings.quality === 'high' ? 1.5 : settings.quality === 'medium' ? 1 : 0.75
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatio))
      console.log(`✓ Quality set to ${settings.quality} (pixel ratio: ${pixelRatio})`)
    }

    // Apply shadows setting
    if (settings.shadows !== undefined) {
      renderer.shadowMap.enabled = settings.shadows
      console.log(`✓ Shadows ${settings.shadows ? 'enabled' : 'disabled'}`)
    }

    // Note: Anti-aliasing cannot be changed after renderer creation
    // It's a WebGL context parameter set when the renderer is created
  }
})

// Initial loading sequence
async function initializeApp() {
  ui.setInitialLoadingProgress(30, 'Initializing...')

  await new Promise(resolve => setTimeout(resolve, 500))
  ui.setInitialLoadingProgress(60, 'Preparing scene...')

  await new Promise(resolve => setTimeout(resolve, 500))
  ui.setInitialLoadingProgress(90, 'Almost ready...')

  await new Promise(resolve => setTimeout(resolve, 300))

  await ui.completeInitialLoading()
}

// Start initial loading when page loads
initializeApp()

function startGame() {
  gameStarted = true
  ui.showLoading(false)
  // Show the game canvas now that everything is loaded
  renderer.domElement.style.display = 'block';
  document.body.requestPointerLock?.()
}

function resumeGame() {
  gameStarted = true
  document.body.requestPointerLock?.()
}

// Asset loading with progress tracking
async function loadAllAssets() {
  try {
    ui.setLoadingProgress(60, 'Loading...')

    // Wait for kitchen to load
    await kitchenReady
    ui.setLoadingProgress(90, 'Loading...')

    // Wait for player to load with timeout
    let checkPlayer
    await Promise.race([
      new Promise(resolve => {
        checkPlayer = setInterval(() => {
          if (playerModel && playerControls) {
            clearInterval(checkPlayer)
            resolve()
          }
        }, 1)
      }),
      new Promise(resolve => setTimeout(() => {
        if (checkPlayer) clearInterval(checkPlayer)
        resolve()
      }, 3000)) // Max 3 seconds
    ])

    ui.setLoadingProgress(100, 'Ready!')

    // Tiny delay
    await new Promise(resolve => setTimeout(resolve, 50))

    assetsLoaded = true
    startGame()
  } catch (error) {
    console.error('Asset loading failed:', error)
    ui.setLoadingProgress(0, 'Loading failed. Please refresh.')
  }
}

const spatulaPromise = Promise.resolve(new THREE.Object3D())

// Variable to store chef model reference for loading check
let chefModel = null

// Kitchen loading
const KITCHEN_SCALE = 0.12
const PLAYER_SCALE = 0.45
const CHEF_SCALE = 5.0
const CHEF_IDLE_ONLY = true

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
        }
      })

      const preBox = new THREE.Box3().setFromObject(kitchenRoot)
      const center = preBox.getCenter(new THREE.Vector3())
      const min = preBox.min.clone()

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

      createEnhancedMinimap(size, centerWorld)
      debugLogLocations('kitchen-loaded')
      resolve(kitchenInfo)
      buildOutside()
      if (USE_OBJECT_COLLIDERS) buildKitchenColliders()
    },
    undefined,
    (error) => {
      console.error('Kitchen load failed:', error)
      resolve(null)
    }
  )
})

// Player loading
loader.load('/assets/models/player.glb', (gltf) => {
  playerModel = gltf.scene
  playerModel.scale.setScalar(PLAYER_SCALE)
  playerModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  kitchenReady.then((info) => {
    if (!info) return
    const spawnPt = pickInteriorPoint(true)
    if (spawnPt) {
      playerModel.position.copy(spawnPt)
      playerModel.position.y = spawnPt.y
    }
    scene.add(playerModel)

    const mixer = new THREE.AnimationMixer(playerModel)
    const animationsMap = new Map()
    gltf.animations.forEach((a) => {
      animationsMap.set(a.name, mixer.clipAction(a))
    })

    playerControls = new CharacterControls(
      playerModel,
      mixer,
      animationsMap,
      controls,
      camera,
      'player'
    )

    if (playerControls) {
      playerControls.setEnvironment(makeKitchenEnvironment())
      playerControls.toggleRun = false
      const camPos = playerControls.getThirdPersonCameraPos()
      camera.position.copy(camPos)
      playerControls.updateCameraTarget(0, 0)
      controls.target.copy(playerControls.cameraTarget)
      controls.update()
    }

    debugLogLocations('player-spawn')
  })
}, undefined, (err) => console.error('Player load failed:', err))

// Chef loading
loader.load('/assets/models/chef2.glb', (gltf) => {
  chefModel = gltf.scene
  chefRoot = gltf.scene
  chefRoot.scale.setScalar(CHEF_SCALE)

  chefRoot.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  kitchenReady.then((info) => {
    if (!info) return
    const spawnPt = pickInteriorPoint(false) || new THREE.Vector3(0, 0, 0)
    chefRoot.position.set(spawnPt.x, spawnPt.y, spawnPt.z)
    scene.add(chefRoot)

    chefMixer = new THREE.AnimationMixer(chefRoot)
    const clips = gltf.animations
    if (clips && clips.length) {
      clips.forEach((clip) => {
        const action = chefMixer.clipAction(clip)
        const name = clip.name?.toLowerCase() || ''
        if (name.includes('walk')) actions.walk = action
        else if (name.includes('slowrun')) actions.slowRun = action
        else if (name.includes('run')) actions.run = action
        else if (name.includes('idle')) actions.idle = action
        else if (name.includes('crouch')) actions.crouchToStand = action
        else if (name.includes('crawl')) actions.crawl = action
        else if (name.includes('lookback')) actions.lookBack = action
        else if (!actions.fallback) actions.fallback = action
      })
    }

    const firstAction = actions.idle || actions.walk || actions.fallback
    if (firstAction) {
      firstAction.play()
      activeAction = firstAction
    }

    debugLogLocations('chef-spawn')
    if (!CHEF_IDLE_ONLY) beginBehavior(0)
  })
}, undefined, (err) => console.error('Chef load failed:', err))

function createEnhancedMinimap(size, center) {
  // Clear previous minimap furniture
  while (minimapFurniture.children.length > 0) {
    minimapFurniture.remove(minimapFurniture.children[0])
  }

  // Create kitchen floor with animated grid
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x, size.z),
    new THREE.MeshBasicMaterial({ 
      color: 0x2a2a4a,
      transparent: true,
      opacity: 0.8
    })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(center.x, -0.1, center.z)
  floor.userData.pulse = true
  minimapScene.add(floor)

  // Create kitchen walls with outline
  const wallThickness = 0.3
  const wallHeight = 0.5
  const wallMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x4a4a6a,
    transparent: true,
    opacity: 0.7
  })
  
  // North wall
  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, wallHeight, wallThickness),
    wallMaterial
  )
  northWall.position.set(center.x, wallHeight/2, center.z - size.z/2 + wallThickness/2)
  minimapScene.add(northWall)

  // South wall
  const southWall = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, wallHeight, wallThickness),
    wallMaterial
  )
  southWall.position.set(center.x, wallHeight/2, center.z + size.z/2 - wallThickness/2)
  minimapScene.add(southWall)

  // East wall
  const eastWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, size.z),
    wallMaterial
  )
  eastWall.position.set(center.x + size.x/2 - wallThickness/2, wallHeight/2, center.z)
  minimapScene.add(eastWall)

  // West wall
  const westWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, size.z),
    wallMaterial
  )
  westWall.position.set(center.x - size.x/2 + wallThickness/2, wallHeight/2, center.z)
  minimapScene.add(westWall)

  // Create animated furniture
  createMinimapFurniture(size, center)
}

function createMinimapFurniture(size, center) {
  const furnitureData = [
    // Counters (rectangles along walls)
    { type: 'counter', x: center.x - size.x * 0.3, z: center.z - size.z * 0.4, width: 2, depth: 0.8, color: 0x8b4513 },
    { type: 'counter', x: center.x + size.x * 0.3, z: center.z - size.z * 0.4, width: 2, depth: 0.8, color: 0x8b4513 },
    { type: 'counter', x: center.x, z: center.z + size.z * 0.3, width: 3, depth: 0.8, color: 0x8b4513 },
    
    // Table (center)
    { type: 'table', x: center.x, z: center.z - size.z * 0.1, width: 1.5, depth: 1, color: 0x654321 },
    
    // Fridge (tall rectangle)
    { type: 'fridge', x: center.x - size.x * 0.4, z: center.z + size.z * 0.4, width: 0.8, depth: 0.6, color: 0xffffff },
    
    // Island (larger rectangle)
    { type: 'island', x: center.x, z: center.z, width: 2.5, depth: 1.2, color: 0xa0522d },
    
    // Sink (small square)
    { type: 'sink', x: center.x + size.x * 0.35, z: center.z + size.z * 0.35, width: 0.6, depth: 0.6, color: 0x708090 },
    
    // Stove (small square with red elements)
    { type: 'stove', x: center.x - size.x * 0.35, z: center.z + size.z * 0.35, width: 0.7, depth: 0.7, color: 0x333333 }
  ]

  furnitureData.forEach((item, index) => {
    let geometry
    let material
    
    switch (item.type) {
      case 'fridge':
        geometry = new THREE.BoxGeometry(item.width, 1.2, item.depth)
        material = new THREE.MeshBasicMaterial({ 
          color: item.color,
          transparent: true,
          opacity: 0.9
        })
        break
      case 'table':
        geometry = new THREE.CylinderGeometry(item.width/2, item.width/2, 0.3, 8)
        material = new THREE.MeshBasicMaterial({ 
          color: item.color,
          transparent: true,
          opacity: 0.8
        })
        break
      case 'stove':
        geometry = new THREE.BoxGeometry(item.width, 0.4, item.depth)
        material = new THREE.MeshBasicMaterial({ 
          color: item.color,
          transparent: true,
          opacity: 0.9
        })
        break
      default:
        geometry = new THREE.BoxGeometry(item.width, 0.4, item.depth)
        material = new THREE.MeshBasicMaterial({ 
          color: item.color,
          transparent: true,
          opacity: 0.7
        })
    }

    const furniture = new THREE.Mesh(geometry, material)
    furniture.position.set(item.x, 0.2, item.z)
    furniture.userData = {
      type: item.type,
      pulseSpeed: 0.5 + Math.random() * 1,
      pulsePhase: Math.random() * Math.PI * 2,
      originalY: 0.2,
      hoverHeight: 0.1,
      rotationSpeed: item.type === 'table' ? 0.2 : 0
    }
    
    // Add special effects based on furniture type
    if (item.type === 'stove') {
      // Add red burner dots
      const burnerGeometry = new THREE.SphereGeometry(0.1, 6, 6)
      const burnerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        transparent: true,
        opacity: 0.8
      })
      
      for (let i = -1; i <= 1; i += 2) {
        for (let j = -1; j <= 1; j += 2) {
          const burner = new THREE.Mesh(burnerGeometry, burnerMaterial)
          burner.position.set(i * 0.2, 0.3, j * 0.2)
          burner.userData.pulseSpeed = 3
          burner.userData.pulsePhase = Math.random() * Math.PI * 2
          furniture.add(burner)
        }
      }
    }
    
    if (item.type === 'fridge') {
      // Add fridge door handle
      const handleGeometry = new THREE.BoxGeometry(0.05, 0.2, 0.02)
      const handleMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 })
      const handle = new THREE.Mesh(handleGeometry, handleMaterial)
      handle.position.set(0.3, 0, 0)
      furniture.add(handle)
    }

    minimapFurniture.add(furniture)
  })
}

function updateMinimapAnimation(delta) {
  minimapTime += delta
  
  // Update player and chef pulsing
  updatePulsing(minimapPlayer, delta)
  updatePulsing(minimapChef, delta)
  
  // Update furniture animations
  minimapFurniture.children.forEach((furniture) => {
    updatePulsing(furniture, delta)
    
    // Special animations based on furniture type
    switch (furniture.userData.type) {
      case 'table':
        furniture.rotation.y += furniture.userData.rotationSpeed * delta
        break
      case 'fridge':
        // Gentle fridge hum/vibration
        furniture.position.y = furniture.userData.originalY + Math.sin(minimapTime * 8) * 0.02
        break
      case 'stove':
        // Stove glow effect on burners
        furniture.children.forEach((burner) => {
          if (burner.userData) {
            const pulse = Math.sin(minimapTime * burner.userData.pulseSpeed + burner.userData.pulsePhase)
            burner.material.opacity = 0.6 + 0.4 * pulse
            burner.scale.setScalar(0.8 + 0.4 * pulse)
          }
        })
        break
    }
    
    // Hover animation for all furniture
    const hover = Math.sin(minimapTime * furniture.userData.pulseSpeed + furniture.userData.pulsePhase)
    furniture.position.y = furniture.userData.originalY + hover * furniture.userData.hoverHeight
  })
}

function updatePulsing(object, delta) {
  if (!object.userData) return
  
  const pulse = Math.sin(minimapTime * object.userData.pulseSpeed + object.userData.pulsePhase)
  const scale = 0.8 + 0.4 * (pulse * 0.5 + 0.5)
  object.scale.setScalar(scale)
  
  // Color pulsing for player and chef
  if (object === minimapPlayer || object === minimapChef) {
    const intensity = 0.7 + 0.3 * (pulse * 0.5 + 0.5)
    object.material.color.multiplyScalar(intensity / object.material.color.r)
  }
}

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

  let out = desired.clone()

  // Player bounding box (rough capsule approximation)
  const playerHeight = 1.6
  let playerBox = new THREE.Box3(
    new THREE.Vector3(out.x - radius, kitchenInfo.floorY, out.z - radius),
    new THREE.Vector3(out.x + radius, kitchenInfo.floorY + playerHeight, out.z + radius)
  )

  let collided = false

  // Iterative collision resolution
  for (let iteration = 0; iteration < 10; iteration++) {
    let hadCollision = false

    // Loop over all furniture / wall colliders
    for (const c of kitchenColliders) {
      const box = c.box
      if (!box) continue

      if (playerBox.intersectsBox(box)) {
        collided = true
        hadCollision = true

        // Calculate penetration from all sides
        const penetrationLeft = playerBox.max.x - box.min.x
        const penetrationRight = box.max.x - playerBox.min.x
        const penetrationBack = playerBox.max.z - box.min.z
        const penetrationForward = box.max.z - playerBox.min.z

        const minPenX = Math.min(penetrationLeft, penetrationRight)
        const minPenZ = Math.min(penetrationBack, penetrationForward)

        // Skip if too deep or too shallow
        if (minPenX > 2.25 || minPenZ > 2.25) continue
        if (minPenX < 0.001 || minPenZ < 0.001) continue

        // Push out on axis with smallest penetration
        if (minPenX < minPenZ) {
          if (penetrationLeft < penetrationRight) {
            out.x -= minPenX + 0.001
          } else {
            out.x += minPenX + 0.001
          }
        } else {
          if (penetrationBack < penetrationForward) {
            out.z -= minPenZ + 0.001
          } else {
            out.z += minPenZ + 0.001
          }
        }

        // Recreate playerBox after push
        playerBox = new THREE.Box3(
          new THREE.Vector3(out.x - radius, kitchenInfo.floorY, out.z - radius),
          new THREE.Vector3(out.x + radius, kitchenInfo.floorY + playerHeight, out.z + radius)
        )
      }
    }

    if (!hadCollision) break
  }

  // REMOVE THIS PROBLEMATIC CLAMPING - Your manual collision boxes already handle boundaries
  // const bx = kitchenInfo.box
  // const margin = WALL_THICKNESS
  // out.x = THREE.MathUtils.clamp(out.x, bx.min.x + margin, bx.max.x - margin)
  // out.z = THREE.MathUtils.clamp(out.z, bx.min.z + margin, bx.max.z - margin)

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

  // ADD WALLS FIRST - scan ALL Material meshes for walls
  const wallHeight = kitchenInfo.height || 8
  const floorY = kitchenInfo.floorY
  let wallCount = 0

  kitchenRootRef.traverse((child) => {
    if (!child.isMesh) return
    const name = (child.name || '').toLowerCase()

    if (name.startsWith('material')) {
      tempBox.setFromObject(child)
      if (tempBox.isEmpty()) return

      const size = tempBox.getSize(new THREE.Vector3())

      // SUPER AGGRESSIVE: Add almost everything as walls
      // Just exclude tiny stuff and things that are thick in BOTH dimensions
      const notMicroscopic = (size.x > 0.05 && size.z > 0.05 && size.y > 0.3)
      const notMassiveCube = !(size.x > 2 && size.z > 2 && size.y > 2)

      if (notMicroscopic && notMassiveCube) {
        const box = tempBox.clone()
        box.min.y = floorY
        box.max.y = floorY + wallHeight

        // No inflation - use exact wall geometry to avoid teleportation issues
        // Manual collision boxes will fill any gaps

        kitchenColliders.push({ box, name: `Wall: ${child.name}` })
        wallCount++
      }
    }
  })

  console.log(`[Colliders] Added ${wallCount} walls`)

  // Build furniture colliders from visible meshes we registered
  let furnitureCount = 0
  for (const obj of collidableMeshList) {
    tempBox.setFromObject(obj)
    if (tempBox.isEmpty()) continue
    const sz = tempBox.getSize(new THREE.Vector3())
    const lname = (obj.name || '').toLowerCase()

    // Skip floor elements AND chef/character
    const skipByName = ['floor','tile','tiles','base','kick','plinth','trim','molding','moulding','skirting','sill','chef','character','npc']
      .some(k => lname.includes(k))
    const area = sz.x * sz.z
    const isTiny = area < 0.08 || sz.y < minHeightAsObstacle
    const closeToFloor = (tempBox.min.y - kitchenInfo.floorY) < 0.05 && sz.y < 0.25
    if (skipByName || isTiny || closeToFloor) continue

    const inflate = 0.02
    const box = tempBox.clone()
    box.min.x -= inflate; box.min.z -= inflate
    box.max.x += inflate; box.max.z += inflate

    // Remove top collision - reduce max.y by 15% of height to allow walking over tables
    const height = box.max.y - box.min.y
    box.max.y = box.max.y - (height * 0.15)

    kitchenColliders.push({ box, name: obj.name || '(unnamed mesh)' })
    furnitureCount++
  }

  console.log(`[Colliders] ✓ Built ${kitchenColliders.length} total colliders (${wallCount} walls + ${furnitureCount} furniture)`)

  // Add manual collision boxes here (for missing walls)
  addManualCollisionBoxes()

  if (debugCollidersVisible) drawColliderHelpers()
}

// Add manual collision boxes for areas with missing collision
// Add manual collision boxes for areas with missing collision
// Add manual collision boxes for areas with missing collision
function addManualCollisionBoxes() {
  const floorY = kitchenInfo.floorY
  const wallHeight = 2.4

  // Manual collider at walkthrough locations
  // Extended to cover full walkthrough range: z=-25.47 to z=-25.20
  const walkthroughBlocker = new THREE.Box3(
    new THREE.Vector3(-10, floorY, -26.0),
    new THREE.Vector3(10, floorY + wallHeight, -25.0)
  )
  kitchenColliders.push({ box: walkthroughBlocker, name: 'Manual: Back Wall Blocker' })
  console.log('[Colliders] ✓ Added manual collision box at z=-26.0 to z=-25.0')

  // SINGLE CONTINUOUS RIGHT WALL - NO OVERLAPS
  const rightWallGap = new THREE.Box3(
    new THREE.Vector3(9.0, floorY, -26.0),
    new THREE.Vector3(15.0, floorY + wallHeight, -23.0)
  )
  kitchenColliders.push({ box: rightWallGap, name: 'Manual: Right Wall Complete' })
  console.log('[Colliders] ✓ Added continuous right wall collision (x=7.5-15.0)')

    // In addManualCollisionBoxes(), add this specific collision box:
const gap1176 = new THREE.Box3(
  new THREE.Vector3(11.5, floorY, -26.0),
  new THREE.Vector3(12.5, floorY + wallHeight, -25.5)
)
kitchenColliders.push({ box: gap1176, name: 'Manual: x=11.76 Gap' })
console.log('[Colliders] ✓ Added collision box for x=11.76 gap (x=11.5-12.0, z=-26.0 to -25.5)')

  // Gap around position x=3.69, z=-25.55 (right side gap)
  const rightGapBlocker = new THREE.Box3(
    new THREE.Vector3(2.0, floorY, -26.0),
    new THREE.Vector3(5.0, floorY + wallHeight, -25.0)
  )
  kitchenColliders.push({ box: rightGapBlocker, name: 'Manual: Right Back Wall Gap' })
  console.log('[Colliders] ✓ Added collision box for right gap (x=2.0-5.0, z=-26.0 to -25.0)')

  // Gap around position x=-0.27, z=-25.04 (center gap)  
  const centerGapBlocker = new THREE.Box3(
    new THREE.Vector3(-2.0, floorY, -26.0),
    new THREE.Vector3(2.0, floorY + wallHeight, -25.0)
  )
  kitchenColliders.push({ box: centerGapBlocker, name: 'Manual: Center Back Wall Gap' })
  console.log('[Colliders] ✓ Added collision box for center gap (x=-2.0-2.0, z=-26.0 to -25.0)')
  // In addManualCollisionBoxes(), add this:
  const leftWallGap = new THREE.Box3(
    new THREE.Vector3(-12.0, floorY, -52.0),
    new THREE.Vector3(-8.5, floorY + wallHeight, -51.5)
  )
  kitchenColliders.push({ box: leftWallGap, name: 'Manual: Left Wall x=-11.77 Gap' })
  console.log('[Colliders] ✓ Added collision box for left wall gap at x=-11.77')
  // Complete back wall coverage to be absolutely sure
  const fullBackWallBlocker = new THREE.Box3(
    new THREE.Vector3(-15, floorY, -25.8),
    new THREE.Vector3(15, floorY + wallHeight, -25.0)
  )
  kitchenColliders.push({ box: fullBackWallBlocker, name: 'Manual: Full Back Wall' })
  console.log('[Colliders] ✓ Added full back wall collision (x=-15-15, z=-25.8 to -25.0)')

  // Gap at x=-11.85 to x=-8.61, z=-46.49 to z=-46.14
  const midLeftWallGap = new THREE.Box3(
    new THREE.Vector3(-12.0, floorY, -46.6),
    new THREE.Vector3(-8.5, floorY + wallHeight, -46.0)
  )
  kitchenColliders.push({ box: midLeftWallGap, name: 'Manual: Mid Left Wall Gap z=-46' })
  console.log('[Colliders] ✓ Added collision box at x=-11.85 to -8.61, z=-46.49 to -46.14')
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

  // Only update game logic if game has started
  if (gameStarted) {
    if (chefMixer) chefMixer.update(delta)
    if (playerControls) playerControls.update(delta, keysPressed)

    if (!CHEF_IDLE_ONLY) updateBehavior(delta)
  }

  controls.update()
  renderer.render(scene, camera)

  // Update minimap only when game is active
  if (gameStarted && minimapEnabled) {
    // Update minimap positions
    if (playerModel) {
      minimapPlayer.position.set(playerModel.position.x, 0, playerModel.position.z)
    }
    if (chefRoot) {
      minimapChef.position.set(chefRoot.position.x, 0, chefRoot.position.z)
    }

    // Update minimap animations
    updateMinimapAnimation(delta)

    // Render minimap
    // Position minimap camera above the scene
    const focus = playerModel ? playerModel.position : (chefRoot ? chefRoot.position : new THREE.Vector3(0, 0, 0))
    minimapCamera.position.set(focus.x, 35, focus.z)
    minimapCamera.lookAt(focus.x, 0, focus.z)

    // Render minimap to texture
    renderer.setRenderTarget(minimapRenderTarget)
    renderer.render(minimapScene, minimapCamera)
    renderer.setRenderTarget(null)

    // Draw minimap to screen
    renderer.clearDepth()
    const w = minimapSize
    const h = minimapSize
    const x = window.innerWidth - w - minimapMargin
    const y = minimapMargin
    
    // Draw minimap background with border
    renderer.setScissorTest(true)
    renderer.setScissor(x, y, w, h)
    renderer.setViewport(x, y, w, h)
    
    // Create a background for the minimap with enhanced styling
    const backgroundScene = new THREE.Scene()
    const backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    
    // Background with gradient effect
    const backgroundGeometry = new THREE.PlaneGeometry(2, 2)
    const backgroundMaterial = new THREE.MeshBasicMaterial({ 
      map: minimapRenderTarget.texture,
      transparent: true,
      opacity: 0.95
    })
    const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial)
    backgroundScene.add(backgroundMesh)
    
    // Add border
    const borderGeometry = new THREE.RingGeometry(0.98, 1, 32)
    const borderMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    })
    const border = new THREE.Mesh(borderGeometry, borderMaterial)
    border.rotation.x = Math.PI
    backgroundScene.add(border)
    
    renderer.render(backgroundScene, backgroundCamera)
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
  window.game = {
  scene,
  camera,
  renderer,
  controls,
  playerControls,
  chefRoot,
  kitchenRootRef,
  ui,
  minimapScene,
  minimapCamera,
  minimapRenderTarget
}
})

//