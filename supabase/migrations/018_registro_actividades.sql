-- Nuevos tipos de registro y bloques de actividad (duración en calendario)

ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'bailar';
ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'silla';
ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'paseo';
ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'terapia';
ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'cole';

ALTER TYPE meal_type ADD VALUE IF NOT EXISTS 'sopa';
ALTER TYPE meal_type ADD VALUE IF NOT EXISTS 'jugo';

ALTER TABLE meal_entries
  ADD COLUMN IF NOT EXISTS mililitros NUMERIC(10, 1) CHECK (mililitros IS NULL OR mililitros >= 0);

CREATE TABLE IF NOT EXISTS activity_blocks (
  care_log_id UUID PRIMARY KEY REFERENCES care_logs(id) ON DELETE CASCADE,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  subtipo TEXT,
  CONSTRAINT activity_fin_after_inicio CHECK (fin > inicio)
);

ALTER TABLE activity_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_blocks_select ON activity_blocks FOR SELECT TO authenticated USING (true);

CREATE POLICY activity_blocks_insert ON activity_blocks FOR INSERT TO authenticated
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

CREATE POLICY activity_blocks_update ON activity_blocks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM care_logs cl
      WHERE cl.id = care_log_id
        AND (is_organizador() OR cl.registrado_por = auth.uid())
    )
  );
