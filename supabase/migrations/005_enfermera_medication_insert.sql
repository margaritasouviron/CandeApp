-- REVERTED: only organizador may add medications to the patient catalog (see 002_rls rx_insert).
-- Nurses select from existing prescriptions and record administrations only.

DROP POLICY IF EXISTS rx_insert_enfermera ON medication_prescriptions;

-- Allow nurses to schedule the next dose after administering medication
CREATE POLICY schedules_insert ON medication_schedules FOR INSERT TO authenticated
  WITH CHECK (is_organizador() OR (is_enfermera() AND has_active_shift()));
