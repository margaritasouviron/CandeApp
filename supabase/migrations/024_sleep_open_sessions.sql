-- Sueño en curso: fin NULL hasta registrar despertar

ALTER TABLE sleep_entries DROP CONSTRAINT IF EXISTS sleep_fin_after_inicio;
ALTER TABLE sleep_entries ALTER COLUMN fin DROP NOT NULL;
ALTER TABLE sleep_entries ADD CONSTRAINT sleep_fin_after_inicio CHECK (fin IS NULL OR fin > inicio);

DROP POLICY IF EXISTS sleep_entries_update ON sleep_entries;
CREATE POLICY sleep_entries_update ON sleep_entries FOR UPDATE TO authenticated
  USING (is_organizador() OR is_enfermera())
  WITH CHECK (is_organizador() OR is_enfermera());
