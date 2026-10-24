import { supabase } from './supabase';
import {
  EVENT_LABELS,
  formatTerapiaLabel,
  isDurationEventType,
  type EventType,
} from './eventTypes';

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

export type JournalLogItem = {
  id: string;
  tipo: EventType;
  registrado_en: string;
  title: string;
  detail: string;
};

export type SleepBlock = {
  inicio: string;
  fin: string;
  careLogId: string;
};

export type DurationBlock = {
  inicio: string;
  fin: string;
  careLogId: string;
  tipo: EventType;
  subtipo?: string | null;
};

export type CareLogDetail = {
  id: string;
  patient_id: string;
  tipo: EventType;
  registrado_en: string;
  registrado_por: string;
  authorName: string;
  title: string;
  detail: string;
  editableText: string;
  medNombre?: string;
  medDosis?: string;
  sleepInicio?: string;
  sleepFin?: string;
  activitySubtipo?: string;
};

function mapLogRow(row: {
  id: string;
  tipo: string;
  registrado_en: string;
  observations?: { contenido: string } | { contenido: string }[] | null;
  meal_entries?:
    | { descripcion: string; tipo_comida?: string; mililitros?: number | null }
    | { descripcion: string; tipo_comida?: string; mililitros?: number | null }[]
    | null;
  medication_administrations?: { nombre_medicamento: string; dosis: string } | { nombre_medicamento: string; dosis: string }[] | null;
  sleep_entries?: { inicio: string; fin: string } | { inicio: string; fin: string }[] | null;
  activity_blocks?:
    | { inicio: string; fin: string; subtipo: string | null }
    | { inicio: string; fin: string; subtipo: string | null }[]
    | null;
}): JournalLogItem {
  const obs = Array.isArray(row.observations) ? row.observations[0] : row.observations;
  const meal = Array.isArray(row.meal_entries) ? row.meal_entries[0] : row.meal_entries;
  const med = Array.isArray(row.medication_administrations)
    ? row.medication_administrations[0]
    : row.medication_administrations;
  const sleep = Array.isArray(row.sleep_entries) ? row.sleep_entries[0] : row.sleep_entries;
  const activity = Array.isArray(row.activity_blocks) ? row.activity_blocks[0] : row.activity_blocks;

  let title = EVENT_LABELS[row.tipo as EventType] ?? row.tipo;
  let detail = obs?.contenido ?? meal?.descripcion ?? '';
  if (med) {
    title = med.nombre_medicamento;
    detail = med.dosis;
  }
  if (row.tipo === 'comida' && meal) {
    if (meal.tipo_comida === 'sopa') title = 'Sopa';
    else if (meal.tipo_comida === 'jugo') title = 'Jugo';
    if (meal.mililitros != null) detail = `${meal.mililitros} ml`;
  }
  if (row.tipo === 'terapia' && activity?.subtipo) {
    title = formatTerapiaLabel(activity.subtipo);
  }
  const durationSource = sleep ?? activity;
  if (isDurationEventType(row.tipo) && durationSource) {
    const a = new Date(durationSource.inicio);
    const b = new Date(durationSource.fin);
    if (row.tipo !== 'terapia') title = EVENT_LABELS[row.tipo as EventType] ?? title;
    detail = `${formatHm(a)} – ${formatHm(b)}`;
  }

  return {
    id: row.id,
    tipo: row.tipo as EventType,
    registrado_en: row.registrado_en,
    title,
    detail,
  };
}

function formatHm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayBounds(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0),
    end: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr: string, delta: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dateKey(dt);
}

export async function fetchDayJournal(patientId: string, dateStr: string): Promise<JournalLogItem[]> {
  const { start, end } = dayBounds(dateStr);
  const { data, error } = await supabase
    .from('care_logs')
    .select(`
      id, tipo, registrado_en,
      observations ( contenido ),
      meal_entries ( descripcion, tipo_comida, mililitros ),
      medication_administrations ( nombre_medicamento, dosis ),
      sleep_entries ( inicio, fin ),
      activity_blocks ( inicio, fin, subtipo )
    `)
    .eq('patient_id', patientId)
    .gte('registrado_en', start.toISOString())
    .lte('registrado_en', end.toISOString())
    .order('registrado_en', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapLogRow);
}

