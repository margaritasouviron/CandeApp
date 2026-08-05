import type { UpcomingDose } from './medicationSchedules';

/** Quita de la lista local todas las dosis eliminadas (misma receta, misma hora o después). */
export function removeDoseAndFollowingFromList(list: UpcomingDose[], dose: UpcomingDose) {
  const cutoff = new Date(dose.programadoPara).getTime();
  return list.filter(
    (d) => d.prescriptionId !== dose.prescriptionId || new Date(d.programadoPara).getTime() < cutoff
  );
}
