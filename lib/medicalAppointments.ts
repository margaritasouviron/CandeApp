import { supabase } from './supabase';
import type { UpcomingDose } from './medicationSchedules';

export type MedicalTurno = {
  careLogId: string;
  inicio: string;
  fin: string;
  nombreMedico: string;
  direccion: string;
};

const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;

export async function saveMedicalTurno(params: {
  patientId: string;
  userId: string;
  realizadoPor: string | null;
  inicio: Date;
  fin: Date;
  nombreMedico: string;
  direccion: string;
}) {
  if (params.fin.getTime() <= params.inicio.getTime()) {
    throw new Error('La hora de fin debe ser posterior al inicio');
  }

  const { data: log, error: logError } = await supabase
    .from('care_logs')
    .insert({
      patient_id: params.patientId,
      tipo: 'turno_medico',
      registrado_por: params.userId,
      realizado_por: params.realizadoPor,
      registrado_en: params.inicio.toISOString(),
    })
    .select('id')
    .single();
  if (logError) throw logError;

  const { error: apptError } = await supabase.from('medical_appointments').insert({
    care_log_id: log.id,
    inicio: params.inicio.toISOString(),
    fin: params.fin.toISOString(),
    nombre_medico: params.nombreMedico.trim(),
    direccion: params.direccion.trim(),
  });
  if (apptError) {
    await supabase.from('care_logs').delete().eq('id', log.id);
    throw apptError;
  }

  return log.id as string;
}

export async function fetchMedicalAppointmentByCareLogId(careLogId: string) {
  const { data, error } = await supabase
    .from('medical_appointments')
    .select('inicio, fin, nombre_medico, direccion')
    .eq('care_log_id', careLogId)
    .maybeSingle();

  if (error) {
    if (/medical_appointments|42P01|42703|PGRST/i.test(error.message)) return null;
    throw error;
  }
  return data;
}

export async function fetchMedicalTurnosInRange(patientId: string, fromIso: string, toIso: string): Promise<MedicalTurno[]> {
  const { data, error } = await supabase
    .from('medical_appointments')
    .select('care_log_id, inicio, fin, nombre_medico, direccion, care_logs!inner(patient_id)')
    .eq('care_logs.patient_id', patientId)
    .lt('inicio', toIso)
    .gt('fin', fromIso)
    .order('inicio', { ascending: true });

  if (error) {
    if (/medical_appointments|42703|turno_medico/i.test(error.message)) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    careLogId: row.care_log_id as string,
    inicio: row.inicio as string,
    fin: row.fin as string,
    nombreMedico: row.nombre_medico as string,
    direccion: row.direccion as string,
  }));
}

const PREP_PAST_GRACE_MS = 45 * 60 * 1000;

/** Turnos con menos de `hours` horas para el inicio (o recién empezados). */
export function filterTurnosNeedingPrep(turnos: MedicalTurno[], hours = 2): MedicalTurno[] {
  const now = Date.now();
  const maxLeadMs = hours * 60 * 60 * 1000;

  return turnos
    .filter((t) => {
      const startMs = new Date(t.inicio).getTime();
      const endMs = new Date(t.fin).getTime();
      if (now >= endMs) return false;
      const untilStart = startMs - now;
      if (untilStart > maxLeadMs) return false;
      if (untilStart < -PREP_PAST_GRACE_MS) return false;
      return true;
    })
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
}

/** Turnos que empiezan en las próximas `hours` horas (para Home). */
export async function fetchMedicalTurnosNeedingPrep(patientId: string, hours = 2): Promise<MedicalTurno[]> {
  const upcoming = await fetchUpcomingMedicalTurnos(patientId, Math.max(hours + 6, 48));
  return filterTurnosNeedingPrep(upcoming, hours);
}

export function formatTurnoClock(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatTurnoDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function mapMedicalTurnoRows(
  data: {
    care_log_id: string;
    inicio: string;
    fin: string;
    nombre_medico: string;
    direccion: string;
  }[]
): MedicalTurno[] {
  return data
    .filter((row) => typeof row.care_log_id === 'string' && row.care_log_id.length > 10)
    .map((row) => ({
      careLogId: row.care_log_id,
      inicio: row.inicio,
      fin: row.fin,
      nombreMedico: row.nombre_medico,
      direccion: row.direccion,
    }));
}

async function fetchUpcomingMedicalTurnosByCareLogIds(
  patientId: string,
  overdueSince: Date,
  until: Date
): Promise<MedicalTurno[]> {
  const { data: logs, error: logErr } = await supabase
    .from('care_logs')
    .select('id')
    .eq('patient_id', patientId)
    .eq('tipo', 'turno_medico');
  if (logErr) {
    if (/turno_medico|42703|22P02|invalid input value/i.test(logErr.message)) return [];
    throw logErr;
  }
  const ids = (logs ?? []).map((l) => l.id as string).filter((id) => id.length > 10);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('medical_appointments')
    .select('care_log_id, inicio, fin, nombre_medico, direccion')
    .in('care_log_id', ids)
    .gte('inicio', overdueSince.toISOString())
    .lte('inicio', until.toISOString())
    .order('inicio', { ascending: true })
    .limit(30);

  if (error) {
    if (/medical_appointments|42P01|42703/i.test(error.message)) return [];
    throw error;
  }

  return mapMedicalTurnoRows((data ?? []) as Parameters<typeof mapMedicalTurnoRows>[0]);
}

/** Próximos turnos (incluye hasta 24 h de atraso, alineado con medicación). */
export async function fetchUpcomingMedicalTurnos(
  patientId: string,
  hoursAhead = 120
): Promise<MedicalTurno[]> {
  const now = new Date();
  const overdueSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const until = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('medical_appointments')
    .select('care_log_id, inicio, fin, nombre_medico, direccion, care_logs!inner(patient_id)')
    .eq('care_logs.patient_id', patientId)
    .gte('inicio', overdueSince.toISOString())
    .lte('inicio', until.toISOString())
    .order('inicio', { ascending: true })
    .limit(30);

  if (error) {
    if (/medical_appointments|42703|turno_medico|PGRST200|relationship/i.test(error.message)) {
      return fetchUpcomingMedicalTurnosByCareLogIds(patientId, overdueSince, until);
    }
    throw error;
  }

  return mapMedicalTurnoRows(
    (data ?? []) as {
      care_log_id: string;
      inicio: string;
      fin: string;
      nombre_medico: string;
      direccion: string;
    }[]
  );
}

export type CalendarUpcomingItem =
  | { kind: 'dose'; at: string; dose: UpcomingDose }
  | { kind: 'turno'; at: string; turno: MedicalTurno };

export function mergeCalendarUpcoming(doses: UpcomingDose[], turnos: MedicalTurno[], limit = 10): CalendarUpcomingItem[] {
  const items: CalendarUpcomingItem[] = [
    ...doses.map((dose) => ({ kind: 'dose' as const, at: dose.programadoPara, dose })),
    ...turnos.map((turno) => ({ kind: 'turno' as const, at: turno.inicio, turno })),
  ];
  items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return items.slice(0, limit);
}

export function medicalTurnoPrepMessage(turno: MedicalTurno) {
  const mins = Math.round((new Date(turno.inicio).getTime() - Date.now()) / 60_000);
  const when =
    mins <= 0
      ? 'ahora'
      : mins < 60
        ? `en ${mins} min`
        : `en ${Math.floor(mins / 60)} h ${mins % 60} min`;
  return `Prepará a Cande para el turno con ${turno.nombreMedico} (${when}) · ${turno.direccion}`;
}

export { REMINDER_WINDOW_MS };
