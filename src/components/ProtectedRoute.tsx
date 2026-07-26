import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { APP_ROUTES } from '../utils/constants';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
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

  return <>{children}</>;
}
