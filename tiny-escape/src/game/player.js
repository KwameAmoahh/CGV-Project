import * as THREE from 'three';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.mesh = this.createTinyPerson();
        scene.add(this.mesh);
        
        this.speed = 0.03; // Even slower for precision
        this.velocity = new THREE.Vector3();
        this.keys = {};
        
        this.setupControls();
    }

    createTinyPerson() {
        const group = new THREE.Group();
        
        // Body with clothing detail
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.05, 0.1, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0x2266aa })
        );
        body.position.y = 0.15;
        group.add(body);

        // Head with face suggestion
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0xffaa66 })
        );
        head.position.y = 0.3;
        group.add(head);

        // Simple eyes
        const eyeGeo = new THREE.SphereGeometry(0.01, 4, 4);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(0.02, 0.32, 0.05);
        group.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(-0.02, 0.32, 0.05);
        group.add(rightEye);

        group.position.set(0, 0.1, 1); // Start near back of fridge
        return group;
    }

    setupControls() {
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
        });
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
    }

    update() {
        this.velocity.set(0, 0, 0);
        
        if (this.keys['KeyW']) this.velocity.z = -this.speed;
        if (this.keys['KeyS']) this.velocity.z = this.speed;
        if (this.keys['KeyA']) this.velocity.x = -this.speed;
        if (this.keys['KeyD']) this.velocity.x = this.speed;
        
        // Basic boundary checking (fridge walls)
        const newX = this.mesh.position.x + this.velocity.x;
        const newZ = this.mesh.position.z + this.velocity.z;
        
        if (Math.abs(newX) < 3.5) this.mesh.position.x = newX;
        if (Math.abs(newZ) < 1.8) this.mesh.position.z = newZ;
        
        this.updateCamera();
    }

    updateCamera() {
        // More dynamic camera
        const cameraOffset = new THREE.Vector3(
            Math.sin(Date.now() * 0.001) * 0.1, // slight sway
            0.3,
            0.6
        );
        
        this.camera.position.copy(this.mesh.position).add(cameraOffset);
        this.camera.lookAt(this.mesh.position.x, this.mesh.position.y + 0.1, this.mesh.position.z);
    }
}