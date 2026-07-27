import { APP_ROUTES } from './constants';

export const PASSWORD_MIN_LENGTH = 6;

export function getPasswordRecoveryRedirectUrl(origin: string) {
  return `${origin.replace(/\/+$/, '')}${APP_ROUTES.RESET_PASSWORD}`;
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
