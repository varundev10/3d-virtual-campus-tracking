import { useEffect, useRef } from 'react';
import Motif from './Motif.jsx';

// An endless ticker. The track holds two identical lists and slides by exactly half its width, so the loop has no
// seam; it pauses on hover and focus, pauses itself while scrolled off-screen, leans with scroll speed (data-skew),
// and stops under reduced motion (CSS). The visual lists are aria-hidden and the items are announced once, as plain text.
export default function Marquee({ items, tone = 'pink', label = 'Highlights', className = '' }) {
  const root = useRef(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      el.toggleAttribute('data-offscreen', !entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const list = (key) => (
    <ul className="marquee-list" aria-hidden="true" key={key}>
      {[...items, ...items].map((item, i) => (
        <li key={`${key}-${i}`}>
          <span>{item}</span>
          <Motif size={18} />
        </li>
      ))}
    </ul>
  );
  return (
    <div ref={root} className={`marquee marquee-${tone} ${className}`} role="group" aria-label={label} data-skew>
      <p className="sr-only">{items.join(', ')}</p>
      <div className="marquee-track">
        {list('a')}
        {list('b')}
      </div>
    </div>
  );
}
