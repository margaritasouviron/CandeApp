-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID;
  v_entidad_id UUID;
  v_anterior JSONB;
  v_nuevo JSONB;
BEGIN
  v_actor := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_entidad_id := OLD.id;
    v_anterior := to_jsonb(OLD);
    v_nuevo := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_entidad_id := NEW.id;
    v_anterior := to_jsonb(OLD);
    v_nuevo := to_jsonb(NEW);
  ELSE
    v_entidad_id := NEW.id;
    v_anterior := NULL;
    v_nuevo := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_events (actor_id, entidad, entidad_id, accion, valor_anterior, valor_nuevo)
  VALUES (v_actor, TG_TABLE_NAME, v_entidad_id, TG_OP, v_anterior, v_nuevo);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_shifts
  AFTER INSERT OR UPDATE OR DELETE ON shifts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_care_logs
  AFTER INSERT OR UPDATE OR DELETE ON care_logs
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_medication_prescriptions
  AFTER INSERT OR UPDATE OR DELETE ON medication_prescriptions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Compute next dose after medication administration
CREATE OR REPLACE FUNCTION compute_next_dose()
RETURNS TRIGGER AS $$
DECLARE
  v_intervalo NUMERIC;
  v_patient_id UUID;
  v_prescription_id UUID;
BEGIN
  IF NEW.prescription_id IS NOT NULL THEN
    SELECT intervalo_horas, patient_id INTO v_intervalo, v_patient_id
    FROM medication_prescriptions WHERE id = NEW.prescription_id;

    IF v_intervalo IS NOT NULL THEN
      NEW.proxima_dosis_en := NEW.administrado_en + (v_intervalo || ' hours')::INTERVAL;

      -- Mark current schedule as administrada
      UPDATE medication_schedules
      SET status = 'administrada', administration_id = NEW.care_log_id
      WHERE prescription_id = NEW.prescription_id
        AND status = 'pendiente'
        AND programado_para <= NEW.administrado_en + INTERVAL '30 minutes'
        AND programado_para >= NEW.administrado_en - INTERVAL '30 minutes';

      -- Create next pending schedule
      INSERT INTO medication_schedules (prescription_id, patient_id, programado_para, status)
      VALUES (NEW.prescription_id, v_patient_id, NEW.proxima_dosis_en, 'pendiente');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compute_next_dose
  BEFORE INSERT ON medication_administrations
  FOR EACH ROW EXECUTE FUNCTION compute_next_dose();

-- Generate initial schedules when prescription is created
CREATE OR REPLACE FUNCTION generate_initial_schedules()
RETURNS TRIGGER AS $$
DECLARE
  v_start TIMESTAMPTZ;
BEGIN
  v_start := (CURRENT_DATE + NEW.hora_inicio) AT TIME ZONE 'Europe/Madrid';
  IF v_start < now() THEN
    v_start := v_start + INTERVAL '1 day';
  END IF;

  INSERT INTO medication_schedules (prescription_id, patient_id, programado_para, status)
  VALUES (NEW.id, NEW.patient_id, v_start, 'pendiente');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_initial_schedules
  AFTER INSERT ON medication_prescriptions
  FOR EACH ROW EXECUTE FUNCTION generate_initial_schedules();

-- Mark overdue doses as retrasada/omitida and notify organizador
CREATE OR REPLACE FUNCTION check_missed_doses()
RETURNS void AS $$
DECLARE
  v_schedule RECORD;
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM profiles WHERE role = 'organizador' AND activo = true LIMIT 1;

  FOR v_schedule IN
    SELECT ms.*, mp.nombre
    FROM medication_schedules ms
    JOIN medication_prescriptions mp ON mp.id = ms.prescription_id
    WHERE ms.status = 'pendiente'
      AND ms.programado_para + INTERVAL '30 minutes' < now()
  LOOP
    UPDATE medication_schedules SET status = 'retrasada' WHERE id = v_schedule.id;

    IF v_org_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = v_org_id
        AND tipo = 'dosis_omitida'
        AND payload->>'schedule_id' = v_schedule.id::TEXT
        AND created_at > now() - INTERVAL '1 hour'
    ) THEN
      INSERT INTO notifications (user_id, tipo, titulo, cuerpo, payload)
      VALUES (
        v_org_id,
        'dosis_omitida',
        'Dosis pendiente',
        'Dosis pendiente: ' || v_schedule.nombre,
        jsonb_build_object('schedule_id', v_schedule.id, 'prescription_id', v_schedule.prescription_id)
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Uncovered shifts detection
CREATE OR REPLACE FUNCTION get_uncovered_shifts()
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  inicio TIMESTAMPTZ,
  fin TIMESTAMPTZ,
  status shift_status,
  notas TEXT
) AS $$
BEGIN
  PERFORM refresh_shift_statuses();

  RETURN QUERY
  SELECT s.id, s.patient_id, s.inicio, s.fin, s.status, s.notas
  FROM shifts s
  WHERE s.nurse_id IS NULL
    AND s.status != 'cancelado'
    AND s.inicio <= now() + INTERVAL '48 hours'
    AND s.fin > now()
  ORDER BY s.inicio;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_uncovered_shifts() TO authenticated;

