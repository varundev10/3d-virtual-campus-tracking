import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, roleHomePath } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ role, children }) {
  const { user, isAuthenticated, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user?.role !== role) {
    return <Navigate to={roleHomePath(user?.role)} replace />;
  }

  return children;
}
