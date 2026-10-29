-- Perfiles: rol standby, invitaciones, autor real del registro

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'standby';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS perfil_completo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE care_logs
  ADD COLUMN IF NOT EXISTS realizado_por UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS care_logs_realizado_por_idx ON care_logs (realizado_por);

CREATE TABLE IF NOT EXISTS profile_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_invites_email_active_idx
  ON profile_invites (lower(email))
  WHERE used_at IS NULL;

ALTER TABLE profile_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_invites_select_org ON profile_invites FOR SELECT TO authenticated
  USING (is_organizador());

CREATE POLICY profile_invites_insert_org ON profile_invites FOR INSERT TO authenticated
  WITH CHECK (is_organizador());

CREATE POLICY profile_invites_delete_org ON profile_invites FOR DELETE TO authenticated
  USING (is_organizador());

CREATE OR REPLACE FUNCTION is_standby()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'standby';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_register_email(p_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_invites
    WHERE lower(email) = lower(trim(p_email)) AND used_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION can_register_email(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role app_role;
  v_nombre TEXT;
  v_invite_id UUID;
  v_perfil_completo BOOLEAN := true;
BEGIN
  IF lower(NEW.email) = 'standby@gmail.com' THEN
    v_role := 'standby';
    v_nombre := COALESCE(NEW.raw_user_meta_data->>'nombre_completo', 'Tablet del cuarto');
    v_perfil_completo := true;
  ELSIF NOT EXISTS (
    SELECT 1 FROM profiles WHERE role = 'organizador' AND activo = true
  ) THEN
    v_role := 'organizador';
    v_nombre := COALESCE(
      NEW.raw_user_meta_data->>'nombre_completo',
      split_part(NEW.email, '@', 1)
    );
  ELSE
    SELECT id, nombre_completo INTO v_invite_id, v_nombre
    FROM profile_invites
    WHERE lower(email) = lower(NEW.email) AND used_at IS NULL
    LIMIT 1;

    IF v_invite_id IS NULL THEN
      RAISE EXCEPTION 'Este correo no tiene invitación. Pedí acceso a la administradora.';
    END IF;

    v_role := 'enfermera';
    v_nombre := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'nombre_completo'), ''), v_nombre);

    UPDATE profile_invites
    SET used_at = now(), used_by = NEW.id
    WHERE id = v_invite_id;
  END IF;

  INSERT INTO profiles (id, nombre_completo, role, email, perfil_completo)
  VALUES (NEW.id, v_nombre, v_role, NEW.email, v_perfil_completo);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS care_logs_insert ON care_logs;
CREATE POLICY care_logs_insert ON care_logs FOR INSERT TO authenticated
  WITH CHECK (
    is_organizador()
    OR (is_enfermera() AND registrado_por = auth.uid() AND realizado_por IS NULL)
    OR (
      is_standby()
      AND registrado_por = auth.uid()
      AND realizado_por IS NOT NULL
      AND realizado_por <> auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = realizado_por
          AND p.activo = true
          AND p.role IN ('enfermera', 'organizador')
      )
    )
  );

DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (activo = true OR id = auth.uid() OR is_organizador());
