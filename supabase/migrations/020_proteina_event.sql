-- Evento Proteína + consumo de insumos (columna proteina del spreadsheet)

ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'proteina';

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS consumo_proteina NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (consumo_proteina >= 0);

CREATE OR REPLACE FUNCTION consume_inventory_on_proteina_log()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo IS DISTINCT FROM 'proteina' THEN
    RETURN NEW;
  END IF;

  UPDATE inventory_items
  SET cantidad_actual = GREATEST(0, cantidad_actual - consumo_proteina)
  WHERE patient_id = NEW.patient_id
    AND consumo_proteina > 0;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_consume_inventory_on_proteina ON care_logs;
CREATE TRIGGER trg_consume_inventory_on_proteina
  AFTER INSERT ON care_logs
  FOR EACH ROW EXECUTE FUNCTION consume_inventory_on_proteina_log();

CREATE OR REPLACE FUNCTION set_insumo_consumo_proteina(p_nombre TEXT, p_qty NUMERIC)
RETURNS VOID AS $$
DECLARE pid UUID;
BEGIN
  SELECT id INTO pid FROM patient LIMIT 1;
  IF pid IS NULL THEN RETURN; END IF;
  UPDATE inventory_items
  SET consumo_proteina = GREATEST(0, COALESCE(p_qty, 0))
  WHERE patient_id = pid AND lower(trim(nombre)) = lower(trim(p_nombre));
END;
$$ LANGUAGE plpgsql;

SELECT set_insumo_consumo_proteina('Agujas uber marrones', 1.032);
SELECT set_insumo_consumo_proteina('Jeringas 10cm 3', 1.366);
SELECT set_insumo_consumo_proteina('Jeringas 5 ml', 1.366);
SELECT set_insumo_consumo_proteina('Jeringas 1 ml', 0.344);
SELECT set_insumo_consumo_proteina('Jeringas 3 ml', 0);
SELECT set_insumo_consumo_proteina('Jeringas tomey 60', 0);
SELECT set_insumo_consumo_proteina('Agujas ev', 1.366);
SELECT set_insumo_consumo_proteina('Agujas 15/5', 0.344);
SELECT set_insumo_consumo_proteina('Prolongador', 1.032);
SELECT set_insumo_consumo_proteina('Guantes estériles', 1.032);
SELECT set_insumo_consumo_proteina('Agua 10ml', 0.344);
SELECT set_insumo_consumo_proteina('Fisio 5 ml', 0);
SELECT set_insumo_consumo_proteina('Fisio 10ml', 1.366);
SELECT set_insumo_consumo_proteina('Alcohol 90%', 0.097);
SELECT set_insumo_consumo_proteina('Clorexidina', 0.048);
SELECT set_insumo_consumo_proteina('Campo estéril', 0.581);
SELECT set_insumo_consumo_proteina('Gasas estériles 10x10', 3.097);
SELECT set_insumo_consumo_proteina('Gorro', 0);
SELECT set_insumo_consumo_proteina('Barbijo', 0.097);
SELECT set_insumo_consumo_proteina('Gasas pantalón p botón (trae 70/caja)', 0);
SELECT set_insumo_consumo_proteina('Heparina sodica', 0);
SELECT set_insumo_consumo_proteina('emla', 0);
SELECT set_insumo_consumo_proteina('Depakene jarabe', 0);
SELECT set_insumo_consumo_proteina('Topamac (mg)', 0);
SELECT set_insumo_consumo_proteina('Eucozol protector gastrico (20mg)', 0);
SELECT set_insumo_consumo_proteina('Kepra (ml)', 0);
SELECT set_insumo_consumo_proteina('rivaroxaban', 0);
SELECT set_insumo_consumo_proteina('Melatol cápsulas', 0);
SELECT set_insumo_consumo_proteina('paracetamol (200mg)', 0);
SELECT set_insumo_consumo_proteina('antibiotico', 0);
SELECT set_insumo_consumo_proteina('floratil/enterogermina', 0);
SELECT set_insumo_consumo_proteina('sensor de oxigeno', 0);
SELECT set_insumo_consumo_proteina('botón gástrico', 0);
SELECT set_insumo_consumo_proteina('conectores de alimentación fino', 0);
SELECT set_insumo_consumo_proteina('guias de alimentacion', 0);
SELECT set_insumo_consumo_proteina('conectores de alimentación grueso', 0);
SELECT set_insumo_consumo_proteina('filtro respirador', 0);
SELECT set_insumo_consumo_proteina('pañales', 0);
SELECT set_insumo_consumo_proteina('hisopos', 0);
SELECT set_insumo_consumo_proteina('tubos de oxigeno', 0);
SELECT set_insumo_consumo_proteina('toallitas', 0);
SELECT set_insumo_consumo_proteina('Systane  (ul)', 0);
SELECT set_insumo_consumo_proteina('Barex', 0);
SELECT set_insumo_consumo_proteina('Acrylarm mg', 0);
SELECT set_insumo_consumo_proteina('Seretide (#puff)', 0);
SELECT set_insumo_consumo_proteina('Salbutamol (puff)', 0);
SELECT set_insumo_consumo_proteina('Corteroid (ul)', 0);
SELECT set_insumo_consumo_proteina('supositorio', 0);
SELECT set_insumo_consumo_proteina('amoxidal duo', 0);
SELECT set_insumo_consumo_proteina('enemol', 0);
SELECT set_insumo_consumo_proteina('mupax', 0);
SELECT set_insumo_consumo_proteina('macril', 0);
SELECT set_insumo_consumo_proteina('dr. selvi', 0);
SELECT set_insumo_consumo_proteina('pasta dental', 0);
SELECT set_insumo_consumo_proteina('cepillo de dientes', 0);
SELECT set_insumo_consumo_proteina('agua esteril para respirador (400ml)', 0);
SELECT set_insumo_consumo_proteina('jeringa 20ml', 0);

DROP FUNCTION set_insumo_consumo_proteina(TEXT, NUMERIC);
