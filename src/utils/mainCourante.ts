import type {
  AppUser,
  MainCouranteCartState,
  MainCouranteFormData,
  MainCouranteFricheSession,
  MainCouranteMontignySession,
  MainCouranteQuantity,
  MainCouranteSession,
  MainCouranteSite,
  MainCouranteTraining,
  MainCouranteWasteLevel,
  MainCouranteWeather,
  MainCouranteWindDirection,
  MainCouranteWindStrength,
  MedicalFollowUpBurningType,
  MedicalFollowUpLocation,
  TrainerLevel,
} from '../types';
import {
  APP_ROUTES,
  TRAINER_INITIAL_SLOT_COUNTS,
  TRAINER_LEVELS,
} from './constants';
import {
  DEFAULT_FORM_EMAIL_DESTINATIONS,
  mergeEmailRecipients,
} from './emailDestinations';
import { MEDICAL_FOLLOWUP_OPTIONS } from './medicalFollowUp';

export const MAIN_COURANTE_ADMIN_EMAIL = DEFAULT_FORM_EMAIL_DESTINATIONS.mainCourante[0];
export const MAIN_COURANTE_RENDER_TEMPLATE_URL = '/templates/main-courante.pdf';

export const MAIN_COURANTE_SITES = [
  'Montigny le Bretonneux',
  'Feux réels en friche bâtimentaire',
] as const satisfies readonly MainCouranteSite[];

export const MAIN_COURANTE_WIND_STRENGTHS = ['1', '2', '3', '4', '5'] as const satisfies readonly MainCouranteWindStrength[];
export const MAIN_COURANTE_WIND_DIRECTIONS = ['Arrière', 'Avant', 'Latéral'] as const satisfies readonly MainCouranteWindDirection[];
export const MAIN_COURANTE_WEATHER = ['Pluie', 'Soleil', 'Couvert', 'Neige'] as const satisfies readonly MainCouranteWeather[];
export const MAIN_COURANTE_QUANTITIES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const satisfies readonly MainCouranteQuantity[];
export const MAIN_COURANTE_WASTE_LEVELS = ['1', '2', '3', '4', '5'] as const satisfies readonly MainCouranteWasteLevel[];
export const MAIN_COURANTE_CART_STATES = ['Vide', 'OK'] as const satisfies readonly MainCouranteCartState[];
export const MAIN_COURANTE_LIEU_FORMATION_OPTIONS = MEDICAL_FOLLOWUP_OPTIONS.lieuFormation satisfies readonly MedicalFollowUpLocation[];
export const MAIN_COURANTE_TYPE_BRULAGE_OPTIONS = MEDICAL_FOLLOWUP_OPTIONS.typeBrulage satisfies readonly MedicalFollowUpBurningType[];

export const MAIN_COURANTE_SESSIONS = {
  'Montigny le Bretonneux': MEDICAL_FOLLOWUP_OPTIONS.journee satisfies readonly MainCouranteMontignySession[],
  'Feux réels en friche bâtimentaire': [
    'FI',
    'FAE',
    'FMA',
    'FMA formateurs',
  ] as const satisfies readonly MainCouranteFricheSession[],
} as const;

export const MAIN_COURANTE_FORMATIONS = {
  'Montigny le Bretonneux': MEDICAL_FOLLOWUP_OPTIONS.formation,
  'Feux réels en friche bâtimentaire': [] as const,
} as const satisfies Record<MainCouranteSite, readonly MainCouranteTraining[]>;

export const MAIN_COURANTE_INITIAL_FORMATEUR_ROLES: readonly TrainerLevel[] = [
  ...Array.from({ length: TRAINER_INITIAL_SLOT_COUNTS.RSFR }, () => 'RSFR' as const),
  ...Array.from({ length: TRAINER_INITIAL_SLOT_COUNTS['FOR INC'] }, () => 'FOR INC' as const),
  ...Array.from({ length: TRAINER_INITIAL_SLOT_COUNTS['FOR BAT'] }, () => 'FOR BAT' as const),
];

export function getMainCouranteRoute() {
  return APP_ROUTES.MAIN_COURANTE;
}

export function isMainCouranteSite(value: string | undefined): value is MainCouranteSite {
  return Boolean(value && MAIN_COURANTE_SITES.includes(value as MainCouranteSite));
}

export function getMainCouranteTypeSessionOptions(site: MainCouranteSite | ''): readonly MainCouranteSession[] {
  return site ? MAIN_COURANTE_SESSIONS[site] : [];
}

