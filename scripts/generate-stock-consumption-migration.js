#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

const SHEET =
  'https://docs.google.com/spreadsheets/d/1PWyPpJElK5d3ZQMDe41ocqfuHZtkgsDIXs8SgQvNNn0/export?format=csv&gid=835231896';
const OUT = `${__dirname}/../supabase/migrations/021_stock_consumption_events.sql`;

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function sqlStr(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

function parseNum(raw) {
  const t = (raw || '').trim().replace(',', '.');
  if (!t || t === ' ') return 0;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

const csv = process.argv[2]
  ? fs.readFileSync(process.argv[2], 'utf8')
  : execSync(`curl -sL "${SHEET}"`, { encoding: 'utf8' });

const lines = csv.split(/\r?\n/).filter(Boolean);
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const c = parseCsvLine(lines[i]);
  const nombre = (c[0] || '').trim().replace(/^\*+/, '').trim();
  if (!nombre) continue;
  rows.push({
    nombre,
    proteina: parseNum(c[6]),
    limpieza: parseNum(c[7]),
    panal: parseNum(c[8]),
    gotitas: parseNum(c[9]),
  });
}

const parts = [
  `-- Eventos con consumo de stock editable + reversión al borrar\n\n`,
  `ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'limpieza_boton';\n`,
  `ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'cambio_panal';\n`,
  `ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'gotitas_ojos';\n\n`,
  `ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS consumo_limpieza_boton NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (consumo_limpieza_boton >= 0),
  ADD COLUMN IF NOT EXISTS consumo_cambio_panal NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (consumo_cambio_panal >= 0),
  ADD COLUMN IF NOT EXISTS consumo_gotitas_ojos NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (consumo_gotitas_ojos >= 0);

`,
  `CREATE TABLE IF NOT EXISTS care_log_inventory_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_log_id UUID NOT NULL REFERENCES care_logs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  cantidad NUMERIC(12,4) NOT NULL CHECK (cantidad >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (care_log_id, item_id)
);

`,
  `CREATE INDEX IF NOT EXISTS care_log_inventory_consumptions_log_idx ON care_log_inventory_consumptions (care_log_id);

`,
  `ALTER TABLE care_log_inventory_consumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS care_log_inventory_consumptions_select ON care_log_inventory_consumptions;
CREATE POLICY care_log_inventory_consumptions_select ON care_log_inventory_consumptions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS care_log_inventory_consumptions_insert ON care_log_inventory_consumptions;
CREATE POLICY care_log_inventory_consumptions_insert ON care_log_inventory_consumptions FOR INSERT TO authenticated
  WITH CHECK (is_organizador() OR is_enfermera());

`,
  `DROP TRIGGER IF EXISTS trg_consume_inventory_on_proteina ON care_logs;
DROP FUNCTION IF EXISTS consume_inventory_on_proteina_log();

`,
  `CREATE OR REPLACE FUNCTION apply_care_log_inventory_consumption()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET cantidad_actual = GREATEST(0, cantidad_actual - NEW.cantidad)
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

`,
  `CREATE OR REPLACE FUNCTION restore_care_log_inventory_consumption()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET cantidad_actual = cantidad_actual + OLD.cantidad
  WHERE id = OLD.item_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

`,
  `DROP TRIGGER IF EXISTS trg_apply_care_log_inventory_consumption ON care_log_inventory_consumptions;
CREATE TRIGGER trg_apply_care_log_inventory_consumption
  AFTER INSERT ON care_log_inventory_consumptions
  FOR EACH ROW EXECUTE FUNCTION apply_care_log_inventory_consumption();

`,
  `DROP TRIGGER IF EXISTS trg_restore_care_log_inventory_consumption ON care_log_inventory_consumptions;
CREATE TRIGGER trg_restore_care_log_inventory_consumption
  AFTER DELETE ON care_log_inventory_consumptions
  FOR EACH ROW EXECUTE FUNCTION restore_care_log_inventory_consumption();

`,
  `CREATE OR REPLACE FUNCTION set_insumo_consumos_evento(
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

`,
];

for (const r of rows) {
  parts.push(
    `SELECT set_insumo_consumos_evento(${sqlStr(r.nombre)}, ${r.proteina}, ${r.limpieza}, ${r.panal}, ${r.gotitas});\n`
  );
}
parts.push('\nDROP FUNCTION set_insumo_consumos_evento(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);\n');

fs.writeFileSync(OUT, parts.join(''));
console.log(`Wrote ${OUT} (${rows.length} insumos)`);
