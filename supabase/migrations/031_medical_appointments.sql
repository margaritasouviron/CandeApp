-- Paso 2: turnos médicos (después de 030)
-- Seguro volver a ejecutar si la tabla/policies ya existen.

CREATE TABLE IF NOT EXISTS medical_appointments (
  care_log_id UUID PRIMARY KEY REFERENCES care_logs(id) ON DELETE CASCADE,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  nombre_medico TEXT NOT NULL,
  direccion TEXT NOT NULL,
  CONSTRAINT medical_appt_fin_after_inicio CHECK (fin > inicio)
);

CREATE INDEX IF NOT EXISTS medical_appointments_inicio_idx ON medical_appointments (inicio);

ALTER TABLE medical_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medical_appointments_select ON medical_appointments;
CREATE POLICY medical_appointments_select ON medical_appointments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS medical_appointments_insert ON medical_appointments;
CREATE POLICY medical_appointments_insert ON medical_appointments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM care_logs cl
      WHERE cl.id = care_log_id
        AND (
          is_organizador()
          OR (is_enfermera() AND cl.registrado_por = auth.uid())
          OR (is_standby() AND cl.registrado_por = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS medical_appointments_update ON medical_appointments;
CREATE POLICY medical_appointments_update ON medical_appointments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM care_logs cl
      WHERE cl.id = care_log_id AND (is_organizador() OR cl.registrado_por = auth.uid())
    )
  );
