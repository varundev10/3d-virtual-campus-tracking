import { useTheme } from './theme.js';

// The 3D scene and the map follow the site theme: the dark world is the night stage, the light world the day model.
// Switching only restyles the existing scene; it never remounts it, so camera and selection survive. This keeps the
// 'day' / 'night' vocabulary the scene code uses, on top of the one shared theme (see lib/theme.js).
// [mode, toggle]. toggle() accepts the click event so the theme reveal grows from the button.
export function useSceneMode() {
  const [theme, toggle] = useTheme();
  return [theme === 'light' ? 'day' : 'night', toggle];
}
