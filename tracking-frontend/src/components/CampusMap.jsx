import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CAMPUS_GEOFENCE, UCER_CENTER } from '../lib/campus.js';
import { categoryColor } from '../lib/locationCategories.js';

// Mirror --gold and --burgundy in styles/tokens.css: the selection, route and boundary colours.
const GOLD = '#d7b477';
const BURGUNDY = '#210c13';

const markerIcon = L.divIcon({
  className: 'campus-marker',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export default function CampusMap({
  locations = {},
  currentPosition,
  places = [],
  selectedPlaceId = null,
  onSelectPlace,
  route = null,
  userLabel,
  onMapClick,
  pickedPoint = null,
  followCurrent = true,
  label = 'OpenStreetMap campus geofence',
  mode = 'night',
}) {
  const mapRef = useRef(null);
  const mountRef = useRef(null);
  const markersRef = useRef(new Map());
  const placesLayerRef = useRef(null);
  const routeRef = useRef(null);
  const pickedRef = useRef(null);
  const onSelectRef = useRef(onSelectPlace);
  const onMapClickRef = useRef(onMapClick);
  onSelectRef.current = onSelectPlace;
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(mountRef.current, {
      center: [UCER_CENTER.lat, UCER_CENTER.lng],
      zoom: 17,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.polygon(CAMPUS_GEOFENCE, {
      color: GOLD,
      weight: 2,
      dashArray: '6 6',
      fillColor: GOLD,
      fillOpacity: 0.05,
      interactive: false,
    }).addTo(map);

    placesLayerRef.current = L.layerGroup().addTo(map);
    map.on('click', (event) => onMapClickRef.current?.(event.latlng));

    // Leaflet must be told when its container is resized (tabs, responsive layouts).
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(mountRef.current);

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const layer = placesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    places.forEach((place) => {
      const selected = place.id === selectedPlaceId;
      const marker = L.circleMarker([place.latitude, place.longitude], {
        radius: selected ? 10 : 7,
        color: selected ? BURGUNDY : '#faf3eb',
        weight: selected ? 3 : 2,
        fillColor: selected ? GOLD : categoryColor(place.category),
        fillOpacity: 1,
      });
      marker.bindTooltip(escapeHtml(place.name), { direction: 'top', permanent: selected });
      marker.on('click', () => onSelectRef.current?.(place));
      marker.addTo(layer);
    });
    const selected = places.find((p) => p.id === selectedPlaceId);
    if (selected && mapRef.current) {
      mapRef.current.panTo([selected.latitude, selected.longitude], { animate: true });
    }
  }, [places, selectedPlaceId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeRef.current?.remove();
    routeRef.current = null;
    if (route?.from && route?.to) {
      routeRef.current = L.polyline(
        [[route.from.latitude, route.from.longitude], [route.to.latitude, route.to.longitude]],
        { color: mode === 'day' ? BURGUNDY : GOLD, weight: 3, dashArray: '8 6', interactive: false },
      ).addTo(map);
    }
  }, [route, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickedRef.current?.remove();
    pickedRef.current = null;
    if (pickedPoint && Number.isFinite(pickedPoint.latitude) && Number.isFinite(pickedPoint.longitude)) {
      pickedRef.current = L.circleMarker([pickedPoint.latitude, pickedPoint.longitude], {
        radius: 9, color: BURGUNDY, weight: 3, fillColor: GOLD, fillOpacity: 1,
      }).addTo(map);
    }
  }, [pickedPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set(Object.keys(locations));

    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    Object.entries(locations).forEach(([id, ping]) => {
      if (ping.latitude == null || ping.longitude == null) return;
      const latLng = [ping.latitude, ping.longitude];
      const tooltip = escapeHtml(userLabel?.(id) ?? `User ${id}`);
      let marker = markersRef.current.get(id);

      if (!marker) {
        marker = L.marker(latLng, { icon: markerIcon }).addTo(map);
        marker.bindTooltip(tooltip, { direction: 'top' });
        markersRef.current.set(id, marker);
      } else {
        marker.setLatLng(latLng);
        marker.setTooltipContent(tooltip);
      }
    });

    if (followCurrent && currentPosition?.latitude && currentPosition?.longitude) {
      map.panTo([currentPosition.latitude, currentPosition.longitude], {
        animate: true,
        duration: 0.35,
      });
    }
  }, [currentPosition, locations, userLabel, followCurrent]);

  return <div ref={mountRef} className={`campus-map ${mode === 'day' ? 'is-day' : ''}`} role="region" aria-label={label} />;
}
