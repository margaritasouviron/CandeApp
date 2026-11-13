import { fetchMedicalAppointmentByCareLogId } from './medicalAppointments';
import { supabase } from './supabase';
import {
  EVENT_LABELS,
  formatTerapiaLabel,
  isCalendarShadedOnlyLogType,
  isDurationEventType,
  type EventType,
} from './eventTypes';
import {
  fetchCareLogConsumptions,
  formatConsumptionDetail,
  isStockConsumptionEventType,
  type CareLogConsumptionRow,
} from './stockConsumptionEvents';

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
  authorName?: string;
  /** Comida con botón conectado/desconectado (bloque en calendario) */
  mealHasInterval?: boolean;
  /** Rango horario para bloque sombreado en calendario */
  intervalInicio?: string;
  intervalFin?: string;
};

function authorFromRow(row: {
  realizado_por?: string | null;
  realizador?:
    | { nombre_completo?: string | null }
    | { nombre_completo?: string | null }[]
    | null;
  profiles?:
    | { nombre_completo?: string | null }
    | { nombre_completo?: string | null }[]
    | null;
}): string {
  const realizador = Array.isArray(row.realizador) ? row.realizador[0] : row.realizador;
  const registrador = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  if (realizador?.nombre_completo) return realizador.nombre_completo;
  return registrador?.nombre_completo ?? 'Usuario';
}

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
  /** Título en bloque sombreado (p. ej. nombre del médico) */
  title?: string;
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
  mealInicio?: string;
  mealFin?: string;
  mealVelocidadMlH?: number | null;
  activitySubtipo?: string;
  turnoMedico?: string;
  turnoDireccion?: string;
  turnoInicio?: string;
  turnoFin?: string;
  stockConsumptions?: CareLogConsumptionRow[];
};

