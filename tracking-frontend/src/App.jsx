import { useEffect } from 'react';
import { RouterProvider, Redirect, Link, useRouter } from './lib/router.jsx';
import { AuthProvider, homePathFor, isAdmin, isFaculty, useAuth } from './lib/auth.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { ErrorState, Spinner } from './components/ui/States.jsx';
import Fx from './components/fx/Fx.jsx';
import Icon from './components/ui/Icon.jsx';
import { useDocumentTitle } from './lib/useDocumentTitle.js';
import { useAmbientGlow } from './lib/useAmbientGlow.js';
import { preloadCampusScene } from './components/LazyCampusScene.jsx';
import { LoginPage, RegisterPage } from './pages/auth/AuthPages.jsx';
import UserLayout from './layouts/UserLayout.jsx';
import UserDashboard from './pages/user/UserDashboard.jsx';
import CampusExplorer from './pages/user/CampusExplorer.jsx';
import ProfilePage from './pages/user/ProfilePage.jsx';
import AttendancePage from './pages/user/AttendancePage.jsx';
import TeachingConsole from './pages/faculty/TeachingConsole.jsx';
import DepartmentPage from './pages/faculty/DepartmentPage.jsx';
import AdminAcademics from './pages/admin/AdminAcademics.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminLocations from './pages/admin/AdminLocations.jsx';
import AdminTracking from './pages/admin/AdminTracking.jsx';
import AdminReports from './pages/admin/AdminReports.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

const USER_ROUTES = {
  '/app': UserDashboard,
  '/app/explore': CampusExplorer,
  '/app/attendance': AttendancePage,
  '/app/profile': ProfilePage,
};

// Faculty tools. The server enforces the role on every call; this only decides which pages exist for whom.
const FACULTY_ROUTES = {
  '/app/teaching': TeachingConsole,
  '/app/department': DepartmentPage,
};

const ADMIN_ROUTES = {
  '/admin': AdminOverview,
  '/admin/users': AdminUsers,
  '/admin/academics': AdminAcademics,
  '/admin/locations': AdminLocations,
  '/admin/tracking': AdminTracking,
  '/admin/reports': AdminReports,
  '/admin/settings': AdminSettings,
};

function CenteredPage({ children }) {
  return <div className="centered-page">{children}</div>;
}

function NotFound() {
  const { user } = useAuth();
  useDocumentTitle('Page not found');
  return (
    <CenteredPage>
      <div className="not-found">
        <p className="not-found-code" data-text="404" aria-hidden="true">404</p>
        <h1>Page not found</h1>
        <p className="muted">You have walked off the map: nothing is built at this address.</p>
        <Link to={user ? homePathFor(user) : '/login'} className="btn btn-pop">Go to {user ? 'your dashboard' : 'sign in'}</Link>
      </div>
    </CenteredPage>
  );
}

// Shown when a signed-in non-admin opens an admin URL. The server rejects admin API calls
// regardless; this page only explains why nothing loads.
function AccessDenied() {
  useDocumentTitle('Admin access required');
  return (
    <CenteredPage>
      <div className="card status-page">
        <span className="empty-icon"><Icon name="shield" size={22} /></span>
        <h1>Admin access required</h1>
        <p className="muted">Your account does not have administrator permissions. If you think this is wrong, contact campus administration.</p>
        <Link to="/app" className="btn btn-primary">Back to campus explorer</Link>
      </div>
    </CenteredPage>
  );
}

function Routes() {
  const { path } = useRouter();
  const auth = useAuth();
  const cleanPath = path.length > 1 ? path.replace(/\/+$/, '') : path;

  if (auth.status === 'loading') {
    return <CenteredPage><Spinner label="Checking your session" /></CenteredPage>;
  }
  if (auth.status === 'error') {
    return (
      <CenteredPage>
        <ErrorState title="Cannot verify your session" message={auth.notice} onRetry={auth.retry} />
      </CenteredPage>
    );
  }

  const user = auth.user;

  if (cleanPath === '/') return <Redirect to={user ? homePathFor(user) : '/login'} />;

  if (cleanPath === '/login' || cleanPath === '/register') {
    if (user) return <Redirect to={homePathFor(user)} />;
    return cleanPath === '/login' ? <LoginPage /> : <RegisterPage />;
  }

  const isUserArea = cleanPath === '/app' || cleanPath.startsWith('/app/');
  const isAdminArea = cleanPath === '/admin' || cleanPath.startsWith('/admin/');

  if ((isUserArea || isAdminArea) && !user) {
    return <Redirect to={`/login?next=${encodeURIComponent(cleanPath + window.location.search)}`} />;
  }

  if (isAdminArea) {
    if (!isAdmin(user)) return <AccessDenied />;
    const Page = ADMIN_ROUTES[cleanPath];
    return Page ? <Page /> : <NotFound />;
  }

  if (isUserArea) {
    // Administrators have their own console with the same 3D scene and full tracking data.
    if (isAdmin(user)) return <Redirect to="/admin" />;
    const Page = USER_ROUTES[cleanPath] ?? (isFaculty(user) ? FACULTY_ROUTES[cleanPath] : undefined);
    return Page ? <UserLayout><Page /></UserLayout> : <NotFound />;
  }

  return <NotFound />;
}

export default function App() {
  useAmbientGlow();
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((callback) => window.setTimeout(callback, 1500));
    idle(preloadCampusScene);
  }, []);
  return (
    <ToastProvider>
      <RouterProvider>
        <AuthProvider>
          <Routes />
          <Fx />
        </AuthProvider>
      </RouterProvider>
    </ToastProvider>
  );
}
