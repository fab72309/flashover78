import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { assertSupabaseConfigured, supabase } from '../lib/supabase';
import { setRememberSessionPreference } from '../lib/supabase';
import {
  APP_ROUTES,
  CARPOOL_REQUEST_STATUSES,
  CARPOOL_TRIP_STATUSES,
  RESOURCE_CATEGORY_BUCKET,
  RESOURCE_CATEGORY_FOLDER,
  STORAGE_BUCKETS,
  TABLES,
} from '../utils/constants';
import type {
  AppUser,
  AppRole,
  CalendarFormateurAssignment,
  CalendarEvent,
  CarpoolMyRequest,
  CarpoolRequest,
  CarpoolTrip,
  CarpoolTripStatus,
  Profile,
  DocumentFilters,
  DocumentMetadataInput,
  Resource,
  ResourceCategory,
  ResourceVersion,
  TrainingAttendanceStatus,
  TrainingHistoryItem,
  TrainingParticipant,
  TrainingRegistration,
  TrainingRegistrationStatus,
  TrainingSessionSummary,
  ManagedUser,
  MedicalFollowUpEmailStatus,
  MedicalFollowUpFormData,
  MedicalFollowUpRecord,
  MainCouranteEmailStatus,
  MainCouranteFormData,
  MainCouranteRecord,
  TrainerLevel,
} from '../types';
import { devUser, isDevAuthBypassEnabled } from '../utils/devAuth';
import { getDocumentExpirationState } from '../utils/documents';
import { getPasswordRecoveryRedirectUrl } from '../utils/authRecovery';
import { normalizeTrainerLevels } from '../utils/trainerLevels';
import {
  createDefaultFormEmailDestinations,
  FORM_EMAIL_DESTINATION_DB_KEYS,
  normalizeEmailRecipients,
  validateFormEmailDestinations,
  type FormEmailDestinations,
} from '../utils/emailDestinations';

type EventRow = {
  id: string;
  title: string;
  description: string;
  observations: string | null;
  location: string | null;
  formateurs: string[] | null;
  formateur_ids: string[] | null;
  formateur_levels: TrainerLevel[] | null;
  date: string;
  capacity: number;
  registration_closes_at: string | null;
  created_at: string;
};

type TrainingRegistrationRow = {
  id: string;
  event_id: string;
  user_id: string;
  status: TrainingRegistrationStatus;
  attendance: TrainingAttendanceStatus;
  registered_at: string;
  updated_at: string;
};

type TrainingSummaryRow = {
  event_id: string;
  capacity: number;
  registered_count: number;
  waitlisted_count: number;
  my_status: TrainingRegistrationStatus | null;
  my_attendance: TrainingAttendanceStatus | null;
};

type TrainingParticipantRow = {
  registration_id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone: string | null;
  status: TrainingRegistrationStatus;
  attendance: TrainingAttendanceStatus;
  registered_at: string;
};

type ResourceRow = {
  id: string;
  title: string;
  category: ResourceCategory;
  tags: string[] | null;
  version_label: string;
  author_name: string;
  effective_at: string | null;
  expires_at: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  bucket_id: string | null;
  storage_path: string | null;
  updated_at: string;
  is_favorite: boolean;
  is_offline_selected: boolean;
  version_count: number;
};

type ResourceVersionRow = {
  id: string;
  version_label: string;
  bucket_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  file_size: number;
  author_name: string;
  effective_at: string | null;
  expires_at: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean | null;
  role: AppRole | null;
  trainer_levels: TrainerLevel[] | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
};

type ProfileDirectoryRow = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  trainer_levels: TrainerLevel[] | null;
  updated_at: string;
};

type EmailDestinationRow = {
  form_key: string;
  recipients: string[] | null;
};

type CarpoolContactRow = {
  user_id: string;
  email: string;
  phone: string | null;
};

type MedicalFollowUpRow = {
  id: string;
  user_id: string;
  trainer_level: TrainerLevel;
  nom_formateur: string;
  prenom_formateur: string;
  email_formateur: string;
  date_formation: string;
  journee: MedicalFollowUpFormData['journee'] | null;
  conditions_meteo: MedicalFollowUpFormData['conditionsMeteo'];
  temperature: string | null;
  hydratation_avant_bruleage: MedicalFollowUpFormData['hydratationAvantBrulage'];
  hydratation_apres_bruleage: MedicalFollowUpFormData['hydratationApresBrulage'];
  lieu_formation: MedicalFollowUpFormData['lieuFormation'];
  lieu_formation_autre: string | null;
  formation: MedicalFollowUpFormData['formation'];
  formation_autre: string | null;
  role_formateur: MedicalFollowUpFormData['roleFormateur'];
  role_formateur_autre: string | null;
  type_bruleage: MedicalFollowUpFormData['typeBrulage'];
  type_bruleage_autre: string | null;
  temps_ari: MedicalFollowUpFormData['tempsAri'];
  decontamination_post_bruleage: MedicalFollowUpFormData['decontaminationPostBrulage'];
  douche_dans_heure: MedicalFollowUpFormData['doucheDansHeure'];
  observations_post_bruleage: string[];
  observations_post_bruleage_autre: string | null;
  observations: string | null;
  email_status: MedicalFollowUpEmailStatus;
  email_sent_at: string | null;
  email_provider_id: string | null;
  email_error: string | null;
  created_at: string;
  updated_at: string;
};

type MainCouranteRow = {
  id: string;
  user_id: string;
  pdf_storage_path: string;
  pdf_filename: string;
  pdf_file_size: number;
  email_formateur: string;
  date_main_courante: string;
  vent: number | null;
  sens_du_vent: MainCouranteFormData['sensDuVent'];
  meteo: MainCouranteFormData['meteo'];
  formateur_1: string | null;
  formateur_2: string | null;
  formateur_3: string | null;
  formateur_4: string | null;
  formateur_5: string | null;
  site_formation: MainCouranteFormData['siteFormation'];
  type_session: MainCouranteFormData['typeSession'];
  formation: MainCouranteFormData['formation'];
  citerne_gaz: number | null;
  panneaux_bois: number | null;
  palettes: number | null;
  masques_ffp3: number | null;
  gants_nitrile: number | null;
  benne_dechet: number | null;
  chariot_foyer_demarrage: MainCouranteFormData['chariotFoyerDemarrage'];
  observations_difficultes: string | null;
  reparations_materiel: string | null;
  email_status: MainCouranteEmailStatus;
  email_sent_at: string | null;
  email_provider_id: string | null;
  email_error: string | null;
  created_at: string;
  updated_at: string;
};

type CarpoolTripRow = {
  id: string;
  event_id: string | null;
  driver_id: string;
  departure_city: string;
  departure_label: string;
  departure_datetime: string;
  arrival_label: string;
  available_seats: number;
  total_seats: number;
  price_note: string | null;
  vehicle_note: string | null;
  luggage_note: string | null;
  notes: string | null;
  status: CarpoolTripStatus;
  created_at: string;
};

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['pdf', 'odt', 'doc', 'docx', 'ppt', 'pptx', 'txt']);
const mockNow = new Date();
const mockEventDate = new Date(mockNow.getTime() + 3 * 24 * 60 * 60 * 1000);

let mockEvents: CalendarEvent[] = [
  {
    id: 'preview-event-1',
    title: 'Session caisson',
    description: 'Mise en situation et débriefing opérationnel',
    location: 'Plateau technique Caissons',
    formateurs: ['Fabien Dev'],
    formateurAssignments: [{
      userId: devUser.id,
      displayName: 'Fabien Dev',
      level: devUser.trainerLevels[0],
    }],
    date: mockEventDate,
    capacity: 12,
    registrationClosesAt: null,
    createdAt: mockNow,
  },
];

let mockResources: Resource[] = [
  {
    id: 'preview-resource-1',
    title: 'Référentiel caisson et phénomènes thermiques',
    category: 'SDIS78',
    fileUrl: '/app/resources/document/preview-resource-1',
    tags: ['caisson', 'sécurité', 'référentiel'],
    versionLabel: '2.1',
    authorName: 'SDIS 78',
    effectiveAt: new Date(mockNow.getFullYear(), mockNow.getMonth() - 2, 1),
    expiresAt: new Date(mockNow.getFullYear(), mockNow.getMonth() + 1, 15),
    originalFilename: 'referentiel-caisson-v2-1.txt',
    mimeType: 'text/plain',
    fileSize: 18432,
    bucketId: STORAGE_BUCKETS.SDIS78_DOCUMENTS,
    storagePath: 'preview/referentiel-caisson-v2-1.txt',
    updatedAt: mockNow,
    isFavorite: true,
    isOfflineSelected: false,
    versionCount: 2,
    createdAt: mockNow,
  },
  {
    id: 'preview-resource-2',
    title: 'Support de formation lecture du feu',
    category: 'LECTURES',
    fileUrl: '/app/resources/document/preview-resource-2',
    tags: ['lecture du feu', 'formation'],
    versionLabel: '1.0',
    authorName: 'Équipe formation',
    effectiveAt: new Date(mockNow.getFullYear(), mockNow.getMonth(), 1),
    expiresAt: null,
    originalFilename: 'support-lecture-du-feu.txt',
    mimeType: 'text/plain',
    fileSize: 12288,
    bucketId: STORAGE_BUCKETS.LECTURES_DOCUMENTS,
    storagePath: 'preview/support-lecture-du-feu.txt',
    updatedAt: new Date(mockNow.getTime() - 24 * 60 * 60 * 1000),
    isFavorite: false,
    isOfflineSelected: false,
    versionCount: 1,
    createdAt: new Date(mockNow.getTime() - 24 * 60 * 60 * 1000),
  },
];

const mockResourceVersions: Record<string, ResourceVersion[]> = {
  'preview-resource-1': [
    {
      id: 'preview-resource-version-2',
      versionLabel: '2.1',
      bucketId: STORAGE_BUCKETS.SDIS78_DOCUMENTS,
      storagePath: 'preview/referentiel-caisson-v2-1.txt',
      originalFilename: 'referentiel-caisson-v2-1.txt',
      mimeType: 'text/plain',
      fileSize: 18432,
      authorName: 'SDIS 78',
      effectiveAt: new Date(mockNow.getFullYear(), mockNow.getMonth() - 2, 1),
      expiresAt: new Date(mockNow.getFullYear(), mockNow.getMonth() + 1, 15),
      createdAt: mockNow,
    },
    {
      id: 'preview-resource-version-1',
      versionLabel: '2.0',
      bucketId: STORAGE_BUCKETS.SDIS78_DOCUMENTS,
      storagePath: 'preview/referentiel-caisson-v2-0.txt',
      originalFilename: 'referentiel-caisson-v2-0.txt',
      mimeType: 'text/plain',
      fileSize: 17200,
      authorName: 'SDIS 78',
      effectiveAt: new Date(mockNow.getFullYear(), mockNow.getMonth() - 8, 1),
      expiresAt: new Date(mockNow.getFullYear(), mockNow.getMonth() - 2, 1),
      createdAt: new Date(mockNow.getTime() - 180 * 24 * 60 * 60 * 1000),
    },
  ],
  'preview-resource-2': [
    {
      id: 'preview-resource-version-3',
      versionLabel: '1.0',
      bucketId: STORAGE_BUCKETS.LECTURES_DOCUMENTS,
      storagePath: 'preview/support-lecture-du-feu.txt',
      originalFilename: 'support-lecture-du-feu.txt',
      mimeType: 'text/plain',
      fileSize: 12288,
      authorName: 'Équipe formation',
      effectiveAt: new Date(mockNow.getFullYear(), mockNow.getMonth(), 1),
      expiresAt: null,
      createdAt: new Date(mockNow.getTime() - 24 * 60 * 60 * 1000),
    },
  ],
};

