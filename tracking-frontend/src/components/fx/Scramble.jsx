import { useCallback, useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/quality.js';

const GLYPHS = '!<>-_/[]{}=+*^?#%&';
const MAX_MS = 1400; // resolve by the clock too, so a low frame rate cannot leave the label scrambled

// Micro-label that scrambles through random glyphs and resolves into the real word, once when it scrolls into view
// and again on hover or focus. Under reduced motion the text is simply shown. The scrambling copy is aria-hidden; a
// visually hidden copy carries the real text.
export default function Scramble({ text, as: Tag = 'span', className = '' }) {
  const visible = useRef(null);
  const frame = useRef(0);

  const run = useCallback(() => {
    const el = visible.current;
    if (!el || prefersReducedMotion()) return;
    cancelAnimationFrame(frame.current);
    const chars = [...text];
    const plan = chars.map((char, i) => ({
      char,
      start: Math.floor(Math.random() * 10) + i * 1.5,
      end: 14 + Math.floor(Math.random() * 12) + i * 1.5,
    }));
    let tick = 0;
    const started = performance.now();
    const step = () => {
      tick += 1;
      const late = performance.now() - started > MAX_MS;
      let done = 0;
      el.textContent = plan.map((item) => {
        if (item.char === ' ') { done += 1; return ' '; }
        if (late || tick >= item.end) { done += 1; return item.char; }
        if (tick < item.start) return item.char;
        return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }).join('');
      if (done < plan.length) frame.current = requestAnimationFrame(step);
      else el.textContent = text;
    };
    frame.current = requestAnimationFrame(step);
  }, [text]);

  useEffect(() => {
    const el = visible.current;
    if (!el || prefersReducedMotion() || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        run();
        observer.disconnect();
      }
    }, { threshold: 0.6 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [run]);

  return (
    <Tag className={`scramble ${className}`} onPointerEnter={run} onFocus={run}>
      <span ref={visible} aria-hidden="true">{text}</span>
      <span className="sr-only">{text}</span>
    </Tag>
  );
}
