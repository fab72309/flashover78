export const LOGO_PATHS = {
  default: '/images/logo-sapeurs-pompiers.png',
  fallback: '/images/logo-sapeurs-pompiers.png',
} as const;

export const TABLES = {
  PROFILES: 'profiles',
  PROFILE_DIRECTORY: 'profile_directory',
  EVENTS: 'events',
  RESOURCES: 'resources',
  CARPOOL_TRIPS: 'carpool_trips',
  CARPOOL_REQUESTS: 'carpool_requests',
  CARPOOL_POSTS: 'carpool_posts',
  CARPOOL_MATCHES: 'carpool_matches',
  TRAINING_REGISTRATIONS: 'training_registrations',
  TRAINING_AUDIT_LOG: 'training_audit_log',
  MEDICAL_FOLLOW_UPS: 'medical_follow_ups',
  MAIN_COURANTES: 'main_courantes',
  EMAIL_DESTINATIONS: 'email_destinations',
} as const;

export const STORAGE_BUCKETS = {
  SDIS78_DOCUMENTS: 'sdis78-documents',
  LECTURES_DOCUMENTS: 'lectures-documents',
  BRULAGE_DOCUMENTS: 'brulage-documents',
  MAIN_COURANTES: 'main-courantes',
  RESOURCES: 'resources',
} as const;

export const RESOURCE_CATEGORY_BUCKET: Record<string, string> = {
  SDIS78: STORAGE_BUCKETS.SDIS78_DOCUMENTS,
  LECTURES: STORAGE_BUCKETS.LECTURES_DOCUMENTS,
  AUTRE: STORAGE_BUCKETS.RESOURCES,
  GDO_GTO: STORAGE_BUCKETS.RESOURCES,
  BRULAGE_TDL_FO: STORAGE_BUCKETS.BRULAGE_DOCUMENTS,
  BRULAGE_MAF: STORAGE_BUCKETS.BRULAGE_DOCUMENTS,
};

export const RESOURCE_CATEGORY_FOLDER: Partial<Record<string, string>> = {
  BRULAGE_TDL_FO: 'tdl-fo',
  BRULAGE_MAF: 'maf',
};

export const RESOURCE_CATEGORY_LABELS: Record<string, string> = {
  SDIS78: 'Documents SDIS 78',
  GDO_GTO: 'GDO / GTO',
  LECTURES: 'Lectures',
  AUTRE: 'Autre',
  BRULAGE_TDL_FO: 'Brûlage TDL / FO',
  BRULAGE_MAF: 'Brûlage MaF',
};

export const CARPOOL_TRIP_STATUSES = ['open', 'full', 'cancelled', 'completed'] as const;
export const CARPOOL_REQUEST_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'] as const;
export const CARPOOL_POST_KINDS = ['offer', 'need'] as const;
export const CARPOOL_POST_STATUSES = [
  'open',
  'partially_matched',
  'matched',
  'completed',
  'cancelled',
  'expired',
] as const;
export const CARPOOL_MATCH_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'] as const;

export const TRAINER_LEVELS = ['RSFR', 'FOR INC', 'FOR BAT'] as const;
export const TRAINER_LEVEL_LABELS: Record<(typeof TRAINER_LEVELS)[number], string> = {
  RSFR: 'RSFR',
  'FOR INC': 'FOR INC',
  'FOR BAT': 'FOR BAT',
};
export const TRAINER_LEVEL_DESCRIPTIONS: Record<(typeof TRAINER_LEVELS)[number], string> = {
  RSFR: 'Responsable, Sécurité Feu Réel',
  'FOR INC': 'Formateur incendie',
  'FOR BAT': 'Formateur Binôme d’Attaque',
};
export const TRAINER_INITIAL_SLOT_COUNTS: Record<(typeof TRAINER_LEVELS)[number], number> = {
  RSFR: 2,
  'FOR INC': 2,
  'FOR BAT': 4,
};

export const DEFAULT_FORMATEUR_OPTIONS = [
  'Formateur A',
  'Formateur B',
  'Formateur C',
  'Formateur D',
  'Formateur E',
  'Formateur F',
  'Formateur G',
] as const;

export const DEFAULT_LOCATION_OPTIONS = [
  'Plateau technique Caissons',
  'Plateau technique MaF',
  'Salle de cours MLB',
  'Salle de cours CFD',
  'Friche batimentaire (Préciser le lieux)',
  'Autre',
];

export const APP_ROUTES = {
  HOME: '/app',
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  CALENDAR: '/app/calendar',
  CALENDAR_ADD: '/app/calendar/add',
  TRAINING_SESSION: '/app/calendar/session',
  BRULAGE: '/app/brulage',
  BRULAGE_MLB: '/app/brulage/mlb',
  BRULAGE_MAF: '/app/brulage/maf',
  RESOURCES: '/app/resources',
  RESOURCE_ADD: '/app/resources/add',
  RESOURCE_DETAIL: '/app/resources/document',
  DASHBOARD: '/app/dashboard',
  SETTINGS: '/app/settings',
  ADMIN_SETTINGS: '/app/settings/admin',
  ADMIN_USERS: '/app/settings/admin/users',
  ADMIN_EMAIL_DESTINATIONS: '/app/settings/admin/destinations',
  ADMIN_REGISTERED_ACCOUNTS: '/app/settings/admin/accounts',
  ACCOUNT: '/app/account',
  CARPOOL: '/app/carpool',
  MEDICAL_FOLLOWUP: '/app/brulage/suivi-medical',
  MAIN_COURANTE: '/app/brulage/main-courante',
} as const;

export const DEMO_PHONE_NUMBER = '06 00 00 00 00';
