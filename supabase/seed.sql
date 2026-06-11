-- Seed: single patient record
-- Run after migrations. The organizador account must be created via Supabase Auth (see README).

INSERT INTO patient (nombre, fecha_nacimiento, notas_medicas, zona_horaria)
SELECT
  'Cande',
  '2018-03-15'::DATE,
  'Paciente con necesidades especiales de cuidado continuo. Requiere supervisión de enfermería las 24 horas.',
  'Europe/Madrid'
WHERE NOT EXISTS (SELECT 1 FROM patient LIMIT 1);
