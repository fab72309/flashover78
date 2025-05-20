import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function RootRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate('/app', { replace: true });
    } else {
      navigate('/login', { replace: true, state: { from: location } });
    }
  }, [user, loading, navigate, location]);

  return null;
}