let mockTrips: CarpoolTrip[] = [
  {
    id: 'preview-trip-1',
    eventId: 'preview-event-1',
    eventTitle: 'Session caisson',
    eventLocation: 'Plateau technique Caissons',
    eventDate: mockEventDate,
    driverId: devUser.id,
    driverName: devUser.displayName,
    driverEmail: devUser.email,
    driverPhone: devUser.phone,
    departureCity: 'Versailles',
    departureLabel: 'Centre de secours',
    departureDatetime: new Date(mockEventDate.getTime() - 90 * 60 * 1000),
    arrivalLabel: 'Plateau technique Caissons',
    availableSeats: 3,
    totalSeats: 3,
    status: 'open',
    createdAt: mockNow,
    requests: [],
  },
];

const mockMyRequests: CarpoolMyRequest[] = [];
let mockTrainingRegistrations: TrainingRegistration[] = [
  {
    id: 'preview-training-registration-1',
    eventId: 'preview-event-1',
    userId: devUser.id,
    status: 'registered',
    attendance: 'pending',
    registeredAt: mockNow,
    updatedAt: mockNow,
  },
];

let mockMedicalFollowUps: MedicalFollowUpRecord[] = [];
let mockMainCourantes: MainCouranteRecord[] = [];
const mockMainCourantePdfs = new Map<string, Blob>();

let mockManagedUsers: ManagedUser[] = [
  {
    id: devUser.id,
    email: devUser.email,
    displayName: devUser.displayName,
    firstName: devUser.firstName,
    lastName: devUser.lastName,
    role: devUser.role,
    trainerLevels: devUser.trainerLevels,
    isAdmin: devUser.role === 'admin',
    createdAt: mockNow,
    lastSignInAt: mockNow,
    emailConfirmedAt: mockNow,
  },
];

let mockFormEmailDestinations = createDefaultFormEmailDestinations();

function createPreviewId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function ensureValidStatus<T extends string>(status: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(status as T) ? (status as T) : fallback;
}

function mapEvent(row: EventRow): CalendarEvent {
  const formateurAssignments = (row.formateur_ids ?? [])
    .map<CalendarFormateurAssignment | null>((userId, index) => {
      const level = row.formateur_levels?.[index];
      if (!level) {
        return null;
      }

      return {
        userId,
        displayName: row.formateurs?.[index] ?? 'Formateur',
        level,
      };
    })
    .filter((assignment): assignment is CalendarFormateurAssignment => assignment !== null);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    observations: row.observations,
    location: row.location,
    formateurs: row.formateurs ?? [],
    formateurAssignments: formateurAssignments.length > 0 ? formateurAssignments : undefined,
    date: new Date(row.date),
    capacity: row.capacity,
    registrationClosesAt: row.registration_closes_at
      ? new Date(row.registration_closes_at)
      : null,
    createdAt: new Date(row.created_at),
  };
}

function mapTrainingRegistration(row: TrainingRegistrationRow): TrainingRegistration {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    status: row.status,
    attendance: row.attendance,
    registeredAt: new Date(row.registered_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapProfile(row: ProfileRow): Profile {
  const role = row.role ?? (row.is_admin ? 'admin' : 'member');
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role,
    trainerLevels: normalizeTrainerLevels(row.trainer_levels),
    isAdmin: role === 'admin',
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    createdAt: new Date(row.created_at),
  };
}

function mapDirectoryProfile(row: ProfileDirectoryRow): Profile {
  return {
    id: row.id,
    email: '',
    displayName: row.display_name,
    role: 'member',
    trainerLevels: normalizeTrainerLevels(row.trainer_levels),
    isAdmin: false,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: null,
    createdAt: new Date(row.updated_at),
  };
}

function mapResource(row: ResourceRow): Resource {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    fileUrl: `${APP_ROUTES.RESOURCE_DETAIL}/${row.id}`,
    tags: row.tags ?? [],
    versionLabel: row.version_label,
    authorName: row.author_name,
    effectiveAt: row.effective_at ? new Date(row.effective_at) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    originalFilename: row.original_filename ?? row.title,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    bucketId: row.bucket_id ?? '',
    storagePath: row.storage_path ?? '',
    updatedAt: new Date(row.updated_at),
    isFavorite: row.is_favorite,
    isOfflineSelected: row.is_offline_selected,
    versionCount: row.version_count,
    createdAt: new Date(row.updated_at),
  };
}

function mapResourceVersion(row: ResourceVersionRow): ResourceVersion {
  return {
    id: row.id,
    versionLabel: row.version_label,
    bucketId: row.bucket_id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    authorName: row.author_name,
    effectiveAt: row.effective_at ? new Date(row.effective_at) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    createdAt: new Date(row.created_at),
  };
}

function mapMedicalFollowUp(row: MedicalFollowUpRow): MedicalFollowUpRecord {
  return {
    id: row.id,
    userId: row.user_id,
    trainerLevel: row.trainer_level,
    nomFormateur: row.nom_formateur,
    prenomFormateur: row.prenom_formateur,
    emailFormateur: row.email_formateur,
    dateFormation: row.date_formation,
    journee: row.journee ?? '',
    conditionsMeteo: row.conditions_meteo,
    temperature: row.temperature ?? '',
    hydratationAvantBrulage: row.hydratation_avant_bruleage,
    hydratationApresBrulage: row.hydratation_apres_bruleage,
    lieuFormation: row.lieu_formation,
    lieuFormationAutre: row.lieu_formation_autre ?? '',
    formation: row.formation,
    formationAutre: row.formation_autre ?? '',
    roleFormateur: row.role_formateur,
    roleFormateurAutre: row.role_formateur_autre ?? '',
    typeBrulage: row.type_bruleage,
    typeBrulageAutre: row.type_bruleage_autre ?? '',
    tempsAri: row.temps_ari,
    decontaminationPostBrulage: row.decontamination_post_bruleage,
    doucheDansHeure: row.douche_dans_heure,
    observationsPostBrulage: row.observations_post_bruleage,
    observationsPostBrulageAutre: row.observations_post_bruleage_autre ?? '',
    observations: row.observations ?? '',
    emailStatus: row.email_status,
    emailSentAt: row.email_sent_at ? new Date(row.email_sent_at) : null,
    emailProviderId: row.email_provider_id,
    emailError: row.email_error,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapMainCourante(row: MainCouranteRow): MainCouranteRecord {
  return {
    id: row.id,
    userId: row.user_id,
    pdfStoragePath: row.pdf_storage_path,
    pdfFilename: row.pdf_filename,
    pdfFileSize: row.pdf_file_size,
    emailFormateur: row.email_formateur,
    dateMainCourante: row.date_main_courante,
    vent: row.vent ? String(row.vent) as MainCouranteRecord['vent'] : '',
    sensDuVent: row.sens_du_vent ?? '',
    meteo: row.meteo ?? [],
    formateurs: [
      row.formateur_1 ?? '',
      row.formateur_2 ?? '',
      row.formateur_3 ?? '',
      row.formateur_4 ?? '',
      row.formateur_5 ?? '',
    ],
    siteFormation: row.site_formation ?? '',
    typeSession: row.type_session ?? '',
    formation: row.formation ?? '',
    citerneGaz: row.citerne_gaz ? String(row.citerne_gaz) as MainCouranteRecord['citerneGaz'] : '',
    panneauxBois: row.panneaux_bois ? String(row.panneaux_bois) as MainCouranteRecord['panneauxBois'] : '',
    palettes: row.palettes ? String(row.palettes) as MainCouranteRecord['palettes'] : '',
    masquesFfp3: row.masques_ffp3 ? String(row.masques_ffp3) as MainCouranteRecord['masquesFfp3'] : '',
    gantsNitrile: row.gants_nitrile ? String(row.gants_nitrile) as MainCouranteRecord['gantsNitrile'] : '',
    benneDechet: row.benne_dechet ? String(row.benne_dechet) as MainCouranteRecord['benneDechet'] : '',
    chariotFoyerDemarrage: row.chariot_foyer_demarrage ?? [],
    observationsDifficultes: row.observations_difficultes ?? '',
    reparationsMateriel: row.reparations_materiel ?? '',
    emailStatus: row.email_status,
    emailSentAt: row.email_sent_at ? new Date(row.email_sent_at) : null,
    emailProviderId: row.email_provider_id,
    emailError: row.email_error,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function deriveAppUser(user: SupabaseUser, profile?: Profile | null): AppUser {
  const metadata = user.user_metadata ?? {};

  return {
    id: user.id,
    email: user.email ?? '',
    displayName: profile?.displayName ||
      metadata.display_name ||
      [metadata.first_name, metadata.last_name].filter(Boolean).join(' ').trim() ||
      user.email?.split('@')[0] ||
      'Utilisateur',
    role: profile?.role ?? 'member',
    trainerLevels: profile?.trainerLevels ?? ['RSFR'],
    isAdmin: profile?.role === 'admin',
    firstName: profile?.firstName ?? metadata.first_name,
    lastName: profile?.lastName ?? metadata.last_name,
    phone: profile?.phone ?? metadata.phone ?? null,
    photoURL: metadata.avatar_url ?? null,
    provider: user.app_metadata?.provider ?? 'email',
  };
}

async function uploadPrivateFile(
  bucket: string,
  path: string,
  file: Blob,
  options: { upsert?: boolean } = {},
) {
  if (isDevAuthBypassEnabled) {
    return path;
  }

  assertSupabaseConfigured();

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
    upsert: options.upsert ?? true,
  });

  if (error) {
    throw error;
  }

  return path;
}

async function ensureCurrentUserCanContribute() {
  if (isDevAuthBypassEnabled) {
    if (devUser.role === 'member') {
      throw new Error('Action réservée aux contributeurs.');
    }
    return;
  }

  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;
  if (!profile || profile.role === 'member') {
    throw new Error('Action réservée aux contributeurs.');
  }
}

async function ensureCurrentUserIsAdmin() {
  if (isDevAuthBypassEnabled) {
    if (devUser.role !== 'admin') {
      throw new Error('Action réservée aux administrateurs.');
    }
    return;
  }

  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;
  if (profile?.role !== 'admin') {
    throw new Error('Action réservée aux administrateurs.');
  }
}

export async function getCurrentUser() {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.name === 'AuthSessionMissingError') {
      return null;
    }
    throw error;
  }
  return data.user;
}

