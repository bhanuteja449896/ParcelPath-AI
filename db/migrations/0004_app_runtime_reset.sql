-- ============================================================
-- ParcelPilot — Migration 0004: app_runtime credential rotation
--
-- Neon quirk (documented ARCHITECTURE.md §3.1): role passwords set at
-- CREATE ROLE stick (control-plane provisioned), but subsequent SQL
-- ALTER ROLE PASSWORD changes are unreliable (silently reverted).
-- Therefore credential rotation = DROP + CREATE within this migration,
-- followed by full re-granting. Password arrives via {{APP_RUNTIME_DB_PASSWORD}}.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    -- Strip privileges so DROP succeeds; policy references don't block drops.
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM app_runtime';
    EXECUTE 'REVOKE ALL ON SCHEMA public FROM app_runtime';
    EXECUTE 'REVOKE ALL ON FUNCTION app_lookup_login(citext) FROM app_runtime';
    EXECUTE 'REVOKE ALL ON FUNCTION app_record_login_result(uuid, boolean) FROM app_runtime';
    EXECUTE 'DROP ROLE app_runtime';
  END IF;

  EXECUTE format(
    'CREATE ROLE app_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
    '{{APP_RUNTIME_DB_PASSWORD}}'
  );
END
$$;

-- ---------- Re-grant full allowlist (mirrors 0002 §13.4) ----------
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT ON accounts        TO app_runtime;
GRANT SELECT ON users           TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO app_runtime;
GRANT SELECT, UPDATE ON orders  TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON tickets TO app_runtime;
GRANT SELECT ON documents       TO app_runtime;
GRANT SELECT ON document_chunks TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON pending_actions TO app_runtime;
GRANT INSERT, SELECT ON audit_log TO app_runtime;
GRANT SELECT ON system_metadata TO app_runtime;
GRANT EXECUTE ON FUNCTION app_lookup_login(citext)               TO app_runtime;
GRANT EXECUTE ON FUNCTION app_record_login_result(uuid, boolean) TO app_runtime;
