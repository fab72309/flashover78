import type { AppRole, AppUser } from '../types';

const ROLE_RANK: Record<AppRole, number> = {
  member: 10,
  contributor: 20,
  admin: 30,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  member: 'Membre',
  contributor: 'Contributeur',
  admin: 'Administrateur',
};

export function hasRole(user: Pick<AppUser, 'role'> | null | undefined, requiredRole: AppRole) {
  return Boolean(user && ROLE_RANK[user.role] >= ROLE_RANK[requiredRole]);
}

export function canContribute(user: Pick<AppUser, 'role'> | null | undefined) {
  return hasRole(user, 'contributor');
}

export function isAdministrator(user: Pick<AppUser, 'role'> | null | undefined) {
  return hasRole(user, 'admin');
}
