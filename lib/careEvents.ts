import { supabase } from './supabase';
import type { EventType } from './eventTypes';

export type DayEvent = {
  hora: string;
  descripcion: string;
  tipo_evento: string;
  referencia_id: string;
};

export type CareLogListItem = {
  id: string;
  tipo: EventType;
  registrado_en: string;
  registrado_por: string;
  nurseName?: string;
  detail?: string;
};

export async function fetchDayEvents(patientId: string, date: string) {
  const { data, error } = await supabase.rpc('get_day_events', {
    p_patient_id: patientId,
    p_fecha: date,
  });
  if (error) throw error;
  return (data ?? []) as DayEvent[];
}

function dateKeyFromIso(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addToMap(map: Map<string, Set<string>>, key: string, tipo: string) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(tipo);
}

export async function fetchMonthEventDays(patientId: string, year: number, month: number) {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();

  const [{ data: logs }, { data: schedules }] = await Promise.all([
    supabase
      .from('care_logs')
      .select('registrado_en, tipo')
      .eq('patient_id', patientId)
      .gte('registrado_en', start)
      .lt('registrado_en', end),
    supabase
      .from('medication_schedules')
      .select('programado_para, status')
      .eq('patient_id', patientId)
      .in('status', ['pendiente', 'retrasada'])
      .gte('programado_para', start)
      .lt('programado_para', end),
  ]);

  const map = new Map<string, Set<string>>();
  (logs ?? []).forEach((row) => addToMap(map, dateKeyFromIso(row.registrado_en), row.tipo));
  (schedules ?? []).forEach((row) => addToMap(map, dateKeyFromIso(row.programado_para), 'medicacion'));
  return map;
}

export async function fetchRecentLogs(limit = 30, tipoFilter?: EventType[]) {
  let q = supabase
    .from('care_logs')
    .select(`
      id, tipo, registrado_en, registrado_por,
      profiles:registrado_por ( nombre_completo ),
      observations ( contenido ),
      meal_entries ( descripcion ),
      medication_administrations ( nombre_medicamento, dosis )
    `)
    .order('registrado_en', { ascending: false })
    .limit(limit);

  if (tipoFilter?.length) q = q.in('tipo', tipoFilter);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const obs = Array.isArray(row.observations) ? row.observations[0] : row.observations;
    const meal = Array.isArray(row.meal_entries) ? row.meal_entries[0] : row.meal_entries;
    const med = Array.isArray(row.medication_administrations)
      ? row.medication_administrations[0]
      : row.medication_administrations;
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    let detail = obs?.contenido ?? meal?.descripcion ?? '';
    if (med) detail = `${med.nombre_medicamento} ${med.dosis}`;

    return {
      id: row.id,
      tipo: row.tipo as EventType,
      registrado_en: row.registrado_en,
      registrado_por: row.registrado_por,
      nurseName: prof?.nombre_completo,
      detail,
    } as CareLogListItem;
  });
}

export async function deleteCareLog(id: string) {
  const { error } = await supabase.from('care_logs').delete().eq('id', id);
  if (error) throw error;
}
