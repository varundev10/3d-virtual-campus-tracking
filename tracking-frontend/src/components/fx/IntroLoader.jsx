import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth.jsx';
import { prefersReducedMotion } from '../../lib/quality.js';
import Motif from './Motif.jsx';

// First visit of the session only: a three-digit counter climbs 000 to 100 in huge mono numerals while the motif
// spins, then the screen splits open onto the page. It runs on top of the app, which is already loading underneath,
// so it never delays real content: it waits for fonts and the session check, takes at least 700 ms so it can be read
// and at most 1.5 s no matter what. Skippable by click, the Skip button or Esc; focus is never trapped; not shown
// again this session, and not shown at all under reduced motion.
const KEY = 'ucer.loaderPlayed';
const MIN_MS = 700;
const MAX_MS = 1500;
const OPEN_MS = 650;

function shouldPlay() {
  try {
    return window.sessionStorage.getItem(KEY) !== '1' && !prefersReducedMotion();
  } catch {
    return false;
  }
}

export default function IntroLoader() {
  const [phase, setPhase] = useState(() => (shouldPlay() ? 'count' : 'done'));
  const { status } = useAuth();
  const digits = useRef(null);
  const ready = useRef({ fonts: false, session: false });

  useEffect(() => {
    ready.current.session = status !== 'loading';
  }, [status]);

  const skip = useCallback(() => setPhase((current) => (current === 'count' ? 'open' : current)), []);

  useEffect(() => {
    if (phase !== 'count') return undefined;
    try {
      window.sessionStorage.setItem(KEY, '1');
    } catch {
      // Storage unavailable: the loader may play again on reload, which is harmless.
    }
    if (document.fonts?.ready) document.fonts.ready.then(() => { ready.current.fonts = true; });
    else ready.current.fonts = true;

    const start = performance.now();
    let shown = 0;
    let raf = 0;
    const step = (now) => {
      const elapsed = now - start;
      const settled = ready.current.fonts && ready.current.session && elapsed >= MIN_MS;
      const goal = settled ? 100 : Math.min(92, (elapsed / MIN_MS) * 92);
      shown += (goal - shown) * 0.22 + (goal > shown ? 0.4 : 0);
      if (shown >= 99.5 || elapsed >= MAX_MS) shown = 100;
      if (digits.current) digits.current.textContent = String(Math.round(shown)).padStart(3, '0');
      if (shown >= 100) setPhase('open');
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase === 'count') {
      const onKey = (event) => { if (event.key === 'Escape') skip(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    if (phase === 'open') {
      const timer = window.setTimeout(() => setPhase('done'), OPEN_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase, skip]);

  if (phase === 'done') return null;
  return (
    <div className="loader" data-phase={phase} onClick={skip} role="status" aria-label="Loading UCER Smart Campus">
      <div className="loader-half loader-top" aria-hidden="true" />
      <div className="loader-half loader-bottom" aria-hidden="true" />
      <div className="loader-core" aria-hidden="true">
        <Motif size={72} spin />
        <p className="loader-count"><span ref={digits}>000</span></p>
        <p className="label">UCER Smart Campus</p>
      </div>
      <button type="button" className="btn btn-sm loader-skip" onClick={skip}>
        Skip <kbd aria-hidden="true">Esc</kbd>
      </button>
    </div>
  );
}