function overlapsDay(start: Date, end: Date, dayStart: Date, dayEnd: Date) {
  const a = start.getTime();
  const b = end.getTime();
  return b >= dayStart.getTime() && a <= dayEnd.getTime();
}

export async function fetchDurationBlocksForDay(
  patientId: string,
  dateStr: string
): Promise<DurationBlock[]> {
  const { start, end } = dayBounds(dateStr);
  const blocks: DurationBlock[] = [];

  const { data: sleepRows, error: sleepErr } = await supabase
    .from('sleep_entries')
    .select('inicio, fin, care_log_id, care_logs!inner(patient_id)')
    .eq('care_logs.patient_id', patientId);

  if (!sleepErr) {
    for (const row of sleepRows ?? []) {
      if (overlapsDay(new Date(row.inicio), new Date(row.fin), start, end)) {
        blocks.push({
          inicio: row.inicio,
          fin: row.fin,
          careLogId: row.care_log_id as string,
          tipo: 'sueno',
        });
      }
    }
  }

  const { data: actRows, error: actErr } = await supabase
    .from('activity_blocks')
    .select('inicio, fin, subtipo, care_log_id, care_logs!inner(patient_id, tipo)')
    .eq('care_logs.patient_id', patientId);

  if (!actErr) {
    for (const row of actRows ?? []) {
      const cl = Array.isArray(row.care_logs) ? row.care_logs[0] : row.care_logs;
      if (!cl?.tipo) continue;
      if (overlapsDay(new Date(row.inicio), new Date(row.fin), start, end)) {
        blocks.push({
          inicio: row.inicio,
          fin: row.fin,
          careLogId: row.care_log_id as string,
          tipo: cl.tipo as EventType,
          subtipo: row.subtipo,
        });
      }
    }
  }

  return blocks;
}

/** @deprecated use fetchDurationBlocksForDay */
export async function fetchSleepBlocksForDay(patientId: string, dateStr: string): Promise<SleepBlock[]> {
  const all = await fetchDurationBlocksForDay(patientId, dateStr);
  return all
    .filter((b) => b.tipo === 'sueno')
    .map(({ inicio, fin, careLogId }) => ({ inicio, fin, careLogId }));
}

const detailSelect = `
  id, patient_id, tipo, registrado_en, registrado_por,
  profiles:registrado_por ( nombre_completo ),
  observations ( contenido ),
  meal_entries ( descripcion, tipo_comida, mililitros ),
  medication_administrations ( nombre_medicamento, dosis, administrado_en ),
  sleep_entries ( inicio, fin ),
  activity_blocks ( inicio, fin, subtipo )
`;

export async function fetchCareLogDetail(id: string): Promise<CareLogDetail | null> {
  const { data, error } = await supabase.from('care_logs').select(detailSelect).eq('id', id).maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const journal = mapLogRow(data);
  const prof = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
  const obs = Array.isArray(data.observations) ? data.observations[0] : data.observations;
  const meal = Array.isArray(data.meal_entries) ? data.meal_entries[0] : data.meal_entries;
  const med = Array.isArray(data.medication_administrations)
    ? data.medication_administrations[0]
    : data.medication_administrations;
  const sleep = Array.isArray(data.sleep_entries) ? data.sleep_entries[0] : data.sleep_entries;
  const activity = Array.isArray(data.activity_blocks) ? data.activity_blocks[0] : data.activity_blocks;

  let editableText = obs?.contenido ?? meal?.descripcion ?? '';
  if (med) editableText = med.dosis;
  if (data.tipo === 'comida' && meal?.mililitros != null) {
    editableText = String(meal.mililitros);
  }

  const duration = sleep ?? activity;

  return {
    id: data.id,
    patient_id: data.patient_id,
    tipo: data.tipo as EventType,
    registrado_en: data.registrado_en,
    registrado_por: data.registrado_por,
    authorName: prof?.nombre_completo ?? 'Usuario',
    title: journal.title,
    detail: journal.detail,
    editableText,
    medNombre: med?.nombre_medicamento,
    medDosis: med?.dosis,
    sleepInicio: duration?.inicio,
    sleepFin: duration?.fin,
    activitySubtipo: activity?.subtipo ?? undefined,
  };
}

