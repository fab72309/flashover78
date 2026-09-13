import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, MailPlus, Save, Shield, Trash2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PageIntro from '../components/PageIntro';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  createManagedUser,
  deleteManagedUser,
  inviteManagedUser,
  listFormEmailDestinations,
  listManagedUsers,
  updateFormEmailDestinations,
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
import {
  createDefaultFormEmailDestinations,
  parseEmailRecipients,
  type FormEmailDestinations,
  type FormEmailDestinationKey,
} from '../utils/emailDestinations';
import { ROLE_LABELS } from '../utils/permissions';

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
      if (value.length === 1) {
        return;
      }
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
                disabled={disabled || (checked && value.length === 1)}
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
        Une même personne peut avoir plusieurs fonctions.
      </p>
    </fieldset>
  );
}

export default function AdminUsers() {
  const navigate = useNavigate();
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
  const [trainerLevels, setTrainerLevels] = useState<TrainerLevel[]>(['RSFR']);
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [trainerBusy, setTrainerBusy] = useState<string | null>(null);
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(true);
  const [emailSettingsBusy, setEmailSettingsBusy] = useState(false);
  const [emailDestinationDrafts, setEmailDestinationDrafts] = useState<Record<FormEmailDestinationKey, string>>({
    mainCourante: createDefaultFormEmailDestinations().mainCourante.join('\n'),
    suiviMedical: createDefaultFormEmailDestinations().suiviMedical.join('\n'),
    demandeReparation: createDefaultFormEmailDestinations().demandeReparation.join('\n'),
  });
  const [pendingDeletion, setPendingDeletion] = useState<ManagedUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

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

  const loadEmailDestinations = useCallback(async () => {
    setEmailSettingsLoading(true);
    try {
      const destinations = await listFormEmailDestinations();
      setEmailDestinationDrafts({
        mainCourante: destinations.mainCourante.join('\n'),
        suiviMedical: destinations.suiviMedical.join('\n'),
        demandeReparation: destinations.demandeReparation.join('\n'),
      });
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Impossible de charger les destinataires.',
        'error',
      );
    } finally {
      setEmailSettingsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!user?.isAdmin) {
      setLoading(false);
      setEmailSettingsLoading(false);
      return;
    }

    void loadUsers();
    void loadEmailDestinations();
  }, [loadEmailDestinations, loadUsers, user?.isAdmin]);

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
    setTrainerLevels(['RSFR']);
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
        error instanceof Error ? error.message : 'Impossible de gérer cet utilisateur.',
        'error'
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
        error instanceof Error ? error.message : 'Impossible de modifier ce rôle.',
        'error'
      );
    } finally {
      setRoleBusy(null);
    }
  };

  const handleTrainerLevelsChange = async (
    managedUser: ManagedUser,
    nextTrainerLevels: TrainerLevel[]
  ) => {
    if (!nextTrainerLevels.length || managedUser.trainerLevels.join('|') === nextTrainerLevels.join('|')) {
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
        error instanceof Error ? error.message : 'Impossible de modifier les fonctions formateur.',
        'error'
      );
    } finally {
      setTrainerBusy(null);
    }
  };

  const updateEmailDestinationDraft = (key: FormEmailDestinationKey, value: string) => {
    setEmailDestinationDrafts((current) => ({ ...current, [key]: value }));
  };

  const handleEmailDestinationsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const destinations: FormEmailDestinations = {
      mainCourante: parseEmailRecipients(emailDestinationDrafts.mainCourante),
      suiviMedical: parseEmailRecipients(emailDestinationDrafts.suiviMedical),
      demandeReparation: parseEmailRecipients(emailDestinationDrafts.demandeReparation),
    };

    setEmailSettingsBusy(true);
    try {
      await updateFormEmailDestinations(destinations);
      setEmailDestinationDrafts({
        mainCourante: destinations.mainCourante.join('\n'),
        suiviMedical: destinations.suiviMedical.join('\n'),
        demandeReparation: destinations.demandeReparation.join('\n'),
      });
      showToast('Destinataires des formulaires mis à jour.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Impossible d’enregistrer les destinataires.',
        'error',
      );
    } finally {
      setEmailSettingsBusy(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!pendingDeletion) return;

    const target = pendingDeletion;
    setDeletingUserId(target.id);
    try {
      await deleteManagedUser(target.id);
      setUsers((current) => current.filter((candidate) => candidate.id !== target.id));
      setPendingDeletion(null);
      showToast(`Le compte de ${target.displayName} a été supprimé.`, 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Impossible de supprimer ce compte.',
        'error',
      );
    } finally {
      setDeletingUserId(null);
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

          <TrainerLevelPicker value={trainerLevels} onChange={setTrainerLevels} />

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
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail size={21} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-headline-md text-on-surface">Destinataires des formulaires</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Modifiez les adresses utilisées par défaut pour la main courante, le suivi médical et les demandes de réparation.
            </p>
          </div>
        </div>

        {emailSettingsLoading ? (
          <p className="mt-5 text-body-md text-on-surface-variant">Chargement des destinataires...</p>
        ) : (
          <form onSubmit={handleEmailDestinationsSubmit} className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-label-lg text-on-surface">Main courante</span>
              <textarea
                value={emailDestinationDrafts.mainCourante}
                onChange={(event) => updateEmailDestinationDraft('mainCourante', event.target.value)}
                className="min-h-24 w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Une adresse par ligne"
                rows={3}
                required
              />
              <span className="mt-1 block text-label-sm text-on-surface-variant">
                Une adresse par ligne, ou séparées par une virgule.
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-label-lg text-on-surface">Suivi médical</span>
              <textarea
                value={emailDestinationDrafts.suiviMedical}
                onChange={(event) => updateEmailDestinationDraft('suiviMedical', event.target.value)}
                className="min-h-24 w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Une adresse par ligne"
                rows={3}
              />
              <span className="mt-1 block text-label-sm text-on-surface-variant">
                L’utilisateur connecté est toujours ajouté automatiquement, même si cette liste est vide.
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-label-lg text-on-surface">Demande de réparation</span>
              <textarea
                value={emailDestinationDrafts.demandeReparation}
                onChange={(event) => updateEmailDestinationDraft('demandeReparation', event.target.value)}
                className="min-h-24 w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Une adresse par ligne"
                rows={3}
                required
              />
              <span className="mt-1 block text-label-sm text-on-surface-variant">
                Utilisé lorsque la main courante contient une réparation ou un remplacement de matériel.
              </span>
            </label>

            <button
              type="submit"
              disabled={emailSettingsBusy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={18} aria-hidden="true" />
              {emailSettingsBusy ? 'Enregistrement...' : 'Enregistrer les destinataires'}
            </button>
          </form>
        )}
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
                      <Shield size={14} />
                      Accès : {ROLE_LABELS[managedUser.role]}
                    </span>
                    {managedUser.id === user.id ? (
                      <span className="text-label-sm text-on-surface-variant">Compte actuel</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeletion(managedUser)}
                        disabled={deletingUserId !== null}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-300/70 px-3 py-2 text-label-lg font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Supprimer le compte de ${managedUser.displayName}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                        Supprimer
                      </button>
                    )}
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
                      event.target.value as AppRole
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

      <ConfirmationDialog
        open={pendingDeletion !== null}
        title="Supprimer ce compte ?"
        description={pendingDeletion
          ? `Le compte de ${pendingDeletion.displayName} (${pendingDeletion.email}) sera supprimé définitivement. Ses données personnelles liées à l’application pourront également disparaître. Cette action ne peut pas être annulée.`
          : ''}
        confirmLabel="Supprimer le compte"
        busy={deletingUserId !== null}
        onCancel={() => {
          if (deletingUserId === null) setPendingDeletion(null);
        }}
        onConfirm={() => void handleDeleteUser()}
      />
    </div>
  );
}
