-- ============================================================
-- ParcelPilot — Migration 0007: Login lookup fix
-- Includes category in the lookup to avoid RLS blocked JOINs
-- ============================================================

DROP FUNCTION IF EXISTS app_lookup_login(citext);

CREATE FUNCTION app_lookup_login(p_login_id citext)
RETURNS TABLE (
  id uuid, 
  password_hash text, 
  is_active boolean,
  failed_login_count integer, 
  locked_until timestamptz,
  category text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.password_hash, u.is_active, u.failed_login_count, u.locked_until, u.category
  FROM users u
  WHERE u.login_id = p_login_id
  LIMIT 1;
$$;

ALTER FUNCTION app_lookup_login(citext) OWNER TO {{OWNER_ROLE}};
REVOKE ALL ON FUNCTION app_lookup_login(citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_lookup_login(citext) TO app_runtime;
