import { supabase } from './supabase';
import type { AppRole } from './auth';

export type AppProfile = {
  id: string;
  nombre_completo: string;
  email: string | null;
  role: AppRole;
  activo: boolean;
  perfil_completo: boolean;
};

export type ProfileInvite = {
  id: string;
  email: string;
  nombre_completo: string;
  created_at: string;
};

export async function fetchMyProfile(userId: string): Promise<AppProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre_completo, email, role, activo, perfil_completo')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as AppProfile;
}

export async function updateMyProfile(userId: string, input: { nombre_completo: string; perfil_completo?: boolean }) {
  const { error } = await supabase
    .from('profiles')
    .update({
      nombre_completo: input.nombre_completo.trim(),
      ...(input.perfil_completo != null ? { perfil_completo: input.perfil_completo } : {}),
    })
    .eq('id', userId);
  if (error) throw error;
}

/** Personas que pueden figurar como quien hizo el registro (modo tablet). */
export async function fetchCaregiverProfiles(): Promise<AppProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre_completo, email, role, activo, perfil_completo')
    .eq('activo', true)
    .in('role', ['enfermera', 'organizador'])
    .order('nombre_completo');
  if (error) throw error;
  return (data ?? []) as AppProfile[];
}

export async function fetchManagedProfiles(): Promise<AppProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre_completo, email, role, activo, perfil_completo')
    .neq('role', 'standby')
    .order('nombre_completo');
  if (error) throw error;
  return (data ?? []) as AppProfile[];
}

export async function fetchPendingInvites(): Promise<ProfileInvite[]> {
  const { data, error } = await supabase
    .from('profile_invites')
    .select('id, email, nombre_completo, created_at')
    .is('used_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProfileInvite[];
}

export async function createProfileInvite(email: string, nombreCompleto: string, createdBy: string) {
  const { error } = await supabase.from('profile_invites').insert({
    email: email.trim().toLowerCase(),
    nombre_completo: nombreCompleto.trim(),
    created_by: createdBy,
  });
  if (error) throw error;
}

export async function deleteProfileInvite(inviteId: string) {
  const { error } = await supabase.from('profile_invites').delete().eq('id', inviteId);
  if (error) throw error;
}

export async function deactivateProfile(profileId: string) {
  const { error } = await supabase.from('profiles').update({ activo: false }).eq('id', profileId);
  if (error) throw error;
}

export async function canRegisterEmail(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_register_email', { p_email: email.trim() });
  if (error) {
    if (/can_register_email|42883|42703/i.test(error.message)) return false;
    throw error;
  }
  return !!data;
}

export const STANDBY_EMAIL = 'standby@gmail.com';
