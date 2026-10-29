import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchMyProfile, type AppProfile } from './profiles';
import { supabase } from './supabase';

export type AppRole = 'organizador' | 'enfermera' | 'standby';

type AuthContextValue = {
  session: Session | null;
  role: AppRole | null;
  profile: AppProfile | null;
  loading: boolean;
  initError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, nombreCompleto: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export async function fetchRole(userId: string): Promise<AppRole | null> {
  try {
    const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (error) {
      console.warn('[auth] fetchRole error:', error.message);
      return null;
    }
    return (data?.role as AppRole | undefined) ?? null;
  } catch (e) {
    console.warn('[auth] fetchRole exception:', e);
    return null;
  }
}

async function loadSessionProfile(userId: string) {
  const [role, profile] = await Promise.all([fetchRole(userId), fetchMyProfile(userId)]);
  return { role, profile };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const applyUser = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setRole(null);
      setProfile(null);
      return;
    }
    const loaded = await loadSessionProfile(userId);
    setRole(loaded.role);
    setProfile(loaded.profile);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) return;
    await applyUser(session.user.id);
  }, [session?.user.id, applyUser]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) {
          console.warn('[auth] getSession error:', error.message);
          setInitError(error.message);
        }
        setSession(data.session);
        if (data.session?.user.id) {
          await applyUser(data.session.user.id);
        }
      } catch (e) {
        if (!mounted) return;
        const msg = e instanceof Error ? e.message : 'Error al conectar con Supabase';
        console.warn('[auth] init error:', e);
        setInitError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await applyUser(s?.user.id);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applyUser]);

  const signIn = async (email: string, password: string) => {
    const response = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (response.data.session) {
      await applyUser(response.data.session.user.id);
      setInitError(null);
    }
    return response.error?.message ?? null;
  };

  const signUp = async (email: string, password: string, nombreCompleto: string) => {
    const response = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { nombre_completo: nombreCompleto.trim() },
      },
    });
    if (response.error) return response.error.message;
    if (response.data.session) {
      await applyUser(response.data.session.user.id);
      setInitError(null);
    }
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, role, profile, loading, initError, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
