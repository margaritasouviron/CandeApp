import { supabase } from './supabase';

export const INVENTORY_MED_PREFIX = 'inv:';

export type InventoryClasificacion = 'proteina' | 'medicacion' | 'insumo' | 'crema';
export type InventoryAdquisicion = 'compra_propia' | 'osde';
export type InventoryStockStatus = 'ok' | 'near' | 'low';

export const CLASIFICACION_LABELS: Record<InventoryClasificacion, string> = {
  proteina: 'Proteína',
  medicacion: 'Medicación',
  insumo: 'Insumo',
  crema: 'Cremas',
};

export const ADQUISICION_LABELS: Record<InventoryAdquisicion, string> = {
  compra_propia: 'Compra propia',
  osde: 'OSDE',
};

export function clasificacionFromSheetLetter(letter: string): InventoryClasificacion {
  const c = letter.trim().toUpperCase().charAt(0);
  if (c === 'P') return 'proteina';
  if (c === 'M') return 'medicacion';
  if (c === 'C') return 'crema';
  return 'insumo';
}

export function inventoryStockStatus(item: Pick<InventoryItem, 'cantidad_actual' | 'cantidad_minima'>): InventoryStockStatus {
  const min = Number(item.cantidad_minima);
  const actual = Number(item.cantidad_actual);
  if (min <= 0) return actual <= 0 ? 'low' : 'ok';
  if (actual < min) return 'low';
  if (actual <= min * 1.25) return 'near';
  return 'ok';
}

export function isInventoryAlertStatus(status: InventoryStockStatus) {
  return status === 'low' || status === 'near';
}

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
  clasificacion: InventoryClasificacion;
  adquisicion: InventoryAdquisicion | null;
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

export type InventoryPurchaseRow = {
  id: string;
  cantidad: number;
  unidad: string;
  fecha_compra: string;
  notas: string | null;
  created_at: string;
  registrado_por_nombre: string | null;
};

const inventorySelect =
  'id, nombre, categoria, clasificacion, adquisicion, cantidad_actual, cantidad_minima, consumo_mensual, presentacion, consumo_proteina, consumo_limpieza_boton, consumo_cambio_panal, consumo_gotitas_ojos, unidad, prescription_id';

function mapInventoryRow(row: Record<string, unknown>): InventoryItem {
  const clas = (row.clasificacion as InventoryClasificacion | undefined) ?? 'insumo';
  return {
    ...(row as InventoryItem),
    clasificacion: clas,
    adquisicion: (row.adquisicion as InventoryAdquisicion | null) ?? null,
  };
}

/** Clave de comparación: ignora mayúsculas y espacios extra. */
export function normalizeInventoryName(nombre: string) {
  return nombre.trim().toLowerCase();
}

export async function fetchInventory(patientId: string) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(inventorySelect)
    .eq('patient_id', patientId)
    .order('nombre');
  if (error) {
    if (/clasificacion|adquisicion|42703/i.test(error.message)) {
      const { data: fallback, error: err2 } = await supabase
        .from('inventory_items')
        .select(
          'id, nombre, categoria, cantidad_actual, cantidad_minima, consumo_mensual, presentacion, consumo_proteina, consumo_limpieza_boton, consumo_cambio_panal, consumo_gotitas_ojos, unidad, prescription_id'
        )
        .eq('patient_id', patientId)
        .order('nombre');
      if (err2) throw err2;
      return (fallback ?? []).map((r) =>
        mapInventoryRow({ ...r, clasificacion: 'insumo', adquisicion: null })
      );
    }
    throw error;
  }
  return (data ?? []).map((r) => mapInventoryRow(r as Record<string, unknown>));
}

export async function fetchInventoryItemDetail(itemId: string): Promise<InventoryItem | null> {
  const { data, error } = await supabase.from('inventory_items').select(inventorySelect).eq('id', itemId).maybeSingle();
  if (error) {
    if (/clasificacion|adquisicion|42703/i.test(error.message)) return getInventoryItem(itemId) as Promise<InventoryItem | null>;
    throw error;
  }
  if (!data) return null;
  return mapInventoryRow(data as Record<string, unknown>);
}

export async function fetchInventoryAlerts(patientId: string) {
  const items = await fetchInventory(patientId);
  return items
    .map((item) => ({ item, status: inventoryStockStatus(item) }))
    .filter(({ status }) => isInventoryAlertStatus(status))
    .sort((a, b) => {
      const order = { low: 0, near: 1, ok: 2 };
      return order[a.status] - order[b.status] || a.item.nombre.localeCompare(b.item.nombre, 'es');
    });
}

export async function fetchInventoryPurchases(itemId: string, limit = 15): Promise<InventoryPurchaseRow[]> {
  const { data, error } = await supabase
    .from('inventory_purchases')
    .select(
      `
      id, cantidad, unidad, fecha_compra, notas, created_at,
      profiles:registrado_por ( nombre_completo )
    `
    )
    .eq('item_id', itemId)
    .order('fecha_compra', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id as string,
      cantidad: Number(row.cantidad),
      unidad: row.unidad as string,
      fecha_compra: row.fecha_compra as string,
      notas: row.notas as string | null,
      created_at: row.created_at as string,
      registrado_por_nombre: (prof as { nombre_completo?: string } | null)?.nombre_completo ?? null,
    };
  });
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
}

export async function createInventoryItem(params: {
  patientId: string;
  nombre: string;
  categoria?: string;
  clasificacion?: InventoryClasificacion;
  adquisicion?: InventoryAdquisicion | null;
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
      clasificacion: params.clasificacion ?? 'insumo',
      adquisicion: params.adquisicion ?? null,
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

export async function updateInventoryItem(
  itemId: string,
  patch: {
    cantidad_minima?: number;
    unidad?: string;
    clasificacion?: InventoryClasificacion;
    adquisicion?: InventoryAdquisicion | null;
  }
) {
  const { error } = await supabase.from('inventory_items').update(patch).eq('id', itemId);
  if (error) throw error;
}

export async function deleteInventoryItem(itemId: string) {
  const { error } = await supabase.from('inventory_items').delete().eq('id', itemId);
  if (error) throw error;
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

export function filterInventoryItems(
  items: InventoryItem[],
  opts: { query: string; clasificacion: InventoryClasificacion | 'all' }
) {
  const q = opts.query.trim().toLowerCase();
  return items.filter((item) => {
    if (opts.clasificacion !== 'all' && item.clasificacion !== opts.clasificacion) return false;
    if (!q) return true;
    const hay = `${item.nombre} ${item.presentacion ?? ''}`.toLowerCase();
    return hay.includes(q);
  });
}
