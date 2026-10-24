import type { CalendarFormateurAssignment, TrainerLevel } from '../types';
import { TRAINER_LEVELS } from './constants';

const trainerLevelRank = new Map<TrainerLevel, number>(
  TRAINER_LEVELS.map((level, index) => [level, index])
);

export function normalizeTrainerLevels(value: unknown): TrainerLevel[] {
  // Trainer functions are administrative qualifications, not a default role.
  // A newly created or incomplete profile must therefore remain unqualified
  // until an administrator explicitly assigns one or more levels.
  const candidates = Array.isArray(value) ? value : [];
  const normalized = TRAINER_LEVELS.filter((level) =>
    candidates.some((candidate) => String(candidate).trim().toUpperCase() === level)
  );

  return normalized;
}

export function sortTrainerAssignments(
  assignments: CalendarFormateurAssignment[]
): CalendarFormateurAssignment[] {
  return assignments
    .map((assignment, index) => ({ assignment, index }))
    .sort((a, b) => {
      const levelOrder =
        (trainerLevelRank.get(a.assignment.level) ?? Number.MAX_SAFE_INTEGER)
        - (trainerLevelRank.get(b.assignment.level) ?? Number.MAX_SAFE_INTEGER);

      return levelOrder || a.index - b.index;
    })
    .map(({ assignment }) => assignment);
}

export function hasTrainerLevel(
  trainerLevels: readonly TrainerLevel[] | null | undefined,
  level: TrainerLevel
) {
  return Boolean(trainerLevels?.includes(level));
}
