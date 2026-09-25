import { describe, expect, it } from 'vitest';
import { normalizeAuthError } from './authErrors';

describe('normalizeAuthError', () => {
  it('does not reveal whether an account already exists', () => {
    expect(normalizeAuthError('User already registered').message).not.toMatch(/déjà utilisée/i);
  });

  it('does not expose unknown provider details', () => {
    expect(normalizeAuthError('internal database host=secret').message).toBe(
      "Une erreur d'authentification est survenue. Réessayez plus tard."
    );
  });

  it('does not enumerate accounts through unconfirmed-email responses', () => {
    expect(normalizeAuthError('Email not confirmed').message).toBe(
      'Email ou mot de passe incorrect'
    );
  });

  it('does not disclose the provider email allowlist', () => {
    expect(normalizeAuthError('Email address not authorized').message).toBe(
      'Impossible de traiter cette demande pour le moment.'
    );
  });
});
