import { supabase } from './supabase';
import { EVENT_LABELS, type EventType } from './eventTypes';

export type StatsSummary = {
  totalEvents: number;
  weekEvents: number;
  monthEvents: number;
  byCategory: Record<string, number>;
  medsPerDay: { date: string; count: number }[];
  foodTypes: Record<string, number>;
};

export async function fetchStats(patientId: string): Promise<StatsSummary> {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: logs } = await supabase
    .from('care_logs')
    .select('id, tipo, registrado_en')
    .eq('patient_id', patientId)
    .gte('registrado_en', monthStart.toISOString());

  const all = logs ?? [];
  const byCategory: Record<string, number> = {};
  const medsPerDayMap = new Map<string, number>();
  const foodTypes: Record<string, number> = {};

  all.forEach((l) => {
    byCategory[l.tipo] = (byCategory[l.tipo] ?? 0) + 1;
    if (l.tipo === 'medicacion') {
      const d = l.registrado_en.slice(0, 10);
      medsPerDayMap.set(d, (medsPerDayMap.get(d) ?? 0) + 1);
    }
  });

  const { data: meals } = await supabase
    .from('care_logs')
    .select('meal_entries(tipo_comida)')
    .eq('patient_id', patientId)
    .eq('tipo', 'comida')
    .gte('registrado_en', monthStart.toISOString());

  (meals ?? []).forEach((m) => {
    const entry = Array.isArray(m.meal_entries) ? m.meal_entries[0] : m.meal_entries;
    const t = entry?.tipo_comida ?? 'otro';
    foodTypes[t] = (foodTypes[t] ?? 0) + 1;
  });

  return {
    totalEvents: all.length,
    weekEvents: all.filter((l) => new Date(l.registrado_en) >= weekAgo).length,
    monthEvents: all.length,
    byCategory,
    medsPerDay: [...medsPerDayMap.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    foodTypes,
  };
}

export function buildMedicalReport(patientName: string, stats: StatsSummary): string {
  const lines = [
    `Informe médico — ${patientName}`,
    `Generado: ${new Date().toLocaleString('es-ES')}`,
    '',
    `Eventos este mes: ${stats.monthEvents}`,
    `Eventos esta semana: ${stats.weekEvents}`,
    '',
    'Por categoría:',
    ...Object.entries(stats.byCategory).map(([k, v]) => `  • ${EVENT_LABELS[k as EventType] ?? k}: ${v}`),
    '',
    'Medicación por día:',
    ...stats.medsPerDay.map((m) => `  • ${m.date}: ${m.count} administraciones`),
  ];
  return lines.join('\n');
}
