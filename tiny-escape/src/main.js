import { KeyDisplay } from './utils.js'
import { CharacterControls } from './CharacterControls.js'
import { Environment } from './environment.js'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// SCENE
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xa8def0)

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.02,
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

// ENVIRONMENT (Fridge + props + FX)
const environment = new Environment(scene)

// MODEL + ANIMATIONS
let characterControls
new GLTFLoader().load('assets/models/lastone.glb', (gltf) => {
    const model = gltf.scene
    model.traverse((obj) => { if (obj.isMesh) obj.castShadow = true })
    // Shrink player for fridge scale
    model.scale.set(0.18, 0.18, 0.18)
    scene.add(model)

    const mixer = new THREE.AnimationMixer(model)
    const animationsMap = new Map()
    console.log('Animations found:', gltf.animations.map(a => a.name))

    gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip)
        // Keep original key and a lowercase alias for robust lookups
        animationsMap.set(clip.name, action)
        animationsMap.set(clip.name.toLowerCase(), action)
    })

    // Start with lowercase "idle"
    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera, 'idle')
    characterControls.setEnvironment(environment)

    // Spawn inside fridge once products are also placed to avoid overlap
    const placeInside = () => {
        const spawn = environment.getSpawnPoint ? environment.getSpawnPoint() : null
        if (spawn) {
            model.position.copy(spawn)
            // Reposition camera behind the shrunken player
            if (characterControls) {
                const desiredCam = characterControls.getThirdPersonCameraPos()
                camera.position.copy(desiredCam)
                characterControls.updateCameraTarget(0, 0)
                orbitControls.update()
            }
        }
    }
    if (environment.onReady) environment.onReady(placeInside)
    else placeInside()
})

// CONTROL KEYS
const keysPressed = {}
const keyDisplayQueue = new KeyDisplay()

document.addEventListener('keydown', (event) => {
    keyDisplayQueue.down(event.key)
    if (event.shiftKey && characterControls) {
        characterControls.switchRunToggle()
    } else if (event.key.toLowerCase() === 'c' && characterControls) {
        characterControls.toggleCameraMode()
    } else if ((event.code === 'Space' || event.key === ' ') && characterControls) {
        characterControls.jump()
    } else if (event.key.toLowerCase() === 'r' && characterControls) {
        // Respawn to a safe spot inside the fridge if stuck
        const spawn = (environment.getSafeSpawnPoint && environment.getSafeSpawnPoint()) || (environment.getSpawnPoint && environment.getSpawnPoint())
        if (spawn) {
            characterControls.model.position.copy(spawn)
            const desiredCam = characterControls.getThirdPersonCameraPos()
            camera.position.copy(desiredCam)
            characterControls.updateCameraTarget(0, 0)
            orbitControls.update()
        }
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
    if (characterControls) {
        characterControls.update(delta, keysPressed)
        // Check goal button
        if (environment.isAtExitButton && environment.isAtExitButton(characterControls.model.position)) {
            environment.openDoor()
        }
    }
    environment.update(delta)
    // Only update OrbitControls in third-person; FPS manages camera itself
    if (!characterControls || characterControls.cameraMode === 'third') {
        orbitControls.update()
    }
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
    // Keep an infinite ground far below in case environment is missing
    const geometry = new THREE.PlaneGeometry(200, 200)
    const material = new THREE.MeshStandardMaterial({ color: 0x555555 })
    const floor = new THREE.Mesh(geometry, material)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -10
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