export function getMainCouranteFormationOptions(site: MainCouranteSite | ''): readonly MainCouranteTraining[] {
  return site ? MAIN_COURANTE_FORMATIONS[site] : [];
}

function getConnectedEmail(user: AppUser | null) {
  return user?.email?.trim() ?? '';
}

function getLocalDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function createInitialMainCouranteForm(user: AppUser | null): MainCouranteFormData {
  return {
    emailFormateur: getConnectedEmail(user),
    dateMainCourante: getLocalDate(),
    vent: '',
    sensDuVent: '',
    meteo: [],
    formateurs: MAIN_COURANTE_INITIAL_FORMATEUR_ROLES.map(() => ''),
    formateurRoles: [...MAIN_COURANTE_INITIAL_FORMATEUR_ROLES],
    siteFormation: '',
    lieuFormation: '',
    lieuFormationAutre: '',
    typeBrulage: '',
    typeBrulageAutre: '',
    typeSession: '',
    formation: '',
    formationAutre: '',
    citerneGaz: '',
    panneauxBois: '',
    palettes: '',
    masquesFfp3: '',
    gantsNitrile: '',
    benneDechet: '',
    chariotFoyerDemarrage: [],
    observationsDifficultes: '',
    reparationsMateriel: '',
  };
}

function isQuantity(value: string): value is MainCouranteQuantity {
  return MAIN_COURANTE_QUANTITIES.includes(value as MainCouranteQuantity);
}

function isWasteLevel(value: string): value is MainCouranteWasteLevel {
  return MAIN_COURANTE_WASTE_LEVELS.includes(value as MainCouranteWasteLevel);
}

export function validateMainCouranteForm(data: MainCouranteFormData): string | null {
  if (!data.emailFormateur.trim()) {
    return 'L’adresse email du formateur connecté est introuvable.';
  }
  if (!data.dateMainCourante) {
    return 'Renseignez la date de la main courante.';
  }
  if (!data.siteFormation) {
    return 'Sélectionnez le site de formation.';
  }
  if (!isMainCouranteSite(data.siteFormation)) {
    return 'Sélectionnez un site de formation valide.';
  }
  if (data.vent && !MAIN_COURANTE_WIND_STRENGTHS.includes(data.vent)) {
    return 'Sélectionnez une force de vent valide.';
  }
  if (data.sensDuVent && !MAIN_COURANTE_WIND_DIRECTIONS.includes(data.sensDuVent)) {
    return 'Sélectionnez un sens du vent valide.';
  }
  if (data.meteo.some((weather) => !MAIN_COURANTE_WEATHER.includes(weather))) {
    return 'Sélectionnez une météo valide.';
  }
  if (data.formateurs.length < MAIN_COURANTE_INITIAL_FORMATEUR_ROLES.length
    || data.formateurRoles.length !== data.formateurs.length) {
    return 'Les huit emplacements initiaux de formateur doivent être présents.';
  }
  const normalizedFormateurs = new Set<string>();
  for (let index = 0; index < data.formateurs.length; index += 1) {
    const name = data.formateurs[index].trim();
    const role = data.formateurRoles[index];
    if (name && !role) {
      return `Sélectionnez la fonction du formateur N°${index + 1}.`;
    }
    if (role && !TRAINER_LEVELS.includes(role)) {
      return `La fonction du formateur N°${index + 1} est invalide.`;
    }
    if (name) {
      const normalizedName = name.toLocaleLowerCase();
      if (normalizedFormateurs.has(normalizedName)) {
        return 'Un même formateur ne peut être renseigné plusieurs fois.';
      }
      normalizedFormateurs.add(normalizedName);
    }
  }
  if (!data.typeSession) {
    return 'Sélectionnez le type de session.';
  }
  if (!getMainCouranteTypeSessionOptions(data.siteFormation).includes(data.typeSession)) {
    return 'Le type de session ne correspond pas au site sélectionné.';
  }

  const formationOptions = getMainCouranteFormationOptions(data.siteFormation);
  if (formationOptions.length > 0 && !data.formation) {
    return 'Sélectionnez la formation.';
  }
  if (data.formation && !formationOptions.includes(data.formation)) {
    return 'La formation ne correspond pas au site sélectionné.';
  }
  if (data.formation === 'Autre :' && !data.formationAutre.trim()) {
    return 'Précisez la formation concernée.';
  }
  if (data.formation !== 'Autre :' && data.formationAutre.trim()) {
    return 'La précision de formation ne correspond pas au choix sélectionné.';
  }
  if (!data.lieuFormation) {
    return 'Sélectionnez le lieu de formation.';
  }
  if (!MAIN_COURANTE_LIEU_FORMATION_OPTIONS.includes(data.lieuFormation)) {
    return 'Sélectionnez un lieu de formation valide.';
  }
  const locationNeedsDetails = data.lieuFormation === 'Friche batimentaire' || data.lieuFormation === 'Autre :';
  if (locationNeedsDetails && !data.lieuFormationAutre.trim()) {
    return 'Précisez le lieu de formation.';
  }
  if (!locationNeedsDetails && data.lieuFormationAutre.trim()) {
    return 'La précision de lieu ne correspond pas au choix sélectionné.';
  }
  if (!data.typeBrulage) {
    return 'Sélectionnez le type de brûlage.';
  }
  if (!MAIN_COURANTE_TYPE_BRULAGE_OPTIONS.includes(data.typeBrulage)) {
    return 'Sélectionnez un type de brûlage valide.';
  }
  if (data.typeBrulage === 'Feux réels' && !data.typeBrulageAutre.trim()) {
    return 'Indiquez le nombre de mises à feu dans le champ prévu.';
  }
  if (data.typeBrulage !== 'Feux réels' && data.typeBrulageAutre.trim()) {
    return 'La précision de brûlage ne correspond pas au choix sélectionné.';
  }
  if (data.citerneGaz && !isQuantity(data.citerneGaz)) {
    return 'La quantité de citerne de gaz est invalide.';
  }
  if (data.panneauxBois && !isQuantity(data.panneauxBois)) {
    return 'La quantité de panneaux de bois est invalide.';
  }
  if (data.palettes && !isQuantity(data.palettes)) {
    return 'La quantité de palettes est invalide.';
  }
  if (data.masquesFfp3 && !isQuantity(data.masquesFfp3)) {
    return 'La quantité de masques FFP3 est invalide.';
  }
  if (data.gantsNitrile && !isQuantity(data.gantsNitrile)) {
    return 'La quantité de gants Nitrile est invalide.';
  }
  if (data.benneDechet && !isWasteLevel(data.benneDechet)) {
    return 'Le niveau de la benne à déchets est invalide.';
  }
  if (data.chariotFoyerDemarrage.some((state) => !MAIN_COURANTE_CART_STATES.includes(state))) {
    return 'L’état du chariot foyer de démarrage est invalide.';
  }

  return null;
}

