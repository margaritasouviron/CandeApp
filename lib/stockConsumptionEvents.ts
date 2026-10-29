import type { EventType } from './eventTypes';
import { fetchInventory, type InventoryItem } from './inventory';
import { supabase } from './supabase';

/** Eventos de registro que descuentan insumos del stock */
export const STOCK_CONSUMPTION_EVENT_TYPES = [
  'proteina',
  'limpieza_boton',
  'cambio_panal',
  'gotitas_ojos',
] as const;

export type StockConsumptionEventType = (typeof STOCK_CONSUMPTION_EVENT_TYPES)[number];

export function isStockConsumptionEventType(tipo: string): tipo is StockConsumptionEventType {
  return (STOCK_CONSUMPTION_EVENT_TYPES as readonly string[]).includes(tipo);
}

const DEFAULT_COLUMN: Record<
  StockConsumptionEventType,
  keyof Pick<
    InventoryItem,
    'consumo_proteina' | 'consumo_limpieza_boton' | 'consumo_cambio_panal' | 'consumo_gotitas_ojos'
  >
> = {
  proteina: 'consumo_proteina',
  limpieza_boton: 'consumo_limpieza_boton',
  cambio_panal: 'consumo_cambio_panal',
  gotitas_ojos: 'consumo_gotitas_ojos',
};

export type StockConsumptionDraftLine = {
  itemId: string;
  nombre: string;
  unidad: string;
  defaultQty: number;
};

export type StockConsumptionLine = {
  itemId: string;
  nombre: string;
  unidad: string;
  cantidad: number;
};

export async function fetchStockConsumptionDefaults(
  patientId: string,
  tipo: StockConsumptionEventType
): Promise<StockConsumptionDraftLine[]> {
  const col = DEFAULT_COLUMN[tipo];
  const items = await fetchInventory(patientId);
  return items
    .map((item) => {
      const defaultQty = Number(item[col] ?? 0);
      return {
        itemId: item.id,
        nombre: item.nombre,
        unidad: item.unidad,
        defaultQty,
      };
    })
    .filter((line) => line.defaultQty > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function saveCareLogWithStockConsumption(params: {
  patientId: string;
  tipo: StockConsumptionEventType;
  registradoPor: string;
  registradoEn: Date;
  lines: StockConsumptionLine[];
}) {
  const activeLines = params.lines.filter((l) => l.cantidad > 0);
  if (activeLines.length === 0) {
    throw new Error('Indica al menos un insumo con cantidad mayor a 0');
  }

  const { data: log, error: logError } = await supabase
    .from('care_logs')
    .insert({
      patient_id: params.patientId,
      tipo: params.tipo,
      registrado_por: params.registradoPor,
      registrado_en: params.registradoEn.toISOString(),
    })
    .select('id')
    .single();
  if (logError) throw logError;

  const { error: linesError } = await supabase.from('care_log_inventory_consumptions').insert(
    activeLines.map((l) => ({
      care_log_id: log.id,
      item_id: l.itemId,
      cantidad: l.cantidad,
    }))
  );
  if (linesError) throw linesError;

  return log.id as string;
}

export type CareLogConsumptionRow = {
  itemId: string;
  nombre: string;
  unidad: string;
  cantidad: number;
};

export async function fetchCareLogConsumptions(careLogId: string): Promise<CareLogConsumptionRow[]> {
  const { data, error } = await supabase
    .from('care_log_inventory_consumptions')
    .select('cantidad, inventory_items ( id, nombre, unidad )')
    .eq('care_log_id', careLogId);
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const item = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
      if (!item) return null;
      return {
        itemId: item.id as string,
        nombre: item.nombre as string,
        unidad: item.unidad as string,
        cantidad: Number(row.cantidad),
      };
    })
    .filter((r): r is CareLogConsumptionRow => r != null);
}

export function formatConsumptionDetail(lines: CareLogConsumptionRow[]) {
  if (lines.length === 0) return '';
  return lines.map((l) => `${l.nombre}: ${l.cantidad} ${l.unidad}`).join(' · ');
}

export function stockConsumptionEventLabel(tipo: EventType) {
  switch (tipo) {
    case 'proteina':
      return 'Proteína';
    case 'limpieza_boton':
      return 'Limpieza botón';
    case 'cambio_panal':
      return 'Cambio pañal';
    case 'gotitas_ojos':
      return 'Gotitas ojos';
    default:
      return tipo;
  }
}
