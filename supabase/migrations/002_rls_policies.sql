-- RLS helper functions
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS app_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND activo = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_organizador()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'organizador';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_enfermera()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'enfermera';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION has_active_shift(p_nurse_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM shifts
    WHERE nurse_id = p_nurse_id
      AND status IN ('programado', 'en_curso')
      AND now() BETWEEN inicio AND fin
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_active_shift_id(p_nurse_id UUID DEFAULT auth.uid())
RETURNS UUID AS $$
  SELECT id FROM shifts
  WHERE nurse_id = p_nurse_id
    AND status IN ('programado', 'en_curso')
    AND now() BETWEEN inicio AND fin
  ORDER BY inicio
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_administrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hygiene_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (activo = true OR id = auth.uid());

CREATE POLICY profiles_update_self ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY profiles_insert_organizador ON profiles FOR INSERT TO authenticated
  WITH CHECK (is_organizador() AND role = 'enfermera');

CREATE POLICY profiles_update_organizador ON profiles FOR UPDATE TO authenticated
  USING (is_organizador())
  WITH CHECK (is_organizador());

-- Patient policies
CREATE POLICY patient_select ON patient FOR SELECT TO authenticated USING (true);
CREATE POLICY patient_update ON patient FOR UPDATE TO authenticated
  USING (is_organizador()) WITH CHECK (is_organizador());
CREATE POLICY patient_insert ON patient FOR INSERT TO authenticated
  WITH CHECK (is_organizador());

-- Shifts policies
CREATE POLICY shifts_select ON shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY shifts_insert ON shifts FOR INSERT TO authenticated
  WITH CHECK (is_organizador());
CREATE POLICY shifts_update ON shifts FOR UPDATE TO authenticated
  USING (is_organizador()) WITH CHECK (is_organizador());
CREATE POLICY shifts_delete ON shifts FOR DELETE TO authenticated
  USING (is_organizador());

-- Care logs policies
CREATE POLICY care_logs_select ON care_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY care_logs_insert ON care_logs FOR INSERT TO authenticated
  WITH CHECK (
    is_organizador()
    OR (is_enfermera() AND has_active_shift() AND registrado_por = auth.uid())
  );

-- Detail table policies (inherit via care_log access)
CREATE POLICY meal_entries_select ON meal_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM care_logs WHERE id = care_log_id));
CREATE POLICY meal_entries_insert ON meal_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM care_logs WHERE id = care_log_id AND registrado_por = auth.uid()));

CREATE POLICY med_admin_select ON medication_administrations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM care_logs WHERE id = care_log_id));
CREATE POLICY med_admin_insert ON medication_administrations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM care_logs WHERE id = care_log_id AND registrado_por = auth.uid()));

CREATE POLICY vital_signs_select ON vital_signs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM care_logs WHERE id = care_log_id));
CREATE POLICY vital_signs_insert ON vital_signs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM care_logs WHERE id = care_log_id AND registrado_por = auth.uid()));

CREATE POLICY hygiene_select ON hygiene_activities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM care_logs WHERE id = care_log_id));
CREATE POLICY hygiene_insert ON hygiene_activities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM care_logs WHERE id = care_log_id AND registrado_por = auth.uid()));

CREATE POLICY observations_select ON observations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM care_logs WHERE id = care_log_id));
CREATE POLICY observations_insert ON observations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM care_logs WHERE id = care_log_id AND registrado_por = auth.uid()));

-- Medication prescriptions
CREATE POLICY rx_select ON medication_prescriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY rx_insert ON medication_prescriptions FOR INSERT TO authenticated
  WITH CHECK (is_organizador());
CREATE POLICY rx_update ON medication_prescriptions FOR UPDATE TO authenticated
  USING (is_organizador()) WITH CHECK (is_organizador());
CREATE POLICY rx_delete ON medication_prescriptions FOR DELETE TO authenticated
  USING (is_organizador());

-- Medication schedules
CREATE POLICY schedules_select ON medication_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY schedules_update ON medication_schedules FOR UPDATE TO authenticated
  USING (is_organizador() OR has_active_shift());

-- Audit events (organizador read-only)
CREATE POLICY audit_select ON audit_events FOR SELECT TO authenticated
  USING (is_organizador());

-- Notifications
CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notifications_update ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Device tokens
CREATE POLICY device_tokens_all ON device_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
