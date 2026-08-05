import { supabase } from './supabase';

export type Patient = {
  id: string;
  nombre: string;
  fecha_nacimiento: string | null;
  notas_medicas: string | null;
};

export async function getPatient(): Promise<Patient | null> {
  const { data } = await supabase.from('patient').select('id, nombre, fecha_nacimiento, notas_medicas').limit(1).maybeSingle();
  return data;
}

export function calcAge(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const birth = new Date(fechaNacimiento);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
