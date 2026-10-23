-- Borrar registros y eventos pasados; dejar medicación activa con próximas dosis desde hoy.

CREATE OR REPLACE FUNCTION reset_care_timeline_from_today(p_patient_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_tz TEXT;
  v_today DATE;
  v_start TIMESTAMPTZ;
  v_rx RECORD;
  v_deleted_logs BIGINT;
  v_deleted_schedules BIGINT;
  v_deleted_shifts BIGINT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_organizador() THEN
    RAISE EXCEPTION 'Solo la administradora puede reiniciar el historial';
  END IF;

  IF p_patient_id IS NULL THEN
    SELECT id INTO v_patient_id FROM patient ORDER BY created_at LIMIT 1;
  ELSE
    v_patient_id := p_patient_id;
  END IF;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'No hay paciente configurado';
  END IF;

  SELECT COALESCE(NULLIF(trim(zona_horaria), ''), 'Europe/Madrid')
  INTO v_tz
  FROM patient
  WHERE id = v_patient_id;

  v_today := (now() AT TIME ZONE v_tz)::DATE;

  DELETE FROM medication_schedules
  WHERE patient_id = v_patient_id
    AND (
      status IN ('administrada', 'omitida')
      OR (programado_para AT TIME ZONE v_tz)::DATE < v_today
    );
  GET DIAGNOSTICS v_deleted_schedules = ROW_COUNT;

  DELETE FROM care_logs WHERE patient_id = v_patient_id;
  GET DIAGNOSTICS v_deleted_logs = ROW_COUNT;

  DELETE FROM shifts
  WHERE patient_id = v_patient_id
    AND (fin AT TIME ZONE v_tz)::DATE < v_today;
  GET DIAGNOSTICS v_deleted_shifts = ROW_COUNT;

  FOR v_rx IN
    SELECT id, intervalo_horas, hora_inicio
    FROM medication_prescriptions
    WHERE patient_id = v_patient_id AND activo = true
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM medication_schedules ms
      WHERE ms.prescription_id = v_rx.id
        AND ms.status IN ('pendiente', 'retrasada')
        AND (ms.programado_para AT TIME ZONE v_tz)::DATE >= v_today
    ) THEN
      v_start := (v_today + v_rx.hora_inicio) AT TIME ZONE v_tz;
      WHILE v_start < now() LOOP
        v_start := v_start + (v_rx.intervalo_horas || ' hours')::INTERVAL;
      END LOOP;

      INSERT INTO medication_schedules (prescription_id, patient_id, programado_para, status)
      VALUES (v_rx.id, v_patient_id, v_start, 'pendiente');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'patient_id', v_patient_id,
    'from_date', v_today,
    'deleted_care_logs', v_deleted_logs,
    'deleted_medication_schedules', v_deleted_schedules,
    'deleted_shifts', v_deleted_shifts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reset_care_timeline_from_today(UUID) TO authenticated;
