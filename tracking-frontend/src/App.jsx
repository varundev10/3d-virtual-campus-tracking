import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import TeacherDashboard from './pages/teacher/TeacherDashboard.jsx';
import HODDashboard from './pages/hod/HODDashboard.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth, roleHomePath } from './context/AuthContext.jsx';

function HomeRedirect() {
  const { isAuthenticated, user } = useAuth();
  return <Navigate to={isAuthenticated ? roleHomePath(user?.role) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/student/*"
        element={(
          <ProtectedRoute role="STUDENT">
            <StudentDashboard />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/teacher/*"
        element={(
          <ProtectedRoute role="TEACHER">
            <TeacherDashboard />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/hod/*"
        element={(
          <ProtectedRoute role="HOD">
            <HODDashboard />
          </ProtectedRoute>
        )}
      />

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
