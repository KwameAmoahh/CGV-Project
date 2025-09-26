import * as THREE from 'three';
import { Player } from './game/player.js';
import { setupCamera } from './game/camera.js';
import { createWorld } from './game/world.js';

class Game {
    constructor() {
        console.log('🧊 Starting Fridge Escape...');
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x001122); // Dark blue-black
        this.scene.fog = new THREE.Fog(0x001122, 5, 15); // Fridge fog

        this.camera = setupCamera();
        createWorld(this.scene);
        this.player = new Player(this.scene, this.camera);

        this.animate();
        window.addEventListener('resize', () => this.onWindowResize());

        console.log('✅ Tiny person trapped in fridge! Find a way out...');
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.player.update();
        this.renderer.render(this.scene, this.camera);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Game();
});