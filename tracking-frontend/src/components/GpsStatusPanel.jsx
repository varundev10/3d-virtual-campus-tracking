import Icon from './ui/Icon.jsx';
import { formatCoordinate } from '../lib/geo.js';

const STATUS = {
  idle: { tone: 'neutral', title: 'Location is off', text: 'Turn on location to see where you are and get directions. Nothing is shared unless you choose to.' },
  requesting: { tone: 'info', title: 'Waiting for GPS…', text: 'Allow location access in your browser prompt. A first fix can take a few seconds.' },
  tracking: { tone: 'good', title: 'On campus', text: 'Your position is inside the campus boundary.' },
  outside: { tone: 'warning', title: 'Outside campus', text: 'Your GPS position is outside the campus boundary, so it is not shared and the campus view may not include you.' },
  denied: { tone: 'critical', title: 'Location permission denied', text: 'Allow location for this site in your browser settings, then try again. You can still browse the campus map.' },
  unavailable: { tone: 'critical', title: 'Position unavailable', text: 'Your device could not determine a position. Move to an open area or check that location services are on.' },
  timeout: { tone: 'warning', title: 'GPS is taking too long', text: 'No position yet. The browser keeps trying; moving outdoors usually helps.' },
  unsupported: { tone: 'critical', title: 'Location not supported', text: 'This browser does not provide the Geolocation API.' },
  insecure: { tone: 'critical', title: 'Secure connection required', text: 'Browsers only allow location on HTTPS or localhost. Open the app over HTTPS to use GPS.' },
};

export default function GpsStatusPanel({ geo, share, onShareChange }) {
  const info = STATUS[geo.status] ?? STATUS.idle;
  const canStart = !['unsupported', 'insecure'].includes(geo.status);

  return (
    <section className={`gps-panel tone-${info.tone}`} aria-live="polite">
      <div className="gps-head">
        <span className="gps-icon"><Icon name={info.tone === 'good' ? 'locate' : info.tone === 'critical' ? 'alert' : 'compass'} /></span>
        <div>
          <strong>{info.title}</strong>
          <p>{info.text}</p>
        </div>
      </div>

      {!geo.online && (
        <p className="gps-note"><Icon name="wifiOff" size={16} /> You are offline. GPS may still work, but nothing can be sent to the campus server.</p>
      )}

      {geo.position && (
        <p className="gps-coords">
          {formatCoordinate(geo.position.latitude)}, {formatCoordinate(geo.position.longitude)}
          {geo.position.accuracy != null && <> · ±{Math.round(geo.position.accuracy)} m</>}
        </p>
      )}

      <div className="gps-actions">
        {geo.active ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={geo.stop}>Turn off location</button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={geo.start} disabled={!canStart}>
            <Icon name="locate" size={16} /> {geo.status === 'denied' ? 'Try again' : 'Use my location'}
          </button>
        )}
        <label className="check">
          <input type="checkbox" checked={share} onChange={(e) => onShareChange(e.target.checked)} />
          Share my on-campus position with campus administration
        </label>
      </div>

      {share && geo.active && (
        <p className={`gps-sync sync-${geo.sync.state}`}>
          {geo.sync.state === 'saved' && `Shared at ${geo.sync.at.toLocaleTimeString()}`}
          {geo.sync.state === 'idle' && 'Waiting for a position to share…'}
          {['paused', 'offline', 'error'].includes(geo.sync.state) && geo.sync.message}
        </p>
      )}
    </section>
  );
}
