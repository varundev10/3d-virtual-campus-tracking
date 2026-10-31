import AdminLayout from '../../layouts/AdminLayout.jsx';
import Icon from '../../components/ui/Icon.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { BarList, ChartCard } from '../../components/ui/Charts.jsx';
import { ErrorState } from '../../components/ui/States.jsx';
import AlertsPanel from '../../components/AlertsPanel.jsx';
import AttentionStrip from '../../components/AttentionStrip.jsx';
import OccupancyCard from '../../components/OccupancyCard.jsx';
import { api } from '../../lib/api.js';
import { useAsync } from '../../lib/useAsync.js';
import { Link } from '../../lib/router.jsx';
import { formatDateTime, formatNumber, titleCase } from '../../lib/format.js';
import { categoryLabel } from '../../lib/locationCategories.js';

const toRows = (map, label = titleCase) => Object.entries(map ?? {}).map(([key, value]) => ({ label: label(key), value }));

export default function AdminOverview() {
  const stats = useAsync(() => api.getAdminStats(), []);

  const s = stats.data;

  return (
    <AdminLayout
      title="Overview"
      actions={(
        <button type="button" className="btn btn-secondary btn-sm" onClick={stats.reload} disabled={stats.loading}>
          <Icon name="refresh" size={16} /> Refresh
        </button>
      )}
    >
      {stats.loading && !s && (
        <div className="stat-grid" role="status" aria-label="Loading campus statistics">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="stat-card is-skeleton" aria-hidden="true">
              <span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" />
            </div>
          ))}
        </div>
      )}
      {stats.error && !s && <ErrorState title="Could not load statistics" message={stats.error.message} onRetry={stats.reload} />}
      {s && (
        <div className="page-stack">
          <p className="muted small">Figures from the live database · updated {formatDateTime(s.generatedAt)}</p>
          <div className="stat-grid">
            <StatCard tone="brand" icon="users" label="Registered users" value={formatNumber(s.users.total)}
              hint={`${formatNumber(s.users.active)} active · ${formatNumber(s.users.inactive)} deactivated`} />
            <StatCard icon="building" label="Campus locations" value={formatNumber(s.locations.total)}
              hint={`${Object.keys(s.locations.byCategory).length} categories`} />
            <StatCard tone="live" icon="locate" label="Actively tracking" value={formatNumber(s.tracking.activeUsers)}
              hint={`Users with a location ping in the last ${s.tracking.activeWindowMinutes} min`} />
            <StatCard icon="activity" label="Location pings (24 h)" value={formatNumber(s.tracking.pingsLast24h)}
              hint={`${formatNumber(s.tracking.pingsTotal)} stored in total`} />
            <StatCard icon="clock" label="Attendance records" value={formatNumber(s.attendance.total)}
              hint={Object.entries(s.attendance.byStatus).map(([k, v]) => `${formatNumber(v)} ${k.toLowerCase()}`).join(' · ') || 'None recorded'} />
            <StatCard icon="alert" label="Open alerts" value={formatNumber(s.alerts.open)}
              hint={`${formatNumber(s.alerts.total)} raised in total`} />
          </div>

          <AttentionStrip refreshKey={s.generatedAt} />

          <div className="grid-2">
            <ChartCard title="Users by role" rows={toRows(s.users.byRole)} labelHeader="Role" valueHeader="Users" empty="No users registered yet.">
              <BarList rows={toRows(s.users.byRole)} />
            </ChartCard>
            <ChartCard title="Locations by category" rows={toRows(s.locations.byCategory, categoryLabel)} labelHeader="Category" valueHeader="Locations" empty="No campus locations yet.">
              <BarList rows={toRows(s.locations.byCategory, categoryLabel)} />
            </ChartCard>
          </div>

          <div className="grid-2">
            <AlertsPanel title="Alerts" subtitle="Bunks, classes missed by faculty and impossible movements." canAcknowledge pageSize={5} onChange={stats.reload} />
            <OccupancyCard />
          </div>

          <div className="grid-2">
            <section className="card" aria-labelledby="shortcuts-title">
              <header className="card-header"><h2 id="shortcuts-title">Shortcuts</h2></header>
              <ul className="link-list">
                <li><Link to="/admin/users"><Icon name="users" /> <span>Manage users and roles</span></Link></li>
                <li><Link to="/admin/academics"><Icon name="clock" /> <span>Departments, classrooms and the timetable</span></Link></li>
                <li><Link to="/admin/locations"><Icon name="building" /> <span>Add or edit campus locations</span></Link></li>
                <li><Link to="/admin/tracking"><Icon name="activity" /> <span>Open the live tracking view</span></Link></li>
                <li><Link to="/admin/reports"><Icon name="chart" /> <span>Activity and attendance reports</span></Link></li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
