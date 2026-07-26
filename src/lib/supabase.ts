import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'public-anon-key';
const REMEMBER_SESSION_KEY = 'flashover78.auth.remember';

function getBrowserStorage(type: 'local' | 'session') {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return type === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getRememberSessionPreference() {
  const storage = getBrowserStorage('local');
  if (!storage) {
    return null;
  }

  const value = storage.getItem(REMEMBER_SESSION_KEY);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function setRememberSessionPreference(remember: boolean) {
  const storage = getBrowserStorage('local');
  if (!storage) {
    return;
  }

  storage.setItem(REMEMBER_SESSION_KEY, String(remember));
}

function resolveWriteStorage() {
  return getRememberSessionPreference() === false
    ? getBrowserStorage('session') ?? getBrowserStorage('local')
    : getBrowserStorage('local') ?? getBrowserStorage('session');
}

function resolveReadStorages() {
  const preference = getRememberSessionPreference();
  if (preference === false) {
    return [getBrowserStorage('session')];
  }
  if (preference === true) {
    return [getBrowserStorage('local'), getBrowserStorage('session')];
  }
  return [getBrowserStorage('local'), getBrowserStorage('session')];
}

const authStorage = {
  getItem(key: string) {
    for (const storage of resolveReadStorages()) {
      const value = storage?.getItem(key);
      if (value != null) {
        return value;
      }
    }
    return null;
  },
  setItem(key: string, value: string) {
    const target = resolveWriteStorage();
    const localStorage = getBrowserStorage('local');
    const sessionStorage = getBrowserStorage('session');

    target?.setItem(key, value);

    if (target !== localStorage) {
      localStorage?.removeItem(key);
    }

    if (target !== sessionStorage) {
      sessionStorage?.removeItem(key);
    }
  },
  removeItem(key: string) {
    getBrowserStorage('local')?.removeItem(key);
    getBrowserStorage('session')?.removeItem(key);
  },
};

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
  },
});

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase n’est pas configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
    );
  }
}
