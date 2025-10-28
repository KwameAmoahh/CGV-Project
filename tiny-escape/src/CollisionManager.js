import * as THREE from 'three'

export class CollisionManager {
  constructor(scene) {
    this.scene = scene
    this.collidableMeshList = []
    this.raycaster = new THREE.Raycaster()
  }

  addCollidableObject(object) {
    if (object && object.isMesh && !this.collidableMeshList.includes(object)) {
      this.collidableMeshList.push(object)
    }
  }

  removeCollidableObject(object) {
    const idx = this.collidableMeshList.indexOf(object)
    if (idx !== -1) this.collidableMeshList.splice(idx, 1)
  }

  checkCollision(position, quaternion) {
    const collisionDistance = 0.3
    const directions = [
      new THREE.Vector3(0, 0, -1),  // forward
      new THREE.Vector3(0, 0, 1),   // backward
      new THREE.Vector3(-1, 0, 0),  // left
      new THREE.Vector3(1, 0, 0),   // right
    ]

    for (const dir of directions) {
      const worldDir = dir.clone().applyQuaternion(quaternion)
      this.raycaster.set(position, worldDir.normalize())

      // ignore any intersections at zero distance (inside geometry)
      const intersects = this.raycaster
        .intersectObjects(this.collidableMeshList, false)
        .filter(hit => hit.distance > 0.02)

      if (intersects.length > 0 && intersects[0].distance < collisionDistance) {
      const hit = intersects[0];
      const hitPos = hit.point;

      // Skip collisions near the open fridge doorway
      // (tune the values if needed)
      const isNearFridgeDoor =
        hitPos.x > -1.5 && hitPos.x < 1.5 && // width range of the doorway
        hitPos.y > 0.5 && hitPos.y < 3 &&    
        hitPos.z > -0.5 && hitPos.z < 2.5;   

      if (isNearFridgeDoor) {
        console.log(`🚪 Ignored collision near fridge door at ${hitPos.toArray()}`);
        continue; // skip this hit
      }

  console.log(
    `⚠️ Collision detected in direction ${dir.toArray()} at distance: ${hit.distance.toFixed(3)} – object: ${
      hit.object.name || hit.object.material?.name
    }`
  );
  return true;
}

    }

    return false
  }
}
