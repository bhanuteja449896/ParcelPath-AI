/**
 * POST /api/login — Custom authentication endpoint (ARCHITECTURE.md SS5, TASKS.md T08).
 *
 * Flow:
 *  1. Validate request body shape (zod)
 *  2. Lookup user via SECURITY DEFINER fn app_lookup_login (never direct SELECT)
 *  3. Not found → dummyVerify() → generic 401
 *  4. Found, is_active=false → record failed attempt → generic 401
 *  5. locked_until check → generic 401 (rate limit)
 *  6. verifyPassword → failure → record attempt → generic 401
 *  7. Success → purge stale sessions, create session, set cookie, redirect
 *
 * Generic errors: never reveal whether login ID exists or account is locked.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import postgres from "postgres";
import { config } from "@/lib/config";
import { dummyVerify, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  purgeExpiredSessions,
  setSessionCookie,
} from "@/lib/auth/session";

export const runtime = "nodejs";

const LoginSchema = z.object({
  loginId: z.string().min(1).max(200).trim(),
  password: z.string().min(1).max(1000),
});

const GENERIC_ERROR = { error: "Invalid login ID or password." };

/** One-off admin connection for pre-auth operations (DIRECT_URL or DATABASE_URL) */
function makeAdminSql() {
  // Use DATABASE_URL; the SECURITY DEFINER functions bypass RLS for credential lookup
  return postgres(config.databaseUrl, { prepare: false, max: 1 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Validate body ──────────────────────────────────────────────────────
  let body: z.infer<typeof LoginSchema>;
  try {
    const raw = await req.json();
    body = LoginSchema.parse(raw);
  } catch {
    return NextResponse.json(GENERIC_ERROR, { status: 400 });
  }

  const sql = makeAdminSql();
  try {
    // ── 2. Lookup user (SECURITY DEFINER fn — bypasses RLS safely) ──────────
    const users = await sql<
      {
        id: string;
        password_hash: string;
        is_active: boolean;
        failed_login_count: number;
        locked_until: Date | null;
        category: string;
      }[]
    >`
      SELECT l.id, l.password_hash, l.is_active,
             l.failed_login_count, l.locked_until, l.category
      FROM app_lookup_login(${body.loginId}) l
    `;

    // ── 3. Not found → dummy verify → generic 401 ──────────────────────────
    if (users.length === 0) {
      await dummyVerify();
      return NextResponse.json(GENERIC_ERROR, { status: 401 });
    }

    const user = users[0]!;

    // ── 4. Inactive account → generic 401 (never reveal state) ────────────
    if (!user.is_active) {
      await sql`SELECT app_record_login_result(${user.id}::uuid, false)`;
      await dummyVerify();
      return NextResponse.json(GENERIC_ERROR, { status: 401 });
    }

    // ── 5. Rate limit gate: check locked_until ────────────────────────────
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await dummyVerify();
      return NextResponse.json(GENERIC_ERROR, { status: 401 });
    }

    // ── 6. Verify password (Argon2id constant-time) ───────────────────────
    const valid = await verifyPassword(user.password_hash, body.password);
    if (!valid) {
      // Increment failed_login_count; lock after threshold (e.g. 10 attempts)
      await sql`SELECT app_record_login_result(${user.id}::uuid, false)`;

      // Apply lock if threshold exceeded (10 attempts → 15-min lockout)
      const newCount = user.failed_login_count + 1;
      if (newCount >= 10) {
        await sql`
          UPDATE users
          SET locked_until = now() + interval '15 minutes'
          WHERE id = ${user.id}::uuid AND locked_until IS NULL
        `;
      }

      return NextResponse.json(GENERIC_ERROR, { status: 401 });
    }

    // ── 7. Success ────────────────────────────────────────────────────────
    // Record success (resets failed_login_count, sets last_login_at)
    await sql`SELECT app_record_login_result(${user.id}::uuid, true)`;

    // Opportunistic session cleanup
    await purgeExpiredSessions(sql as unknown as postgres.Sql);

    // Create new session (rotation — each login = fresh token)
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined;
    const ua = req.headers.get("user-agent") ?? undefined;
    const { token } = await createSession(
      sql as unknown as postgres.Sql,
      user.id,
      ip,
      ua
    );

    // Redirect target by category (ARCHITECTURE.md SS5 step 8)
    const redirectTo = user.category === "customer" ? "/" : "/internal";

    const res = NextResponse.json({ redirect: redirectTo }, { status: 200 });
    setSessionCookie(res, token);
    return res;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
