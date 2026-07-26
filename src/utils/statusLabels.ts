import type { CarpoolRequestStatus, CarpoolTripStatus } from '../types';

const tripStatusLabels: Record<CarpoolTripStatus, string> = {
  open: 'Ouvert',
  full: 'Complet',
  cancelled: 'Annulé',
  completed: 'Terminé',
};

const requestStatusLabels: Record<CarpoolRequestStatus, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
};

export function getTripStatusLabel(status: CarpoolTripStatus) {
  return tripStatusLabels[status];
}

export function getRequestStatusLabel(status: CarpoolRequestStatus) {
  return requestStatusLabels[status];
}
