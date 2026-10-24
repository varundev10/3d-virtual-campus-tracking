import Icon from './ui/Icon.jsx';

// Shown in place of the 3D canvas when WebGL cannot run (or its graphics context was lost). Pages that
// also have a list or map keep working next to it, so nothing about finding a place depends on WebGL.
export default function SceneUnavailable({ reason = 'unsupported' }) {
  const lost = reason === 'lost';
  return (
    <div className="scene-unavailable" role="status">
      <span className="empty-icon"><Icon name="cube" size={22} /></span>
      <strong className="scene-unavailable-title">{lost ? '3D view paused' : '3D view unavailable'}</strong>
      <p>
        {lost
          ? 'The browser reclaimed the graphics context. It usually comes back on its own; if it does not, reload the page.'
          : 'This browser or device could not start WebGL, which the 3D campus needs. You can still browse every place from the list, or switch to the map.'}
      </p>
      {lost && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
          Reload page
        </button>
      )}
    </div>
  );
}
