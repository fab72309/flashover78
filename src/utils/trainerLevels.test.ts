import { describe, expect, it } from 'vitest';
import { normalizeTrainerLevels, sortTrainerAssignments } from './trainerLevels';

describe('trainer levels', () => {
  it('defaults existing or incomplete profiles to RSFR', () => {
    expect(normalizeTrainerLevels(undefined)).toEqual(['RSFR']);
    expect(normalizeTrainerLevels([])).toEqual(['RSFR']);
    expect(normalizeTrainerLevels(['unknown'])).toEqual(['RSFR']);
  });

  it('keeps multiple functions in the declared hierarchy', () => {
    expect(normalizeTrainerLevels(['FOR BAT', 'RSFR', 'FOR INC'])).toEqual([
      'RSFR',
      'FOR INC',
      'FOR BAT',
    ]);
  });

  it('sorts calendar assignments from RSFR to FOR BAT', () => {
    const assignments = [
      { userId: 'bat', displayName: 'Formateur BAT', level: 'FOR BAT' as const },
      { userId: 'inc', displayName: 'Formateur INC', level: 'FOR INC' as const },
      { userId: 'rsfr', displayName: 'Responsable', level: 'RSFR' as const },
    ];

    expect(sortTrainerAssignments(assignments).map((assignment) => assignment.level)).toEqual([
      'RSFR',
      'FOR INC',
      'FOR BAT',
    ]);
  });
});
