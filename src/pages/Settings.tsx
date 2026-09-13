import { Link } from 'react-router-dom';
import { User, Moon, LogOut, Sun, ShieldCheck } from 'lucide-react';
import { useAppVersion } from '../hooks/useAppVersion';
import PageIntro from '../components/PageIntro';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { APP_ROUTES } from '../utils/constants';

export default function Settings() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { user } = useAuth();
  const appVersion = useAppVersion();

  return (
    <div className="container mx-auto py-4 fade-in">
      <PageIntro
        title="Paramètres"
        subtitle="Gérez vos préférences, votre compte et les options générales de l’application."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          to={APP_ROUTES.ACCOUNT}
          className="surface-card flex min-h-28 items-start gap-4 p-5 transition-all hover:shadow-ambient"
        >
          <div className="rounded-lg bg-primary/10 p-3">
            <User size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="mb-1 text-headline-md text-on-surface">Compte et sécurité</h2>
            <p className="text-body-md text-on-surface-variant">
              Informations personnelles, email, mot de passe et déconnexion.
            </p>
            <div className="mt-2 flex items-center gap-1 text-label-sm uppercase text-primary">
              <LogOut size={13} />
              <span>Gérer le compte</span>
            </div>
          </div>
        </Link>

        {user?.isAdmin ? (
          <Link
            to={APP_ROUTES.ADMIN_SETTINGS}
            className="surface-card flex min-h-28 items-start gap-4 p-5 transition-all hover:shadow-ambient"
          >
            <div className="rounded-lg bg-primary/10 p-3">
              <ShieldCheck size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="mb-1 text-headline-md text-on-surface">Paramètres administrateurs</h2>
              <p className="text-body-md text-on-surface-variant">
                Gérez les utilisateurs, les destinataires des formulaires et les comptes enregistrés.
              </p>
              <div className="mt-2 flex items-center gap-1 text-label-sm uppercase text-primary">
                <ShieldCheck size={13} />
                <span>Ouvrir les paramètres administrateurs</span>
              </div>
            </div>
          </Link>
        ) : null}

        <section className="surface-card flex min-h-28 items-start justify-between gap-4 p-5">
          <div className="flex min-w-0 items-start gap-4">
            <div className="rounded-lg bg-surface-container p-3 text-secondary">
              {isDarkMode ? <Moon size={22} /> : <Sun size={22} />}
            </div>
            <div>
              <h2 className="mb-1 text-headline-md text-on-surface">Thème sombre</h2>
              <p className="text-body-md text-on-surface-variant">
                Réduit la luminosité de l’interface.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isDarkMode}
            onClick={toggleDarkMode}
            className={[
              'relative h-8 w-14 shrink-0 rounded-full transition-colors',
              isDarkMode ? 'bg-primary' : 'bg-surface-container-highest',
            ].join(' ')}
            aria-label="Activer ou désactiver le thème sombre"
          >
            <span
              className={[
                'absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform',
                isDarkMode ? 'translate-x-6' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
        </section>
      </div>

      <div className="mt-6 surface-card p-5">
        <h2 className="text-headline-md text-on-surface mb-3">À propos</h2>
        <p className="text-body-md text-on-surface-variant">Version de l'application: {appVersion}</p>
        <p className="text-body-md text-on-surface-variant mt-1">&copy; 2025 Flashover78. Tous droits réservés.</p>
      </div>

    </div>
  );
}
