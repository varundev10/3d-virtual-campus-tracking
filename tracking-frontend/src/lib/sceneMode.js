import { useCallback, useSyncExternalStore } from 'react';

// Day / night environment for the 3D scene and map, shared by every view and kept per device.
// Switching only restyles the existing scene; it never remounts it, so camera and selection survive.
const KEY = 'ucer.sceneMode';
const listeners = new Set();

function read() {
  try {
    return window.localStorage.getItem(KEY) === 'day' ? 'day' : 'night';
  } catch {
    return 'night';
  }
}

let current = read();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSceneMode(mode) {
  current = mode === 'day' ? 'day' : 'night';
  try {
    window.localStorage.setItem(KEY, current);
  } catch {
    // Storage unavailable (private mode); the choice still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function useSceneMode() {
  const mode = useSyncExternalStore(subscribe, () => current, () => 'night');
  const toggle = useCallback(() => setSceneMode(current === 'day' ? 'night' : 'day'), []);
  return [mode, toggle];
}
