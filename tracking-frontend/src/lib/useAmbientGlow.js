import { useEffect } from 'react';
import { prefersReducedMotion } from './quality.js';

// A soft gold spotlight that follows a fine pointer across the page background (the gradient lives in
// styles/base.css and reads --mx / --my). Touch devices and reduced-motion users keep the resting glow.
export function useAmbientGlow() {
  useEffect(() => {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    if (!fine?.matches || prefersReducedMotion()) return undefined;

    const root = document.documentElement;
    let frame = 0;
    let x = 0;
    let y = 0;
    const flush = () => {
      frame = 0;
      root.style.setProperty('--mx', `${x}px`);
      root.style.setProperty('--my', `${y}px`);
    };
    const onMove = (event) => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
      root.style.removeProperty('--mx');
      root.style.removeProperty('--my');
    };
  }, []);
}
