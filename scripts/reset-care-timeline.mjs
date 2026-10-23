/**
 * Reinicia historial de registros desde hoy.
 * Requiere migración 014 y SUPABASE_SERVICE_ROLE_KEY en .env (Settings → API).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');

function loadEnv() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const val = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

loadEnv();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const orgEmail = process.env.RESET_ORG_EMAIL;
const orgPassword = process.env.RESET_ORG_PASSWORD;

if (!url || !anonKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const key = serviceKey || anonKey;
const supabase = createClient(url, key, { auth: { persistSession: false } });

if (!serviceKey) {
  if (!orgEmail || !orgPassword) {
    console.error('Añade SUPABASE_SERVICE_ROLE_KEY o RESET_ORG_EMAIL + RESET_ORG_PASSWORD en .env');
    console.error('O en SQL Editor: SELECT reset_care_timeline_from_today(NULL); (tras migración 014)');
    process.exit(1);
  }
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: orgEmail,
    password: orgPassword,
  });
  if (signInError) {
    console.error('Login organizadora:', signInError.message);
    process.exit(1);
  }
}

const { data, error } = await supabase.rpc('reset_care_timeline_from_today', { p_patient_id: null });

if (error) {
  console.error('Error:', error.message);
  if (error.message.includes('Could not find the function')) {
    console.error('Aplica primero supabase/migrations/014_reset_care_timeline.sql en SQL Editor.');
  }
  process.exit(1);
}

console.log('Historial reiniciado desde hoy:', data);
