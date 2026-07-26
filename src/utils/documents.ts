import type { DocumentExpirationState, ResourceCategory } from '../types';
import { RESOURCE_CATEGORY_LABELS } from './constants';

export function getDocumentExpirationState(
  expiresAt: Date | null | undefined,
  referenceDate: Date
): Exclude<DocumentExpirationState, 'all'> {
  if (!expiresAt) {
    return 'valid';
  }

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const expiration = new Date(expiresAt);
  expiration.setHours(0, 0, 0, 0);
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  if (expiration < today) {
    return 'expired';
  }
  if (expiration <= thirtyDaysFromNow) {
    return 'expiring';
  }
  return 'valid';
}
export function getDocumentExpirationLabel(
  state: Exclude<DocumentExpirationState, 'all'>
) {
  if (state === 'expired') {
    return 'Expiré';
  }
  if (state === 'expiring') {
    return 'Expire bientôt';
  }
  return 'À jour';
}

export function getResourceCategoryLabel(category: ResourceCategory) {
  return RESOURCE_CATEGORY_LABELS[category] ?? category;
}

export function formatFileSize(size: number | null | undefined) {
  if (!size) {
    return 'Taille inconnue';
  }
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} Ko`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}
