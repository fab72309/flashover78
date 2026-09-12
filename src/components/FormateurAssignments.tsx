import type { CalendarFormateurAssignment, TrainerLevel } from '../types';
import { TRAINER_LEVEL_LABELS, TRAINER_LEVELS } from '../utils/constants';
import { sortTrainerAssignments } from '../utils/trainerLevels';

interface FormateurAssignmentsProps {
  assignments?: CalendarFormateurAssignment[];
  legacyFormateurs?: string[];
  levelFilter?: TrainerLevel | 'all';
  compact?: boolean;
}

export default function FormateurAssignments({
  assignments = [],
  legacyFormateurs = [],
  levelFilter = 'all',
  compact = false,
}: FormateurAssignmentsProps) {
  const visibleAssignments = sortTrainerAssignments(assignments).filter((assignment) => (
    levelFilter === 'all' || assignment.level === levelFilter
  ));

  if (!visibleAssignments.length) {
    if (levelFilter === 'all' && legacyFormateurs.length > 0) {
      return (
        <div className={compact ? 'text-label-sm text-on-surface-variant' : 'text-body-md text-on-surface-variant'}>
          <span className="font-semibold text-on-surface">Formateurs : </span>
          {legacyFormateurs.join(', ')}
        </div>
      );
    }

    return null;
  }

  return (
    <div
      className={compact ? 'space-y-1.5' : 'space-y-2'}
      aria-label="Formateurs classés par fonction"
    >
      <div className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
        Formateurs
      </div>
      {TRAINER_LEVELS.map((level) => {
        const levelAssignments = visibleAssignments.filter((assignment) => assignment.level === level);
        if (!levelAssignments.length) {
          return null;
        }

        return (
          <div key={level} className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-label-sm font-semibold text-primary">
              {TRAINER_LEVEL_LABELS[level]}
            </span>
            <span className={compact ? 'text-label-sm text-on-surface' : 'text-body-md text-on-surface'}>
              {levelAssignments.map((assignment) => assignment.displayName).join(', ')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
