import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MailPlus, Shield, UserPlus, UserRoundCheck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import AdminPageHeader from '../components/AdminPageHeader';
import { useAuth } from '../contexts/AuthContext';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../utils/authRecovery';
import { useToast } from '../contexts/ToastContext';
import {
  createManagedUser,
  inviteManagedUser,
  listManagedUsers,
  updateManagedUserRole,
  updateManagedUserTrainerLevels,
} from '../services/supabaseService';
import type { AppRole, ManagedUser, TrainerLevel } from '../types';
import {
  APP_ROUTES,
  TRAINER_LEVEL_DESCRIPTIONS,
  TRAINER_LEVEL_LABELS,
  TRAINER_LEVELS,
} from '../utils/constants';
import { ROLE_LABELS } from '../utils/permissions';
import { getUserFacingError } from '../utils/userFacingError';

const roleOptions: Array<{ value: AppRole; description: string }> = [
  { value: 'member', description: 'Consultation et co-voiturage' },
  { value: 'contributor', description: 'Ajout et modification du planning et des documents' },
  { value: 'admin', description: 'Tous les droits, utilisateurs compris' },
];

function TrainerLevelPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: TrainerLevel[];
  onChange: (nextValue: TrainerLevel[]) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const toggleLevel = (level: TrainerLevel) => {
    if (value.includes(level)) {
      onChange(value.filter((candidate) => candidate !== level));
      return;
    }

    onChange(TRAINER_LEVELS.filter((candidate) => candidate === level || value.includes(candidate)));
  };

  return (
    <fieldset className={compact ? 'mt-4' : 'md:col-span-2'} disabled={disabled}>
      <legend className="mb-2 block text-label-lg text-on-surface">Fonctions formateur</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {TRAINER_LEVELS.map((level) => {
          const checked = value.includes(level);
          return (
            <label
              key={level}
              className="flex min-h-12 items-start gap-3 rounded-lg bg-surface-container p-3 text-left"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleLevel(level)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4"
              />
              <span className="min-w-0">
                <span className="block text-label-lg font-semibold text-on-surface">
                  {TRAINER_LEVEL_LABELS[level]}
                </span>
                <span className="block text-label-sm text-on-surface-variant">
                  {TRAINER_LEVEL_DESCRIPTIONS[level]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-label-sm text-on-surface-variant">
        Une même personne peut avoir plusieurs fonctions. Laisser toutes les cases décochées
        si aucune qualification n’est attribuée.
      </p>
    </fieldset>
  );
}

export default function AdminUsers() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'invite' | 'create'>('invite');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AppRole>('member');
  const [trainerLevels, setTrainerLevels] = useState<TrainerLevel[]>([]);
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [trainerBusy, setTrainerBusy] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listManagedUsers());
    } catch (error) {
      showToast(
        getUserFacingError(error, 'Impossible de charger les utilisateurs.'),
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!user?.isAdmin) {
      setLoading(false);
      return;
    }

    void loadUsers();
  }, [loadUsers, user?.isAdmin]);

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
    setRole('member');
    setTrainerLevels([]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);

    try {
      if (mode === 'invite') {
        await inviteManagedUser({ email, firstName, lastName, role, trainerLevels });
        showToast('Invitation envoyée.', 'success');
      } else {
        await createManagedUser({ email, password, firstName, lastName, role, trainerLevels });
        showToast('Compte créé.', 'success');
      }

      resetForm();
      await loadUsers();
    } catch (error) {
      showToast(
        getUserFacingError(error, 'Impossible de gérer cet utilisateur.'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (managedUser: ManagedUser, nextRole: AppRole) => {
    if (managedUser.role === nextRole) {
      return;
    }

    setRoleBusy(managedUser.id);
    try {
      await updateManagedUserRole(managedUser.id, nextRole);
      setUsers((current) => current.map((candidate) => (
        candidate.id === managedUser.id
          ? { ...candidate, role: nextRole, isAdmin: nextRole === 'admin' }
          : candidate
      )));
      if (managedUser.id === user.id) {
        await refreshUser();
      }
      showToast(`Rôle défini sur ${ROLE_LABELS[nextRole]}.`, 'success');
    } catch (error) {
      showToast(
        getUserFacingError(error, 'Impossible de modifier ce rôle.'),
        'error',
      );
    } finally {
      setRoleBusy(null);
    }
  };

  const handleTrainerLevelsChange = async (
    managedUser: ManagedUser,
    nextTrainerLevels: TrainerLevel[],
  ) => {
    if (managedUser.trainerLevels.join('|') === nextTrainerLevels.join('|')) {
      return;
    }

    setTrainerBusy(managedUser.id);
    try {
      await updateManagedUserTrainerLevels(managedUser.id, nextTrainerLevels);
      setUsers((current) => current.map((candidate) => (
        candidate.id === managedUser.id
          ? { ...candidate, trainerLevels: nextTrainerLevels }
          : candidate
      )));
      if (managedUser.id === user.id) {
        await refreshUser();
      }
      showToast('Fonctions formateur mises à jour.', 'success');
    } catch (error) {
      showToast(
        getUserFacingError(error, 'Impossible de modifier les fonctions formateur.'),
        'error',
      );
    } finally {
      setTrainerBusy(null);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <AdminPageHeader
        title="Utilisateurs"
        subtitle="Invitez des personnes et ajustez leurs rôles et fonctions formateur."
      />

      <section className="surface-card p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-label-sm font-semibold uppercase tracking-[0.12em] text-primary">
              Accès et invitations
            </p>
            <h2 className="mt-1 text-headline-md text-on-surface">Ajouter un utilisateur</h2>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Type d’ajout">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'invite'}
              onClick={() => setMode('invite')}
              className={[
                'rounded-full px-4 py-2 text-label-lg transition-colors',
                mode === 'invite' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface',
              ].join(' ')}
            >
              Inviter
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'create'}
              onClick={() => setMode('create')}
              className={[
                'rounded-full px-4 py-2 text-label-lg transition-colors',
                mode === 'create' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface',
              ].join(' ')}
            >
              Créer un compte
            </button>
          </div>
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

          <TrainerLevelPicker value={trainerLevels} onChange={setTrainerLevels} />

          {mode === 'create' ? (
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-label-lg text-on-surface">Mot de passe initial</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                required
              />
            </label>
          ) : null}

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-label-lg text-on-surface">Niveau d’accès</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AppRole)}
              className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {ROLE_LABELS[option.value]} · {option.description}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50 md:col-span-2"
          >
            {mode === 'invite' ? <MailPlus size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
            {busy
              ? 'Traitement...'
              : mode === 'invite'
                ? 'Envoyer l’invitation'
                : 'Créer le compte'}
          </button>
        </form>
      </section>

      <section className="surface-card p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-label-sm font-semibold uppercase tracking-[0.12em] text-primary">
              Comptes existants
            </p>
            <h2 className="mt-1 text-headline-md text-on-surface">Rôles et fonctions</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Modifiez les droits fonctionnels sans quitter cette page.
            </p>
          </div>
          <Link
            to={APP_ROUTES.ADMIN_REGISTERED_ACCOUNTS}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-surface-container px-4 text-label-lg font-semibold text-on-surface transition hover:bg-surface-container-high"
          >
            Voir les comptes
            <UserRoundCheck size={17} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="text-body-md text-on-surface-variant">Chargement...</p>
          ) : users.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Aucun utilisateur disponible.</p>
          ) : (
            users.map((managedUser) => (
              <article key={managedUser.id} className="rounded-lg bg-surface-container-low p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-body-lg font-semibold text-on-surface">
                      {managedUser.displayName}
                    </h3>
                    <p className="break-all text-body-md text-on-surface-variant">{managedUser.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
                      <Shield size={14} aria-hidden="true" />
                      Accès : {ROLE_LABELS[managedUser.role]}
                    </span>
                    {managedUser.id === user.id ? (
                      <span className="text-label-sm text-on-surface-variant">Compte actuel</span>
                    ) : null}
                  </div>
                </div>

                <TrainerLevelPicker
                  value={managedUser.trainerLevels}
                  disabled={trainerBusy === managedUser.id}
                  compact
                  onChange={(nextValue) => void handleTrainerLevelsChange(managedUser, nextValue)}
                />

                <label className="mt-4 block max-w-md">
                  <span className="mb-1.5 block text-label-sm text-on-surface-variant">
                    Niveau d’accès
                  </span>
                  <select
                    value={managedUser.role}
                    disabled={roleBusy === managedUser.id}
                    onChange={(event) => void handleRoleChange(
                      managedUser,
                      event.target.value as AppRole,
                    )}
                    className="w-full rounded-lg bg-surface-container-highest px-3 py-2.5 text-on-surface disabled:opacity-60"
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {ROLE_LABELS[option.value]} · {option.description}
                      </option>
                    ))}
                  </select>
                </label>

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

      <Link
        to={APP_ROUTES.ADMIN_EMAIL_DESTINATIONS}
        className="inline-flex items-center gap-2 text-label-lg font-semibold text-primary"
      >
        Gérer les destinataires des formulaires
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </div>
  );
}
