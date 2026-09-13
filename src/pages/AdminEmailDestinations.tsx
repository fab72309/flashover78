import { useCallback, useEffect, useState } from 'react';
import { Mail, Save } from 'lucide-react';
import AdminPageHeader from '../components/AdminPageHeader';
import ConfirmationDialog from '../components/ConfirmationDialog';
import EmailRecipientsField from '../components/EmailRecipientsField';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  listFormEmailDestinations,
  updateFormEmailDestinations,
} from '../services/supabaseService';
import {
  createDefaultFormEmailDestinations,
  type FormEmailDestinationKey,
  type FormEmailDestinations,
} from '../utils/emailDestinations';

const fieldDefinitions: Array<{
  key: FormEmailDestinationKey;
  label: string;
  description: string;
  required?: boolean;
}> = [
  {
    key: 'mainCourante',
    label: 'Main courante',
    description: 'Destinataires principaux de la main courante.',
    required: true,
  },
  {
    key: 'suiviMedical',
    label: 'Suivi médical',
    description: 'L’utilisateur connecté est toujours ajouté automatiquement.',
  },
  {
    key: 'demandeReparation',
    label: 'Demande de réparation',
    description: 'Utilisé lorsqu’une main courante contient une réparation ou un remplacement de matériel.',
    required: true,
  },
];

function getInitialDestinations(): FormEmailDestinations {
  return createDefaultFormEmailDestinations();
}

export default function AdminEmailDestinations() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [destinations, setDestinations] = useState<FormEmailDestinations>(getInitialDestinations);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{
    key: FormEmailDestinationKey;
    recipient: string;
  } | null>(null);

  const loadDestinations = useCallback(async () => {
    setLoading(true);
    try {
      setDestinations(await listFormEmailDestinations());
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Impossible de charger les destinataires.',
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

    void loadDestinations();
  }, [loadDestinations, user?.isAdmin]);

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

  const updateRecipients = (key: FormEmailDestinationKey, recipients: string[]) => {
    setDestinations((current) => ({ ...current, [key]: recipients }));
  };

  const confirmRemoval = () => {
    if (!pendingRemoval) return;

    const { key, recipient } = pendingRemoval;
    setDestinations((current) => ({
      ...current,
      [key]: current[key].filter((candidate) => candidate !== recipient),
    }));
    setPendingRemoval(null);
    showToast('Adresse retirée de la liste. Enregistrez les changements pour confirmer.', 'info');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      await updateFormEmailDestinations(destinations);
      showToast('Destinataires des formulaires mis à jour.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Impossible d’enregistrer les destinataires.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <AdminPageHeader
        title="Destinataires des formulaires"
        subtitle="Gérez les adresses utilisées par défaut pour les envois de la main courante, du suivi médical et des demandes de réparation."
      />

      <section className="surface-card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-label-sm font-semibold uppercase tracking-[0.12em] text-primary">
              Envoi automatique
            </p>
            <h2 className="mt-1 text-headline-md text-on-surface">Listes de diffusion</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Cliquez sur une adresse pour la sélectionner. La croix apparaît alors à sa droite pour demander sa suppression.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-body-md text-on-surface-variant">Chargement des destinataires...</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6">
            <div className="grid gap-4 xl:grid-cols-3">
              {fieldDefinitions.map((field) => (
                <EmailRecipientsField
                  key={field.key}
                  label={field.label}
                  description={field.description}
                  required={field.required}
                  recipients={destinations[field.key]}
                  disabled={busy}
                  onChange={(recipients) => updateRecipients(field.key, recipients)}
                  onRemoveRequest={(recipient) => setPendingRemoval({ key: field.key, recipient })}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-outline-variant/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-label-sm text-on-surface-variant">
                Les modifications sont appliquées après l’enregistrement. Maximum : 20 adresses par formulaire.
              </p>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={18} aria-hidden="true" />
                {busy ? 'Enregistrement...' : 'Enregistrer les destinataires'}
              </button>
            </div>
          </form>
        )}
      </section>

      <ConfirmationDialog
        open={pendingRemoval !== null}
        title="Supprimer cette adresse ?"
        description={pendingRemoval
          ? `L’adresse ${pendingRemoval.recipient} sera retirée de la liste « ${fieldDefinitions.find((field) => field.key === pendingRemoval.key)?.label ?? 'du formulaire'} ». Cette modification devra être enregistrée pour être appliquée.`
          : ''}
        confirmLabel="Supprimer l’adresse"
        busy={busy}
        onCancel={() => {
          if (!busy) setPendingRemoval(null);
        }}
        onConfirm={confirmRemoval}
      />
    </div>
  );
}