function mapLogRow(row: {
  id: string;
  tipo: string;
  registrado_en: string;
  realizado_por?: string | null;
  profiles?:
    | { nombre_completo?: string | null }
    | { nombre_completo?: string | null }[]
    | null;
  realizador?:
    | { nombre_completo?: string | null }
    | { nombre_completo?: string | null }[]
    | null;
  observations?: { contenido: string } | { contenido: string }[] | null;
  meal_entries?:
    | {
        descripcion: string;
        tipo_comida?: string;
        mililitros?: number | null;
        inicio?: string | null;
        fin?: string | null;
        velocidad_ml_h?: number | null;
      }
    | {
        descripcion: string;
        tipo_comida?: string;
        mililitros?: number | null;
        inicio?: string | null;
        fin?: string | null;
        velocidad_ml_h?: number | null;
      }[]
    | null;
  medication_administrations?: { nombre_medicamento: string; dosis: string } | { nombre_medicamento: string; dosis: string }[] | null;
  sleep_entries?: { inicio: string; fin: string } | { inicio: string; fin: string }[] | null;
  activity_blocks?:
    | { inicio: string; fin: string; subtipo: string | null }
    | { inicio: string; fin: string; subtipo: string | null }[]
    | null;
  medical_appointments?:
    | { inicio: string; fin: string; nombre_medico: string; direccion: string }
    | { inicio: string; fin: string; nombre_medico: string; direccion: string }[]
    | null;
}): JournalLogItem {
  const obs = Array.isArray(row.observations) ? row.observations[0] : row.observations;
  const meal = Array.isArray(row.meal_entries) ? row.meal_entries[0] : row.meal_entries;
  const med = Array.isArray(row.medication_administrations)
    ? row.medication_administrations[0]
    : row.medication_administrations;
  const sleep = Array.isArray(row.sleep_entries) ? row.sleep_entries[0] : row.sleep_entries;
  const activity = Array.isArray(row.activity_blocks) ? row.activity_blocks[0] : row.activity_blocks;
  const appt = Array.isArray(row.medical_appointments) ? row.medical_appointments[0] : row.medical_appointments;

  let title = EVENT_LABELS[row.tipo as EventType] ?? row.tipo;
  let detail = obs?.contenido ?? meal?.descripcion ?? '';
  if (med) {
    title = med.nombre_medicamento;
    detail = med.dosis;
  }
  if (row.tipo === 'comida' && meal) {
    if (meal.tipo_comida === 'sopa') title = 'Sopa';
    else if (meal.tipo_comida === 'jugo') title = 'Jugo';
    const mlPart = meal.mililitros != null ? `${meal.mililitros} ml` : '';
    const velPart =
      meal.velocidad_ml_h != null && Number(meal.velocidad_ml_h) > 0
        ? `${meal.velocidad_ml_h} ml/h`
        : '';
    const meta = [mlPart, velPart].filter(Boolean).join(' · ');
    if (meal.inicio) {
      if (meal.fin) {
        detail = meta
          ? `${formatHm(new Date(meal.inicio))} – ${formatHm(new Date(meal.fin))} · ${meta}`
          : `${formatHm(new Date(meal.inicio))} – ${formatHm(new Date(meal.fin))}`;
      } else {
        detail = meta
          ? `Desde ${formatHm(new Date(meal.inicio))} (comiendo) · ${meta}`
          : `Desde ${formatHm(new Date(meal.inicio))} (comiendo)`;
      }
    } else if (meta) {
      detail = meta;
    }
  }
  if (row.tipo === 'terapia' && activity?.subtipo) {
    title = formatTerapiaLabel(activity.subtipo);
  }
  let intervalInicio: string | undefined;
  let intervalFin: string | undefined;

  if (row.tipo === 'turno_medico' && appt) {
    title = appt.nombre_medico;
    detail = `${formatHm(new Date(appt.inicio))} – ${formatHm(new Date(appt.fin))} · ${appt.direccion}`;
    intervalInicio = appt.inicio;
    intervalFin = appt.fin;
  }
  const durationSource = sleep ?? activity ?? appt;
  if (row.tipo === 'sueno' && sleep) {
    title = EVENT_LABELS.sueno;
    if (sleep.fin) {
      detail = `${formatHm(new Date(sleep.inicio))} – ${formatHm(new Date(sleep.fin))}`;
    } else {
      detail = `Desde ${formatHm(new Date(sleep.inicio))} (durmiendo)`;
    }
  } else if (isDurationEventType(row.tipo) && durationSource) {
    const a = new Date(durationSource.inicio);
    const b = new Date(durationSource.fin);
    if (row.tipo !== 'terapia') title = EVENT_LABELS[row.tipo as EventType] ?? title;
    detail = `${formatHm(a)} – ${formatHm(b)}`;
    intervalInicio = durationSource.inicio;
    intervalFin = durationSource.fin;
  }
  if (row.tipo === 'sueno' && sleep) {
    intervalInicio = sleep.inicio;
    intervalFin = sleep.fin ?? undefined;
  }
  if (row.tipo === 'comida' && meal?.inicio) {
    intervalInicio = meal.inicio;
    intervalFin = meal.fin ?? undefined;
  }

  return {
    id: row.id,
    tipo: row.tipo as EventType,
    registrado_en: row.registrado_en,
    title,
    detail,
    authorName: authorFromRow(row as Parameters<typeof authorFromRow>[0]),
    mealHasInterval: row.tipo === 'comida' && !!meal?.inicio,
    intervalInicio,
    intervalFin,
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
      id, tipo, registrado_en, realizado_por,
      profiles:registrado_por ( nombre_completo ),
      realizador:realizado_por ( nombre_completo ),
      observations ( contenido ),
      meal_entries ( descripcion, tipo_comida, mililitros, inicio, fin, velocidad_ml_h ),
      medication_administrations ( nombre_medicamento, dosis ),
      sleep_entries ( inicio, fin ),
      activity_blocks ( inicio, fin, subtipo ),
      medical_appointments ( inicio, fin, nombre_medico, direccion )
    `)
    .eq('patient_id', patientId)
    .gte('registrado_en', start.toISOString())
    .lte('registrado_en', end.toISOString())
    .order('registrado_en', { ascending: true });

  if (error && isSchemaEmbedError(error.message)) {
    const retry = await supabase
      .from('care_logs')
      .select(`
      id, tipo, registrado_en, realizado_por,
      profiles:registrado_por ( nombre_completo ),
      realizador:realizado_por ( nombre_completo ),
      observations ( contenido ),
      ${MEAL_EMBED_SAFE},
      medication_administrations ( nombre_medicamento, dosis ),
      sleep_entries ( inicio, fin ),
      activity_blocks ( inicio, fin, subtipo )
    `)
      .eq('patient_id', patientId)
      .gte('registrado_en', start.toISOString())
      .lte('registrado_en', end.toISOString())
      .order('registrado_en', { ascending: true });
    if (retry.error) throw retry.error;
    return await enrichJournalRowsWithTurnos(retry.data ?? [], patientId, dateStr);
  }

  if (error) throw error;

  const byId = new Map<string, NonNullable<typeof data>[number]>();
  for (const row of data ?? []) {
    byId.set(row.id as string, row);
  }

  const { data: apptRows, error: apptErr } = await supabase
    .from('medical_appointments')
    .select('inicio, fin, care_log_id, care_logs!inner(patient_id, tipo)')
    .eq('care_logs.patient_id', patientId)
    .eq('care_logs.tipo', 'turno_medico');

  const extraIds: string[] = [];
  if (!apptErr) {
    for (const appt of apptRows ?? []) {
      if (!overlapsDay(new Date(appt.inicio as string), new Date(appt.fin as string), start, end)) continue;
      const id = appt.care_log_id as string;
      if (!byId.has(id)) extraIds.push(id);
    }
  }

  if (extraIds.length > 0) {
    const { data: extraLogs, error: extraErr } = await supabase
      .from('care_logs')
      .select(`
      id, tipo, registrado_en, realizado_por,
      profiles:registrado_por ( nombre_completo ),
      realizador:realizado_por ( nombre_completo ),
      observations ( contenido ),
      meal_entries ( descripcion, tipo_comida, mililitros, inicio, fin, velocidad_ml_h ),
      medication_administrations ( nombre_medicamento, dosis ),
      sleep_entries ( inicio, fin ),
      activity_blocks ( inicio, fin, subtipo ),
      medical_appointments ( inicio, fin, nombre_medico, direccion )
    `)
      .in('id', extraIds);
    if (!extraErr) {
      for (const row of extraLogs ?? []) {
        byId.set(row.id as string, row);
      }
    }
  }

  return await enrichJournalRowsWithTurnos([...byId.values()], patientId, dateStr);
}

async function enrichJournalRowsWithTurnos(
  rows: Record<string, unknown>[],
  patientId: string,
  dateStr: string
): Promise<JournalLogItem[]> {
  const { start, end } = dayBounds(dateStr);
  const turnoIds = rows.filter((r) => r.tipo === 'turno_medico').map((r) => r.id as string);
  const apptByLog = new Map<string, { inicio: string; fin: string; nombre_medico: string; direccion: string }>();

  if (turnoIds.length > 0) {
    const { data: appts } = await supabase
      .from('medical_appointments')
      .select('care_log_id, inicio, fin, nombre_medico, direccion')
      .in('care_log_id', turnoIds);
    for (const a of appts ?? []) {
      apptByLog.set(a.care_log_id as string, a as { inicio: string; fin: string; nombre_medico: string; direccion: string });
    }
  }

  const { data: apptOverlap } = await supabase
    .from('medical_appointments')
    .select('care_log_id, inicio, fin, nombre_medico, direccion, care_logs!inner(patient_id, tipo)')
    .eq('care_logs.patient_id', patientId)
    .eq('care_logs.tipo', 'turno_medico');

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    byId.set(row.id as string, row);
  }

  for (const a of apptOverlap ?? []) {
    if (!overlapsDay(new Date(a.inicio as string), new Date(a.fin as string), start, end)) continue;
    const id = a.care_log_id as string;
    if (!byId.has(id)) {
      const { data: cl } = await supabase
        .from('care_logs')
        .select('id, tipo, registrado_en, realizado_por')
        .eq('id', id)
        .maybeSingle();
      if (cl) byId.set(id, cl as Record<string, unknown>);
    }
    const row = byId.get(id);
    if (row) {
      apptByLog.set(id, {
        inicio: a.inicio as string,
        fin: a.fin as string,
        nombre_medico: a.nombre_medico as string,
        direccion: a.direccion as string,
      });
      row.medical_appointments = apptByLog.get(id);
    }
  }

  for (const row of byId.values()) {
    const appt = apptByLog.get(row.id as string);
    if (appt) row.medical_appointments = appt;
  }

  return [...byId.values()]
    .map((row) => mapLogRow(row as Parameters<typeof mapLogRow>[0]))
    .sort((a, b) => new Date(a.registrado_en).getTime() - new Date(b.registrado_en).getTime());
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
    const nowIso = new Date().toISOString();
    for (const row of sleepRows ?? []) {
      const endIso = row.fin ?? nowIso;
      if (overlapsDay(new Date(row.inicio), new Date(endIso), start, end)) {
        blocks.push({
          inicio: row.inicio,
          fin: endIso,
          careLogId: row.care_log_id as string,
          tipo: 'sueno',
        });
      }
    }
  }

  const { data: mealRows, error: mealErr } = await supabase
    .from('meal_entries')
    .select('inicio, fin, care_log_id, care_logs!inner(patient_id, tipo)')
    .eq('care_logs.patient_id', patientId)
    .eq('care_logs.tipo', 'comida')
    .not('inicio', 'is', null);

  if (!mealErr) {
    const nowIso = new Date().toISOString();
    for (const row of mealRows ?? []) {
      const cl = Array.isArray(row.care_logs) ? row.care_logs[0] : row.care_logs;
      if (cl?.tipo !== 'comida' || !row.inicio) continue;
      const endIso = row.fin ?? nowIso;
      if (overlapsDay(new Date(row.inicio), new Date(endIso), start, end)) {
        blocks.push({
          inicio: row.inicio,
          fin: endIso,
          careLogId: row.care_log_id as string,
          tipo: 'comida',
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
      if (cl.tipo === 'turno_medico') continue;
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

  const { data: apptRows, error: apptErr } = await supabase
    .from('medical_appointments')
    .select('inicio, fin, nombre_medico, care_log_id, care_logs!inner(patient_id)')
    .eq('care_logs.patient_id', patientId);

  if (!apptErr) {
    for (const row of apptRows ?? []) {
      if (overlapsDay(new Date(row.inicio), new Date(row.fin), start, end)) {
        blocks.push({
          inicio: row.inicio as string,
          fin: row.fin as string,
          careLogId: row.care_log_id as string,
          tipo: 'turno_medico',
          title: row.nombre_medico as string,
        });
      }
    }
  } else if (/medical_appointments|42703|42P01/i.test(apptErr.message)) {
    const { data: turnoLogs } = await supabase
      .from('care_logs')
      .select(`
        id, tipo, registrado_en,
        medical_appointments ( inicio, fin, nombre_medico )
      `)
      .eq('patient_id', patientId)
      .eq('tipo', 'turno_medico')
      .gte('registrado_en', start.toISOString())
      .lte('registrado_en', end.toISOString());
    for (const cl of turnoLogs ?? []) {
      const appt = Array.isArray(cl.medical_appointments)
        ? cl.medical_appointments[0]
        : cl.medical_appointments;
      if (appt?.inicio && appt?.fin) {
        blocks.push({
          inicio: appt.inicio,
          fin: appt.fin,
          careLogId: cl.id as string,
          tipo: 'turno_medico',
          title: appt.nombre_medico,
        });
      }
    }
  }

  return blocks;
}

/** Combina bloques del servidor con intervalos del journal del día (respaldo). */
export function mergeDurationBlocksForDay(
  durationBlocks: DurationBlock[],
  logs: JournalLogItem[]
): DurationBlock[] {
  const byId = new Map<string, DurationBlock>();
  for (const block of durationBlocks) {
    byId.set(block.careLogId, block);
  }
  for (const log of logs) {
    if (!isCalendarShadedOnlyLogType(log.tipo)) continue;
    if (byId.has(log.id)) continue;
    if (!log.intervalInicio) continue;
    const fin =
      log.intervalFin ??
      (log.tipo === 'sueno' || log.tipo === 'comida' ? new Date().toISOString() : log.intervalInicio);
    byId.set(log.id, {
      careLogId: log.id,
      tipo: log.tipo,
      inicio: log.intervalInicio,
      fin,
      title: log.tipo === 'turno_medico' ? log.title : undefined,
    });
  }
  return [...byId.values()];
}

/** @deprecated use fetchDurationBlocksForDay */
export async function fetchSleepBlocksForDay(patientId: string, dateStr: string): Promise<SleepBlock[]> {
  const all = await fetchDurationBlocksForDay(patientId, dateStr);
  return all
    .filter((b) => b.tipo === 'sueno')
    .map(({ inicio, fin, careLogId }) => ({ inicio, fin, careLogId }));
}

const MEAL_EMBED_FULL = 'meal_entries ( descripcion, tipo_comida, mililitros, inicio, fin, velocidad_ml_h )';
const MEAL_EMBED_SAFE = 'meal_entries ( descripcion, tipo_comida, mililitros )';

const detailSelect = `
  id, patient_id, tipo, registrado_en, registrado_por, realizado_por,
  profiles:registrado_por ( nombre_completo ),
  realizador:realizado_por ( nombre_completo ),
  observations ( contenido ),
  ${MEAL_EMBED_FULL},
  medication_administrations ( nombre_medicamento, dosis, administrado_en ),
  sleep_entries ( inicio, fin ),
  activity_blocks ( inicio, fin, subtipo ),
  medical_appointments ( inicio, fin, nombre_medico, direccion )
`;

const detailSelectCore = `
  id, patient_id, tipo, registrado_en, registrado_por, realizado_por,
  profiles:registrado_por ( nombre_completo ),
  realizador:realizado_por ( nombre_completo ),
  observations ( contenido ),
  ${MEAL_EMBED_SAFE},
  medication_administrations ( nombre_medicamento, dosis, administrado_en ),
  sleep_entries ( inicio, fin ),
  activity_blocks ( inicio, fin, subtipo )
`;

const detailSelectSlim = `
  id, patient_id, tipo, registrado_en, registrado_por, realizado_por,
  profiles:registrado_por ( nombre_completo ),
  realizador:realizado_por ( nombre_completo )
`;

function isSchemaEmbedError(message: string) {
  return /does not exist|medical_appointments|meal_entries|sleep_entries|activity_blocks|relationship|PGRST200|42P01|42703/i.test(
    message
  );
}

async function loadCareLogRowForDetail(id: string) {
  let result = await supabase.from('care_logs').select(detailSelect).eq('id', id).maybeSingle();
  if (result.error && isSchemaEmbedError(result.error.message)) {
    result = await supabase.from('care_logs').select(detailSelectCore).eq('id', id).maybeSingle();
  }
  if (result.error && isSchemaEmbedError(result.error.message)) {
    result = await supabase.from('care_logs').select(detailSelectSlim).eq('id', id).maybeSingle();
  }
  if (result.error) throw result.error;
  if (!result.data) return null;

  const row = result.data as Record<string, unknown>;
  if (row.tipo === 'turno_medico' && !row.medical_appointments) {
    const appt = await fetchMedicalAppointmentByCareLogId(id);
    if (appt) row.medical_appointments = appt;
  }
  return row;
}

export async function fetchCareLogDetail(id: string): Promise<CareLogDetail | null> {
  const data = await loadCareLogRowForDetail(id);
  if (!data) return null;

  const journal = mapLogRow(data as Parameters<typeof mapLogRow>[0]);
  const row = data as Parameters<typeof mapLogRow>[0] & {
    patient_id: string;
    registrado_por: string;
    observations?: unknown;
    meal_entries?: unknown;
    medication_administrations?: unknown;
    sleep_entries?: unknown;
    activity_blocks?: unknown;
    medical_appointments?: unknown;
  };

  const authorName = authorFromRow(row);
  const obs = Array.isArray(row.observations) ? row.observations[0] : row.observations;
  const meal = Array.isArray(row.meal_entries) ? row.meal_entries[0] : row.meal_entries;
  const med = Array.isArray(row.medication_administrations)
    ? row.medication_administrations[0]
    : row.medication_administrations;
  const sleep = Array.isArray(row.sleep_entries) ? row.sleep_entries[0] : row.sleep_entries;
  const activity = Array.isArray(row.activity_blocks) ? row.activity_blocks[0] : row.activity_blocks;
  const appt = Array.isArray(row.medical_appointments)
    ? row.medical_appointments[0]
    : row.medical_appointments;

  let editableText = obs?.contenido ?? meal?.descripcion ?? '';
  if (med) editableText = med.dosis;
  if (row.tipo === 'comida' && meal?.mililitros != null) {
    editableText = String(meal.mililitros);
  }

  const duration = sleep ?? activity ?? (row.tipo === 'turno_medico' ? appt : null);

  let mealInicio: string | undefined;
  let mealFin: string | undefined;
  let mealVelocidadMlH: number | null | undefined;
  if (row.tipo === 'comida' && meal?.inicio) {
    mealInicio = meal.inicio;
    mealFin = meal.fin ?? undefined;
    mealVelocidadMlH = meal.velocidad_ml_h != null ? Number(meal.velocidad_ml_h) : null;
  }

  let stockConsumptions: CareLogConsumptionRow[] = [];
  if (isStockConsumptionEventType(row.tipo)) {
    stockConsumptions = await fetchCareLogConsumptions(id);
  }
  const detail =
    stockConsumptions.length > 0 ? formatConsumptionDetail(stockConsumptions) : journal.detail;

  return {
    id: row.id,
    patient_id: row.patient_id,
    tipo: row.tipo as EventType,
    registrado_en: row.registrado_en,
    registrado_por: row.registrado_por,
    authorName,
    title: journal.title,
    detail,
    editableText,
    medNombre: med?.nombre_medicamento,
    medDosis: med?.dosis,
    sleepInicio: duration?.inicio,
    sleepFin: duration?.fin,
    mealInicio,
    mealFin,
    mealVelocidadMlH,
    activitySubtipo: activity?.subtipo ?? undefined,
    turnoMedico: appt?.nombre_medico ?? undefined,
    turnoDireccion: appt?.direccion ?? undefined,
    turnoInicio: appt?.inicio ?? undefined,
    turnoFin: appt?.fin ?? undefined,
    stockConsumptions: stockConsumptions.length > 0 ? stockConsumptions : undefined,
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
    turnoMedico?: string;
    turnoDireccion?: string;
  }
) {
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(input.date)
    ? input.date
    : parseDateTimeLocal(detail.registrado_en).date;

  if (detail.tipo === 'turno_medico') {
    const startHm = input.sleepStart?.trim() || input.time.trim() || '09:00';
    const inicio = combineDateTime(eventDate, startHm);
    let fin = input.sleepEnd?.trim()
      ? combineDateTime(eventDate, input.sleepEnd.trim())
      : detail.turnoFin
        ? new Date(detail.turnoFin)
        : new Date(inicio.getTime() + 60 * 60 * 1000);
    if (fin.getTime() <= inicio.getTime()) {
      fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
    }
    const nombre = (input.turnoMedico ?? detail.turnoMedico ?? detail.title).trim();
    const direccion = (input.turnoDireccion ?? detail.turnoDireccion ?? '').trim();
    if (!nombre) throw new Error('Indica el nombre del médico');
    if (!direccion) throw new Error('Indica la dirección');

    const { error: apptErr } = await supabase
      .from('medical_appointments')
      .update({
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        nombre_medico: nombre,
        direccion: direccion,
      })
      .eq('care_log_id', detail.id);
    if (apptErr) throw apptErr;

    const { error: logError } = await supabase
      .from('care_logs')
      .update({ registrado_en: inicio.toISOString() })
      .eq('id', detail.id);
    if (logError) throw logError;
    return;
  }

  const registradoEn = combineDateTime(eventDate, input.time);

  const { error: logError } = await supabase
    .from('care_logs')
    .update({ registrado_en: registradoEn.toISOString() })
    .eq('id', detail.id);
  if (logError) throw logError;

  if (detail.tipo === 'comida') {
    const ml = parseFloat(input.text.replace(',', '.'));
    if (detail.mealInicio && input.sleepStart) {
      const inicio = combineDateTime(eventDate, input.sleepStart);
      let finIso: string | null = null;
      if (input.sleepEnd?.trim()) {
        let fin = combineDateTime(eventDate, input.sleepEnd);
        if (fin.getTime() <= inicio.getTime()) {
          fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
        }
        finIso = fin.toISOString();
      }
      const { error: mealErr } = await supabase
        .from('meal_entries')
        .update({
          inicio: inicio.toISOString(),
          fin: finIso,
          mililitros: Number.isFinite(ml) ? ml : null,
        })
        .eq('care_log_id', detail.id);
      if (mealErr) throw mealErr;
      await supabase.from('care_logs').update({ registrado_en: inicio.toISOString() }).eq('id', detail.id);
    } else {
      const { error } = await supabase
        .from('meal_entries')
        .update({
          mililitros: Number.isFinite(ml) ? ml : null,
          descripcion: Number.isFinite(ml) ? `${ml} ml` : input.text.trim(),
        })
        .eq('care_log_id', detail.id);
      if (error) throw error;
    }
  } else if (detail.tipo === 'medicacion') {
    const adminEn = registradoEn.toISOString();
    const { error } = await supabase
      .from('medication_administrations')
      .update({ dosis: input.text.trim(), administrado_en: adminEn })
      .eq('care_log_id', detail.id);
    if (error) throw error;
  } else if (detail.tipo === 'sueno' && input.sleepStart) {
    const inicio = combineDateTime(eventDate, input.sleepStart);
    let finIso: string | null = null;
    if (input.sleepEnd?.trim()) {
      let fin = combineDateTime(eventDate, input.sleepEnd);
      if (fin.getTime() <= inicio.getTime()) {
        fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
      }
      finIso = fin.toISOString();
    }
    const { error: sleepErr } = await supabase
      .from('sleep_entries')
      .update({ inicio: inicio.toISOString(), fin: finIso })
      .eq('care_log_id', detail.id);
    if (sleepErr) throw sleepErr;
    await supabase.from('care_logs').update({ registrado_en: inicio.toISOString() }).eq('id', detail.id);
  } else if (isDurationEventType(detail.tipo) && input.sleepStart && input.sleepEnd) {
    const inicio = combineDateTime(eventDate, input.sleepStart);
    let fin = combineDateTime(eventDate, input.sleepEnd);
    if (fin.getTime() <= inicio.getTime()) {
      fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
    }
    const { error: actErr } = await supabase
      .from('activity_blocks')
      .update({ inicio: inicio.toISOString(), fin: fin.toISOString() })
      .eq('care_log_id', detail.id);
    if (actErr) throw actErr;
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
      meal_entries ( descripcion, tipo_comida, mililitros, inicio, fin, velocidad_ml_h ),
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

  const [{ data: logs }, { data: schedules }, { data: appts }] = await Promise.all([
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
    supabase
      .from('medical_appointments')
      .select('inicio, care_logs!inner(patient_id)')
      .eq('care_logs.patient_id', patientId)
      .gte('inicio', start)
      .lt('inicio', end),
  ]);

  const map = new Map<string, Set<string>>();
  (logs ?? []).forEach((row) => addToMap(map, dateKeyFromIso(row.registrado_en), row.tipo));
  (schedules ?? []).forEach((row) => addToMap(map, dateKeyFromIso(row.programado_para), 'medicacion'));
  (appts ?? []).forEach((row) => addToMap(map, dateKeyFromIso(row.inicio as string), 'turno_medico'));
  return map;
}

const recentSelectFull = `
  id, tipo, registrado_en, registrado_por, realizado_por,
  profiles:registrado_por ( nombre_completo ),
  realizador:realizado_por ( nombre_completo ),
  observations ( contenido ),
  ${MEAL_EMBED_FULL},
  medication_administrations ( nombre_medicamento, dosis ),
  sleep_entries ( inicio, fin ),
  activity_blocks ( inicio, fin, subtipo ),
  medical_appointments ( inicio, fin, nombre_medico, direccion )
`;

const recentSelectSafe = `
  id, tipo, registrado_en, registrado_por, realizado_por,
  profiles:registrado_por ( nombre_completo ),
  realizador:realizado_por ( nombre_completo ),
  observations ( contenido ),
  ${MEAL_EMBED_SAFE},
  medication_administrations ( nombre_medicamento, dosis ),
  sleep_entries ( inicio, fin ),
  activity_blocks ( inicio, fin, subtipo )
`;

async function attachMedicalAppointmentsToRows(rows: Record<string, unknown>[]) {
  const turnoIds = rows.filter((r) => r.tipo === 'turno_medico').map((r) => r.id as string);
  if (turnoIds.length === 0) return;

  const { data: appts, error } = await supabase
    .from('medical_appointments')
    .select('care_log_id, inicio, fin, nombre_medico, direccion')
    .in('care_log_id', turnoIds);
  if (error) {
    if (isSchemaEmbedError(error.message)) return;
    throw error;
  }

  const byLog = new Map<string, { inicio: string; fin: string; nombre_medico: string; direccion: string }>();
  for (const a of appts ?? []) {
    byLog.set(a.care_log_id as string, a as { inicio: string; fin: string; nombre_medico: string; direccion: string });
  }
  for (const row of rows) {
    const appt = byLog.get(row.id as string);
    if (appt) row.medical_appointments = appt;
  }
}

export async function fetchRecentLogs(limit = 30, tipoFilter?: EventType[], patientId?: string) {
  const base = () => {
    let q = supabase
      .from('care_logs')
      .select(recentSelectFull)
      .order('registrado_en', { ascending: false })
      .limit(limit);
    if (patientId) q = q.eq('patient_id', patientId);
    if (tipoFilter?.length) q = q.in('tipo', tipoFilter);
    return q;
  };

  let rows: Record<string, unknown>[] = [];
  const first = await base();
  if (!first.error) {
    rows = (first.data ?? []) as Record<string, unknown>[];
  } else if (isSchemaEmbedError(first.error.message)) {
    let q = supabase
      .from('care_logs')
      .select(recentSelectSafe)
      .order('registrado_en', { ascending: false })
      .limit(limit);
    if (patientId) q = q.eq('patient_id', patientId);
    if (tipoFilter?.length) q = q.in('tipo', tipoFilter);
    const retry = await q;
    if (retry.error) throw retry.error;
    rows = (retry.data ?? []) as Record<string, unknown>[];
  } else {
    throw first.error;
  }
  await attachMedicalAppointmentsToRows(rows);

  return rows.map((row) => {
    const mapped = mapLogRow(row as Parameters<typeof mapLogRow>[0]);
    return {
      id: mapped.id,
      tipo: mapped.tipo,
      registrado_en: mapped.registrado_en,
      registrado_por: row.registrado_por as string,
      nurseName: mapped.authorName,
      detail: mapped.detail || mapped.title,
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
