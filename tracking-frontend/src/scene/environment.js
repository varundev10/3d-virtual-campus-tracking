import * as THREE from 'three';
import { setInteractionPalette } from './interaction.js';

// Day / night looks for the 3D scene, driven by the site theme (see lib/sceneMode.js). Switching mode only restyles
// objects that already exist (see applyEnvironment), so the renderer, camera, controls, selection and route are
// never rebuilt.
//
// The scene is the same world as the interface (styles/tokens.css). Night is After Dark: a jet stage, graphite
// buildings with chartreuse lit windows, a pink survey grid and rim light, pink beacons for people, and chartreuse as
// the interruption (geofence, route, the selected building). Day is the soft paper model: white walls, jet roofs and
// glazing, soft shadows on a paper ground, with pink and chartreuse only as fills and lines. In both, colour on a
// building comes only from the category pin above it.
export const PALETTES = {
  night: {
    sky: { top: '#050505', horizon: '#3a0f2c', bottom: '#0b0b0b' },
    skyGlow: { color: '#FF2DA8', power: 500 },
    fog: '#0B0B0B',
    fogNear: 120,
    fogFar: 340,
    sunPosition: [58, 84, 12],
    sunColor: '#ffffff',
    sun: 1.3,
    hemiSky: '#c4c4c4',
    hemiGround: '#0B0B0B',
    hemi: 0.95,
    rimColor: '#FF2DA8',
    rim: 0.8,
    environment: 0.12,
    ground: '#141414',
    farGround: '#0B0B0B',
    road: '#070707',
    plaza: '#1f1f1f',
    wall: '#2b2b2b',
    roof: '#5c5c5c',
    gridMajor: '#FF2DA8',
    gridMinor: '#2a2a2a',
    gridOpacity: 0.7,
    geofence: '#D4FF3F',
    tree: { canopy: '#2f9d72', trunk: '#000000' },
    // Window colors by variant: chartreuse lit, soft white lit, dark.
    windows: ['#D4FF3F', '#F5F5F2', '#0f0f0f'],
    lamp: { head: '#f1ffc0', halo: 0.85, pool: 0.5 },
    stars: 1,
    particles: { color: '#D4FF3F', additive: true, size: 6.5, opacity: 0.9, blink: 1 },
    cloudShadow: 0,
    blobShadow: 0.65,
    marker: { current: '#FF2DA8', other: '#ff9bd6', stem: '#6e6e6e' },
    interaction: {
      hover: '#D4FF3F', hoverWall: '#3a3a3a', hoverRoof: '#7a7a7a', outline: '#D4FF3F',
      selectWall: '#D4FF3F', selectRoof: '#F5F5F2', dim: '#0B0B0B', dimAmount: 0.55, emissive: 0.2,
    },
  },
  day: {
    sky: { top: '#e6e6e1', horizon: '#F5F5F2', bottom: '#efefea' },
    skyGlow: { color: '#ff9fd2', power: 160 },
    fog: '#F5F5F2',
    fogNear: 170,
    fogFar: 450,
    // From the camera's left, so shadows fall to the right and read clearly (the start camera is at +x, +z).
    sunPosition: [-62, 74, 52],
    sunColor: '#ffffff',
    sun: 1.9,
    hemiSky: '#ffffff',
    hemiGround: '#d6d6d0',
    hemi: 0.75,
    rimColor: '#ffffff',
    rim: 0.15,
    environment: 0.12,
    ground: '#e9e9e4',
    farGround: '#F5F5F2',
    road: '#cfcfc9',
    plaza: '#dcdcd6',
    wall: '#ffffff',
    roof: '#0B0B0B',
    gridMajor: '#FF2DA8',
    gridMinor: '#d8d8d2',
    gridOpacity: 0.7,
    geofence: '#FF2DA8',
    tree: { canopy: '#D4FF3F', trunk: '#0B0B0B' },
    // By day the same three variants are glazing: jet glass on white walls with the odd pink pane.
    windows: ['#0B0B0B', '#FF2DA8', '#2b2b2b'],
    lamp: { head: '#9a9a9a', halo: 0, pool: 0 },
    stars: 0,
    particles: { color: '#FF2DA8', additive: false, size: 3.5, opacity: 0.28, blink: 0 },
    cloudShadow: 0.07,
    blobShadow: 0.3,
    marker: { current: '#FF2DA8', other: '#8a8a8a', stem: '#5c5c5c' },
    interaction: {
      hover: '#0B0B0B', hoverWall: '#ececec', hoverRoof: '#2b2b2b', outline: '#0B0B0B',
      selectWall: '#D4FF3F', selectRoof: '#0B0B0B', dim: '#e9e9e4', dimAmount: 0.6, emissive: 0,
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
  // The streamed tiles are true-size, so the scene sets `viewScale` to push the fog out with them.
  const viewScale = ctx.viewScale ?? 1;
  scene.fog.near = p.fogNear * viewScale;
  scene.fog.far = p.fogFar * viewScale;
  scene.environmentIntensity = p.environment;

  ctx.sky.setPalette(p);
  ctx.farGround.material.color.set(p.farGround);
  ctx.ground.material.color.set(p.ground);
  ctx.road.color.set(p.road);
  if (ctx.plaza) {
    ctx.plaza.material.color.set(p.plaza);
    ctx.plaza.userData.ring.material.color.set(p.geofence);
  }
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
  ctx.greenery?.setPalette(p);
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

// A user's own pin is a pink beacon on both stages; everyone else reads as a quiet pale pink by night or grey by day.
export function applyMarkerPalette(marker, palette) {
  const color = marker.userData.isCurrent ? palette.marker.current : palette.marker.other;
  const { head, ring, stem } = marker.userData;
  head.material.color.set(color);
  head.material.emissive.set(color);
  ring.material.color.set(color);
  stem.material.color.set(palette.marker.stem);
}
