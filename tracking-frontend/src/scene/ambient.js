import * as THREE from 'three';
import { mulberry32 } from './assets.js';

const MAX_PARTICLES = 260;
const AREA = { x: 92, z: 66, yMin: 1.5, yMax: 30 };

// Particles drift on the GPU from a per-particle seed, so animating them costs no CPU per frame.
const PARTICLE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uBlink;
  attribute vec4 aSeed; // phase, speed, drift amount, size factor
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float t = uTime * aSeed.y;
    p.x += sin(t * 0.31 + aSeed.x * 6.2831) * aSeed.z * 2.0;
    p.y += sin(t * 0.47 + aSeed.x * 12.566) * aSeed.z;
    p.z += cos(t * 0.27 + aSeed.x * 9.4247) * aSeed.z * 2.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * aSeed.w * (90.0 / -mv.z);
    float blink = 0.5 + 0.5 * sin(uTime * (0.8 + aSeed.y) + aSeed.x * 40.0);
    vAlpha = mix(1.0, blink, uBlink);
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

// Dust motes by day, fireflies at night. Count is set by the quality preset.
export function createParticles() {
  const random = mulberry32(2024);
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const seeds = new Float32Array(MAX_PARTICLES * 4);
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    positions[i * 3] = (random() * 2 - 1) * AREA.x;
    positions[i * 3 + 1] = AREA.yMin + random() * (AREA.yMax - AREA.yMin);
    positions[i * 3 + 2] = (random() * 2 - 1) * AREA.z;
    seeds[i * 4] = random();
    seeds[i * 4 + 1] = 0.6 + random() * 0.8;
    seeds[i * 4 + 2] = 0.6 + random() * 1.6;
    seeds[i * 4 + 3] = 0.6 + random() * 0.8;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geometry.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 4 },
      uPixelRatio: { value: 1 },
      uBlink: { value: 0 },
      uColor: { value: new THREE.Color('#ffffff') },
      uOpacity: { value: 0.5 },
    },
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'ambient-particles';
  points.frustumCulled = false;
  points.visible = false;

  return {
    points,
    setCount(count) {
      geometry.setDrawRange(0, Math.min(count, MAX_PARTICLES));
      points.visible = count > 0;
    },
    setPalette(config) {
      const u = material.uniforms;
      u.uColor.value.set(config.color);
      u.uSize.value = config.size;
      u.uOpacity.value = config.opacity;
      u.uBlink.value = config.blink;
      material.blending = config.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    },
    update(time, pixelRatio) {
      material.uniforms.uTime.value = time;
      material.uniforms.uPixelRatio.value = pixelRatio;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

// Kept few and modest in size: each is a large translucent layer, which is what costs on weaker GPUs.
const CLOUDS = [
  { x: -90, z: -22, size: 70, speed: 1.6 },
  { x: -10, z: 30, size: 85, speed: 1.1 },
  { x: 70, z: -35, size: 62, speed: 2.1 },
];
const CLOUD_WRAP = 150;

// A few large, soft shadows sliding across the ground: cheap "light movement" that reads as drifting clouds.
export function createCloudShadows(assets) {
  const group = new THREE.Group();
  group.name = 'cloud-shadows';
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: assets.cloud,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const patches = CLOUDS.map((cloud) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cloud.x, 0.32, cloud.z);
    mesh.scale.set(cloud.size, 1, cloud.size * 0.62);
    mesh.raycast = () => {};
    group.add(mesh);
    return { mesh, speed: cloud.speed };
  });
  group.visible = false;

  return {
    group,
    setOpacity(opacity) {
      material.opacity = opacity;
      group.visible = opacity > 0.001 && group.userData.enabled !== false;
    },
    setEnabled(enabled) {
      group.userData.enabled = enabled;
      group.visible = enabled && material.opacity > 0.001;
    },
    update(delta) {
      patches.forEach(({ mesh, speed }) => {
        mesh.position.x += speed * delta;
        if (mesh.position.x > CLOUD_WRAP) mesh.position.x = -CLOUD_WRAP;
      });
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
