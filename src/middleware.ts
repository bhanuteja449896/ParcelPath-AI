/**
 * Next.js middleware — route guards (ARCHITECTURE.md SS4, SS9, TASKS.md T09).
 *
 * Runs on Node.js runtime (not Edge) to allow postgres.js for session resolution.
 * (ARCHITECTURE.md SS3.1: @node-rs/argon2 is native — but middleware does NOT
 * do password verification, only session lookup — postgres.js works in Node runtime)
 *
 * Public paths (no auth required):
 *   /login, /api/login, /_next/*, /favicon.ico, /unauthorized
 *
 * Auth-required paths:
 *   All others → redirect /login if no valid session
 *
 * Category guard:
 *   /internal* → requires category === 'support'; else redirect /unauthorized
 */
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { config } from "@/lib/config";
import {
  getSessionTokenFromRequest,
  resolveSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";

/** Paths that do not require authentication */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/login",
  "/unauthorized",
  "/_next/",
  "/favicon.ico",
];

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Allow public paths through
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Resolve session
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const sql = postgres(config.databaseUrl, { prepare: false, max: 1 });
  let ctx: Awaited<ReturnType<typeof resolveSession>>;
  try {
    ctx = await resolveSession(sql as unknown as postgres.Sql, token);
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (!ctx) {
    // Expired or revoked session — clear cookie, redirect to login
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.set(config.session.cookieName, "", { maxAge: 0 });
    return res;
  }

  // Category guard: /internal requires support category (SS9, SS26)
  if (pathname.startsWith("/internal")) {
    if (ctx.category !== "support") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  return NextResponse.next();
}

export const config_middleware = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (Next.js static files)
     * - _next/image (image optimization)
     * - Public file extensions
     */
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2)).*)",
  ],
};

// Next.js reads `config` export for matcher — re-export under expected name
export { config_middleware as config };
