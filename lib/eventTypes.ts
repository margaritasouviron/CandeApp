export const EVENT_TYPES = [
  'comida',
  'medicacion',
  'signos_vitales',
  'higiene',
  'observacion',
  'nota',
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
  otro: 'Otro',
};

export const EVENT_COLORS: Record<EventType, string> = {
  comida: '#8f6844',
  medicacion: '#2d5280',
  signos_vitales: '#dc2626',
  higiene: '#0d9488',
  observacion: '#735339',
  nota: '#a16207',
  otro: '#64748b',
};
