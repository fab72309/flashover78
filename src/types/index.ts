export type ResourceCategory =
  | 'SDIS78'
  | 'GDO_GTO'
  | 'LECTURES'
  | 'AUTRE'
  | 'BRULAGE_TDL_FO'
  | 'BRULAGE_MAF';
export type DocumentExpirationState = 'all' | 'valid' | 'expiring' | 'expired';
export type CarpoolTripStatus = 'open' | 'full' | 'cancelled' | 'completed';
export type CarpoolRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type TrainingRegistrationStatus = 'registered' | 'waitlisted' | 'cancelled';
export type TrainingAttendanceStatus = 'pending' | 'present' | 'absent';
export type AppRole = 'member' | 'contributor' | 'admin';
export type TrainerLevel = 'RSFR' | 'FOR INC' | 'FOR BAT';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  trainerLevels: TrainerLevel[];
  isAdmin: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  photoURL?: string | null;
  provider: string;
}

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  trainerLevels: TrainerLevel[];
  isAdmin: boolean;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  createdAt: Date;
}

export interface ManagedUser {
  id: string;
  email: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  role: AppRole;
  trainerLevels: TrainerLevel[];
  isAdmin: boolean;
  createdAt?: Date | null;
  lastSignInAt?: Date | null;
  emailConfirmedAt?: Date | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  observations?: string | null;
  location?: string | null;
  formateurs?: string[];
  formateurAssignments?: CalendarFormateurAssignment[];
  date: Date;
  capacity: number;
  registrationClosesAt?: Date | null;
  createdAt: Date;
}

export interface CalendarFormateurAssignment {
  userId: string;
  displayName: string;
  level: TrainerLevel;
}

export interface TrainingSessionSummary {
  eventId: string;
  capacity: number;
  registeredCount: number;
  waitlistedCount: number;
  myStatus: TrainingRegistrationStatus | null;
  myAttendance: TrainingAttendanceStatus | null;
}

export interface TrainingRegistration {
  id: string;
  eventId: string;
  userId: string;
  status: TrainingRegistrationStatus;
  attendance: TrainingAttendanceStatus;
  registeredAt: Date;
  updatedAt: Date;
}

export interface TrainingParticipant {
  registrationId: string;
  userId: string;
  displayName: string;
  email: string;
  phone?: string | null;
  status: TrainingRegistrationStatus;
  attendance: TrainingAttendanceStatus;
  registeredAt: Date;
}

export interface TrainingHistoryItem extends TrainingRegistration {
  event: CalendarEvent;
}

export interface Resource {
  id: string;
  title: string;
  category: ResourceCategory;
  fileUrl: string;
  tags: string[];
  versionLabel: string;
  authorName: string;
  effectiveAt?: Date | null;
  expiresAt?: Date | null;
  originalFilename: string;
  mimeType?: string | null;
  fileSize?: number | null;
  bucketId: string;
  storagePath: string;
  updatedAt: Date;
  isFavorite: boolean;
  isOfflineSelected: boolean;
  versionCount: number;
  createdAt: Date;
}

