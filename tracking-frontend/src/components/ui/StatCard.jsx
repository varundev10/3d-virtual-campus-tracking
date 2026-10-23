import Icon from './Icon.jsx';
import { useCountUp } from '../../lib/useCountUp.js';

// `tone` marks the one or two figures that carry meaning beyond their number: 'live' (chartreuse) for what is happening
// right now, 'brand' (pink) for the headline count. Everything else stays flat.
export default function StatCard({ icon, label, value, hint, tone }) {
  const shown = useCountUp(String(value));
  return (
    <article className={`stat-card ${tone ? `tone-${tone}` : ''}`}>
      <div className="stat-card-head">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon"><Icon name={icon} size={18} /></span>}
      </div>
      <strong className="stat-value">
        <span aria-hidden="true">{shown}</span>
        <span className="sr-only">{value}</span>
      </strong>
      {hint && <p className="stat-hint">{hint}</p>}
    </article>
  );
}
