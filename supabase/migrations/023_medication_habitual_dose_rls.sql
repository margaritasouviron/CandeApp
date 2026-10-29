-- Enfermeras pueden crear la prescripción la primera vez y actualizar la dosis habitual

DROP POLICY IF EXISTS rx_insert ON medication_prescriptions;
CREATE POLICY rx_insert ON medication_prescriptions FOR INSERT TO authenticated
  WITH CHECK (
    is_organizador()
    OR (
      is_enfermera()
      AND NOT EXISTS (
        SELECT 1 FROM medication_prescriptions mp
        WHERE mp.patient_id = medication_prescriptions.patient_id
          AND lower(trim(mp.nombre)) = lower(trim(medication_prescriptions.nombre))
          AND mp.activo = true
      )
    )
  );

DROP POLICY IF EXISTS rx_update ON medication_prescriptions;
CREATE POLICY rx_update ON medication_prescriptions FOR UPDATE TO authenticated
  USING (is_organizador() OR is_enfermera())
  WITH CHECK (is_organizador() OR is_enfermera());