-- Day events for calendar bullet list
CREATE OR REPLACE FUNCTION get_day_events(p_patient_id UUID, p_fecha DATE)
RETURNS TABLE (
  hora TEXT,
  descripcion TEXT,
  tipo_evento TEXT,
  referencia_id UUID
) AS $$
BEGIN
  PERFORM refresh_shift_statuses();

  RETURN QUERY
  -- Shifts
  SELECT
    to_char(s.inicio AT TIME ZONE 'Europe/Madrid', 'HH24:MI') || '–' ||
    to_char(s.fin AT TIME ZONE 'Europe/Madrid', 'HH24:MI') AS hora,
    'Turno: ' || COALESCE(p.nombre_completo, 'Sin asignar') AS descripcion,
    'turno'::TEXT AS tipo_evento,
    s.id AS referencia_id
  FROM shifts s
  LEFT JOIN profiles p ON p.id = s.nurse_id
  WHERE s.patient_id = p_patient_id
    AND s.status != 'cancelado'
    AND (s.inicio AT TIME ZONE 'Europe/Madrid')::DATE = p_fecha

  UNION ALL

  -- Meals
  SELECT
    to_char(cl.registrado_en AT TIME ZONE 'Europe/Madrid', 'HH24:MI') AS hora,
    'Comida: ' || me.tipo_comida::TEXT ||
      COALESCE(', ' || me.descripcion, '') AS descripcion,
    'comida'::TEXT,
    cl.id
  FROM care_logs cl
  JOIN meal_entries me ON me.care_log_id = cl.id
  WHERE cl.patient_id = p_patient_id
    AND cl.tipo = 'comida'
    AND (cl.registrado_en AT TIME ZONE 'Europe/Madrid')::DATE = p_fecha

  UNION ALL

  -- Medication administrations
  SELECT
    to_char(ma.administrado_en AT TIME ZONE 'Europe/Madrid', 'HH24:MI') AS hora,
    'Medicación: ' || ma.nombre_medicamento || ' ' || ma.dosis ||
      CASE WHEN ma.proxima_dosis_en IS NOT NULL THEN
        ' · Próxima: ' || to_char(ma.proxima_dosis_en AT TIME ZONE 'Europe/Madrid', 'HH24:MI')
      ELSE '' END AS descripcion,
    'medicacion'::TEXT,
    cl.id
  FROM care_logs cl
  JOIN medication_administrations ma ON ma.care_log_id = cl.id
  WHERE cl.patient_id = p_patient_id
    AND (ma.administrado_en AT TIME ZONE 'Europe/Madrid')::DATE = p_fecha

  UNION ALL

  -- Pending/overdue doses
  SELECT
    to_char(ms.programado_para AT TIME ZONE 'Europe/Madrid', 'HH24:MI') AS hora,
    CASE WHEN ms.status IN ('pendiente', 'retrasada') THEN
      '⚠ Dosis pendiente: ' || mp.nombre
    ELSE
      'Dosis ' || ms.status::TEXT || ': ' || mp.nombre
    END AS descripcion,
    'dosis'::TEXT,
    ms.id
  FROM medication_schedules ms
  JOIN medication_prescriptions mp ON mp.id = ms.prescription_id
  WHERE ms.patient_id = p_patient_id
    AND (ms.programado_para AT TIME ZONE 'Europe/Madrid')::DATE = p_fecha
    AND ms.status IN ('pendiente', 'retrasada')

  UNION ALL

  -- Vital signs
  SELECT
    to_char(cl.registrado_en AT TIME ZONE 'Europe/Madrid', 'HH24:MI') AS hora,
    'Signos vitales registrados' AS descripcion,
    'signos_vitales'::TEXT,
    cl.id
  FROM care_logs cl
  WHERE cl.patient_id = p_patient_id
    AND cl.tipo = 'signos_vitales'
    AND (cl.registrado_en AT TIME ZONE 'Europe/Madrid')::DATE = p_fecha

  ORDER BY hora;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_day_events(UUID, DATE) TO authenticated;

-- Notify organizador of uncovered shifts
CREATE OR REPLACE FUNCTION notify_uncovered_shifts()
RETURNS void AS $$
DECLARE
  v_shift RECORD;
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM profiles WHERE role = 'organizador' AND activo = true LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  FOR v_shift IN SELECT * FROM get_uncovered_shifts()
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = v_org_id
        AND tipo = 'turno_sin_cobertura'
        AND payload->>'shift_id' = v_shift.id::TEXT
        AND created_at > now() - INTERVAL '6 hours'
    ) THEN
      INSERT INTO notifications (user_id, tipo, titulo, cuerpo, payload)
      VALUES (
        v_org_id,
        'turno_sin_cobertura',
        'Turno sin cobertura',
        'Hay un turno sin enfermera asignada el ' ||
          to_char(v_shift.inicio AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI'),
        jsonb_build_object('shift_id', v_shift.id)
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
