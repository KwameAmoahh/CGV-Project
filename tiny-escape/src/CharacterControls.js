import * as THREE from 'three'
import { W, A, S, D, DIRECTIONS } from './utils.js'

export class CharacterControls {
    constructor(model, mixer, animationsMap, orbitControl, camera, currentAction) {
        this.model = model
        this.mixer = mixer
        this.animationsMap = animationsMap
        this.orbitControl = orbitControl
        this.camera = camera

        this.toggleRun = true
        this.currentAction = currentAction

        this.walkDirection = new THREE.Vector3()
        this.rotateAngle = new THREE.Vector3(0, 1, 0)
        this.rotateQuarternion = new THREE.Quaternion()
        this.cameraTarget = new THREE.Vector3()

        this.fadeDuration = 0.2
        this.runVelocity = 5
        this.walkVelocity = 2

        // Start animation
        const initial = this.animationsMap.get(this.currentAction)
        if (initial) {
            initial.reset().fadeIn(this.fadeDuration).play()
        } else {
            console.warn("⚠️ Animation not found:", this.currentAction, 
                         "Available:", [...this.animationsMap.keys()])
        }

        if (this.camera) {
            this.updateCameraTarget(0, 0)
        }
    }

    switchRunToggle() {
        this.toggleRun = !this.toggleRun
    }

    update(delta, keysPressed) {
        const directionPressed = DIRECTIONS.some(key => keysPressed[key] === true)

        let play = ''
        if (directionPressed && this.toggleRun) {
            play = 'Run'
        } else if (directionPressed) {
            play = 'walk'
        } else {
            play = 'idle'
        }

        if (this.currentAction !== play) {
            const toPlay = this.animationsMap.get(play)
            const current = this.animationsMap.get(this.currentAction)

            if (current) current.fadeOut(this.fadeDuration)
            if (toPlay) toPlay.reset().fadeIn(this.fadeDuration).play()

            this.currentAction = play
        }

        this.mixer.update(delta)

        if (this.currentAction === 'Run' || this.currentAction === 'walk') {
            // Correct orientation (camera → player)
            const angleYCameraDirection = Math.atan2(
                (this.model.position.x - this.camera.position.x),
                (this.model.position.z - this.camera.position.z)
            )


            const directionOffset = this.directionOffset(keysPressed)

            this.rotateQuarternion.setFromAxisAngle(this.rotateAngle, angleYCameraDirection + directionOffset)
            this.model.quaternion.rotateTowards(this.rotateQuarternion, 0.2)

            this.camera.getWorldDirection(this.walkDirection)
            this.walkDirection.y = 0
            this.walkDirection.normalize()
            this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset)

            const velocity = this.currentAction === 'Run' ? this.runVelocity : this.walkVelocity
            const moveX = this.walkDirection.x * velocity * delta
            const moveZ = this.walkDirection.z * velocity * delta

            this.model.position.x += moveX
            this.model.position.z += moveZ
            this.updateCameraTarget(moveX, moveZ)
        }
    }

    updateCameraTarget(moveX, moveZ) {
        if (!this.camera) return

        this.camera.position.x += moveX
        this.camera.position.z += moveZ

        this.cameraTarget.set(
            this.model.position.x,
            this.model.position.y + 1,
            this.model.position.z
        )
        this.orbitControl.target = this.cameraTarget
    }

    directionOffset(keysPressed) {
        let directionOffset = 0
        if (keysPressed[W]) {
            if (keysPressed[A]) {
                directionOffset = Math.PI / 4
            } else if (keysPressed[D]) {
                directionOffset = -Math.PI / 4
            }
        } else if (keysPressed[S]) {
            if (keysPressed[A]) {
                directionOffset = Math.PI / 4 + Math.PI / 2
            } else if (keysPressed[D]) {
                directionOffset = -Math.PI / 4 - Math.PI / 2
            } else {
                directionOffset = Math.PI
            }
        } else if (keysPressed[A]) {
            directionOffset = Math.PI / 2
        } else if (keysPressed[D]) {
            directionOffset = -Math.PI / 2
        }
        return directionOffset
    }
}
