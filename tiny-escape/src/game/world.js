import * as THREE from 'three';

export function createWorld(scene) {
    // Proper fridge lighting
    const ambientLight = new THREE.AmbientLight(0x88ccff, 0.3);
    scene.add(ambientLight);

    const fridgeLight = new THREE.PointLight(0xffffff, 1.2, 8);
    fridgeLight.position.set(0, 8, 0);
    fridgeLight.castShadow = true;
    scene.add(fridgeLight);

    // Create materials with actual texture-like appearance
    const materials = {
        fridgeWall: new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.6
        }),
        shelf: new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.8,
            metalness: 0.2
        }),
        floor: new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.9,
            metalness: 0.1
        })
    };

    createFridgeStructure(scene, materials);
    createFridgeContents(scene);
}

function createFridgeStructure(scene, materials) {
    // Fridge back wall (proper 3D thickness)
    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(8, 10, 0.1),
        materials.fridgeWall
    );
    backWall.position.set(0, 5, -2);
    scene.add(backWall);

    // Side walls with thickness
    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 10, 4),
        materials.fridgeWall
    );
    leftWall.position.set(-4, 5, 0);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 10, 4),
        materials.fridgeWall
    );
    rightWall.position.set(4, 5, 0);
    scene.add(rightWall);

    // Ceiling with light fixture impression
    const ceiling = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.1, 4),
        materials.fridgeWall
    );
    ceiling.position.set(0, 10, 0);
    scene.add(ceiling);

    // Floor with grating texture illusion
    const floor = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.1, 4),
        materials.floor
    );
    floor.position.set(0, 0, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // Glass shelves with proper framing
    createShelves(scene);
}

function createShelves(scene) {
    const shelfGlass = new THREE.MeshStandardMaterial({
        color: 0x88aacc,
        transparent: true,
        opacity: 0.3,
        roughness: 0.1,
        metalness: 0.9
    });

    const shelfFrame = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.8
    });

    const shelfHeights = [7, 4, 1.5];
    
    shelfHeights.forEach(height => {
        // Glass shelf
        const glass = new THREE.Mesh(
            new THREE.BoxGeometry(7, 0.02, 3),
            shelfGlass
        );
        glass.position.set(0, height, 0);
        glass.castShadow = true;
        scene.add(glass);

        // Shelf frame (front)
        const frameFront = new THREE.Mesh(
            new THREE.BoxGeometry(7, 0.1, 0.05),
            shelfFrame
        );
        frameFront.position.set(0, height - 0.04, 1.48);
        scene.add(frameFront);
    });
}

function createFridgeContents(scene) {
    // Realistic food items with proper materials
    const foodMaterials = {
        milk: new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.1
        }),
        soda: new THREE.MeshStandardMaterial({
            color: 0xcc0000,
            roughness: 0.2,
            metalness: 0.8
        }),
        cheese: new THREE.MeshStandardMaterial({
            color: 0xffcc00,
            roughness: 0.6
        }),
        egg: new THREE.MeshStandardMaterial({
            color: 0xfff8dc,
            roughness: 0.4
        })
    };

    // Milk carton with proper proportions
    const milkGroup = new THREE.Group();
    const milkBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 2, 0.4),
        foodMaterials.milk
    );
    const milkTop = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.3, 4),
        foodMaterials.milk
    );
    milkTop.position.y = 1.1;
    milkTop.rotation.x = Math.PI;
    milkGroup.add(milkBody);
    milkGroup.add(milkTop);
    milkGroup.position.set(-2, 1, 1);
    scene.add(milkGroup);

    // Soda can with details
    const sodaCan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 1.2, 32),
        foodMaterials.soda
    );
    sodaCan.position.set(1.5, 0.7, 0.8);
    scene.add(sodaCan);

    // Cheese wedge
    const cheese = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 0.8, 3),
        foodMaterials.cheese
    );
    cheese.position.set(2.5, 0.5, -0.8);
    cheese.rotation.x = Math.PI;
    scene.add(cheese);

    // Egg carton
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 3; j++) {
            const egg = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 16, 16),
                foodMaterials.egg
            );
            egg.position.set(-1 + j * 0.25, 0.3, -1.2 + i * 0.3);
            egg.scale.set(1, 1.3, 1);
            scene.add(egg);
        }
    }

    // Mystery jar with glow
    const jarMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x00ff88,
        transmission: 0.8,
        roughness: 0.1,
        thickness: 0.2
    });

    const mysteryJar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32),
        jarMaterial
    );
    mysteryJar.position.set(0, 0.5, 1.2);
    scene.add(mysteryJar);

    // Jar lid
    const jarLid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.1, 32),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 })
    );
    jarLid.position.set(0, 0.9, 1.2);
    scene.add(jarLid);
}