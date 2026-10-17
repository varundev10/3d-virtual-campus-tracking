import { useCallback, useSyncExternalStore } from 'react';
import { prefersReducedMotion } from './quality.js';

// Light / dark theme for the whole interface and the 3D scene: ivory by day, burgundy by night, gold in both.
// The choice is kept per device; without one the system preference decides. index.html sets data-theme before the
// first paint, so this module only has to agree with it, never to repaint a flash of the wrong world.
const KEY = 'ucer.theme';
const META_COLORS = { dark: '#210c13', light: '#faf3eb' };
const REVEAL_MS = 760;
const listeners = new Set();

function readStored() {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function initialTheme() {
  const attribute = document.documentElement.dataset.theme;
  if (attribute === 'light' || attribute === 'dark') return attribute;
  return readStored() ?? systemTheme();
}

function paint(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
}

let current = initialTheme();
paint(current);

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(theme) {
  current = theme;
  paint(theme);
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // Storage unavailable (private mode); the choice still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

const nextFrame = () => new Promise((resolve) => { requestAnimationFrame(resolve); });

/**
 * Switches theme. With the View Transitions API the new world is revealed as a circle growing from `origin` (the
 * toggle that was pressed); otherwise the colours cross-fade. Reduced motion switches instantly.
 */
export function setTheme(next, origin) {
  if (next !== 'light' && next !== 'dark') return;
  if (next === current) return;
  const root = document.documentElement;

  if (prefersReducedMotion()) {
    commit(next);
    return;
  }
  if (typeof document.startViewTransition !== 'function') {
    root.classList.add('theme-fade');
    commit(next);
    window.setTimeout(() => root.classList.remove('theme-fade'), 520);
    return;
  }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(async () => {
    commit(next);
    // Two frames, so React and the 3D scene have restyled before the new snapshot is taken.
    await nextFrame();
    await nextFrame();
  });
  transition.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: REVEAL_MS, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
  transition.finished.catch(() => {});
}

function originOf(event) {
  const rect = event?.currentTarget?.getBoundingClientRect?.();
  return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined;
}

// [theme, toggle]. Pass the click event to toggle() so the reveal grows from the button.
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => 'dark');
  const toggle = useCallback((event) => {
    setTheme(current === 'dark' ? 'light' : 'dark', originOf(event));
  }, []);
  return [theme, toggle];
}
