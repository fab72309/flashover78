import type {
  CarpoolMatchStatus,
  CarpoolPostKind,
  CarpoolPostStatus,
  CarpoolRequestStatus,
  CarpoolTripStatus,
} from '../types';

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

const postKindLabels: Record<CarpoolPostKind, string> = {
  offer: 'Offre de places',
  need: 'Besoin de trajet',
};

const postStatusLabels: Record<CarpoolPostStatus, string> = {
  open: 'Ouverte',
  partially_matched: 'Partiellement associée',
  matched: 'Associée',
  completed: 'Terminée',
  cancelled: 'Annulée',
  expired: 'Expirée',
};

const matchStatusLabels: Record<CarpoolMatchStatus, string> = {
  pending: 'En attente',
  accepted: 'Validée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
};

export function getTripStatusLabel(status: CarpoolTripStatus) {
  return tripStatusLabels[status];
}

export function getRequestStatusLabel(status: CarpoolRequestStatus) {
  return requestStatusLabels[status];
}

export function getCarpoolPostKindLabel(kind: CarpoolPostKind) {
  return postKindLabels[kind];
}

export function getCarpoolPostStatusLabel(status: CarpoolPostStatus) {
  return postStatusLabels[status];
}

export function getCarpoolMatchStatusLabel(status: CarpoolMatchStatus) {
  return matchStatusLabels[status];
}
