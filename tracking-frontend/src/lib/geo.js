const EARTH_RADIUS_M = 6_371_000;
const WALKING_SPEED_MPS = 1.3;
const toRad = (deg) => (deg * Math.PI) / 180;

export function distanceMeters(a, b) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function bearingDegrees(a, b) {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x = Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude))
    - Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

export function compassDirection(bearing) {
  return COMPASS[Math.round(bearing / 45) % 8];
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function walkingMinutes(meters) {
  return Math.max(1, Math.round(meters / WALKING_SPEED_MPS / 60));
}

export function formatCoordinate(value) {
  return Number(value).toFixed(5);
}

// Real walking route via OpenStreetMap's public router; only opened when the user clicks.
export function osmWalkingRouteUrl(from, to) {
  const dest = `${to.latitude},${to.longitude}`;
  if (!from) return `https://www.openstreetmap.org/?mlat=${to.latitude}&mlon=${to.longitude}#map=18/${dest.replace(',', '/')}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${from.latitude},${from.longitude};${dest}`;
}
