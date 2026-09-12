import { useEffect, useMemo, useState } from 'react';
import {
  createEvent,
  listProfiles,
  updateEvent,
} from '../services/supabaseService';
import {
  DEFAULT_LOCATION_OPTIONS,
  TRAINER_LEVEL_LABELS,
  TRAINER_LEVELS,
  TRAINER_INITIAL_SLOT_COUNTS,
} from '../utils/constants';
import { useToast } from '../contexts/ToastContext';
import type { CalendarEvent, CalendarFormateurAssignment, Profile, TrainerLevel } from '../types';
import SearchableFormateurSelect from './SearchableFormateurSelect';

interface AddEventFormProps {
  onSuccess?: () => void;
  event?: CalendarEvent;
}

type FormateurSelections = Record<TrainerLevel, string[]>;

function createEmptyFormateurSelections(): FormateurSelections {
  return {
    RSFR: Array.from({ length: TRAINER_INITIAL_SLOT_COUNTS.RSFR }, () => ''),
    'FOR INC': Array.from({ length: TRAINER_INITIAL_SLOT_COUNTS['FOR INC'] }, () => ''),
    'FOR BAT': Array.from({ length: TRAINER_INITIAL_SLOT_COUNTS['FOR BAT'] }, () => ''),
  };
}

function createInitialFormateurSelections(event?: CalendarEvent): FormateurSelections {
  const selections = createEmptyFormateurSelections();

  for (const assignment of event?.formateurAssignments ?? []) {
    const levelSelections = selections[assignment.level];
    let emptySlot = levelSelections.indexOf('');
    if (emptySlot < 0) {
      emptySlot = levelSelections.length;
      levelSelections.push('');
    }
    levelSelections[emptySlot] = assignment.userId;
  }

  return selections;
}

function toLocalDateTimeValue(date: Date) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

