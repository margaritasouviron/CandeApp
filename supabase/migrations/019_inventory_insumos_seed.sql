-- Insumos desde Google Sheet (pestaña Insumos)

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS consumo_mensual NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (consumo_mensual >= 0),
  ADD COLUMN IF NOT EXISTS presentacion TEXT;

CREATE OR REPLACE FUNCTION seed_inventory_insumo(
  p_nombre TEXT,
  p_consumo NUMERIC,
  p_minima NUMERIC,
  p_unidad TEXT,
  p_presentacion TEXT
) RETURNS VOID AS $$
DECLARE pid UUID;
BEGIN
  SELECT id INTO pid FROM patient LIMIT 1;
  IF pid IS NULL THEN RETURN; END IF;

  UPDATE inventory_items SET consumo_mensual = p_consumo, cantidad_minima = p_minima,
    unidad = COALESCE(NULLIF(trim(p_unidad), ''), unidad),
    presentacion = COALESCE(NULLIF(trim(p_presentacion), ''), presentacion)
  WHERE patient_id = pid AND lower(trim(nombre)) = lower(trim(p_nombre));

  IF NOT FOUND THEN
    INSERT INTO inventory_items (patient_id, nombre, cantidad_actual, cantidad_minima, unidad, consumo_mensual, presentacion)
    VALUES (pid, trim(p_nombre), 0, p_minima, COALESCE(NULLIF(trim(p_unidad), ''), 'unidad'), p_consumo, NULLIF(trim(p_presentacion), ''));
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT seed_inventory_insumo('Agujas uber marrones', 10.67, 10, 'unidad', '');
SELECT seed_inventory_insumo('Jeringas 10cm 3', 14.11, 20, 'unidad', '');
SELECT seed_inventory_insumo('Jeringas 5 ml', 14.11, 14.11, 'unidad', '');
SELECT seed_inventory_insumo('Jeringas 1 ml', 3.56, 3.56, 'unidad', '');
SELECT seed_inventory_insumo('Jeringas 3 ml', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('Jeringas tomey 60', 4, 4, 'unidad', '');
SELECT seed_inventory_insumo('Agujas ev', 14.11, 14.11, 'unidad', '');
SELECT seed_inventory_insumo('Agujas 15/5', 3.56, 3.56, 'unidad', '');
SELECT seed_inventory_insumo('Prolongador', 10.67, 10.67, 'unidad', '');
SELECT seed_inventory_insumo('Guantes estériles', 10.67, 10.67, 'unidad', '');
SELECT seed_inventory_insumo('Agua 10ml', 3.56, 3.56, 'ml', '');
SELECT seed_inventory_insumo('Fisio 5 ml', 0, 0, 'ml', '');
SELECT seed_inventory_insumo('Fisio 10ml', 14.11, 14.11, 'ml', '');
SELECT seed_inventory_insumo('Alcohol 90%', 1, 1, 'unidad', '');
SELECT seed_inventory_insumo('Clorexidina', 0.5, 0.5, 'unidad', '');
SELECT seed_inventory_insumo('Campo estéril', 6, 6, 'unidad', '');
SELECT seed_inventory_insumo('Gasas estériles 10x10', 32, 32, 'unidad', '');
SELECT seed_inventory_insumo('Gorro', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('Barbijo', 1, 1, 'unidad', '');
SELECT seed_inventory_insumo('Gasas pantalón p botón (trae 70/caja)', 155, 155, 'unidad', '');
SELECT seed_inventory_insumo('Heparina sodica', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('emla', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('Depakene jarabe', 0, 0, 'ml', '');
SELECT seed_inventory_insumo('Topamac (mg)', 6200, 4133.333333, 'comprimido', '28 comprimidos de 50mg');
SELECT seed_inventory_insumo('Eucozol protector gastrico (20mg)', 31, 20, 'comprimido', '');
SELECT seed_inventory_insumo('Kepra (ml)', 440.2, 293.4666667, 'ml', '300 ml');
SELECT seed_inventory_insumo('rivaroxaban', 310, 310, 'comprimido', '');
SELECT seed_inventory_insumo('Melatol cápsulas', 62, 62, 'comprimido', '');
SELECT seed_inventory_insumo('paracetamol (200mg)', 0, 5, 'comprimido', '');
SELECT seed_inventory_insumo('antibiotico', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('floratil/enterogermina', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('sensor de oxigeno', 0, 3, 'unidad', '');
SELECT seed_inventory_insumo('botón gástrico', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('conectores de alimentación fino', 5, 4, 'unidad', '');
SELECT seed_inventory_insumo('guias de alimentacion', 5, 4, 'unidad', '');
SELECT seed_inventory_insumo('conectores de alimentación grueso', 5, 5, 'unidad', '');
SELECT seed_inventory_insumo('filtro respirador', 0, 1, 'unidad', '');
SELECT seed_inventory_insumo('pañales', 186, 20, 'unidad', '');
SELECT seed_inventory_insumo('hisopos', 31, 20, 'unidad', '');
SELECT seed_inventory_insumo('tubos de oxigeno', 0, 1, 'unidad', '');
SELECT seed_inventory_insumo('toallitas', 232.5, 0, 'unidad', '');
SELECT seed_inventory_insumo('Systane  (ul)', 46500, 15000, 'ul', '15000');
SELECT seed_inventory_insumo('Barex', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('Acrylarm mg', 465, 100, 'comprimido', '10');
SELECT seed_inventory_insumo('Seretide (#puff)', 62, 100, 'puff', '124');
SELECT seed_inventory_insumo('Salbutamol (puff)', 0, 100, 'puff', '200');
SELECT seed_inventory_insumo('Corteroid (ul)', 0, 30000, 'ul', '');
SELECT seed_inventory_insumo('supositorio', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('amoxidal duo', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('enemol', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('mupax', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('macril', 0, 1, 'unidad', '');
SELECT seed_inventory_insumo('dr. selvi', 0, 1, 'unidad', '');
SELECT seed_inventory_insumo('pasta dental', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('cepillo de dientes', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('agua esteril para respirador (400ml)', 0, 0, 'unidad', '');
SELECT seed_inventory_insumo('jeringa 20ml', 4, 3, 'unidad', '');

DROP FUNCTION seed_inventory_insumo(TEXT, NUMERIC, NUMERIC, TEXT, TEXT);
