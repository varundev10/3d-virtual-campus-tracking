import * as THREE from 'three';
import { easeInOutCubic } from './introCamera.js';

const from = new THREE.Spherical();
const to = new THREE.Spherical();
const offset = new THREE.Vector3();
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const lerp = THREE.MathUtils.lerp;

/**
 * Time-based camera moves for the existing camera and OrbitControls. Each flight interpolates in spherical
 * coordinates around a moving orbit target, so it arcs around the subject instead of sliding in a straight line,
 * and it eases in and out regardless of frame rate. Call update() once per frame from the scene's render loop.
 *
 * A flight never fights the user: cancel() (called when OrbitControls reports pointer or wheel input) ends it
 * on the spot and leaves the camera wherever it was.
 */
export function createCameraDirector(camera, controls) {
  let flight = null;

  // OrbitControls keeps rotating for a while after the user lets go (damping). That leftover momentum would be added
  // on top of the flight and leave it slightly short of its destination, so it is applied in one go (and cleared)
  // before every move starts.
  const flushInertia = () => {
    const { enableDamping, autoRotate } = controls;
    controls.enableDamping = false;
    controls.autoRotate = false;
    controls.update();
    controls.enableDamping = enableDamping;
    controls.autoRotate = autoRotate;
  };

  const apply = (position, target, fov) => {
    camera.position.copy(position);
    controls.target.copy(target);
    if (fov != null && fov !== camera.fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  };

  return {
    get active() { return flight !== null; },

    cancel() { flight = null; },

    // position / target are world vectors. A duration of 0 jumps. The move's clock starts at the first update()
    // after this call, not now: a long frame just before it (the page reacting to a click, a shader build) must
    // not use up part of the move, or its first drawn frame would already be well on the way.
    flyTo({ position, target, fov = camera.fov, duration, onDone }) {
      flushInertia();
      if (!(duration > 0)) {
        flight = null;
        apply(position, target, fov);
        onDone?.();
        return;
      }
      from.setFromVector3(offset.copy(camera.position).sub(controls.target));
      to.setFromVector3(offset.copy(position).sub(target));
      flight = {
        t0: null,
        duration,
        fromTarget: controls.target.clone(),
        toTarget: target.clone(),
        fromFov: camera.fov,
        toFov: fov,
        radius: [from.radius, to.radius],
        phi: [from.phi, to.phi],
        theta: from.theta,
        thetaDelta: wrapAngle(to.theta - from.theta), // shortest way round
        onDone,
      };
    },

    // Advances the active flight; `now` is the render loop's clock in seconds. Returns true while one is running.
    update(now) {
      if (!flight) return false;
      const f = flight;
      if (f.t0 == null) f.t0 = now;
      const t = THREE.MathUtils.clamp((now - f.t0) / f.duration, 0, 1);
      const e = easeInOutCubic(t);
      controls.target.lerpVectors(f.fromTarget, f.toTarget, e);
      to.set(lerp(f.radius[0], f.radius[1], e), lerp(f.phi[0], f.phi[1], e), f.theta + f.thetaDelta * e);
      offset.setFromSpherical(to);
      camera.position.copy(controls.target).add(offset);
      if (f.toFov !== f.fromFov) {
        camera.fov = lerp(f.fromFov, f.toFov, e);
        camera.updateProjectionMatrix();
      }
      if (t >= 1) {
        flight = null;
        f.onDone?.();
      }
      return true;
    },
  };
}
