-- Rellenar nombre y dosis en notificaciones antiguas (antes de migración 006)

UPDATE notifications n
SET
  titulo = mp.nombre,
  cuerpo = mp.nombre || ' · Dosis: ' || mp.dosis_estandar || ' · Horario: '
    || to_char((n.payload->>'programado_para')::timestamptz AT TIME ZONE COALESCE(p.zona_horaria, 'Europe/Madrid'), 'DD/MM/YYYY HH24:MI'),
  payload = COALESCE(n.payload, '{}'::jsonb) || jsonb_build_object(
    'nombre', mp.nombre,
    'dosis', mp.dosis_estandar
  )
FROM medication_prescriptions mp
JOIN patient p ON p.id = mp.patient_id
WHERE n.payload->>'prescription_id' = mp.id::text
  AND (n.payload->>'nombre' IS NULL OR n.titulo IN ('Dosis pendiente', 'Medicación'));

-- Notificaciones con nombre solo en cuerpo antiguo: "Dosis pendiente: Paracetamol"
UPDATE notifications
SET
  titulo = trim(regexp_replace(cuerpo, '^Dosis pendiente:\s*', '', 'i')),
  payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object(
    'nombre', trim(regexp_replace(cuerpo, '^Dosis pendiente:\s*', '', 'i'))
  )
WHERE titulo = 'Dosis pendiente'
  AND cuerpo ~* '^Dosis pendiente:';
