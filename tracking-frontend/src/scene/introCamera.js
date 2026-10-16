import * as THREE from 'three';

// Camera path for the cinematic intro: a slow descending sweep around the campus that ends exactly on the
// explorer's normal starting view. Driven by the scene's own render loop and the existing camera/controls.
export const INTRO_SECONDS = 7;
// The path starts farther out than OrbitControls normally allows; the limit is lifted only while it plays.
export const INTRO_MAX_DISTANCE = 420;

const FOV_START = 34;
const FOV_END = 45;
const SWEEP_RADIANS = 2.6;
const START_RADIUS_XZ = 240;
const START_HEIGHT = 175;

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

// Places the camera and orbit target for `progress` in 0..1. `end` is the normal starting camera position.
export function applyIntroPose(camera, controls, end, progress) {
  const e = easeInOutCubic(THREE.MathUtils.clamp(progress, 0, 1));
  const endAzimuth = Math.atan2(end.x, end.z);
  const endRadius = Math.hypot(end.x, end.z);
  const azimuth = endAzimuth - SWEEP_RADIANS * (1 - e);
  const radius = THREE.MathUtils.lerp(START_RADIUS_XZ, endRadius, e);
  const height = THREE.MathUtils.lerp(START_HEIGHT, end.y, e) + 6 * Math.sin(Math.PI * e);
  camera.position.set(Math.sin(azimuth) * radius, height, Math.cos(azimuth) * radius);
  controls.target.set(0, THREE.MathUtils.lerp(14, 0, e), 0);
  camera.fov = THREE.MathUtils.lerp(FOV_START, FOV_END, e);
  camera.updateProjectionMatrix();
}

export const NORMAL_FOV = FOV_END;
