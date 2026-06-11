-- Maintenance RPC: refresh shift statuses, check missed doses, notify uncovered shifts
-- Called periodically from the app when online.

CREATE OR REPLACE FUNCTION refresh_app_alerts()
RETURNS void AS $$
BEGIN
  PERFORM refresh_shift_statuses();
  PERFORM check_missed_doses();
  PERFORM notify_uncovered_shifts();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION refresh_app_alerts() TO authenticated;
