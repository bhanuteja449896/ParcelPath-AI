/**
 * Login page (ARCHITECTURE.md SS5, SS25, TASKS.md T09).
 * Server component — redirects to home if already authenticated.
 * Renders the LoginForm client component.
 */
import { redirect } from "next/navigation";
import postgres from "postgres";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getSessionTokenFromCookieStore, resolveSession } from "@/lib/auth/session";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in — ParcelPilot",
  description: "Sign in to ParcelPilot AI Support",
};

export default async function LoginPage() {
  // Already authenticated? Redirect away
  const token = await getSessionTokenFromCookieStore();
  if (token) {
    const sql = postgres(config.databaseUrl, { prepare: false, max: 1 });
    let ctx;
    try {
      ctx = await resolveSession(sql as unknown as Parameters<typeof resolveSession>[0], token);
    } finally {
      await sql.end({ timeout: 5 });
    }
    if (ctx) {
      redirect(ctx.category === "support" ? "/internal" : "/");
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        {/* Logo / branding */}
        <div style={styles.header}>
          <div style={styles.logo}>📦</div>
          <h1 style={styles.title}>ParcelPilot</h1>
          <p style={styles.subtitle}>AI Support System</p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    background: "linear-gradient(135deg, #0f1117 0%, #1a1d2e 50%, #0f1117 100%)",
  } as React.CSSProperties,
  card: {
    width: "100%",
    maxWidth: "420px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "2.5rem",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  } as React.CSSProperties,
  header: {
    textAlign: "center" as const,
    marginBottom: "2rem",
  } as React.CSSProperties,
  logo: {
    fontSize: "2.5rem",
    marginBottom: "0.75rem",
  } as React.CSSProperties,
  title: {
    fontSize: "1.6rem",
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: "-0.02em",
  } as React.CSSProperties,
  subtitle: {
    color: "var(--text-muted)",
    fontSize: "0.875rem",
    marginTop: "0.25rem",
  } as React.CSSProperties,
} as const;