export async function ensureProfileForUser(user: SupabaseUser) {
  assertSupabaseConfigured();

  const metadata = user.user_metadata ?? {};
  const displayName =
      metadata.display_name ||
      [metadata.first_name, metadata.last_name].filter(Boolean).join(' ').trim() ||
      user.email?.split('@')[0] ||
      'Utilisateur';

  const { error } = await supabase.rpc('sync_my_profile', {
    p_display_name: displayName,
    p_first_name: metadata.first_name ?? null,
    p_last_name: metadata.last_name ?? null,
    p_phone: metadata.phone ?? null,
  });
  if (error) {
    throw error;
  }
}

export async function resolveAppUser(user: SupabaseUser | null) {
  if (!user) {
    return null;
  }

  await ensureProfileForUser(user);
  const profile = await getProfile(user.id);
  return deriveAppUser(user, profile);
}

export interface SignUpResult {
  user: SupabaseUser | null;
  session: Session | null;
  requiresEmailConfirmation: boolean;
}

export async function signUp(email: string, password: string, firstName: string, lastName: string) {
  setRememberSessionPreference(false);
  assertSupabaseConfigured();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        display_name: `${firstName} ${lastName}`.trim(),
      },
      emailRedirectTo:
        typeof window !== 'undefined' ? `${window.location.origin}${APP_ROUTES.LOGIN}` : undefined,
    },
  });

  if (error) {
    throw normalizeAuthError(error.message);
  }

  if (data.user && data.session) {
    await ensureProfileForUser(data.user);
  }

  return {
    user: data.user ?? null,
    session: data.session ?? null,
    requiresEmailConfirmation: Boolean(data.user && !data.session),
  } satisfies SignUpResult;
}

export async function signIn(email: string, password: string, rememberSession = false) {
  setRememberSessionPreference(rememberSession);
  assertSupabaseConfigured();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw normalizeAuthError(error.message);
  }

  if (data.user) {
    await ensureProfileForUser(data.user);
  }

  return data.user;
}

export async function signOut() {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  assertSupabaseConfigured();

  const redirectTo =
    typeof window !== 'undefined'
      ? getPasswordRecoveryRedirectUrl(window.location.origin)
      : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });

  if (error) {
    throw normalizeAuthError(error.message);
  }
}

export async function exchangePasswordRecoveryToken(tokenHash: string) {
  assertSupabaseConfigured();

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  });

  if (error || !data.session) {
    throw normalizeAuthError(
      error?.message ?? 'Ce lien de réinitialisation est invalide ou a expiré.'
    );
  }

  return data.session;
}

export async function updatePasswordFromRecovery(password: string) {
  assertSupabaseConfigured();

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw normalizeAuthError(error.message);
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
  if (signOutError) {
    await supabase.auth.signOut({ scope: 'local' });
  }
}

export async function cancelPasswordRecovery() {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    throw normalizeAuthError(error.message);
  }
}

export type MedicalFollowUpDeliveryStatus = MedicalFollowUpEmailStatus | 'not_configured';

export interface MedicalFollowUpSubmissionResult {
  record: MedicalFollowUpRecord;
  document: Blob;
  filename: string;
  deliveryStatus: MedicalFollowUpDeliveryStatus;
  deliveryError: string | null;
}

function encodeBytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

async function encodeBlobToBase64(blob: Blob) {
  return encodeBytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

function getMedicalFollowUpDeliveryError() {
  return 'La fiche est enregistrée, mais son envoi automatique n’a pas pu être confirmé.';
}

function getMedicalFollowUpPayload(input: MedicalFollowUpFormData, userId: string) {
  return {
    user_id: userId,
    trainer_level: input.trainerLevel,
    nom_formateur: input.nomFormateur.trim(),
    prenom_formateur: input.prenomFormateur.trim(),
    email_formateur: input.emailFormateur.trim().toLowerCase(),
    date_formation: input.dateFormation,
    journee: input.journee || null,
    conditions_meteo: input.conditionsMeteo,
    temperature: input.temperature.trim() || null,
    hydratation_avant_bruleage: input.hydratationAvantBrulage,
    hydratation_apres_bruleage: input.hydratationApresBrulage,
    lieu_formation: input.lieuFormation,
    lieu_formation_autre: input.lieuFormationAutre.trim() || null,
    formation: input.formation,
    formation_autre: input.formationAutre.trim() || null,
    role_formateur: input.roleFormateur,
    role_formateur_autre: input.roleFormateurAutre.trim() || null,
    type_bruleage: input.typeBrulage,
    type_bruleage_autre: input.typeBrulageAutre.trim() || null,
    temps_ari: input.tempsAri,
    decontamination_post_bruleage: input.decontaminationPostBrulage,
    douche_dans_heure: input.doucheDansHeure,
    observations_post_bruleage: input.observationsPostBrulage,
    observations_post_bruleage_autre: input.observationsPostBrulageAutre.trim() || null,
    observations: input.observations.trim() || null,
  };
}

async function sendMedicalFollowUpEmail(
  record: MedicalFollowUpRecord,
  document: Blob,
  filename: string,
  isEvolution: boolean,
) {
  let deliveryStatus: MedicalFollowUpDeliveryStatus = 'pending';
  let deliveryError: string | null = null;

  try {
    const { data: delivery, error: deliveryInvokeError } = await supabase.functions.invoke(
      'medical-follow-up-email',
      {
        body: {
          submissionId: record.id,
          documentBase64: await encodeBlobToBase64(document),
          filename,
          isEvolution,
        },
      },
    );

    if (deliveryInvokeError || delivery?.status !== 'sent') {
      console.error('Medical follow-up email delivery failed', deliveryInvokeError ?? delivery);
      deliveryStatus = 'failed';
      deliveryError = getMedicalFollowUpDeliveryError();
    } else {
      deliveryStatus = 'sent';
    }
  } catch (error) {
    console.error('Medical follow-up email delivery failed', error);
    deliveryStatus = 'failed';
    deliveryError = getMedicalFollowUpDeliveryError();
  }

  return {
    deliveryStatus,
    deliveryError,
  };
}

export async function createMedicalFollowUp(
  input: MedicalFollowUpFormData,
  document: Blob,
  filename: string,
): Promise<MedicalFollowUpSubmissionResult> {
  if (isDevAuthBypassEnabled) {
    const now = new Date();
    const record: MedicalFollowUpRecord = {
      ...input,
      id: createPreviewId('preview-medical-follow-up'),
      userId: devUser.id,
      emailStatus: 'failed',
      emailSentAt: null,
      emailProviderId: null,
      emailError: 'Mode de démonstration : aucun email n’est envoyé.',
      createdAt: now,
      updatedAt: now,
    };
    mockMedicalFollowUps = [record, ...mockMedicalFollowUps];
    return {
      record,
      document,
      filename,
      deliveryStatus: 'not_configured',
      deliveryError: record.emailError ?? null,
    };
  }

  assertSupabaseConfigured();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('Authentification requise pour enregistrer un suivi médical.');
  }

  const { data, error } = await supabase
    .from(TABLES.MEDICAL_FOLLOW_UPS)
    .insert(getMedicalFollowUpPayload(input, currentUser.id))
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const initialRecord = mapMedicalFollowUp(data as MedicalFollowUpRow);
  const delivery = await sendMedicalFollowUpEmail(initialRecord, document, filename, false);
  const record = delivery.deliveryStatus === 'failed'
    ? { ...initialRecord, emailStatus: 'failed' as const, emailError: delivery.deliveryError }
    : initialRecord;

  return {
    record,
    document,
    filename,
    deliveryStatus: delivery.deliveryStatus,
    deliveryError: delivery.deliveryError,
  };
}

