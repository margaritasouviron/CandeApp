/** Paleta día (Cande despierta) */
export const lightColors = {
  background: '#FFFBF7',
  backgroundAlt: '#FFF8F2',
  card: '#FFFFFF',
  pink: '#FFBACF',
  pinkStrong: '#FF8FAB',
  pinkDeep: '#F43F8E',
  green: '#EBFFBA',
  greenDark: '#5A8F2E',
  primary: '#EBFFBA',
  primaryDark: '#5A8F2E',
  accent: '#EBFFBA',
  text: '#3D2C32',
  textMuted: '#8B737A',
  border: '#FF8FAB',
  borderSoft: '#EDE8E3',
  error: '#F43F5E',
  white: '#FFFFFF',
  onPrimary: '#FFFFFF',
  onAccent: '#FFFFFF',
  blue: '#EBFFBA',
  blueDark: '#5A8F2E',
  brown: '#8B737A',
  brownLight: '#FFF5EE',
  fab: '#F43F8E',
  fabText: '#FFFFFF',
  sleepShade: 'rgba(235, 255, 186, 0.55)',
  upcomingMuted: 'rgba(255, 186, 207, 0.35)',
  upcomingFill: 'rgba(235, 255, 186, 0.45)',
} as const;

/** Paleta noche (Cande dormida) */
export const nightColors = {
  background: '#0f1219',
  backgroundAlt: '#161b26',
  card: '#1e2433',
  pink: '#b86a86',
  pinkStrong: '#d47898',
  pinkDeep: '#f0a8c0',
  green: '#3d5230',
  greenDark: '#d0ef98',
  primary: '#3d4f2a',
  primaryDark: '#d0ef98',
  accent: '#3d4f2a',
  text: '#f4f6fa',
  textMuted: '#c2cad8',
  border: '#5c677a',
  borderSoft: '#343d4f',
  error: '#f87171',
  white: '#1e2433',
  onPrimary: '#0f1219',
  onAccent: '#eef0f4',
  blue: '#3d4f2a',
  blueDark: '#b8d48a',
  brown: '#9aa3b5',
  brownLight: '#252b3a',
  fab: '#e892ad',
  fabText: '#0f1219',
  sleepShade: 'rgba(132, 204, 22, 0.28)',
  upcomingMuted: 'rgba(143, 74, 98, 0.35)',
  upcomingFill: 'rgba(61, 79, 42, 0.55)',
} as const;

export type AppColors = { [K in keyof typeof lightColors]: string };

/** @deprecated Prefer useAppColors() — valor fijo del tema claro */
export const colors: AppColors = { ...lightColors };

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};
