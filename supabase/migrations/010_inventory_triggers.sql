-- Triggers de stock + vínculo medicación ↔ inventario

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS prescription_id UUID REFERENCES medication_prescriptions(id) ON DELETE SET NULL;

ALTER TABLE medication_prescriptions
  ADD COLUMN IF NOT EXISTS unidades_por_dosis NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (unidades_por_dosis > 0);

CREATE INDEX IF NOT EXISTS inventory_items_prescription_idx ON inventory_items (prescription_id);

-- Al registrar compra, sumar stock automáticamente
CREATE OR REPLACE FUNCTION apply_inventory_purchase()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET cantidad_actual = cantidad_actual + NEW.cantidad
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_apply_inventory_purchase ON inventory_purchases;
CREATE TRIGGER trg_apply_inventory_purchase
  AFTER INSERT ON inventory_purchases
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_purchase();

-- Al administrar medicación, restar del inventario vinculado (por prescription_id o nombre)
CREATE OR REPLACE FUNCTION consume_inventory_on_medication()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_id UUID;
  v_amount NUMERIC;
  v_item_id UUID;
BEGIN
  SELECT cl.patient_id INTO v_patient_id
  FROM care_logs cl
  WHERE cl.id = NEW.care_log_id;

  IF v_patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ii.id INTO v_item_id
  FROM inventory_items ii
  WHERE ii.patient_id = v_patient_id
    AND (
      (NEW.prescription_id IS NOT NULL AND ii.prescription_id = NEW.prescription_id)
      OR lower(trim(ii.nombre)) = lower(trim(NEW.nombre_medicamento))
    )
  ORDER BY CASE WHEN ii.prescription_id = NEW.prescription_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(mp.unidades_por_dosis, 1) INTO v_amount
  FROM medication_prescriptions mp
  WHERE mp.id = NEW.prescription_id;

  IF v_amount IS NULL THEN
    v_amount := 1;
  END IF;

  UPDATE inventory_items
  SET cantidad_actual = GREATEST(0, cantidad_actual - v_amount)
  WHERE id = v_item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_consume_inventory_on_medication ON medication_administrations;
CREATE TRIGGER trg_consume_inventory_on_medication
  AFTER INSERT ON medication_administrations
  FOR EACH ROW EXECUTE FUNCTION consume_inventory_on_medication();

-- Enfermeras pueden registrar compras sin turno activo
DROP POLICY IF EXISTS inventory_purchases_insert ON inventory_purchases;
CREATE POLICY inventory_purchases_insert ON inventory_purchases FOR INSERT TO authenticated
  WITH CHECK (is_organizador() OR is_enfermera());