export async function updateMedicalFollowUp(
  id: string,
  input: MedicalFollowUpFormData,
  document: Blob,
  filename: string,
): Promise<MedicalFollowUpSubmissionResult> {
  if (isDevAuthBypassEnabled) {
    const existing = mockMedicalFollowUps.find((record) => record.id === id && record.userId === devUser.id);
    if (!existing) throw new Error('Suivi médical introuvable.');
    if (Date.now() > existing.createdAt.getTime() + 72 * 60 * 60 * 1000) {
      throw new Error('La période de modification de 72 heures est dépassée.');
    }

    const now = new Date();
    const record: MedicalFollowUpRecord = {
      ...input,
      id: existing.id,
      userId: existing.userId,
      emailStatus: 'failed',
      emailSentAt: null,
      emailProviderId: null,
      emailError: 'Mode de démonstration : aucun email n’est envoyé.',
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    mockMedicalFollowUps = mockMedicalFollowUps.map((item) => item.id === id ? record : item);
    return {
      record,
      document,
      filename,
      deliveryStatus: 'not_configured',
      deliveryError: record.emailError ?? null,
    };
  }

  assertSupabaseConfigured();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('Authentification requise pour modifier un suivi médical.');
  }

  const { data, error } = await supabase
    .from(TABLES.MEDICAL_FOLLOW_UPS)
    .update(getMedicalFollowUpPayload(input, currentUser.id))
    .eq('id', id)
    .eq('user_id', currentUser.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const initialRecord = mapMedicalFollowUp(data as MedicalFollowUpRow);
  const delivery = await sendMedicalFollowUpEmail(initialRecord, document, filename, true);
  const record = delivery.deliveryStatus === 'failed'
    ? { ...initialRecord, emailStatus: 'failed' as const, emailError: delivery.deliveryError }
    : initialRecord;

  return {
    record,
    document,
    filename,
    deliveryStatus: delivery.deliveryStatus,
    deliveryError: delivery.deliveryError,
  };
}

export async function listMyMedicalFollowUps(userId: string) {
  if (isDevAuthBypassEnabled) {
    return mockMedicalFollowUps
      .filter((record) => record.userId === userId)
      .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime());
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from(TABLES.MEDICAL_FOLLOW_UPS)
    .select('*')
    .eq('user_id', userId)
    .order('date_formation', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as MedicalFollowUpRow[]).map(mapMedicalFollowUp);
}

export async function getMyMedicalFollowUp(id: string, userId: string) {
  if (isDevAuthBypassEnabled) {
    return mockMedicalFollowUps.find((record) => record.id === id && record.userId === userId) ?? null;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from(TABLES.MEDICAL_FOLLOW_UPS)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapMedicalFollowUp(data as MedicalFollowUpRow) : null;
}

function toNullableNumber(value: string) {
  return value ? Number(value) : null;
}

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Le navigateur ne permet pas de créer l’identifiant du PDF.');
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeMainCouranteFilename(filename: string) {
  const normalized = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized || 'main-courante'}.pdf`;
}

function getMainCourantePayload(
  input: MainCouranteFormData,
  userId: string,
  id: string,
  pdfStoragePath: string,
  pdfFilename: string,
  pdfFileSize: number,
) {
  return {
    id,
    user_id: userId,
    pdf_storage_path: pdfStoragePath,
    pdf_filename: pdfFilename,
    pdf_file_size: pdfFileSize,
    email_formateur: input.emailFormateur.trim().toLowerCase(),
    date_main_courante: input.dateMainCourante,
    vent: toNullableNumber(input.vent),
    sens_du_vent: input.sensDuVent || null,
    meteo: input.meteo,
    formateur_1: input.formateurs[0]?.trim() || null,
    formateur_2: input.formateurs[1]?.trim() || null,
    formateur_3: input.formateurs[2]?.trim() || null,
    formateur_4: input.formateurs[3]?.trim() || null,
    formateur_5: input.formateurs[4]?.trim() || null,
    site_formation: input.siteFormation,
    type_session: input.typeSession || null,
    formation: input.formation || null,
    citerne_gaz: toNullableNumber(input.citerneGaz),
    panneaux_bois: toNullableNumber(input.panneauxBois),
    palettes: toNullableNumber(input.palettes),
    masques_ffp3: toNullableNumber(input.masquesFfp3),
    gants_nitrile: toNullableNumber(input.gantsNitrile),
    benne_dechet: toNullableNumber(input.benneDechet),
    chariot_foyer_demarrage: input.chariotFoyerDemarrage,
    observations_difficultes: input.observationsDifficultes.trim() || null,
    reparations_materiel: input.reparationsMateriel.trim() || null,
  };
}

export interface MainCouranteSubmissionResult {
  record: MainCouranteRecord;
  document: Blob;
  filename: string;
  deliveryStatus: MainCouranteDeliveryStatus;
  deliveryError: string | null;
}

export type MainCouranteDeliveryStatus = MainCouranteEmailStatus | 'not_configured';

export interface MainCouranteDeliveryResult {
  deliveryStatus: MainCouranteDeliveryStatus;
  deliveryError: string | null;
  providerId: string | null;
}

function getMainCouranteDeliveryError() {
  return 'La main courante est enregistrée, mais son envoi automatique n’a pas pu être confirmé.';
}

export async function sendMainCouranteEmail(
  submissionId: string,
  forceResend = false,
): Promise<MainCouranteDeliveryResult> {
  if (isDevAuthBypassEnabled) {
    return {
      deliveryStatus: 'not_configured',
      deliveryError: 'Mode de démonstration : aucun email n’est envoyé.',
      providerId: null,
    };
  }

  assertSupabaseConfigured();

  try {
    const { data, error } = await supabase.functions.invoke('main-courante-email', {
      body: { submissionId, forceResend },
    });

    if (error || data?.status !== 'sent') {
      console.error('Main courante email delivery failed', error ?? data);
      return {
        deliveryStatus: 'failed',
        deliveryError: getMainCouranteDeliveryError(),
        providerId: null,
      };
    }

    return {
      deliveryStatus: 'sent',
      deliveryError: null,
      providerId: typeof data.providerId === 'string' ? data.providerId : null,
    };
  } catch (error) {
    console.error('Main courante email delivery failed', error);
    return {
      deliveryStatus: 'failed',
      deliveryError: getMainCouranteDeliveryError(),
      providerId: null,
    };
  }
}

export async function createMainCourante(
  input: MainCouranteFormData,
  document: Blob,
  filename: string,
): Promise<MainCouranteSubmissionResult> {
  const safeFilename = normalizeMainCouranteFilename(filename);

  if (isDevAuthBypassEnabled) {
    const now = new Date();
    const id = createPreviewId('preview-main-courante');
    const pdfStoragePath = `${devUser.id}/${id}/${safeFilename}`;
    const record: MainCouranteRecord = {
      ...input,
      meteo: [...input.meteo],
      formateurs: [...input.formateurs],
      chariotFoyerDemarrage: [...input.chariotFoyerDemarrage],
      id,
      userId: devUser.id,
      pdfStoragePath,
      pdfFilename: safeFilename,
      pdfFileSize: document.size,
      emailStatus: 'failed',
      emailSentAt: null,
      emailProviderId: null,
      emailError: 'Mode de démonstration : aucun email n’est envoyé.',
      createdAt: now,
      updatedAt: now,
    };
    mockMainCourantes = [record, ...mockMainCourantes];
    mockMainCourantePdfs.set(id, document);
    return {
      record: {
        ...record,
        emailStatus: 'failed',
        emailError: 'Mode de démonstration : aucun email n’est envoyé.',
      },
      document,
      filename: safeFilename,
      deliveryStatus: 'not_configured',
      deliveryError: 'Mode de démonstration : aucun email n’est envoyé.',
    };
  }

  assertSupabaseConfigured();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('Authentification requise pour enregistrer la main courante.');
  }

  const id = createUuid();
  const pdfStoragePath = `${currentUser.id}/${id}/${safeFilename}`;

  try {
    await uploadPrivateFile(
      STORAGE_BUCKETS.MAIN_COURANTES,
      pdfStoragePath,
      document,
      { upsert: false },
    );

    const { data, error } = await supabase
      .from(TABLES.MAIN_COURANTES)
      .insert(getMainCourantePayload(
        input,
        currentUser.id,
        id,
        pdfStoragePath,
        safeFilename,
        document.size,
      ))
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    const initialRecord = mapMainCourante(data as MainCouranteRow);
    const delivery = await sendMainCouranteEmail(initialRecord.id);
    const record: MainCouranteRecord = {
      ...initialRecord,
      emailStatus: delivery.deliveryStatus === 'sent' ? 'sent' : 'failed',
      emailSentAt: delivery.deliveryStatus === 'sent' ? new Date() : null,
      emailProviderId: delivery.providerId,
      emailError: delivery.deliveryError,
    };

    return {
      record,
      document,
      filename: safeFilename,
      deliveryStatus: delivery.deliveryStatus,
      deliveryError: delivery.deliveryError,
    };
  } catch (error) {
    try {
      await removeUploadedFile(STORAGE_BUCKETS.MAIN_COURANTES, pdfStoragePath);
    } catch (cleanupError) {
      console.error('Main courante PDF cleanup failed', cleanupError);
    }
    throw error;
  }
}

export async function listMyMainCourantes(userId: string) {
  if (isDevAuthBypassEnabled) {
    return mockMainCourantes
      .filter((record) => record.userId === userId)
      .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime());
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from(TABLES.MAIN_COURANTES)
    .select('*')
    .eq('user_id', userId)
    .order('date_main_courante', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as MainCouranteRow[]).map(mapMainCourante);
}

export async function getMainCourantePdfBlob(record: MainCouranteRecord) {
  if (isDevAuthBypassEnabled) {
    const document = mockMainCourantePdfs.get(record.id);
    if (!document) {
      throw new Error('Le PDF de cette main courante est indisponible dans le mode de démonstration.');
    }
    return document;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.MAIN_COURANTES)
    .download(record.pdfStoragePath);

  if (error) {
    throw error;
  }

  return data;
}

function normalizeAdminUsersError(message: string) {
  if (message.includes('FunctionsHttpError')) {
    return new Error('Le service de gestion des utilisateurs a renvoyé une erreur.');
  }
  if (message.includes('Function not found')) {
    return new Error('La fonction Supabase de gestion des utilisateurs n’est pas déployée.');
  }
  return new Error(message);
}

function mapManagedUser(row: {
  id: string;
  email: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  is_admin?: boolean | null;
  role?: AppRole | null;
  trainer_levels?: TrainerLevel[] | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
}): ManagedUser {
  const role = row.role ?? (row.is_admin ? 'admin' : 'member');
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    role,
    trainerLevels: normalizeTrainerLevels(row.trainer_levels),
    isAdmin: role === 'admin',
    createdAt: row.created_at ? new Date(row.created_at) : null,
    lastSignInAt: row.last_sign_in_at ? new Date(row.last_sign_in_at) : null,
    emailConfirmedAt: row.email_confirmed_at ? new Date(row.email_confirmed_at) : null,
  };
}

function mapFormEmailDestinations(rows: EmailDestinationRow[]): FormEmailDestinations {
  const destinations = createDefaultFormEmailDestinations();
  const entries = Object.entries(FORM_EMAIL_DESTINATION_DB_KEYS) as Array<[
    keyof FormEmailDestinations,
    string,
  ]>;

  for (const [key, formKey] of entries) {
    const row = rows.find((candidate) => candidate.form_key === formKey);
    if (row) {
      const recipients = normalizeEmailRecipients(row.recipients);
      if (key === 'suiviMedical' || recipients.length > 0) {
        destinations[key] = recipients;
      }
    }
  }

  return destinations;
}

function normalizeFormEmailDestinations(destinations: FormEmailDestinations): FormEmailDestinations {
  return {
    mainCourante: normalizeEmailRecipients(destinations.mainCourante),
    suiviMedical: normalizeEmailRecipients(destinations.suiviMedical),
    demandeReparation: normalizeEmailRecipients(destinations.demandeReparation),
  };
}

function toFormEmailDestinationPayload(destinations: FormEmailDestinations) {
  return [
    {
      form_key: FORM_EMAIL_DESTINATION_DB_KEYS.mainCourante,
      recipients: destinations.mainCourante,
    },
    {
      form_key: FORM_EMAIL_DESTINATION_DB_KEYS.suiviMedical,
      recipients: destinations.suiviMedical,
    },
    {
      form_key: FORM_EMAIL_DESTINATION_DB_KEYS.demandeReparation,
      recipients: destinations.demandeReparation,
    },
  ];
}

export async function listFormEmailDestinations(): Promise<FormEmailDestinations> {
  if (isDevAuthBypassEnabled) {
    return normalizeFormEmailDestinations(mockFormEmailDestinations);
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from(TABLES.EMAIL_DESTINATIONS)
    .select('form_key, recipients');

  if (error) {
    throw error;
  }

  return mapFormEmailDestinations((data ?? []) as EmailDestinationRow[]);
}

export async function getFormEmailDestinations(): Promise<FormEmailDestinations> {
  try {
    return await listFormEmailDestinations();
  } catch (error) {
    console.warn('Les destinataires configurés sont indisponibles, utilisation des valeurs par défaut.', error);
    return createDefaultFormEmailDestinations();
  }
}

export async function updateFormEmailDestinations(destinations: FormEmailDestinations) {
  const normalizedDestinations = normalizeFormEmailDestinations(destinations);
  const validationError = validateFormEmailDestinations(normalizedDestinations);
  if (validationError) {
    throw new Error(validationError);
  }

  if (isDevAuthBypassEnabled) {
    await ensureCurrentUserIsAdmin();
    mockFormEmailDestinations = normalizedDestinations;
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.functions.invoke('admin-users', {
    body: {
      action: 'update_email_destinations',
      destinations: toFormEmailDestinationPayload(normalizedDestinations),
    },
  });

  if (error) {
    throw normalizeAdminUsersError(error.message);
  }
}

export async function listManagedUsers() {
  if (isDevAuthBypassEnabled) {
    return [...mockManagedUsers];
  }

  assertSupabaseConfigured();

  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: {
      action: 'list',
    },
  });

  if (error) {
    throw normalizeAdminUsersError(error.message);
  }

  return ((data?.users ?? []) as Array<Parameters<typeof mapManagedUser>[0]>).map(
    mapManagedUser
  );
}

export async function inviteManagedUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  role: AppRole;
  trainerLevels: TrainerLevel[];
}) {
  if (isDevAuthBypassEnabled) {
    const now = new Date();
    mockManagedUsers = [
      ...mockManagedUsers,
      {
        id: createPreviewId('preview-user'),
        email: input.email,
        displayName: `${input.firstName} ${input.lastName}`.trim(),
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        trainerLevels: normalizeTrainerLevels(input.trainerLevels),
        isAdmin: input.role === 'admin',
        createdAt: now,
        lastSignInAt: null,
        emailConfirmedAt: null,
      },
    ];
    return;
  }

  assertSupabaseConfigured();

  const { error } = await supabase.functions.invoke('admin-users', {
    body: {
      action: 'invite',
      ...input,
      redirectTo:
        typeof window !== 'undefined' ? `${window.location.origin}${APP_ROUTES.LOGIN}` : undefined,
    },
  });

  if (error) {
    throw normalizeAdminUsersError(error.message);
  }
}

export async function createManagedUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: AppRole;
  trainerLevels: TrainerLevel[];
}) {
  if (isDevAuthBypassEnabled) {
    const now = new Date();
    mockManagedUsers = [
      ...mockManagedUsers,
      {
        id: createPreviewId('preview-user'),
        email: input.email,
        displayName: `${input.firstName} ${input.lastName}`.trim(),
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        trainerLevels: normalizeTrainerLevels(input.trainerLevels),
        isAdmin: input.role === 'admin',
        createdAt: now,
        lastSignInAt: null,
        emailConfirmedAt: now,
      },
    ];
    return;
  }

  assertSupabaseConfigured();

  const { error } = await supabase.functions.invoke('admin-users', {
    body: {
      action: 'create',
      ...input,
    },
  });

  if (error) {
    throw normalizeAdminUsersError(error.message);
  }
}

export async function deleteManagedUser(userId: string) {
  if (isDevAuthBypassEnabled) {
    await ensureCurrentUserIsAdmin();
    if (userId === devUser.id) {
      throw new Error('Vous ne pouvez pas supprimer votre propre compte depuis cette page.');
    }
    mockManagedUsers = mockManagedUsers.filter((candidate) => candidate.id !== userId);
    return;
  }

  assertSupabaseConfigured();

  const { error } = await supabase.functions.invoke('admin-users', {
    body: {
      action: 'delete',
      userId,
    },
  });

  if (error) {
    throw normalizeAdminUsersError(error.message);
  }
}

export async function updateManagedUserRole(userId: string, role: AppRole) {
  if (isDevAuthBypassEnabled) {
    mockManagedUsers = mockManagedUsers.map((candidate) => (
      candidate.id === userId
        ? { ...candidate, role, isAdmin: role === 'admin' }
        : candidate
    ));
    return;
  }

  assertSupabaseConfigured();

  const { error } = await supabase.functions.invoke('admin-users', {
    body: {
      action: 'update_role',
      userId,
      role,
    },
  });

  if (error) {
    throw normalizeAdminUsersError(error.message);
  }
}

export async function updateManagedUserTrainerLevels(
  userId: string,
  trainerLevels: TrainerLevel[]
) {
  const normalizedTrainerLevels = normalizeTrainerLevels(trainerLevels);

  if (isDevAuthBypassEnabled) {
    mockManagedUsers = mockManagedUsers.map((candidate) => (
      candidate.id === userId
        ? { ...candidate, trainerLevels: normalizedTrainerLevels }
        : candidate
    ));
    return;
  }

  assertSupabaseConfigured();

  const { error } = await supabase.functions.invoke('admin-users', {
    body: {
      action: 'update_trainer_levels',
      userId,
      trainerLevels: normalizedTrainerLevels,
    },
  });

  if (error) {
    throw normalizeAdminUsersError(error.message);
  }
}

export async function updateUserEmail(email: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.updateUser({ email });
  if (error) {
    throw error;
  }

  if (data.user) {
    await ensureProfileForUser(data.user);
  }
}

export async function updateUserPassword(password: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw error;
  }
}

export async function listProfiles(ids?: string[]) {
  if (isDevAuthBypassEnabled) {
    const managedUsers = ids?.length
      ? mockManagedUsers.filter((profile) => ids.includes(profile.id))
      : mockManagedUsers;

    return managedUsers.map<Profile>((profile) => ({
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      role: profile.role,
      trainerLevels: profile.trainerLevels,
      isAdmin: profile.isAdmin,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: null,
      createdAt: profile.createdAt ?? new Date(),
    }));
  }

  assertSupabaseConfigured();
  let query = supabase.from(TABLES.PROFILE_DIRECTORY).select('*').order('display_name');

  if (ids?.length) {
    query = query.in('id', ids);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map(mapDirectoryProfile);
}

export async function getProfile(id: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from(TABLES.PROFILES).select('*').eq('id', id).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapProfile(data) : null;
}

export async function listEvents() {
  if (isDevAuthBypassEnabled) {
    return [...mockEvents];
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapEvent);
}

export async function getEventById(id: string) {
  if (isDevAuthBypassEnabled) {
    return mockEvents.find((event) => event.id === id) ?? null;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapEvent(data) : null;
}

function getEventFormateurPayload(event: Omit<CalendarEvent, 'id' | 'createdAt'>) {
  const assignments = event.formateurAssignments ?? [];

  return {
    formateurs: assignments.length > 0
      ? assignments.map((assignment) => assignment.displayName)
      : event.formateurs ?? [],
    formateur_ids: assignments.map((assignment) => assignment.userId),
    formateur_levels: assignments.map((assignment) => assignment.level),
  };
}

export async function createEvent(event: Omit<CalendarEvent, 'id' | 'createdAt'>) {
  if (isDevAuthBypassEnabled) {
    const createdEvent = {
      ...event,
      id: createPreviewId('preview-event'),
      createdAt: new Date(),
    };
    mockEvents = [...mockEvents, createdEvent];
    return createdEvent;
  }

  assertSupabaseConfigured();
  await ensureCurrentUserCanContribute();
  const formateurPayload = getEventFormateurPayload(event);
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .insert({
      title: event.title,
      description: event.description,
      observations: event.observations ?? null,
      location: event.location ?? null,
      ...formateurPayload,
      date: event.date.toISOString(),
      capacity: event.capacity,
      registration_closes_at: event.registrationClosesAt?.toISOString() ?? null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapEvent(data);
}

export async function updateEvent(
  eventId: string,
  event: Omit<CalendarEvent, 'id' | 'createdAt'>
) {
  if (isDevAuthBypassEnabled) {
    let updatedEvent: CalendarEvent | null = null;
    mockEvents = mockEvents.map((candidate) => {
      if (candidate.id !== eventId) {
        return candidate;
      }
      updatedEvent = { ...candidate, ...event };
      return updatedEvent;
    });
    if (!updatedEvent) {
      throw new Error('Événement introuvable.');
    }
    return updatedEvent;
  }

  assertSupabaseConfigured();
  await ensureCurrentUserCanContribute();
  const formateurPayload = getEventFormateurPayload(event);
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .update({
      title: event.title,
      description: event.description,
      observations: event.observations ?? null,
      location: event.location ?? null,
      ...formateurPayload,
      date: event.date.toISOString(),
      capacity: event.capacity,
      registration_closes_at: event.registrationClosesAt?.toISOString() ?? null,
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapEvent(data);
}

export async function listTrainingSessionSummaries(eventId?: string) {
  if (isDevAuthBypassEnabled) {
    const events = eventId
      ? mockEvents.filter((event) => event.id === eventId)
      : mockEvents;

    return events.map<TrainingSessionSummary>((event) => {
      const registrations = mockTrainingRegistrations.filter(
        (registration) => registration.eventId === event.id
      );
      const mine = registrations.find(
        (registration) =>
          registration.userId === devUser.id && registration.status !== 'cancelled'
      );

      return {
        eventId: event.id,
        capacity: event.capacity,
        registeredCount: registrations.filter(
          (registration) => registration.status === 'registered'
        ).length,
        waitlistedCount: registrations.filter(
          (registration) => registration.status === 'waitlisted'
        ).length,
        myStatus: mine?.status ?? null,
        myAttendance: mine?.status === 'registered' ? mine.attendance : null,
      };
    });
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('get_training_session_summaries', {
    p_event_id: eventId ?? null,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TrainingSummaryRow[]).map((row) => ({
    eventId: row.event_id,
    capacity: row.capacity,
    registeredCount: row.registered_count,
    waitlistedCount: row.waitlisted_count,
    myStatus: row.my_status,
    myAttendance: row.my_attendance,
  }));
}

export async function registerForTraining(eventId: string) {
  if (isDevAuthBypassEnabled) {
    const event = mockEvents.find((candidate) => candidate.id === eventId);
    if (!event) {
      throw new Error('Session introuvable');
    }

    const activeRegistrations = mockTrainingRegistrations.filter(
      (registration) =>
        registration.eventId === eventId && registration.status === 'registered'
    );
    const existing = mockTrainingRegistrations.find(
      (registration) =>
        registration.eventId === eventId && registration.userId === devUser.id
    );

    if (existing && existing.status !== 'cancelled') {
      return existing;
    }

    const now = new Date();
    const nextStatus: TrainingRegistrationStatus =
      activeRegistrations.length < event.capacity ? 'registered' : 'waitlisted';
    const nextRegistration: TrainingRegistration = {
      id: existing?.id ?? createPreviewId('preview-training-registration'),
      eventId,
      userId: devUser.id,
      status: nextStatus,
      attendance: 'pending',
      registeredAt: now,
      updatedAt: now,
    };

    mockTrainingRegistrations = existing
      ? mockTrainingRegistrations.map((registration) =>
          registration.id === existing.id ? nextRegistration : registration
        )
      : [...mockTrainingRegistrations, nextRegistration];

    return nextRegistration;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('register_for_training', {
    p_event_id: eventId,
  });

  if (error) {
    throw error;
  }

  return mapTrainingRegistration(data as TrainingRegistrationRow);
}

export async function cancelTrainingRegistration(eventId: string) {
  if (isDevAuthBypassEnabled) {
    const currentRegistration = mockTrainingRegistrations.find(
      (registration) =>
        registration.eventId === eventId &&
        registration.userId === devUser.id &&
        registration.status !== 'cancelled'
    );

    if (!currentRegistration) {
      throw new Error('Aucune inscription active pour cette session');
    }

    const event = mockEvents.find((candidate) => candidate.id === eventId);
    if (event && event.date.getTime() <= Date.now()) {
      throw new Error(
        'Une inscription ne peut plus être annulée après le début de la session'
      );
    }

    mockTrainingRegistrations = mockTrainingRegistrations.map((registration) =>
      registration.id === currentRegistration.id
        ? {
            ...registration,
            status: 'cancelled',
            attendance: 'pending',
            updatedAt: new Date(),
          }
        : registration
    );

    if (currentRegistration.status === 'registered') {
      const nextWaitlisted = mockTrainingRegistrations
        .filter(
          (registration) =>
            registration.eventId === eventId && registration.status === 'waitlisted'
        )
        .sort(
          (first, second) =>
            first.registeredAt.getTime() - second.registeredAt.getTime()
        )[0];

      if (nextWaitlisted) {
        mockTrainingRegistrations = mockTrainingRegistrations.map((registration) =>
          registration.id === nextWaitlisted.id
            ? { ...registration, status: 'registered', updatedAt: new Date() }
            : registration
        );
      }
    }
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('cancel_training_registration', {
    p_event_id: eventId,
  });

  if (error) {
    throw error;
  }
}

export async function listTrainingParticipants(eventId: string) {
  if (isDevAuthBypassEnabled) {
    const registrations = mockTrainingRegistrations.filter(
      (registration) =>
        registration.eventId === eventId && registration.status !== 'cancelled'
    );

    return registrations.map<TrainingParticipant>((registration) => ({
      registrationId: registration.id,
      userId: registration.userId,
      displayName:
        registration.userId === devUser.id ? devUser.displayName : 'Participant',
      email: registration.userId === devUser.id ? devUser.email : '',
      phone: registration.userId === devUser.id ? devUser.phone : null,
      status: registration.status,
      attendance: registration.attendance,
      registeredAt: registration.registeredAt,
    }));
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('get_training_session_participants', {
    p_event_id: eventId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TrainingParticipantRow[]).map((row) => ({
    registrationId: row.registration_id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    attendance: row.attendance,
    registeredAt: new Date(row.registered_at),
  }));
}

export async function setTrainingAttendance(
  registrationId: string,
  attendance: TrainingAttendanceStatus
) {
  if (isDevAuthBypassEnabled) {
    await ensureCurrentUserIsAdmin();
    mockTrainingRegistrations = mockTrainingRegistrations.map((registration) =>
      registration.id === registrationId
        ? { ...registration, attendance, updatedAt: new Date() }
        : registration
    );
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('set_training_attendance', {
    p_registration_id: registrationId,
    p_attendance: attendance,
  });

  if (error) {
    throw error;
  }
}

export async function setTrainingCapacity(eventId: string, capacity: number) {
  if (isDevAuthBypassEnabled) {
    await ensureCurrentUserIsAdmin();
    const registeredCount = mockTrainingRegistrations.filter(
      (registration) =>
        registration.eventId === eventId && registration.status === 'registered'
    ).length;

    if (capacity < registeredCount) {
      throw new Error(
        `La capacité ne peut pas être inférieure aux ${registeredCount} inscriptions confirmées`
      );
    }

    mockEvents = mockEvents.map((event) =>
      event.id === eventId ? { ...event, capacity } : event
    );

    const waitlisted = mockTrainingRegistrations
      .filter(
        (registration) =>
          registration.eventId === eventId && registration.status === 'waitlisted'
      )
      .sort(
        (first, second) =>
          first.registeredAt.getTime() - second.registeredAt.getTime()
      );
    const availablePlaces = capacity - registeredCount;
    const promotedIds = new Set(
      waitlisted.slice(0, Math.max(0, availablePlaces)).map((registration) => registration.id)
    );
    mockTrainingRegistrations = mockTrainingRegistrations.map((registration) =>
      promotedIds.has(registration.id)
        ? { ...registration, status: 'registered', updatedAt: new Date() }
        : registration
    );
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('set_training_capacity', {
    p_event_id: eventId,
    p_capacity: capacity,
  });

  if (error) {
    throw error;
  }
}

export async function listMyTrainingHistory(userId: string) {
  if (isDevAuthBypassEnabled) {
    return mockTrainingRegistrations
      .filter(
        (registration) =>
          registration.userId === userId && registration.status !== 'cancelled'
      )
      .map<TrainingHistoryItem>((registration) => ({
        ...registration,
        event: mockEvents.find((event) => event.id === registration.eventId)!,
      }))
      .filter((item) => Boolean(item.event))
      .sort((first, second) => second.event.date.getTime() - first.event.date.getTime());
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from(TABLES.TRAINING_REGISTRATIONS)
    .select('*, events(*)')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .order('registered_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).flatMap((row) => {
    const eventRow = row.events as unknown as EventRow | null;
    if (!eventRow) {
      return [];
    }

    const registration = mapTrainingRegistration(row as TrainingRegistrationRow);
    return [{ ...registration, event: mapEvent(eventRow) }];
  });
}

const OFFLINE_DOCUMENT_CACHE = 'flashover78-offline-documents-v1';
const OFFLINE_DOCUMENTS_STORAGE_KEY = 'flashover78-offline-document-metadata';

function filterMockDocuments(filters: DocumentFilters) {
  const query = filters.query?.trim().toLocaleLowerCase('fr') ?? '';
  const referenceDate = new Date();

  return mockResources.filter((resource) => {
    const searchableText = [
      resource.title,
      resource.authorName,
      resource.originalFilename,
      ...resource.tags,
    ]
      .join(' ')
      .toLocaleLowerCase('fr');

    return (
      (!query || searchableText.includes(query)) &&
      (!filters.category || resource.category === filters.category) &&
      (!filters.tag || resource.tags.includes(filters.tag)) &&
      (!filters.favoritesOnly || resource.isFavorite) &&
      (!filters.expirationState ||
        filters.expirationState === 'all' ||
        getDocumentExpirationState(resource.expiresAt, referenceDate) ===
          filters.expirationState)
    );
  });
}

function serializeOfflineResource(resource: Resource) {
  return {
    ...resource,
    effectiveAt: resource.effectiveAt?.toISOString() ?? null,
    expiresAt: resource.expiresAt?.toISOString() ?? null,
    updatedAt: resource.updatedAt.toISOString(),
    createdAt: resource.createdAt.toISOString(),
  };
}

function parseOfflineResource(value: ReturnType<typeof serializeOfflineResource>): Resource {
  return {
    ...value,
    effectiveAt: value.effectiveAt ? new Date(value.effectiveAt) : null,
    expiresAt: value.expiresAt ? new Date(value.expiresAt) : null,
    updatedAt: new Date(value.updatedAt),
    createdAt: new Date(value.createdAt),
    isOfflineSelected: true,
  };
}

function readOfflineDocumentMetadata() {
  if (typeof window === 'undefined') {
    return [] as Resource[];
  }

  try {
    const stored = window.localStorage.getItem(OFFLINE_DOCUMENTS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    return (JSON.parse(stored) as Array<ReturnType<typeof serializeOfflineResource>>)
      .map(parseOfflineResource);
  } catch {
    return [];
  }
}

function writeOfflineDocumentMetadata(resources: Resource[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    OFFLINE_DOCUMENTS_STORAGE_KEY,
    JSON.stringify(resources.map(serializeOfflineResource))
  );
}

function getOfflineCacheUrl(resource: Resource) {
  return `${window.location.origin}/__offline_documents/${resource.id}/${encodeURIComponent(
    resource.versionLabel
  )}`;
}

export async function searchDocuments(filters: DocumentFilters = {}) {
  if (isDevAuthBypassEnabled) {
    return filterMockDocuments(filters);
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('search_documents', {
    p_query: filters.query?.trim() || null,
    p_category: filters.category ?? null,
    p_tag: filters.tag ?? null,
    p_favorites_only: filters.favoritesOnly ?? false,
    p_expiration_state: filters.expirationState ?? 'all',
    p_resource_id: null,
  });

  if (error) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineResources = readOfflineDocumentMetadata();
      const previousMockResources = mockResources;
      mockResources = offlineResources;
      const filtered = filterMockDocuments(filters);
      mockResources = previousMockResources;
      return filtered;
    }
    throw error;
  }

  return ((data ?? []) as ResourceRow[]).map(mapResource);
}

export async function listResources() {
  return searchDocuments();
}

export async function getDocumentById(id: string) {
  if (isDevAuthBypassEnabled) {
    return mockResources.find((resource) => resource.id === id) ?? null;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('search_documents', {
    p_query: null,
    p_category: null,
    p_tag: null,
    p_favorites_only: false,
    p_expiration_state: 'all',
    p_resource_id: id,
  });

  if (error) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return readOfflineDocumentMetadata().find((resource) => resource.id === id) ?? null;
    }
    throw error;
  }

  const row = ((data ?? []) as ResourceRow[])[0];
  return row ? mapResource(row) : null;
}

export async function listDocumentVersions(resourceId: string) {
  if (isDevAuthBypassEnabled) {
    return [...(mockResourceVersions[resourceId] ?? [])];
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('list_document_versions', {
    p_resource_id: resourceId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ResourceVersionRow[]).map(mapResourceVersion);
}

function validateDocumentFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
    throw new Error('Format non autorisé. Utilisez un PDF, document texte ou diaporama.');
  }

  if (file.size < 1) {
    throw new Error('Le document est vide.');
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new Error('Le document dépasse la taille maximale de 20 Mo.');
  }

  return extension;
}

function buildDocumentStoragePath(
  category: ResourceCategory,
  file: File,
  resourceId?: string
) {
  const extension = validateDocumentFile(file);
  const baseName = file.name
    .replace(/\.[^/.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  const folder = RESOURCE_CATEGORY_FOLDER[category];
  const catalogFolder = resourceId ? `catalog/${resourceId}` : 'catalog/new';
  const prefix = folder ? `${folder}/${catalogFolder}` : catalogFolder;
  return `${prefix}/${Date.now()}-${baseName || 'document'}.${extension}`;
}

async function removeUploadedFile(bucket: string, path: string) {
  if (isDevAuthBypassEnabled) {
    return;
  }

  await supabase.storage.from(bucket).remove([path]);
}

export async function createCatalogDocument(input: {
  file: File;
  metadata: DocumentMetadataInput;
}) {
  await ensureCurrentUserCanContribute();
  const bucket = RESOURCE_CATEGORY_BUCKET[input.metadata.category];
  const path = buildDocumentStoragePath(input.metadata.category, input.file);
  await uploadPrivateFile(bucket, path, input.file);

  if (isDevAuthBypassEnabled) {
    const now = new Date();
    const id = createPreviewId('preview-resource');
    const resource: Resource = {
      id,
      title: input.metadata.title,
      category: input.metadata.category,
      fileUrl: `${APP_ROUTES.RESOURCE_DETAIL}/${id}`,
      tags: input.metadata.tags,
      versionLabel: input.metadata.versionLabel,
      authorName: input.metadata.authorName,
      effectiveAt: input.metadata.effectiveAt ?? null,
      expiresAt: input.metadata.expiresAt ?? null,
      originalFilename: input.file.name,
      mimeType: input.file.type || null,
      fileSize: input.file.size,
      bucketId: bucket,
      storagePath: path,
      updatedAt: now,
      isFavorite: false,
      isOfflineSelected: false,
      versionCount: 1,
      createdAt: now,
    };
    mockResources = [resource, ...mockResources];
    mockResourceVersions[id] = [
      {
        id: createPreviewId('preview-resource-version'),
        versionLabel: input.metadata.versionLabel,
        bucketId: bucket,
        storagePath: path,
        originalFilename: input.file.name,
        mimeType: input.file.type || null,
        fileSize: input.file.size,
        authorName: input.metadata.authorName,
        effectiveAt: input.metadata.effectiveAt ?? null,
        expiresAt: input.metadata.expiresAt ?? null,
        createdAt: now,
      },
    ];
    return resource;
  }

  try {
    const { data, error } = await supabase.rpc('create_document', {
      p_title: input.metadata.title,
      p_category: input.metadata.category,
      p_tags: input.metadata.tags,
      p_version_label: input.metadata.versionLabel,
      p_author_name: input.metadata.authorName,
      p_effective_at: input.metadata.effectiveAt?.toISOString().slice(0, 10) ?? null,
      p_expires_at: input.metadata.expiresAt?.toISOString().slice(0, 10) ?? null,
      p_bucket_id: bucket,
      p_storage_path: path,
      p_original_filename: input.file.name,
      p_mime_type: input.file.type || null,
      p_file_size: input.file.size,
    });

    if (error) {
      throw error;
    }

    return getDocumentById(data as string);
  } catch (error) {
    await removeUploadedFile(bucket, path);
    throw error;
  }
}

export async function replaceDocumentVersion(input: {
  resource: Resource;
  file: File;
  versionLabel: string;
  authorName: string;
  effectiveAt?: Date | null;
  expiresAt?: Date | null;
}) {
  await ensureCurrentUserCanContribute();
  const path = buildDocumentStoragePath(
    input.resource.category,
    input.file,
    input.resource.id
  );
  await uploadPrivateFile(input.resource.bucketId, path, input.file);

  if (isDevAuthBypassEnabled) {
    const now = new Date();
    const version: ResourceVersion = {
      id: createPreviewId('preview-resource-version'),
      versionLabel: input.versionLabel,
      bucketId: input.resource.bucketId,
      storagePath: path,
      originalFilename: input.file.name,
      mimeType: input.file.type || null,
      fileSize: input.file.size,
      authorName: input.authorName,
      effectiveAt: input.effectiveAt ?? null,
      expiresAt: input.expiresAt ?? null,
      createdAt: now,
    };
    mockResourceVersions[input.resource.id] = [
      version,
      ...(mockResourceVersions[input.resource.id] ?? []),
    ];
    mockResources = mockResources.map((resource) =>
      resource.id === input.resource.id
        ? {
            ...resource,
            versionLabel: input.versionLabel,
            authorName: input.authorName,
            effectiveAt: input.effectiveAt ?? null,
            expiresAt: input.expiresAt ?? null,
            originalFilename: input.file.name,
            mimeType: input.file.type || null,
            fileSize: input.file.size,
            storagePath: path,
            updatedAt: now,
            versionCount: resource.versionCount + 1,
          }
        : resource
    );
    return getDocumentById(input.resource.id);
  }

  try {
    const { error } = await supabase.rpc('register_document_version', {
      p_resource_id: input.resource.id,
      p_version_label: input.versionLabel,
      p_author_name: input.authorName,
      p_effective_at: input.effectiveAt?.toISOString().slice(0, 10) ?? null,
      p_expires_at: input.expiresAt?.toISOString().slice(0, 10) ?? null,
      p_bucket_id: input.resource.bucketId,
      p_storage_path: path,
      p_original_filename: input.file.name,
      p_mime_type: input.file.type || null,
      p_file_size: input.file.size,
    });

    if (error) {
      throw error;
    }

    return getDocumentById(input.resource.id);
  } catch (error) {
    await removeUploadedFile(input.resource.bucketId, path);
    throw error;
  }
}

export async function updateDocumentMetadata(
  resourceId: string,
  metadata: Omit<DocumentMetadataInput, 'versionLabel'>
) {
  await ensureCurrentUserCanContribute();

  if (isDevAuthBypassEnabled) {
    mockResources = mockResources.map((resource) =>
      resource.id === resourceId
        ? {
            ...resource,
            ...metadata,
            effectiveAt: metadata.effectiveAt ?? null,
            expiresAt: metadata.expiresAt ?? null,
            updatedAt: new Date(),
          }
        : resource
    );
    return getDocumentById(resourceId);
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('update_document_metadata', {
    p_resource_id: resourceId,
    p_title: metadata.title,
    p_category: metadata.category,
    p_tags: metadata.tags,
    p_author_name: metadata.authorName,
    p_effective_at: metadata.effectiveAt?.toISOString().slice(0, 10) ?? null,
    p_expires_at: metadata.expiresAt?.toISOString().slice(0, 10) ?? null,
  });

  if (error) {
    throw error;
  }

  return getDocumentById(resourceId);
}

export async function toggleDocumentFavorite(resourceId: string) {
  if (isDevAuthBypassEnabled) {
    let nextFavorite = false;
    mockResources = mockResources.map((resource) => {
      if (resource.id !== resourceId) {
        return resource;
      }
      nextFavorite = !resource.isFavorite;
      return { ...resource, isFavorite: nextFavorite };
    });
    return nextFavorite;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('toggle_document_favorite', {
    p_resource_id: resourceId,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function getDocumentDownloadUrl(resource: Resource, download = false) {
  if (isDevAuthBypassEnabled) {
    const content = [
      resource.title,
      `Version ${resource.versionLabel}`,
      `Auteur : ${resource.authorName || 'Non renseigné'}`,
      '',
      'Document de démonstration Flashover78.',
    ].join('\n');
    return `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.storage
    .from(resource.bucketId)
    .createSignedUrl(resource.storagePath, 60 * 30, { download });

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function getDocumentVersionDownloadUrl(
  version: ResourceVersion,
  download = false
) {
  if (isDevAuthBypassEnabled) {
    return `data:text/plain;charset=utf-8,${encodeURIComponent(
      `Archive documentaire Flashover78\nVersion ${version.versionLabel}\n${version.originalFilename}`
    )}`;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.storage
    .from(version.bucketId)
    .createSignedUrl(version.storagePath, 60 * 30, { download });

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function cacheDocumentForOffline(resource: Resource) {
  if (typeof window === 'undefined' || !('caches' in window)) {
    throw new Error('Le stockage hors ligne n’est pas disponible sur cet appareil.');
  }

  const url = await getDocumentDownloadUrl(resource);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Impossible de télécharger le document pour le mode hors ligne.');
  }

  const cache = await window.caches.open(OFFLINE_DOCUMENT_CACHE);
  const existingKeys = await cache.keys();
  await Promise.all(
    existingKeys
      .filter((request) =>
        request.url.includes(`/__offline_documents/${resource.id}/`)
      )
      .map((request) => cache.delete(request))
  );
  await cache.put(getOfflineCacheUrl(resource), response);

  const storedResources = readOfflineDocumentMetadata().filter(
    (candidate) => candidate.id !== resource.id
  );
  writeOfflineDocumentMetadata([
    { ...resource, isOfflineSelected: true },
    ...storedResources,
  ]);

  if (isDevAuthBypassEnabled) {
    mockResources = mockResources.map((candidate) =>
      candidate.id === resource.id
        ? { ...candidate, isOfflineSelected: true }
        : candidate
    );
    return;
  }

  const { error } = await supabase.rpc('set_document_offline_selected', {
    p_resource_id: resource.id,
    p_selected: true,
  });

  if (error) {
    throw error;
  }
}

export async function removeDocumentFromOffline(resource: Resource) {
  if (typeof window !== 'undefined' && 'caches' in window) {
    const cache = await window.caches.open(OFFLINE_DOCUMENT_CACHE);
    const keys = await cache.keys();
    await Promise.all(
      keys
        .filter((request) =>
          request.url.includes(`/__offline_documents/${resource.id}/`)
        )
        .map((request) => cache.delete(request))
    );
    writeOfflineDocumentMetadata(
      readOfflineDocumentMetadata().filter(
        (candidate) => candidate.id !== resource.id
      )
    );
  }

  if (isDevAuthBypassEnabled) {
    mockResources = mockResources.map((candidate) =>
      candidate.id === resource.id
        ? { ...candidate, isOfflineSelected: false }
        : candidate
    );
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('set_document_offline_selected', {
    p_resource_id: resource.id,
    p_selected: false,
  });

  if (error) {
    throw error;
  }
}

export async function getCachedDocumentUrl(resource: Resource) {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return null;
  }

  const cache = await window.caches.open(OFFLINE_DOCUMENT_CACHE);
  const response = await cache.match(getOfflineCacheUrl(resource));
  if (!response) {
    return null;
  }

  return URL.createObjectURL(await response.blob());
}

async function fetchCarpoolContext(tripRows: CarpoolTripRow[]) {
  const eventIds = Array.from(new Set(tripRows.map((trip) => trip.event_id).filter(Boolean))) as string[];
  const driverIds = Array.from(new Set(tripRows.map((trip) => trip.driver_id)));
  const tripIds = tripRows.map((trip) => trip.id);

  const [events, profiles, requestRows] = await Promise.all([
    eventIds.length
      ? supabase.from(TABLES.EVENTS).select('*').in('id', eventIds)
      : Promise.resolve({ data: [], error: null }),
    driverIds.length
      ? supabase.from(TABLES.PROFILE_DIRECTORY).select('*').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    tripIds.length
      ? supabase
          .from(TABLES.CARPOOL_REQUESTS)
          .select('*')
          .in('trip_id', tripIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (events.error) {
    throw events.error;
  }
  if (profiles.error) {
    throw profiles.error;
  }
  if (requestRows.error) {
    throw requestRows.error;
  }

  const requesterIds = Array.from(new Set((requestRows.data ?? []).map((row) => row.requester_id)));
  const requesterProfiles = requesterIds.length
    ? await supabase.from(TABLES.PROFILE_DIRECTORY).select('*').in('id', requesterIds)
    : { data: [], error: null };

  if (requesterProfiles.error) {
    throw requesterProfiles.error;
  }

  const eventMap = new Map((events.data ?? []).map((row) => [row.id, mapEvent(row)]));
  const profileMap = new Map((profiles.data ?? []).map((row) => [row.id, mapDirectoryProfile(row)]));
  const requesterMap = new Map((requesterProfiles.data ?? []).map((row) => [row.id, mapDirectoryProfile(row)]));
  const requestsByTrip = new Map<string, CarpoolRequest[]>();

  (requestRows.data ?? []).forEach((row) => {
    const requester = requesterMap.get(row.requester_id);
    const request: CarpoolRequest = {
      id: row.id,
      tripId: row.trip_id,
      requesterId: row.requester_id,
      requesterName: requester?.displayName ?? 'Formateur',
      requesterEmail: requester?.email ?? '',
      requesterPhone: requester?.phone ?? null,
      seatsRequested: row.seats_requested,
      message: row.message,
      status: ensureValidStatus(row.status, CARPOOL_REQUEST_STATUSES, 'pending'),
      createdAt: new Date(row.created_at),
    };

    requestsByTrip.set(row.trip_id, [...(requestsByTrip.get(row.trip_id) ?? []), request]);
  });

  return { eventMap, profileMap, requestsByTrip };
}

function mapCarpoolTrip(
  row: CarpoolTripRow,
  context: Awaited<ReturnType<typeof fetchCarpoolContext>>
): CarpoolTrip {
  const event = row.event_id ? context.eventMap.get(row.event_id) : null;
  const driver = context.profileMap.get(row.driver_id);

  return {
    id: row.id,
    eventId: row.event_id,
    eventTitle: event?.title ?? null,
    eventLocation: event?.location ?? null,
    eventDate: event?.date ?? null,
    driverId: row.driver_id,
    driverName: driver?.displayName ?? 'Conducteur',
    driverEmail: driver?.email ?? '',
    driverPhone: driver?.phone ?? null,
    departureCity: row.departure_city,
    departureLabel: row.departure_label,
    departureDatetime: new Date(row.departure_datetime),
    arrivalLabel: row.arrival_label,
    availableSeats: row.available_seats,
    totalSeats: row.total_seats,
    priceNote: row.price_note,
    vehicleNote: row.vehicle_note,
    luggageNote: row.luggage_note,
    notes: row.notes,
    status: ensureValidStatus(row.status, CARPOOL_TRIP_STATUSES, 'open'),
    createdAt: new Date(row.created_at),
    requests: context.requestsByTrip.get(row.id) ?? [],
  };
}

export async function listTrips(eventId?: string) {
  if (isDevAuthBypassEnabled) {
    return mockTrips.filter((trip) => !eventId || trip.eventId === eventId);
  }

  assertSupabaseConfigured();
  let query = supabase
    .from(TABLES.CARPOOL_TRIPS)
    .select('*')
    .order('departure_datetime', { ascending: true });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const tripRows = data ?? [];
  const context = await fetchCarpoolContext(tripRows);
  return tripRows.map((row) => mapCarpoolTrip(row, context));
}

export async function getTripById(id: string) {
  if (isDevAuthBypassEnabled) {
    return mockTrips.find((trip) => trip.id === id) ?? null;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.from(TABLES.CARPOOL_TRIPS).select('*').eq('id', id).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const context = await fetchCarpoolContext([data]);
  const trip = mapCarpoolTrip(data, context);
  const { data: contacts, error: contactsError } = await supabase.rpc('get_carpool_contacts', {
    p_trip_id: id,
  });

  if (contactsError) {
    throw contactsError;
  }

  const contactMap = new Map(
    ((contacts ?? []) as CarpoolContactRow[]).map((contact) => [contact.user_id, contact])
  );
  const driverContact = contactMap.get(trip.driverId);

  return {
    ...trip,
    driverEmail: driverContact?.email ?? '',
    driverPhone: driverContact?.phone ?? null,
    requests: trip.requests.map((request) => {
      const requesterContact = contactMap.get(request.requesterId);
      return {
        ...request,
        requesterEmail: requesterContact?.email ?? '',
        requesterPhone: requesterContact?.phone ?? null,
      };
    }),
  };
}

export async function createTrip(input: {
  eventId?: string | null;
  driverId: string;
  departureCity: string;
  departureLabel: string;
  departureDatetime: Date;
  arrivalLabel: string;
  totalSeats: number;
  priceNote?: string;
  vehicleNote?: string;
  luggageNote?: string;
  notes?: string;
}) {
  if (isDevAuthBypassEnabled) {
    const event = mockEvents.find((candidate) => candidate.id === input.eventId);
    const createdTrip: CarpoolTrip = {
      id: createPreviewId('preview-trip'),
      eventId: input.eventId ?? null,
      eventTitle: event?.title ?? null,
      eventLocation: event?.location ?? null,
      eventDate: event?.date ?? null,
      driverId: devUser.id,
      driverName: devUser.displayName,
      driverEmail: devUser.email,
      driverPhone: devUser.phone,
      departureCity: input.departureCity,
      departureLabel: input.departureLabel,
      departureDatetime: input.departureDatetime,
      arrivalLabel: input.arrivalLabel,
      availableSeats: input.totalSeats,
      totalSeats: input.totalSeats,
      priceNote: input.priceNote ?? null,
      vehicleNote: input.vehicleNote ?? null,
      luggageNote: input.luggageNote ?? null,
      notes: input.notes ?? null,
      status: 'open',
      createdAt: new Date(),
      requests: [],
    };
    mockTrips = [...mockTrips, createdTrip];
    return createdTrip;
  }

  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from(TABLES.CARPOOL_TRIPS)
    .insert({
      event_id: input.eventId ?? null,
      driver_id: input.driverId,
      departure_city: input.departureCity,
      departure_label: input.departureLabel,
      departure_datetime: input.departureDatetime.toISOString(),
      arrival_label: input.arrivalLabel,
      available_seats: input.totalSeats,
      total_seats: input.totalSeats,
      price_note: input.priceNote ?? null,
      vehicle_note: input.vehicleNote ?? null,
      luggage_note: input.luggageNote ?? null,
      notes: input.notes ?? null,
      status: 'open',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  const context = await fetchCarpoolContext([data]);
  return mapCarpoolTrip(data, context);
}

export async function cancelTrip(tripId: string) {
  if (isDevAuthBypassEnabled) {
    mockTrips = mockTrips.map((trip) => (
      trip.id === tripId ? { ...trip, status: 'cancelled' } : trip
    ));
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('cancel_carpool_trip', {
    p_trip_id: tripId,
  });

  if (error) {
    throw error;
  }
}

export async function createTripRequest(input: {
  tripId: string;
  requesterId: string;
  seatsRequested: number;
  message?: string;
}) {
  if (isDevAuthBypassEnabled) {
    const trip = mockTrips.find((candidate) => candidate.id === input.tripId);
    if (!trip) {
      throw new Error('Trajet introuvable');
    }

    const request: CarpoolRequest = {
      id: createPreviewId('preview-request'),
      tripId: input.tripId,
      requesterId: input.requesterId,
      requesterName: devUser.displayName,
      requesterEmail: devUser.email,
      requesterPhone: devUser.phone,
      seatsRequested: input.seatsRequested,
      message: input.message ?? null,
      status: 'pending',
      createdAt: new Date(),
    };
    mockTrips = mockTrips.map((candidate) => (
      candidate.id === input.tripId
        ? { ...candidate, requests: [...candidate.requests, request] }
        : candidate
    ));
    return request;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('create_carpool_request', {
    p_trip_id: input.tripId,
    p_seats_requested: input.seatsRequested,
    p_message: input.message ?? null,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function acceptTripRequest(requestId: string) {
  if (isDevAuthBypassEnabled) {
    mockTrips = mockTrips.map((trip) => {
      const request = trip.requests.find((candidate) => candidate.id === requestId);
      if (!request) {
        return trip;
      }
      if (trip.availableSeats < request.seatsRequested) {
        throw new Error('Plus assez de places disponibles.');
      }
      const availableSeats = trip.availableSeats - request.seatsRequested;
      return {
        ...trip,
        availableSeats,
        status: availableSeats === 0 ? 'full' : 'open',
        requests: trip.requests.map((candidate) => (
          candidate.id === requestId ? { ...candidate, status: 'accepted' } : candidate
        )),
      };
    });
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('respond_to_carpool_request', {
    p_request_id: requestId,
    p_status: 'accepted',
  });

  if (error) {
    throw error;
  }
}

export async function rejectTripRequest(requestId: string) {
  if (isDevAuthBypassEnabled) {
    mockTrips = mockTrips.map((trip) => ({
      ...trip,
      requests: trip.requests.map((request) => (
        request.id === requestId ? { ...request, status: 'rejected' } : request
      )),
    }));
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('respond_to_carpool_request', {
    p_request_id: requestId,
    p_status: 'rejected',
  });

  if (error) {
    throw error;
  }
}

export async function cancelTripRequest(requestId: string) {
  if (isDevAuthBypassEnabled) {
    mockTrips = mockTrips.map((trip) => {
      const request = trip.requests.find((candidate) => candidate.id === requestId);
      if (!request) {
        return trip;
      }
      const restoredSeats = request.status === 'accepted'
        ? Math.min(trip.totalSeats, trip.availableSeats + request.seatsRequested)
        : trip.availableSeats;
      return {
        ...trip,
        availableSeats: restoredSeats,
        status: trip.status === 'cancelled' ? 'cancelled' : 'open',
        requests: trip.requests.map((candidate) => (
          candidate.id === requestId ? { ...candidate, status: 'cancelled' } : candidate
        )),
      };
    });
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('cancel_carpool_request', {
    p_request_id: requestId,
  });

  if (error) {
    throw error;
  }
}

export async function listMyTrips(userId: string) {
  if (isDevAuthBypassEnabled) {
    return mockTrips.filter((trip) => trip.driverId === userId);
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from(TABLES.CARPOOL_TRIPS)
    .select('*')
    .eq('driver_id', userId)
    .order('departure_datetime', { ascending: true });

  if (error) {
    throw error;
  }

  const tripRows = data ?? [];
  const context = await fetchCarpoolContext(tripRows);
  return tripRows.map((row) => mapCarpoolTrip(row, context));
}

export async function listMyRequests(userId: string): Promise<CarpoolMyRequest[]> {
  if (isDevAuthBypassEnabled) {
    const requests = mockTrips.flatMap((trip) => (
      trip.requests
        .filter((request) => request.requesterId === userId)
        .map((request) => ({ ...request, trip }))
    ));
    return [...mockMyRequests, ...requests];
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from(TABLES.CARPOOL_REQUESTS)
    .select('*')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const tripIds = Array.from(new Set((data ?? []).map((request) => request.trip_id)));
  const trips = tripIds.length ? await listTrips() : [];
  const tripMap = new Map(trips.map((trip) => [trip.id, trip]));

  return (data ?? []).map((row) => ({
    id: row.id,
    tripId: row.trip_id,
    requesterId: row.requester_id,
    requesterName: '',
    requesterEmail: '',
    requesterPhone: null,
    seatsRequested: row.seats_requested,
    message: row.message,
    status: ensureValidStatus(row.status, CARPOOL_REQUEST_STATUSES, 'pending'),
    createdAt: new Date(row.created_at),
    trip: tripMap.get(row.trip_id) ?? null,
  }));
}

function normalizeAuthError(message: string) {
  if (message.includes('Invalid login credentials')) {
    return new Error('Email ou mot de passe incorrect');
  }
  if (message.includes('Password should be at least')) {
    return new Error('Le mot de passe doit contenir au moins 6 caractères');
  }
  if (message.includes('User already registered')) {
    return new Error('Cette adresse email est déjà utilisée');
  }
  if (message.includes('Email not confirmed')) {
    return new Error('Confirmez votre email avant de vous connecter.');
  }
  if (
    message.includes('email rate limit exceeded') ||
    message.includes('over_email_send_rate_limit')
  ) {
    return new Error(
      "Trop de demandes d'inscription ont été envoyées. Attendez quelques minutes avant de réessayer."
    );
  }
  if (message.includes('For security purposes, you can only request this after')) {
    return new Error(
      "Une demande d'inscription vient déjà d'être envoyée. Attendez un instant avant de recommencer."
    );
  }
  if (message.includes('Email address not authorized')) {
    return new Error(
      "Cette adresse email n'est pas autorisée par la configuration SMTP actuelle de Supabase."
    );
  }
  if (
    message.includes('Auth session missing') ||
    message.includes('Invalid Refresh Token') ||
    message.includes('refresh_token_not_found')
  ) {
    return new Error(
      'Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien.'
    );
  }
  if (
    message.includes('New password should be different') ||
    message.includes('same password')
  ) {
    return new Error('Choisissez un mot de passe différent de votre ancien mot de passe.');
  }
  if (message.includes('Password should be at least')) {
    return new Error('Le mot de passe ne respecte pas la longueur minimale requise.');
  }
  return new Error(message);
}

export function getRouteToTrip(tripId: string) {
  return `${APP_ROUTES.CARPOOL}/${tripId}`;
}
