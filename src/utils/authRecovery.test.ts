import { describe, expect, it } from 'vitest';
import {
  getEmailConfirmationRedirectUrl,
  getPasswordRecoveryRedirectUrl,
  getRecoveryLinkError,
  getRecoveryTokenHash,
  validateNewPassword,
} from './authRecovery';

describe('password recovery helpers', () => {
  it('builds an exact reset URL without a double slash', () => {
    expect(getPasswordRecoveryRedirectUrl('https://app.flashover78.com/')).toBe(
      'https://app.flashover78.com/reset-password'
    );
  });

  it('falls back to the canonical origin for untrusted previews', () => {
    expect(getPasswordRecoveryRedirectUrl('https://preview.example.test')).toBe(
      'https://app.flashover78.com/reset-password'
    );
    expect(getEmailConfirmationRedirectUrl('https://preview.example.test')).toBe(
      'https://app.flashover78.com/login'
    );
  });

  it('keeps local development origins available without accepting arbitrary hosts', () => {
    expect(getEmailConfirmationRedirectUrl('http://localhost:5173/')).toBe(
      'http://localhost:5173/login'
    );
  });

  it('validates password length and confirmation', () => {
    expect(validateNewPassword('court', 'court')).toContain('au moins 15');
    expect(validateNewPassword('nouveau-secret-long', 'autre-secret-long')).toBe(
      'Les mots de passe ne correspondent pas.'
    );
    expect(validateNewPassword('nouveau-secret-long', 'nouveau-secret-long')).toBeNull();
  });

  it('recognizes an expired recovery link error', () => {
    expect(
      getRecoveryLinkError(
        '?error=access_denied&error_code=otp_expired',
        '#error_description=Email+link+is+invalid'
      )
    ).toContain('invalide ou a expiré');
    expect(getRecoveryLinkError('?error=access_denied', '')).toContain(
      'invalide ou a expiré'
    );
  });

  it('only accepts a password recovery token hash', () => {
    expect(getRecoveryTokenHash('?token_hash=hashed-token&type=recovery')).toBe(
      'hashed-token'
    );
    expect(getRecoveryTokenHash('?token_hash=hashed-token&type=email')).toBeNull();
    expect(getRecoveryTokenHash('?type=recovery')).toBeNull();
  });
});
