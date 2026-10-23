export const UCER_CENTER = {
  lat: 25.3438271534,
  lng: 81.9106717343,
};
export const CAMPUS_ELEVATION = 283.8353;
export const CAMPUS_FLOOR_HEIGHT_METERS = 3.5;

export const CAMPUS_GEOFENCE = [
  [25.3448576127, 81.9109565113],
  [25.3450834437, 81.9105708885],
  [25.3450912309, 81.9103138066],
  [25.3449899964, 81.9101338493],
  [25.3448809745, 81.9101766963],
  [25.3448498254, 81.9099453226],
  [25.3447485909, 81.9098167817],
  [25.3447174418, 81.9096282550],
  [25.3445928454, 81.9095168529],
  [25.3444604617, 81.9094740059],
  [25.3443911816, 81.9094304411],
  [25.3441143713, 81.9094250754],
  [25.3440565196, 81.9094144650],
  [25.3441432972, 81.9090908494],
  [25.3437817240, 81.9090377977],
  [25.3435069283, 81.9090324925],
  [25.3432707005, 81.9091492063],
  [25.3429573371, 81.9092977512],
  [25.3426584366, 81.9095258737],
  [25.3424366717, 81.9096797238],
  [25.3423016843, 81.9098123531],
  [25.3422679375, 81.9098229635],
  [25.3428657385, 81.9109052191],
  [25.3436033479, 81.9121519351],
  [25.3438369661, 81.9124604333],
  [25.3441406698, 81.9128203479],
  [25.3442964152, 81.9128289173],
  [25.3443587134, 81.9126575294],
  [25.3444599480, 81.9125289885],
  [25.3446312680, 81.9124775721],
  [25.3446546298, 81.9122719066],
  [25.3446546298, 81.9120919493],
  [25.3446546298, 81.9119719778],
  [25.3447169280, 81.9117148960],
  [25.3447636517, 81.9114920917],
  [25.3448103753, 81.9113892589],
  [25.3448570990, 81.9111835935],
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
    x,
    y: 0,
    z,
  };
}

// The placeholder campus is a compact stand-in, about 0.45x real size, whose ground is only ~140 x 100 units.
// Points are pulled in and kept on that ground; the streamed Metashape tiles use locationToScenePoint (true metres).
export const PLACEHOLDER_SCALE = 0.45;

export function locationToPlaceholderPoint(latitude, longitude) {
  const { x, z } = locationToScenePoint(latitude, longitude);
  return {
    x: Math.max(-70, Math.min(70, x * PLACEHOLDER_SCALE)),
    y: 0,
    z: Math.max(-48, Math.min(48, z * PLACEHOLDER_SCALE)),
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
