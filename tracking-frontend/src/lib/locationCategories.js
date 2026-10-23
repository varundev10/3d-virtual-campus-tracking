import { locationToScenePoint } from './campus.js';

// Mirrors CampusLocation.Category on the backend. Colors follow a fixed categorical order;
// the category name is always shown as text too, so identity never relies on color alone.
// Mid-tone steps chosen to hold at least 3:1 on the jet and soft-paper surfaces (cards, page and the 3D ground), and
// none sits near pink or chartreuse, which are reserved for people and live state (pink) and for selection (chartreuse).
export const LOCATION_CATEGORIES = [
  { value: 'ACADEMIC_BLOCK', label: 'Academic block', color: '#357df3' },
  { value: 'CLASSROOM', label: 'Classroom', color: '#c8611c' },
  { value: 'LAB', label: 'Lab', color: '#0a927b' },
  { value: 'LIBRARY', label: 'Library', color: '#6a5ce6' },
  { value: 'DEPARTMENT', label: 'Department', color: '#1680a2' },
  { value: 'ADMINISTRATION', label: 'Administration', color: '#78828f' },
  { value: 'HOSTEL', label: 'Hostel', color: '#a67a1a' },
  { value: 'FACILITY', label: 'Facility', color: '#d03a2c' },
];

const byValue = Object.fromEntries(LOCATION_CATEGORIES.map((c) => [c.value, c]));

export function categoryLabel(value) {
  return byValue[value]?.label ?? value;
}

export function categoryColor(value) {
  return byValue[value]?.color ?? '#808080';
}

// Converts API campus locations into the zone shape CampusScene renders.
export function locationsToZones(locations) {
  return locations.map((location) => {
    const point = locationToScenePoint(location.latitude, location.longitude);
    return {
      id: location.code,
      name: location.name,
      x: point.x,
      z: point.z,
      color: categoryColor(location.category),
    };
  });
}

export function matchesSearch(location, text) {
  if (!text) return true;
  const needle = text.trim().toLowerCase();
  return [location.name, location.code, location.description, categoryLabel(location.category)]
    .some((field) => field?.toLowerCase().includes(needle));
}
