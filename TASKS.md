# ParcelPilot — Task Breakdown

> Operational companion to `ARCHITECTURE.md` (technical source of truth).
> **How to work:** pick the first unchecked task → read its referenced architecture sections →
> implement → verify its acceptance criteria → tick the checkbox → move on.
> Never skip dependencies. Update this file every time a task completes.

**Progress: 13 / 28 complete**

## Dependency Overview

```
T01 ─┬─► T02 ─► T03 ─► T04 ─► T05 ─┬─► T06 ─► T07 ─► T08 ─► T09
     │                             │
     │                             ├─► T10 ─┐
     │                             ├─► T11 ─┼─► T12
     │                             └─► T13 ─┴─► T14 ─┬─► T15 ─► T16
     │                                               │    ├─► T17 ─► T18 ─► T19 ─► T20
     │                                               │    └─► T21 ─► T22
     │                                               └────────────────► T23 ─► T24
     └─────────────────────────────────────────────────────────────────► T25 ─► T26 ─► T27 ─► T28
```

---

## Phase 0 — Setup & Scaffold

### ✅ T01 — Repository foundations
- [x] Product brief (`README.md`), architecture v2 (`ARCHITECTURE.md`), task plan (this file)
- [x] `.gitignore` (excludes `.kilo/`, `.env`, secrets)

### ✅ T02 — Environment configuration
- [x] `.env` created with all placeholders (user fills API keys locally; never committed)
- [x] `.env.example` committed template matching `ARCHITECTURE.md` §33
- [ ] Verify at dev-server time that config loads via a typed config module (fold into T01 code work)

### ✅ T03 — Neon project provisioning
- [x] Create Neon project; copy **pooled** `DATABASE_URL` (`-pooler` host) and direct `DIRECT_URL` into `.env`; choose a strong `APP_RUNTIME_DB_PASSWORD`
- [x] Verify extension availability (`vector`, `pgcrypto`, `citext`) and connectivity on both endpoints
- Refs: §3 · Done when: connection smoke test passes with both URLs.
- Verified 2026-08-25: PostgreSQL 18.6; vector@0.8.6, pgcrypto@1.4, citext@1.8 available; pooled + direct both connect as `neondb_owner`.

## Phase 1 — Database Foundation

### ✅ T04 — Migration 0001: schema
- [x] Tables per §10 ERD: `accounts, users, sessions, orders, tickets, documents, document_chunks (vector + tsvector), pending_actions, audit_log, system_metadata`
- [x] All PKs/FKs/CHECKs/indexes/constraints exactly as §10 normative list
- Refs: §10 · Done when: `npm run db:migrate` green; `\d+` matches spec.
- Verified 2026-08-25: `0001_init.sql` applied to Neon (PostgreSQL 18.6); extensions `vector@0.8.6`, `pgcrypto`, `citext` enabled; migration runner = `scripts/migrate.ts` over `DIRECT_URL`.

### ✅ T05 — RLS + grants
- [x] Create `app_runtime` role (`NOBYPASSRLS`, password from env), explicit grants; then point `DATABASE_URL`'s username at `app_runtime`
- [x] `ENABLE`+`FORCE ROW LEVEL SECURITY`; fail-closed policies per §11 (tenant select, support select, guarded update, chunks visibility, audit append-only)
- Refs: §11–13 · Done when: contextless query as `app_runtime` returns zero rows / write denied (ST-21).
- Verified 2026-08-25: **19/19 RLS checks pass** (contextless deny, tenant isolation, users self-scope, pre-auth definer fns, deprecated-doc firewall, agreement scoping, cancel-gate by role, audit append-only). Extras shipped: `0003_policy_hardening.sql` (blank-context hardening on role branches) and `0004_app_runtime_reset.sql` (Neon-safe credential rotation — see §3.1 quirk notes).

## Phase 2 — Authentication

### ✅ T06 — Password hashing module
- [x] `src/lib/auth/password.ts`: Argon2id hash/verify (`@node-rs/argon2`, OWASP params: m=19456,t=2,p=1), dummy-hash verify helper
- [x] Unit tests: 10/10 pass; PHC string format verified; case-sensitivity, roundtrip, dummyVerify timing
- Verified 2026-08-25: all tests pass with `@node-rs/argon2`.

### ✅ T07 — Session system
- [x] `src/lib/auth/session.ts`: base64url token gen (32 bytes CSPRNG), SHA-256 at rest, create/resolve/revoke, sliding expiry, rotation-on-login, cookie helpers (HttpOnly/Secure/SameSite=Lax)
- [x] Unit tests: 8/8 pass; token uniqueness, base64url safety, hash determinism
- Verified 2026-08-25: generateSessionToken produces 43-char base64url; hashToken produces 64-char hex.

