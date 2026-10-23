import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout.jsx';
import CampusScene from '../../components/LazyCampusScene.jsx';
import CampusMap from '../../components/CampusMap.jsx';
import MetricStrip from '../../components/MetricStrip.jsx';
import ActivityFeed from '../../components/ActivityFeed.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { connectLiveLocations } from '../../lib/liveLocations.js';
import { locationsToZones } from '../../lib/locationCategories.js';
import { DEFAULT_CAMPUS_MODEL_URL } from '../../lib/modelConfig.js';
import { useSceneMode } from '../../lib/sceneMode.js';
import { formatCoordinate } from '../../lib/geo.js';
import { daysAgo, formatDateTime, isoDate, timeAgo, titleCase } from '../../lib/format.js';

const WINDOWS = [
  { value: 5, label: 'Last 5 minutes' },
  { value: 15, label: 'Last 15 minutes' },
  { value: 60, label: 'Last hour' },
  { value: 1440, label: 'Last 24 hours' },
];
const SOURCES = ['GPS', 'BLE', 'WIFI', 'RFID'];

function PingHistory({ users, nameFor }) {
  const [filters, setFilters] = useState({ userId: '', source: '', from: daysAgo(6), to: isoDate(Date.now()) });
  const [page, setPage] = useState(0);
  const rangeInvalid = filters.from && filters.to && filters.from > filters.to;
  const pings = useAsync(
    () => (rangeInvalid ? Promise.resolve(null) : api.getPings({ ...filters, page, size: 20 })),
    [filters.userId, filters.source, filters.from, filters.to, page, rangeInvalid],
  );
  const set = (key) => (e) => {
    setPage(0);
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

  return (
    <section className="card" aria-labelledby="history-title">
      <header className="card-header">
        <div>
          <h2 id="history-title">Location ping history</h2>
          <p>Every stored ping, newest first.</p>
        </div>
      </header>
      <div className="toolbar">
        <select className="input" aria-label="Filter by user" value={filters.userId} onChange={set('userId')}>
          <option value="">All users</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="input" aria-label="Filter by source" value={filters.source} onChange={set('source')}>
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="inline-label">From <input className="input" type="date" value={filters.from} max={filters.to || undefined} onChange={set('from')} /></label>
        <label className="inline-label">To <input className="input" type="date" value={filters.to} min={filters.from || undefined} onChange={set('to')} /></label>
      </div>
      {rangeInvalid && <p className="form-error" role="alert">The start date must be on or before the end date.</p>}
      {pings.loading && !pings.data && !rangeInvalid && <Spinner label="Loading pings" />}
      {pings.error && <ErrorState message={pings.error.message} onRetry={pings.reload} />}
      {pings.data && pings.data.content.length === 0 && (
        <EmptyState icon="locate" title="No pings in this range">Pings are stored when users share their on-campus location.</EmptyState>
      )}
      {pings.data?.content.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th scope="col">User</th><th scope="col">Source</th><th scope="col">Position / reader</th><th scope="col">Time</th></tr>
              </thead>
              <tbody>
                {pings.data.content.map((p) => (
                  <tr key={p.id}>
                    <td>{nameFor(p.userId)}</td>
                    <td><span className="badge badge-muted">{p.source}</span></td>
                    <td className="mono small">
                      {p.latitude != null ? `${formatCoordinate(p.latitude)}, ${formatCoordinate(p.longitude)}` : p.beaconId ?? p.wifiPointId ?? p.rfidTagId ?? '—'}
                    </td>
                    <td className="small">{formatDateTime(p.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span className="muted small">{pings.data.totalElements.toLocaleString()} pings · page {pings.data.page + 1} of {Math.max(1, pings.data.totalPages)}</span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page + 1 >= pings.data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </>
      )}
    </section>
  );
}

export default function AdminTracking() {
  const { token } = useAuth();
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [userQuery, setUserQuery] = useState('');
  const [source, setSource] = useState('');
  const [positions, setPositions] = useState({});
  const [socketState, setSocketState] = useState('connecting');
  const [activity, setActivity] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [modelStatus, setModelStatus] = useState({ state: 'loading', label: 'Loading model' });
  const users = useAsync(() => api.getUsers(), []);
  const campus = useAsync(() => api.getCampusLocations(), []);
  const latest = useAsync(() => api.getLatestPositions(windowMinutes), [windowMinutes]);
  const [sceneMode, toggleSceneMode] = useSceneMode();

  const addActivity = useCallback((type, message) => {
    setActivity((items) => [
      { id: `${Date.now()}-${Math.random()}`, type, message, time: new Date().toLocaleTimeString() },
      ...items,
    ].slice(0, 18));
  }, []);

  const userMap = useMemo(() => new Map((users.data ?? []).map((u) => [String(u.id), u])), [users.data]);
  const nameFor = useCallback((id) => userMap.get(String(id))?.name ?? `User ${id}`, [userMap]);

  useEffect(() => {
    if (!latest.data) return;
    setPositions(Object.fromEntries(latest.data.map((p) => [String(p.userId), p])));
    setLastUpdate(new Date());
    addActivity('BACKEND', `Loaded ${latest.data.length} latest position${latest.data.length === 1 ? '' : 's'}`);
  }, [latest.data, addActivity]);

  useEffect(() => {
    const disconnect = connectLiveLocations(
      (ping) => {
        if (!ping.userId || ping.latitude == null || ping.longitude == null) return;
        setPositions((items) => ({ ...items, [String(ping.userId)]: ping }));
        setLastUpdate(new Date());
        addActivity('LIVE', `User ${ping.userId} position update received`);
      },
      (state) => {
        setSocketState(state);
        if (state === 'connected') addActivity('SOCKET', 'Live location feed connected');
        if (state === 'error') addActivity('SOCKET', 'Live feed unavailable; retrying');
      },
      token,
    );
    return disconnect;
  }, [token, addActivity]);

  const visible = useMemo(() => {
    const needle = userQuery.trim().toLowerCase();
    return Object.fromEntries(Object.entries(positions).filter(([id, ping]) => {
      if (source && ping.source !== source) return false;
      if (!needle) return true;
      const u = userMap.get(id);
      return u ? (u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle)) : id.includes(needle);
    }));
  }, [positions, source, userQuery, userMap]);

  const zones = useMemo(() => locationsToZones(campus.data ?? []), [campus.data]);
  const visibleList = Object.values(visible).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <AdminLayout
      title="Tracking / Activity"
      actions={(
        <button type="button" className="btn btn-secondary btn-sm" onClick={latest.reload} disabled={latest.loading}>
          <Icon name="refresh" size={16} /> Reload
        </button>
      )}
    >
      <div className="page-stack">
        <MetricStrip
          items={[
            { label: 'Users on map', value: Object.keys(visible).length },
            { label: 'Live feed', value: titleCase(socketState), tone: socketState === 'connected' ? 'good' : socketState === 'connecting' ? undefined : 'critical' },
            { label: 'Backend', value: latest.error ? 'Offline' : 'Online', tone: latest.error ? 'critical' : 'good' },
            { label: 'Window', value: WINDOWS.find((w) => w.value === windowMinutes)?.label },
            { label: 'Last update', value: lastUpdate ? lastUpdate.toLocaleTimeString() : '—' },
          ]}
        />

        <div className="toolbar card">
          <select className="input" aria-label="Time window" value={windowMinutes} onChange={(e) => setWindowMinutes(Number(e.target.value))}>
            {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <div className="search-input">
            <Icon name="search" />
            <input type="search" placeholder="Filter by user name or email" aria-label="Filter positions by user" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
          </div>
          <select className="input" aria-label="Filter by source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {latest.error && <ErrorState title="Could not load positions" message={latest.error.message} onRetry={latest.reload} />}

        <section className="tracking-grid">
          <div className="scene-panel">
            <div className="panel-heading">
              <div>
                <h2>3D Campus Model</h2>
                <p>Latest position per user with live updates</p>
              </div>
              <div className="row-actions" style={{ margin: 0, alignItems: 'center' }}>
                <span className={`status-chip ${modelStatus.state}`} title={modelStatus.detail}>{modelStatus.label}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={toggleSceneMode}
                  aria-label={sceneMode === 'day' ? 'Switch to dark theme' : 'Switch to light theme'}
                  title={sceneMode === 'day' ? 'Dark theme' : 'Light theme'}
                >
                  <Icon name={sceneMode === 'day' ? 'moon' : 'sun'} size={18} />
                </button>
              </div>
            </div>
            <CampusScene locations={visible} campusModelUrl={DEFAULT_CAMPUS_MODEL_URL} onModelStatus={setModelStatus} zones={zones} mode={sceneMode} />
          </div>

          <div className="map-panel">
            <div className="panel-heading">
              <div>
                <h2>OSM Geofence View</h2>
                <p>Campus boundary and positions</p>
              </div>
              <span className={`status-chip ${socketState}`}>{socketState}</span>
            </div>
            <CampusMap locations={visible} places={campus.data ?? []} userLabel={nameFor} followCurrent={false} mode={sceneMode} />
          </div>

          <section className="card positions-card" aria-labelledby="positions-title">
            <header className="card-header"><h2 id="positions-title">Current positions</h2></header>
            {latest.loading && !latest.data && <Spinner label="Loading positions" />}
            {latest.data && visibleList.length === 0 && (
              <EmptyState icon="locate" title="No one is sharing a location">
                No pings in this window{userQuery || source ? ' match the filters' : ''}. Users appear here when they share their on-campus position.
              </EmptyState>
            )}
            {visibleList.length > 0 && (
              <ul className="timeline compact">
                {visibleList.map((p) => (
                  <li key={p.userId}>
                    <strong>{nameFor(p.userId)}</strong>
                    <span>{p.source} · {formatCoordinate(p.latitude)}, {formatCoordinate(p.longitude)} · <time title={formatDateTime(p.timestamp)}>{timeAgo(p.timestamp)}</time></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ActivityFeed activity={activity} subtitle="Feed connection and position updates in this session" />
        </section>

        <PingHistory users={users.data ?? []} nameFor={nameFor} />
      </div>
    </AdminLayout>
  );
}
