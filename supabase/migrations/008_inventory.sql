-- Inventario / stock (wireframe)

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  categoria TEXT,
  cantidad_actual NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_actual >= 0),
  cantidad_minima NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_minima >= 0),
  unidad TEXT NOT NULL DEFAULT 'unidad',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
  unidad TEXT NOT NULL,
  fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  registrado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX inventory_items_patient_idx ON inventory_items (patient_id);
CREATE INDEX inventory_purchases_item_idx ON inventory_purchases (item_id, fecha_compra DESC);

CREATE TRIGGER inventory_items_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_items_select ON inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_items_insert ON inventory_items FOR INSERT TO authenticated
  WITH CHECK (is_organizador());
CREATE POLICY inventory_items_update ON inventory_items FOR UPDATE TO authenticated
  USING (is_organizador() OR is_enfermera())
  WITH CHECK (is_organizador() OR is_enfermera());
CREATE POLICY inventory_items_delete ON inventory_items FOR DELETE TO authenticated
  USING (is_organizador());

CREATE POLICY inventory_purchases_select ON inventory_purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_purchases_insert ON inventory_purchases FOR INSERT TO authenticated
  WITH CHECK (is_organizador() OR (is_enfermera() AND has_active_shift()));
