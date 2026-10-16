import Icon from './Icon.jsx';

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="spinner-label">{label}…</span>
    </div>
  );
}

// Shimmering placeholder lines; keeps the layout steady while data loads.
export function Skeleton({ label = 'Loading', lines = 4 }) {
  return (
    <div className="skeleton" role="status">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: lines }, (_, i) => <span key={i} className="skeleton-line" aria-hidden="true" />)}
    </div>
  );
}

export function EmptyState({ icon = 'info', title, children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <Icon name="alert" size={20} />
      <div>
        <strong>{title}</strong>
        {message && <p>{message}</p>}
      </div>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Retry
        </button>
      )}
    </div>
  );
}

// Renders loading / error / content for an async resource from useAsync.
export function AsyncBlock({ resource, loadingLabel, children }) {
  if (resource.loading && resource.data == null) return <Skeleton label={loadingLabel} />;
  if (resource.error && resource.data == null) return <ErrorState message={resource.error.message} onRetry={resource.reload} />;
  return children(resource.data);
}
