import type { AppUser } from '../types';

const isLocalPreviewHost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const isTestEnvironment = import.meta.env.MODE === 'test';

export const isDevAuthBypassEnabled =
  isTestEnvironment ||
  (
    String(import.meta.env.VITE_DEV_AUTH_BYPASS || 'false') === 'true' &&
    (import.meta.env.DEV || isLocalPreviewHost)
  );

const devUserDisplayName = import.meta.env.VITE_DEV_USER_NAME || 'Mode Dev';
const [devFirstName = 'Mode', ...devLastNameParts] = devUserDisplayName.split(' ');
const configuredDevRole = import.meta.env.VITE_DEV_USER_ROLE;
const devUserRole: AppUser['role'] =
  configuredDevRole === 'member' || configuredDevRole === 'contributor' || configuredDevRole === 'admin'
    ? configuredDevRole
    : String(import.meta.env.VITE_DEV_USER_ADMIN || 'false') === 'true'
      ? 'admin'
      : 'member';
const configuredTrainerLevels = String(import.meta.env.VITE_DEV_USER_TRAINER_LEVELS || 'RSFR')
  .split(',')
  .map((level) => level.trim().toUpperCase())
  .filter((level): level is AppUser['trainerLevels'][number] =>
    level === 'RSFR' || level === 'FOR INC' || level === 'FOR BAT'
  );

export const devUser: AppUser = {
  id: 'dev-user-flashover78',
  email: import.meta.env.VITE_DEV_USER_EMAIL || 'dev@flashover78.local',
  displayName: devUserDisplayName,
  role: devUserRole,
  trainerLevels: configuredTrainerLevels.length > 0 ? configuredTrainerLevels : ['RSFR'],
  isAdmin: devUserRole === 'admin',
  firstName: devFirstName,
  lastName: devLastNameParts.join(' ') || 'Dev',
  phone: null,
  photoURL: null,
  provider: 'dev',
};
