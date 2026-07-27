import { describe, expect, it } from 'vitest';
import {
  getPasswordRecoveryRedirectUrl,
  getRecoveryLinkError,
  validateNewPassword,
} from './authRecovery';

describe('password recovery helpers', () => {
  it('builds an exact reset URL without a double slash', () => {
    expect(getPasswordRecoveryRedirectUrl('https://app.flashover78.com/')).toBe(
      'https://app.flashover78.com/reset-password'
    );
  });

  it('validates password length and confirmation', () => {
    expect(validateNewPassword('court', 'court')).toContain('au moins 6');
    expect(validateNewPassword('nouveau-secret', 'autre-secret')).toBe(
      'Les mots de passe ne correspondent pas.'
    );
    expect(validateNewPassword('nouveau-secret', 'nouveau-secret')).toBeNull();
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
});
