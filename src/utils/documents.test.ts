import { describe, expect, it } from 'vitest';
import { formatFileSize, getDocumentExpirationState } from './documents';

describe('document utilities', () => {
  const reference = new Date('2026-07-26T12:00:00');

  it('distingue les documents expirés, proches de l’échéance et valides', () => {
    expect(
      getDocumentExpirationState(new Date('2026-07-25T12:00:00'), reference)
    ).toBe('expired');
    expect(
      getDocumentExpirationState(new Date('2026-08-20T12:00:00'), reference)
    ).toBe('expiring');
    expect(
      getDocumentExpirationState(new Date('2026-10-01T12:00:00'), reference)
    ).toBe('valid');
    expect(getDocumentExpirationState(null, reference)).toBe('valid');
  });

  it('formate une taille lisible', () => {
    expect(formatFileSize(1536)).toBe('2 Ko');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 Mo');
  });
});
