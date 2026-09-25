import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { AppUser } from '../types';
import { devUser, isDevAuthBypassEnabled } from '../utils/devAuth';
import {
  clearOfflineDocumentData,
  enforceOfflineDocumentOwner,
  getCurrentUser,
  resolveOfflineAppUser,
  resolveAppUser,
  signIn,
  signOut,
  signUp,
  type SignUpResult,
} from '../services/supabaseService';

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  signUpWithEmail: (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => Promise<SignUpResult>;
  signInWithEmail: (email: string, password: string, rememberSession: boolean) => Promise<void>;
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

      const { data: sessionData } = await supabase.auth.getSession();
      const localSession = sessionData.session;
      const localSessionIsUsable = Boolean(
        localSession &&
        (!localSession.expires_at || localSession.expires_at * 1000 > Date.now()),
      );

      let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;
      try {
        currentUser = await getCurrentUser();
      } catch {
        if (!localSessionIsUsable) {
          await enforceOfflineDocumentOwner(null);
          if (isMounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }

        await enforceOfflineDocumentOwner(localSession!.user.id);
        if (isMounted) {
          setSession(localSession);
          setUser(resolveOfflineAppUser(localSession!.user));
          setLoading(false);
        }
        return;
      }

      if (!isMounted) {
        return;
      }

      if (!currentUser || !localSessionIsUsable) {
        await enforceOfflineDocumentOwner(null);
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      await enforceOfflineDocumentOwner(currentUser.id);
      try {
        setSession(localSession);
        setUser(await resolveAppUser(currentUser));
      } catch {
        // A transient profile/RPC outage must not expose stale privileges.
        setUser(resolveOfflineAppUser(currentUser));
      }
      setLoading(false);
    };

    bootstrap();

    const {
      data: { subscription },
    } = !isDevAuthBypassEnabled && isSupabaseConfigured
      ? supabase.auth.onAuthStateChange((_event, nextSession) => {
        window.setTimeout(async () => {
            const nextSessionIsUsable = Boolean(
              nextSession &&
              (!nextSession.expires_at || nextSession.expires_at * 1000 > Date.now()),
            );
            if (!nextSessionIsUsable) {
              await enforceOfflineDocumentOwner(null);
              if (isMounted) {
                setSession(null);
                setUser(null);
                setLoading(false);
              }
              return;
            }

            await enforceOfflineDocumentOwner(nextSession?.user.id ?? null);
            let nextUser = resolveOfflineAppUser(nextSession?.user ?? null);
            try {
              nextUser = await resolveAppUser(nextSession?.user ?? null);
            } catch {
              // Keep the local session usable for cached documents, with a
              // non-privileged fallback, until profile validation succeeds.
            }
            if (isMounted) {
              setSession(nextSession);
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
            role: devUser.role,
            isAdmin: devUser.isAdmin,
            firstName: firstName || devUser.firstName,
            lastName: lastName || devUser.lastName,
          });
          return {
            user: null,
            session: null,
            requiresEmailConfirmation: false,
          };
        }

        const signUpResult = await signUp(email, password, firstName, lastName);
        setSession(signUpResult.session);

        if (signUpResult.user && signUpResult.session) {
          setUser(await resolveAppUser(signUpResult.user));
        } else {
          setUser(null);
        }

        return signUpResult;
      },
      signInWithEmail: async (email, password, rememberSession) => {
        if (isDevAuthBypassEnabled) {
          setUser({
            ...devUser,
            email: email || devUser.email,
          });
          return;
        }

        const signedInUser = await signIn(email, password, rememberSession);
        setUser(await resolveAppUser(signedInUser));
      },
      refreshUser,
      logout: async () => {
        if (isDevAuthBypassEnabled) {
          await clearOfflineDocumentData();
          setUser(devUser);
          setSession(null);
          return;
        }

        try {
          await signOut();
        } finally {
          setUser(null);
          setSession(null);
        }
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
