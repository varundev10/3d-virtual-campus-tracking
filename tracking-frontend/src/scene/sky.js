import * as THREE from 'three';
import { mulberry32 } from './assets.js';

const DOME_RADIUS = 500;
const MAX_STARS = 520;

// The dome is pinned to the far plane (xyww) and drawn after the opaque scene with a depth test, so the GPU
// only shades sky pixels that nothing else covers instead of the whole screen.
const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clip.xyww;
  }
`;

// Three-stop vertical gradient plus a tight sun/moon glow and a wider halo around it.
const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunPower;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 color = h > 0.0
      ? mix(uHorizon, uTop, pow(h, 0.5))
      : mix(uHorizon, uBottom, pow(-h, 0.6));
    float s = max(dot(dir, uSunDir), 0.0);
    color += uSunColor * (pow(s, uSunPower) + 0.22 * pow(s, 7.0));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const STAR_VERT = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uTime;
  attribute vec2 aSeed;
  varying float vTwinkle;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (1.1 + aSeed.x * 1.6) * uPixelRatio;
    vTwinkle = 0.65 + 0.35 * sin(uTime * (0.6 + aSeed.x) + aSeed.y * 60.0);
  }
`;

const STAR_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d) * uOpacity * vTwinkle;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.98, 0.94, 0.88, a);
    #include <colorspace_fragment>
  }
`;

// Gradient sky dome and a star field. One group that follows the camera, so the sky never parallaxes.
export function createSky() {
  const group = new THREE.Group();
  group.name = 'sky';

  const domeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uSunPower: { value: 300 },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    depthFunc: THREE.LessEqualDepth,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 32, 20), domeMaterial);
  dome.renderOrder = 20; // after every opaque object (renderOrder 0), before the transparent pass
  dome.frustumCulled = false;
  group.add(dome);

  const random = mulberry32(42);
  const positions = new Float32Array(MAX_STARS * 3);
  const seeds = new Float32Array(MAX_STARS * 2);
  for (let i = 0; i < MAX_STARS; i += 1) {
    const angle = random() * Math.PI * 2;
    const y = 0.1 + random() * 0.9;
    const ring = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(angle) * ring * (DOME_RADIUS - 20);
    positions[i * 3 + 1] = y * (DOME_RADIUS - 20);
    positions[i * 3 + 2] = Math.sin(angle) * ring * (DOME_RADIUS - 20);
    seeds[i * 2] = random();
    seeds[i * 2 + 1] = random();
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));
  starGeometry.setDrawRange(0, 0);
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.renderOrder = -9; // first in the transparent pass, so everything else blends over the stars
  stars.frustumCulled = false;
  group.add(stars);

  const sunDirection = new THREE.Vector3();

  return {
    group,
    setPalette(palette) {
      const u = domeMaterial.uniforms;
      u.uTop.value.set(palette.sky.top);
      u.uHorizon.value.set(palette.sky.horizon);
      u.uBottom.value.set(palette.sky.bottom);
      u.uSunColor.value.set(palette.skyGlow.color);
      u.uSunPower.value = palette.skyGlow.power;
      sunDirection.set(...palette.sunPosition).normalize();
      u.uSunDir.value.copy(sunDirection);
      starMaterial.uniforms.uOpacity.value = palette.stars;
    },
    setStarCount(count) {
      starGeometry.setDrawRange(0, Math.min(count, MAX_STARS));
      stars.visible = count > 0;
    },
    update(camera, time, pixelRatio) {
      group.position.copy(camera.position);
      starMaterial.uniforms.uTime.value = time;
      starMaterial.uniforms.uPixelRatio.value = pixelRatio;
    },
    dispose() {
      dome.geometry.dispose();
      domeMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
    },
  };
}
