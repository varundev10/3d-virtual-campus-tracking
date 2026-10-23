import { useId } from 'react';
import Motif from './Motif.jsx';

// A round badge of type that turns slowly around the motif ("EXPLORE • UCER • CAMPUS •"). The string is laid on a circle
// with textLength set to its circumference, so the ring closes exactly whatever the text. Decorative: hidden from
// assistive tech, and the turn stops under reduced motion (CSS in styles/fx.css).
const RADIUS = 45;
const CIRCUMFERENCE = Math.round(2 * Math.PI * RADIUS);

export default function TextBadge({ text, className = '' }) {
  const id = `badge-path-${useId().replace(/:/g, '')}`;
  return (
    <div className={`text-badge ${className}`} aria-hidden="true">
      <svg className="text-badge-ring" viewBox="0 0 120 120" focusable="false">
        <defs>
          <path id={id} d={`M60 60m-${RADIUS} 0a${RADIUS} ${RADIUS} 0 1 1 ${RADIUS * 2} 0a${RADIUS} ${RADIUS} 0 1 1 -${RADIUS * 2} 0`} />
        </defs>
        <text>
          <textPath href={`#${id}`} textLength={CIRCUMFERENCE} lengthAdjust="spacing">{text.toUpperCase()}</textPath>
        </text>
      </svg>
      <Motif size={34} />
    </div>
  );
}