function parseDateTimeLocal(iso: string) {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

function combineDateTime(dateStr: string, timeStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, h || 0, mi || 0, 0);
}

export async function updateCareLogDetail(
  detail: CareLogDetail,
  input: {
    date: string;
    time: string;
    text: string;
    sleepStart?: string;
    sleepEnd?: string;
  }
) {
  const registradoEn = combineDateTime(input.date, input.time);

  const { error: logError } = await supabase
    .from('care_logs')
    .update({ registrado_en: registradoEn.toISOString() })
    .eq('id', detail.id);
  if (logError) throw logError;

  if (detail.tipo === 'comida') {
    const ml = parseFloat(input.text.replace(',', '.'));
    const { error } = await supabase
      .from('meal_entries')
      .update({
        mililitros: Number.isFinite(ml) ? ml : null,
        descripcion: Number.isFinite(ml) ? `${ml} ml` : input.text.trim(),
      })
      .eq('care_log_id', detail.id);
    if (error) throw error;
  } else if (detail.tipo === 'medicacion') {
    const adminEn = registradoEn.toISOString();
    const { error } = await supabase
      .from('medication_administrations')
      .update({ dosis: input.text.trim(), administrado_en: adminEn })
      .eq('care_log_id', detail.id);
    if (error) throw error;
  } else if (isDurationEventType(detail.tipo) && input.sleepStart && input.sleepEnd) {
    const { date } = parseDateTimeLocal(detail.registrado_en);
    const inicio = combineDateTime(date, input.sleepStart);
    let fin = combineDateTime(date, input.sleepEnd);
    if (fin.getTime() <= inicio.getTime()) {
      fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
    }
    if (detail.tipo === 'sueno') {
      const { error: sleepErr } = await supabase
        .from('sleep_entries')
        .update({ inicio: inicio.toISOString(), fin: fin.toISOString() })
        .eq('care_log_id', detail.id);
      if (sleepErr) throw sleepErr;
    } else {
      const { error: actErr } = await supabase
        .from('activity_blocks')
        .update({ inicio: inicio.toISOString(), fin: fin.toISOString() })
        .eq('care_log_id', detail.id);
      if (actErr) throw actErr;
    }
    await supabase.from('care_logs').update({ registrado_en: inicio.toISOString() }).eq('id', detail.id);
  } else if (detail.tipo === 'observacion' || detail.tipo === 'nota') {
    const { error } = await supabase
      .from('observations')
      .update({ contenido: input.text.trim() })
      .eq('care_log_id', detail.id);
    if (error) throw error;
  }
}

export { parseDateTimeLocal, combineDateTime };

export async function fetchWeekJournalTitles(patientId: string, anchorDateStr: string) {
  const [y, m, d] = anchorDateStr.split('-').map(Number);
  const anchor = new Date(y, m - 1, d);
  const dow = anchor.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('care_logs')
    .select(`
      id, tipo, registrado_en,
      observations ( contenido ),
      meal_entries ( descripcion, tipo_comida, mililitros ),
      medication_administrations ( nombre_medicamento, dosis ),
      sleep_entries ( inicio, fin ),
      activity_blocks ( inicio, fin, subtipo )
    `)
    .eq('patient_id', patientId)
    .gte('registrado_en', monday.toISOString())
    .lte('registrado_en', sunday.toISOString())
    .order('registrado_en', { ascending: true });

  if (error) throw error;

  const byDay = new Map<string, JournalLogItem[]>();
  (data ?? []).map(mapLogRow).forEach((item) => {
    const key = dateKey(new Date(item.registrado_en));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(item);
  });

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    days.push(dateKey(dt));
  }

  return { days, byDay };
}

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

