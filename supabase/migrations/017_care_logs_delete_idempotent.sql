-- Reaplicar borrado de registros (seguro si 016 falló a medias). Ejecutar en SQL Editor.

DROP POLICY IF EXISTS care_logs_delete ON care_logs;

CREATE POLICY care_logs_delete ON care_logs
  FOR DELETE TO authenticated
  USING (is_organizador() OR registrado_por = auth.uid());

CREATE OR REPLACE FUNCTION delete_care_log_with_medication_follow_up(p_log_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo care_log_type;
  v_rx UUID;
  v_admin TIMESTAMPTZ;
  v_ids UUID[];
  v_count INT;
BEGIN
  SELECT tipo INTO v_tipo FROM care_logs WHERE id = p_log_id;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Registro no encontrado';
  END IF;

  IF NOT (
    is_organizador()
    OR EXISTS (
      SELECT 1 FROM care_logs cl
      WHERE cl.id = p_log_id AND cl.registrado_por = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_tipo <> 'medicacion' THEN
    DELETE FROM care_logs WHERE id = p_log_id;
    RETURN 1;
  END IF;

  SELECT ma.prescription_id, ma.administrado_en
  INTO v_rx, v_admin
  FROM medication_administrations ma
  WHERE ma.care_log_id = p_log_id;

  IF v_rx IS NULL THEN
    DELETE FROM care_logs WHERE id = p_log_id;
    RETURN 1;
  END IF;

  SELECT array_agg(ma.care_log_id ORDER BY ma.administrado_en)
  INTO v_ids
  FROM medication_administrations ma
  WHERE ma.prescription_id = v_rx
    AND ma.administrado_en >= v_admin;

  v_count := coalesce(array_length(v_ids, 1), 0);
  IF v_count = 0 THEN
    DELETE FROM care_logs WHERE id = p_log_id;
    RETURN 1;
  END IF;

  DELETE FROM medication_schedules ms
  WHERE ms.prescription_id = v_rx
    AND (
      ms.administration_id = ANY (v_ids)
      OR (
        ms.status IN ('pendiente', 'retrasada')
        AND ms.programado_para >= v_admin
      )
    );

  DELETE FROM care_logs WHERE id = ANY (v_ids);

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_care_log_with_medication_follow_up(UUID) TO authenticated;
