/**
 * Session management (ARCHITECTURE.md SS7, TASKS.md T07).
 *
 * Token lifecycle:
 *  1. Generate token = base64url(random 32 bytes) via CSPRNG
 *  2. Store token_hash = hex(SHA-256(token)) — raw token never persisted
 *  3. Cookie carries raw token; server hashes inbound cookie to look up session
 *  4. Sliding expiry: bump last_seen_at + extends expires_at if idle > idleRefreshMin
 *  5. Rotation: every login creates a brand-new session
 *
 * Cleanup: purgeExpiredSessions() on each successful login.
 *
 * Cookie flags: HttpOnly, Secure (prod), SameSite=Lax, Path=/ (SS7)
 */
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type postgres from "postgres";
import { config } from "@/lib/config";
import type { AgentContext, PreAuthUser, UserCategory, UserRole } from "@/lib/types";

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random session token (32 bytes, base64url encoded).
 * NEVER log or persist this value.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash a raw session token with SHA-256 → hex string for DB storage */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

const TTL_MS = config.session.ttlHours * 60 * 60 * 1000;
const ABSOLUTE_CAP_MS = config.session.absoluteCapDays * 24 * 60 * 60 * 1000;

/**
 * Create a new session in the database and return the raw (cookie) token.
 * Uses the admin/owner DB connection — not app_runtime — because this
 * runs in the pre-auth login handler before user context is established.
 */
export async function createSession(
  sql: ReturnType<typeof postgres.prototype.constructor> | postgres.Sql,
  userId: string,
  ip?: string,
  userAgent?: string
): Promise<{ token: string }> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);
  const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_CAP_MS);

  const db = sql as postgres.Sql;
  await db`
    INSERT INTO sessions (
      user_id, token_hash, expires_at, absolute_expires_at,
      last_seen_at, created_ip, created_user_agent
    ) VALUES (
      ${userId}, ${tokenHash}, ${expiresAt}, ${absoluteExpiresAt},
      ${now}, ${ip ?? null}, ${userAgent ?? null}
    )
  `;

  return { token };
}

/**
 * Resolve a raw session token to an AgentContext.
 * Returns null if the session is missing, expired, or revoked.
 * Applies sliding expiry bump when the idle threshold is exceeded.
 */
export async function resolveSession(
  sql: postgres.Sql,
  rawToken: string
): Promise<AgentContext | null> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const rows = await sql<
    {
      session_id: string;
      expires_at: Date;
      absolute_expires_at: Date;
      last_seen_at: Date;
      user_id: string;
      category: string;
      role: string;
      account_id: string | null;
      is_active: boolean;
    }[]
  >`
    SELECT
      s.id              AS session_id,
      s.expires_at,
      s.absolute_expires_at,
      s.last_seen_at,
      u.id              AS user_id,
      u.category,
      u.role,
      u.account_id,
      u.is_active
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.revoked_at IS NULL
      AND s.expires_at > ${now}
      AND s.absolute_expires_at > ${now}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const row = rows[0]!;

  // Invalidate immediately if user is deactivated mid-session (SS7 step 4)
  if (!row.is_active) {
    await revokeSessionByHash(sql, tokenHash);
    return null;
  }

  // Sliding expiry: bump if idle > idleRefreshMin (SS7 step 5)
  const idleMs = config.session.idleRefreshMin * 60 * 1000;
  const idleSince = now.getTime() - new Date(row.last_seen_at).getTime();
  if (idleSince > idleMs) {
    const newExpiry = new Date(
      Math.min(now.getTime() + TTL_MS, row.absolute_expires_at.getTime())
    );
    await sql`
      UPDATE sessions
      SET last_seen_at = ${now}, expires_at = ${newExpiry}
      WHERE id = ${row.session_id}
    `;
  }

  return {
    userId: row.user_id,
    category: row.category as UserCategory,
    role: row.role as UserRole,
    accountId: row.account_id ?? null,
    isActive: row.is_active,
  };
}

/**
 * Revoke a session by raw token (used during logout).
 */
export async function revokeSession(
  sql: postgres.Sql,
  rawToken: string
): Promise<void> {
  await revokeSessionByHash(sql, hashToken(rawToken));
}

async function revokeSessionByHash(
  sql: postgres.Sql,
  tokenHash: string
): Promise<void> {
  await sql`
    UPDATE sessions SET revoked_at = now()
    WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
  `;
}

/**
 * Purge expired/stale sessions (opportunistic cleanup on login).
 * Cheap: indexed on expires_at / revoked_at.
 */
export async function purgeExpiredSessions(sql: postgres.Sql): Promise<void> {
  await sql`
    DELETE FROM sessions
    WHERE expires_at < now()
      OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')
  `;
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const COOKIE_NAME = config.session.cookieName;
const COOKIE_MAX_AGE = config.session.ttlHours * 3600; // seconds

/**
 * Set the session cookie on a NextResponse.
 * HttpOnly, Secure (prod), SameSite=Lax, Path=/ (ARCHITECTURE.md SS7)
 */
export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.session.secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Clear the session cookie (logout / session invalidation) */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: config.session.secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Read raw session token from incoming request cookies */
export function getSessionTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

/** Read raw session token from Next.js server-component cookies() */
export async function getSessionTokenFromCookieStore(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

// ─── requireSession (guard helper) ───────────────────────────────────────────

/**
 * Resolve the session from an incoming API request.
 * Returns AgentContext on success.
 * Returns a 401 NextResponse redirect to /login on failure.
 *
 * Usage in route handlers:
 *   const result = await requireSession(req, sql);
 *   if (result instanceof NextResponse) return result;  // 401 redirect
 *   const ctx = result;
 */
export async function requireSession(
  req: NextRequest,
  sql: postgres.Sql
): Promise<AgentContext | NextResponse> {
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const ctx = await resolveSession(sql, token);
  if (!ctx) {
    const res = NextResponse.json(
      { error: "Session expired or invalid." },
      { status: 401 }
    );
    clearSessionCookie(res);
    return res;
  }

  return ctx;
}

// Re-export PreAuthUser for session-adjacent callers
export type { AgentContext, PreAuthUser };