export function formatMainCouranteDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) return dateValue;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function getMainCouranteFilename(data: Pick<MainCouranteFormData, 'siteFormation' | 'dateMainCourante'>) {
  const site = (data.siteFormation || 'site')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'site';

  return `main-courante-${site}-${data.dateMainCourante || 'date'}.pdf`;
}

export function downloadMainCourantePdf(documentBlob: Blob, filename: string) {
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

export function openMainCourantePdf(
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

export async function shareMainCourantePdf(
  documentBlob: Blob,
  filename: string,
  recipientEmails: readonly string[] = DEFAULT_FORM_EMAIL_DESTINATIONS.mainCourante,
  repairRecipientEmails: readonly string[] = [],
) {
  const recipients = mergeEmailRecipients(recipientEmails, repairRecipientEmails);
  const effectiveRecipients = recipients.length > 0 ? recipients : [MAIN_COURANTE_ADMIN_EMAIL];
  const recipientLabel = effectiveRecipients.join(', ');
  const file = new File([documentBlob], filename, { type: 'application/pdf' });
  const canShareFiles = typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });

  if (canShareFiles) {
    await navigator.share({
      files: [file],
      title: 'Main courante',
      text: `Main courante à transmettre à ${recipientLabel}`,
    });
    return 'shared' as const;
  }

  downloadMainCourantePdf(documentBlob, filename);
  const subject = encodeURIComponent('Main courante groupe de formateurs incendie de structure');
  const body = encodeURIComponent(
    `Bonjour,\n\nVeuillez trouver en pièce jointe la main courante.\n\nLa main courante a été téléchargée sous le nom « ${filename} ». Ajoutez ce fichier avant l’envoi.`,
  );
  window.location.href = `mailto:${effectiveRecipients.join(',')}?subject=${subject}&body=${body}`;
  return 'downloaded' as const;
}
