import { locationToScenePoint } from './campus.js';

// Mirrors CampusLocation.Category on the backend. Colors follow a fixed categorical order;
// the category name is always shown as text too, so identity never relies on color alone.
// Steps are the dark-surface variants of each hue (validated >= 3:1 on the midnight UI).
export const LOCATION_CATEGORIES = [
  { value: 'ACADEMIC_BLOCK', label: 'Academic block', color: '#3987e5' },
  { value: 'CLASSROOM', label: 'Classroom', color: '#d95926' },
  { value: 'LAB', label: 'Lab', color: '#199e70' },
  { value: 'LIBRARY', label: 'Library', color: '#c98500' },
  { value: 'DEPARTMENT', label: 'Department', color: '#d55181' },
  { value: 'ADMINISTRATION', label: 'Administration', color: '#008300' },
  { value: 'HOSTEL', label: 'Hostel', color: '#9085e9' },
  { value: 'FACILITY', label: 'Facility', color: '#e66767' },
];

const byValue = Object.fromEntries(LOCATION_CATEGORIES.map((c) => [c.value, c]));

export function categoryLabel(value) {
  return byValue[value]?.label ?? value;
}

export function categoryColor(value) {
  return byValue[value]?.color ?? '#8090ab';
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
