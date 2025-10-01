import { KeyDisplay } from './utils.js'
import { CharacterControls } from './CharacterControls.js'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// SCENE
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xa8def0)

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
// Start further back and higher up
camera.position.set(0, 3, 8)  // X, Y, Z
camera.lookAt(0, 1, 0)        // Look at the player's chest height


// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

// CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement)
orbitControls.enableDamping = true
orbitControls.minDistance = 5
orbitControls.maxDistance = 15
orbitControls.enablePan = false
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05
orbitControls.update()

// LIGHTS
addLights()
addFloor()

// MODEL + ANIMATIONS
let characterControls
new GLTFLoader().load('assets/models/Untitled.glb', (gltf) => {
    const model = gltf.scene
    model.traverse((obj) => { if (obj.isMesh) obj.castShadow = true })
    scene.add(model)

    const mixer = new THREE.AnimationMixer(model)
    const animationsMap = new Map()
    console.log("✅ Animations found:", gltf.animations.map(a => a.name))

    gltf.animations.forEach((clip) => {
        animationsMap.set(clip.name, mixer.clipAction(clip))
    })

    // Start with lowercase "idle"
    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera, 'idle')
})

// CONTROL KEYS
const keysPressed = {}
const keyDisplayQueue = new KeyDisplay()

document.addEventListener('keydown', (event) => {
    keyDisplayQueue.down(event.key)
    if (event.shiftKey && characterControls) {
        characterControls.switchRunToggle()
    } else {
        keysPressed[event.key.toLowerCase()] = true
    }
}, false)

document.addEventListener('keyup', (event) => {
    keyDisplayQueue.up(event.key)
    keysPressed[event.key.toLowerCase()] = false
}, false)

// ANIMATE
const clock = new THREE.Clock()
function animate() {
    let delta = clock.getDelta()
    if (characterControls) characterControls.update(delta, keysPressed)
    orbitControls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(animate)
}
animate()

// RESIZE HANDLER
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    keyDisplayQueue.updatePosition()
})

// FLOOR
function addFloor() {
    const geometry = new THREE.PlaneGeometry(100, 100)
    const material = new THREE.MeshStandardMaterial({ color: 0x555555 })
    const floor = new THREE.Mesh(geometry, material)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
}

// LIGHTS
function addLights() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))

    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(5, 10, 7)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(2048, 2048)
    scene.add(dirLight)
}
