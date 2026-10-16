import { useSyncExternalStore } from 'react';

// Graphics quality for the 3D scene. Every optional effect is gated by one of these presets, and the
// choice is kept per device. When nothing is stored, a conservative default is picked from the device.
const KEY = 'ucer.quality';

export const QUALITY_LEVELS = ['low', 'medium', 'high'];

export const QUALITY_PRESETS = {
  low: {
    pixelRatio: 1,
    shadows: false,
    shadowMapSize: 1024,
    particles: 0,
    stars: 0,
    cloudShadows: false,
    environmentMap: false,
  },
  medium: {
    pixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    particles: 120,
    stars: 220,
    cloudShadows: true,
    // Image-based lighting is the single most expensive optional effect here, so it is High only.
    environmentMap: false,
  },
  high: {
    pixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    particles: 260,
    stars: 520,
    cloudShadows: true,
    environmentMap: true,
  },
};

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// Automatic choice: Low for clearly weak devices, otherwise Medium. High (2048 shadows, environment-map
// reflections, full particle count) is opt-in: the browser cannot tell us how fast the GPU is.
function detectQuality() {
  try {
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = navigator.deviceMemory ?? 4;
    return cores <= 2 || memory <= 2 ? 'low' : 'medium';
  } catch {
    return 'medium';
  }
}

function readStored() {
  try {
    const value = window.localStorage.getItem(KEY);
    return QUALITY_LEVELS.includes(value) ? value : null;
  } catch {
    return null;
  }
}

let current = readStored() ?? detectQuality();
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setQuality(level) {
  if (!QUALITY_LEVELS.includes(level)) return;
  current = level;
  try {
    window.localStorage.setItem(KEY, level);
  } catch {
    // Storage unavailable (private mode); the choice still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function useQuality() {
  const level = useSyncExternalStore(subscribe, () => current, () => 'medium');
  return [level, setQuality];
}
