-- Medicación desde ítems de stock: descuento explícito por ítem y cantidad

ALTER TABLE medication_administrations
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cantidad_inventario NUMERIC(12,4) CHECK (cantidad_inventario IS NULL OR cantidad_inventario >= 0);

CREATE INDEX IF NOT EXISTS medication_administrations_inventory_item_idx
  ON medication_administrations (inventory_item_id);

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

  IF NEW.inventory_item_id IS NOT NULL THEN
    v_item_id := NEW.inventory_item_id;
    v_amount := COALESCE(NULLIF(NEW.cantidad_inventario, 0), 1);
  ELSE
    SELECT ii.id INTO v_item_id
    FROM inventory_items ii
    WHERE ii.patient_id = v_patient_id
      AND (
        (NEW.prescription_id IS NOT NULL AND ii.prescription_id = NEW.prescription_id)
        OR lower(trim(ii.nombre)) = lower(trim(NEW.nombre_medicamento))
      )
    ORDER BY CASE WHEN ii.prescription_id IS NOT NULL AND ii.prescription_id = NEW.prescription_id THEN 0 ELSE 1 END
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
  END IF;

  UPDATE inventory_items
  SET cantidad_actual = GREATEST(0, cantidad_actual - v_amount)
  WHERE id = v_item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
