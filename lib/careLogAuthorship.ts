import type { AppRole } from './auth';

export type CareLogAuthorship = {
  registrado_por: string;
  realizado_por: string | null;
};

export function resolveCareLogAuthorship(
  sessionUserId: string,
  role: AppRole | null,
  selectedCaregiverId: string | null
): CareLogAuthorship {
  if (role === 'standby') {
    if (!selectedCaregiverId) {
      throw new Error('Elegí quién está completando este registro');
    }
    return { registrado_por: sessionUserId, realizado_por: selectedCaregiverId };
  }
  return { registrado_por: sessionUserId, realizado_por: null };
}
