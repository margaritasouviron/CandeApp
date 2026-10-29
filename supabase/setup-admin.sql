-- Guía rápida: organizador + paciente + medicaciones
-- Ejecutar en Supabase SQL Editor DESPUÉS de las migraciones 001-004.

-- ─── 1. Verificar que las migraciones base están aplicadas ───
-- (tablas profiles, patient, medication_prescriptions deben existir)

-- ─── 2. Crear la administradora (PRIMERO en Authentication) ───
-- Dashboard → Authentication → Users → Add user
--   • Email + contraseña
--   • Marcar "Auto Confirm User"
-- El trigger handle_new_user asigna rol organizador al PRIMER usuario.

-- Comprobar perfil:
SELECT id, nombre_completo, role, activo FROM profiles;

-- Si el usuario existe pero no tiene perfil (raro):
-- INSERT INTO profiles (id, nombre_completo, role)
-- SELECT id, email, 'organizador'::app_role FROM auth.users WHERE email = 'tu@email.com';

-- ─── 3. Crear el paciente (solo organizador puede insertar vía app/RLS;
--     en SQL Editor usas service role o desactivas RLS temporalmente) ───

INSERT INTO patient (nombre, fecha_nacimiento, notas_medicas, zona_horaria)
SELECT
  'Cande',
  '2018-03-15'::DATE,
  'Necesidades especiales de cuidado continuo.',
  'Europe/Madrid'
WHERE NOT EXISTS (SELECT 1 FROM patient LIMIT 1);

-- ─── 4. Medicaciones (SOLO administrador en la app; aquí vía SQL como admin) ───

INSERT INTO medication_prescriptions (
  patient_id, nombre, dosis_estandar, intervalo_horas, hora_inicio, indicaciones, created_by
)
SELECT
  p.id,
  v.nombre,
  v.dosis,
  v.intervalo,
  v.hora_inicio::TIME,
  v.indicaciones,
  (SELECT id FROM profiles WHERE role = 'organizador' AND activo = true LIMIT 1)
FROM patient p
CROSS JOIN (
  VALUES
    ('Paracetamol', '500 mg', 6, '08:00', 'Si fiebre o dolor'),
    ('Omeprazol', '20 mg', 24, '08:00', 'En ayunas')
) AS v(nombre, dosis, intervalo, hora_inicio, indicaciones)
WHERE NOT EXISTS (
  SELECT 1 FROM medication_prescriptions mp
  WHERE mp.patient_id = p.id AND mp.nombre = v.nombre
);

-- ─── 5. Tablet standby (cuarto de Cande) ───
-- Authentication → Add user
--   • Email: standby@gmail.com
--   • Password: candeapp  (cambiala en producción si querés)
--   • Auto Confirm User
-- El trigger asigna rol «standby». En la app, cada registro pide quién del equipo lo cargó.

-- ─── 6. Crear enfermeras (DESPUÉS de la administradora) ───
-- Desde la app: Settings → Perfiles → Agregar perfil (correo + nombre).
-- La persona entra en «Crear cuenta» con ese correo y elige su contraseña.
-- (Alternativa: Authentication → Add user; hace falta invitación en profile_invites tras migración 026.)

-- ─── 7. Desactivar registro público (recomendado) ───
-- Authentication → Providers → Email → desactivar "Enable sign ups"

-- ─── 8. Verificación final ───
SELECT 'profiles' AS tabla, count(*) FROM profiles
UNION ALL SELECT 'patient', count(*) FROM patient
UNION ALL SELECT 'medication_prescriptions', count(*) FROM medication_prescriptions;
