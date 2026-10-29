import { normalizeInventoryName } from './inventory';
import { supabase } from './supabase';

/** ¿Cande ya recibió antes esta medicación (mismo nombre)? */
export async function hasPatientReceivedMedication(patientId: string, nombre: string): Promise<boolean> {
  const key = normalizeInventoryName(nombre);
  if (!key) return false;

  const { data, error } = await supabase
    .from('medication_administrations')
    .select('nombre_medicamento, care_logs!inner(patient_id)')
    .eq('care_logs.patient_id', patientId)
    .limit(300);

  if (error) throw error;
  return (data ?? []).some(
    (row) => normalizeInventoryName(String(row.nombre_medicamento ?? '')) === key
  );
}
