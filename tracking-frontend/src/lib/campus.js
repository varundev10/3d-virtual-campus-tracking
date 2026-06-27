export const UCER_CENTER = {
  lat: 25.4305,
  lng: 81.7704,
};

export const CAMPUS_GEOFENCE = [
  [25.43145, 81.76895],
  [25.43205, 81.7708],
  [25.43095, 81.77225],
  [25.42945, 81.77185],
  [25.42895, 81.76985],
  [25.43005, 81.7687],
];

export const CAMPUS_ZONES = [
  { id: 'A-BLOCK', name: 'Academic Block A', x: -34, z: -18, color: '#3f7cac' },
  { id: 'B-BLOCK', name: 'Academic Block B', x: 16, z: -24, color: '#5b8e7d' },
  { id: 'LABS', name: 'Labs Complex', x: -2, z: 18, color: '#c76f4a' },
  { id: 'LIB', name: 'Library', x: 42, z: 12, color: '#7d6fb2' },
  { id: 'ADMIN', name: 'Admin Office', x: -44, z: 26, color: '#b68b3f' },
];

export function locationToScenePoint(latitude, longitude) {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = 111_320 * Math.cos((UCER_CENTER.lat * Math.PI) / 180);
  const x = (longitude - UCER_CENTER.lng) * metersPerDegreeLng;
  const z = -(latitude - UCER_CENTER.lat) * metersPerDegreeLat;
  return {
    x: Math.max(-70, Math.min(70, x * 0.45)),
    z: Math.max(-48, Math.min(48, z * 0.45)),
  };
}

export function isLikelyInsideCampus(latitude, longitude) {
  let inside = false;
  let j = CAMPUS_GEOFENCE.length - 1;

  for (let i = 0; i < CAMPUS_GEOFENCE.length; i += 1) {
    const [yi, xi] = CAMPUS_GEOFENCE[i];
    const [yj, xj] = CAMPUS_GEOFENCE[j];
    const intersects = yi > latitude !== yj > latitude
      && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
    j = i;
  }

  return inside;
}
