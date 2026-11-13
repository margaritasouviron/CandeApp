#!/usr/bin/env node
/**
 * Regenera supabase/migrations/019_inventory_insumos_seed.sql desde la pestaña Insumos.
 * Uso: node scripts/generate-insumos-migration.js [ruta.csv]
 * Por defecto descarga el CSV público del spreadsheet de Cande.
 */
const fs = require('fs');
const { execSync } = require('child_process');

const SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/1PWyPpJElK5d3ZQMDe41ocqfuHZtkgsDIXs8SgQvNNn0/export?format=csv&gid=835231896';
const OUT = `${__dirname}/../supabase/migrations/019_inventory_insumos_seed.sql`;
const OUT_CLASIF = `${__dirname}/../supabase/migrations/029_inventory_clasificacion_from_sheet.sql`;

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

function inferUnidad(nombre, presentacion) {
  const n = `${nombre} ${presentacion}`.toLowerCase();
  if (
    /jeringa|agujas|pañal|toallita|gasa|hisopo|guante|prolongador|campo|barbijo|gorro|conector|gu[ií]a|filtro|tubo|sensor|supositorio|enemol|mupax|amoxidal|macril|pasta dental|cepillo|barex|heparina|emla|floratil|enterogermina|antibiotico|botón|boton/.test(
      n
    )
  )
    return 'unidad';
  if (/\bpuff\b|#puff|seretide|salbutamol/.test(n)) return 'puff';
  if (/\bul\b|systane|corticoid/.test(n)) return 'ul';
  if (/\bml\b|jarabe|kepra|fisio|agua 10ml|depakene/.test(n)) return 'ml';
  if (/comprimido|mg\)|cápsula|capsula|topamac|melatol|rivaroxaban|eucozol|acrylarm mg/.test(n)) return 'comprimido';
  return 'unidad';
}

function parseNum(raw) {
  const t = (raw || '').trim().replace(',', '.');
  if (!t || t === ' ') return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function parseUmbral(raw) {
  const t = (raw || '').trim();
  if (!t || t === ' ') return 0;
  const n = parseFloat(t.replace(',', '.'));
  if (Number.isFinite(n)) return n;
  if (/vac[ií]o|cuando/i.test(t)) return 1;
  return 0;
}

const csvPath = process.argv[2];
let csvText;
if (csvPath) {
  csvText = fs.readFileSync(csvPath, 'utf8');
} else {
  csvText = execSync(`curl -sL "${SHEET_CSV}"`, { encoding: 'utf8' });
}

const lines = csvText.split(/\r?\n/).filter(Boolean);
const rows = [];
/** Columna A del sheet: P/M/I/C (B = insumo botón, etc.) */
function mapClasificacion(letter) {
  const c = (letter || '').trim().toUpperCase().charAt(0);
  if (c === 'P') return 'proteina';
  if (c === 'M') return 'medicacion';
  if (c === 'C') return 'crema';
  if (c === 'I') return 'insumo';
  return 'insumo';
}

function normalizeNombreKey(nombre) {
  return nombre
    .trim()
    .replace(/^\*+/, '')
    .trim()
    .toLowerCase();
}

for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  const col0 = (cols[0] || '').trim();
  let clasificacion = 'insumo';
  let nombre;
  let consumoCol;
  let presentacionCol;
  let umbralCol;
  let proteinaCol;

  if (/^[PMICB]$/i.test(col0)) {
    clasificacion = mapClasificacion(col0);
    nombre = (cols[1] || '').trim().replace(/^\*+/, '').trim();
    consumoCol = cols[2];
    presentacionCol = cols[3];
    umbralCol = cols[5];
    proteinaCol = cols[7];
  } else {
    nombre = col0.replace(/^\*+/, '').trim();
    consumoCol = cols[1];
    presentacionCol = cols[2];
    umbralCol = cols[4];
    proteinaCol = cols[6];
  }

  if (!nombre) continue;
  rows.push({
    nombre,
    clasificacion,
    consumo: parseNum(consumoCol) ?? 0,
    presentacion: (presentacionCol || '').trim(),
    umbral: parseUmbral(umbralCol),
    proteina: parseNum(proteinaCol) ?? 0,
    unidad: inferUnidad(nombre, (presentacionCol || '').trim()),
  });
}

