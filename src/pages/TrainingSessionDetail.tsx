import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Download,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  UserCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ConfirmationDialog from '../components/ConfirmationDialog';
import AddEventForm from '../components/AddEventForm';
import FormateurAssignments from '../components/FormateurAssignments';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  cancelTrainingRegistration,
  getEventById,
  listTrainingParticipants,
  listTrainingSessionSummaries,
  registerForTraining,
  setTrainingAttendance,
  setTrainingCapacity,
} from '../services/supabaseService';
import type {
  CalendarEvent,
  TrainingAttendanceStatus,
  TrainingParticipant,
  TrainingSessionSummary,
} from '../types';
import { APP_ROUTES } from '../utils/constants';
import { createCsv } from '../utils/csv';
import { canContribute } from '../utils/permissions';

const attendanceOptions: Array<{
  value: TrainingAttendanceStatus;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: 'present', label: 'Présent', icon: <Check size={16} /> },
  { value: 'absent', label: 'Absent', icon: <X size={16} /> },
  { value: 'pending', label: 'À confirmer', icon: <Clock3 size={16} /> },
];

export default function TrainingSessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [summary, setSummary] = useState<TrainingSessionSummary | null>(null);
  const [participants, setParticipants] = useState<TrainingParticipant[]>([]);
  const [capacity, setCapacity] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [attendanceBusy, setAttendanceBusy] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);
  const [openedAt] = useState(() => Date.now());

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
      setCapacity(nextSummary?.capacity ?? nextEvent.capacity);

      if (user.isAdmin) {
        setParticipants(await listTrainingParticipants(id));
      }
    } catch (loadError) {
      console.error(loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Impossible de charger cette session.'
      );
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const registrationClosed = useMemo(() => {
    if (!event) {
      return true;
    }

    const closingDate = event.registrationClosesAt ?? event.date;
    return closingDate.getTime() <= openedAt;
  }, [event, openedAt]);

  const availablePlaces = Math.max(
    0,
    (summary?.capacity ?? event?.capacity ?? 0) - (summary?.registeredCount ?? 0)
  );

  const handleRegistration = async () => {
    if (!id) {
      return;
    }

    setActionBusy(true);
    try {
      const registration = await registerForTraining(id);
      showToast(
        registration.status === 'registered'
          ? 'Votre inscription est confirmée.'
          : 'La session est complète : vous êtes ajouté à la liste d’attente.',
        'success'
      );
      await loadSession();
    } catch (registrationError) {
      showToast(
        registrationError instanceof Error
          ? registrationError.message
          : 'Impossible de vous inscrire.',
        'error'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancellation = async () => {
    if (!id) {
      return;
    }

    setActionBusy(true);
    try {
      await cancelTrainingRegistration(id);
      setCancelDialogOpen(false);
      showToast('Votre inscription a été annulée.', 'success');
      await loadSession();
    } catch (cancellationError) {
      showToast(
        cancellationError instanceof Error
          ? cancellationError.message
          : 'Impossible d’annuler votre inscription.',
        'error'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleCapacityUpdate = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!id) {
      return;
    }

    setActionBusy(true);
    try {
      await setTrainingCapacity(id, capacity);
      showToast('La capacité de la session a été mise à jour.', 'success');
      await loadSession();
    } catch (capacityError) {
      showToast(
        capacityError instanceof Error
          ? capacityError.message
          : 'Impossible de modifier la capacité.',
        'error'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleAttendance = async (
    participant: TrainingParticipant,
    attendance: TrainingAttendanceStatus
  ) => {
    setAttendanceBusy(participant.registrationId);
    try {
      await setTrainingAttendance(participant.registrationId, attendance);
      setParticipants((current) =>
        current.map((candidate) =>
          candidate.registrationId === participant.registrationId
            ? { ...candidate, attendance }
            : candidate
        )
      );
      showToast(`Présence mise à jour pour ${participant.displayName}.`, 'success');
    } catch (attendanceError) {
      showToast(
        attendanceError instanceof Error
          ? attendanceError.message
          : 'Impossible de mettre à jour la présence.',
        'error'
      );
    } finally {
      setAttendanceBusy(null);
    }
  };

  const exportParticipants = () => {
    if (!event) {
      return;
    }

    const csv = createCsv(
      ['Nom', 'Email', 'Téléphone', 'Inscription', 'Présence', 'Date inscription'],
      participants.map((participant) => [
        participant.displayName,
        participant.email,
        participant.phone,
        participant.status === 'registered' ? 'Confirmée' : 'Liste d’attente',
        getAttendanceLabel(participant.attendance),
        format(participant.registeredAt, 'dd/MM/yyyy HH:mm'),
      ])
    );
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `participants-${event.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

  const hasActiveRegistration =
    summary.myStatus === 'registered' || summary.myStatus === 'waitlisted';

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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <StatusBadge status={summary.myStatus} />
              <h1 className="mt-3 text-display-sm text-on-surface">{event.title}</h1>
              <p className="mt-2 max-w-3xl text-body-lg text-on-surface-variant">
                {event.description}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:min-w-72">
              <Metric value={summary.registeredCount} label="Inscrits" />
              <Metric value={availablePlaces} label="Places libres" />
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-6">
          <div className="space-y-4">
            <InfoRow
              icon={<CalendarDays size={19} />}
              label={format(event.date, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
            />
            {event.location ? (
              <InfoRow icon={<MapPin size={19} />} label={event.location} />
            ) : null}
            <InfoRow
              icon={<Users size={19} />}
              label={`${summary.capacity} places au total${
                summary.waitlistedCount
                  ? ` · ${summary.waitlistedCount} en attente`
                  : ''
              }`}
            />
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

          <div className="rounded-lg bg-surface-container p-4">
            <h2 className="text-headline-md text-on-surface">
              {user?.isAdmin ? 'Mon inscription' : 'Consultation'}
            </h2>
            {!user?.isAdmin ? (
              <p className="mt-2 text-body-md text-on-surface-variant">
                Votre niveau d’accès permet de consulter les informations de cette session.
              </p>
            ) : (
              <p className="mt-2 text-body-md text-on-surface-variant">
                {getRegistrationMessage(summary, registrationClosed)}
              </p>
            )}

            {user?.isAdmin && hasActiveRegistration && !registrationClosed ? (
              <button
                type="button"
                onClick={() => setCancelDialogOpen(true)}
                disabled={actionBusy}
                className="mt-5 min-h-12 w-full rounded-lg border border-red-300 px-4 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Annuler mon inscription
              </button>
            ) : user?.isAdmin && hasActiveRegistration ? (
              <p className="mt-5 rounded-lg bg-surface-container-high p-3 text-body-md text-on-surface-variant">
                La session a commencé : l’inscription est désormais archivée.
              </p>
            ) : user?.isAdmin ? (
              <button
                type="button"
                onClick={handleRegistration}
                disabled={actionBusy || registrationClosed}
                className="mt-5 min-h-12 w-full rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionBusy
                  ? 'Traitement...'
                  : availablePlaces > 0
                    ? 'S’inscrire'
                    : 'Rejoindre la liste d’attente'}
              </button>
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

      {user?.isAdmin ? (
        <section className="space-y-4 border-t border-outline-variant pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-label-sm uppercase text-primary">Gestion responsable</p>
              <h2 className="mt-1 text-headline-lg text-on-surface">
                Participants et présences
              </h2>
              <p className="mt-1 text-body-md text-on-surface-variant">
                Les coordonnées sont réservées aux responsables de la session.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form onSubmit={handleCapacityUpdate} className="flex items-center gap-2">
                <label htmlFor="session-capacity" className="sr-only">
                  Capacité
                </label>
                <input
                  id="session-capacity"
                  type="number"
                  min={1}
                  max={500}
                  value={capacity}
                  onChange={(changeEvent) => setCapacity(Number(changeEvent.target.value))}
                  className="h-11 w-24 rounded-lg bg-surface-container px-3 text-center text-on-surface"
                />
                <button
                  type="submit"
                  disabled={actionBusy || capacity === summary.capacity}
                  className="min-h-11 rounded-lg bg-surface-container-high px-4 font-semibold text-on-surface disabled:opacity-50"
                >
                  Appliquer
                </button>
              </form>
              <button
                type="button"
                onClick={exportParticipants}
                disabled={!participants.length}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-on-surface px-4 font-semibold text-white disabled:opacity-40"
              >
                <Download size={18} />
                Exporter
              </button>
            </div>
          </div>

          {participants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline p-6 text-center text-body-md text-on-surface-variant">
              Aucun participant inscrit.
            </div>
          ) : (
            <div className="space-y-3">
              {participants.map((participant) => (
                <ParticipantRow
                  key={participant.registrationId}
                  participant={participant}
                  busy={attendanceBusy === participant.registrationId}
                  onAttendance={(attendance) =>
                    handleAttendance(participant, attendance)
                  }
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <ConfirmationDialog
        open={cancelDialogOpen}
        title="Annuler votre inscription ?"
        description={
          summary.myStatus === 'registered'
            ? 'Votre place sera libérée et proposée automatiquement à la première personne en liste d’attente.'
            : 'Vous serez retiré de la liste d’attente.'
        }
        confirmLabel="Confirmer l’annulation"
        busy={actionBusy}
        onCancel={() => setCancelDialogOpen(false)}
        onConfirm={handleCancellation}
      />
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

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-surface-container p-4">
      <div className="text-2xl font-bold text-on-surface">{value}</div>
      <div className="mt-1 text-label-sm text-on-surface-variant">{label}</div>
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

function getRegistrationMessage(
  summary: TrainingSessionSummary,
  registrationClosed: boolean
) {
  if (summary.myStatus === 'registered') {
    return summary.myAttendance === 'present'
      ? 'Votre présence a été validée.'
      : summary.myAttendance === 'absent'
        ? 'Votre absence a été enregistrée.'
        : 'Votre place est réservée. La présence sera validée par un responsable.';
  }
  if (summary.myStatus === 'waitlisted') {
    return 'Vous serez automatiquement inscrit si une place se libère.';
  }
  if (registrationClosed) {
    return 'Les inscriptions sont closes pour cette session.';
  }
  return summary.registeredCount < summary.capacity
    ? 'Une place peut être réservée immédiatement.'
    : 'La session est complète, mais la liste d’attente reste ouverte.';
}

function getAttendanceLabel(attendance: TrainingAttendanceStatus) {
  if (attendance === 'present') {
    return 'Présent';
  }
  if (attendance === 'absent') {
    return 'Absent';
  }
  return 'À confirmer';
}

function ParticipantRow({
  participant,
  busy,
  onAttendance,
}: {
  participant: TrainingParticipant;
  busy: boolean;
  onAttendance: (attendance: TrainingAttendanceStatus) => void;
}) {
  return (
    <article className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound size={19} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-on-surface">
                {participant.displayName}
              </h3>
              <p className="text-label-sm text-on-surface-variant">
                {participant.status === 'registered'
                  ? 'Inscription confirmée'
                  : 'Liste d’attente'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-body-md text-on-surface-variant">
            <a href={`mailto:${participant.email}`} className="inline-flex items-center gap-1.5">
              <Mail size={15} />
              {participant.email}
            </a>
            {participant.phone ? (
              <a href={`tel:${participant.phone}`} className="inline-flex items-center gap-1.5">
                <Phone size={15} />
                {participant.phone}
              </a>
            ) : null}
          </div>
        </div>

        {participant.status === 'registered' ? (
          <div
            className="grid grid-cols-3 gap-1 rounded-lg bg-surface-container p-1"
            aria-label={`Présence de ${participant.displayName}`}
          >
            {attendanceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onAttendance(option.value)}
                disabled={busy}
                aria-pressed={participant.attendance === option.value}
                title={option.label}
                className={[
                  'flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 text-label-sm font-semibold disabled:opacity-50',
                  participant.attendance === option.value
                    ? 'bg-primary text-white'
                    : 'text-on-surface-variant hover:bg-surface-container-high',
                ].join(' ')}
              >
                {option.icon}
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
