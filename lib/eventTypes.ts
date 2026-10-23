export const EVENT_TYPES = [
  'comida',
  'medicacion',
  'signos_vitales',
  'higiene',
  'observacion',
  'nota',
  'sueno',
  'otro',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_LABELS: Record<EventType, string> = {
  comida: 'Comida',
  medicacion: 'Medicación',
  signos_vitales: 'Signos vitales',
  higiene: 'Higiene',
  observacion: 'Observación',
  nota: 'Nota',
  sueno: 'Sueño',
  otro: 'Otro',
};

/** Acentos alegres y vibrantes */
export const EVENT_COLORS: Record<EventType, string> = {
  comida: '#FB923C',
  medicacion: '#38BDF8',
  signos_vitales: '#F472B6',
  higiene: '#2DD4BF',
  observacion: '#A78BFA',
  nota: '#FACC15',
  sueno: '#A3E635',
  otro: '#94A3B8',
};

export const SCHEDULED_MUTED = 'rgba(56, 189, 248, 0.35)';
