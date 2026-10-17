import Icon from './ui/Icon.jsx';
import { categoryColor, categoryLabel } from '../lib/locationCategories.js';
import {
  bearingDegrees, compassDirection, distanceMeters, formatCoordinate, formatDistance,
} from '../lib/geo.js';

// Floating details for the selected place. Everything shown comes from the campus-locations API (name, code,
// category, description, coordinates) or from the user's own GPS fix (distance and direction). Nothing is
// invented: a field with no data is simply left out.
export default function PlaceInfoPanel({
  place, position, navigating, view, onDeselect, onOverview, onNavigate, onToggleView,
}) {
  return (
    <section className="card location-detail place-card" aria-labelledby="place-title">
      <header className="place-card-head">
        <span className="category-tag">
          <span className="swatch" style={{ background: categoryColor(place.category) }} />{categoryLabel(place.category)}
        </span>
        <button type="button" className="icon-button" onClick={onDeselect} aria-label="Deselect place" title="Deselect (Esc)">
          <Icon name="close" />
        </button>
      </header>
      <h2 id="place-title">{place.name}</h2>
      <p className="mono">{place.code}</p>
      {place.description && <p className="place-desc">{place.description}</p>}
      <dl className="detail-list two-col">
        <div><dt>Coordinates</dt><dd>{formatCoordinate(place.latitude)}, {formatCoordinate(place.longitude)}</dd></div>
        {position && (
          <div>
            <dt>From you</dt>
            <dd>{formatDistance(distanceMeters(position, place))} {compassDirection(bearingDegrees(position, place))}</dd>
          </div>
        )}
      </dl>
      <div className="row-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onNavigate} disabled={navigating}>
          <Icon name="navigation" size={16} /> {navigating ? 'Navigating' : 'Navigate here'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onToggleView}>
          Show on {view === '3d' ? 'map' : '3D view'}
        </button>
      </div>
      <button type="button" className="btn btn-ghost btn-sm place-back" onClick={onOverview}>
        <Icon name="target" size={16} /> Back to overview
      </button>
    </section>
  );
}