export interface ResourceVersion {
  id: string;
  versionLabel: string;
  bucketId: string;
  storagePath: string;
  originalFilename: string;
  mimeType?: string | null;
  fileSize: number;
  authorName: string;
  effectiveAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface DocumentFilters {
  query?: string;
  category?: ResourceCategory;
  tag?: string;
  favoritesOnly?: boolean;
  expirationState?: DocumentExpirationState;
}

export interface DocumentMetadataInput {
  title: string;
  category: ResourceCategory;
  tags: string[];
  versionLabel: string;
  authorName: string;
  effectiveAt?: Date | null;
  expiresAt?: Date | null;
}

export interface CarpoolRequest {
  id: string;
  tripId: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string | null;
  seatsRequested: number;
  message?: string | null;
  status: CarpoolRequestStatus;
  createdAt: Date;
}

export interface CarpoolMyRequest extends CarpoolRequest {
  trip: CarpoolTrip | null;
}

export interface CarpoolTrip {
  id: string;
  eventId?: string | null;
  eventTitle?: string | null;
  eventLocation?: string | null;
  eventDate?: Date | null;
  driverId: string;
  driverName: string;
  driverEmail: string;
  driverPhone?: string | null;
  departureCity: string;
  departureLabel: string;
  departureDatetime: Date;
  arrivalLabel: string;
  availableSeats: number;
  totalSeats: number;
  priceNote?: string | null;
  vehicleNote?: string | null;
  luggageNote?: string | null;
  notes?: string | null;
  status: CarpoolTripStatus;
  createdAt: Date;
  requests: CarpoolRequest[];
}

export interface CarpoolFilters {
  search: string;
  eventId?: string;
  departureCity?: string;
  location?: string;
  onlyAvailable?: boolean;
  date?: string;
}

export type MedicalFollowUpDay = 'Journée complète' | 'Matin' | 'Après-Midi';
export type MedicalFollowUpWeather = 'Pluie' | 'Soleil' | 'Couvert' | 'Neige';
export type MedicalFollowUpHydration = '0 l' | '0,5 l' | '1 l' | '1,5 l' | '2 l' | '2,5 l';
export type MedicalFollowUpLocation =
  | 'MLB TdL / FO'
  | 'MLB TdL'
  | 'MLB FO'
  | 'MLB MaF'
  | 'Friche batimentaire'
  | 'Autre :';
export type MedicalFollowUpTraining = 'FI' | 'FAE' | 'FMPA GPT/CIS' | 'Feux réels' | 'FMPA Formateurs' | 'Autre :';
export type MedicalFollowUpTrainerRole = TrainerLevel;
export type MedicalFollowUpBurningType =
  | 'Observation/attaque de l’extérieur'
  | 'Observation de l’intérieur'
  | 'Tableau de bord'
  | 'MEA'
  | 'Progression / Attaque'
  | 'Feux réels';
export type MedicalFollowUpAirDuration = '30' | '60' | '90';
export type MedicalFollowUpYesNo = 'OUI' | 'NON';
export type MedicalFollowUpShower = 'Oui' | 'Non';
export type MedicalFollowUpEmailStatus = 'pending' | 'sent' | 'failed';

export interface MedicalFollowUpFormData {
  trainerLevel: TrainerLevel;
  nomFormateur: string;
  prenomFormateur: string;
  emailFormateur: string;
  dateFormation: string;
  journee: MedicalFollowUpDay | '';
  conditionsMeteo: MedicalFollowUpWeather | '';
  temperature: string;
  hydratationAvantBrulage: MedicalFollowUpHydration | '';
  hydratationApresBrulage: MedicalFollowUpHydration | '';
  lieuFormation: MedicalFollowUpLocation | '';
  lieuFormationAutre: string;
  formation: MedicalFollowUpTraining | '';
  formationAutre: string;
  roleFormateur: MedicalFollowUpTrainerRole | '';
  roleFormateurAutre: string;
  typeBrulage: MedicalFollowUpBurningType | '';
  typeBrulageAutre: string;
  tempsAri: MedicalFollowUpAirDuration | '';
  decontaminationPostBrulage: MedicalFollowUpYesNo | '';
  doucheDansHeure: MedicalFollowUpShower | '';
  observationsPostBrulage: string[];
  observationsPostBrulageAutre: string;
  observations: string;
}

export interface MedicalFollowUpRecord extends MedicalFollowUpFormData {
  id: string;
  userId: string;
  createdAt: Date;
  emailStatus: MedicalFollowUpEmailStatus;
  emailSentAt?: Date | null;
  emailProviderId?: string | null;
  emailError?: string | null;
  updatedAt: Date;
}

export type MainCouranteSite =
  | 'Montigny le Bretonneux'
  | 'Poissy'
  | 'Feux réels en friche bâtimentaire';
export type MainCouranteWindStrength = '1' | '2' | '3' | '4' | '5';
export type MainCouranteWindDirection = 'Arrière' | 'Avant' | 'Latéral';
export type MainCouranteWeather = 'Pluie' | 'Soleil' | 'Couvert' | 'Neige';
export type MainCouranteMontignySession =
  | '1/2 journée TdL'
  | '1/2 journée FO'
  | 'Journée TdL / FO';
export type MainCourantePoissySession =
  | '1/2 journée Progression'
  | 'Journée Progression'
  | 'Journée MEA';
export type MainCouranteFricheSession = 'FI' | 'FAE' | 'FMA' | 'FMA formateurs';
export type MainCouranteSession =
  | MainCouranteMontignySession
  | MainCourantePoissySession
  | MainCouranteFricheSession;
export type MainCouranteTraining =
  | 'FI SPV'
  | 'FI SPP'
  | 'FAE CE'
  | 'FMPA'
  | 'MEA'
  | 'FMPA Formateur'
  | 'Formation de formateurs';
export type MainCouranteQuantity = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
export type MainCouranteWasteLevel = '1' | '2' | '3' | '4' | '5';
export type MainCouranteCartState = 'Vide' | 'OK';

export interface MainCouranteFormData {
  emailFormateur: string;
  dateMainCourante: string;
  vent: MainCouranteWindStrength | '';
  sensDuVent: MainCouranteWindDirection | '';
  meteo: MainCouranteWeather[];
  formateurs: string[];
  siteFormation: MainCouranteSite | '';
  typeSession: MainCouranteSession | '';
  formation: MainCouranteTraining | '';
  citerneGaz: MainCouranteQuantity | '';
  panneauxBois: MainCouranteQuantity | '';
  palettes: MainCouranteQuantity | '';
  masquesFfp3: MainCouranteQuantity | '';
  gantsNitrile: MainCouranteQuantity | '';
  benneDechet: MainCouranteWasteLevel | '';
  chariotFoyerDemarrage: MainCouranteCartState[];
  observationsDifficultes: string;
  reparationsMateriel: string;
}

export interface MainCouranteRecord extends MainCouranteFormData {
  id: string;
  userId: string;
  pdfStoragePath: string;
  pdfFilename: string;
  pdfFileSize: number;
  createdAt: Date;
  updatedAt: Date;
}
