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
        this.rotateQuaternion = new THREE.Quaternion()
        this.cameraTarget = new THREE.Vector3()

        this.fadeDuration = 0.2
        this.runVelocity = 5
        this.walkVelocity = 2

        this.gravity = -25
        this.jumpStrength = 9
        this.velocityY = 0
        this.isOnGround = true

        this.cameraMode = 'third'
        this.firstPersonHeight = 1.6
        this.firstPersonForwardOffset = 0.1

        this.thirdPersonOffset = new THREE.Vector3(0, 1.6, -5)
        this._thirdPersonMin = this.orbitControl.minDistance
        this._thirdPersonMax = this.orbitControl.maxDistance

        // First-person rig (yaw -> pitch -> camera holder)
        this.fpsYaw = new THREE.Object3D()
        this.fpsPitch = new THREE.Object3D()
        this.fpsCameraHolder = new THREE.Object3D()
        this.fpsCameraHolder.position.set(0, 0, -this.firstPersonForwardOffset)
        this.fpsYaw.add(this.fpsPitch)
        this.fpsPitch.add(this.fpsCameraHolder)

        this.fpsSensitivity = 0.0025
        this.fpsPitchMin = -Math.PI / 2 + 0.05
        this.fpsPitchMax = Math.PI / 2 - 0.05
        this._pointerLocked = false
        this._onMouseMove = null
        this._onPointerLockChange = null
        this._savedCameraState = null
        this._modelVisibleBeforeFPS = this.model.visible

        // Start initial animation if present
        const initial = this.animationsMap.get(this.currentAction)
        if (initial) {
            initial.reset().fadeIn(this.fadeDuration).play()
        } else {
            console.warn('Animation not found:', this.currentAction,
                'Available:', [...this.animationsMap.keys()])
        }

        if (this.camera) {
            this.updateCameraTarget(0, 0)
        }
    }

    switchRunToggle() {
        this.toggleRun = !this.toggleRun
    }

    update(delta, keysPressed) {
        const directionPressed = DIRECTIONS.some((key) => keysPressed[key] === true)

        let desiredAction = ''
        if (!this.isOnGround || this.velocityY > 0.1) {
            desiredAction = 'jump'
        } else if (directionPressed && this.toggleRun) {
            desiredAction = 'run'
        } else if (directionPressed) {
            desiredAction = 'walk'
        } else {
            desiredAction = 'idle'
        }

        if (this.currentAction !== desiredAction) {
            const toPlay = this.animationsMap.get(desiredAction)
            const current = this.animationsMap.get(this.currentAction)

            if (!toPlay) {
                console.warn(`Requested animation "${desiredAction}" not found. Available:`, [...this.animationsMap.keys()])
            } else {
                if (current) current.fadeOut(this.fadeDuration)
                if (desiredAction === 'jump') {
                    toPlay.reset().setLoop(THREE.LoopOnce, 1)
                    toPlay.clampWhenFinished = true
                    toPlay.fadeIn(this.fadeDuration).play()
                } else {
                    toPlay.reset().fadeIn(this.fadeDuration).play()
                }
                this.currentAction = desiredAction
            }
        }

        this.mixer.update(delta)

        let moveX = 0
        let moveZ = 0

        if (this.currentAction === 'run' || this.currentAction === 'walk') {
            const speed = this.currentAction === 'run' ? this.runVelocity : this.walkVelocity

            if (this.cameraMode === 'first') {
                const forward = new THREE.Vector3()
                this.camera.getWorldDirection(forward)
                forward.y = 0
                if (forward.lengthSq() === 0) {
                    forward.set(0, 0, -1)
                }
                forward.normalize()

                const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
                const moveDir = new THREE.Vector3()

                if (keysPressed[W]) moveDir.add(forward)
                if (keysPressed[S]) moveDir.sub(forward)
                if (keysPressed[A]) moveDir.sub(right)
                if (keysPressed[D]) moveDir.add(right)

                if (moveDir.lengthSq() > 0) {
                    moveDir.normalize()
                    this.model.position.addScaledVector(moveDir, speed * delta)
                }
            } else {
                const angleYCameraDirection = Math.atan2(
                    this.camera.position.x - this.model.position.x,
                    this.camera.position.z - this.model.position.z
                )

                const offset = this.directionOffset(keysPressed)
                // Flip the facing 180° so the body points opposite direction
                this.rotateQuaternion.setFromAxisAngle(this.rotateAngle, angleYCameraDirection + offset + Math.PI)
                this.model.quaternion.rotateTowards(this.rotateQuaternion, 0.2)

                this.camera.getWorldDirection(this.walkDirection)
                this.walkDirection.y = 0
                this.walkDirection.normalize()
                this.walkDirection.applyAxisAngle(this.rotateAngle, offset)

                moveX = this.walkDirection.x * speed * delta
                moveZ = this.walkDirection.z * speed * delta

                this.model.position.x += moveX
                this.model.position.z += moveZ
            }
        }

        // Apply gravity / jump physics
        this.velocityY += this.gravity * delta
        this.model.position.y += this.velocityY * delta
        if (this.model.position.y <= 0) {
            this.model.position.y = 0
            this.velocityY = 0
            this.isOnGround = true
        } else {
            this.isOnGround = false
        }

        // Update camera / rig to follow
        this.updateCameraTarget(moveX, moveZ)
    }

    updateCameraTarget(moveX, moveZ) {
        if (!this.camera) return

        if (this.cameraMode === 'third') {
            this.camera.position.x += moveX
            this.camera.position.z += moveZ

            this.cameraTarget.set(
                this.model.position.x,
                this.model.position.y + 1,
                this.model.position.z
            )
            this.orbitControl.target.copy(this.cameraTarget)
        } else {
            if (this.model.parent && this.fpsYaw.parent !== this.model.parent) {
                this.model.parent.add(this.fpsYaw)
            }
            this.fpsYaw.position.set(
                this.model.position.x,
                this.model.position.y + this.firstPersonHeight,
                this.model.position.z
            )
        }
    }

    directionOffset(keysPressed) {
        let offset = 0
        if (keysPressed[W]) {
            if (keysPressed[A]) {
                offset = Math.PI / 4
            } else if (keysPressed[D]) {
                offset = -Math.PI / 4
            }
        } else if (keysPressed[S]) {
            if (keysPressed[A]) {
                offset = Math.PI / 4 + Math.PI / 2
            } else if (keysPressed[D]) {
                offset = -Math.PI / 4 - Math.PI / 2
            } else {
                offset = Math.PI
            }
        } else if (keysPressed[A]) {
            offset = Math.PI / 2
        } else if (keysPressed[D]) {
            offset = -Math.PI / 2
        }
        return offset
    }

    toggleCameraMode() {
        if (this.cameraMode === 'third') {
            this.cameraMode = 'first'
            this.orbitControl.enabled = false

            this._savedCameraState = {
                position: this.camera.position.clone(),
                quaternion: this.camera.quaternion.clone(),
                target: this.orbitControl.target.clone()
            }

            if (this.model.parent && this.fpsYaw.parent !== this.model.parent) {
                this.model.parent.add(this.fpsYaw)
            }
            this.fpsYaw.position.set(
                this.model.position.x,
                this.model.position.y + this.firstPersonHeight,
                this.model.position.z
            )
            const modelEuler = new THREE.Euler().setFromQuaternion(this.model.quaternion, 'YXZ')
            this.fpsYaw.rotation.set(0, modelEuler.y, 0)
            this.fpsPitch.rotation.set(0, 0, 0)

            this.fpsCameraHolder.add(this.camera)
            this.camera.position.set(0, 0, 0)
            this.camera.rotation.set(0, 0, 0)

            this._modelVisibleBeforeFPS = this.model.visible
            this.model.visible = false

            this._installPointerLock()
        } else {
            this.cameraMode = 'third'
            this.model.visible = this._modelVisibleBeforeFPS ?? true

            this._removePointerLock()

            this.fpsCameraHolder.remove(this.camera)
            const parent = this.model.parent || this.fpsYaw.parent
            if (parent) parent.add(this.camera)
            if (this.fpsYaw.parent) this.fpsYaw.parent.remove(this.fpsYaw)

            if (this._savedCameraState) {
                this.camera.position.copy(this._savedCameraState.position)
                this.camera.quaternion.copy(this._savedCameraState.quaternion)
                this.orbitControl.target.copy(this._savedCameraState.target)
            } else {
                const desired = this.getThirdPersonCameraPos()
                this.camera.position.copy(desired)
                this.cameraTarget.set(
                    this.model.position.x,
                    this.model.position.y + 1,
                    this.model.position.z
                )
                this.orbitControl.target.copy(this.cameraTarget)
            }

            this.orbitControl.enabled = true
            this.orbitControl.minDistance = this._thirdPersonMin
            this.orbitControl.maxDistance = this._thirdPersonMax
            this.orbitControl.update()
        }
    }

    _installPointerLock() {
        const element = document.body
        this._onMouseMove = (event) => {
            if (!this._pointerLocked) return
            const dx = event.movementX || 0
            const dy = event.movementY || 0
            this.fpsYaw.rotation.y -= dx * this.fpsSensitivity
            this.fpsPitch.rotation.x = THREE.MathUtils.clamp(
                this.fpsPitch.rotation.x - dy * this.fpsSensitivity,
                this.fpsPitchMin,
                this.fpsPitchMax
            )
        }
        this._onPointerLockChange = () => {
            this._pointerLocked = document.pointerLockElement === element
        }
        element.addEventListener('mousemove', this._onMouseMove)
        document.addEventListener('pointerlockchange', this._onPointerLockChange)
        element.requestPointerLock?.()
    }

    _removePointerLock() {
        const element = document.body
        if (this._onMouseMove) element.removeEventListener('mousemove', this._onMouseMove)
        if (this._onPointerLockChange) document.removeEventListener('pointerlockchange', this._onPointerLockChange)
        this._onMouseMove = null
        this._onPointerLockChange = null
        if (document.exitPointerLock) document.exitPointerLock()
        this._pointerLocked = false
    }

    jump() {
        if (!this.isOnGround) return
        this.velocityY = this.jumpStrength
        this.isOnGround = false
    }

    getThirdPersonCameraPos() {
        const offset = this.thirdPersonOffset.clone().applyQuaternion(this.model.quaternion)
        return this.model.position.clone().add(offset)
    }
}
