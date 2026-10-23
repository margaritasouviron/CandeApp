import { supabase } from './supabase';

export type SleepDayHours = {
  date: string;
  hours: number;
};

export type WeeklySleepStats = {
  days: SleepDayHours[];
  averageHours: number;
};

function hoursBetween(a: string, b: string) {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60));
}

export async function fetchWeeklySleepStats(patientId: string): Promise<WeeklySleepStats> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('sleep_entries')
    .select('inicio, fin, care_logs!inner(patient_id)')
    .eq('care_logs.patient_id', patientId)
    .gte('inicio', weekStart.toISOString());

  if (error) {
    if (error.message.includes('sleep_entries')) {
      return { days: [], averageHours: 0 };
    }
    throw error;
  }

  const map = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, 0);
  }

  (data ?? []).forEach((row) => {
    const key = row.inicio.slice(0, 10);
    const h = hoursBetween(row.inicio, row.fin);
    map.set(key, (map.get(key) ?? 0) + h);
  });

  const days = [...map.entries()].map(([date, hours]) => ({
    date,
    hours: Math.round(hours * 10) / 10,
  }));

  const total = days.reduce((s, d) => s + d.hours, 0);
  const averageHours = days.length ? Math.round((total / days.length) * 10) / 10 : 0;

  return { days, averageHours };
}
