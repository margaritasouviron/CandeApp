import { supabase } from './supabase';

export type UpcomingDose = {
  id: string;
  prescriptionId: string;
  programadoPara: string;
  status: 'pendiente' | 'retrasada' | 'administrada' | 'omitida';
  nombre: string;
  dosis: string;
  intervaloHoras: number;
};

type RxJoin = {
  nombre: string;
  dosis_estandar: string;
  intervalo_horas: number;
};

function mapRow(row: {
  id: string;
  prescription_id: string;
  programado_para: string;
  status: string;
  medication_prescriptions: RxJoin | RxJoin[] | null;
}): UpcomingDose {
  const rx = Array.isArray(row.medication_prescriptions)
    ? row.medication_prescriptions[0]
    : row.medication_prescriptions;

  return {
    id: row.id,
    prescriptionId: row.prescription_id,
    programadoPara: row.programado_para,
    status: row.status as UpcomingDose['status'],
    nombre: rx?.nombre ?? 'Medicación',
    dosis: rx?.dosis_estandar ?? '—',
    intervaloHoras: Number(rx?.intervalo_horas ?? 0),
  };
}

/** Dosis pendientes o retrasadas (próximas horas + atrasadas recientes). */
export async function fetchUpcomingDoses(patientId: string, hoursAhead = 48): Promise<UpcomingDose[]> {
  const now = new Date();
  const until = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const overdueSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('medication_schedules')
    .select(`
      id, prescription_id, programado_para, status,
      medication_prescriptions ( nombre, dosis_estandar, intervalo_horas )
    `)
    .eq('patient_id', patientId)
    .in('status', ['pendiente', 'retrasada'])
    .gte('programado_para', overdueSince.toISOString())
    .lte('programado_para', until.toISOString())
    .order('programado_para', { ascending: true })
    .limit(30);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** Dosis en las próximas N horas (para recordatorios en Home). */
export async function fetchDoseReminders(patientId: string, hoursAhead = 12): Promise<UpcomingDose[]> {
  const doses = await fetchUpcomingDoses(patientId, hoursAhead);
  const now = Date.now();
  const limit = now + hoursAhead * 60 * 60 * 1000;

  return doses.filter((d) => {
    const t = new Date(d.programadoPara).getTime();
    return d.status === 'retrasada' || t <= limit;
  });
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function formatDoseTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDoseClock(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Próxima dosis a administrar: retrasada, vencida o en menos de 1 hora. */
export function getUrgentMedicationDose(doses: UpcomingDose[], nowMs = Date.now()): UpcomingDose | null {
  let best: UpcomingDose | null = null;
  let bestTime = Infinity;

  for (const dose of doses) {
    const t = new Date(dose.programadoPara).getTime();
    const urgent =
      dose.status === 'retrasada' || t <= nowMs || (t > nowMs && t - nowMs <= ONE_HOUR_MS);
    if (!urgent) continue;
    if (t < bestTime) {
      bestTime = t;
      best = dose;
    }
  }

  return best;
}

export function medicationUrgencyBannerText(dose: UpcomingDose, nowMs = Date.now()): string {
  const t = new Date(dose.programadoPara).getTime();
  const clock = formatDoseClock(dose.programadoPara);

  if (dose.status === 'retrasada' || t <= nowMs) {
    return `Hay que administrar ${dose.nombre} (${dose.dosis}). ${dose.status === 'retrasada' ? 'Dosis retrasada.' : 'Ya corresponde dar la medicación.'}`;
  }

  const mins = Math.max(1, Math.round((t - nowMs) / 60000));
  if (mins >= 60) {
    return `Hay que administrar ${dose.nombre} (${dose.dosis}) antes de las ${clock}.`;
  }
  return `Falta menos de 1 hora para dar ${dose.nombre} (${dose.dosis}): en ${mins} min (a las ${clock}).`;
}

export function doseStatusLabel(status: UpcomingDose['status']) {
  if (status === 'retrasada') return 'Retrasada';
  return 'Pendiente';
}

export async function deleteUpcomingDose(scheduleId: string) {
  const { error } = await supabase.from('medication_schedules').delete().eq('id', scheduleId);
  if (error) throw error;
}

/** Elimina este suministro y todos los posteriores de la misma medicación. */
export async function deleteUpcomingDoseAndFollowing(dose: UpcomingDose) {
  const { error } = await supabase
    .from('medication_schedules')
    .delete()
    .eq('prescription_id', dose.prescriptionId)
    .in('status', ['pendiente', 'retrasada'])
    .gte('programado_para', dose.programadoPara);
  if (error) throw error;
}

export function deleteUpcomingDoseMessage(dose: UpcomingDose) {
  return `¿Confirmás que deseás suspender el suministro de ${dose.nombre} programado para ${formatDoseTime(dose.programadoPara)}?`;
}

/** Parámetros para abrir registro con medicación precargada (confirmar dosis). */
export function registroParamsFromDose(dose: UpcomingDose) {
  const now = new Date();
  return {
    confirm: '1',
    prescriptionId: dose.prescriptionId,
    scheduleId: dose.id,
    dosis: dose.dosis,
    intervalo: String(dose.intervaloHoras),
    hora: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    date: now.toISOString().slice(0, 10),
  };
}
