/**
 * GET /api/session (ARCHITECTURE.md SS4, TASKS.md T08).
 * Returns the current session context (no sensitive fields) or 401.
 * Used by client components to hydrate UI identity.
 *
 * Response shape deliberately excludes: password_hash, token_hash, any credential.
 */
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { config } from "@/lib/config";
import {
  clearSessionCookie,
  getSessionTokenFromRequest,
  resolveSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = getSessionTokenFromRequest(req);

  if (!token) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const sql = postgres(config.databaseUrl, { prepare: false, max: 1 });
  try {
    const ctx = await resolveSession(sql as unknown as postgres.Sql, token);

    if (!ctx) {
      const res = NextResponse.json(
        { error: "Session expired or invalid." },
        { status: 401 }
      );
      clearSessionCookie(res);
      return res;
    }

    // Return safe identity fields only — never include any credential
    return NextResponse.json({
      userId: ctx.userId,
      category: ctx.category,
      role: ctx.role,
      accountId: ctx.accountId,
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
