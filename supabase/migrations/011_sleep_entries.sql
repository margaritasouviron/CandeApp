-- Registro de sueño (hora inicio / fin)

ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'sueno';

CREATE TABLE IF NOT EXISTS sleep_entries (
  care_log_id UUID PRIMARY KEY REFERENCES care_logs(id) ON DELETE CASCADE,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  CONSTRAINT sleep_fin_after_inicio CHECK (fin > inicio)
);

ALTER TABLE sleep_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY sleep_entries_select ON sleep_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY sleep_entries_insert ON sleep_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM care_logs cl
      WHERE cl.id = care_log_id
        AND (
          is_organizador()
          OR (is_enfermera() AND cl.registrado_por = auth.uid())
        )
    )
  );