### ✅ T08 — Auth API routes
- [x] `POST /api/login`: zod body validation, app_lookup_login SECURITY DEFINER, dummyVerify on miss, inactive handling, locked_until gate, argon2id verify, session create+cookie, generic errors
- [x] `POST /api/logout`: session revoke, cookie clear, redirect
- [x] `GET /api/session`: returns safe ctx fields; no credential exposure
- Verified 2026-08-25: all routes use `runtime = 'nodejs'`; no secrets in responses.

### ✅ T09 — Route guards + login UI
- [x] `src/middleware.ts`: Node.js runtime; public path allowlist; session resolve; /internal category guard → /unauthorized redirect
- [x] `src/app/login/page.tsx`: server component with LoginForm client; redirect if already authed
- [x] `src/components/auth/LoginForm.tsx`: Login ID + Password + Login button; generic error display; password field cleared on error
- [x] `src/app/unauthorized/page.tsx`: 403 page with back-to-login link
- [x] `src/app/page.tsx`: root redirect by category; customer→/ support→/internal
- [x] `src/lib/config.ts`: typed env config module (satisfies T02 fold-in)
- Verified 2026-08-25: typecheck clean; 18/18 unit tests pass.

## Phase 3 — Data Ingestion

### T10 — XLSX ingestion
- [x] `scripts/ingestData.ts`: workbook → accounts/orders/tickets; README sheet → `system_metadata.reference_time`; historical resolutions flagged; prod reseed guard
- Refs: §16–17 · Done when: row counts match workbook; idempotent rerun; reference_time set.

### T11 — PDF ingestion (RAG)
- [x] `scripts/ingestDocs.ts`: extract → chunk (~500 tok) → embed (`EMBED_MODEL`) → `documents`/`document_chunks` with authority tier + account scope metadata; hnsw + GIN indexes; idempotent by slug
- Refs: §14–15 · Done when: 6 docs indexed; hybrid search returns sensible ranked chunks with tiers.

### T12 — Seed orchestration
- [ ] `scripts/seed.ts`: demo users (§8 table) hashed from `SEED_DEMO_PASSWORD`; runs T10+T11; writes seed_version/pack hash
- Refs: §31 · Done when: fresh clone → seed → login works end-to-end.

## Phase 4 — Data Access Layer

### T13 — Client + identity context
- [ ] `lib/data/client.ts` (postgres.js, `prepare:false`, DATABASE_URL); `withUserContext()` BEGIN+set_config wrapper
- Refs: §12 · Done when: transaction-scoped GUCs proven by SQL tests (fail-closed).

### T14 — Repositories
- [ ] All 8 repos (users/sessions/accounts/orders/tickets/documents/pendingActions/audit); mandatory ctx param; explicit column selects; CAS-guarded writes
- Refs: §13 · Done when: scoping unit tests pass incl. cross-account negatives; no secret columns in any result shape.

## Phase 5 — Agent Core

### T15 — Orchestrator
- [ ] `lib/agent/orchestrator.ts`: hand-written tool loop (max 8 steps), SSE streaming events, history trimming, duplicate-call suppression
- [ ] `lib/llm/client.ts`: OpenAI-compatible factory from env
- Refs: §18 · Done when: scripted multi-tool conversation streams traces correctly.

### T16 — Prompts + trust engine
- [ ] Customer/internal personas; trust precedence, conflict surfacing, deprecated firewall, confidence gate → clarify/escalate; citation contract
- Refs: §20 · Done when: trap-case evals behave per §29 ST-22–24 expectations (final validation in T26).

### T17 — Tool T1: document_search
- [ ] Hybrid pgvector+FTS retrieval, mandatory filters (no deprecated, account-scoped agreements), tier metadata returned
- Refs: §14, §19 · Done when: Northstar/LumenWorks scoping + deprecation exclusion tests pass.

### T18 — Tool T2: data_lookup + calculate
- [ ] Scoped entity lookups; deterministic business modules: cancellation fee, service credit, SLA remaining/breach
- Refs: §19, §29-of-brief · Done when: calculator unit tests golden; LLM never does arithmetic.

## Phase 6 — State-Changing Actions

### T19 — Tool T3: draft_action
- [ ] Action types cancel_order/update_ticket/create_escalation/create_follow_up_task; zod payload schemas; permission matrix gating; pending_actions rows with 15-min TTL + display summaries
- Refs: §21 · Done when: drafts persist with correct scope + role denials audited.

