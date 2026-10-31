import Icon from './ui/Icon.jsx';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Link } from '../lib/router.jsx';
import { formatNumber } from '../lib/format.js';

const KINDS = [
  { type: 'UNUSUAL_MOVEMENT', label: 'Unusual movement', hint: 'Impossible jumps: spoofed GPS or a shared device', icon: 'activity' },
  { type: 'BUNK_DETECTED', label: 'Bunks', hint: 'On campus but not in class', icon: 'alert' },
  { type: 'FACULTY_OFF_SCHEDULE', label: 'Off-schedule classes', hint: 'Faculty not in their classroom', icon: 'clock' },
];

// Open (unacknowledged) alerts by kind. Anything above zero is highlighted; zero reads as an all-clear.
export default function AttentionStrip({ refreshKey }) {
  const counts = useAsync(async () => {
    const pages = await Promise.all(KINDS.map((k) => api.getMyAlerts({ acknowledged: false, type: k.type, size: 1 })));
    return Object.fromEntries(KINDS.map((k, i) => [k.type, pages[i].totalElements]));
  }, [refreshKey]);

  if (counts.error || !counts.data) return null;
  const total = Object.values(counts.data).reduce((a, b) => a + b, 0);

  return (
    <section className="attention" aria-label="Needs attention">
      <p className="attention-title">
        <Icon name={total ? 'alert' : 'check'} size={16} />
        {total ? `${formatNumber(total)} open ${total === 1 ? 'alert needs' : 'alerts need'} attention` : 'All clear: nothing needs attention'}
      </p>
      <ul>
        {KINDS.map((k) => {
          const n = counts.data[k.type];
          return (
            <li key={k.type} className={n ? 'is-hot' : ''}>
              <Link to="/admin/reports" title={k.hint}>
                <Icon name={k.icon} size={18} />
                <span>{k.label}</span>
                <strong>{formatNumber(n)}</strong>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
