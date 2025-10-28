import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// ----------------------------------------------------------------------------- //
// Scene + Camera
// ----------------------------------------------------------------------------- //
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x17171f)

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 2.2, 6)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.shadowMap.enabled = true
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1.5, 0)
controls.enableDamping = true
controls.minDistance = 1.5
controls.maxDistance = 8
controls.update()

// ----------------------------------------------------------------------------- //
// Lighting
// ----------------------------------------------------------------------------- //
scene.add(new THREE.AmbientLight(0xffffff, 0.5))

const keyLight = new THREE.DirectionalLight(0xffffff, 0.9)
keyLight.position.set(3, 6, 4)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(2048, 2048)
scene.add(keyLight)

const rimLight = new THREE.DirectionalLight(0xffffff, 0.4)
rimLight.position.set(-4, 4, -3)
scene.add(rimLight)

const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33 })
const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), groundMat)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// ----------------------------------------------------------------------------- //
// Animation / Navigation
// ----------------------------------------------------------------------------- //
const loader = new GLTFLoader()
const clock = new THREE.Clock()

let mixer = null
let chefRoot = null
let activeAction = null
let baseY = 0

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

// Simple back-and-forth path so the chef runs up/down the screen
const PATH_POINTS = [
  new THREE.Vector3(0, 0, 2.4),
  new THREE.Vector3(0, 0, -2.4),
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
  { type: 'idle', duration: 2.4 },
  { type: 'crouchDown' },
  { type: 'crawl', target: 1, speed: CRAWL_SPEED },
  { type: 'standUp' },
  { type: 'idle', duration: 1.8 },
  { type: 'slowRun', target: 0, speed: SLOW_RUN_SPEED },
  { type: 'idle', duration: 1.4 },
  { type: 'walk', target: 1, speed: WALK_SPEED },
]

const tempVecA = new THREE.Vector3()
const tempVecB = new THREE.Vector3()


const spatulaPromise = new Promise((resolve) => {
  loader.load('assets/models/spatula_spongebob.glb', (gltf) => resolve(gltf.scene))
})

loader.load('assets/models/chef2.glb', async (gltf) => {
  chefRoot = gltf.scene
  chefRoot.scale.setScalar(0.45)
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
  mixer = new THREE.AnimationMixer(chefRoot)
  gltf.animations.forEach((clip) => {
    const lower = clip.name.toLowerCase()
    const action = mixer.clipAction(clip)
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
  baseY = -bound.min.y - FOOT_LOCK_EPS

  const start = PATH_POINTS[0] ?? new THREE.Vector3()
  chefRoot.position.set(start.x, baseY, start.z)
  chefRoot.rotation.set(0, ORIENTATION_OFFSET, 0)
  scene.add(chefRoot)

  beginBehavior(0)
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
  if (!PATH_POINTS[targetIndex]) return true
  const target = PATH_POINTS[targetIndex]
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
    chefRoot.position.set(target.x, baseY, target.z)
    orientTowards(tempVecB)
    chefRoot.position.y = baseY
    return true
  }

  tempVecB.normalize()
  chefRoot.position.addScaledVector(tempVecB, travel)
  chefRoot.position.y = baseY
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

  if (mixer) mixer.update(delta)

  updateBehavior(delta)

  controls.update()
  renderer.render(scene, camera)
}

animate()

// ----------------------------------------------------------------------------- //
// Resize handling
// ----------------------------------------------------------------------------- //
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
