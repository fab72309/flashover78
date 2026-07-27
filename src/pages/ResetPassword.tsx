import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { supabase } from '../lib/supabase';
import {
  cancelPasswordRecovery,
  updatePasswordFromRecovery,
} from '../services/supabaseService';
import { useAppVersion } from '../hooks/useAppVersion';
import {
  getRecoveryLinkError,
  PASSWORD_MIN_LENGTH,
  validateNewPassword,
} from '../utils/authRecovery';
import { APP_ROUTES, LOGO_PATHS } from '../utils/constants';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [checkingLink, setCheckingLink] = useState(true);
  const [recoverySession, setRecoverySession] = useState<Session | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const appVersion = useAppVersion();

  useEffect(() => {
    let isMounted = true;
    const urlError = getRecoveryLinkError(window.location.search, window.location.hash);

    if (urlError) {
      setLinkError(urlError);
      setCheckingLink(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted && event === 'PASSWORD_RECOVERY' && session) {
        setRecoverySession(session);
        setLinkError(null);
        setCheckingLink(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) {
        return;
      }

      if (sessionError || !data.session) {
        setLinkError(
          'Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien.'
        );
      } else {
        setRecoverySession(data.session);
      }
      setCheckingLink(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateNewPassword(password, confirmation);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updatePasswordFromRecovery(password);
      setRecoverySession(null);
      setCompleted(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Impossible de modifier le mot de passe.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    setError(null);

    try {
      await cancelPasswordRecovery();
      navigate(APP_ROUTES.LOGIN, { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Impossible de fermer la session de récupération.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      <section className="surface-card p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={LOGO_PATHS.default}
            alt="Logo"
            className="mb-3 h-16 w-16 rounded-full object-contain"
          />
          <h1 className="text-headline-lg text-on-surface">Nouveau mot de passe</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Choisissez le mot de passe qui protégera désormais votre compte.
          </p>
        </div>

        {checkingLink ? (
          <div className="flex min-h-40 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : completed ? (
          <div className="space-y-5">
            <div role="status" className="rounded-squircle-sm bg-emerald-50 p-4 text-emerald-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-body-md">
                  Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.
                </p>
              </div>
            </div>
            <Link
              to={APP_ROUTES.LOGIN}
              className="btn-primary-gradient flex min-h-12 items-center justify-center rounded-squircle-sm px-4 text-body-lg"
            >
              Se connecter
            </Link>
          </div>
        ) : linkError || !recoverySession ? (
          <div className="space-y-5">
            <div role="alert" className="rounded-squircle-sm bg-red-50 p-4 text-red-700">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-body-md">
                  {linkError ??
                    'Ce lien de réinitialisation est invalide. Demandez un nouveau lien.'}
                </p>
              </div>
            </div>
            <Link
              to={APP_ROUTES.FORGOT_PASSWORD}
              className="btn-primary-gradient flex min-h-12 items-center justify-center rounded-squircle-sm px-4 text-body-lg"
            >
              Demander un nouveau lien
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div role="alert" className="rounded-squircle-sm bg-red-50 p-3 text-red-700">
                {error}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-label-lg text-on-surface">
                Nouveau mot de passe
              </span>
              <span className="relative block">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  className="w-full rounded-squircle-sm bg-surface-container-highest py-3 pl-10 pr-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden="true"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-label-lg text-on-surface">
                Confirmer le mot de passe
              </span>
              <span className="relative block">
                <input
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  className="w-full rounded-squircle-sm bg-surface-container-highest py-3 pl-10 pr-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden="true"
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary-gradient w-full rounded-squircle-sm py-3 text-body-lg disabled:opacity-50"
            >
              {loading ? 'Modification...' : 'Modifier le mot de passe'}
            </button>
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={loading}
              className="w-full rounded-squircle-sm bg-surface-container px-4 py-3 text-body-lg text-on-surface disabled:opacity-50"
            >
              Annuler
            </button>
          </form>
        )}

        <div
          className="mt-6 pt-4 text-center"
          style={{ borderTop: '1px solid var(--surface-container-high)' }}
        >
          <span className="text-label-sm uppercase text-on-surface-variant">
            Version {appVersion}
          </span>
        </div>
      </section>
    </div>
  );
}
