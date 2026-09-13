import type {
  AppUser,
  MedicalFollowUpFormData,
  MedicalFollowUpRecord,
  TrainerLevel,
} from '../types';
import { APP_ROUTES, TRAINER_LEVEL_LABELS, TRAINER_LEVELS } from './constants';
import {
  DEFAULT_FORM_EMAIL_DESTINATIONS,
  mergeEmailRecipients,
} from './emailDestinations';

export const MEDICAL_FOLLOWUP_TEMPLATE_PATH = '/templates/suivi-medical-formateur.pdf';
export const MEDICAL_FOLLOWUP_RENDER_TEMPLATE_PATH = '/templates/suivi-medical-formateur-clean.pdf';
export const MEDICAL_FOLLOWUP_RENDER_TEMPLATE_URL = `${MEDICAL_FOLLOWUP_RENDER_TEMPLATE_PATH}?v=${encodeURIComponent(import.meta.env.VITE_APP_VERSION || 'current')}`;
export const MEDICAL_FOLLOWUP_DOCX_TEMPLATE_PATH = '/templates/suivi-medical-formateur.docx';
export const MEDICAL_FOLLOWUP_ADMIN_EMAIL = DEFAULT_FORM_EMAIL_DESTINATIONS.suiviMedical[0];
export const MEDICAL_FOLLOWUP_IMPLEMENTED_FUNCTIONS: readonly TrainerLevel[] = TRAINER_LEVELS;
export const MEDICAL_FOLLOWUP_EDIT_WINDOW_MS = 72 * 60 * 60 * 1000;

export interface MedicalFollowUpFunctionOption {
  level: TrainerLevel;
  label: string;
  implemented: boolean;
}

export function getMedicalFollowUpFunctionOptions(user: AppUser | null): MedicalFollowUpFunctionOption[] {
  return TRAINER_LEVELS
    .filter((level) => user?.trainerLevels.includes(level))
    .map((level) => ({
      level,
      label: TRAINER_LEVEL_LABELS[level],
      implemented: MEDICAL_FOLLOWUP_IMPLEMENTED_FUNCTIONS.includes(level),
    }));
}

export function canAccessMedicalFollowUp(user: AppUser | null) {
  return getMedicalFollowUpFunctionOptions(user).some((option) => option.implemented);
}

export function isMedicalFollowUpTrainerLevel(value: string | undefined): value is TrainerLevel {
  return Boolean(value && TRAINER_LEVELS.includes(value as TrainerLevel));
}

export function getMedicalFollowUpRoute(trainerLevel: TrainerLevel) {
  return `${APP_ROUTES.MEDICAL_FOLLOWUP}/${encodeURIComponent(trainerLevel)}`;
}

export const MEDICAL_FOLLOWUP_OPTIONS = {
  journee: ['Journée complète', 'Matin', 'Après-Midi'] as const,
  conditionsMeteo: ['Pluie', 'Soleil', 'Couvert', 'Neige'] as const,
  hydratation: ['0 l', '0,5 l', '1 l', '1,5 l', '2 l', '2,5 l'] as const,
  lieuFormation: ['MLB TdL / FO', 'MLB TdL', 'MLB FO', 'MLB MaF', 'Friche batimentaire', 'Autre :'] as const,
  formation: ['FI', 'FAE', 'FMPA GPT/CIS', 'Feux réels', 'FMPA Formateurs', 'Autre :'] as const,
  roleFormateur: ['RSFR', 'FOR INC', 'FOR BAT'] as const,
  typeBrulage: [
    'Observation/attaque de l’extérieur',
    'Observation de l’intérieur',
    'Tableau de bord',
    'MEA',
    'Progression / Attaque',
    'Feux réels',
  ] as const,
  tempsAri: ['30', '60', '90'] as const,
  decontamination: ['OUI', 'NON'] as const,
  douche: ['Oui', 'Non'] as const,
  observationsPostBrulage: [
    'Rien à signaler',
    'Céphalées',
    'Vertiges',
    'PC',
    'Douleurs Thoraciques',
    'Nausées',
    'Douleurs abdominales',
    'Fatigue',
    'Trouble du sommeil',
    'Stress / anxiété',
    'Syndrome infectieux',
    'Traitement en cours',
    'Autre :',
  ] as const,
};

function getConnectedTrainerIdentity(user: AppUser | null) {
  const displayNameParts = user?.displayName.trim().split(/\s+/).filter(Boolean) ?? [];
  const firstName = user?.firstName?.trim() || displayNameParts[0] || 'Utilisateur';
  const lastName = user?.lastName?.trim() || displayNameParts.slice(1).join(' ') || 'Formateur';

  return {
    firstName,
    lastName,
    email: user?.email?.trim() || '',
  };
}

export function createInitialMedicalFollowUpForm(
  user: AppUser | null,
  selectedTrainerLevel?: TrainerLevel,
): MedicalFollowUpFormData {
  const identity = getConnectedTrainerIdentity(user);
  const trainerLevel = selectedTrainerLevel
    ?? getMedicalFollowUpFunctionOptions(user)[0]?.level
    ?? 'FOR INC';
  const now = new Date();
  const localDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')]
    .join('-');

  return {
    trainerLevel,
    nomFormateur: identity.lastName,
    prenomFormateur: identity.firstName,
    emailFormateur: identity.email,
    dateFormation: localDate,
    journee: 'Journée complète',
    conditionsMeteo: '',
    temperature: '',
    hydratationAvantBrulage: '',
    hydratationApresBrulage: '',
    lieuFormation: '',
    lieuFormationAutre: '',
    formation: '',
    formationAutre: '',
    roleFormateur: trainerLevel,
    roleFormateurAutre: '',
    typeBrulage: '',
    typeBrulageAutre: '',
    tempsAri: '',
    decontaminationPostBrulage: '',
    doucheDansHeure: '',
    observationsPostBrulage: [],
    observationsPostBrulageAutre: '',
    observations: '',
  };
}

