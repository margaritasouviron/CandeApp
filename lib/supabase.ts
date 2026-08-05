import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from './env';

export { isSupabaseConfigured, getSupabaseConfigHint, getSupabaseConfigStatus } from './env';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();
const configured = isSupabaseConfigured();

const authConfig = configured
  ? {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    }
  : {
      autoRefreshToken: false,
      persistSession: false,
    };

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  { auth: authConfig }
);
