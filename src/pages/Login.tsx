import AuthForm from '../components/AuthForm';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '../utils/constants';
import { isDevAuthBypassEnabled } from '../utils/devAuth';

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate(APP_ROUTES.HOME);
    }
  }, [user, loading, navigate]);

  if (isDevAuthBypassEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md mx-auto surface-card p-8 text-center space-y-3">
          <h1 className="text-headline-lg text-on-surface">Mode développement</h1>
          <p className="text-body-md text-on-surface-variant">
            Authentification désactivée temporairement. Redirection automatique vers l&apos;application.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <AuthForm />
    </div>
  );
}
