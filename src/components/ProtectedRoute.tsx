import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { APP_ROUTES } from '../utils/constants';
import { hasRole } from '../utils/permissions';
import AdminMfaGate from './AdminMfaGate';
import { isDevAuthBypassEnabled } from '../utils/devAuth';
import type { AppRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    // Rediriger vers la page de connexion si l'utilisateur n'est pas connecté
    return <Navigate to={APP_ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  if (requiredRole && !hasRole(user, requiredRole)) {
    return <Navigate to={APP_ROUTES.SETTINGS} replace />;
  }

  if (user.role === 'admin' && !isDevAuthBypassEnabled) {
    return <AdminMfaGate>{children}</AdminMfaGate>;
  }

  return <>{children}</>;
}
