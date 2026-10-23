import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CampusScene from '../../components/LazyCampusScene.jsx';
import CampusMap from '../../components/CampusMap.jsx';
import CinematicIntro from '../../components/CinematicIntro.jsx';
import GpsStatusPanel from '../../components/GpsStatusPanel.jsx';
import PlaceInfoPanel from '../../components/PlaceInfoPanel.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { useCampusGeolocation } from '../../lib/useCampusGeolocation.js';
import { useCampusIntro } from '../../lib/useCampusIntro.js';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import { hasPlayedIntro } from '../../lib/introSession.js';
import { prefersReducedMotion } from '../../lib/quality.js';
import { isWebGLAvailable } from '../../scene/webgl.js';
import { useRouter } from '../../lib/router.jsx';
import { categoryColor, categoryLabel, locationsToZones, matchesSearch } from '../../lib/locationCategories.js';
import {
  bearingDegrees, compassDirection, distanceMeters, formatDistance, osmWalkingRouteUrl, walkingMinutes,
} from '../../lib/geo.js';
import { pushRecentDestination } from '../../lib/recentDestinations.js';
import { DEFAULT_CAMPUS_MODEL_URL } from '../../lib/modelConfig.js';
import { useSceneMode } from '../../lib/sceneMode.js';

const ARRIVAL_RADIUS_M = 20;

function NavigationCard({ destination, position, geo, onEnd }) {
  if (!position) {
    return (
      <section className="nav-card" aria-live="polite">
        <header><Icon name="navigation" /> <strong>Navigating to {destination.name}</strong></header>
        <p>{geo.active ? 'Waiting for your GPS position to calculate directions…' : 'Turn on location to get directions from where you are.'}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEnd}>End navigation</button>
      </section>
    );
  }
  const meters = distanceMeters(position, destination);
  const arrived = meters <= ARRIVAL_RADIUS_M;
  const bearing = bearingDegrees(position, destination);
  return (
    <section className={`nav-card ${arrived ? 'arrived' : ''}`} aria-live="polite">
      <header><Icon name={arrived ? 'check' : 'navigation'} /> <strong>{arrived ? `You have arrived at ${destination.name}` : `To ${destination.name}`}</strong></header>
      {!arrived && (
        <div className="nav-figures">
          <div><span>Distance</span><strong>{formatDistance(meters)}</strong></div>
          <div><span>Direction</span><strong className="nav-direction"><span style={{ transform: `rotate(${bearing}deg)` }} aria-hidden="true">↑</span> {compassDirection(bearing)}</strong></div>
          <div><span>Walk</span><strong>~{walkingMinutes(meters)} min</strong></div>
        </div>
      )}
      <p className="muted small">
        Straight-line guidance from your live GPS position, shown on the 3D view and map; a different starting point cannot be chosen.
        Paths and building entrances are not mapped in this system, so use the walking route for turn-by-turn directions.
      </p>
      {!position.insideCampus && (
        <p className="muted small" role="status">You are outside the campus boundary, so the 3D view does not draw the line. The distance above is still measured from where you are.</p>
      )}
      <div className="row-actions">
        <a className="btn btn-secondary btn-sm" href={osmWalkingRouteUrl(position, destination)} target="_blank" rel="noreferrer">
          <Icon name="external" size={16} /> Walking route (OpenStreetMap)
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEnd}>End navigation</button>
      </div>
    </section>
  );
}

