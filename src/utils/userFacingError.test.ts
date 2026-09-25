import { describe, expect, it } from 'vitest';
import { getUserFacingError } from './userFacingError';

describe('user-facing error sanitization', () => {
  it('keeps short application validation messages', () => {
    expect(getUserFacingError(new Error('Le fichier est trop volumineux.'), 'Réessayez.'))
      .toBe('Le fichier est trop volumineux.');
  });

  it('hides provider, SQL and markup details', () => {
    const fallback = 'Opération impossible.';
    expect(getUserFacingError(new Error('PostgREST: column password failed at https://db.example.test'), fallback))
      .toBe(fallback);
    expect(getUserFacingError(new Error('<img src=x onerror=alert(1)>'), fallback))
      .toBe(fallback);
  });
});
