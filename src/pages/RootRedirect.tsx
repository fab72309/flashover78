import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { APP_ROUTES } from '../utils/constants';

export default function RootRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate(APP_ROUTES.HOME, { replace: true });
    } else {
      navigate(APP_ROUTES.LOGIN, { replace: true, state: { from: location } });
    }
  }, [user, loading, navigate, location]);

  return null;
}
