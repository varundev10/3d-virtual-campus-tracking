import Icon from './Icon.jsx';
import { useTheme } from '../../lib/theme.js';

// Switches between the burgundy and the ivory world. The icon shows where the button will take you.
export default function ThemeToggle({ className = '' }) {
  const [theme, toggle] = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
