import { supabase } from './supabase';

export type ActiveMealSession = {
  careLogId: string;
  inicio: string;
  tipoComida: 'sopa' | 'jugo';
  mililitros: number;
  velocidadMlH: number | null;
};

export async function fetchActiveMealSession(patientId: string): Promise<ActiveMealSession | null> {
  const { data, error } = await supabase
    .from('meal_entries')
    .select(
      'care_log_id, inicio, fin, tipo_comida, mililitros, velocidad_ml_h, care_logs!inner(patient_id, tipo)'
    )
    .eq('care_logs.patient_id', patientId)
    .eq('care_logs.tipo', 'comida')
    .is('fin', null)
    .not('inicio', 'is', null)
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (/inicio|fin|velocidad|column|42703/i.test(error.message)) return null;
    throw error;
  }
  if (!data?.care_log_id || !data.inicio) return null;

  const tipo = data.tipo_comida as string;
  const tipoComida = tipo === 'jugo' ? 'jugo' : 'sopa';

  return {
    careLogId: data.care_log_id as string,
    inicio: data.inicio as string,
    tipoComida,
    mililitros: Number(data.mililitros) || 0,
    velocidadMlH: data.velocidad_ml_h != null ? Number(data.velocidad_ml_h) : null,
  };
}

export async function startMealSession(
  patientId: string,
  userId: string,
  when: Date,
  input: { tipoComida: 'sopa' | 'jugo'; mililitros: number; velocidadMlH: number | null },
  authorship?: { realizado_por: string | null }
) {
  const active = await fetchActiveMealSession(patientId);
  if (active) {
    throw new Error('El botón ya está conectado. Registrá la desconexión primero.');
  }

  const label = input.tipoComida === 'sopa' ? 'Sopa' : 'Jugo';
  const velPart =
    input.velocidadMlH != null && input.velocidadMlH > 0 ? ` · ${input.velocidadMlH} ml/h` : '';
  const descripcion = `${label} ${input.mililitros} ml${velPart}`;

  const { data: log, error: logError } = await supabase
    .from('care_logs')
    .insert({
      patient_id: patientId,
      tipo: 'comida',
      registrado_por: userId,
      realizado_por: authorship?.realizado_por ?? null,
      registrado_en: when.toISOString(),
    })
    .select('id')
    .single();
  if (logError) throw logError;

  const { error: mealError } = await supabase.from('meal_entries').insert({
    care_log_id: log.id,
    tipo_comida: input.tipoComida,
    mililitros: input.mililitros,
    velocidad_ml_h: input.velocidadMlH,
    inicio: when.toISOString(),
    fin: null,
    descripcion,
  });
  if (mealError) throw mealError;

  return log.id as string;
}

export async function endMealSession(careLogId: string, when: Date, inicioIso: string) {
  if (when.getTime() <= new Date(inicioIso).getTime()) {
    throw new Error('La hora de desconexión debe ser posterior a la conexión');
  }

  const { error: mealError } = await supabase
    .from('meal_entries')
    .update({ fin: when.toISOString() })
    .eq('care_log_id', careLogId);
  if (mealError) throw mealError;

  await supabase.from('care_logs').update({ registrado_en: when.toISOString() }).eq('id', careLogId);
}

export function formatMealClock(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