export async function fetchRecentLogs(limit = 30, tipoFilter?: EventType[], patientId?: string) {
  let q = supabase
    .from('care_logs')
    .select(`
      id, tipo, registrado_en, registrado_por,
      profiles:registrado_por ( nombre_completo ),
      observations ( contenido ),
      meal_entries ( descripcion, tipo_comida, mililitros ),
      medication_administrations ( nombre_medicamento, dosis ),
      sleep_entries ( inicio, fin ),
      activity_blocks ( inicio, fin, subtipo )
    `)
    .order('registrado_en', { ascending: false })
    .limit(limit);

  if (patientId) q = q.eq('patient_id', patientId);
  if (tipoFilter?.length) q = q.in('tipo', tipoFilter);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const obs = Array.isArray(row.observations) ? row.observations[0] : row.observations;
    const meal = Array.isArray(row.meal_entries) ? row.meal_entries[0] : row.meal_entries;
    const med = Array.isArray(row.medication_administrations)
      ? row.medication_administrations[0]
      : row.medication_administrations;
    const sleep = Array.isArray(row.sleep_entries) ? row.sleep_entries[0] : row.sleep_entries;
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    let detail = obs?.contenido ?? meal?.descripcion ?? '';
    if (med) detail = `${med.nombre_medicamento} ${med.dosis}`;
    if (row.tipo === 'sueno' && sleep) {
      detail = `${formatHm(new Date(sleep.inicio))} – ${formatHm(new Date(sleep.fin))}`;
    }

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

function isMissingDeleteRpc(error: { code?: string; message?: string }) {
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

async function deleteCareLogWithMedicationFollowUpClient(id: string): Promise<number> {
  const { data: logRow, error: logErr } = await supabase
    .from('care_logs')
    .select('id, tipo')
    .eq('id', id)
    .maybeSingle();
  if (logErr) throw logErr;
  if (!logRow) throw new Error('Registro no encontrado');

  if (logRow.tipo !== 'medicacion') {
    await deleteCareLog(id);
    return 1;
  }

  const { data: anchor, error: anchorErr } = await supabase
    .from('medication_administrations')
    .select('prescription_id, administrado_en')
    .eq('care_log_id', id)
    .maybeSingle();
  if (anchorErr) throw anchorErr;

  if (!anchor?.prescription_id) {
    await deleteCareLog(id);
    return 1;
  }

  const { data: admins, error: adminsErr } = await supabase
    .from('medication_administrations')
    .select('care_log_id')
    .eq('prescription_id', anchor.prescription_id)
    .gte('administrado_en', anchor.administrado_en);
  if (adminsErr) throw adminsErr;

  const logIds = (admins ?? []).map((a) => a.care_log_id as string);
  if (logIds.length === 0) {
    await deleteCareLog(id);
    return 1;
  }

  const { error: schedErr } = await supabase
    .from('medication_schedules')
    .delete()
    .eq('prescription_id', anchor.prescription_id)
    .in('status', ['pendiente', 'retrasada'])
    .gte('programado_para', anchor.administrado_en);
  if (schedErr) throw schedErr;

  for (const logId of logIds) {
    const { error: linkedSchedErr } = await supabase
      .from('medication_schedules')
      .delete()
      .eq('administration_id', logId);
    if (linkedSchedErr) throw linkedSchedErr;
  }

  const { error: delErr } = await supabase.from('care_logs').delete().in('id', logIds);
  if (delErr) throw delErr;

  return logIds.length;
}

/** Borra el registro; medicación incluye administraciones posteriores y dosis programadas (RPC 016). */
export async function deleteCareLogWithMedicationFollowUp(id: string): Promise<number> {
  const { data, error } = await supabase.rpc('delete_care_log_with_medication_follow_up', {
    p_log_id: id,
  });

  if (!error) {
    return Number(data ?? 1);
  }

  if (isMissingDeleteRpc(error)) {
    return deleteCareLogWithMedicationFollowUpClient(id);
  }

  throw error;
}
