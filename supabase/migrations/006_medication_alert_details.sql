-- Alertas de medicación con nombre, dosis y horario

CREATE OR REPLACE FUNCTION medication_alert_body(
  p_nombre TEXT,
  p_dosis TEXT,
  p_programado TIMESTAMPTZ,
  p_tz TEXT DEFAULT 'Europe/Madrid'
)
RETURNS TEXT AS $$
BEGIN
  RETURN p_nombre || ' · Dosis: ' || p_dosis || ' · Horario: '
    || to_char(p_programado AT TIME ZONE p_tz, 'DD/MM/YYYY HH24:MI');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Notificar cuando se programa una dosis (nueva medicación o próxima dosis)
CREATE OR REPLACE FUNCTION notify_medication_schedule()
RETURNS TRIGGER AS $$
DECLARE
  v_rx RECORD;
  v_user RECORD;
  v_tipo TEXT;
  v_titulo TEXT;
  v_cuerpo TEXT;
  v_payload JSONB;
BEGIN
  IF NEW.status <> 'pendiente' THEN
    RETURN NEW;
  END IF;

  SELECT mp.nombre, mp.dosis_estandar, p.zona_horaria
  INTO v_rx
  FROM medication_prescriptions mp
  JOIN patient p ON p.id = mp.patient_id
  WHERE mp.id = NEW.prescription_id;

  IF v_rx.nombre IS NULL THEN
    RETURN NEW;
  END IF;

  v_tipo := CASE
    WHEN (SELECT count(*) FROM medication_schedules WHERE prescription_id = NEW.prescription_id) = 1
    THEN 'nueva_medicacion'
    ELSE 'medicacion_programada'
  END;

  v_titulo := v_rx.nombre;
  v_cuerpo := medication_alert_body(v_rx.nombre, v_rx.dosis_estandar, NEW.programado_para, v_rx.zona_horaria);
  v_payload := jsonb_build_object(
    'schedule_id', NEW.id,
    'prescription_id', NEW.prescription_id,
    'nombre', v_rx.nombre,
    'dosis', v_rx.dosis_estandar,
    'programado_para', NEW.programado_para
  );

  FOR v_user IN SELECT id FROM profiles WHERE activo = true
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = v_user.id
        AND tipo IN ('nueva_medicacion', 'medicacion_programada')
        AND payload->>'schedule_id' = NEW.id::TEXT
    ) THEN
      INSERT INTO notifications (user_id, tipo, titulo, cuerpo, payload)
      VALUES (v_user.id, v_tipo, v_titulo, v_cuerpo, v_payload);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_medication_schedule ON medication_schedules;
CREATE TRIGGER trg_notify_medication_schedule
  AFTER INSERT ON medication_schedules
  FOR EACH ROW EXECUTE FUNCTION notify_medication_schedule();

-- Dosis retrasadas / omitidas con detalle completo
CREATE OR REPLACE FUNCTION check_missed_doses()
RETURNS void AS $$
DECLARE
  v_row RECORD;
  v_user RECORD;
  v_cuerpo TEXT;
  v_payload JSONB;
BEGIN
  FOR v_row IN
    SELECT
      ms.id AS schedule_id,
      ms.prescription_id,
      ms.programado_para,
      mp.nombre,
      mp.dosis_estandar,
      p.zona_horaria
    FROM medication_schedules ms
    JOIN medication_prescriptions mp ON mp.id = ms.prescription_id
    JOIN patient p ON p.id = ms.patient_id
    WHERE ms.status = 'pendiente'
      AND ms.programado_para + INTERVAL '30 minutes' < now()
  LOOP
    UPDATE medication_schedules SET status = 'retrasada' WHERE id = v_row.schedule_id;

    v_cuerpo := medication_alert_body(
      v_row.nombre,
      v_row.dosis_estandar,
      v_row.programado_para,
      v_row.zona_horaria
    ) || ' · Estado: retrasada';

    v_payload := jsonb_build_object(
      'schedule_id', v_row.schedule_id,
      'prescription_id', v_row.prescription_id,
      'nombre', v_row.nombre,
      'dosis', v_row.dosis_estandar,
      'programado_para', v_row.programado_para,
      'estado', 'retrasada'
    );

    FOR v_user IN SELECT id FROM profiles WHERE activo = true
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_user.id
          AND tipo = 'dosis_omitida'
          AND payload->>'schedule_id' = v_row.schedule_id::TEXT
          AND created_at > now() - INTERVAL '24 hours'
      ) THEN
        INSERT INTO notifications (user_id, tipo, titulo, cuerpo, payload)
        VALUES (
          v_user.id,
          'dosis_omitida',
          v_row.nombre,
          v_cuerpo,
          v_payload
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recordatorios de dosis próximas (próxima hora)
CREATE OR REPLACE FUNCTION notify_upcoming_doses()
RETURNS void AS $$
DECLARE
  v_row RECORD;
  v_user RECORD;
  v_cuerpo TEXT;
  v_payload JSONB;
BEGIN
  FOR v_row IN
    SELECT
      ms.id AS schedule_id,
      ms.prescription_id,
      ms.programado_para,
      mp.nombre,
      mp.dosis_estandar,
      p.zona_horaria
    FROM medication_schedules ms
    JOIN medication_prescriptions mp ON mp.id = ms.prescription_id
    JOIN patient p ON p.id = ms.patient_id
    WHERE ms.status = 'pendiente'
      AND ms.programado_para BETWEEN now() AND now() + INTERVAL '1 hour'
  LOOP
    v_cuerpo := medication_alert_body(
      v_row.nombre,
      v_row.dosis_estandar,
      v_row.programado_para,
      v_row.zona_horaria
    );

    v_payload := jsonb_build_object(
      'schedule_id', v_row.schedule_id,
      'prescription_id', v_row.prescription_id,
      'nombre', v_row.nombre,
      'dosis', v_row.dosis_estandar,
      'programado_para', v_row.programado_para
    );

    FOR v_user IN SELECT id FROM profiles WHERE activo = true
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_user.id
          AND tipo = 'medicacion_proxima'
          AND payload->>'schedule_id' = v_row.schedule_id::TEXT
      ) THEN
        INSERT INTO notifications (user_id, tipo, titulo, cuerpo, payload)
        VALUES (
          v_user.id,
          'medicacion_proxima',
          v_row.nombre,
          v_cuerpo,
          v_payload
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION refresh_app_alerts()
RETURNS void AS $$
BEGIN
  PERFORM refresh_shift_statuses();
  PERFORM notify_upcoming_doses();
  PERFORM check_missed_doses();
  PERFORM notify_uncovered_shifts();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
