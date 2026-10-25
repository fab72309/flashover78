import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Pencil,
  RefreshCw,
  UserCheck,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import AddEventForm from '../components/AddEventForm';
import FormateurAssignments from '../components/FormateurAssignments';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { getUserFacingError } from '../utils/userFacingError';
import { logClientFailure } from '../utils/clientDiagnostics';
import { getEventById, listTrainingSessionSummaries } from '../services/supabaseService';
import type {
  CalendarEvent,
  TrainingSessionSummary,
} from '../types';
import { APP_ROUTES } from '../utils/constants';
import { canContribute } from '../utils/permissions';

export default function TrainingSessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [summary, setSummary] = useState<TrainingSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState(false);

  const loadSession = useCallback(async () => {
    if (!id || !user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextEvent, summaries] = await Promise.all([
        getEventById(id),
        listTrainingSessionSummaries(id),
      ]);

      if (!nextEvent) {
        setError('Cette session est introuvable.');
        setEvent(null);
        return;
      }

      const nextSummary = summaries[0] ?? null;
      setEvent(nextEvent);
      setSummary(nextSummary);
    } catch (loadError) {
      logClientFailure('Chargement de la session de formation impossible');
      setError(getUserFacingError(loadError, 'Impossible de charger cette session.'));
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !event || !summary) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.CALENDAR)}
          className="inline-flex min-h-11 items-center gap-2 text-primary"
        >
          <ArrowLeft size={19} />
          Retour au calendrier
        </button>
        <section className="surface-card p-5" role="alert">
          <h1 className="text-headline-md text-on-surface">Session indisponible</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {error ?? 'Les informations de cette session ne sont pas disponibles.'}
          </p>
          <button
            type="button"
            onClick={loadSession}
            className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
          >
            <RefreshCw size={18} />
            Réessayer
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <button
        type="button"
        onClick={() => navigate(APP_ROUTES.CALENDAR)}
        className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
      >
        <ArrowLeft size={19} />
        Retour au calendrier
      </button>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-outline-variant p-5 lg:p-6">
          <div className="min-w-0">
            <StatusBadge status={summary.myStatus} />
            <h1 className="mt-3 text-display-sm text-on-surface">{event.title}</h1>
            <p className="mt-2 max-w-3xl text-body-lg text-on-surface-variant">
              {event.description}
            </p>
          </div>
        </div>

        <div className="p-5 lg:p-6">
          <div className="space-y-4">
            <InfoRow
              icon={<CalendarDays size={19} />}
              label={format(event.date, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
            />
            {event.location ? (
              <InfoRow icon={<MapPin size={19} />} label={event.location} />
            ) : null}
            {event.formateurAssignments?.length ? (
              <div className="flex items-start gap-3 text-on-surface-variant">
                <UserCheck size={19} className="mt-0.5 shrink-0" />
                <FormateurAssignments assignments={event.formateurAssignments} />
              </div>
            ) : event.formateurs?.length ? (
              <InfoRow
                icon={<UserCheck size={19} />}
                label={event.formateurs.join(', ')}
              />
            ) : null}
            {event.observations ? (
              <div className="border-t border-outline-variant pt-4">
                <h2 className="font-semibold text-on-surface">Observations</h2>
                <p className="mt-2 whitespace-pre-wrap text-body-md text-on-surface-variant">
                  {event.observations}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {canContribute(user) ? (
        <section className="space-y-4 border-t border-outline-variant pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-label-sm uppercase text-primary">Planning</p>
              <h2 className="mt-1 text-headline-lg text-on-surface">Modifier la session</h2>
            </div>
            <button
              type="button"
              onClick={() => setEditingEvent((current) => !current)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-container px-4 font-semibold text-on-surface"
            >
              {editingEvent ? <X size={18} /> : <Pencil size={18} />}
              {editingEvent ? 'Fermer' : 'Modifier'}
            </button>
          </div>
          {editingEvent ? (
            <AddEventForm
              event={event}
              onSuccess={async () => {
                setEditingEvent(false);
                await loadSession();
              }}
            />
          ) : null}
        </section>
      ) : null}

    </div>
  );
}
function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-3 text-body-md text-on-surface-variant">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: TrainingSessionSummary['myStatus'];
}) {
  const config = status === 'registered'
    ? { label: 'Inscription confirmée', className: 'bg-emerald-100 text-emerald-800' }
    : status === 'waitlisted'
      ? { label: 'Liste d’attente', className: 'bg-amber-100 text-amber-900' }
      : { label: 'Inscriptions ouvertes', className: 'bg-primary/10 text-primary' };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-label-lg ${config.className}`}>
      {config.label}
    </span>
  );
}
