import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../components/ui/Icon.jsx';
import CommandPalette from '../components/CommandPalette.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import { Link, useRouter } from '../lib/router.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: 'home', exact: true },
  { to: '/app/explore', label: 'Campus explorer', icon: 'cube' },
  { to: '/app/profile', label: 'Profile', icon: 'user' },
];

// Routes that render edge to edge under the header (the 3D explorer).
const IMMERSIVE = ['/app/explore'];

function ProfileMenu({ user, onLogout }) {
  const { path } = useRouter();
  // The menu counts as open only on the route it was opened from, so navigating closes it. The stale
  // value is cleared during render (React's supported "reset state when a prop changes" pattern) so
  // coming back to that route later does not reopen it.
  const [openAt, setOpenAt] = useState(null);
  if (openAt !== null && openAt !== path) setOpenAt(null);
  const open = openAt === path;
  const setOpen = useCallback((next) => setOpenAt(next ? path : null), [path]);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector('.user-menu-trigger')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="user-menu-pop"
        onClick={() => setOpen(!open)}
      >
        <span className="avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
        <span className="user-menu-name">{user.name}</span>
        <Icon name="chevronDown" size={16} />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div className="user-menu-pop" id="user-menu-pop">
          <div className="user-menu-id">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <Link to="/app/profile" className="user-menu-item"><Icon name="user" size={16} /> My profile</Link>
          <button type="button" className="user-menu-item danger" onClick={onLogout}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function UserLayout({ children }) {
  const { path } = useRouter();
  const { user, logout } = useAuth();
  const immersive = IMMERSIVE.includes(path.replace(/\/+$/, ''));
  useDocumentTitle(NAV.find((item) => (item.exact ? path === item.to : path.startsWith(item.to)))?.label);

  return (
    <div className={`user-shell ${immersive ? 'immersive' : ''}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="user-header">
        <Link to="/app" className="brand-lockup compact">
          <span className="brand-mark">UC</span>
          <span className="brand-text">
            <strong>UCER Smart Campus</strong>
            <small>Campus explorer</small>
          </span>
        </Link>
        <nav className="user-nav" aria-label="Main">
          {NAV.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} className={`user-nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="header-tools">
          <CommandPalette pages={NAV} />
          <ThemeToggle />
          <ProfileMenu user={user} onLogout={logout} />
        </div>
      </header>
      <main id="main" className="user-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
