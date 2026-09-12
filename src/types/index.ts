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
