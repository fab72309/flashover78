import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Shield, Trash2, UserRound } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import AdminPageHeader from '../components/AdminPageHeader';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { deleteManagedUser, listManagedUsers } from '../services/supabaseService';
import type { ManagedUser } from '../types';
import { ROLE_LABELS } from '../utils/permissions';

export default function AdminRegisteredAccounts() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeletion, setPendingDeletion] = useState<ManagedUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listManagedUsers());
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Impossible de charger les comptes.',
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

  const handleDelete = async () => {
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
      <AdminPageHeader
        title="Comptes enregistrés"
        subtitle="Consultez les comptes connus par Supabase Auth et supprimez un compte avec confirmation."
      />

      <section className="surface-card p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRound size={21} aria-hidden="true" />
            </span>
            <div>
              <p className="text-label-sm font-semibold uppercase tracking-[0.12em] text-primary">
                Comptes Supabase Auth
              </p>
              <h2 className="mt-1 text-headline-md text-on-surface">Liste des comptes</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-surface-container px-4 text-label-lg font-semibold text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : undefined} aria-hidden="true" />
            Actualiser
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="text-body-md text-on-surface-variant">Chargement...</p>
          ) : users.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Aucun compte disponible.</p>
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
                      {ROLE_LABELS[managedUser.role]}
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
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
