import { supabase } from './supabase';

export type MedicationAlertPayload = {
  schedule_id?: string;
  prescription_id?: string;
  nombre?: string;
  dosis?: string;
  programado_para?: string;
  estado?: string;
};

export type MedicationAlert = {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  leida: boolean;
  created_at: string;
  payload: MedicationAlertPayload | null;
};

export type ResolvedMedicationAlert = {
  nombre: string;
  dosis: string;
  horario: string;
};

const GENERIC_TITLES = new Set(['Dosis pendiente', 'Medicación', '']);

export function formatAlertHorario(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function normalizePayload(raw: unknown): MedicationAlertPayload {
  if (!raw || typeof raw !== 'object') return {};
  return raw as MedicationAlertPayload;
}

/** Extrae nombre, dosis y horario aunque la notificación sea antigua o el payload venga incompleto. */
export function resolveAlertDetails(alert: MedicationAlert): ResolvedMedicationAlert {
  const payload = normalizePayload(alert.payload);

  let nombre = payload.nombre?.trim();
  if (!nombre && alert.titulo && !GENERIC_TITLES.has(alert.titulo.trim())) {
    nombre = alert.titulo.trim();
  }
  if (!nombre && alert.cuerpo) {
    const fromBody =
      alert.cuerpo.match(/^(.+?)\s*·\s*Dosis:/)?.[1]?.trim() ??
      alert.cuerpo.match(/^Dosis pendiente:\s*(.+)$/i)?.[1]?.trim();
    if (fromBody) nombre = fromBody;
  }

  let dosis = payload.dosis?.trim();
  if (!dosis && alert.cuerpo) {
    dosis = alert.cuerpo.match(/Dosis:\s*([^·]+)/)?.[1]?.trim();
  }

  let horario = payload.programado_para;
  if (!horario && alert.cuerpo) {
    const horarioMatch = alert.cuerpo.match(/Horario:\s*(.+?)(?:\s*·|$)/)?.[1]?.trim();
    if (horarioMatch) {
      return {
        nombre: nombre || 'Medicación',
        dosis: dosis || '—',
        horario: horarioMatch,
      };
    }
  }

  return {
    nombre: nombre || 'Medicación',
    dosis: dosis || '—',
    horario: formatAlertHorario(horario),
  };
}

async function enrichAlertsWithPrescriptionNames(alerts: MedicationAlert[]): Promise<MedicationAlert[]> {
  const missing = alerts.filter((a) => {
    const p = normalizePayload(a.payload);
    return !p.nombre && !GENERIC_TITLES.has(a.titulo?.trim() ?? '') && p.prescription_id;
  });
  if (missing.length === 0) return alerts;

  const ids = [...new Set(missing.map((a) => normalizePayload(a.payload).prescription_id).filter(Boolean))];
  const { data: rxList } = await supabase
    .from('medication_prescriptions')
    .select('id, nombre, dosis_estandar')
    .in('id', ids as string[]);

  const byId = new Map((rxList ?? []).map((r) => [r.id, r]));

  return alerts.map((alert) => {
    const payload = normalizePayload(alert.payload);
    if (payload.nombre || !payload.prescription_id) return alert;
    const rx = byId.get(payload.prescription_id);
    if (!rx) return alert;
    return {
      ...alert,
      titulo: rx.nombre,
      payload: {
        ...payload,
        nombre: rx.nombre,
        dosis: payload.dosis ?? rx.dosis_estandar,
      },
    };
  });
}

const MEDICATION_TIPOS = new Set([
  'nueva_medicacion',
  'medicacion_programada',
  'medicacion_proxima',
  'dosis_omitida',
]);

export function isMedicationAlert(tipo: string) {
  return MEDICATION_TIPOS.has(tipo);
}

export async function refreshMedicationAlerts() {
  await supabase.rpc('refresh_app_alerts');
}

export async function fetchMedicationAlerts(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, tipo, titulo, cuerpo, leida, created_at, payload')
    .eq('user_id', userId)
    .in('tipo', [...MEDICATION_TIPOS])
    .eq('leida', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return enrichAlertsWithPrescriptionNames((data ?? []) as MedicationAlert[]);
}

export async function markAlertRead(alertId: string) {
  await supabase.from('notifications').update({ leida: true }).eq('id', alertId);
}
