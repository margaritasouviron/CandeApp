-- Seed: single patient record
-- Run after migrations. The organizador account must be created via Supabase Auth (see README).

INSERT INTO patient (nombre, fecha_nacimiento, notas_medicas, zona_horaria)
SELECT
  'Cande',
  '2018-03-15'::DATE,
  'Paciente con necesidades especiales de cuidado continuo. Requiere supervisión de enfermería las 24 horas.',
  'Europe/Madrid'
WHERE NOT EXISTS (SELECT 1 FROM patient LIMIT 1);

-- Sample prescriptions (administrador configura intervalos por medicación)
INSERT INTO medication_prescriptions (patient_id, nombre, dosis_estandar, intervalo_horas, hora_inicio, indicaciones)
SELECT
  p.id,
  v.nombre,
  v.dosis_estandar,
  v.intervalo_horas,
  v.hora_inicio::TIME,
  v.indicaciones
FROM patient p
CROSS JOIN (
  VALUES
    ('Paracetamol', '500 mg', 6, '08:00', 'Si fiebre o dolor'),
    ('Omeprazol', '20 mg', 24, '08:00', 'En ayunas')
) AS v(nombre, dosis_estandar, intervalo_horas, hora_inicio, indicaciones)
WHERE NOT EXISTS (
  SELECT 1 FROM medication_prescriptions mp
  WHERE mp.patient_id = p.id AND mp.nombre = v.nombre
);
