import * as THREE from 'three';
import { setInteractionPalette } from './interaction.js';

// Day / night looks for the 3D scene, driven by the site theme (see lib/sceneMode.js). Switching mode only restyles
// objects that already exist (see applyEnvironment), so the renderer, camera, controls, selection and route are
// never rebuilt.
//
// Night is the burgundy world: a stage that matches the page, wine-dark buildings with bronze roofs and lit windows,
// and champagne gold as the one signal (rim light, fireflies, geofence, route, the selected building, the user's
// pin). Day is the ivory world: pale walls, burgundy roofs and glazing, soft shadows on warm paper. In both, colour
// on a building comes only from the category pin above it.
export const PALETTES = {
  night: {
    sky: { top: '#12060b', horizon: '#3b1823', bottom: '#190a10' },
    skyGlow: { color: '#7a5f33', power: 500 },
    fog: '#210c13',
    fogNear: 120,
    fogFar: 340,
    sunPosition: [58, 84, 12],
    sunColor: '#f4dcc0',
    sun: 1.3,
    hemiSky: '#c9a9a0',
    hemiGround: '#12060b',
    hemi: 0.95,
    rimColor: '#d7b477',
    rim: 0.8,
    environment: 0.12,
    ground: '#2a1119',
    farGround: '#210c13',
    road: '#3a1b26',
    wall: '#4a2837',
    roof: '#8e7243',
    gridMajor: '#5c4522',
    gridMinor: '#34171f',
    gridOpacity: 0.7,
    geofence: '#d7b477',
    // Window colors by variant: warm lit, ivory lit, dark.
    windows: ['#f6d9a0', '#faf3eb', '#1a0a10'],
    lamp: { head: '#f6d9a0', halo: 0.85, pool: 0.5 },
    stars: 1,
    particles: { color: '#e6c98f', additive: true, size: 6.5, opacity: 0.9, blink: 1 },
    cloudShadow: 0,
    blobShadow: 0.65,
    marker: { current: '#d7b477', other: '#b39aa3', stem: '#7a5a66' },
    interaction: {
      hover: '#d7b477', hoverWall: '#613546', hoverRoof: '#b3945a', outline: '#d7b477',
      selectWall: '#faf3eb', selectRoof: '#d7b477', dim: '#210c13', dimAmount: 0.55, emissive: 0.2,
    },
  },
  day: {
    sky: { top: '#efe1d2', horizon: '#faf3eb', bottom: '#e8dacb' },
    skyGlow: { color: '#3a2c14', power: 160 },
    fog: '#faf3eb',
    fogNear: 170,
    fogFar: 450,
    // From the camera's left, so shadows fall to the right and read clearly (the start camera is at +x, +z).
    sunPosition: [-62, 74, 52],
    sunColor: '#fff1d8',
    sun: 1.9,
    hemiSky: '#ffffff',
    hemiGround: '#c4b09f',
    hemi: 0.75,
    rimColor: '#ffffff',
    rim: 0.15,
    environment: 0.12,
    ground: '#efe3d4',
    farGround: '#f4eadf',
    road: '#dccbb8',
    wall: '#fffaf3',
    roof: '#210c13',
    gridMajor: '#cdb89c',
    gridMinor: '#e3d4c1',
    gridOpacity: 0.7,
    geofence: '#7d5a1b',
    // By day the same three variants are glazing: dark glass on pale walls.
    windows: ['#3a1f2a', '#4b2a37', '#210c13'],
    lamp: { head: '#a08a7a', halo: 0, pool: 0 },
    stars: 0,
    particles: { color: '#8a6b3a', additive: false, size: 3.5, opacity: 0.28, blink: 0 },
    cloudShadow: 0.07,
    blobShadow: 0.3,
    marker: { current: '#210c13', other: '#9a8088', stem: '#6e5560' },
    interaction: {
      hover: '#000000', hoverWall: '#efe2d2', hoverRoof: '#4a2837', outline: '#210c13',
      selectWall: '#210c13', selectRoof: '#d7b477', dim: '#efe3d4', dimAmount: 0.6, emissive: 0,
    },
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
  ctx.geofence?.material.color.set(p.geofence);

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
  setInteractionPalette(p.interaction);
  ctx.zoneObjects.forEach(({ building, roof, windows }) => {
    // The per-frame hover / dim tint (scene/interaction.js) is built from these base colors; at rest they are
    // shown as is.
    building.material.userData.base.set(p.wall);
    building.material.color.copy(building.material.userData.base);
    roof.material.userData.base.set(p.roof);
    roof.material.color.copy(roof.material.userData.base);
    ctx.kit.tintWindows(windows, p);
  });
  ctx.markers?.forEach((marker) => applyMarkerPalette(marker, p));
}

// A user's own pin is gold on the night stage and burgundy on the day model; everyone else reads as a quiet mauve.
export function applyMarkerPalette(marker, palette) {
  const color = marker.userData.isCurrent ? palette.marker.current : palette.marker.other;
  const { head, ring, stem } = marker.userData;
  head.material.color.set(color);
  head.material.emissive.set(color);
  ring.material.color.set(color);
  stem.material.color.set(palette.marker.stem);
}
