-- ============================================================
-- ParcelPilot — Migration 0003: policy hardening
-- Spec: ARCHITECTURE.md §11 ("fail-closed when identity context is absent")
--
-- Role-branch policies previously authorized on app.role/app.action_class alone;
-- they now ALSO require app.user_id to be present, so ANY partially-set or absent
-- context yields zero rows / zero effects. Server code always sets all five GUCs.
-- ============================================================

-- ---------- orders ----------
DROP POLICY IF EXISTS orders_support_select ON orders;
CREATE POLICY orders_support_select ON orders FOR SELECT
USING (
  current_setting('app.user_id', true) <> ''
  AND current_setting('app.category', true) = 'support'
);

DROP POLICY IF EXISTS orders_cancel_update ON orders;
CREATE POLICY orders_cancel_update ON orders FOR UPDATE
USING (
  current_setting('app.user_id', true) <> ''
  AND current_setting('app.action_class', true) = 'execute_cancel_order'
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
DROP POLICY IF EXISTS tickets_support_select ON tickets;
CREATE POLICY tickets_support_select ON tickets FOR SELECT
USING (
  current_setting('app.user_id', true) <> ''
  AND current_setting('app.category', true) = 'support'
);

DROP POLICY IF EXISTS tickets_support_update ON tickets;
CREATE POLICY tickets_support_update ON tickets FOR UPDATE
USING (
  current_setting('app.user_id', true) <> ''
  AND current_setting('app.role', true) IN ('support_agent','ops_manager')
)
WITH CHECK (
  current_setting('app.user_id') <> ''
  AND current_setting('app.role') IN ('support_agent','ops_manager')
);

-- ---------- pending_actions ----------
DROP POLICY IF EXISTS pending_actions_select ON pending_actions;
CREATE POLICY pending_actions_select ON pending_actions FOR SELECT
USING (
  current_setting('app.user_id', true) <> ''
  AND (
    user_id::text = nullif(current_setting('app.user_id', true), '')
    OR current_setting('app.role', true) IN ('support_agent','ops_manager')
  )
);

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
  current_setting('app.user_id') <> ''
  AND (
    user_id::text = nullif(current_setting('app.user_id'), '')
    OR current_setting('app.role') = 'ops_manager'
  )
);

-- ---------- audit_log ----------
DROP POLICY IF EXISTS audit_read_ops ON audit_log;
CREATE POLICY audit_read_ops ON audit_log FOR SELECT
USING (
  current_setting('app.user_id', true) <> ''
  AND current_setting('app.role', true) = 'ops_manager'
);
