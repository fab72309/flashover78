import { describe, expect, it } from 'vitest';
import { getRequestStatusLabel, getTripStatusLabel } from './statusLabels';

describe('libellés de covoiturage', () => {
  it('traduit les statuts des trajets', () => {
    expect(getTripStatusLabel('open')).toBe('Ouvert');
    expect(getTripStatusLabel('cancelled')).toBe('Annulé');
  });

  it('traduit les statuts des demandes', () => {
    expect(getRequestStatusLabel('pending')).toBe('En attente');
    expect(getRequestStatusLabel('accepted')).toBe('Acceptée');
  });
});
