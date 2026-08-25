-- ============================================================
-- ParcelPilot — Migration 0002: app_runtime role, grants, RLS
-- Spec: ARCHITECTURE.md §3.1, §11, §13.4
--
-- Model:
--  * Request path uses ONLY role `app_runtime` (NOBYPASSRLS) via DATABASE_URL.
--  * Identity reaches policies through transaction-scoped GUCs set by server code:
--      app.user_id, app.category, app.role, app.account_id ('' = NULL), app.action_class
--    All policies FAIL CLOSED when context is absent/blank.
--  * FORCE ROW LEVEL SECURITY binds every role; an explicit {t}_owner_all policy
--    TO {{OWNER_ROLE}} keeps migrations/seeding (DIRECT_URL ops path) functional.
--    {{OWNER_ROLE}} is substituted by scripts/migrate.ts from DIRECT_URL.
--  * Pre-auth login lookup uses SECURITY DEFINER functions (pinned search_path,
--    EXECUTE granted only to app_runtime); users table is otherwise self-scoped.
-- ============================================================

-- ---------- Role ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE format('CREATE ROLE app_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
                   '{{APP_RUNTIME_DB_PASSWORD}}');
  END IF;
END
$$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_runtime;

-- ---------- Grants (explicit allowlist; §13.4) ----------
GRANT SELECT ON accounts        TO app_runtime;
GRANT SELECT ON users           TO app_runtime;              -- rows constrained by RLS to self / definer fns
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO app_runtime;
GRANT SELECT, UPDATE ON orders  TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON tickets TO app_runtime;
GRANT SELECT ON documents       TO app_runtime;
GRANT SELECT ON document_chunks TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON pending_actions TO app_runtime;
GRANT INSERT, SELECT ON audit_log TO app_runtime;            -- no UPDATE/DELETE: append-only
GRANT SELECT ON system_metadata TO app_runtime;