export function validateMedicalFollowUpForm(data: MedicalFollowUpFormData): string | null {
  if (!data.nomFormateur.trim() || !data.prenomFormateur.trim() || !data.emailFormateur.trim()) {
    return 'Les informations de l’utilisateur connecté sont incomplètes.';
  }
  if (!TRAINER_LEVELS.includes(data.trainerLevel)) return 'Sélectionnez une fonction valide.';
  if (!data.dateFormation) return 'Renseignez la date de la formation.';
  if (!data.journee) return 'Sélectionnez la période de la journée.';
  if (!data.conditionsMeteo) return 'Sélectionnez les conditions météo.';
  if (!data.hydratationAvantBrulage || !data.hydratationApresBrulage) {
    return 'Renseignez l’hydratation avant et après brûlage.';
  }
  if (!data.lieuFormation) return 'Sélectionnez le lieu de formation.';
  if (isMedicalFollowUpLocationWithDetails(data.lieuFormation) && !data.lieuFormationAutre.trim()) {
    return 'Précisez le lieu de formation.';
  }
  if (!data.formation) return 'Sélectionnez le type de formation.';
  if (data.formation === 'Autre :' && !data.formationAutre.trim()) {
    return 'Précisez le type de formation.';
  }
  if (!data.roleFormateur || !TRAINER_LEVELS.includes(data.roleFormateur)) {
    return 'Sélectionnez le rôle du formateur.';
  }
  if (!data.typeBrulage) return 'Sélectionnez le type de brûlage.';
  if (data.typeBrulage === 'Feux réels' && !data.typeBrulageAutre.trim()) {
    return 'Indiquez le nombre de mises à feu dans le champ prévu.';
  }
  if (!data.tempsAri) return 'Sélectionnez la durée sous ARI.';
  if (!data.decontaminationPostBrulage) return 'Renseignez la décontamination post-brûlage.';
  if (!data.doucheDansHeure) return 'Renseignez la douche dans l’heure.';
  if (data.observationsPostBrulage.length === 0) {
    return 'Sélectionnez au moins une observation post-brûlage.';
  }
  if (data.observationsPostBrulage.includes('Autre :') && !data.observationsPostBrulageAutre.trim()) {
    return 'Précisez l’observation post-brûlage supplémentaire.';
  }

  return null;
}

export function formatMedicalFollowUpDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) return dateValue;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function isMedicalFollowUpLocationWithDetails(
  location: MedicalFollowUpFormData['lieuFormation'],
) {
  return location === 'Friche batimentaire' || location === 'Autre :';
}

export function getMedicalFollowUpFilename(data: MedicalFollowUpFormData, isEvolution = false) {
  const safeName = `${data.nomFormateur}-${data.prenomFormateur}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'formateur';

  const prefix = isEvolution ? 'evolution-suivi-medical' : 'suivi-medical-formateur';
  return `${prefix}-${safeName}-${data.dateFormation || 'date'}.pdf`;
}

export function isMedicalFollowUpEvolution(
  record: Pick<MedicalFollowUpRecord, 'createdAt' | 'updatedAt'>,
) {
  return record.updatedAt.getTime() - record.createdAt.getTime() > 1000;
}

export function canEditMedicalFollowUp(
  record: Pick<MedicalFollowUpRecord, 'createdAt'>,
  now = new Date(),
) {
  return now.getTime() <= record.createdAt.getTime() + MEDICAL_FOLLOWUP_EDIT_WINDOW_MS;
}

export function getMedicalFollowUpEditRemainingMs(
  record: Pick<MedicalFollowUpRecord, 'createdAt'>,
  now = new Date(),
) {
  return Math.max(0, record.createdAt.getTime() + MEDICAL_FOLLOWUP_EDIT_WINDOW_MS - now.getTime());
}

export function downloadMedicalFollowUp(documentBlob: Blob, filename: string) {
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
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function shareMedicalFollowUp(
  documentBlob: Blob,
  filename: string,
  recipientEmail: string,
  additionalRecipientEmails: readonly string[] = DEFAULT_FORM_EMAIL_DESTINATIONS.suiviMedical,
) {
  const recipients = mergeEmailRecipients([recipientEmail], additionalRecipientEmails);
  const file = new File([documentBlob], filename, {
    type: 'application/pdf',
  });
  const canShareFiles = typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });

  if (canShareFiles) {
    await navigator.share({
      files: [file],
      title: 'Suivi médical formateur',
      text: 'Fiche de suivi médical formateur',
    });
    return 'shared' as const;
  }

  downloadMedicalFollowUp(documentBlob, filename);
  const recipientList = recipients.join(',');
  const subject = encodeURIComponent('Suivi médical formateur');
  const body = encodeURIComponent(
    'La fiche a été téléchargée. Ajoutez le fichier en pièce jointe avant d’envoyer ce message.',
  );
  window.location.href = `mailto:${recipientList}?subject=${subject}&body=${body}`;
  return 'downloaded' as const;
}

export function openMedicalFollowUpPdf(
  documentBlob: Blob,
  filename: string,
  targetWindow?: Window | null,
) {
  const url = URL.createObjectURL(documentBlob);
  const openedWindow = targetWindow && !targetWindow.closed
    ? targetWindow
    : targetWindow === undefined
      ? window.open('', '_blank')
      : null;

  if (!openedWindow) {
    // Mobile browsers may block a second window after an async PDF build and
    // may ignore the download attribute for blob URLs. A same-tab link is the
    // reliable last resort: browsers that support downloads save the file,
    // while mobile PDF viewers display it and offer Save/Share actions.
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
