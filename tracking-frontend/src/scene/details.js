import * as THREE from 'three';
import { hashString, mulberry32 } from './assets.js';

const WINDOW_WIDTH = 1.5;
const WINDOW_HEIGHT = 1.9;
const ROOF_TOP_OFFSET = 1.7; // building height to the top of the roof slab
const noRaycast = () => {};

const shared = (object) => {
  object.userData.shared = true;
  return object;
};

// Decorative detail for the placeholder buildings: windows, soft contact shadows and floating pins.
// Geometry and materials that every building can share are created once and reused.
export function createDetailKit(assets) {
  const windowGeometry = shared(new THREE.PlaneGeometry(WINDOW_WIDTH, WINDOW_HEIGHT));
  const windowMaterial = shared(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const blobGeometry = shared(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const blobMaterial = shared(new THREE.MeshBasicMaterial({
    map: assets.blob, transparent: true, depthWrite: false, opacity: 0.5,
  }));
  const stemGeometry = shared(new THREE.CylinderGeometry(0.1, 0.1, 1, 8).translate(0, 0.5, 0));
  const stemMaterial = shared(new THREE.MeshStandardMaterial({ color: '#7a5a66', metalness: 0.2, roughness: 0.55 }));
  const diamondGeometry = shared(new THREE.OctahedronGeometry(1).scale(0.75, 1.2, 0.75));
  const ringGeometry = shared(new THREE.RingGeometry(0.88, 1, 56).rotateX(-Math.PI / 2));
  const tint = new THREE.Color();

  function createWindows(width, depth, height, seed) {
    const random = mulberry32(seed);
    const rows = Math.max(1, Math.floor((height - 1.6 - 2.6) / 3.2) + 1);
    const colsAlong = (span) => Math.max(1, Math.floor((span - 3) / 3.6));
    const faces = [
      { cols: colsAlong(width), span: width, axis: 'z', sign: 1 },
      { cols: colsAlong(width), span: width, axis: 'z', sign: -1 },
      { cols: colsAlong(depth), span: depth, axis: 'x', sign: 1 },
      { cols: colsAlong(depth), span: depth, axis: 'x', sign: -1 },
    ];
    const count = faces.reduce((sum, face) => sum + face.cols * rows, 0);
    const mesh = new THREE.InstancedMesh(windowGeometry, windowMaterial, count);
    const variants = new Uint8Array(count);
    const dummy = new THREE.Object3D();
    let index = 0;
    faces.forEach((face) => {
      const pitch = (face.span - 3) / face.cols;
      for (let c = 0; c < face.cols; c += 1) {
        const along = (c - (face.cols - 1) / 2) * pitch;
        for (let r = 0; r < rows; r += 1) {
          const y = 2.6 + r * 3.2;
          if (face.axis === 'z') {
            dummy.position.set(along, y, face.sign * (depth / 2 + 0.05));
            dummy.rotation.set(0, face.sign > 0 ? 0 : Math.PI, 0);
          } else {
            dummy.position.set(face.sign * (width / 2 + 0.05), y, along);
            dummy.rotation.set(0, face.sign > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
          }
          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);
          const roll = random();
          variants[index] = roll < 0.42 ? 0 : roll < 0.5 ? 1 : 2;
          mesh.setColorAt(index, tint.set('#ffffff'));
          index += 1;
        }
      }
    });
    mesh.userData.variants = variants;
    mesh.raycast = noRaycast;
    return mesh;
  }

  return {
    // Adds windows, a contact shadow and a floating pin to one building group.
    addBuilding(group, zone, { width, depth, height }, index) {
      const seed = hashString(zone.id) ^ (index * 2654435761);
      const windows = createWindows(width, depth, height, seed);
      group.add(windows);

      const blob = new THREE.Mesh(blobGeometry, blobMaterial);
      blob.position.y = 0.26;
      blob.scale.set(width + 9, 1, depth + 9);
      blob.raycast = noRaycast;
      group.add(blob);

      const roofTop = height + ROOF_TOP_OFFSET;
      const baseY = height + 4.6;
      const stem = new THREE.Mesh(stemGeometry, stemMaterial);
      stem.position.y = roofTop;
      stem.scale.y = baseY - 1.2 - roofTop;
      stem.userData.zoneId = zone.id;

      const diamond = new THREE.Mesh(
        diamondGeometry,
        new THREE.MeshStandardMaterial({
          color: zone.color, emissive: zone.color, emissiveIntensity: 0.75, roughness: 0.3, metalness: 0.1,
        }),
      );
      diamond.position.y = baseY;
      diamond.userData.zoneId = zone.id;

      const ringBase = Math.max(width, depth) / 2 + 2.5;
      const ring = new THREE.Mesh(
        ringGeometry,
        new THREE.MeshBasicMaterial({
          color: zone.color, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false,
        }),
      );
      ring.position.y = 0.3;
      ring.scale.setScalar(ringBase);
      ring.raycast = noRaycast;

      group.add(stem, diamond, ring);
      const phase = (random01(seed) + index * 0.137) % 1;
      return { windows, blob, pin: { stem, diamond, ring, baseY, ringBase, phase } };
    },

    setPalette(palette) {
      blobMaterial.opacity = palette.blobShadow;
      stemMaterial.color.set(palette.marker.stem);
    },

    // Window colors per palette: lit (warm) / lit (cool) / dark at night, glass tones by day.
    tintWindows(mesh, palette) {
      const { variants } = mesh.userData;
      for (let i = 0; i < variants.length; i += 1) {
        mesh.setColorAt(i, tint.set(palette.windows[variants[i]]));
      }
      mesh.instanceColor.needsUpdate = true;
    },

    // Bobbing, spinning pin heads and pulsing ground rings. Static (but still visible) when motion is reduced.
    animatePins(entries, time, motion) {
      entries.forEach((entry) => {
        const { diamond, ring, baseY, ringBase, phase } = entry.pin;
        diamond.position.y = baseY + Math.sin(time * 2 + phase * 6.2832) * 0.4 * motion;
        diamond.rotation.y = phase * 6.2832 + time * 0.9 * motion;
        const k = motion ? (time * 0.45 + phase) % 1 : 0.35;
        ring.scale.setScalar(ringBase * (0.8 + 0.6 * k));
        ring.material.opacity = (1 - k) * 0.42;
      });
    },

    dispose() {
      [windowGeometry, windowMaterial, blobGeometry, blobMaterial, stemGeometry, stemMaterial, diamondGeometry, ringGeometry]
        .forEach((item) => item.dispose());
    },
  };
}

function random01(seed) {
  return mulberry32(seed)();
}

// Lamp positions along the two placeholder roads (see createPlaceholderCampus): a main road along x and a
// cross road along z. Lamps that would land inside a building footprint are skipped.
const LAMP_SPOTS = [
  ...[-60, -36, -12, 12, 36, 60].flatMap((x) => [[x, 5.6], [x, -5.6]]),
  ...[-36, -12, 12, 36].flatMap((z) => [[1.6, z], [10.4, z]]),
];

export function createStreetLights(assets, footprints) {
  const spots = LAMP_SPOTS.filter(([x, z]) => !footprints.some((f) => (
    Math.abs(x - f.x) < f.width / 2 + 3 && Math.abs(z - f.z) < f.depth / 2 + 3
  )));
  const group = new THREE.Group();
  group.name = 'street-lights';
  const count = spots.length;

  const poleGeometry = new THREE.CylinderGeometry(0.16, 0.22, 5.2, 8).translate(0, 2.6, 0);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: '#7a5a66', metalness: 0.3, roughness: 0.5 });
  const headGeometry = new THREE.SphereGeometry(0.55, 14, 10);
  const headMaterial = new THREE.MeshBasicMaterial({ color: '#ffe3a3', toneMapped: false });
  const poolGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const poolMaterial = new THREE.MeshBasicMaterial({
    map: assets.glow, color: '#ffd990', transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const haloMaterial = new THREE.SpriteMaterial({
    map: assets.glow, color: '#ffe3a3', transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });

  const poles = new THREE.InstancedMesh(poleGeometry, poleMaterial, Math.max(count, 1));
  const heads = new THREE.InstancedMesh(headGeometry, headMaterial, Math.max(count, 1));
  const pools = new THREE.InstancedMesh(poolGeometry, poolMaterial, Math.max(count, 1));
  poles.count = count;
  heads.count = count;
  pools.count = count;
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 5.4, z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 0.29, z);
    dummy.scale.set(13, 1, 13);
    dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);

    const halo = new THREE.Sprite(haloMaterial);
    halo.position.set(x, 5.4, z);
    halo.scale.setScalar(6.5);
    halo.raycast = noRaycast;
    group.add(halo);
  });
  [poles, heads, pools].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.raycast = noRaycast;
    mesh.frustumCulled = false;
    group.add(mesh);
  });
  poles.castShadow = true;

  return {
    group,
    setPalette(palette) {
      headMaterial.color.set(palette.lamp.head);
      poleMaterial.color.set(palette.marker.stem);
      haloMaterial.opacity = palette.lamp.halo;
      poolMaterial.opacity = palette.lamp.pool;
    },
    dispose() {
      [poleGeometry, poleMaterial, headGeometry, headMaterial, poolGeometry, poolMaterial, haloMaterial]
        .forEach((item) => item.dispose());
      poles.dispose();
      heads.dispose();
      pools.dispose();
    },
  };
}
