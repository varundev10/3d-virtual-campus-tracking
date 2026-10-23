// The campus's real places, positioned from OpenStreetMap: © OpenStreetMap contributors, ODbL
// (https://www.openstreetmap.org/copyright). Read on 2026-10-23; the OSM ways were last edited on 2026-08-06.
//
// PROVISIONAL. OpenStreetMap only names five UCER places, so this is not the full layout: the A-D blocks and the other
// facilities are still to come. To extend it, add entries here AND mirror them in
// tracking-backend/.../config/DataInitializer.java (the explorer list comes from the database, and clicking a building
// has to select the matching list item), then remove CAMPUS_BUILDINGS_PROVISIONAL once there are at least 10 entries.
// scripts/check-ui.mjs enforces all three.
//
// latitude / longitude are the centre of the OSM outline. Those outlines are landuse=education parcels, not building
// walls, so they give a reliable position but not a footprint; the 3D scene and the site plan draw stylised buildings
// there. `category` is inferred from the name (OSM does not tag it). Plain data with no imports, so the UI check can
// load it in Node.
export const CAMPUS_BUILDINGS_PROVISIONAL = true;

export const CAMPUS_BUILDINGS = [
  { code: 'MAIN', name: 'Main Building', category: 'ADMINISTRATION', latitude: 25.343626, longitude: 81.910828, osm: 'way/1546778035' },
  { code: 'B-BLOCK', name: 'Block B', category: 'ACADEMIC_BLOCK', latitude: 25.343893, longitude: 81.91133, osm: 'way/1546778036' },
  { code: 'PHARMACY', name: 'Pharmacy', category: 'DEPARTMENT', latitude: 25.344132, longitude: 81.911873, osm: 'way/1546778037' },
  { code: 'LIB', name: 'Central Library', category: 'LIBRARY', latitude: 25.344102, longitude: 81.910451, osm: 'way/1546778038' },
  { code: 'HOSTEL', name: 'Hostel (Boys + Girls)', category: 'HOSTEL', latitude: 25.343345, longitude: 81.91004, osm: 'way/1546778039' },
];
