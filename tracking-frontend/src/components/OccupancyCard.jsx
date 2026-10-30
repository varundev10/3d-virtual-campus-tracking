import { useEffect } from 'react';
import Icon from './ui/Icon.jsx';
import { BarList } from './ui/Charts.jsx';
import { EmptyState, ErrorState, Spinner } from './ui/States.jsx';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { formatNumber } from '../lib/format.js';

const WINDOW_MINUTES = 10;
const REFRESH_MS = 30_000;

// Where people on campus are right now, as counts per place and per classroom. Never names anyone.
export default function OccupancyCard() {
  const crowd = useAsync(() => api.getCrowd(WINDOW_MINUTES), []);
  const reload = crowd.reload;

  useEffect(() => {
    const id = window.setInterval(reload, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [reload]);

  const s = crowd.data;
  const places = (s?.places ?? []).filter((p) => p.count > 0).map((p) => ({ label: p.name, value: p.count }));
  const rooms = (s?.classrooms ?? []).filter((r) => r.count > 0);

  return (
    <section className="card" aria-labelledby="occupancy-title">
      <header className="card-header">
        <div>
          <h2 id="occupancy-title">Campus occupancy</h2>
          <p>People who shared a position in the last {WINDOW_MINUTES} minutes. Counts only.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload} disabled={crowd.loading}>
          <Icon name="refresh" size={16} /> Refresh
        </button>
      </header>

      {crowd.loading && !s && <Spinner label="Loading occupancy" />}
      {crowd.error && !s && <ErrorState message={crowd.error.message} onRetry={reload} />}
      {s && (
        <div className="occupancy">
          <p className="occupancy-total">
            <strong>{formatNumber(s.onCampus)}</strong> on campus
            {s.elsewhere > 0 && <small> · {formatNumber(s.elsewhere)} between places</small>}
          </p>
          {s.onCampus === 0 ? (
            <EmptyState icon="locate" title="Nobody is sharing a position">Occupancy appears when users share their on-campus location.</EmptyState>
          ) : (
            <>
              {places.length > 0 && <BarList rows={places} />}
              {rooms.length > 0 && (
                <>
                  <h3 className="occupancy-sub">Classrooms in use</h3>
                  <ul className="room-list">
                    {rooms.map((r) => {
                      const over = r.capacity != null && r.count > r.capacity;
                      return (
                        <li key={r.code}>
                          <strong>{r.code}</strong>
                          <span className="muted">{r.departmentName ?? r.name}</span>
                          <span className={`badge ${over ? 'badge-status-bunked' : 'badge-good'}`}>
                            {r.count}{r.capacity != null ? ` / ${r.capacity}` : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
