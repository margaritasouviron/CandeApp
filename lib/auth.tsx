import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AppRole = 'organizador' | 'enfermera';

type AuthContextValue = {
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  initError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

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
        if (data.session) {
          setRole(await fetchRole(data.session.user.id));
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
      setRole(s ? await fetchRole(s.user.id) : null);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    console.log('[auth] signInWithPassword response:', response);
    if (response.data.session) {
      setRole(await fetchRole(response.data.session.user.id));
      setInitError(null);
    }
    return response.error?.message ?? null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, role, loading, initError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
