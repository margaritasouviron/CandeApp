import { supabase } from './supabase';

export type InventoryItem = {
  id: string;
  nombre: string;
  categoria: string | null;
  cantidad_actual: number;
  cantidad_minima: number;
  unidad: string;
};

export async function fetchInventory(patientId: string) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, nombre, categoria, cantidad_actual, cantidad_minima, unidad')
    .eq('patient_id', patientId)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as InventoryItem[];
}

export async function addPurchase(params: {
  itemId: string;
  cantidad: number;
  unidad: string;
  fechaCompra: string;
  notas?: string;
  userId: string;
}) {
  const { error: pErr } = await supabase.from('inventory_purchases').insert({
    item_id: params.itemId,
    cantidad: params.cantidad,
    unidad: params.unidad,
    fecha_compra: params.fechaCompra,
    notas: params.notas?.trim() || null,
    registrado_por: params.userId,
  });
  if (pErr) throw pErr;

  const { data: item } = await supabase
    .from('inventory_items')
    .select('cantidad_actual')
    .eq('id', params.itemId)
    .single();

  const nueva = Number(item?.cantidad_actual ?? 0) + params.cantidad;
  const { error: uErr } = await supabase
    .from('inventory_items')
    .update({ cantidad_actual: nueva })
    .eq('id', params.itemId);
  if (uErr) throw uErr;
}

export async function createInventoryItem(params: {
  patientId: string;
  nombre: string;
  categoria?: string;
  cantidad: number;
  minima: number;
  unidad: string;
}) {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      patient_id: params.patientId,
      nombre: params.nombre.trim(),
      categoria: params.categoria?.trim() || null,
      cantidad_actual: params.cantidad,
      cantidad_minima: params.minima,
      unidad: params.unidad.trim(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function consumeStock(itemId: string, amount: number) {
  const { data: item } = await supabase.from('inventory_items').select('cantidad_actual').eq('id', itemId).single();
  const nueva = Math.max(0, Number(item?.cantidad_actual ?? 0) - amount);
  const { error } = await supabase.from('inventory_items').update({ cantidad_actual: nueva }).eq('id', itemId);
  if (error) throw error;
}
