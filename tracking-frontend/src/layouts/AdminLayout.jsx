import { useState } from 'react';
import Icon from '../components/ui/Icon.jsx';
import CommandPalette from '../components/CommandPalette.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import { Link, useRouter } from '../lib/router.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: 'home', exact: true },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/locations', label: 'Campus Locations', icon: 'building' },
  { to: '/admin/tracking', label: 'Tracking / Activity', icon: 'activity' },
  { to: '/admin/reports', label: 'Reports', icon: 'chart' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
];

const COLLAPSE_KEY = 'ucer.admin.sidebarCollapsed';

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function AdminLayout({ title, actions, children }) {
  const { path } = useRouter();
  const { user, logout } = useAuth();
  useDocumentTitle(title);
  // The mobile drawer counts as open only on the route it was opened from, so navigating closes it.
  const [menuOpenAt, setMenuOpenAt] = useState(null);
  if (menuOpenAt !== null && menuOpenAt !== path) setMenuOpenAt(null);
  const menuOpen = menuOpenAt === path;
  const setMenuOpen = (next) => setMenuOpenAt(next ? path : null);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1');
      } catch {
        // Storage can be unavailable (private mode); the toggle still works for this visit.
      }
      return !value;
    });
  };

  return (
    <div className={`admin-shell ${menuOpen ? 'menu-open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="admin-sidebar contours" id="admin-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">UC</span>
          <div>
            <strong className="brand-name">UCER Smart Campus</strong>
            <p>Control center</p>
          </div>
        </div>
        <div>
          <p className="admin-nav-label">Console</p>
          <nav className="admin-nav" aria-label="Admin">
            {ADMIN_NAV.map((item) => {
              const active = item.exact ? path === item.to : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`admin-nav-link ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon name={item.icon} />
                  <span className="nav-text">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="admin-sidebar-foot">
          <button
            type="button"
            className="admin-nav-link admin-collapse"
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar' : undefined}
          >
            <Icon name="sidebar" /> <span className="nav-text">Collapse sidebar</span>
          </button>
          <div className="admin-identity" title={collapsed ? `${user.name} · ${user.email}` : undefined}>
            <span className="avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button type="button" className="admin-nav-link logout" onClick={logout} title={collapsed ? 'Logout' : undefined}>
            <Icon name="logout" /> <span className="nav-text">Logout</span>
          </button>
        </div>
      </aside>
      {menuOpen && <button type="button" className="admin-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <div className="admin-main-wrap">
        <header className="admin-topbar">
          <button
            type="button"
            className="icon-button admin-menu-toggle"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="admin-sidebar"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="menu" />
          </button>
          <div className="admin-title-wrap">
            <span className="admin-crumb" aria-hidden="true">Admin console</span>
            <h1 className="admin-title">{title}</h1>
          </div>
          <div className="admin-actions">
            <CommandPalette pages={ADMIN_NAV} />
            <ThemeToggle />
            {actions}
          </div>
        </header>
        <main id="main" className="admin-main" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