export default function AddEventForm({ onSuccess, event }: AddEventFormProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [observations, setObservations] = useState(event?.observations ?? '');
  const [formateurSelections, setFormateurSelections] = useState<FormateurSelections>(
    () => createInitialFormateurSelections(event)
  );
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getDefaultTime = () => {
    const now = new Date();
    const userTimezoneOffset = now.getTimezoneOffset() * 60000;
    now.setHours(8, 0, 0, 0);
    return new Date(now.getTime() - userTimezoneOffset);
  };

  const formattedDefaultTime = event
    ? toLocalDateTimeValue(event.date)
    : getDefaultTime().toISOString().slice(0, 16);
  const [date, setDate] = useState(formattedDefaultTime);

  const legacyFormateurs = event?.formateurAssignments?.length
    ? []
    : event?.formateurs ?? [];
  const selectedUserIds = useMemo(
    () => new Set(Object.values(formateurSelections).flat().filter(Boolean)),
    [formateurSelections]
  );

  useEffect(() => {
    let isMounted = true;

    const loadProfiles = async () => {
      setProfilesLoading(true);
      setProfilesError(null);

      try {
        const nextProfiles = await listProfiles();
        if (isMounted) {
          setProfiles(nextProfiles);
        }
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Impossible de charger les fonctions formateur.';
        if (isMounted) {
          setProfilesError(message);
          showToast(message, 'error');
        }
      } finally {
        if (isMounted) {
          setProfilesLoading(false);
        }
      }
    };

    void loadProfiles();

    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const handleFormateurChange = (level: TrainerLevel, index: number, value: string) => {
    setFormateurSelections((current) => ({
      ...current,
      [level]: current[level].map((candidate, candidateIndex) => (
        candidateIndex === index ? value : candidate
      )),
    }));
  };

  const addFormateurSlot = (level: TrainerLevel) => {
    setFormateurSelections((current) => ({
      ...current,
      [level]: [...current[level], ''],
    }));
  };

  const getAvailableProfiles = (level: TrainerLevel, index: number) => {
    const selectedForThisSlot = formateurSelections[level][index];
    return profiles.filter((profile) => (
      profile.trainerLevels.includes(level)
      && (profile.id === selectedForThisSlot || !selectedUserIds.has(profile.id))
    ));
  };

  const getSelectedAssignments = (): CalendarFormateurAssignment[] => {
    return TRAINER_LEVELS.flatMap((level) => formateurSelections[level])
      .filter(Boolean)
      .map((userId) => {
        const profile = profiles.find((candidate) => candidate.id === userId);
        if (!profile) {
          throw new Error('Un formateur sélectionné n’est plus disponible. Actualisez la page.');
        }

        return {
          userId,
          displayName: profile.displayName,
          level: TRAINER_LEVELS.find((candidate) =>
            formateurSelections[candidate].includes(userId)
          ) ?? 'RSFR',
        };
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formateurAssignments = getSelectedAssignments();
      const eventInput = {
        title,
        description,
        location,
        observations,
        date: new Date(date),
        formateurs: formateurAssignments.length > 0
          ? formateurAssignments.map((assignment) => assignment.displayName)
          : legacyFormateurs,
        formateurAssignments,
        capacity: event?.capacity ?? 12,
        registrationClosesAt: event?.registrationClosesAt ?? null,
      };

      if (event) {
        await updateEvent(event.id, eventInput);
      } else {
        await createEvent(eventInput);
        setTitle('');
        setDate(getDefaultTime().toISOString().slice(0, 16));
        setDescription('');
        setLocation('');
        setObservations('');
        setFormateurSelections(createEmptyFormateurSelections());
      }
      showToast(event ? 'Événement mis à jour.' : 'Événement ajouté au calendrier.', 'success');
      onSuccess?.();
    } catch (error) {
      console.error('Error adding event:', error);
      showToast(error instanceof Error ? error.message : "Erreur lors de l'ajout de l'événement", 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "mt-1 block w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all";
  const selectClasses = "block w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-body-md text-on-surface focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 surface-card p-5">
      <div>
        <label htmlFor="title" className="block text-label-lg text-on-surface">Titre</label>
        <input
          type="text" id="title" value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClasses}
          required
          placeholder="TdL-FO | Progression PSY | Feu réel | TdL | FO"
        />
      </div>

      <div>
        <label htmlFor="date" className="block text-label-lg text-on-surface">Date et heure</label>
        <input
          type="datetime-local" id="date" value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClasses}
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-label-lg text-on-surface">Description</label>
        <textarea
          id="description" value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputClasses}
          required
          placeholder="FI SPP | FI SPV | FAE CE | FF | FMPA GPT | VIP"
        />
      </div>

      <div>
        <label htmlFor="location" className="block text-label-lg text-on-surface">Lieu de formation</label>
        <select
          id="location" value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={selectClasses}
        >
          <option value="">Sélectionner un lieu</option>
          {DEFAULT_LOCATION_OPTIONS.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="observations" className="block text-label-lg text-on-surface">Observations</label>
        <textarea
          id="observations" value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={3}
          className={inputClasses}
          placeholder="Observations supplémentaires..."
        />
      </div>

      <fieldset className="space-y-4">
        <legend className="block text-label-lg text-on-surface">Formateurs</legend>
        <p className="text-body-sm text-on-surface-variant">
          Ajoutez les formateurs par fonction avec « + ». Une personne ayant plusieurs fonctions apparaît dans chaque liste correspondante, mais ne peut être affectée qu’une seule fois à la même session.
        </p>

        {profilesLoading ? (
          <p className="rounded-lg bg-surface-container-low p-3 text-body-md text-on-surface-variant">
            Chargement des utilisateurs formateurs...
          </p>
        ) : profilesError ? (
          <p className="rounded-lg bg-red-50 p-3 text-body-md text-red-700" role="alert">
            {profilesError}
          </p>
        ) : profiles.length === 0 ? (
          <p className="rounded-lg bg-surface-container-low p-3 text-body-md text-on-surface-variant">
            Aucun utilisateur n’est encore disponible pour une affectation.
          </p>
        ) : null}

        <div className="space-y-4">
          {TRAINER_LEVELS.map((level) => (
            <div key={level} className="rounded-squircle-sm bg-surface-container-low p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-body-lg font-semibold text-on-surface">
                  {TRAINER_LEVEL_LABELS[level]}
                </h3>
                <button
                  type="button"
                  onClick={() => addFormateurSlot(level)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xl font-medium leading-none text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
                  aria-label={`Ajouter un formateur ${TRAINER_LEVEL_LABELS[level]}`}
                  title={`Ajouter un formateur ${TRAINER_LEVEL_LABELS[level]}`}
                >
                  +
                </button>
              </div>
              <div className="space-y-3">
                {formateurSelections[level].map((userId, index) => (
                  <SearchableFormateurSelect
                    key={`${level}-${index}`}
                    level={level}
                    index={index}
                    value={userId}
                    profiles={getAvailableProfiles(level, index)}
                    onChange={(value) => handleFormateurChange(level, index, value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {legacyFormateurs.length > 0 ? (
          <p className="rounded-lg bg-amber-50 p-3 text-label-sm text-amber-800">
            Cet événement contient encore les anciens noms « {legacyFormateurs.join(', ')} ». Une nouvelle affectation remplacera cette ancienne liste.
          </p>
        ) : null}
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary-gradient py-3 rounded-squircle-sm disabled:opacity-50 text-body-lg"
      >
        {loading ? 'Enregistrement...' : event ? "Enregistrer les modifications" : "Ajouter l'événement"}
      </button>
    </form>
  );
}