const parts = [
  '-- Insumos desde Google Sheet (pestaña Insumos)\n\n',
  `ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS consumo_mensual NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (consumo_mensual >= 0),
  ADD COLUMN IF NOT EXISTS presentacion TEXT,
  ADD COLUMN IF NOT EXISTS consumo_proteina NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (consumo_proteina >= 0),
  ADD COLUMN IF NOT EXISTS clasificacion TEXT NOT NULL DEFAULT 'insumo'
    CHECK (clasificacion IN ('proteina', 'medicacion', 'insumo', 'crema'));

`,
  `CREATE OR REPLACE FUNCTION seed_inventory_insumo(
  p_nombre TEXT,
  p_consumo NUMERIC,
  p_minima NUMERIC,
  p_unidad TEXT,
  p_presentacion TEXT,
  p_proteina NUMERIC,
  p_clasificacion TEXT
) RETURNS VOID AS $$
DECLARE pid UUID;
BEGIN
  SELECT id INTO pid FROM patient LIMIT 1;
  IF pid IS NULL THEN RETURN; END IF;

  UPDATE inventory_items SET consumo_mensual = p_consumo, cantidad_minima = p_minima,
    unidad = COALESCE(NULLIF(trim(p_unidad), ''), unidad),
    presentacion = COALESCE(NULLIF(trim(p_presentacion), ''), presentacion),
    consumo_proteina = GREATEST(0, COALESCE(p_proteina, 0)),
    clasificacion = COALESCE(NULLIF(trim(p_clasificacion), ''), clasificacion, 'insumo')
  WHERE patient_id = pid AND lower(trim(nombre)) = lower(trim(p_nombre));

  IF NOT FOUND THEN
    INSERT INTO inventory_items (patient_id, nombre, cantidad_actual, cantidad_minima, unidad, consumo_mensual, presentacion, consumo_proteina, clasificacion)
    VALUES (pid, trim(p_nombre), 0, p_minima, COALESCE(NULLIF(trim(p_unidad), ''), 'unidad'), p_consumo, NULLIF(trim(p_presentacion), ''), GREATEST(0, COALESCE(p_proteina, 0)), COALESCE(NULLIF(trim(p_clasificacion), ''), 'insumo'));
  END IF;
END;
$$ LANGUAGE plpgsql;

`,
];

for (const r of rows) {
  parts.push(
    `SELECT seed_inventory_insumo(${sqlStr(r.nombre)}, ${r.consumo}, ${r.umbral}, ${sqlStr(r.unidad)}, ${sqlStr(r.presentacion)}, ${r.proteina}, ${sqlStr(r.clasificacion)});\n`
  );
}
parts.push('\nDROP FUNCTION seed_inventory_insumo(TEXT, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, TEXT);\n');

fs.writeFileSync(OUT, parts.join(''));

const backfill = [
  '-- Clasificación P/M/I/C desde columna A del Google Sheet (ejecutar tras 028)\n\n',
];
for (const r of rows) {
  backfill.push(
    `UPDATE inventory_items SET clasificacion = ${sqlStr(r.clasificacion)} WHERE patient_id = (SELECT id FROM patient LIMIT 1) AND lower(trim(regexp_replace(nombre, '^\\*+', ''))) = ${sqlStr(normalizeNombreKey(r.nombre))};\n`
  );
}
fs.writeFileSync(OUT_CLASIF, backfill.join(''));
console.log(`Wrote ${rows.length} insumos to ${OUT}`);
console.log(`Wrote clasificacion backfill to ${OUT_CLASIF}`);
