import * as THREE from 'three';

// Day / night looks for the 3D scene. Switching mode only restyles objects that already exist (see
// applyEnvironment), so the renderer, camera, controls, selection and route are never rebuilt.
export const PALETTES = {
  night: {
    sky: { top: '#02050d', horizon: '#17294d', bottom: '#060b16' },
    skyGlow: { color: '#6a7fb8', power: 500 },
    fog: '#101e38',
    fogNear: 120,
    fogFar: 340,
    sunPosition: [58, 84, 12],
    sunColor: '#b9ccff',
    sun: 1.7,
    hemiSky: '#9bb8e8',
    hemiGround: '#0a1424',
    hemi: 1.1,
    rimColor: '#67e8f9',
    rim: 0.9,
    environment: 0.12,
    ground: '#0d1a2c',
    farGround: '#07101d',
    road: '#1a2a40',
    roof: '#26364f',
    gridMajor: '#1d6b86',
    gridMinor: '#16324d',
    gridOpacity: 0.5,
    // Window colors by variant: warm lit, cool lit, dark.
    windows: ['#ffd9a0', '#bfe4ff', '#0a1426'],
    lamp: { head: '#ffe2a8', halo: 0.9, pool: 0.5 },
    stars: 1,
    particles: { color: '#d8ff80', additive: true, size: 7, opacity: 0.95, blink: 1 },
    cloudShadow: 0,
    blobShadow: 0.6,
  },
  day: {
    sky: { top: '#4f8fd6', horizon: '#d9e8f5', bottom: '#a9bfcc' },
    skyGlow: { color: '#ffe2a8', power: 180 },
    fog: '#d3e3ef',
    fogNear: 210,
    fogFar: 440,
    // From the camera's left, so shadows fall to the right and read clearly (the start camera is at +x, +z).
    sunPosition: [-62, 74, 52],
    sunColor: '#fff0cc',
    sun: 3.2,
    hemiSky: '#ffffff',
    hemiGround: '#7b8f86',
    hemi: 1.2,
    rimColor: '#bfe9ff',
    rim: 0.3,
    environment: 0.16,
    ground: '#8fae93',
    farGround: '#7f9c83',
    road: '#59666f',
    roof: '#d2dae4',
    gridMajor: '#6f8f86',
    gridMinor: '#8aa598',
    gridOpacity: 0.3,
    // By day the same three variants are glass tones.
    windows: ['#86aacb', '#6f95b7', '#86aacb'],
    lamp: { head: '#cbd5e1', halo: 0, pool: 0 },
    stars: 0,
    particles: { color: '#fff8e8', additive: false, size: 4.5, opacity: 0.5, blink: 0 },
    cloudShadow: 0.13,
    blobShadow: 0.35,
  },
};

const gridMajor = new THREE.Color();
const gridMinor = new THREE.Color();

// Restyles the whole scene for `mode`. `ctx` holds references to the lights, materials and effect modules created
// once at mount; `ctx.zoneObjects` and `ctx.streetLights` change when the location list does.
export function applyEnvironment(ctx, mode) {
  const p = PALETTES[mode] ?? PALETTES.night;
  const { scene } = ctx;

  scene.background.set(p.fog);
  scene.fog.color.set(p.fog);
  scene.fog.near = p.fogNear;
  scene.fog.far = p.fogFar;
  scene.environmentIntensity = p.environment;

  ctx.sky.setPalette(p);
  ctx.farGround.material.color.set(p.farGround);
  ctx.ground.material.color.set(p.ground);
  ctx.road.color.set(p.road);

  // GridHelper stores its two line colors per vertex; rebuild just that color buffer.
  const colors = ctx.grid.geometry.getAttribute('color');
  gridMajor.set(p.gridMajor);
  gridMinor.set(p.gridMinor);
  // Four vertices per grid line; the middle line uses the "major" color, as in GridHelper itself.
  const lines = colors.count / 4;
  const center = (lines - 1) / 2;
  for (let line = 0; line < lines; line += 1) {
    const c = line === center ? gridMajor : gridMinor;
    for (let k = 0; k < 4; k += 1) colors.setXYZ(line * 4 + k, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
  ctx.grid.material.opacity = p.gridOpacity;

  ctx.hemi.color.set(p.hemiSky);
  ctx.hemi.groundColor.set(p.hemiGround);
  ctx.hemi.intensity = p.hemi;
  ctx.sun.position.set(...p.sunPosition);
  ctx.sun.color.set(p.sunColor);
  ctx.sun.intensity = p.sun;
  ctx.rim.color.set(p.rimColor);
  ctx.rim.intensity = p.rim;

  ctx.particles.setPalette(p.particles);
  ctx.clouds.setOpacity(p.cloudShadow);
  ctx.kit.setPalette(p);
  ctx.streetLights?.setPalette(p);
  ctx.zoneObjects.forEach(({ roof, windows }) => {
    roof.material.color.set(p.roof);
    ctx.kit.tintWindows(windows, p);
  });
}
