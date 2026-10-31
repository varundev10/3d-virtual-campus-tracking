import { useState } from 'react';
import Icon from './ui/Icon.jsx';
import { EmptyState, ErrorState, Spinner } from './ui/States.jsx';
import { useToast } from './ui/Toast.jsx';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { formatDateTime, timeAgo, titleCase } from '../lib/format.js';

// Filter chips; the value is the server-side alert type (empty means all).
const TYPES = [
  { value: '', label: 'All types' },
  { value: 'BUNK_DETECTED', label: 'Bunks' },
  { value: 'FACULTY_OFF_SCHEDULE', label: 'Off schedule' },
  { value: 'UNUSUAL_MOVEMENT', label: 'Unusual movement' },
];

const TYPE_TONE = {
  BUNK_DETECTED: 'badge-status-bunked',
  FACULTY_OFF_SCHEDULE: 'badge-warning',
  UNUSUAL_MOVEMENT: 'badge-warning',
};

// Alerts for whoever is signed in (the server scopes them). Staff can acknowledge; everyone else just reads.
export default function AlertsPanel({ title = 'Alerts', subtitle, canAcknowledge = false, pageSize = 8, onChange }) {
  const toast = useToast();
  const [view, setView] = useState('open');
  const [page, setPage] = useState(0);
  const [type, setType] = useState('');
  const [busyId, setBusyId] = useState(null);
  const acknowledged = view === 'open' ? false : undefined;
  const alerts = useAsync(
    () => api.getMyAlerts({ acknowledged, type, page, size: pageSize }),
    [view, type, page, pageSize],
  );

  const switchView = (next) => {
    setPage(0);
    setView(next);
  };

  const acknowledge = async (alert) => {
    setBusyId(alert.id);
    try {
      await api.acknowledgeAlert(alert.id);
      toast.success('Alert acknowledged');
      alerts.reload();
      onChange?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const data = alerts.data;

  return (
    <section className="card" aria-labelledby="alerts-panel-title">
      <header className="card-header">
        <div>
          <h2 id="alerts-panel-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="segmented-control" role="group" aria-label="Show alerts">
          <button type="button" className={view === 'open' ? 'active' : ''} aria-pressed={view === 'open'} onClick={() => switchView('open')}>Open</button>
          <button type="button" className={view === 'all' ? 'active' : ''} aria-pressed={view === 'all'} onClick={() => switchView('all')}>All</button>
        </div>
      </header>

      <div className="chip-row" role="group" aria-label="Alert type">
        {TYPES.map((t) => (
          <button key={t.value} type="button" className={`chip ${type === t.value ? 'active' : ''}`} aria-pressed={type === t.value}
            onClick={() => { setPage(0); setType(t.value); }}>{t.label}</button>
        ))}
      </div>

      {alerts.loading && !data && <Spinner label="Loading alerts" />}
      {alerts.error && <ErrorState message={alerts.error.message} onRetry={alerts.reload} />}
      {data && data.content.length === 0 && (
        <EmptyState icon="check" title={view === 'open' ? 'No open alerts' : 'No alerts yet'}>
          {view === 'open' ? 'Everything raised so far has been acknowledged.' : 'Alerts appear when a bunk, an off-schedule class or an impossible movement is detected.'}
        </EmptyState>
      )}
      {data?.content.length > 0 && (
        <>
          <ul className="alert-list">
            {data.content.map((a) => (
              <li key={a.id} className={a.acknowledged ? 'is-done' : ''}>
                <div>
                  <span className={`badge ${TYPE_TONE[a.type] ?? 'badge-muted'}`}>{titleCase(a.type)}</span>
                  <p>{a.message}</p>
                  <small className="muted"><time dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</time>
                    {a.acknowledged && ` · acknowledged ${timeAgo(a.acknowledgedAt)}`}
                  </small>
                </div>
                {canAcknowledge && !a.acknowledged && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === a.id} onClick={() => acknowledge(a)}>
                    <Icon name="check" size={16} /> Acknowledge
                  </button>
                )}
              </li>
            ))}
          </ul>
          {data.totalPages > 1 && (
            <div className="pager">
              <span className="muted small">{data.totalElements.toLocaleString()} alerts · page {data.page + 1} of {data.totalPages}</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
