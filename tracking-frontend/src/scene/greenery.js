import * as THREE from 'three';
import { mulberry32 } from './assets.js';

// Low-poly trees and the roundabout where the two placeholder roads cross. They give the generated campus some
// life and scale, and sit entirely outside the building footprints (the trees are placed around them, see
// createGreenery). None of it is pickable.
const TREE_COUNT = 44;
const TREE_AREA = { x: 68, z: 46 };
const MAX_ATTEMPTS = 900;
const noRaycast = () => {};

// The crossing of createPlaceholderCampus' main road (along x) and cross road (along z).
export const PLAZA = { x: 6, z: 0, radius: 7.5 };

// A flat paved disc with a ring around it. `material` is the disc's, so the scene can tint it like the ground.
export function createPlaza() {
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(PLAZA.radius, PLAZA.radius, 0.12, 56),
    new THREE.MeshStandardMaterial({ color: '#1f1f1f', roughness: 0.9 }),
  );
  disc.position.set(PLAZA.x, 0.28, PLAZA.z);
  disc.receiveShadow = true;
  disc.raycast = noRaycast;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(PLAZA.radius - 1.1, PLAZA.radius - 0.65, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#D4FF3F', toneMapped: false }),
  );
  ring.position.y = 0.35;
  ring.raycast = noRaycast;
  disc.add(ring);
  disc.userData.ring = ring;
  return disc;
}

// Whether a point is clear of the roads, the roundabout and every building (with a margin for the canopy).
function isFree(x, z, footprints) {
  if (Math.abs(z) < 7.5 && Math.abs(x) < 78) return false; // main road
  if (Math.abs(x - 6) < 6.5 && Math.abs(z) < 50) return false; // cross road
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.radius + 4) return false;
  return !footprints.some((f) => Math.abs(x - f.x) < f.width / 2 + 6 && Math.abs(z - f.z) < f.depth / 2 + 6);
}

export function createGreenery(footprints) {
  const random = mulberry32(77);
  const spots = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS && spots.length < TREE_COUNT; attempt += 1) {
    const x = (random() * 2 - 1) * TREE_AREA.x;
    const z = (random() * 2 - 1) * TREE_AREA.z;
    const size = 0.8 + random() * 0.55;
    const tone = random() - 0.5;
    if (isFree(x, z, footprints) && !spots.some((s) => Math.hypot(s.x - x, s.z - z) < 7)) spots.push({ x, z, size, tone });
  }

  const group = new THREE.Group();
  group.name = 'greenery';
  const canopyGeometry = new THREE.IcosahedronGeometry(1, 0);
  const trunkGeometry = new THREE.CylinderGeometry(0.28, 0.4, 1, 6).translate(0, 0.5, 0);
  const canopyMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.9 });
  const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, Math.max(spots.length, 1));
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, Math.max(spots.length, 1));
  canopies.count = spots.length;
  trunks.count = spots.length;

  const dummy = new THREE.Object3D();
  spots.forEach((spot, i) => {
    const trunkHeight = 2 * spot.size;
    dummy.position.set(spot.x, 0.2, spot.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(spot.size, trunkHeight, spot.size);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    const radius = 2.5 * spot.size;
    dummy.position.set(spot.x, 0.2 + trunkHeight + radius * 0.7, spot.z);
    dummy.rotation.set(0, random() * Math.PI, 0);
    dummy.scale.set(radius, radius * 1.15, radius);
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
  });
  [canopies, trunks].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.raycast = noRaycast;
    mesh.frustumCulled = false;
    group.add(mesh);
  });
  canopies.castShadow = true;
  trunks.castShadow = true;

  const color = new THREE.Color();
  return {
    group,
    setPalette(palette) {
      trunkMaterial.color.set(palette.tree.trunk);
      spots.forEach((spot, i) => {
        color.set(palette.tree.canopy).offsetHSL(0, 0, spot.tone * 0.12);
        canopies.setColorAt(i, color);
      });
      if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    },
    dispose() {
      [canopyGeometry, trunkGeometry, canopyMaterial, trunkMaterial].forEach((item) => item.dispose());
      canopies.dispose();
      trunks.dispose();
    },
  };
}
