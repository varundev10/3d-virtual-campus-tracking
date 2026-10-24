import { useEffect, useRef, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout.jsx';
import CampusScene from '../../components/LazyCampusScene.jsx';
import { AccountSummary, ChangePasswordForm, ProfileNameForm } from '../../components/AccountForms.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { connectLiveLocations, WS_BASE_URL } from '../../lib/liveLocations.js';
import { CAMPUS_GEOFENCE } from '../../lib/campus.js';
import { CAMPUS_MODEL_TRANSFORM, DEFAULT_CAMPUS_MODEL_URL } from '../../lib/modelConfig.js';

function useSystemStatus(token) {
  const [apiState, setApiState] = useState({ state: 'checking', detail: null });
  const [socketState, setSocketState] = useState('checking');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setApiState({ state: 'checking', detail: null });
    const started = performance.now();
    api.me()
      .then(() => !cancelled && setApiState({ state: 'online', detail: `${Math.round(performance.now() - started)} ms` }))
      .catch((error) => !cancelled && setApiState({ state: 'offline', detail: error.message }));
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    setSocketState('checking');
    return connectLiveLocations(() => {}, setSocketState, token);
  }, [token, tick]);

  return { apiState, socketState, recheck: () => setTick((t) => t + 1) };
}

function ModelPreview() {
  const [url, setUrl] = useState(DEFAULT_CAMPUS_MODEL_URL);
  const [fileName, setFileName] = useState(null);
  const [status, setStatus] = useState({ state: 'loading', label: 'Loading model', detail: DEFAULT_CAMPUS_MODEL_URL });
  const objectUrl = useRef(null);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setFileName(file.name);
    setUrl(`${objectUrl.current}#${file.name}`);
  };

  return (
    <section className="card" aria-labelledby="model-title">
      <header className="card-header">
        <div>
          <h2 id="model-title">3D campus model</h2>
          <p>Configured model: <span className="mono">{DEFAULT_CAMPUS_MODEL_URL}</span></p>
        </div>
        <span className={`status-chip ${status.state}`}>{status.label}</span>
      </header>
      <p className="muted small">{status.detail}</p>
      <div className="model-preview">
        <CampusScene locations={{}} campusModelUrl={url} onModelStatus={setStatus} />
      </div>
      <div className="row-actions">
        <label className="btn btn-secondary btn-sm file-button">
          <Icon name="cube" size={16} /> Preview a local GLB / GLTF / OBJ file
          <input type="file" accept=".glb,.gltf,.obj" onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>
        {fileName && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFileName(null); setUrl(DEFAULT_CAMPUS_MODEL_URL); }}>
            Back to configured model
          </button>
        )}
      </div>
      <p className="muted small">
        Previews run only in this browser and are not uploaded. To publish a model for everyone, place it at
        <span className="mono"> public/models/ucer-campus.glb</span> (or set <span className="mono">VITE_CAMPUS_MODEL_URL</span>) and rebuild.
      </p>
    </section>
  );
}

export default function AdminSettings() {
  const { user, token } = useAuth();
  const { apiState, socketState, recheck } = useSystemStatus(token);

  return (
    <AdminLayout title="Settings">
      <div className="page-stack">
        <div className="grid-2">
          <section className="card" aria-labelledby="acct-title">
            <header className="card-header"><h2 id="acct-title">My account</h2></header>
            <AccountSummary user={user} />
            <ProfileNameForm />
          </section>
          <section className="card" aria-labelledby="pw-title">
            <header className="card-header"><h2 id="pw-title">Change password</h2></header>
            <ChangePasswordForm />
          </section>
        </div>

        <div className="grid-2">
          <section className="card" aria-labelledby="status-title">
            <header className="card-header">
              <h2 id="status-title">System status</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={recheck}><Icon name="refresh" size={16} /> Re-check</button>
            </header>
            <dl className="detail-list">
              <div><dt>REST API</dt><dd><span className={`status-chip ${apiState.state === 'online' ? 'connected' : apiState.state === 'offline' ? 'error' : ''}`}>{apiState.state}</span> {apiState.detail}</dd></div>
              <div><dt>Live location feed</dt><dd><span className={`status-chip ${socketState}`}>{socketState}</span></dd></div>
              <div><dt>API base URL</dt><dd className="mono">{api.baseUrl}</dd></div>
              <div><dt>WebSocket URL</dt><dd className="mono">{WS_BASE_URL}</dd></div>
            </dl>
            <p className="muted small">Server-side settings (database, JWT secret, bootstrap admin, CORS origins) are configured through environment variables on the backend and are intentionally not editable here.</p>
          </section>

          <section className="card" aria-labelledby="geo-title">
            <header className="card-header"><h2 id="geo-title">Campus geofence</h2></header>
            <p className="muted small">Positions outside this polygon are never stored. Defined in <span className="mono">src/lib/campus.js</span> and mirrored in the backend <span className="mono">GeofenceService</span>.</p>
            <table className="data-table compact">
              <thead><tr><th scope="col">#</th><th scope="col" className="num">Latitude</th><th scope="col" className="num">Longitude</th></tr></thead>
              <tbody>
                {CAMPUS_GEOFENCE.map(([lat, lng], i) => (
                  <tr key={`${lat}-${lng}`}><td>{i + 1}</td><td className="num mono">{lat}</td><td className="num mono">{lng}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">Model transform: scale {CAMPUS_MODEL_TRANSFORM.scale}, position ({CAMPUS_MODEL_TRANSFORM.position.x}, {CAMPUS_MODEL_TRANSFORM.position.y}, {CAMPUS_MODEL_TRANSFORM.position.z}), rotation ({CAMPUS_MODEL_TRANSFORM.rotation.x}, {CAMPUS_MODEL_TRANSFORM.rotation.y}, {CAMPUS_MODEL_TRANSFORM.rotation.z}).</p>
          </section>
        </div>

        <ModelPreview />
      </div>
    </AdminLayout>
  );
}