export default function CampusExplorer() {
  const { user } = useAuth();
  const { query, navigate } = useRouter();
  const locations = useAsync(() => api.getCampusLocations(), []);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(query.get('category') ?? '');
  const [selectedCode, setSelectedCode] = useState(query.get('location'));
  const [destinationCode, setDestinationCode] = useState(null);
  const [share, setShare] = useState(false);
  // Without WebGL there is no 3D view: start on the map (the place list beside it works either way).
  const [webgl] = useState(isWebGLAvailable);
  const [view, setView] = useState(webgl ? '3d' : 'map');
  const [modelStatus, setModelStatus] = useState({ state: 'loading', label: 'Loading model' });
  // The cinematic intro plays once per session, only with WebGL, and not when the visit is a deep link
  // (a place opened from the command palette, a search shortcut or a category link).
  const [introEnabled] = useState(() => (
    webgl && !hasPlayedIntro() && !['location', 'focus', 'category'].some((key) => query.has(key))
  ));
  const [reducedMotion] = useState(prefersReducedMotion);
  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const intro = useCampusIntro({
    enabled: introEnabled, locations, model: modelStatus, sceneReady, reducedMotion,
  });
  const endIntro = (finish) => () => {
    finish();
    // The overlay holds focus; hand it back to the page.
    document.getElementById('main')?.focus({ preventScroll: true });
  };
  // The HUD column starts open on desktop; on small screens it starts as a collapsed bottom sheet
  // unless the page was opened to show a specific location or the search box.
  const [panelOpen, setPanelOpen] = useState(() => (
    !window.matchMedia('(max-width: 920px)').matches || query.has('location') || query.get('focus') === 'search'
  ));
  const searchRef = useRef(null);
  const geo = useCampusGeolocation({ share });
  const [sceneMode, toggleSceneMode] = useSceneMode();

  // Follow ?location= changes made while this page is open (e.g. from the command palette or history).
  const locationParam = query.get('location');
  useEffect(() => {
    setSelectedCode(locationParam);
    if (locationParam) setPanelOpen(true);
  }, [locationParam]);

  useEffect(() => {
    if (query.get('focus') === 'search') searchRef.current?.focus();
    // Only on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "/" jumps to search from anywhere on the page, unless the user is already typing.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable) return;
      event.preventDefault();
      setPanelOpen(true);
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const all = useMemo(() => locations.data ?? [], [locations.data]);
  const zones = useMemo(() => locationsToZones(all), [all]);
  const categories = useMemo(() => [...new Set(all.map((l) => l.category))], [all]);
  const results = useMemo(
    () => all.filter((l) => (!category || l.category === category) && matchesSearch(l, search)),
    [all, category, search],
  );
  const selected = all.find((l) => l.code === selectedCode) ?? null;
  const destination = all.find((l) => l.code === destinationCode) ?? null;

  const select = useCallback((code) => {
    setSelectedCode(code);
    if (code) setPanelOpen(true);
    const params = new URLSearchParams(window.location.search);
    if (code) params.set('location', code); else params.delete('location');
    navigate(`/app/explore${params.toString() ? `?${params}` : ''}`, { replace: true });
  }, [navigate]);

  // Camera commands for the 3D scene. Choosing the already-selected place again re-centres it; "Back to overview"
  // clears the selection AND flies home, whereas plain deselecting leaves the camera where the user put it.
  const [overviewTick, setOverviewTick] = useState(0);
  const [refocusTick, setRefocusTick] = useState(0);
  const selectPlace = useCallback((code) => {
    if (code && code === selectedCode) setRefocusTick((n) => n + 1);
    select(code);
  }, [select, selectedCode]);
  const backToOverview = useCallback(() => {
    select(null);
    setOverviewTick((n) => n + 1);
  }, [select]);
  // On narrow screens the details live inside the bottom sheet; otherwise they float over the scene.
  const compact = useMediaQuery('(max-width: 920px)');

  // Esc clears the selection (unless a dialog such as the command palette is open, or the user is typing).
  useEffect(() => {
    if (!selectedCode || intro.active) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('dialog[open]')) return;
      const tag = event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable) return;
      select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCode, intro.active, select]);

  const startNavigation = (location) => {
    setDestinationCode(location.code);
    pushRecentDestination(user.id, location.code);
    if (!geo.active) geo.start();
  };

  const position = geo.position;
  const myPin = useMemo(
    () => (position ? { [user.id]: { ...position, userId: user.id } } : {}),
    [position, user.id],
  );
  const current = useMemo(() => (position ? { ...position, userId: user.id } : null), [position, user.id]);
  const route = useMemo(
    () => (position && destination ? { from: position, to: destination } : null),
    [position, destination],
  );
  // The 3D scene keeps positions inside the campus plane, so for someone off campus a line there would start at
  // the wrong place. The map and the guidance card use the real position and always show it.
  const sceneRoute = useMemo(() => (route && route.from.insideCampus ? route : null), [route]);

  // Choosing a place from the list as a destination also selects it, so the card and the camera follow.
  const navigateToPlace = (location) => {
    if (location.code !== selectedCode) select(location.code);
    startNavigation(location);
  };

  // Keyboard use of the search box and the result list. Arrow keys move focus (real focus, so the usual focus ring
  // shows): Down from the box enters the list, Up from the first row returns, Right/Left switch between a row's
  // "show it" and "navigate" buttons. Enter in the box picks the first match.
  const listRef = useRef(null);
  const focusRow = (index, navigateButton = false) => {
    const row = listRef.current?.children[index];
    row?.querySelector(navigateButton ? '.result-nav' : '.result-item')?.focus();
  };
  const onSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      focusRow(0);
    } else if (event.key === 'Enter' && search.trim() && results.length) {
      event.preventDefault();
      selectPlace(results[0].code);
    } else if (event.key === 'Escape' && search) {
      event.preventDefault();
      setSearch('');
    }
  };
  const onListKeyDown = (event) => {
    const rows = [...listRef.current.children];
    const index = rows.indexOf(event.target.closest('li'));
    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    const onNavigate = event.target.classList.contains('result-nav');
    const go = (next) => {
      event.preventDefault();
      focusRow(Math.max(0, Math.min(next, rows.length - 1)), onNavigate);
    };
    if (event.key === 'ArrowDown') go(index + 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(rows.length - 1);
    else if (event.key === 'ArrowUp') {
      if (index === 0) {
        event.preventDefault();
        searchRef.current?.focus();
      } else go(index - 1);
    } else if (event.key === 'ArrowRight' && !onNavigate) {
      event.preventDefault();
      focusRow(index, true);
    } else if (event.key === 'ArrowLeft' && onNavigate) {
      event.preventDefault();
      focusRow(index);
    }
  };

  const placeInfo = selected && (
    <PlaceInfoPanel
      place={selected}
      position={position}
      navigating={destinationCode === selected.code}
      view={view}
      onDeselect={() => select(null)}
      onOverview={backToOverview}
      onNavigate={() => startNavigation(selected)}
      onToggleView={() => setView(view === '3d' ? 'map' : '3d')}
    />
  );

  return (
    <div className={`explorer ${panelOpen ? 'panel-open' : 'panel-closed'} ${intro.active ? 'intro-active' : ''}`}>
      <h1 className="sr-only">Campus explorer</h1>
      <section className="explorer-viewer card" aria-label="Campus view">
        <div className="viewer-toolbar" inert={intro.active}>
          <div className="segmented-control" role="tablist" aria-label="View">
            <button type="button" role="tab" aria-selected={view === '3d'} className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>
              <Icon name="cube" size={16} /> 3D campus
            </button>
            <button type="button" role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>
              <Icon name="pin" size={16} /> Map
            </button>
          </div>
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
          <button
            type="button"
            className="icon-button panel-toggle"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            aria-controls="explorer-panel"
            aria-label={panelOpen ? 'Hide side panel' : 'Show side panel'}
            title={panelOpen ? 'Hide panel' : 'Show panel'}
          >
            <Icon name="panel" size={18} />
          </button>
        </div>
        <div className="viewer-stage">
          <div className={`viewer-layer ${view === '3d' ? 'visible' : ''}`}>
            <CampusScene
              locations={myPin}
              currentPosition={current}
              campusModelUrl={DEFAULT_CAMPUS_MODEL_URL}
              onModelStatus={setModelStatus}
              zones={zones}
              selectedZoneId={selectedCode}
              onSelectZone={selectPlace}
              route={sceneRoute}
              mode={sceneMode}
              intro={intro.sceneIntro}
              onReady={handleSceneReady}
              onIntroEnd={intro.onSceneIntroEnd}
              showControls={!intro.active}
              overviewSignal={overviewTick}
              refocusSignal={refocusTick}
              label="Interactive 3D campus. Drag to rotate, scroll to zoom, hover a building to highlight it and click to select it."
            />
            {webgl && <p className="viewer-hint"><Icon name="compass" size={14} /> Drag to rotate · scroll or pinch to zoom · click a building to select</p>}
          </div>
          <div className={`viewer-layer ${view === 'map' ? 'visible' : ''}`}>
            <CampusMap
              locations={myPin}
              currentPosition={current}
              places={all}
              selectedPlaceId={selected?.id}
              onSelectPlace={(place) => select(place.code)}
              route={route}
              userLabel={() => 'You'}
              followCurrent={!selected}
              mode={sceneMode}
            />
          </div>
          {intro.active && (
            <CinematicIntro
              phase={intro.phase}
              steps={intro.steps}
              percent={intro.percent}
              slow={intro.slow}
              onSkip={endIntro(intro.skip)}
              onEnter={endIntro(intro.enter)}
            />
          )}
        </div>
      </section>

      {!compact && selected && placeInfo}

      <aside className="explorer-panel" id="explorer-panel" aria-label="Campus guide" inert={intro.active}>
        <button type="button" className="panel-handle" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen} aria-controls="explorer-panel">
          {panelOpen ? 'Hide guide' : (destination ? `Navigating to ${destination.name}` : selected ? selected.name : 'Find a place & your location')}
        </button>

        {destination && <NavigationCard destination={destination} position={position} geo={geo} onEnd={() => setDestinationCode(null)} />}

        {compact && selected && placeInfo}

        <section className="card search-card" aria-labelledby="search-title">
          <h2 id="search-title" className="card-title">Find a place</h2>
          <div className="search-input">
            <Icon name="search" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search buildings, labs, library…"
              aria-label="Search campus locations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            <kbd aria-hidden="true">/</kbd>
          </div>
          {categories.length > 1 && (
            <div className="chip-row" role="group" aria-label="Filter by category">
              <button type="button" className={`chip ${!category ? 'active' : ''}`} aria-pressed={!category} onClick={() => setCategory('')}>All</button>
              {categories.map((c) => (
                <button key={c} type="button" className={`chip ${category === c ? 'active' : ''}`} aria-pressed={category === c} onClick={() => setCategory(category === c ? '' : c)}>
                  <span className="swatch" style={{ background: categoryColor(c) }} />{categoryLabel(c)}
                </button>
              ))}
            </div>
          )}

          {locations.data && all.length > 0 && (
            <p className="search-meta" aria-live="polite">
              <span>{results.length} of {all.length} location{all.length === 1 ? '' : 's'}</span>
              {position && <span>Distance from you</span>}
            </p>
          )}

          {locations.loading && !locations.data && <Skeleton label="Loading campus locations" lines={5} />}
          {locations.error && !locations.data && <ErrorState title="Could not load campus locations" message={locations.error.message} onRetry={locations.reload} />}
          {locations.data && all.length === 0 && (
            <EmptyState icon="building" title="No campus locations yet">Campus administration has not added any locations.</EmptyState>
          )}
          {locations.data && all.length > 0 && results.length === 0 && (
            <EmptyState icon="search" title="No matches">Try a different name, code or category.</EmptyState>
          )}
          {results.length > 0 && (
            <ul className="result-list" ref={listRef} onKeyDown={onListKeyDown}>
              {results.map((location) => (
                <li key={location.id} className="result-row">
                  <button type="button" className={`result-item ${location.code === selectedCode ? 'active' : ''}`} onClick={() => selectPlace(location.code)} aria-current={location.code === selectedCode ? 'true' : undefined}>
                    <span className="swatch" style={{ background: categoryColor(location.category) }} />
                    <span className="result-text">
                      <strong>{location.name}</strong>
                      <small>{categoryLabel(location.category)} · {location.code}</small>
                    </span>
                    {position && <span className="result-distance">{formatDistance(distanceMeters(position, location))}</span>}
                  </button>
                  <button
                    type="button"
                    className="icon-button result-nav"
                    onClick={() => navigateToPlace(location)}
                    disabled={destinationCode === location.code}
                    aria-label={destinationCode === location.code ? `Navigating to ${location.name}` : `Navigate to ${location.name}`}
                    title={destinationCode === location.code ? 'Navigating here' : 'Navigate here'}
                  >
                    <Icon name={destinationCode === location.code ? 'check' : 'navigation'} size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <GpsStatusPanel geo={geo} share={share} onShareChange={setShare} />
      </aside>
    </div>
  );
}
