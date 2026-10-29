-- Eventos con consumo de stock editable + reversión al borrar

ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'limpieza_boton';
ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'cambio_panal';
ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'gotitas_ojos';

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS consumo_limpieza_boton NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (consumo_limpieza_boton >= 0),
  ADD COLUMN IF NOT EXISTS consumo_cambio_panal NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (consumo_cambio_panal >= 0),
  ADD COLUMN IF NOT EXISTS consumo_gotitas_ojos NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (consumo_gotitas_ojos >= 0);

CREATE TABLE IF NOT EXISTS care_log_inventory_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_log_id UUID NOT NULL REFERENCES care_logs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  cantidad NUMERIC(12,4) NOT NULL CHECK (cantidad >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (care_log_id, item_id)
);

CREATE INDEX IF NOT EXISTS care_log_inventory_consumptions_log_idx ON care_log_inventory_consumptions (care_log_id);

ALTER TABLE care_log_inventory_consumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS care_log_inventory_consumptions_select ON care_log_inventory_consumptions;
CREATE POLICY care_log_inventory_consumptions_select ON care_log_inventory_consumptions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS care_log_inventory_consumptions_insert ON care_log_inventory_consumptions;
CREATE POLICY care_log_inventory_consumptions_insert ON care_log_inventory_consumptions FOR INSERT TO authenticated
  WITH CHECK (is_organizador() OR is_enfermera());

DROP TRIGGER IF EXISTS trg_consume_inventory_on_proteina ON care_logs;
DROP FUNCTION IF EXISTS consume_inventory_on_proteina_log();

CREATE OR REPLACE FUNCTION apply_care_log_inventory_consumption()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET cantidad_actual = GREATEST(0, cantidad_actual - NEW.cantidad)
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION restore_care_log_inventory_consumption()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET cantidad_actual = cantidad_actual + OLD.cantidad
  WHERE id = OLD.item_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_apply_care_log_inventory_consumption ON care_log_inventory_consumptions;
CREATE TRIGGER trg_apply_care_log_inventory_consumption
  AFTER INSERT ON care_log_inventory_consumptions
  FOR EACH ROW EXECUTE FUNCTION apply_care_log_inventory_consumption();

DROP TRIGGER IF EXISTS trg_restore_care_log_inventory_consumption ON care_log_inventory_consumptions;
CREATE TRIGGER trg_restore_care_log_inventory_consumption
  AFTER DELETE ON care_log_inventory_consumptions
  FOR EACH ROW EXECUTE FUNCTION restore_care_log_inventory_consumption();

CREATE OR REPLACE FUNCTION set_insumo_consumos_evento(
  p_nombre TEXT,
  p_proteina NUMERIC,
  p_limpieza NUMERIC,
  p_panal NUMERIC,
  p_gotitas NUMERIC
) RETURNS VOID AS $$
DECLARE pid UUID;
BEGIN
  SELECT id INTO pid FROM patient LIMIT 1;
  IF pid IS NULL THEN RETURN; END IF;
  UPDATE inventory_items SET
    consumo_proteina = GREATEST(0, COALESCE(p_proteina, 0)),
    consumo_limpieza_boton = GREATEST(0, COALESCE(p_limpieza, 0)),
    consumo_cambio_panal = GREATEST(0, COALESCE(p_panal, 0)),
    consumo_gotitas_ojos = GREATEST(0, COALESCE(p_gotitas, 0))
  WHERE patient_id = pid AND lower(trim(nombre)) = lower(trim(p_nombre));
END;
$$ LANGUAGE plpgsql;

SELECT set_insumo_consumos_evento('Agujas uber marrones', 1.032, 0, 0, 0);
SELECT set_insumo_consumos_evento('Jeringas 10cm 3', 1.366, 0, 0, 0);
SELECT set_insumo_consumos_evento('Jeringas 5 ml', 1.366, 0, 0, 0);
SELECT set_insumo_consumos_evento('Jeringas 1 ml', 0.344, 0, 0, 0);
SELECT set_insumo_consumos_evento('Jeringas 3 ml', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Jeringas tomey 60', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Agujas ev', 1.366, 0, 0, 0);
SELECT set_insumo_consumos_evento('Agujas 15/5', 0.344, 0, 0, 0);
SELECT set_insumo_consumos_evento('Prolongador', 1.032, 0, 0, 0);
SELECT set_insumo_consumos_evento('Guantes estériles', 1.032, 0, 0, 0);
SELECT set_insumo_consumos_evento('Agua 10ml', 0.344, 0, 0, 0);
SELECT set_insumo_consumos_evento('Fisio 5 ml', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Fisio 10ml', 1.366, 0, 0, 0);
SELECT set_insumo_consumos_evento('Alcohol 90%', 0.097, 0, 0, 0);
SELECT set_insumo_consumos_evento('Clorexidina', 0.048, 0, 0, 0);
SELECT set_insumo_consumos_evento('Campo estéril', 0.581, 0, 0, 0);
SELECT set_insumo_consumos_evento('Gasas estériles 10x10', 3.097, 0, 0, 0);
SELECT set_insumo_consumos_evento('Gorro', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Barbijo', 0.097, 0, 0, 0);
SELECT set_insumo_consumos_evento('Gasas pantalón p botón (trae 70/caja)', 0, 1, 0, 0);
SELECT set_insumo_consumos_evento('Heparina sodica', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('emla', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Depakene jarabe', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Topamac (mg)', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Eucozol protector gastrico (20mg)', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Kepra (ml)', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('rivaroxaban', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Melatol cápsulas', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('paracetamol (200mg)', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('antibiotico', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('floratil/enterogermina', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('sensor de oxigeno', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('botón gástrico', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('conectores de alimentación fino', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('guias de alimentacion', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('conectores de alimentación grueso', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('filtro respirador', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('pañales', 0, 0, 1, 0);
SELECT set_insumo_consumos_evento('hisopos', 0, 1, 0, 0);
SELECT set_insumo_consumos_evento('tubos de oxigeno', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('toallitas', 0, 0, 1.5, 0);
SELECT set_insumo_consumos_evento('Systane  (ul)', 0, 0, 0, 220);
SELECT set_insumo_consumos_evento('Barex', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Acrylarm mg', 0, 0, 0, 15);
SELECT set_insumo_consumos_evento('Seretide (#puff)', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Salbutamol (puff)', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('Corteroid (ul)', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('supositorio', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('amoxidal duo', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('enemol', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('mupax', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('macril', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('dr. selvi', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('pasta dental', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('cepillo de dientes', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('agua esteril para respirador (400ml)', 0, 0, 0, 0);
SELECT set_insumo_consumos_evento('jeringa 20ml', 0, 0, 0, 0);

DROP FUNCTION set_insumo_consumos_evento(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
