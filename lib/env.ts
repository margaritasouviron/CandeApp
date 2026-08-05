import Constants from 'expo-constants';

type SupabaseExtra = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as SupabaseExtra;

function readEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'): string {
  const fromProcess = process.env[name];
  if (fromProcess?.trim()) return fromProcess.trim();
  const fromExtra = extra[name];
  if (fromExtra?.trim()) return fromExtra.trim();
  return '';
}

export function getSupabaseUrl(): string {
  return readEnv('EXPO_PUBLIC_SUPABASE_URL');
}

export function getSupabaseAnonKey(): string {
  return readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

function isPlaceholderUrl(url: string) {
  return url.includes('your-project') || url.includes('placeholder');
}

function isPlaceholderKey(key: string) {
  return key.includes('your-anon') || key === 'placeholder' || key.length < 20;
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return url.length > 0 && key.length > 0 && !isPlaceholderUrl(url) && !isPlaceholderKey(key);
}

export type SupabaseConfigStatus = {
  configured: boolean;
  urlPreview: string;
  keyLength: number;
  problem: string | null;
};

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url && !key) {
    return {
      configured: false,
      urlPreview: '(vacío)',
      keyLength: 0,
      problem: 'No hay variables en el build. En Vercel: Settings → Environment Variables → Redeploy.',
    };
  }

  if (isPlaceholderUrl(url) || isPlaceholderKey(key)) {
    return {
      configured: false,
      urlPreview: url.slice(0, 40),
      keyLength: key.length,
      problem: 'Parecen valores de ejemplo (your-project / your-anon-key). Usa las claves reales de Supabase → Settings → API.',
    };
  }

  if (!url.startsWith('https://') || !url.includes('supabase.co')) {
    return {
      configured: false,
      urlPreview: url.slice(0, 40),
      keyLength: key.length,
      problem: 'EXPO_PUBLIC_SUPABASE_URL debe ser https://xxxx.supabase.co',
    };
  }

  if (key.length < 100) {
    return {
      configured: false,
      urlPreview: url.replace(/https:\/\//, '').slice(0, 30),
      keyLength: key.length,
      problem: 'EXPO_PUBLIC_SUPABASE_ANON_KEY parece incompleta (debe ser un JWT largo).',
    };
  }

  return {
    configured: true,
    urlPreview: url.replace('https://', '').slice(0, 32) + '…',
    keyLength: key.length,
    problem: null,
  };
}

export function getSupabaseConfigHint(): string {
  const status = getSupabaseConfigStatus();
  if (status.problem) return status.problem;

  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'En Vercel: Settings → Environment Variables → añade EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY, luego Redeploy.';
  }
  return 'Crea un archivo .env con EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY, luego reinicia con npm start.';
}
