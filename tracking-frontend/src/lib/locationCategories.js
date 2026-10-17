import { locationToScenePoint } from './campus.js';

// Mirrors CampusLocation.Category on the backend. Colors follow a fixed categorical order;
// the category name is always shown as text too, so identity never relies on color alone.
// Mid-tone steps chosen to hold at least 3:1 on both the burgundy and the ivory surfaces, and none sits near gold,
// which is reserved for selection and live state.
export const LOCATION_CATEGORIES = [
  { value: 'ACADEMIC_BLOCK', label: 'Academic block', color: '#4f86d4' },
  { value: 'CLASSROOM', label: 'Classroom', color: '#d46a28' },
  { value: 'LAB', label: 'Lab', color: '#238f78' },
  { value: 'LIBRARY', label: 'Library', color: '#9a6fe0' },
  { value: 'DEPARTMENT', label: 'Department', color: '#d9548a' },
  { value: 'ADMINISTRATION', label: 'Administration', color: '#7c8ca3' },
  { value: 'HOSTEL', label: 'Hostel', color: '#7d8c26' },
  { value: 'FACILITY', label: 'Facility', color: '#c4473f' },
];

const byValue = Object.fromEntries(LOCATION_CATEGORIES.map((c) => [c.value, c]));

export function categoryLabel(value) {
  return byValue[value]?.label ?? value;
}

export function categoryColor(value) {
  return byValue[value]?.color ?? '#8a7378';
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
