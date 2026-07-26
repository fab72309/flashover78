import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { AppUser } from '../types';
import { devUser, isDevAuthBypassEnabled } from '../utils/devAuth';
import {
  getCurrentUser,
  resolveAppUser,
  signIn,
  signOut,
  signUp,
} from '../services/supabaseService';

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    if (isDevAuthBypassEnabled) {
      setUser(devUser);
      setLoading(false);
      return;
    }

    const currentUser = await getCurrentUser();
    setUser(await resolveAppUser(currentUser));
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (isDevAuthBypassEnabled) {
        if (isMounted) {
          setSession(null);
          setUser(devUser);
          setLoading(false);
        }
        return;
      }

      if (!isSupabaseConfigured) {
        if (isMounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const [{ data: sessionData }, currentUser] = await Promise.all([
        supabase.auth.getSession(),
        getCurrentUser(),
      ]);

      if (!isMounted) {
        return;
      }

      setSession(sessionData.session);
      setUser(await resolveAppUser(currentUser));
      setLoading(false);
    };

    bootstrap();

    const {
      data: { subscription },
    } = !isDevAuthBypassEnabled && isSupabaseConfigured
      ? supabase.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession);
          window.setTimeout(async () => {
            const nextUser = await resolveAppUser(nextSession?.user ?? null);
            if (isMounted) {
              setUser(nextUser);
              setLoading(false);
            }
          }, 0);
        })
      : { data: { subscription: { unsubscribe: () => undefined } } };

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      loading,
      signUpWithEmail: async (email, password, firstName, lastName) => {
        if (isDevAuthBypassEnabled) {
          setUser({
            ...devUser,
            email: email || devUser.email,
            displayName: `${firstName} ${lastName}`.trim() || devUser.displayName,
            isAdmin: devUser.isAdmin,
            firstName: firstName || devUser.firstName,
            lastName: lastName || devUser.lastName,
          });
          return;
        }

        const signedUpUser = await signUp(email, password, firstName, lastName);
        setUser(await resolveAppUser(signedUpUser));
      },
      signInWithEmail: async (email, password) => {
        if (isDevAuthBypassEnabled) {
          setUser({
            ...devUser,
            email: email || devUser.email,
          });
          return;
        }

        const signedInUser = await signIn(email, password);
        setUser(await resolveAppUser(signedInUser));
      },
      refreshUser,
      logout: async () => {
        if (isDevAuthBypassEnabled) {
          setUser(devUser);
          setSession(null);
          return;
        }

        await signOut();
        setUser(null);
        setSession(null);
      },
    }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
