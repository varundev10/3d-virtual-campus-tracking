import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/quality.js';

// Desktop cursor: a small chartreuse dot that follows the pointer exactly, and a larger ring that trails it and grows
// with a label over things you can act on ("OPEN"), the 3D stage ("DRAG") or anything tagged data-cursor="VIEW".
// Text inputs keep the native cursor; touch screens and reduced motion never get this at all (nothing is attached).
const ACTIONABLE = 'a[href], button:not(:disabled), [role="button"], [role="tab"], summary, .result-item, [data-cursor]';
const TEXT_FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]';

export default function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const label = useRef(null);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || prefersReducedMotion()) return undefined;
    const root = document.documentElement;
    const ringEl = ring.current;
    const dotEl = dot.current;
    root.classList.add('has-cursor');

    let x = -100;
    let y = -100;
    let rx = x;
    let ry = y;
    let raf = 0;

    const draw = () => {
      raf = 0;
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      ringEl.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      if (Math.abs(x - rx) > 0.1 || Math.abs(y - ry) > 0.1) raf = requestAnimationFrame(draw);
    };
    const setState = (state, text = '') => {
      if (ringEl.dataset.state !== state) ringEl.dataset.state = state;
      dotEl.dataset.state = state;
      if (label.current.textContent !== text) label.current.textContent = text;
    };
    const onMove = (event) => {
      x = event.clientX;
      y = event.clientY;
      dotEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (!raf) raf = requestAnimationFrame(draw);
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest(TEXT_FIELD)) setState('hidden');
      else if (target.closest('canvas')) setState('active', 'DRAG');
      else {
        const hit = target.closest(ACTIONABLE);
        if (hit) setState('active', hit.getAttribute('data-cursor') ?? 'OPEN');
        else setState('idle');
      }
    };
    const onLeave = () => setState('hidden');

    document.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
      root.classList.remove('has-cursor');
    };
  }, []);

  return (
    <div className="cursor" aria-hidden="true">
      <span className="cursor-ring" ref={ring} data-state="hidden"><span className="cursor-label" ref={label} /></span>
      <span className="cursor-dot" ref={dot} data-state="hidden" />
    </div>
  );
}
