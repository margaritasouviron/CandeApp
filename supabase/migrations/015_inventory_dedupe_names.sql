-- Fusionar ítems duplicados (mismo paciente + mismo nombre) y evitar nuevos duplicados.

DO $$
DECLARE
  r RECORD;
  keeper_id UUID;
  dup_id UUID;
  i INT;
BEGIN
  FOR r IN
    SELECT
      patient_id,
      lower(trim(nombre)) AS name_key,
      array_agg(id ORDER BY created_at) AS ids,
      sum(cantidad_actual) AS total_qty,
      max(cantidad_minima) AS max_min
    FROM inventory_items
    GROUP BY patient_id, lower(trim(nombre))
    HAVING count(*) > 1
  LOOP
    keeper_id := r.ids[1];
    UPDATE inventory_items
    SET cantidad_actual = r.total_qty,
        cantidad_minima = r.max_min
    WHERE id = keeper_id;

    FOR i IN 2..array_length(r.ids, 1) LOOP
      dup_id := r.ids[i];
      UPDATE inventory_purchases SET item_id = keeper_id WHERE item_id = dup_id;
      DELETE FROM inventory_items WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_patient_name_unique
  ON inventory_items (patient_id, lower(trim(nombre)));
