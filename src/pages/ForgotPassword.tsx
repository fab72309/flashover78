import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../services/supabaseService';
import { useAppVersion } from '../hooks/useAppVersion';
import { APP_ROUTES, LOGO_PATHS } from '../utils/constants';
import { getUserFacingError } from '../utils/userFacingError';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appVersion = useAppVersion();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (caughtError) {
      setError(getUserFacingError(caughtError, "Impossible d'envoyer l'email de réinitialisation."));
    } finally {
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
          <h1 className="text-headline-lg text-on-surface">Mot de passe oublié</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Recevez un lien sécurisé pour choisir un nouveau mot de passe.
          </p>
        </div>

        {submitted ? (
          <div role="status" className="space-y-5">
            <div className="rounded-squircle-sm bg-emerald-50 p-4 text-emerald-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-body-md">
                  Si un compte correspond à cette adresse, un email vient d’être envoyé.
                  Consultez aussi vos courriers indésirables.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="w-full rounded-squircle-sm bg-surface-container px-4 py-3 text-body-lg text-on-surface"
            >
              Renvoyer un lien
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div role="alert" className="rounded-squircle-sm bg-red-50 p-3 text-red-700">
                {error}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-label-lg text-on-surface">Email</span>
              <span className="relative block">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className="w-full rounded-squircle-sm bg-surface-container-highest py-3 pl-10 pr-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
                <Mail
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
              {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
            </button>
          </form>
        )}

        <Link
          to={APP_ROUTES.LOGIN}
          className="mt-5 flex min-h-11 items-center justify-center gap-2 text-body-md text-primary hover:underline"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Retour à la connexion
        </Link>

        <div
          className="mt-5 pt-4 text-center"
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
