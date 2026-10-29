-- Comida con botón: intervalo inicio/fin (como sueño)

ALTER TABLE meal_entries
  ADD COLUMN IF NOT EXISTS inicio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fin TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS velocidad_ml_h NUMERIC(10, 2) CHECK (velocidad_ml_h IS NULL OR velocidad_ml_h > 0);

ALTER TABLE meal_entries DROP CONSTRAINT IF EXISTS meal_fin_after_inicio;
ALTER TABLE meal_entries ADD CONSTRAINT meal_fin_after_inicio CHECK (
  fin IS NULL OR inicio IS NULL OR fin > inicio
);

DROP POLICY IF EXISTS meal_entries_update ON meal_entries;
CREATE POLICY meal_entries_update ON meal_entries FOR UPDATE TO authenticated
  USING (is_organizador() OR is_enfermera())
  WITH CHECK (is_organizador() OR is_enfermera());
