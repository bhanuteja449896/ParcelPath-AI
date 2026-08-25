-- ============================================================
-- ParcelPilot — Migration 0006: Session pre-auth lookups
-- Fixes the chicken-and-egg problem for session resolution where
-- RLS prevents reading sessions without first knowing the user_id.
-- ============================================================

-- Function to look up a session by token hash, joining with the user
-- to return the full AgentContext needed for request authorization.
CREATE OR REPLACE FUNCTION app_lookup_session(p_token_hash text)
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  expires_at timestamptz,
  category text,
  role text,
  account_id uuid,
  is_active boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    s.id AS session_id,
    s.user_id,
    s.expires_at,
    u.category,
    u.role,
    u.account_id,
    u.is_active
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = p_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now();
$$;

-- Function to create a session without RLS constraints (since login 
-- occurs before the identity context wrapper is typically engaged)
CREATE OR REPLACE FUNCTION app_create_session(
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_absolute_expires_at timestamptz,
  p_created_ip inet,
  p_created_user_agent text
)
RETURNS uuid
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO sessions (user_id, token_hash, expires_at, absolute_expires_at, created_ip, created_user_agent)
  VALUES (p_user_id, p_token_hash, p_expires_at, p_absolute_expires_at, p_created_ip, p_created_user_agent)
  RETURNING id;
$$;

-- Function to opportunistic purge expired sessions
CREATE OR REPLACE FUNCTION app_purge_expired_sessions()
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM sessions 
  WHERE expires_at < now() 
     OR revoked_at < now() - interval '7 days';
$$;

-- Grant execution to the app_runtime role
GRANT EXECUTE ON FUNCTION app_lookup_session(text) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_create_session(uuid, text, timestamptz, timestamptz, inet, text) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_purge_expired_sessions() TO app_runtime;