-- ---------- SECURITY DEFINER helpers (pre-auth path; §11.1) ----------
CREATE OR REPLACE FUNCTION app_lookup_login(p_login_id citext)
RETURNS TABLE (id uuid, password_hash text, is_active boolean,
               failed_login_count integer, locked_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.password_hash, u.is_active, u.failed_login_count, u.locked_until
  FROM users u
  WHERE u.login_id = p_login_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app_record_login_result(p_user_id uuid, p_success boolean)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_success THEN
    UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE users SET failed_login_count = failed_login_count + 1
    WHERE id = p_user_id;
  END IF;
END;
$$;

ALTER FUNCTION app_lookup_login(citext)               OWNER TO {{OWNER_ROLE}};
ALTER FUNCTION app_record_login_result(uuid, boolean) OWNER TO {{OWNER_ROLE}};
REVOKE ALL ON FUNCTION app_lookup_login(citext)               FROM PUBLIC;
REVOKE ALL ON FUNCTION app_record_login_result(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_lookup_login(citext)               TO app_runtime;
GRANT EXECUTE ON FUNCTION app_record_login_result(uuid, boolean) TO app_runtime;

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_actions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metadata  ENABLE ROW LEVEL SECURITY;

ALTER TABLE accounts         FORCE ROW LEVEL SECURITY;
ALTER TABLE users            FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions         FORCE ROW LEVEL SECURITY;
ALTER TABLE orders           FORCE ROW LEVEL SECURITY;
ALTER TABLE tickets          FORCE ROW LEVEL SECURITY;
ALTER TABLE documents        FORCE ROW LEVEL SECURITY;
ALTER TABLE document_chunks  FORCE ROW LEVEL SECURITY;
ALTER TABLE pending_actions  FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log        FORCE ROW LEVEL SECURITY;
ALTER TABLE system_metadata  FORCE ROW LEVEL SECURITY;

-- ---------- Owner ops-path policy (migrations/seeding ONLY — never request path) ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts','users','sessions','orders','tickets','documents',
    'document_chunks','pending_actions','audit_log','system_metadata'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO %I USING (true) WITH CHECK (true)',
      t || '_owner_all', t, '{{OWNER_ROLE}}'
    );
  END LOOP;
END $$;

-- ---------- accounts: any authenticated user reads permitted scope ----------
CREATE POLICY accounts_read ON accounts FOR SELECT
USING (
  current_setting('app.user_id', true) <> ''
  AND (
    current_setting('app.category', true) = 'support'
    OR id::text = nullif(current_setting('app.account_id', true), '')
  )
);

-- ---------- users: self only (pre-auth goes through app_lookup_login) ----------
CREATE POLICY users_self_select ON users FOR SELECT
USING (id::text = nullif(current_setting('app.user_id', true), ''));

CREATE POLICY users_self_update ON users FOR UPDATE
USING (id::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (id::text = nullif(current_setting('app.user_id'), ''));

-- ---------- sessions: owner of session only ----------
CREATE POLICY sessions_self ON sessions FOR ALL
USING   (user_id::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (user_id::text = nullif(current_setting('app.user_id'), ''));

-- ---------- orders ----------
CREATE POLICY orders_customer_select ON orders FOR SELECT
USING (
  current_setting('app.category', true) = 'customer'
  AND account_id::text = nullif(current_setting('app.account_id', true), '')
);

CREATE POLICY orders_support_select ON orders FOR SELECT
USING (current_setting('app.category', true) = 'support');

-- Cancellation execution: action_class gate + ops_manager anywhere OR customer on own account.
-- support_agent intentionally excluded (authorization matrix §9).
CREATE POLICY orders_cancel_update ON orders FOR UPDATE
USING (
  current_setting('app.action_class', true) = 'execute_cancel_order'
  AND (
    current_setting('app.role', true) = 'ops_manager'
    OR (
      current_setting('app.category', true) = 'customer'
      AND account_id::text = nullif(current_setting('app.account_id', true), '')
    )
  )
)
WITH CHECK (true);

-- ---------- tickets ----------
CREATE POLICY tickets_customer_select ON tickets FOR SELECT
USING (
  current_setting('app.category', true) = 'customer'
  AND account_id::text = nullif(current_setting('app.account_id', true), '')
);

CREATE POLICY tickets_support_select ON tickets FOR SELECT
USING (current_setting('app.category', true) = 'support');

-- Escalation creation inserts ticket rows; customers limited to own account.
CREATE POLICY tickets_insert ON tickets FOR INSERT
WITH CHECK (
  current_setting('app.user_id', true) <> ''
  AND (
    current_setting('app.category', true) = 'support'
    OR account_id::text = nullif(current_setting('app.account_id', true), '')
  )
);

CREATE POLICY tickets_support_update ON tickets FOR UPDATE
USING (current_setting('app.role', true) IN ('support_agent','ops_manager'))
WITH CHECK (current_setting('app.role', true) IN ('support_agent','ops_manager'));

-- ---------- documents & chunks (agreements account-scoped; deprecated unreachable) ----------
CREATE POLICY documents_select ON documents FOR SELECT
USING (
  current_setting('app.user_id', true) <> ''
  AND authority <> 'deprecated_policy'
  AND (
    account_id IS NULL
    OR current_setting('app.category', true) = 'support'
    OR account_id::text = nullif(current_setting('app.account_id', true), '')
  )
);

CREATE POLICY chunks_select ON document_chunks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents d
    WHERE d.id = document_id
      AND d.authority <> 'deprecated_policy'
      AND (
        d.account_id IS NULL
        OR current_setting('app.category', true) = 'support'
        OR d.account_id::text = nullif(current_setting('app.account_id', true), '')
      )
  )
);

-- ---------- pending_actions ----------
CREATE POLICY pending_actions_select ON pending_actions FOR SELECT
USING (
  user_id::text = nullif(current_setting('app.user_id', true), '')
  OR current_setting('app.role', true) IN ('support_agent','ops_manager')
);

CREATE POLICY pending_actions_insert ON pending_actions FOR INSERT
WITH CHECK (user_id::text = nullif(current_setting('app.user_id'), ''));

CREATE POLICY pending_actions_update ON pending_actions FOR UPDATE
USING (
  user_id::text = nullif(current_setting('app.user_id', true), '')
  OR current_setting('app.role', true) = 'ops_manager'
)
WITH CHECK (
  user_id::text = nullif(current_setting('app.user_id'), '')
  OR current_setting('app.role') = 'ops_manager'
);

-- ---------- audit_log: append by authenticated actor; read by ops only; no update/delete ----------
CREATE POLICY audit_insert ON audit_log FOR INSERT
WITH CHECK (actor_user_id::text = nullif(current_setting('app.user_id'), ''));

CREATE POLICY audit_read_ops ON audit_log FOR SELECT
USING (current_setting('app.role', true) = 'ops_manager');

-- ---------- system_metadata: read for authenticated; writes only via ops path ----------
CREATE POLICY system_metadata_read ON system_metadata FOR SELECT
USING (current_setting('app.user_id', true) <> '');
