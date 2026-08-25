-- ============================================================
-- ParcelPilot AI Support System — Migration 0001: schema init
-- Spec: ARCHITECTURE.md §10 (tables, constraints, indexes)
-- Runs as project owner over DIRECT_URL. No grants/RLS here (0002).
-- Idempotency: tracked by scripts/migrate.ts via schema_migrations.
-- ============================================================

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector 0.8.x
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;   -- case-insensitive login_id

-- ---------- Shared trigger: updated_at ----------
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------- accounts ----------
CREATE TABLE accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,              -- 'northstar' | 'lumenworks'
  display_name text NOT NULL,
  plan_tier    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- users ----------
CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id           citext NOT NULL UNIQUE,
  password_hash      text NOT NULL,               -- PHC string (Argon2id); never exposed
  category           text NOT NULL CHECK (category IN ('customer','support')),
  role               text NOT NULL CHECK (role IN ('customer_user','customer_admin','support_agent','ops_manager')),
  account_id         uuid REFERENCES accounts(id),
  is_active          boolean NOT NULL DEFAULT true,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  last_login_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_category_role_pairing CHECK (
    (category = 'customer' AND role IN ('customer_user','customer_admin') AND account_id IS NOT NULL)
    OR
    (category = 'support' AND role IN ('support_agent','ops_manager') AND account_id IS NULL)
  )
);
CREATE INDEX idx_users_account_id ON users (account_id);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- sessions ----------
CREATE TABLE sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          text NOT NULL UNIQUE,        -- sha256(cookie token); raw token never stored
  expires_at          timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz,
  created_ip          inet,
  created_user_agent  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_expiry_order CHECK (expires_at <= absolute_expires_at)
);
CREATE INDEX idx_sessions_live ON sessions (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_user_id ON sessions (user_id);

-- ---------- orders ----------
CREATE TABLE orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             text NOT NULL UNIQUE,        -- business id e.g. 'ORD-1001' (from seed)
  account_id           uuid NOT NULL REFERENCES accounts(id),
  carrier              text NOT NULL,
  service_level        text,
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','picked_up','in_transit','delivered','cancelled','exception')),
  origin               text,
  destination          text,
  pickup_at            timestamptz,
  promised_delivery_at timestamptz,
  delivered_at         timestamptz,
  cancelled_at         timestamptz,
  cancelled_reason     text,
  seed_attributes      jsonb NOT NULL DEFAULT '{}'::jsonb, -- verbatim extra workbook columns
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_account_status ON orders (account_id, status);
CREATE INDEX idx_orders_carrier ON orders (carrier);

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- tickets ----------
CREATE TABLE tickets (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id                 text NOT NULL UNIQUE,   -- business id from seed
  account_id                uuid NOT NULL REFERENCES accounts(id),
  subject                   text NOT NULL,
  description               text,
  category                  text NOT NULL DEFAULT 'other'
                            CHECK (category IN ('complaint','billing','delivery','cancellation','other')),
  priority                  text NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('low','medium','high','urgent')),
  status                    text NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','pending','escalated','resolved','closed')),
  sla_due_at                timestamptz,
  historical_resolution     text,                    -- from XLSX; CONTEXT ONLY (§20 trust rules)
  resolution_is_historical  boolean NOT NULL DEFAULT false,
  seed_attributes           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_account_status ON tickets (account_id, status);
CREATE INDEX idx_tickets_sla ON tickets (status, sla_due_at);
CREATE INDEX idx_tickets_category ON tickets (category);

CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- documents ----------
CREATE TABLE documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text NOT NULL UNIQUE,               -- file stem, ingest idempotency key
  title          text NOT NULL,
  authority      text NOT NULL
                 CHECK (authority IN ('current_policy','deprecated_policy','sop',
                                      'product_guide','known_issues','customer_agreement')),
  version        text,
  account_id     uuid REFERENCES accounts(id),       -- agreements only
  source_filename text NOT NULL,
  content_sha256 text,
  page_count     integer,
  ingested_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_agreement_scope CHECK ((authority = 'customer_agreement') = (account_id IS NOT NULL))
);
CREATE INDEX idx_documents_authority ON documents (authority);
CREATE INDEX idx_documents_account_id ON documents (account_id);

-- ---------- document_chunks ----------
CREATE TABLE document_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_text  text NOT NULL,
  embedding   vector(1536),                          -- matches EMBED_MODEL default; see §14
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,    -- page numbers etc.
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_chunks_doc_index UNIQUE (document_id, chunk_index)
);
CREATE INDEX idx_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_tsv ON document_chunks USING gin (content_tsv);

-- ---------- pending_actions ----------
CREATE TABLE pending_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  action_type       text NOT NULL
                    CHECK (action_type IN ('cancel_order','update_ticket','create_escalation','create_follow_up_task')),
  payload           jsonb NOT NULL,                  -- validated per-type in app layer
  display_summary   text NOT NULL,                   -- exact preview shown in confirm card
  target_account_id uuid REFERENCES accounts(id),    -- denormalized scope for re-checks
  resource_type     text,
  resource_id       text,
  status            text NOT NULL DEFAULT 'awaiting_confirmation'
                    CHECK (status IN ('awaiting_confirmation','executed','expired','cancelled','failed')),
  expires_at        timestamptz NOT NULL,
  executed_at       timestamptz,
  executed_by       uuid REFERENCES users(id),       -- approver when applicable
  result            jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pending_actions_executed_consistency CHECK ((status = 'executed') = (executed_at IS NOT NULL))
);
CREATE INDEX idx_pending_user_status ON pending_actions (user_id, status);
CREATE INDEX idx_pending_open_expires ON pending_actions (expires_at) WHERE status = 'awaiting_confirmation';
CREATE INDEX idx_pending_resource ON pending_actions (resource_type, resource_id);

CREATE TRIGGER trg_pending_updated_at
BEFORE UPDATE ON pending_actions
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- audit_log (append-only; no UPDATE/DELETE anywhere) ----------
CREATE TABLE audit_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  actor_user_id     uuid REFERENCES users(id),
  actor_category    text,
  actor_role        text,
  account_id        uuid,
  action            text NOT NULL,
  resource_type     text,
  resource_id       text,
  old_state         jsonb,
  new_state         jsonb,
  pending_action_id uuid REFERENCES pending_actions(id),
  outcome           text NOT NULL CHECK (outcome IN ('success','rejected','failed')),
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb  -- NON-sensitive: tool names, citation ids
);
CREATE INDEX idx_audit_occurred ON audit_log (occurred_at DESC);
CREATE INDEX idx_audit_actor ON audit_log (actor_user_id);
CREATE INDEX idx_audit_resource ON audit_log (resource_type, resource_id);

-- ---------- system_metadata ----------
CREATE TABLE system_metadata (
  key        text PRIMARY KEY,                      -- reference_time | embed_model | embedding_dim | seed_version | data_pack_sha256
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
