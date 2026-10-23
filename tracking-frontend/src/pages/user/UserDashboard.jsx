import { useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import { AsyncBlock, EmptyState } from '../../components/ui/States.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { Link } from '../../lib/router.jsx';
import { categoryColor, categoryLabel } from '../../lib/locationCategories.js';
import { formatCoordinate } from '../../lib/geo.js';
import { formatDateTime, timeAgo, titleCase } from '../../lib/format.js';
import { clearRecentDestinations, readRecentDestinations } from '../../lib/recentDestinations.js';

const QUICK_ACTIONS = [
  { to: '/app/explore', icon: 'cube', title: 'Explore the campus', text: 'Rotate and zoom the 3D campus model.' },
  { to: '/app/explore?focus=search', icon: 'search', title: 'Search locations', text: 'Find buildings, labs and facilities.' },
  { to: '/app/explore', icon: 'navigation', title: 'Navigate', text: 'Pick a destination and get directions.' },
  { to: '/app/profile', icon: 'user', title: 'My profile', text: 'Account details and password.' },
];

export default function UserDashboard() {
  const { user } = useAuth();
  const locations = useAsync(() => api.getCampusLocations(), []);
  const pings = useAsync(() => api.getRecentLocations(user.id), [user.id]);
  const attendance = useAsync(() => api.getAttendance(user.id), [user.id]);
  const [recent, setRecent] = useState(() => readRecentDestinations(user.id));

  const byCategory = useMemo(() => {
    const counts = {};
    (locations.data ?? []).forEach((l) => { counts[l.category] = (counts[l.category] ?? 0) + 1; });
    return Object.entries(counts);
  }, [locations.data]);

  const recentLocations = useMemo(
    () => recent.map((code) => (locations.data ?? []).find((l) => l.code === code)).filter(Boolean),
    [recent, locations.data],
  );

  const firstName = user.name.split(' ')[0];

  return (
    <div className="page-stack">
      <section className="welcome card">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>Welcome back, {firstName}</h1>
          <p className="muted">Signed in as {user.email} · <span className={`badge badge-role-${user.role.toLowerCase()}`}>{titleCase(user.role)}</span></p>
        </div>
        <Link to="/app/explore" className="btn btn-primary"><Icon name="cube" /> Open 3D explorer</Link>
      </section>

      <section aria-labelledby="qa-title">
        <h2 id="qa-title" className="section-title">Quick actions</h2>
        <div className="quick-grid">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.title} to={action.to} className="quick-card" data-tilt>
              <span className="quick-icon"><Icon name={action.icon} size={20} /></span>
              <strong>{action.title}</strong>
              <span>{action.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="card" aria-labelledby="dir-title">
          <header className="card-header"><h2 id="dir-title">Campus directory</h2></header>
          <AsyncBlock resource={locations} loadingLabel="Loading campus locations">
            {(data) => (data.length === 0 ? (
              <EmptyState icon="building" title="No campus locations yet">Locations appear here once administration adds them.</EmptyState>
            ) : (
              <>
                <p className="muted">{data.length} mapped location{data.length === 1 ? '' : 's'} on campus.</p>
                <ul className="category-list">
                  {byCategory.map(([category, count]) => (
                    <li key={category}>
                      <Link to={`/app/explore?category=${category}`}>
                        <span className="swatch" style={{ background: categoryColor(category) }} />
                        <span>{categoryLabel(category)}</span>
                        <strong>{count}</strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ))}
          </AsyncBlock>
        </section>

        <section className="card" aria-labelledby="recent-title">
          <header className="card-header">
            <h2 id="recent-title">Recent destinations</h2>
            {recentLocations.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { clearRecentDestinations(user.id); setRecent([]); }}>Clear</button>
            )}
          </header>
          {recentLocations.length === 0 ? (
            <EmptyState icon="navigation" title="No recent destinations">Places you navigate to are remembered on this device.</EmptyState>
          ) : (
            <ul className="link-list">
              {recentLocations.map((l) => (
                <li key={l.code}>
                  <Link to={`/app/explore?location=${encodeURIComponent(l.code)}`}>
                    <span className="swatch" style={{ background: categoryColor(l.category) }} />
                    <span>{l.name}</span>
                    <small>{categoryLabel(l.category)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="loc-hist-title">
          <header className="card-header">
            <div>
              <h2 id="loc-hist-title">My shared locations</h2>
              <p>The last positions you chose to share while on campus.</p>
            </div>
          </header>
          <AsyncBlock resource={pings} loadingLabel="Loading your location history">
            {(data) => (data.length === 0 ? (
              <EmptyState icon="locate" title="Nothing shared yet">Turn on location in the explorer and opt in to sharing while on campus.</EmptyState>
            ) : (
              <ul className="timeline">
                {data.map((p) => (
                  <li key={p.id}>
                    <strong>{p.latitude != null ? `${formatCoordinate(p.latitude)}, ${formatCoordinate(p.longitude)}` : p.source}</strong>
                    <span>{p.source} · <time dateTime={p.timestamp} title={formatDateTime(p.timestamp)}>{timeAgo(p.timestamp)}</time></span>
                  </li>
                ))}
              </ul>
            ))}
          </AsyncBlock>
        </section>

        <section className="card" aria-labelledby="att-title">
          <header className="card-header"><h2 id="att-title">My attendance</h2></header>
          <AsyncBlock resource={attendance} loadingLabel="Loading attendance">
            {(data) => (data.length === 0 ? (
              <EmptyState icon="clock" title="No attendance records">Records appear here once attendance is marked.</EmptyState>
            ) : (
              <ul className="timeline">
                {[...data].sort((a, b) => new Date(b.checkTime) - new Date(a.checkTime)).slice(0, 6).map((r) => (
                  <li key={r.id}>
                    <strong>{r.classroomId}</strong>
                    <span><span className={`badge badge-status-${r.status.toLowerCase()}`}>{titleCase(r.status)}</span> · {formatDateTime(r.checkTime)}</span>
                  </li>
                ))}
              </ul>
            ))}
          </AsyncBlock>
        </section>
      </div>
    </div>
  );
}
