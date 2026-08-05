-- Solo la administradora puede eliminar dosis programadas canceladas manualmente
CREATE POLICY schedules_delete ON medication_schedules FOR DELETE TO authenticated
  USING (is_organizador());
