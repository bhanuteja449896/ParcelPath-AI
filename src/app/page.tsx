/**
 * Root page — redirects by session category (ARCHITECTURE.md SS4, TASKS.md T09).
 * Authenticated customers land here; support users go to /internal.
 * No-auth → /login (handled by middleware, but also guarded here for SSR).
 */
import { redirect } from "next/navigation";
import postgres from "postgres";
import { config } from "@/lib/config";
import { getSessionTokenFromCookieStore, resolveSession } from "@/lib/auth/session";

export default async function RootPage() {
  const token = await getSessionTokenFromCookieStore();
  if (!token) redirect("/login");

  const sql = postgres(config.databaseUrl, { prepare: false, max: 1 });
  let ctx;
  try {
    ctx = await resolveSession(sql as unknown as Parameters<typeof resolveSession>[0], token);
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (!ctx) redirect("/login");

  // Support users should be at /internal
  if (ctx.category === "support") redirect("/internal");

  // Customer stub — Phase 7 will build the full chat UI here
  return (
    <div style={{ padding: "2rem", fontFamily: "inherit" }}>
      <h1 style={{ color: "var(--text)", marginBottom: "0.5rem" }}>
        ParcelPilot — Customer Portal
      </h1>
      <p style={{ color: "var(--text-muted)" }}>
        Chat UI coming in Phase 7. Session active for: {ctx.userId}
      </p>
    </div>
  );
}
