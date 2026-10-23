-- Permitir editar registros (autor o administradora)

CREATE POLICY care_logs_update ON care_logs
  FOR UPDATE TO authenticated
  USING (is_organizador() OR registrado_por = auth.uid())
  WITH CHECK (is_organizador() OR registrado_por = auth.uid());

CREATE POLICY observations_update ON observations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM care_logs cl
      WHERE cl.id = care_log_id
        AND (is_organizador() OR cl.registrado_por = auth.uid())
    )
  );

CREATE POLICY meal_entries_update ON meal_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM care_logs cl
      WHERE cl.id = care_log_id
        AND (is_organizador() OR cl.registrado_por = auth.uid())
    )
  );

CREATE POLICY med_admin_update ON medication_administrations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM care_logs cl
      WHERE cl.id = care_log_id
        AND (is_organizador() OR cl.registrado_por = auth.uid())
    )
  );

CREATE POLICY sleep_entries_update ON sleep_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM care_logs cl
      WHERE cl.id = care_log_id
        AND (is_organizador() OR cl.registrado_por = auth.uid())
    )
  );
