import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CAMPUS_GEOFENCE, UCER_CENTER } from '../lib/campus.js';

const markerIcon = L.divIcon({
  className: 'campus-marker',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function CampusMap({ locations, currentPosition }) {
  const mapRef = useRef(null);
  const mountRef = useRef(null);
  const markersRef = useRef(new Map());

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
      color: '#e94f37',
      weight: 2,
      fillColor: '#e94f37',
      fillOpacity: 0.08,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

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
      let marker = markersRef.current.get(id);

      if (!marker) {
        marker = L.marker(latLng, { icon: markerIcon }).addTo(map);
        marker.bindTooltip(`User ${id}`, { direction: 'top' });
        markersRef.current.set(id, marker);
      } else {
        marker.setLatLng(latLng);
      }
    });

    if (currentPosition?.latitude && currentPosition?.longitude) {
      map.panTo([currentPosition.latitude, currentPosition.longitude], {
        animate: true,
        duration: 0.35,
      });
    }
  }, [currentPosition, locations]);

  return <div ref={mountRef} className="campus-map" aria-label="OpenStreetMap campus geofence" />;
}
