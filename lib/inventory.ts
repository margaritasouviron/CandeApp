import { supabase } from './supabase';

export type InventoryItem = {
  id: string;
  nombre: string;
  categoria: string | null;
  cantidad_actual: number;
  cantidad_minima: number;
  unidad: string;
  prescription_id?: string | null;
};

export async function fetchInventory(patientId: string) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, nombre, categoria, cantidad_actual, cantidad_minima, unidad, prescription_id')
    .eq('patient_id', patientId)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as InventoryItem[];
}

export async function findPrescriptionByName(patientId: string, nombre: string) {
  const { data } = await supabase
    .from('medication_prescriptions')
    .select('id')
    .eq('patient_id', patientId)
    .eq('activo', true)
    .ilike('nombre', nombre.trim())
    .maybeSingle();
  return data?.id as string | undefined;
}

export async function addPurchase(params: {
  itemId: string;
  cantidad: number;
  unidad: string;
  fechaCompra: string;
  notas?: string;
  userId: string;
}) {
  const { error } = await supabase.from('inventory_purchases').insert({
    item_id: params.itemId,
    cantidad: params.cantidad,
    unidad: params.unidad,
    fecha_compra: params.fechaCompra,
    notas: params.notas?.trim() || null,
    registrado_por: params.userId,
  });
  if (error) throw error;
  // El trigger apply_inventory_purchase actualiza cantidad_actual.
}

export async function createInventoryItem(params: {
  patientId: string;
  nombre: string;
  categoria?: string;
  cantidad: number;
  minima: number;
  unidad: string;
  prescriptionId?: string;
}) {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      patient_id: params.patientId,
      nombre: params.nombre.trim(),
      categoria: params.categoria?.trim() || (params.prescriptionId ? 'medicacion' : null),
      cantidad_actual: params.cantidad,
      cantidad_minima: params.minima,
      unidad: params.unidad.trim(),
      prescription_id: params.prescriptionId ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getInventoryItem(itemId: string) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, nombre, cantidad_actual, cantidad_minima, unidad')
    .eq('id', itemId)
    .single();
  if (error) throw error;
  return data;
}
