import { supabase } from './supabase';

export const INVENTORY_MED_PREFIX = 'inv:';

export function inventoryMedPickerId(itemId: string) {
  return `${INVENTORY_MED_PREFIX}${itemId}`;
}

export function parseInventoryMedPickerId(pickerId: string | null | undefined) {
  if (!pickerId?.startsWith(INVENTORY_MED_PREFIX)) return null;
  return pickerId.slice(INVENTORY_MED_PREFIX.length);
}

export type InventoryItem = {
  id: string;
  nombre: string;
  categoria: string | null;
  cantidad_actual: number;
  cantidad_minima: number;
  consumo_mensual: number;
  presentacion: string | null;
  consumo_proteina?: number;
  consumo_limpieza_boton?: number;
  consumo_cambio_panal?: number;
  consumo_gotitas_ojos?: number;
  unidad: string;
  prescription_id?: string | null;
};

/** Clave de comparación: ignora mayúsculas y espacios extra. */
export function normalizeInventoryName(nombre: string) {
  return nombre.trim().toLowerCase();
}

export async function fetchInventory(patientId: string) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(
      'id, nombre, categoria, cantidad_actual, cantidad_minima, consumo_mensual, presentacion, consumo_proteina, consumo_limpieza_boton, consumo_cambio_panal, consumo_gotitas_ojos, unidad, prescription_id'
    )
    .eq('patient_id', patientId)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as InventoryItem[];
}

export async function findInventoryItemByName(patientId: string, nombre: string) {
  const key = normalizeInventoryName(nombre);
  if (!key) return undefined;
  const list = await fetchInventory(patientId);
  return list.find((item) => normalizeInventoryName(item.nombre) === key);
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

export function findPrescriptionInList<T extends { nombre: string }>(list: T[], nombre: string) {
  const key = normalizeInventoryName(nombre);
  return list.find((p) => normalizeInventoryName(p.nombre) === key);
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
  consumoMensual?: number;
  presentacion?: string;
  unidad: string;
  prescriptionId?: string;
}) {
  const existing = await findInventoryItemByName(params.patientId, params.nombre);
  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      patient_id: params.patientId,
      nombre: params.nombre.trim(),
      categoria: params.categoria?.trim() || (params.prescriptionId ? 'medicacion' : null),
      cantidad_actual: params.cantidad,
      cantidad_minima: params.minima,
      consumo_mensual: params.consumoMensual ?? 0,
      presentacion: params.presentacion?.trim() || null,
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

/** Ajuste manual del stock (p. ej. consumo no registrado). Solo organizadora en la UI. */
export async function updateInventoryStock(itemId: string, cantidadActual: number) {
  if (!Number.isFinite(cantidadActual) || cantidadActual < 0) {
    throw new Error('Indica una cantidad válida (0 o más)');
  }
  const { error } = await supabase
    .from('inventory_items')
    .update({ cantidad_actual: cantidadActual })
    .eq('id', itemId);
  if (error) throw error;
}