### T20 — Confirmation pipeline
- [ ] `/api/actions/[id]/confirm|decline`: 12-step secure flow (§23) in one transaction; guarded UPDATEs; audit entries; TTL sweeper
- Refs: §22–24 · Done when: ST-18–20 pass (foreign confirm rejected, duplicates idempotent, stale cancels safe).

## Phase 7 — Customer UI

### T21 — Chat experience
- [x] Streaming chat, tool-trace timeline, citation chips with tier badges
- Refs: §25 · Done when: example queries show tools used + sources cited.
- Verified 2026-08-26: full redesign shipped (design tokens light/dark, ToolTrace timeline rendering real SSE events, SourceChips parsing actual document_search results, markdown renderer, responsive composer). Verified via live SSE test as northstar_admin: tool_call → tool_result → token events render; citations parsed.

### T22 — Action confirmation UX
- [x] Confirm/decline cards bound only to pendingActionId; success/failure feedback
- Refs: §23, §25 · Done when: full cancel-order flow works from the browser.
- Verified 2026-08-26: ActionCard v2 with explicit confirmation sheet, expiry countdown, all backend outcome states (executed/declined/failed/expired/unauthorized/stale). End-to-end tested: draft ORD-1002 cancel → confirm 200 "Order ORD-1002 cancelled successfully"; decline path 200. Fixed pre-existing confirm/decline route bugs (business-ID lookups, audit_log column names) required to make this pass.

## Phase 8 — Support UI

### T23 — Internal console
- [x] `/internal`: chat, lookup panel, approvals queue (ops_manager), audit viewer (ops_manager)
- Refs: §26 · Done when: role-scoped rendering + server-side 403s verified.
- Verified 2026-08-26: ConsoleApp shell (collapsible sidebar, mobile drawer nav) with Overview / AI Support + context panel / Issues / Approvals / Audit views; manager-only items hidden for support_agent while APIs still enforce 403 server-side.
- Extended 2026-08-26 (support-console gaps): added Tickets + Orders views backed by new read-only `/api/internal/tickets` and `/api/internal/orders` endpoints (RLS-scoped via existing repos); Overview now shows live "Open tickets" metric. Fixed `data_lookup` so support users can list tickets/orders cross-account (was hard-failing without accountId), normalized plural-entity+id calls to singular lookups, and fixed `seedUsers.ts` reseed blocker (audit_log/pending_actions FK cleanup).

## Phase 9 — Proactive Issue Detection

### T24 — Issues endpoint + dashboard
- [x] `GET /api/issues` heuristics (spikes, clusters, SLA risk, cross-account incidents, anomalies) anchored to reference_time; findings link evidence; draft-escalation shortcut via normal pipeline
- Refs: §27 · Done when: seeded dataset produces plausible findings; actions still gated.
- Verified 2026-08-26: returns real findings ("5 tickets nearing or breached SLA", high). Fixed pre-existing reference_time jsonb parsing bug (`extractReferenceTime`) that 500'd the endpoint. UI: severity badges, evidence chips, one-click "Draft in AI chat" prefill.

## Phase 10 — Hardening

### T25 — Security test suite
- [ ] Implement ST-01–ST-26 (§29) as vitest integration + SQL RLS tests + static greps
- Done when: full suite green in CI-runnable command.

### T26 — Agent evals + failure polish
- [ ] Golden-question eval set (fee override, late-pickup credit, deprecated trap, bad-history trap, cross-account probe, multi-step chain); §30 failure-path behaviors polished
- Done when: eval report clean; failures degrade safely per §30.

## Phase 11 — Ship

### T27 — Deployment
- [ ] Vercel + Neon (single region); env vars configured; migrations + guarded seed applied; hosted URL live
- Refs: §32 · Done when: public URL serves both consoles over HTTPS.

### T28 — Submission package
- [ ] Architecture note + product note (drafted from ARCHITECTURE.md §20/§27/§41 + metric §40-of-brief)
- [ ] ~5-min demo video (script: §42 P11 refs); repo README final pass; submit form
- Done when: form submitted with repo + hosted URL.

---

## Working Rules for Future AI Sessions

1. Read `README.md` then `ARCHITECTURE.md` before any task.
2. Claim the lowest-numbered unchecked task whose dependencies are complete.
3. Do not change architecture decisions — if a deviation seems necessary, stop and propose an edit to `ARCHITECTURE.md` first.
4. Every task ends with: lint + typecheck + relevant tests passing, and this file updated.
5. Secrets live only in `.env` (never printed into logs/code/docs).
