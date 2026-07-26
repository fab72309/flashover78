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
  TRAINING_REGISTRATIONS: 'training_registrations',
  TRAINING_AUDIT_LOG: 'training_audit_log',
} as const;

export const STORAGE_BUCKETS = {
  SDIS78_DOCUMENTS: 'sdis78-documents',
  LECTURES_DOCUMENTS: 'lectures-documents',
  BRULAGE_DOCUMENTS: 'brulage-documents',
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
  ACCOUNT: '/app/account',
  CARPOOL: '/app/carpool',
} as const;

export const DEMO_PHONE_NUMBER = '06 00 00 00 00';
