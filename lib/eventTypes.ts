export const EVENT_TYPES = [
  'comida',
  'medicacion',
  'sueno',
  'bailar',
  'silla',
  'paseo',
  'terapia',
  'cole',
  'signos_vitales',
  'higiene',
  'observacion',
  'nota',
  'otro',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** Tipos disponibles en la pantalla Registro */
export const REGISTRO_TIPOS = [
  'comida',
  'medicacion',
  'sueno',
  'bailar',
  'silla',
  'paseo',
  'terapia',
  'cole',
] as const;

export type RegistroTipo = (typeof REGISTRO_TIPOS)[number];

export const DURATION_EVENT_TYPES: RegistroTipo[] = [
  'sueno',
  'bailar',
  'silla',
  'paseo',
  'terapia',
  'cole',
];

export function isDurationEventType(tipo: string): boolean {
  return (DURATION_EVENT_TYPES as readonly string[]).includes(tipo);
}

export function isInstantEventType(tipo: string): boolean {
  return tipo === 'comida' || tipo === 'medicacion';
}

export const EVENT_LABELS: Record<EventType, string> = {
  comida: 'Comida',
  medicacion: 'Medicación',
  signos_vitales: 'Signos vitales',
  higiene: 'Higiene',
  observacion: 'Observación',
  nota: 'Nota',
  sueno: 'Sueño',
  bailar: 'Bailar',
  silla: 'Silla',
  paseo: 'Paseo',
  terapia: 'Terapia',
  cole: 'Cole',
  otro: 'Otro',
};

/** Acentos para bloques puntuales y leyenda */
export const EVENT_COLORS: Record<EventType, string> = {
  comida: '#FB923C',
  medicacion: '#38BDF8',
  signos_vitales: '#F472B6',
  higiene: '#2DD4BF',
  observacion: '#A78BFA',
  nota: '#FACC15',
  sueno: '#84CC16',
  bailar: '#EC4899',
  silla: '#14B8A6',
  paseo: '#F97316',
  terapia: '#8B5CF6',
  cole: '#0EA5E9',
  otro: '#94A3B8',
};

/** Fondo sombreado en calendario (eventos por rango horario) */
export const EVENT_SHADE_COLORS: Partial<Record<EventType, string>> = {
  sueno: 'rgba(132, 204, 22, 0.42)',
  bailar: 'rgba(236, 72, 153, 0.38)',
  silla: 'rgba(20, 184, 166, 0.38)',
  paseo: 'rgba(249, 115, 22, 0.38)',
  terapia: 'rgba(139, 92, 246, 0.38)',
  cole: 'rgba(14, 165, 233, 0.38)',
};

export const SCHEDULED_MUTED = 'rgba(56, 189, 248, 0.35)';

export const TERAPIA_PRESETS = ['musicoterapia', 'kinesiologia'] as const;

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Colores de chips en Registro (acento = calendario; fondo inactivo = sombra del calendario). */
export function registroChipColors(tipo: RegistroTipo) {
  const accent = EVENT_COLORS[tipo];
  const inactiveBg = EVENT_SHADE_COLORS[tipo] ?? hexToRgba(accent, 0.28);
  return { accent, inactiveBg };
}

export function formatTerapiaLabel(subtipo: string) {
  if (subtipo === 'musicoterapia') return 'Musicoterapia';
  if (subtipo === 'kinesiologia') return 'Kinesiología';
  return subtipo.charAt(0).toUpperCase() + subtipo.slice(1);
}
