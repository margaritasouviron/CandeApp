-- candeApp initial schema
-- Enums
CREATE TYPE app_role AS ENUM ('organizador', 'enfermera');
CREATE TYPE care_log_type AS ENUM ('comida', 'medicacion', 'signos_vitales', 'higiene', 'observacion', 'nota', 'otro');
CREATE TYPE shift_status AS ENUM ('programado', 'en_curso', 'completado', 'cancelado');
CREATE TYPE dose_status AS ENUM ('pendiente', 'administrada', 'omitida', 'retrasada');
CREATE TYPE meal_type AS ENUM ('desayuno', 'almuerzo', 'merienda', 'cena', 'snack', 'otro');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'enfermera',
  telefono TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX profiles_single_active_organizador
  ON profiles (role)
  WHERE role = 'organizador' AND activo = true;

-- Singleton patient
CREATE TABLE patient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  fecha_nacimiento DATE,
  notas_medicas TEXT,
  zona_horaria TEXT NOT NULL DEFAULT 'Europe/Madrid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shifts
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
  nurse_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  status shift_status NOT NULL DEFAULT 'programado',
  notas TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shifts_fin_after_inicio CHECK (fin > inicio)
);

CREATE INDEX shifts_patient_inicio_idx ON shifts (patient_id, inicio);
CREATE INDEX shifts_nurse_idx ON shifts (nurse_id);

-- Care logs
CREATE TABLE care_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  tipo care_log_type NOT NULL,
  registrado_por UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX care_logs_patient_registrado_idx ON care_logs (patient_id, registrado_en DESC);
CREATE INDEX care_logs_tipo_idx ON care_logs (tipo);

-- Detail tables
CREATE TABLE meal_entries (
  care_log_id UUID PRIMARY KEY REFERENCES care_logs(id) ON DELETE CASCADE,
  tipo_comida meal_type NOT NULL,
  descripcion TEXT,
  cantidad_aprox TEXT,
  tolerancia TEXT
);

CREATE TABLE medication_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  dosis_estandar TEXT NOT NULL,
  intervalo_horas NUMERIC(5,2) NOT NULL CHECK (intervalo_horas > 0),
  hora_inicio TIME NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  indicaciones TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medication_administrations (
  care_log_id UUID PRIMARY KEY REFERENCES care_logs(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES medication_prescriptions(id) ON DELETE SET NULL,
  nombre_medicamento TEXT NOT NULL,
  dosis TEXT NOT NULL,
  via TEXT,
  administrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  proxima_dosis_en TIMESTAMPTZ,
  observaciones TEXT
);

CREATE TABLE vital_signs (
  care_log_id UUID PRIMARY KEY REFERENCES care_logs(id) ON DELETE CASCADE,
  temperatura NUMERIC(4,1),
  presion_sistolica INTEGER,
  presion_diastolica INTEGER,
  frecuencia_cardiaca INTEGER,
  saturacion_o2 INTEGER,
  peso NUMERIC(5,2),
  notas TEXT
);

CREATE TABLE hygiene_activities (
  care_log_id UUID PRIMARY KEY REFERENCES care_logs(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL
);

CREATE TABLE observations (
  care_log_id UUID PRIMARY KEY REFERENCES care_logs(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL
);

CREATE TABLE medication_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES medication_prescriptions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
  programado_para TIMESTAMPTZ NOT NULL,
  status dose_status NOT NULL DEFAULT 'pendiente',
  administration_id UUID REFERENCES medication_administrations(care_log_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX medication_schedules_patient_programado_idx
  ON medication_schedules (patient_id, programado_para);

-- Audit (append-only)
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entidad TEXT NOT NULL,
  entidad_id UUID NOT NULL,
  accion TEXT NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
  valor_anterior JSONB,
  valor_nuevo JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_created_at_idx ON audit_events (created_at DESC);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT false,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);

-- Device tokens for push notifications
CREATE TABLE device_tokens (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, expo_push_token)
);

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER patient_updated_at BEFORE UPDATE ON patient
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER medication_prescriptions_updated_at BEFORE UPDATE ON medication_prescriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile on signup; first user becomes organizador
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role app_role;
  v_nombre TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE role = 'organizador' AND activo = true
  ) THEN
    v_role := 'organizador';
  ELSE
    v_role := 'enfermera';
  END IF;

  v_nombre := COALESCE(
    NEW.raw_user_meta_data->>'nombre_completo',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO profiles (id, nombre_completo, role)
  VALUES (NEW.id, v_nombre, v_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update shift status based on time
CREATE OR REPLACE FUNCTION refresh_shift_statuses()
RETURNS void AS $$
BEGIN
  UPDATE shifts SET status = 'en_curso'
  WHERE status = 'programado'
    AND now() >= inicio AND now() < fin;

  UPDATE shifts SET status = 'completado'
  WHERE status IN ('programado', 'en_curso')
    AND now() >= fin;
END;
$$ LANGUAGE plpgsql;
