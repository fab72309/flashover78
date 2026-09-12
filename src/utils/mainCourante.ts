import type {
  AppUser,
  MainCouranteCartState,
  MainCouranteFormData,
  MainCouranteFricheSession,
  MainCouranteMontignySession,
  MainCourantePoissySession,
  MainCouranteQuantity,
  MainCouranteSession,
  MainCouranteSite,
  MainCouranteTraining,
  MainCouranteWasteLevel,
  MainCouranteWeather,
  MainCouranteWindDirection,
  MainCouranteWindStrength,
} from '../types';
import { APP_ROUTES } from './constants';

export const MAIN_COURANTE_ADMIN_EMAIL = 'flashover78@gmail.com';

export const MAIN_COURANTE_SITES = [
  'Montigny le Bretonneux',
  'Poissy',
  'Feux réels en friche bâtimentaire',
] as const satisfies readonly MainCouranteSite[];

export const MAIN_COURANTE_WIND_STRENGTHS = ['1', '2', '3', '4', '5'] as const satisfies readonly MainCouranteWindStrength[];
export const MAIN_COURANTE_WIND_DIRECTIONS = ['Arrière', 'Avant', 'Latéral'] as const satisfies readonly MainCouranteWindDirection[];
export const MAIN_COURANTE_WEATHER = ['Pluie', 'Soleil', 'Couvert', 'Neige'] as const satisfies readonly MainCouranteWeather[];
export const MAIN_COURANTE_QUANTITIES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const satisfies readonly MainCouranteQuantity[];
export const MAIN_COURANTE_WASTE_LEVELS = ['1', '2', '3', '4', '5'] as const satisfies readonly MainCouranteWasteLevel[];
export const MAIN_COURANTE_CART_STATES = ['Vide', 'OK'] as const satisfies readonly MainCouranteCartState[];

export const MAIN_COURANTE_FORMATEUR_OPTIONS = [
  'BOUHOUR Sylvie',
  'BOURJAILLAT Stéphane',
  'BRETEAU Alexandre',
  'CATUTEL Flavien',
  'CHEVAL Camille',
  'DANIEAU Stephane',
  'DAVID Benoit',
  'DE ABREU LOPES Fabien',
  'DELARUE Alexandre',
  'DUISIT Mickael',
  'FRANCOIS Aurélien',
  'GRIMAUD Alexis',
  'GUILBERT Thierry',
  'HALOPE Fabrice',
  'KHELLAFI Brahim',
  'LE GUELAFF Marc',
  'LEROY Xavier',
  'LOUP Fabien',
  'LORILLOU Rodolphe',
  'MOREL Romain',
  'NOURAEI Chloé',
  'PAILLOTET Romain',
  'PAPE David',
  'PERRAULT Antoine',
  'RENVOISE Maxime',
  'RIBEIRO KEVIN',
  'SAINTILAN Quentin',
  'SASSIER Nicolas',
  'SILVA Francisco',
  'TERARD Fabien',
  'THEVENOT Nicolas',
  'VALENTIN Yann',
] as const;

export const MAIN_COURANTE_SESSIONS = {
  'Montigny le Bretonneux': [
    '1/2 journée TdL',
    '1/2 journée FO',
    'Journée TdL / FO',
  ] as const satisfies readonly MainCouranteMontignySession[],
  Poissy: [
    '1/2 journée Progression',
    'Journée Progression',
    'Journée MEA',
  ] as const satisfies readonly MainCourantePoissySession[],
  'Feux réels en friche bâtimentaire': [
    'FI',
    'FAE',
    'FMA',
    'FMA formateurs',
  ] as const satisfies readonly MainCouranteFricheSession[],
} as const;

export const MAIN_COURANTE_FORMATIONS = {
  'Montigny le Bretonneux': [
    'FI SPV',
    'FI SPP',
    'FAE CE',
    'FMPA',
    'FMPA Formateur',
    'Formation de formateurs',
  ] as const,
  Poissy: [
    'FI SPV',
    'FI SPP',
    'FAE CE',
    'MEA',
    'FMPA',
    'FMPA Formateur',
    'Formation de formateurs',
  ] as const,
  'Feux réels en friche bâtimentaire': [] as const,
} as const satisfies Record<MainCouranteSite, readonly MainCouranteTraining[]>;

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
    formateurs: ['', '', '', '', ''],
    siteFormation: '',
    typeSession: '',
    formation: '',
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
  if (data.vent && !MAIN_COURANTE_WIND_STRENGTHS.includes(data.vent)) {
    return 'Sélectionnez une force de vent valide.';
  }
  if (data.sensDuVent && !MAIN_COURANTE_WIND_DIRECTIONS.includes(data.sensDuVent)) {
    return 'Sélectionnez un sens du vent valide.';
  }
  if (data.meteo.some((weather) => !MAIN_COURANTE_WEATHER.includes(weather))) {
    return 'Sélectionnez une météo valide.';
  }
  if (data.formateurs.length !== 5) {
    return 'Les cinq emplacements de formateur doivent être présents.';
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

export async function shareMainCourantePdf(documentBlob: Blob, filename: string) {
  const file = new File([documentBlob], filename, { type: 'application/pdf' });
  const canShareFiles = typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });

  if (canShareFiles) {
    await navigator.share({
      files: [file],
      title: 'Main courante',
      text: `Main courante à transmettre à ${MAIN_COURANTE_ADMIN_EMAIL}`,
    });
    return 'shared' as const;
  }

  downloadMainCourantePdf(documentBlob, filename);
  const subject = encodeURIComponent('Main courante groupe de formateurs incendie de structure');
  const body = encodeURIComponent(
    `Bonjour,\n\nVeuillez trouver en pièce jointe la main courante.\n\nLa main courante a été téléchargée sous le nom « ${filename} ». Ajoutez ce fichier avant l’envoi.`,
  );
  window.location.href = `mailto:${MAIN_COURANTE_ADMIN_EMAIL}?subject=${subject}&body=${body}`;
  return 'downloaded' as const;
}
