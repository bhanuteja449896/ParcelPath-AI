/**
 * POST /api/logout (ARCHITECTURE.md SS5, TASKS.md T08).
 * Revokes the session server-side, clears the cookie, returns redirect to /login.
 * Safe to call multiple times (idempotent).
 */
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { config } from "@/lib/config";
import {
  clearSessionCookie,
  getSessionTokenFromRequest,
  revokeSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = getSessionTokenFromRequest(req);

  if (token) {
    const sql = postgres(config.databaseUrl, { prepare: false, max: 1 });
    try {
      await revokeSession(sql as unknown as postgres.Sql, token);
    } catch {
      // Best-effort; always clear cookie and redirect
    } finally {
      await sql.end({ timeout: 5 });
    }
  }

  const res = NextResponse.json({ redirect: "/login" }, { status: 200 });
  clearSessionCookie(res);
  return res;
}
