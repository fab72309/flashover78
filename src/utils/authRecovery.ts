import { APP_ROUTES } from './constants';

const CANONICAL_AUTH_ORIGIN = 'https://app.flashover78.com';
const LOCAL_AUTH_ORIGIN_PATTERN = /^http:\/\/(?:localhost|127\.0\.0\.1):(5173|4173)$/;

// OWASP ASVS 5.0 recommends at least 15 characters when MFA is not mandatory.
// The Supabase Auth project setting must be aligned separately in production.
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

function getSafeAuthOrigin(origin: string) {
  const candidate = origin.replace(/\/+$/, '');
  return candidate === CANONICAL_AUTH_ORIGIN || LOCAL_AUTH_ORIGIN_PATTERN.test(candidate)
    ? candidate
    : CANONICAL_AUTH_ORIGIN;
}

export function getPasswordRecoveryRedirectUrl(origin: string) {
  return `${getSafeAuthOrigin(origin)}${APP_ROUTES.RESET_PASSWORD}`;
}

export function getEmailConfirmationRedirectUrl(origin: string) {
  return `${getSafeAuthOrigin(origin)}${APP_ROUTES.LOGIN}`;
}

export function getRecoveryTokenHash(search: string) {
  const params = new URLSearchParams(search);

  if (params.get('type') !== 'recovery') {
    return null;
  }

  return params.get('token_hash')?.trim() || null;
}

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }

  if (password !== confirmation) {
    return 'Les mots de passe ne correspondent pas.';
  }

  return null;
}

export function getRecoveryLinkError(search: string, hash: string) {
  const queryParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
  const error = queryParams.get('error') ?? hashParams.get('error');
  const errorCode = queryParams.get('error_code') ?? hashParams.get('error_code');
  const errorDescription =
    queryParams.get('error_description') ?? hashParams.get('error_description');

  if (!error && !errorCode && !errorDescription) {
    return null;
  }

  return 'Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien.';
}
