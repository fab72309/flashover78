import type {
  AppUser,
  EquipmentRepairRequestClothing,
  EquipmentRepairRequestFormData,
  EquipmentRepairRequestKind,
  EquipmentRepairRequestLocation,
  EquipmentRepairRequestMaterial,
  EquipmentRepairRequestRecord,
} from '../types';
import { APP_ROUTES } from './constants';
import {
  DEFAULT_FORM_EMAIL_DESTINATIONS,
  isValidEmailRecipient,
  mergeEmailRecipients,
  toMailtoRecipientList,
} from './emailDestinations';

export const EQUIPMENT_REPAIR_REQUEST_ADMIN_EMAIL = DEFAULT_FORM_EMAIL_DESTINATIONS.demandeReparation[0];

export const EQUIPMENT_REPAIR_REQUEST_OPTIONS = {
  lieuxFormation: [
    'Montigny le Bretonneux',
    'Poissy',
    'Feu réel',
    'Autre :',
  ] as const satisfies readonly EquipmentRepairRequestLocation[],
  demandes: ['Matériel', 'Habillement'] as const satisfies readonly EquipmentRepairRequestKind[],
  materiel: [
    'ARI',
    'PIECE FACIALE',
    'VENTILATEUR',
    'RIDEAU STOP TIRAGE',
    'LANCE',
    'TUYAUX',
    'POMPE ELECTRIQUE',
    'Autre :',
  ] as const satisfies readonly EquipmentRepairRequestMaterial[],
  habillement: [
    'VESTE DE FEU',
    'SURPANTALON',
    'SVI HAUT',
    'SVI BAS',
    'CASQUE F1',
    'GANTS DE FEU',
    'Autre :',
  ] as const satisfies readonly EquipmentRepairRequestClothing[],
} as const;

function getLocalDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function createInitialEquipmentRepairRequestForm(
  user: AppUser | null,
): EquipmentRepairRequestFormData {
  return {
    lieuFormation: '',
    lieuFormationAutre: '',
    dateDemande: getLocalDate(),
    emailDemandeur: user?.email?.trim() ?? '',
    demandeConcerne: '',
    equipement: '',
    equipementAutre: '',
    numeroInventaire: '',
    probleme: '',
    nomDemandeur: user?.displayName?.trim() ?? '',
  };
}

export function getEquipmentRepairRequestRoute() {
  return APP_ROUTES.EQUIPMENT_REPAIR_REQUEST;
}

export function isEquipmentRepairRequestLocation(
  value: string | undefined,
): value is EquipmentRepairRequestLocation {
  return Boolean(value && EQUIPMENT_REPAIR_REQUEST_OPTIONS.lieuxFormation.includes(value as EquipmentRepairRequestLocation));
}

export function isEquipmentRepairRequestKind(
  value: string | undefined,
): value is EquipmentRepairRequestKind {
  return Boolean(value && EQUIPMENT_REPAIR_REQUEST_OPTIONS.demandes.includes(value as EquipmentRepairRequestKind));
}

export function getEquipmentRepairRequestEquipmentOptions(
  kind: EquipmentRepairRequestKind | '',
) {
  return kind === 'Matériel'
    ? EQUIPMENT_REPAIR_REQUEST_OPTIONS.materiel
    : kind === 'Habillement'
      ? EQUIPMENT_REPAIR_REQUEST_OPTIONS.habillement
      : [] as const;
}

function isEquipmentOption(value: string, kind: EquipmentRepairRequestKind) {
  return getEquipmentRepairRequestEquipmentOptions(kind).includes(value as never);
}

export function isEquipmentRepairRequestLocationWithDetails(
  location: EquipmentRepairRequestFormData['lieuFormation'],
) {
  return location === 'Autre :';
}

export function validateEquipmentRepairRequestForm(
  data: EquipmentRepairRequestFormData,
): string | null {
  if (!data.emailDemandeur.trim() || !isValidEmailRecipient(data.emailDemandeur.trim())) {
    return 'L’adresse email du demandeur est absente ou invalide.';
  }
  if (!data.dateDemande) {
    return 'Renseignez la date.';
  }
  if (!data.lieuFormation || !isEquipmentRepairRequestLocation(data.lieuFormation)) {
    return 'Sélectionnez le lieu de formation.';
  }
  if (isEquipmentRepairRequestLocationWithDetails(data.lieuFormation) && !data.lieuFormationAutre.trim()) {
    return 'Précisez le lieu de formation.';
  }
  if (!isEquipmentRepairRequestKind(data.demandeConcerne)) {
    return 'Sélectionnez si la demande concerne le matériel ou l’habillement.';
  }
  if (!data.equipement || !isEquipmentOption(data.equipement, data.demandeConcerne)) {
    return `Sélectionnez le matériel concerné pour la branche « ${data.demandeConcerne} ».`;
  }
  if (data.equipement === 'Autre :' && !data.equipementAutre.trim()) {
    return 'Précisez le matériel concerné.';
  }
  if (data.equipement !== 'Autre :' && data.equipementAutre.trim()) {
    return 'La précision du matériel ne correspond pas au choix sélectionné.';
  }
  if (!data.probleme.trim()) {
    return 'Décrivez le problème rencontré.';
  }
  if (!data.nomDemandeur.trim()) {
    return 'Renseignez le nom du demandeur.';
  }

  return null;
}

export function formatEquipmentRepairRequestDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) return dateValue;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function getEquipmentRepairRequestEquipmentLabel(
  data: Pick<EquipmentRepairRequestFormData, 'equipement' | 'equipementAutre'>,
) {
  if (data.equipement === 'Autre :' && data.equipementAutre.trim()) {
    return `Autre : ${data.equipementAutre.trim()}`;
  }

  return data.equipement || 'Non renseigné';
}

export function getEquipmentRepairRequestLocationLabel(
  data: Pick<EquipmentRepairRequestFormData, 'lieuFormation' | 'lieuFormationAutre'>,
) {
  if (data.lieuFormation === 'Autre :' && data.lieuFormationAutre.trim()) {
    return `Autre : ${data.lieuFormationAutre.trim()}`;
  }

  return data.lieuFormation || 'Non renseigné';
}

export function getEquipmentRepairRequestFilename(
  data: Pick<EquipmentRepairRequestFormData, 'demandeConcerne' | 'dateDemande'>,
) {
  const kind = data.demandeConcerne === 'Habillement' ? 'habillement' : 'materiel';
  return `demande-reparation-${kind}-${data.dateDemande || 'date'}.pdf`;
}

export function downloadEquipmentRepairRequestPdf(documentBlob: Blob, filename: string) {
  const url = URL.createObjectURL(documentBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-hidden', 'true');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function openEquipmentRepairRequestPdf(
  documentBlob: Blob,
  filename: string,
  targetWindow?: Window | null,
) {
  const url = URL.createObjectURL(documentBlob);
  const openedWindow = targetWindow && !targetWindow.closed
    ? targetWindow
    : targetWindow === undefined
      ? window.open('', '_blank', 'noopener,noreferrer')
      : null;

  if (!openedWindow) {
    const fallbackLink = document.createElement('a');
    fallbackLink.href = url;
    fallbackLink.download = filename;
    fallbackLink.target = '_self';
    fallbackLink.rel = 'noopener noreferrer';
    fallbackLink.setAttribute('aria-hidden', 'true');
    fallbackLink.style.display = 'none';
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    fallbackLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return false;
  }

  openedWindow.location.href = url;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export async function shareEquipmentRepairRequestPdf(
  documentBlob: Blob,
  filename: string,
  recipientEmails: readonly string[] = DEFAULT_FORM_EMAIL_DESTINATIONS.demandeReparation,
) {
  const recipients = mergeEmailRecipients(recipientEmails);
  const effectiveRecipients = recipients.length > 0
    ? recipients
    : [EQUIPMENT_REPAIR_REQUEST_ADMIN_EMAIL];
  const file = new File([documentBlob], filename, { type: 'application/pdf' });
  const canShareFiles = typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });

  if (canShareFiles) {
    await navigator.share({
      files: [file],
      title: 'Demande de réparation',
      text: `Demande de réparation à transmettre à ${effectiveRecipients.join(', ')}`,
    });
    return 'shared' as const;
  }

  downloadEquipmentRepairRequestPdf(documentBlob, filename);
  const subject = encodeURIComponent('Demande de réparation d’équipement');
  const body = encodeURIComponent(
    `Bonjour,\n\nVeuillez trouver en pièce jointe la demande de réparation.\n\nLa demande a été téléchargée sous le nom « ${filename} ». Ajoutez ce fichier avant l’envoi.`,
  );
  window.location.href = `mailto:${toMailtoRecipientList(effectiveRecipients)}?subject=${subject}&body=${body}`;
  return 'downloaded' as const;
}

export function getEquipmentRepairRequestEmailLabel(record: Pick<EquipmentRepairRequestRecord, 'emailStatus'>) {
  if (record.emailStatus === 'sent') return 'Email envoyé';
  if (record.emailStatus === 'sending') return 'Envoi en cours';
  if (record.emailStatus === 'failed') return 'Email à vérifier';
  return 'Email en attente';
}
