import * as THREE from 'three';

export function setupCamera() {
    const camera = new THREE.PerspectiveCamera(
        70, // Wider FOV for interior
        window.innerWidth / window.innerHeight,
        0.01, // Very close near plane for tiny scale
        10
    );
    
    camera.position.set(0, 0.3, 0.8);
    return camera;
}