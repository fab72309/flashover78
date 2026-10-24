import { describe, expect, it } from 'vitest';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { resolveOfflineAppUser } from './supabaseService';

describe('offline auth fallback', () => {
  it('fails closed for qualifications when the profile cannot be revalidated', () => {
    const authUser = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'member@example.test',
      user_metadata: { trainer_levels: ['FOR INC'] },
      app_metadata: { provider: 'email' },
    } as unknown as SupabaseUser;

    const fallback = resolveOfflineAppUser(authUser);

    expect(fallback?.role).toBe('member');
    expect(fallback?.isAdmin).toBe(false);
    expect(fallback?.trainerLevels).toEqual([]);
  });
});
