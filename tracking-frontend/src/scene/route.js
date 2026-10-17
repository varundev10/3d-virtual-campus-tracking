import * as THREE from 'three';
import { easeInOutCubic } from './introCamera.js';

// Guidance from the user's GPS position to the chosen destination, drawn in the scene: a glowing tube that draws
// itself from the start to the end, a light pulse that then travels along it, and a ring and beam that mark the
// destination. The two end points are real positions; the line between them is a straight line, not a path.
//
// One visual is built per destination. GPS updates only move its end points (see CampusScene), so the reveal
// plays once per destination and the pulse never restarts.
export const ROUTE_Y = 1.2;
const REVEAL_SECONDS = 1.1;
const PULSE_TRIPS_PER_SECOND = 0.4;

// The route is gold on the night stage and burgundy on the ivory day model; the travelling pulse is the opposite tone,
// so it stays visible against the line. Light bleed (glow, halo, beam) is additive at night and a faint wash by day,
// since adding light to a pale ground would show nothing.
const COLORS = {
  night: new THREE.Color('#d7b477'),
  day: new THREE.Color('#210c13'),
};
const PULSE_COLORS = {
  night: new THREE.Color('#faf3eb'),
  day: new THREE.Color('#d7b477'),
};
const LOOK = {
  night: { glow: 0.22, halo: 0.3, beam: 0.42, blending: THREE.AdditiveBlending },
  day: { glow: 0.1, halo: 0.16, beam: 0.2, blending: THREE.NormalBlending },
};

const UP = new THREE.Vector3(0, 1, 0);
const direction = new THREE.Vector3();
const orientation = new THREE.Quaternion();
const noRaycast = () => {};

const glowMaterial = (color, opacity) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false, blending: THREE.AdditiveBlending,
});

export function createRouteVisual() {
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 1, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: COLORS.night, toneMapped: false, fog: false }),
  );
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1, 14, 1, true), glowMaterial(COLORS.night, 0.2));
  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 16, 12),
    new THREE.MeshBasicMaterial({ color: PULSE_COLORS.night, toneMapped: false, fog: false }),
  );
  const halo = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12), glowMaterial(COLORS.night, 0.28));

  // The destination is a building's centre, so the ring is a unit circle scaled to sit just outside its footprint
  // (see `radius`), and the beam is tall enough to clear any roof; neither would show from inside the building.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.022, 8, 64).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COLORS.night, transparent: true, opacity: 0, toneMapped: false, fog: false }),
  );
  ring.position.y = 0.3;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 36, 8, 1, true), glowMaterial(COLORS.night, 0));
  beam.position.y = 18;
  const marker = new THREE.Group();
  marker.add(ring, beam);

  const group = new THREE.Group();
  group.name = 'route';
  group.add(tube, glow, pulse, halo, marker);
  // Nothing shows until the first update places it (zero length, hidden), and nothing gets in the way of picking
  // buildings.
  group.traverse((child) => {
    child.raycast = noRaycast;
  });
  group.visible = false;
  tube.scale.set(1, 0.001, 1);
  glow.scale.set(1, 0.001, 1);
  pulse.visible = false;
  halo.visible = false;
  marker.visible = false;

  return {
    group, tube, glow, pulse, halo, marker, ring, beam, from: new THREE.Vector3(), to: new THREE.Vector3(), reveal: 0,
    radius: 6, // set by the scene to clear the destination building's footprint
  };
}

// Advances the reveal and places every part for the current end points. `motion` is 0 under reduced motion: the
// line is then drawn at once and nothing pulses.
export function updateRouteVisual(route, dt, elapsed, motion, mode) {
  const length = direction.subVectors(route.to, route.from).length();
  route.group.visible = length > 0.5;
  if (!route.group.visible) return;
  direction.divideScalar(length);
  orientation.setFromUnitVectors(UP, direction);

  route.reveal = motion ? Math.min(1, route.reveal + dt / REVEAL_SECONDS) : 1;
  const shown = length * easeInOutCubic(route.reveal);
  [route.tube, route.glow].forEach((part) => {
    part.visible = shown > 0.01;
    part.scale.set(1, Math.max(shown, 0.001), 1);
    part.quaternion.copy(orientation);
    part.position.copy(route.from).addScaledVector(direction, shown / 2);
  });
  const color = COLORS[mode] ?? COLORS.night;
  const look = LOOK[mode] ?? LOOK.night;
  route.tube.material.color.copy(color);
  route.pulse.material.color.copy(PULSE_COLORS[mode] ?? PULSE_COLORS.night);
  [route.glow, route.halo, route.beam].forEach((part) => {
    const { material } = part;
    material.color.copy(color);
    if (material.blending !== look.blending) {
      material.blending = look.blending;
      material.needsUpdate = true;
    }
  });
  route.glow.material.opacity = look.glow;
  route.halo.material.opacity = look.halo;
  route.ring.material.color.copy(color);

  // The destination marker fades in as the line reaches it.
  const arrived = THREE.MathUtils.smoothstep(route.reveal, 0.8, 1);
  route.marker.visible = arrived > 0.01;
  route.marker.position.set(route.to.x, 0, route.to.z);
  const ringPhase = motion ? (elapsed * 0.7) % 1 : 0.3;
  route.ring.scale.setScalar(route.radius * (1 + ringPhase * 0.3));
  route.ring.material.opacity = arrived * (1 - ringPhase * 0.6);
  route.beam.material.opacity = arrived * look.beam;

  // Once drawn, a light runs from the start to the destination, over and over.
  const travelling = motion > 0 && route.reveal >= 1;
  route.pulse.visible = travelling;
  route.halo.visible = travelling;
  if (travelling) {
    const trip = (elapsed * PULSE_TRIPS_PER_SECOND) % 1;
    route.pulse.position.copy(route.from).addScaledVector(direction, length * trip);
    route.halo.position.copy(route.pulse.position);
    const size = 0.8 + 0.4 * Math.sin(trip * Math.PI);
    route.pulse.scale.setScalar(size);
    route.halo.scale.setScalar(size);
  }
}

// Where the camera goes to show the whole route: centred on its midpoint, as far back as it takes to fit, keeping
// the viewing direction the user already has (so framing never spins the view).
export function routeFramePose(route, camera, orbitTarget, fov) {
  const center = new THREE.Vector3().addVectors(route.from, route.to).multiplyScalar(0.5);
  center.y = 0;
  const current = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbitTarget));
  const radius = THREE.MathUtils.clamp(route.from.distanceTo(route.to) * 1.15 + 36, 60, 190);
  const phi = THREE.MathUtils.clamp(current.phi, 0.8, 1.2);
  const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, current.theta));
  return { position: center.clone().add(offset), target: center, fov };
}
