import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MailPlus, Shield, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PageIntro from '../components/PageIntro';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  createManagedUser,
  inviteManagedUser,
  listManagedUsers,
} from '../services/supabaseService';
import type { ManagedUser } from '../types';
import { APP_ROUTES } from '../utils/constants';

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'invite' | 'create'>('invite');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listManagedUsers());
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Impossible de charger les utilisateurs.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  if (!user?.isAdmin) {
    return (
      <section className="surface-card p-5" role="alert">
        <h1 className="text-headline-md text-on-surface">Accès restreint</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Cette section est réservée aux administrateurs.
        </p>
      </section>
    );
  }

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPassword('');
    setIsAdmin(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);

    try {
      if (mode === 'invite') {
        await inviteManagedUser({ email, firstName, lastName, isAdmin });
        showToast('Invitation envoyée.', 'success');
      } else {
        await createManagedUser({ email, password, firstName, lastName, isAdmin });
        showToast('Compte créé.', 'success');
      }

      resetForm();
      await loadUsers();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Impossible de gérer cet utilisateur.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <PageIntro
        title="Utilisateurs"
        subtitle="Gérez les comptes autorisés et l’envoi des invitations depuis un point d’accès administrateur."
      />

      <button
        type="button"
        onClick={() => navigate(APP_ROUTES.SETTINGS)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-primary hover:bg-surface-container"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Retour aux paramètres
      </button>

      <section className="surface-card p-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('invite')}
            className={[
              'rounded-full px-4 py-2 text-label-lg',
              mode === 'invite' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface',
            ].join(' ')}
          >
            Inviter
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={[
              'rounded-full px-4 py-2 text-label-lg',
              mode === 'create' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface',
            ].join(' ')}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-label-lg text-on-surface">Prénom</span>
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-label-lg text-on-surface">Nom</span>
            <input
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
              required
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-label-lg text-on-surface">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
              required
            />
          </label>

          {mode === 'create' ? (
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-label-lg text-on-surface">Mot de passe initial</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
                minLength={6}
                required
              />
            </label>
          ) : null}

          <label className="flex items-center gap-3 rounded-lg bg-surface-container p-4 md:col-span-2">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(event) => setIsAdmin(event.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-body-md text-on-surface">Donner les droits administrateur</span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-50 md:col-span-2"
          >
            {mode === 'invite' ? <MailPlus size={18} /> : <UserPlus size={18} />}
            {busy
              ? 'Traitement...'
              : mode === 'invite'
                ? 'Envoyer l’invitation'
                : 'Créer le compte'}
          </button>
        </form>
      </section>

      <section className="surface-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-headline-md text-on-surface">Comptes enregistrés</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Liste consolidée des utilisateurs connus par Supabase Auth.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="rounded-lg bg-surface-container px-4 py-2 text-label-lg text-on-surface"
          >
            Actualiser
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-body-md text-on-surface-variant">Chargement...</p>
          ) : users.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Aucun utilisateur disponible.</p>
          ) : (
            users.map((managedUser) => (
              <article key={managedUser.id} className="rounded-lg bg-surface-container-low p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-body-lg font-semibold text-on-surface">
                      {managedUser.displayName}
                    </h3>
                    <p className="text-body-md text-on-surface-variant">{managedUser.email}</p>
                  </div>
                  {managedUser.isAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
                      <Shield size={14} />
                      Admin
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2 text-label-sm text-on-surface-variant md:grid-cols-3">
                  <span>
                    Créé le {managedUser.createdAt ? format(managedUser.createdAt, 'd MMM yyyy', { locale: fr }) : 'n/a'}
                  </span>
                  <span>
                    Dernière connexion {managedUser.lastSignInAt ? format(managedUser.lastSignInAt, 'd MMM yyyy HH:mm', { locale: fr }) : 'jamais'}
                  </span>
                  <span>
                    Email {managedUser.emailConfirmedAt ? 'confirmé' : 'en attente'}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
