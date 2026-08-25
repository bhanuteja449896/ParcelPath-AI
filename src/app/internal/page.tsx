/**
 * Internal support console — stub (ARCHITECTURE.md SS26, TASKS.md T09).
 * Full implementation in Phase 8 (T23).
 * Middleware already guards this route (category=support only).
 */
import { redirect } from "next/navigation";
import postgres from "postgres";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getSessionTokenFromCookieStore, resolveSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Internal Console — ParcelPilot",
};

export default async function InternalPage() {
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
  if (ctx.category !== "support") redirect("/unauthorized");

  return (
    <main style={{ padding: "2rem", fontFamily: "inherit" }}>
      <h1 style={{ color: "var(--text)", marginBottom: "0.5rem" }}>
        ParcelPilot — Internal Console
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
        Welcome, <strong style={{ color: "var(--text)" }}>{ctx.role}</strong>.
        Full console UI coming in Phase 8.
      </p>
      <form action="/api/logout" method="POST">
        <button
          type="submit"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
          }}
        >
          Logout
        </button>
      </form>
    </main>
  );
}
