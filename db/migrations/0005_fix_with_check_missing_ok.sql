-- ============================================================
-- ParcelPilot -- Migration 0005: fix WITH CHECK missing-ok flag
-- Spec: ARCHITECTURE.md SS11 (fail-closed policies)
--
-- Problem: Several WITH CHECK clauses in 0002 used
--   current_setting('app.user_id')   <- throws if GUC unset
-- instead of
--   current_setting('app.user_id', true)  <- returns '' gracefully
--
-- Migration 0003 fixed USING clauses for role-branch policies but
-- left these WITH CHECK clauses uncorrected. This migration
-- drops and recreates the affected policies with the true flag.
-- Effect: fail-closed behavior unchanged; error noise eliminated.
-- ============================================================

-- ---------- users: self-scoped update ----------
DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update ON users FOR UPDATE
USING   (id::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (id::text = nullif(current_setting('app.user_id', true), ''));

-- ---------- sessions: owner of session only ----------
DROP POLICY IF EXISTS sessions_self ON sessions;
CREATE POLICY sessions_self ON sessions FOR ALL
USING   (user_id::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (user_id::text = nullif(current_setting('app.user_id', true), ''));

-- ---------- pending_actions: creator-scoped insert ----------
DROP POLICY IF EXISTS pending_actions_insert ON pending_actions;
CREATE POLICY pending_actions_insert ON pending_actions FOR INSERT
WITH CHECK (
  current_setting('app.user_id', true) <> ''
  AND user_id::text = nullif(current_setting('app.user_id', true), '')
);

-- ---------- pending_actions: update ----------
DROP POLICY IF EXISTS pending_actions_update ON pending_actions;
CREATE POLICY pending_actions_update ON pending_actions FOR UPDATE
USING (
  current_setting('app.user_id', true) <> ''
  AND (
    user_id::text = nullif(current_setting('app.user_id', true), '')
    OR current_setting('app.role', true) = 'ops_manager'
  )
)
WITH CHECK (
  current_setting('app.user_id', true) <> ''
  AND (
    user_id::text = nullif(current_setting('app.user_id', true), '')
    OR current_setting('app.role', true) = 'ops_manager'
  )
);

-- ---------- audit_log: insert by authenticated actor ----------
DROP POLICY IF EXISTS audit_insert ON audit_log;
CREATE POLICY audit_insert ON audit_log FOR INSERT
WITH CHECK (
  current_setting('app.user_id', true) <> ''
  AND actor_user_id::text = nullif(current_setting('app.user_id', true), '')
);
