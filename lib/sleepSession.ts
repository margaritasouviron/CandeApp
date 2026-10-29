import { supabase } from './supabase';

export type ActiveSleepSession = {
  careLogId: string;
  inicio: string;
};

export async function fetchActiveSleepSession(patientId: string): Promise<ActiveSleepSession | null> {
  const { data, error } = await supabase
    .from('sleep_entries')
    .select('care_log_id, inicio, fin, care_logs!inner(patient_id)')
    .eq('care_logs.patient_id', patientId)
    .is('fin', null)
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (/fin|column|42703/i.test(error.message)) return null;
    throw error;
  }
  if (!data?.care_log_id) return null;

  return {
    careLogId: data.care_log_id as string,
    inicio: data.inicio as string,
  };
}

export async function startSleepSession(patientId: string, userId: string, when: Date) {
  const active = await fetchActiveSleepSession(patientId);
  if (active) {
    throw new Error('Cande ya figura como dormida. Registrá el despertar primero.');
  }

  const { data: log, error: logError } = await supabase
    .from('care_logs')
    .insert({
      patient_id: patientId,
      tipo: 'sueno',
      registrado_por: userId,
      registrado_en: when.toISOString(),
    })
    .select('id')
    .single();
  if (logError) throw logError;

  const { error: sleepError } = await supabase.from('sleep_entries').insert({
    care_log_id: log.id,
    inicio: when.toISOString(),
    fin: null,
  });
  if (sleepError) throw sleepError;

  return log.id as string;
}

export async function endSleepSession(careLogId: string, when: Date, inicioIso: string) {
  if (when.getTime() <= new Date(inicioIso).getTime()) {
    throw new Error('La hora de despertar debe ser posterior al inicio del sueño');
  }

  const { error: sleepError } = await supabase
    .from('sleep_entries')
    .update({ fin: when.toISOString() })
    .eq('care_log_id', careLogId);
  if (sleepError) throw sleepError;

  await supabase.from('care_logs').update({ registrado_en: when.toISOString() }).eq('id', careLogId);
}

export function formatSleepClock(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
