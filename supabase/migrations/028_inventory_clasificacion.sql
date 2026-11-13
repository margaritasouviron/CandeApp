-- Clasificación (P/M/I/C del sheet) y adquisición compra propia / OSDE

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS clasificacion TEXT NOT NULL DEFAULT 'insumo'
    CHECK (clasificacion IN ('proteina', 'medicacion', 'insumo', 'crema')),
  ADD COLUMN IF NOT EXISTS adquisicion TEXT
    CHECK (adquisicion IS NULL OR adquisicion IN ('compra_propia', 'osde'));

CREATE INDEX IF NOT EXISTS inventory_items_clasificacion_idx ON inventory_items (patient_id, clasificacion);
