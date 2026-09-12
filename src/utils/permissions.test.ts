import { describe, expect, it } from 'vitest';
import { canContribute, hasRole, isAdministrator } from './permissions';

describe('role hierarchy', () => {
  it('keeps members read-only outside carpool interactions', () => {
    const user = { role: 'member' as const };
    expect(hasRole(user, 'member')).toBe(true);
    expect(canContribute(user)).toBe(false);
    expect(isAdministrator(user)).toBe(false);
  });

  it('gives contributors member and contribution capabilities', () => {
    const user = { role: 'contributor' as const };
    expect(hasRole(user, 'member')).toBe(true);
    expect(canContribute(user)).toBe(true);
    expect(isAdministrator(user)).toBe(false);
  });

  it('gives administrators every capability', () => {
    const user = { role: 'admin' as const };
    expect(hasRole(user, 'member')).toBe(true);
    expect(canContribute(user)).toBe(true);
    expect(isAdministrator(user)).toBe(true);
  });
});
