import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './quality.js';

// Counts a formatted whole number (such as "1,204") up from where it was, so a figure that has just loaded or just
// changed visibly arrives instead of appearing. Anything that is not a plain positive count, and reduced motion,
// is returned as it is.
export function useCountUp(text, duration = 800) {
  const target = /^\d[\d,]*$/.test(text) ? Number(text.replaceAll(',', '')) : null;
  const animate = target !== null && target > 0 && !prefersReducedMotion();
  const [current, setCurrent] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (!animate) return undefined;
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setCurrent(Math.round(origin + (target - origin) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, target, duration]);

  return animate ? current.toLocaleString() : text;
}
