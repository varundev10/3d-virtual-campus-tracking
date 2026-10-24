import { CAMPUS_BUILDINGS } from './campus-buildings.js';

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

// The footprint and height of the generated placeholder building for the index-th location. Shared by the 3D scene
// and the 2D site plan so the two always show the same campus.
export function buildingSize(index) {
  return {
    height: 9 + (index % 3) * 3,
    width: 16 + (index % 2) * 4,
    depth: 13 + (index % 3) * 3,
  };
}

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

// It is centred on the middle of the real places rather than on UCER_CENTER, so the default view frames all of them
// (the buildings sit off to one side of the campus centre) and stays framed as places are added.
const meanOf = (key) => CAMPUS_BUILDINGS.reduce((sum, building) => sum + building[key], 0) / CAMPUS_BUILDINGS.length;
const PLACEHOLDER_ORIGIN = CAMPUS_BUILDINGS.length
  ? locationToScenePoint(meanOf('latitude'), meanOf('longitude'))
  : { x: 0, z: 0 };

export function locationToPlaceholderPoint(latitude, longitude) {
  const { x, z } = locationToScenePoint(latitude, longitude);
  return {
    x: Math.max(-70, Math.min(70, (x - PLACEHOLDER_ORIGIN.x) * PLACEHOLDER_SCALE)),
    y: 0,
    z: Math.max(-48, Math.min(48, (z - PLACEHOLDER_ORIGIN.z) * PLACEHOLDER_SCALE)),
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
